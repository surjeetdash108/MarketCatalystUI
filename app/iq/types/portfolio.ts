/** Mirrors backend's `users/{uid}/portfolios/default/holdings/{ticker}` doc (src/user-data/portfolio.controller.ts) — GET/POST/DELETE /api/portfolio. */
export interface HoldingDoc {
  id: string;
  ticker: string;
  shares: number;
  positionSize: "Small" | "Medium" | "Large";
  conviction: "High" | "Medium" | "Low";
  /** Average cost per share; null when the user hasn't entered one. */
  costBasis: number | null;
  /** Purchase (trade) date as YYYY-MM-DD; null when the user didn't enter one. */
  purchaseDate: string | null;
}

/** One purchase (buy lot) — GET /api/portfolio/holdings/:ticker/lots. */
export interface HoldingLot {
  id: string;
  shares: number;
  /** Price per share; null only for an opening lot migrated without a cost. */
  price: number | null;
  /** Trade date, YYYY-MM-DD. */
  date: string;
  createdAt: string;
  /** True for the lot synthesized from a holding saved before lots existed. */
  opening?: boolean;
  /** shares × price; null when the lot has no price. */
  amount: number | null;
  /** Total shares held right after this purchase. */
  sharesAfter: number;
  /** Average cost per share right after this purchase. */
  avgCostAfter: number | null;
}

export interface HoldingHistory {
  ticker: string;
  summary: {
    shares: number;
    avgCost: number | null;
    totalCost: number | null;
    /** Some lot has no price, so avgCost covers only part of the position. */
    partialCost: boolean;
    firstDate: string | null;
    lastDate: string | null;
    lotCount: number;
  };
  /** Newest first. */
  lots: HoldingLot[];
}
