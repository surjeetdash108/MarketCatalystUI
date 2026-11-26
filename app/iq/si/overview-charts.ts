import type { SiFacts } from "./data";

/**
 * The small bar charts under the Overview's Fundamentals tiles, as data: which quarters, which bars, which
 * peer-average lines. The component draws them (read-chart.tsx). Ported from the new design.
 */

export type ChartSeries = {
  name: string;
  tag: string;
  values: Array<number | null>;
  /** The bar's colour; `bright` is true for the latest group (or for every group when none is highlighted). */
  color: (index: number, bright: boolean) => string;
};
export type ChartRef = { value: number; label: string; color: string };
export type ChartSpec = {
  groups: string[];
  series: ChartSeries[];
  fmt: (v: number) => string;
  refs?: ChartRef[];
  highlightLast: boolean;
  empty?: string;
};

/** One quarter of the series the growth tiles use, oldest first. */
export type GrowthPoint = { label: string; yoy: number | null; qoq: number | null };
/** The reported quarters the margin and earnings tiles use. */
export type ChartQuarter = {
  fiscalPeriod?: string | null;
  fiscalYear?: string | number | null;
  revenue?: number | null;
  operatingIncome?: number | null;
  grossProfit?: number | null;
  epsActualReported?: number | null;
  epsEstimateReported?: number | null;
};

export type ChartInput = {
  ticker: string;
  facts: SiFacts;
  forwardPe: number | null | undefined;
  /** Revenue and EPS growth over the last four quarters, oldest first. */
  revenue: ReadonlyArray<GrowthPoint>;
  eps: ReadonlyArray<GrowthPoint>;
  /** The four latest reported quarters, newest first. */
  quarters: ReadonlyArray<ChartQuarter>;
};

const signed1 = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const pctShort = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`;
/** "Q3 '27" -> "Q3 FY27". */
export const fiscalLabel = (label: string) => label.replace(/^(Q\d)\s*'(\d{2})$/, "$1 FY$2");
const quarterLabel = (q: ChartQuarter) => `${q.fiscalPeriod ?? ""} FY${String(q.fiscalYear ?? "").slice(-2)}`;

const up = (_i: number, bright: boolean) => (bright ? "var(--ov-up)" : "var(--ov-up-dk)");
const eps = (_i: number, bright: boolean) => (bright ? "var(--ov-eps)" : "var(--ov-eps-dk)");

/** The chart for a Fundamentals tile (Growth, Margins, Earnings, Valuation); null for any other read. */
export function chartSpec(kind: string, input: ChartInput): ChartSpec | null {
  const f = input.facts;
  const peers = `Top ${f.peerTickers?.length || 5} peers avg`;
  const me = input.ticker;

  if (kind === "Growth") {
    const refs: ChartRef[] = [];
    if (f.revGrowth4q != null) refs.push({ value: f.revGrowth4q, label: `${me} 4-quarter avg ${signed1(f.revGrowth4q)}`, color: "var(--ov-ref-c)" });
    if (f.peerRevGrowth4q != null) refs.push({ value: f.peerRevGrowth4q, label: `${peers} ${signed1(f.peerRevGrowth4q)}`, color: "var(--ov-ref-a)" });
    return {
      groups: input.revenue.map((p) => fiscalLabel(p.label)),
      series: [{ name: "Revenue y/y", tag: "Revenue y/y", values: input.revenue.map((p) => p.yoy), color: up }],
      fmt: pctShort,
      refs,
      highlightLast: true,
    };
  }

  if (kind === "Margins") {
    const quarters = [...input.quarters].reverse();
    const margin = (q: ChartQuarter, key: "operatingIncome" | "grossProfit") => (q.revenue && q[key] != null ? ((q[key] as number) / q.revenue) * 100 : null);
    const series: ChartSeries[] = [{ name: "Operating margin", tag: "Op.", values: quarters.map((q) => margin(q, "operatingIncome")), color: up }];
    const refs: ChartRef[] = [];
    if (f.peerOpMargin4q != null) refs.push({ value: f.peerOpMargin4q, label: `${peers} operating ${f.peerOpMargin4q.toFixed(1)}%`, color: "var(--ov-ref-a)" });
    if (f.grossMargin != null) {
      series.push({ name: "Gross margin", tag: "Gross", values: quarters.map((q) => margin(q, "grossProfit")), color: eps });
      if (f.peerGrossMargin4q != null) refs.push({ value: f.peerGrossMargin4q, label: `${peers} gross ${f.peerGrossMargin4q.toFixed(1)}%`, color: "var(--ov-ref-b)" });
    }
    return { groups: quarters.map(quarterLabel), series, fmt: (v) => `${v.toFixed(1)}%`, refs, highlightLast: true };
  }

  if (kind === "Earnings") {
    if (input.eps.some((p) => p.yoy != null)) {
      const refs: ChartRef[] = [];
      if (f.epsGrowth4q != null) refs.push({ value: f.epsGrowth4q, label: `${me} 4-quarter avg ${signed1(f.epsGrowth4q)}`, color: "var(--ov-ref-c)" });
      if (f.peerEpsGrowth4q != null) refs.push({ value: f.peerEpsGrowth4q, label: `${peers} ${signed1(f.peerEpsGrowth4q)}`, color: "var(--ov-ref-a)" });
      return {
        groups: input.eps.map((p) => fiscalLabel(p.label)),
        series: [{ name: "EPS y/y", tag: "EPS y/y", values: input.eps.map((p) => p.yoy), color: eps }],
        fmt: pctShort,
        refs,
        highlightLast: true,
      };
    }
    const reported = [...input.quarters].reverse().filter((q) => q.epsActualReported != null && q.epsEstimateReported != null);
    if (reported.length >= 2) {
      const actual = reported.map((q) => q.epsActualReported as number);
      const estimate = reported.map((q) => q.epsEstimateReported as number);
      return {
        groups: reported.map(quarterLabel),
        series: [
          { name: "Estimate", tag: "Estimate", values: estimate, color: eps },
          { name: "Actual", tag: "Actual", values: actual, color: (i, bright) => (actual[i] >= estimate[i] ? (bright ? "var(--ov-up)" : "var(--ov-up-dk)") : bright ? "var(--ov-dn)" : "var(--ov-dn-dk)") },
        ],
        fmt: (v) => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`,
        highlightLast: true,
      };
    }
    return { groups: [], series: [], fmt: pctShort, highlightLast: true };
  }

  if (kind === "Valuation") {
    const rows: Array<{ group: string; me: number; peers: number | null }> = [];
    if (f.trailingPe != null && f.trailingPe > 0) rows.push({ group: "Trailing P/E", me: f.trailingPe, peers: (f.peerPeCount ?? 0) >= 3 ? (f.peerPe ?? null) : null });
    if (input.forwardPe != null && input.forwardPe > 0) rows.push({ group: "Forward P/E", me: input.forwardPe, peers: (f.peerFwdPeCount ?? 0) >= 3 ? (f.peerFwdPe ?? null) : null });
    const series: ChartSeries[] = [
      { name: me, tag: me, values: rows.map((r) => r.me), color: (i) => (rows[i].peers == null ? "var(--ov-eps)" : rows[i].me <= (rows[i].peers as number) ? "var(--ov-up)" : "var(--ov-dn)") },
    ];
    if (rows.some((r) => r.peers != null)) series.push({ name: peers, tag: "Peers avg", values: rows.map((r) => r.peers), color: () => "var(--ov-grey)" });
    return { groups: rows.map((r) => r.group), series, fmt: (v) => `${v.toFixed(1)}×`, highlightLast: false, empty: "No P/E available for this stock yet." };
  }

  return null;
}
