/** Mirrors backend's `market_movers` collection (src/market-data/market-movers.controller.ts) — GET /market-data/movers. */
export interface LiveMoverDoc {
  id: string;
  ticker: string;
  name: string | null;
  price: number;
  pctChange: number;
  volume: number;
  sector: string | null;
  cap: string | null;
  /** Raw USD market cap from the movers job's Polygon ticker-details enrichment.
   *  Present for micro-caps outside the tracked `companies` universe, where the
   *  companies-doc fallback has nothing. Optional: absent on docs written before
   *  the field was added, until the next market-movers run repopulates them. */
  marketCap?: number | null;
  direction: "gainer" | "loser";
  asOfDate: string;
}

export interface MoverCatalystDoc {
  ticker: string;
  direction?: string | null;
  pctChange?: number | null;
  catalyst: string;
  headline: string | null;
  summary: string | null;
  source: "benzinga_wiim" | "ai_synthesis" | "sec_filing" | "news_headline";
  vendor: "benzinga" | "polygon" | "fmp" | "sec" | "llm";
  newsUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

