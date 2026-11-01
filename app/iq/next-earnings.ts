/**
 * THE next-earnings date, shared by the stock page, Stock Intelligence (facts,
 * upcoming card, Catalysts tab) and anything else that names the next report.
 *
 * The earliest date still ahead among the stored company date and the earnings
 * calendar — a stored date can be a report already made (MSFT showed Jul 29
 * after reporting), so only future dates count.
 */
export function nextEarningsDate(
  stored: string | null | undefined,
  events: ReadonlyArray<{ date: string }>,
  today: string,
): string | null {
  const cal = events.map((e) => e.date).filter((d) => d >= today).sort()[0] ?? null;
  return [stored ?? null, cal].filter((d): d is string => !!d && d >= today).sort()[0] ?? null;
}

/** Half a quarter: two upcoming rows closer than this are the same report. */
const SAME_REPORT_DAYS = 45;

/**
 * The calendar with ONE upcoming row per report. The calendar can hold two
 * rows for the same upcoming report under different dates (ANIP Nov 5 + Nov 6,
 * IRMD Oct 30 + Nov 2 on 2026-10-26), which put two next-earnings cards with
 * different dates on Stock Intelligence. Future rows within half a quarter of
 * the chosen date are dropped; the chosen date's own row is kept (or, when only
 * the stored date knows it, the nearest one is re-dated to it). Past reports
 * are untouched.
 */
export function withOneUpcomingReport<T extends { date: string }>(
  events: ReadonlyArray<T>,
  chosen: string | null,
  today: string,
): T[] {
  if (!chosen) return [...events];
  const days = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
  const past = events.filter((e) => e.date < today);
  const future = events.filter((e) => e.date >= today);
  const sameReport = future.filter((e) => days(e.date, chosen) < SAME_REPORT_DAYS);
  const others = future.filter((e) => days(e.date, chosen) >= SAME_REPORT_DAYS);
  const exact = sameReport.find((e) => e.date === chosen);
  const nearest = [...sameReport].sort((a, b) => days(a.date, chosen) - days(b.date, chosen))[0];
  const kept = exact ?? (nearest ? { ...nearest, date: chosen } : null);
  return [...past, ...(kept ? [kept] : []), ...others].sort((a, b) => a.date.localeCompare(b.date));
}
