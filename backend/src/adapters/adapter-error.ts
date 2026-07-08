/** One failed attempt against a single source, kept for AllSourcesFailedError's detail list. */
export interface SourceAttempt {
  source: string;
  error: string;
  retryable: boolean;
}

/**
 * Thrown when every configured source (primary + fallback, if any) failed
 * or returned no data. Never swallow this into a bare `null`/`continue` —
 * callers must log or surface `attempts` verbatim so it's visible exactly
 * which vendors were tried and why each one failed.
 */
export class AllSourcesFailedError extends Error {
  readonly attempts: SourceAttempt[];

  constructor(entity: string, attempts: SourceAttempt[]) {
    super(
      `All sources failed for ${entity}: ` +
        attempts
          .map(
            (a) =>
              `${a.source} (${a.error}${a.retryable ? ', retryable' : ', not retryable'})`,
          )
          .join('; '),
    );
    this.name = 'AllSourcesFailedError';
    this.attempts = attempts;
  }

  /** True if at least one failed attempt looks transient (network/rate-limit/5xx) rather than permanent. */
  get anyRetryable(): boolean {
    return this.attempts.some((a) => a.retryable);
  }
}

/** Best-effort classification so retryable/non-retryable shows up in error responses instead of being guessed by the caller. */
export function isRetryableVendorError(err: unknown): boolean {
  const message = (err as Error)?.message?.toLowerCase() ?? '';
  if (/\b(429|rate.?limit|too many requests)\b/.test(message)) return true;
  if (
    /\b(50[0-4]|timeout|timed out|econnreset|network|fetch failed)\b/.test(
      message,
    )
  )
    return true;
  if (
    /\b(401|403|404|400|invalid|not.?found|plan restriction|402)\b/.test(
      message,
    )
  )
    return false;
  return true; // unknown shape — default to retryable rather than silently giving up
}
