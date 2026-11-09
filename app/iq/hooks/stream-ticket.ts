/**
 * Ticket cache for authenticated SSE streams.
 *
 * EventSource cannot send an Authorization header, so the backend's live
 * streams (/live/stream, /live/tape/stream) take a short-lived signed ticket in
 * the query string instead, issued by POST /api/stream-ticket over the normal
 * authenticated API. One ticket is shared by every stream on the page and
 * reused until a minute before it expires; concurrent callers share one fetch.
 */
export interface TicketResponse {
  ticket: string;
  expiresAt: string;
}

export type TicketFetcher = () => Promise<TicketResponse>;

/** Refresh this long before expiry so a reconnect never presents a dying ticket. */
export const REFRESH_MARGIN_MS = 60_000;

export function createTicketCache(fetchTicket: TicketFetcher, now: () => number = Date.now) {
  let cached: { value: string; exp: number } | null = null;
  let inflight: Promise<string | null> | null = null;

  return {
    /** A usable ticket, or null when one cannot be issued (signed out, streams not configured). */
    get(force = false): Promise<string | null> {
      if (!force && cached && cached.exp - now() > REFRESH_MARGIN_MS) return Promise.resolve(cached.value);
      if (!inflight) {
        inflight = fetchTicket()
          .then((r) => {
            const exp = Date.parse(r.expiresAt);
            cached = Number.isFinite(exp) ? { value: r.ticket, exp } : null;
            return r.ticket;
          })
          .catch(() => {
            cached = null;
            return null;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
    clear() {
      cached = null;
    },
  };
}

/** `url` with `ticket` appended as a query parameter. */
export function withTicket(url: string, ticket: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket)}`;
}
