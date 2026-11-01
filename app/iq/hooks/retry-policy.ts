/**
 * Whether a failed backend read is worth one more try, and after how long.
 *
 * useApiResource used to give up after one failure, and screens render a
 * failed read the same as an empty one: on E2E Oct 26 KR's Earnings tab,
 * Insider tab and Stock Intelligence statements all showed "not available"
 * while the stored data was complete. A timeout, a network failure, a 429 or a
 * 5xx is transient — retried twice with backoff. A 4xx other than 429 is an
 * answer (404 = no such data) and is not retried.
 */
export const RETRY_DELAYS_MS = [1500, 4000] as const;

export function retryDelayMs(err: unknown, attempt: number): number | null {
  if (attempt >= RETRY_DELAYS_MS.length) return null;
  const e = err as { name?: string; status?: number; message?: string } | null;
  if (e?.name === "AbortError") return null; // superseded by a newer path
  const status = typeof e?.status === "number" ? e.status : null;
  if (status != null) {
    return status === 429 || status >= 500 ? RETRY_DELAYS_MS[attempt] : null;
  }
  // No HTTP status: timeout or network failure.
  return RETRY_DELAYS_MS[attempt];
}
