/**
 * Countdown shown for the new-account intro and paid free trials.
 * Access ends at an exact moment (created + 7 × 24 h), so the banner shows
 * that moment and counts whole days DOWN: 6 days 3 hours left reads
 * "6 days left" (never rounded up to 7), and the last day counts hours.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface TrialCountdown {
  /** "6 days left" · "1 day left" · "5 hours left" · "Less than an hour left" · "Ended". */
  left: string;
  /** "Nov 20, 7:00 PM" in the viewer's own time zone; "" when unknown. */
  endsAt: string;
  ended: boolean;
}

export function trialCountdown(endIso: string | null | undefined, now: number = Date.now(), timeZone?: string): TrialCountdown {
  const end = endIso ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(end)) return { left: "", endsAt: "", ended: false };
  const endsAt = new Date(end).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}),
  });
  const ms = end - now;
  if (ms <= 0) return { left: "Ended", endsAt, ended: true };
  if (ms >= DAY) {
    const d = Math.floor(ms / DAY);
    return { left: `${d} ${d === 1 ? "day" : "days"} left`, endsAt, ended: false };
  }
  if (ms >= HOUR) {
    const h = Math.floor(ms / HOUR);
    return { left: `${h} ${h === 1 ? "hour" : "hours"} left`, endsAt, ended: false };
  }
  return { left: "Less than an hour left", endsAt, ended: false };
}
