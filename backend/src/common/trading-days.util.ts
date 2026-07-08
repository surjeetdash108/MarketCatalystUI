/** Approximate US trading-day helper — skips weekends, not full market holidays. */

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Walks backward from `from` (inclusive) returning ISO dates that aren't
 * weekends. Market holidays still come back empty from the vendor and get
 * skipped by the caller's retry loop.
 */
export function* candidateTradingDays(
  from: Date,
  maxLookback = 7,
): Generator<string> {
  const cursor = new Date(from);
  let yielded = 0;
  while (yielded < maxLookback) {
    if (!isWeekend(cursor)) {
      yield toIsoDate(cursor);
      yielded++;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
}
