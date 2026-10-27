/**
 * 12-month rolling cutoff for analyst rating actions.
 * Only calls made within the last 365 days (12 months rolling) are shown by default.
 * Stale actions from >12 months ago are hidden under an expandable toggle or omitted from default views.
 */

export const ANALYST_ROLLING_CUTOFF_MS = 365 * 86_400_000;

/**
 * Returns true if the action was filed within the last 12 rolling months (365 days).
 */
export function isRecentAnalystAction(dateStr: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!dateStr) return false;
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return false;
  return t >= nowMs - ANALYST_ROLLING_CUTOFF_MS;
}

/**
 * Returns the ISO date (YYYY-MM-DD) representing the 12-month rolling cutoff.
 */
export function analystCutoffDateIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ANALYST_ROLLING_CUTOFF_MS).toISOString().slice(0, 10);
}

/**
 * Partitions a list of analyst actions into recent (last 12 months) and older actions.
 */
export function filterRecentAnalystActions<T extends { date?: string | null }>(
  actions: T[],
  nowMs: number = Date.now(),
): { recent: T[]; older: T[] } {
  const recent: T[] = [];
  const older: T[] = [];
  for (const a of actions) {
    if (isRecentAnalystAction(a.date, nowMs)) {
      recent.push(a);
    } else {
      older.push(a);
    }
  }
  return { recent, older };
}
