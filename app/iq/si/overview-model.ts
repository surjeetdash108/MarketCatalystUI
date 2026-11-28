import { gaapQuarterEps } from "../types/financials";
import type { GrowthRow, GrowthSeries, ScoreRow, Tone } from "./si-overview";

/** The parts of a reported quarter the growth chart reads. */
export type GrowthQuarter = {
  endDate?: string | null;
  fiscalPeriod?: string | null;
  fiscalYear?: string | number | null;
  revenue?: number | null;
  epsActual?: number | null;
};

/** Percent change of `cur` over `prev`; null when either is missing or `prev` is too close to zero to mean anything. */
function change(cur: number | null | undefined, prev: number | null | undefined): number | null {
  return cur != null && prev != null && Math.abs(prev) > 0.05 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
}

/** "Q3'26": the fiscal period and the last two digits of the fiscal year. */
const labelOf = (q: GrowthQuarter) => `${q.fiscalPeriod ?? ""}'${String(q.fiscalYear ?? "").slice(-2)}`;

/**
 * Revenue and EPS growth for the latest four reported quarters, oldest first, as the Overview chart draws them.
 * Year over year compares each quarter with the same fiscal period a year earlier (not "four slots down", which a
 * missing quarter would shift); quarter over quarter compares it with the quarter before. Each row also names the
 * quarter it was compared with (`yoyVs`, `qoqVs`). EPS is the GAAP diluted figure, the one the Fundamentals tab
 * shows. A series with no quarters is left out.
 */
export function growthSeries(quarters: ReadonlyArray<GrowthQuarter> | null | undefined): GrowthSeries[] {
  const sorted = [...(quarters ?? [])].filter((q) => q.endDate).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  const rowsFor = (value: (q: GrowthQuarter) => number | null | undefined): GrowthRow[] =>
    sorted
      .slice(0, 4)
      .map((q, i) => {
        const yearAgo = sorted.find((o) => o.fiscalPeriod === q.fiscalPeriod && Number(o.fiscalYear) === Number(q.fiscalYear) - 1);
        const before = sorted[i + 1];
        const now = value(q);
        return {
          label: labelOf(q),
          yoy: yearAgo ? change(now, value(yearAgo)) : null,
          qoq: before ? change(now, value(before)) : null,
          // The quarters those two figures are measured against, so the axis can say what each bar is compared with.
          yoyVs: yearAgo ? labelOf(yearAgo) : null,
          qoqVs: before ? labelOf(before) : null,
        };
      })
      .reverse();
  const series: GrowthSeries[] = [
    { key: "rev", name: "Revenue", rows: rowsFor((q) => q.revenue) },
    { key: "eps", name: "EPS", rows: rowsFor((q) => gaapQuarterEps(q)) },
  ];
  return series.filter((s) => s.rows.length > 0);
}

/** The order the Overview lists the signal categories in (Company first, then Market). */
const SCORE_ORDER = ["Business", "Earnings", "Valuation", "Flows", "Macro", "Catalysts", "Technicals"];

/** "BUSINESS" -> "Business". */
export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * One row per signal category that has data and carries weight in MC Confidence. `names` maps the engine's
 * category key to the name shown (BUS -> BUSINESS).
 */
export function scoreRows(
  cats: ReadonlyArray<{ k: string; label: string; w: number; score: number; ds: ReadonlyArray<unknown> }>,
  names: Record<string, string>,
): ScoreRow[] {
  const rank = (name: string) => {
    const i = SCORE_ORDER.indexOf(name);
    return i < 0 ? SCORE_ORDER.length : i;
  };
  return cats
    .filter((c) => c.ds.length > 0 && c.w > 0)
    .map((c) => ({ k: titleCase(names[c.k] || c.label), v: Math.round(c.score) }))
    .sort((a, b) => rank(a.k) - rank(b.k));
}

/** A 0-100 score as a direction: 70 and up bullish, under 40 bearish, otherwise neutral. */
export const toneForScore = (v: number | null | undefined): Tone => (v == null ? "flat" : v >= 70 ? "up" : v < 40 ? "down" : "flat");

export const statusForTone = (tone: Tone): "Bullish" | "Bearish" | "Neutral" => (tone === "up" ? "Bullish" : tone === "down" ? "Bearish" : "Neutral");
