/**
 * Stale-while-revalidate snapshots for the screens a user bounces between.
 *
 * Every tab refetched from scratch on mount, so each switch paid the network
 * before showing anything. A screen now seeds its state from here synchronously,
 * paints it on the first frame, and revalidates in the background.
 *
 * sessionStorage rather than localStorage: thread text stays with the tab that
 * opened it and is gone when the app closes, which matters on a shared browser.
 */

const PREFIX = 'zk.cache.';
const PERSIST_LIMIT = 512 * 1024;
const MEMORY_LIMIT = 40;

const memory = new Map<string, unknown>();

const scopedKey = (key: string) => `${PREFIX}${localStorage.getItem('userId') ?? 'anon'}.${key}`;

export function readCache<T>(key: string): T | null {
  const full = scopedKey(key);
  if (memory.has(full)) return (memory.get(full) as T) ?? null;
  try {
    const raw = sessionStorage.getItem(full);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memory.set(full, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown): void {
  const full = scopedKey(key);
  if (!memory.has(full) && memory.size >= MEMORY_LIMIT) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(full, data);
  try {
    const raw = JSON.stringify(data);
    if (raw.length > PERSIST_LIMIT) return;
    sessionStorage.setItem(full, raw);
  } catch {
    /* Quota or private mode: the in-memory copy still serves this session. */
  }
}

export function clearScreenCache(): void {
  memory.clear();
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}
