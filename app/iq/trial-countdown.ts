/**
 * Countdown shown for the new-account intro and paid free trials.
 * Both end at 11:59 PM US Eastern on day 7, the sign-up day being day 1, so
 * the banner shows the date only (no time) and counts calendar days: on the
 * last day it reads "Ends today".
 */
const ET = "America/New_York";

export interface TrialCountdown {
  /** "6 days left" · "1 day left" · "Ends today" · "Ended". */
  left: string;
  /** "Nov 20, 2026" (US Eastern calendar); "" when unknown. */
  endsAt: string;
  ended: boolean;
}

/** Days from `from`'s Eastern date to `to`'s Eastern date. */
function etDays(to: number, from: number, timeZone: string): number {
  const ymd = (ms: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date(ms))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  };
  return Math.round((ymd(to) - ymd(from)) / 86_400_000);
}

export function trialCountdown(endIso: string | null | undefined, now: number = Date.now(), timeZone: string = ET): TrialCountdown {
  const end = endIso ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(end)) return { left: "", endsAt: "", ended: false };
  const endsAt = new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
  if (end - now <= 0) return { left: "Ended", endsAt, ended: true };
  const d = etDays(end, now, timeZone);
  if (d <= 0) return { left: "Ends today", endsAt, ended: false };
  return { left: `${d} ${d === 1 ? "day" : "days"} left`, endsAt, ended: false };
}
