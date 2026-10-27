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
/** The vendor day rolls to a new session once that day's extended hours end (20:00 ET). */
const ROLLOVER_MINUTES_ET = 20 * 60;

/**
 * The completed daily bars the published 52-week range covers: dated AFTER
 * (anchor − 364 days) through the newest. The anchor is the newest session
 * once its day, extended hours included, is over (20:00 ET); before that it is
 * the previous session, and the newest bar only widens the range. Same rule as
 * the backend's fiftyTwoWeekWindow (E2E Oct 23 + Oct 26: SFM 107.31 / GS 754 /
 * CAT 521.43 and ANIP 96.57 / MSEX 62.18 / ORCL 287).
 */
export function fiftyTwoWeekBars<T extends { t: number }>(bars: readonly T[], now: number = Date.now()): T[] {
  if (bars.length === 0) return [];
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(now)).map((x) => [x.type, x.value]),
  );
  const minutes = (Number(p.hour) % 24) * 60 + Number(p.minute);
  const last = day(bars[bars.length - 1].t);
  const anchor = bars.length > 1 && last === day(now) && minutes < ROLLOVER_MINUTES_ET ? day(bars[bars.length - 2].t) : last;
  const start = new Date(`${anchor}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - FIFTY_TWO_WEEKS_DAYS);
  const cut = start.toISOString().slice(0, 10);
  return bars.filter((b) => day(b.t) > cut);
}
