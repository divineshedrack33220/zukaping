/**
 * Chooses which backend the app talks to — the web twin of initActiveUrl() and
 * switchServer() in mobile_app/lib/services/api_service.dart.
 *
 * Render's free tier answers 502/503 while it is asleep and a suspended service
 * answers 503 with an HTML page, and a static-host rewrite turns an unknown
 * /api path into a 200 full of HTML. So "alive" is never a status code: a
 * server is healthy only when it answers with JSON the backend really produced.
 */

type ServerCandidate = {
  base: string;
  label: string;
};

/**
 * Only hosts that can actually answer. A probe that dies in DNS or hits a
 * suspended Render service prints an error the browser owns and we cannot
 * catch, so every dead candidate here is console noise on real users'
 * machines. zukaping.com's apex is registered to someone else's Render
 * account, lemon16 is an unrelated service and zukaping.onrender.com is
 * suspended; app.zukaping.com stays listed for when the record is added.
 */
const PRODUCTION: ServerCandidate[] = [
  { base: 'https://zukaping-backend.onrender.com/api', label: 'zukaping-backend (Render)' },
  { base: 'https://app.zukaping.com/api', label: 'app.zukaping.com' },
];

/**
 * Where an unprobed production build points before a health check has proved a
 * host. Deliberately the Render hostname: the domain candidates above are not
 * resolving yet, and an unverified guess would hang the first request.
 */
export const defaultProductionBase = 'https://zukaping-backend.onrender.com/api';

const BASE_KEY = 'zukaping.apiBase';
const FAST_MS = 3000;
/** A sleeping Render instance needs >25s before it answers the first request. */
const COLD_START_MS = 30000;

const hostLabel = (base: string): string => {
  try {
    return new URL(base, window.location.origin).host;
  } catch {
    return base;
  }
};

/**
 * Highest preference first. The dev server's own "/api" comes first so a Go
 * backend on your machine wins while it is running and stops costing the app
 * anything the moment it is switched off.
 */
function candidateOrder(): ServerCandidate[] {
  const list: ServerCandidate[] = [];
  const add = (base?: string, label?: string) => {
    const trimmed = (base || '').trim();
    if (!trimmed) return;
    if (list.some((candidate) => candidate.base === trimmed)) return;
    list.push({ base: trimmed, label: label || hostLabel(trimmed) });
  };

  // The app and the API are the same Go process now, so the origin the page was
  // loaded from is the best candidate: no CORS, no cold start on another host.
  // On a static-only host this probe fails fast and the remote candidates win.
  add('/api', import.meta.env.DEV ? 'this dev server' : 'this server');
  add(import.meta.env.VITE_API_URL as string | undefined);
  add(readStoredBase());
  for (const candidate of PRODUCTION) add(candidate.base, candidate.label);

  return list;
}

function readStoredBase(): string | null {
  try {
    return localStorage.getItem(BASE_KEY);
  } catch {
    return null;
  }
}

function storeBase(base: string): void {
  try {
    localStorage.setItem(BASE_KEY, base);
  } catch {
    /* private mode: the choice simply lives for this page load */
  }
}

function readJson(url: string, timeoutMs: number): Promise<Record<string, any> | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    .then(async (response) => (response.ok ? response.json().catch(() => null) : null))
    .catch(() => null)
    .finally(() => window.clearTimeout(timer));
}

/**
 * /vapid-public-key is the probe a browser can rely on: public, tiny, and
 * inside the CORS-covered API group. /health answers the same question with
 * more detail, but the build currently on Render sends no CORS headers on that
 * one path, so the browser cannot read it and it can only confirm, not veto.
 */
async function probe(candidate: ServerCandidate, timeoutMs: number): Promise<boolean> {
  const vapid = await readJson(`${candidate.base}/vapid-public-key`, timeoutMs);
  if (vapid && (vapid.publicKey || vapid.key)) return true;
  const health = await readJson(`${candidate.base}/health`, timeoutMs);
  return health?.status === 'ok';
}

/** Runs every probe at once so priority decides, not whichever host is nearest. */
async function sweep(list: ServerCandidate[], timeoutMs: number): Promise<ServerCandidate | null> {
  const results = await Promise.all(list.map((candidate) => probe(candidate, timeoutMs)));
  const healthy = list.filter((_, index) => results[index]);
  if (healthy.length > 1) {
    console.info(
      `[zukaping] ${healthy.length} backends answered /health; using ${healthy[0].label}`,
      healthy.map((candidate) => candidate.base)
    );
  }
  return healthy[0] || null;
}

let resolved: ServerCandidate | null = null;
let selecting: Promise<ServerCandidate> | null = null;
let recovering: Promise<string | null> | null = null;

async function select(): Promise<ServerCandidate> {
  const [primary, ...rest] = candidateOrder();

  /* The host that served the page also serves the API in every real deployment,
     so settle for that one probe first. Sweeping all candidates up front used to
     print a CORS or DNS error per unreachable host, and those are the browser's
     own console lines - catching the rejected fetch does not remove them. */
  if (await probe(primary, FAST_MS)) return use(primary);

  const quick = await sweep(rest, FAST_MS);
  if (quick) return use(quick);

  // Nothing answered quickly. That usually means the only live backend is
  // asleep, so give it the long timeout before deciding anything.
  const cold = await sweep(rest.length ? rest : [primary], COLD_START_MS);
  if (cold) return use(cold);

  console.warn('[zukaping] no backend answered /health; sending traffic to', primary.label);
  return use(primary);
}

function use(candidate: ServerCandidate): ServerCandidate {
  resolved = candidate;
  storeBase(candidate.base);
  window.dispatchEvent(new CustomEvent('server:changed', { detail: { ...candidate } }));
  return candidate;
}

/** Resolves once, memoised, and never rejects — a dead server is a result, not an error. */
export function ensureServer(): Promise<ServerCandidate> {
  if (resolved) return Promise.resolve(resolved);
  if (!selecting) selecting = select();
  return selecting;
}

export function activeServer(): ServerCandidate | null {
  return resolved;
}

export function activeServerBase(): string {
  return resolved?.base ?? (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '/api';
}

/**
 * A request failed the way a dead host fails. Re-probes every candidate and
 * returns the base to switch to, or null when nothing answered — in which case
 * the current host is kept, because a slow backend is not a dead one.
 */
export function recoverAfterFailure(failedBase: string): Promise<string | null> {
  if (recovering) return recovering;
  recovering = (async () => {
    const next = await sweep(candidateOrder(), FAST_MS);
    if (!next) return null;
    if (next.base === failedBase) return failedBase;
    use(next);
    console.info(`[zukaping] failed over from ${failedBase} to ${next.label}`);
    return next.base;
  })().finally(() => {
    recovering = null;
  });
  return recovering;
}
