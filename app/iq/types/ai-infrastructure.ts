/** Mirrors backend's AiInfrastructureController (src/market-data/ai-infrastructure.controller.ts) —
 *  GET /market-data/ai-infrastructure and GET /market-data/ai-infrastructure/:theme.
 *  Theme membership is computed per-request from the `companies` collection
 *  (industry + keyword match) — there is no dedicated Firestore collection or
 *  hardcoded ticker list behind this. */

/** One tile on the AI Infrastructure landing grid. */
export interface AiInfraTheme {
  key: string;
  title: string;
  /** Semantic icon token (e.g. "cpu", "wrench") — the backend has no opinion
   *  on the actual glyph, so the frontend maps it to its own icon set. */
  icon: string;
  blurb: string;
  companyCount: number;
  /** Up to 5 tickers, largest market cap first. */
  sampleTickers: string[];
}

export type AiInfraCapBucket = "Mega" | "Large" | "Mid" | "Small" | "Micro";

export interface AiInfraCompany {
  ticker: string;
  name: string | null;
  /** First sentence of the company's description — a one-line "what they do". */
  blurb: string | null;
  marketCap: number | null;
  capBucket: AiInfraCapBucket | null;
  price: number | null;
  pctChange: number | null;
}

/** GET /market-data/ai-infrastructure/:theme response. */
export interface AiInfraThemeDetail {
  key: string;
  title: string;
  icon: string;
  blurb: string;
  companies: AiInfraCompany[];
}
