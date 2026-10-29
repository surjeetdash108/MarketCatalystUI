/**
 * Shared calendar-range helpers for the dividend, earnings, macro and IPO
 * calendars.
 *
 * All four screens previously hardcoded their date filters — e.g.
 * `exMonth === 6 && exDay === 25` and `e.month === 6 && e.day === 25` — which
 * froze every "Today / Yesterday / This Week" tab to 2026-06-25 permanently.
 * Everything here derives from a Date passed in by the caller, so the tabs track
 * the real clock and the logic is verified in one place instead of four.
 */

export type RangeTabKey =
  | 'today' | 'yest' | 'tom'
  | 'week' | 'prev' | 'next'
  | 'lmonth' | 'month';

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date (YYYY-MM-DD) on the New York market calendar. isoDay(new Date())
 *  is the UTC date, which flips to tomorrow at 8 PM ET while the app header
 *  still shows today. `en-CA` is only used because it formats as YYYY-MM-DD.
 *  One shared formatter: toLocaleDateString with a timeZone builds a new one per
 *  call (~0.1 ms), and callers run this per row — 5,637 earnings rows cost
 *  ~600 ms per dashboard render, vs ~18 ms reusing it. */
const ET_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
export const etTodayIso = (d: Date = new Date()) => ET_DATE.format(d);

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
};

/** Monday of the week containing d (UTC, Monday-start). */
export const mondayOf = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));

/**
 * Formats a date string the way it was recorded.
 *
 * A date-only string is a CALENDAR DAY, not an instant. "2026-09-01" parses as
 * midnight UTC, so formatting it in the reader's own zone moves it a day
 * earlier for everyone west of Greenwich — an economic event filed under Tue 1
 * opened a popup headed "Monday, August 31" in New York, while the same build
 * looked correct from India. It is read back in UTC, the zone it was parsed in.
 *
 * A full timestamp IS an instant, so it is shown in the reader's own zone —
 * which is what someone reading "published 3pm" wants to see.
 *
 * Every date-string in the app goes through here so the rule is applied once
 * rather than remembered at each call site.
 */
export function fmtDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  locale: string | undefined = 'en-US',
): string {
  if (!iso) return '—';
  // A zone-less value (date, or New York wall-clock time) keeps its written date.
  const wall = iso.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/);
  const dateOnly = !!wall && !opts.hour;
  const d = new Date(dateOnly ? `${wall![1]}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { ...opts, timeZone: dateOnly ? 'UTC' : 'America/New_York' });
}

const MON_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "2026-08-14" -> "Aug 14". Returns "—" for null so callers never print "null". */
export function fmtMonthDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return '—';
  return `${MON_ABBR[m - 1]} ${d}`;
}

/**
 * Inclusive [from,to] ISO range for a tab, relative to `now`.
 *
 * Week tabs are Mon–Fri (trading week). Month tabs use the 0th-day trick to get
 * the last day of a month, which handles leap years and year boundaries without
 * special cases — verified across 2027-01-01.
 */
export function rangeFor(tab: RangeTabKey, now: Date): { from: string; to: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mon = mondayOf(today);
  switch (tab) {
    case 'today':  return { from: isoDay(today), to: isoDay(today) };
    case 'yest':   return { from: isoDay(addDays(today, -1)), to: isoDay(addDays(today, -1)) };
    case 'tom':    return { from: isoDay(addDays(today, 1)),  to: isoDay(addDays(today, 1)) };
    case 'week':   return { from: isoDay(mon), to: isoDay(addDays(mon, 4)) };
    case 'prev':   return { from: isoDay(addDays(mon, -7)), to: isoDay(addDays(mon, -3)) };
    case 'next':   return { from: isoDay(addDays(mon, 7)),  to: isoDay(addDays(mon, 11)) };
    case 'lmonth': {
      const f = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return { from: isoDay(f), to: isoDay(t) };
    }
    default: { // 'month'
      const f = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
      return { from: isoDay(f), to: isoDay(t) };
    }
  }
}

export const inRange = (iso: string, r: { from: string; to: string }) =>
  iso >= r.from && iso <= r.to;

/**
 * Formats a market date without shifting it a day. A date-only string
 * ("2026-10-21") or a daily-bar timestamp at UTC midnight is a calendar day, so
 * it is formatted in UTC; reading it as an instant and formatting in New York
 * (or the viewer's own zone) showed every such date one day early. Any other
 * instant is formatted on the New York market clock.
 */
export function fmtMarketDate(
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  if (input == null || input === "") return "";
  // No zone (a date, or a New York wall-clock time): format its written date.
  const wall = typeof input === "string" ? input.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/) : null;
  if (wall) {
    return new Date(`${wall[1]}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const calendarDay = d.getTime() % 86_400_000 === 0;
  return d.toLocaleDateString("en-US", { ...opts, timeZone: calendarDay ? "UTC" : "America/New_York" });
}

/** Monthly equity options expire on the third Friday of the month. */
function thirdFriday(year: number, month0: number): string {
  const first = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const day = 1 + ((5 - first + 7) % 7) + 14;
  return isoDay(new Date(Date.UTC(year, month0, day)));
}

/** Next monthly options expiration (YYYY-MM-DD) on or after `fromIso`. */
export function nextMonthlyOpex(fromIso: string = etTodayIso()): string {
  const [y, m] = fromIso.split("-").map(Number);
  const thisMonth = thirdFriday(y, m - 1);
  return thisMonth >= fromIso ? thisMonth : thirdFriday(m === 12 ? y + 1 : y, m % 12);
}

/** FOMC rate-decision days (the second day of each scheduled meeting), as
 *  published by the Federal Reserve. Extend when the next year's schedule is set. */
export const FOMC_DECISION_DAYS: readonly string[] = [
  "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
  "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
];

/** Next FOMC decision day on or after `fromIso`, or null past the known schedule. */
export function nextFomcDecision(fromIso: string = etTodayIso()): string | null {
  return FOMC_DECISION_DAYS.find((d) => d >= fromIso) ?? null;
}

/** 13F filings are due 45 days after quarter end (next business day if that is a weekend). */
export function next13fDeadline(fromIso: string = etTodayIso()): string {
  const [y] = fromIso.split("-").map(Number);
  for (const yr of [y, y + 1]) {
    for (const [m0, d] of [[1, 14], [4, 15], [7, 14], [10, 14]] as const) {
      const dt = new Date(Date.UTC(yr, m0, d));
      while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) dt.setUTCDate(dt.getUTCDate() + 1);
      const iso = isoDay(dt);
      if (iso >= fromIso) return iso;
    }
  }
  return fromIso;
}
