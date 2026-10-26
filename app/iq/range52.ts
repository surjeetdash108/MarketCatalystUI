/**
 * The 52-week high / low every screen shows: the stored range (backend
 * technical-indicators — built from completed daily bars, structural breaks
 * trimmed), widened by today's session high / low from the live quote. The
 * stored range ends at the last synced bar, so a new high made today was
 * missing (QLYS 217.64 vs 219.03), and the stock page and Stock Intelligence
 * each used a different base (REPX 53.81 vs 54.18). One rule for both.
 */
export function range52(
  stored: { high: number | null | undefined; low: number | null | undefined },
  session: { high: number | null | undefined; low: number | null | undefined },
): { high: number | null; low: number | null } {
  const pos = (v: number | null | undefined) => (v != null && Number.isFinite(v) && v > 0 ? v : null);
  const sh = pos(stored.high), sl = pos(stored.low), dh = pos(session.high), dl = pos(session.low);
  return {
    high: sh != null && dh != null ? Math.max(sh, dh) : sh ?? null,
    low: sl != null && dl != null ? Math.min(sl, dl) : sl ?? null,
  };
}

/** 52 weeks, in days. */
const FIFTY_TWO_WEEKS_DAYS = 364;

/**
 * The completed daily bars inside the 52 weeks ending at the newest one: dated
 * AFTER (newest session − 364 days), session dates read in New York. Same rule
 * as the backend's fiftyTwoWeekWindow; quote pages use it. "The last 252 bars"
 * reached a session too far back and put a year-old extreme into the range
 * (SFM 109.61 / GS 744.66 / CAT 513.01 vs the published 107.31 / 754 / 521.43
 * at the Oct 23 2026 close).
 */
export function fiftyTwoWeekBars<T extends { t: number }>(bars: readonly T[]): T[] {
  if (bars.length === 0) return [];
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const start = new Date(`${day(bars[bars.length - 1].t)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - FIFTY_TWO_WEEKS_DAYS);
  const cut = start.toISOString().slice(0, 10);
  return bars.filter((b) => day(b.t) > cut);
}
