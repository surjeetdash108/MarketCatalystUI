/** Mirrors backend's `users/{uid}/portfolios/default/holdings/{ticker}` doc (src/user-data/portfolio.controller.ts) — GET/POST/DELETE /api/portfolio. */
export interface HoldingDoc {
  id: string;
  ticker: string;
  /** 0 when the position is closed (every share sold). */
  shares: number;
  positionSize: "Small" | "Medium" | "Large";
  conviction: "High" | "Medium" | "Low";
  /** Average cost per share of the open position; null when closed or unpriced. */
  costBasis: number | null;
  /** Realized P/L from all sells of this holding. */
  realizedPL: number;
  /** Date of the first transaction, YYYY-MM-DD; null when never recorded. */
  purchaseDate: string | null;
}

/** One buy or sell — GET /api/portfolio/holdings/:ticker/transactions. */
export interface HoldingTransaction {
  id: string;
  type: "buy" | "sell";
  shares: number;
  /** Price per share; null only for a migrated buy without a recorded cost. */
  price: number | null;
  /** Trade date, YYYY-MM-DD. */
  date: string;
  createdAt: string;
  /** shares × price; null when the transaction has no price. */
  amount: number | null;
  /** Realized P/L of a sell; null for buys. */
  realizedPL: number | null;
  /** Shares held right after this transaction. */
  sharesAfter: number;
  /** Average cost per share right after this transaction; null when none held. */
  avgCostAfter: number | null;
}

export interface HoldingHistory {
  ticker: string;
  summary: {
    shares: number;
    avgCost: number | null;
    totalCost: number | null;
    realizedPL: number;
    /** Part of the open position has no price, so avgCost covers only part of it. */
    partialCost: boolean;
    firstDate: string | null;
    lastDate: string | null;
    lotCount: number;
    buyCount: number;
    sellCount: number;
  };
  /** Newest first. */
  transactions: HoldingTransaction[];
}
