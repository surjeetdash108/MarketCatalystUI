/**
 * Warms the backend's 1-minute bar cache for the tiles on screen, so a tile's
 * popover chart opens straight away. Requests go through the signed-in API
 * client (a bare fetch() carries no ID token and is rejected with 401), are
 * cancelled with the caller's signal when the screen goes away, and each
 * ticker is read at most once per `windowMs` — not on every board refresh.
 */
type Get = (path: string, opts: { signal: AbortSignal }) => Promise<unknown>;

export function createBarsPrefetcher(get: Get, now: () => number = Date.now, windowMs = 60_000) {
  const last = new Map<string, number>();
  return function prefetch(tickers: string[], signal: AbortSignal) {
    for (const sym of tickers) {
      const at = last.get(sym);
      if (at !== undefined && now() - at < windowMs) continue;
      last.set(sym, now());
      get(`/live/bars?ticker=${encodeURIComponent(sym)}&interval=1m`, { signal }).catch(() => {
        // Not warmed: let the next round try again.
        last.delete(sym);
      });
    }
  };
}
