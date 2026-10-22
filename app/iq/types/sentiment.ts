/** Mirrors backend's `market_sentiment` collection (src/market-data/market-sentiment.controller.ts) — GET /market-data/market-sentiment. Currently only the `fear_greed` doc exists. */
export interface MarketSentimentDoc {
  id: string;
  value?: number;
  label?: string;
  /** Session (YYYY-MM-DD) whose close the value is computed from. */
  asOfDate?: string | null;
  /** 0–100 scores per part (each ranked against its own trailing year):
   *  momentum, strength, breadth, volatility, safeHaven, junkBond. */
  components?: Record<string, number>;
  /** Raw readings behind each score, for checking by hand. */
  inputs?: Record<string, number | null>;
  /** True while today's session is still running (value moves until the close). */
  intraday?: boolean;
  updatedAt?: string;
}

/** Mirrors `market_sentiment_history/{date}` — GET /market-data/market-sentiment-history. One composite Fear & Greed value per past trading day. */
export interface MarketSentimentHistoryDoc {
  id: string; // date, YYYY-MM-DD
  value?: number;
  label?: string;
  asOfDate?: string;
}
