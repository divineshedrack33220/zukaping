/** Browser geolocation helper matching `ApiService.getCurrentPosition()`. */

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Flutter uses accuracy `low` with a 4 s timeout and falls back to the
 * last-known position (null when unavailable).
 *
 * The fallback has to be a real position, not null. A denied or timed-out fix
 * used to reach the callers as `null`, and they answered with `0, 0` or simply
 * stopped asking, so the backend fell back to whatever it had stored — usually
 * nothing — and every distance label collapsed to "Nearby".
 */
const LAST_FIX_KEY = 'zukaping.lastLocation';
/** Older than a day and it is a different city, not a "recent" fix. */
const LAST_FIX_TTL_MS = 24 * 60 * 60 * 1000;

export function readLastFix(): Coords | null {
  try {
    const raw = localStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { lat?: number; lng?: number; at?: number };
    const { lat, lng, at } = stored;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (lat === 0 || lng === 0) return null;
    if (typeof at === 'number' && Date.now() - at > LAST_FIX_TTL_MS) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function saveLastFix(coords: Coords): void {
  try {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ ...coords, at: Date.now() }));
  } catch {
    /* private mode: the fix simply lives for this page load */
  }
}

export function getCurrentPosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(readLastFix());
      return;
    }
    let settled = false;
    const finish = (value: Coords | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    window.setTimeout(() => finish(readLastFix()), 4000);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fix = { lat: position.coords.latitude, lng: position.coords.longitude };
          saveLastFix(fix);
          finish(fix);
        },
        () => finish(readLastFix()),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    } catch {
      finish(readLastFix());
    }
  });
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
