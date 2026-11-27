/**
 * `GET /live/what-matters-now` — the hourly digest (model-written) plus `slides`,
 * the data-backed slides the backend builds read-only from its cached
 * collections (src/live/wmn-slides.util.ts). Keep the two in step.
 */

export interface WmnBreadth {
  date: string;
  advancers: number;
  decliners: number;
  unchanged: number;
}

/** A heavy S&P 500 name and its share of the index's market cap (from the backend). */
export interface WmnWeight {
  ticker: string;
  name: string;
  weightPct: number;
}

/** One bar of the "what moved the S&P 500" chart: a weight multiplied by a live move. Computed in the app. */
export interface WmnContributor {
  ticker: string;
  name: string;
  /** The stock's own move, %. */
  changePct: number;
  /** Share of the index's total market cap, %. */
  weightPct: number;
  /** What it added (+) or took (-) from the index's % move, in percentage points. */
  contributionPct: number;
}

export type WmnVersus = "above" | "below" | "in-line";

export interface WmnCatalyst {
  id: string;
  name: string;
  importance: "high" | "medium";
  unit: string | null;
  /** New York calendar day, YYYY-MM-DD. */
  date: string;
  /** UTC ISO release time, or null when the feed gave only a day. */
  time: string | null;
  kind: "speech" | "report" | "data" | null;
  status: "upcoming" | "released";
  previous: number | null;
  /** Consensus forecast. */
  estimate: number | null;
  actual: number | null;
  versus: WmnVersus | null;
}

export interface WmnEarningsItem {
  ticker: string;
  name: string;
  marketCap: number | null;
  session: "BMO" | "AMC" | "Intraday" | null;
  date: string;
  reported: boolean;
  eps: { actual: number | null; estimate: number | null; surprisePct: number | null };
  revenue: { actual: number | null; estimate: number | null; surprisePct: number | null };
  guidance: { direction: "raised" | "cut" | "mixed" | "reaffirmed" | null; range: string | null } | null;
  reactionPct: number | null;
}

export interface WmnEarnings {
  date: string;
  /** The biggest few reporters, by market cap. There is no size floor. */
  items: WmnEarningsItem[];
  /** How many companies report in all; `items` are the biggest of them. */
  total: number;
}

export interface WmnAnalystRow {
  ticker: string;
  name: string;
  firm: string | null;
  action: "upgrade" | "downgrade" | "initiate";
  previousGrade: string | null;
  newGrade: string | null;
  priceTarget: number | null;
  priceTargetChange: "raise" | "cut" | null;
}

export interface WmnAnalysts {
  since: string;
  upgrades: number;
  downgrades: number;
  initiations: number;
  ptRaises: number;
  ptCuts: number;
  rows: WmnAnalystRow[];
}

/**
 * One Stock in Focus entry: the desk's editorial note about a company, one per
 * New York day (`day` is also its id). The slide shows the newest; the archive
 * lists them all (GET /api/stock-in-focus).
 */
export interface WmnStockInFocus {
  /** New York calendar day, YYYY-MM-DD. */
  day: string;
  ticker: string;
  headline: string;
  /** The desk's note; may be empty. */
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface WmnSlidesData {
  breadth: WmnBreadth | null;
  /** Heaviest S&P 500 names; the app applies live quote moves to them. */
  weights: WmnWeight[] | null;
  catalysts: WmnCatalyst[];
  earnings: WmnEarnings | null;
  analysts: WmnAnalysts | null;
  /** The newest Stock in Focus, or null when none has been posted. Absent on an older backend. */
  stockInFocus?: WmnStockInFocus | null;
}

export interface WmnResponse {
  summary?: string;
  overallAssessment?: string;
  keyDevelopments?: string[];
  generatedAt?: string;
  sourceCounts?: { news: number; analyses: number; earnings?: number; pulse?: number; liveFeed?: number };
  empty?: boolean;
  /** Absent on an older backend, null when the slides could not be built. */
  slides?: WmnSlidesData | null;
}
