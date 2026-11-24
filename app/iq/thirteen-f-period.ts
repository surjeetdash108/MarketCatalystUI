/**
 * 13F reporting quarters on the 13F & Insider screen, worked out from the data
 * instead of typed into the page. Funds file within 45 days of quarter end, and
 * the backend rolls tickers to a new quarter one at a time, so for a while some
 * stocks are on the new quarter and the rest on the previous one.
 */
export interface QuarterDoc {
  ticker?: string;
  year?: number | null;
  quarter?: number | null;
}

/** "Q3-26". */
export function periodLabel(year: number, quarter: number): string {
  return `Q${quarter}-${String(year).slice(-2)}`;
}

/** The 13F deadline: 45 days after quarter end, e.g. Q3 2026 → "Nov 14". */
export function filingDeadline(year: number, quarter: number): string {
  const end = new Date(Date.UTC(year, quarter * 3, 0)); // last day of the quarter's final month
  end.setUTCDate(end.getUTCDate() + 45);
  return end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface QuarterCoverage {
  label: string;
  deadline: string;
  count: number;
}

/** Quarters present in the rollups, newest first, with how many stocks are on each. */
export function quarterCoverage(docs: readonly QuarterDoc[]): QuarterCoverage[] {
  const counts = new Map<string, { year: number; quarter: number; count: number }>();
  for (const d of docs) {
    if (d.year == null || d.quarter == null) continue;
    const k = `${d.year}Q${d.quarter}`;
    const e = counts.get(k) ?? { year: d.year, quarter: d.quarter, count: 0 };
    e.count++;
    counts.set(k, e);
  }
  return [...counts.values()]
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter)
    .map(e => ({ label: periodLabel(e.year, e.quarter), deadline: filingDeadline(e.year, e.quarter), count: e.count }));
}
