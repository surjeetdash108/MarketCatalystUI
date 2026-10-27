import { sessionsBetween, tradingSessionsBack } from "./market-status";
import type { Week5Close } from "./types/companies";

export { tradingSessionsBack };

/**
 * The close a live 5-day move starts from: the one exactly 5 sessions before
 * `sessionDate`, the session the shown price belongs to.
 *
 * All symbols share the exact same base date (e.g. 2026-10-20 for session 2026-10-27).
 */
export function week5Base(
  closes: Week5Close[] | null | undefined,
  sessionDate: string,
): number | null {
  if (!closes || closes.length === 0) return null;
  const targetDate = tradingSessionsBack(sessionDate, 5);

  // Exact target date match
  const exact = closes.find((c) => c.date === targetDate);
  if (exact && exact.close > 0) return exact.close;

  // Exact 5 sessions back via sessionsBetween
  const bySessions = closes.find((c) => sessionsBetween(c.date, sessionDate) === 5);
  if (bySessions && bySessions.close > 0) return bySessions.close;

  // Closest bar on or before target date if calendar had an unscheduled holiday
  const prior = [...closes]
    .filter((c) => c.date <= targetDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prior && prior.close > 0) return prior.close;

  return null;
}
