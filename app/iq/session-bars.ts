/**
 * Session slicing for intraday bars.
 *
 * Kept free of React and Firebase imports so it can be exercised on its own —
 * the Eastern-time grouping below is the kind of logic that looks right and is
 * wrong for half the world's users.
 */

export interface TimedBar {
  /** Bar start, epoch ms (Polygon aggregate `t`). */
  t: number;
}

/**
 * The most recent `sessions` trading days' worth of bars, in input order.
 *
 * Bars are grouped by their Eastern-time calendar date, NOT the viewer's local
 * date. For a user in, say, Asia, a naive local-date split lands mid-session:
 * 09:30 ET is already the next calendar day locally, so "1D" would render the
 * tail of one session joined to the head of the next.
 *
 * Input is assumed ascending by time, which is how the aggregates endpoint
 * returns them (`sort=asc`).
 */
export function lastSessions<T extends TimedBar>(bars: T[], sessions: number): T[] {
  if (bars.length === 0 || sessions <= 0) return [];
  const dayOf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const order: string[] = [];
  const dayByIndex = bars.map(b => {
    const d = dayOf.format(new Date(b.t));
    // Ascending input means a new date can only ever be the next session, so
    // comparing against the last one seen is enough to build the ordered set.
    if (order[order.length - 1] !== d) order.push(d);
    return d;
  });
  const keep = new Set(order.slice(-sessions));
  return bars.filter((_, i) => keep.has(dayByIndex[i]));
}
