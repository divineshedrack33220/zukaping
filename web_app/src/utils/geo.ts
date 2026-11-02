/** Browser geolocation helper matching `ApiService.getCurrentPosition()`. */

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Flutter uses accuracy `low` with a 4 s timeout and falls back to the
 * last-known position (null when unavailable).
 */
export function getCurrentPosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: Coords | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    window.setTimeout(() => finish(null), 4000);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          finish({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => finish(null),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    } catch {
      finish(null);
    }
  });
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
