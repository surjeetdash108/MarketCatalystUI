/** Mirrors backend's `insider_transactions` collection (src/market-data/insider-transactions.controller.ts) — GET /market-data/insider-transactions. Source: SEC Form 4 filings (src/sync/sec-form4.job.ts). */
export interface InsiderTxDoc {
  /** `{accessionNumber}_{i}` — the SEC accession of the Form 4 plus the row's index within it. */
  id: string;
  ticker: string;
  issuerName: string | null;
  ownerName: string | null;
  isOfficer: boolean;
  officerTitle: string | null;
  transactionDate: string;
  transactionCode: string;
  acquiredOrDisposed: "A" | "D" | string;
  shares: number;
  pricePerShare: number | null;
  sharesOwnedAfter?: number | null;
  filingDate?: string | null;
  /** SEC filing link from the vendor (FMP rows); SEC-sourced rows derive it from the id. */
  url?: string | null;
  /** Who served the row: FMP (primary) or SEC EDGAR Form 4 (backup). */
  vendor?: "fmp" | "sec";
}

/** GET /live/ownership — FMP 13F rollup + top holders, Polygon short interest. */
export interface OwnershipDoc {
  ticker: string;
  institutional: {
    asOf: string;
    ownershipPct: number | null;
    holders: number | null;
    holdersChange: number | null;
    shares: number | null;
    /** % change in total 13F shares vs the prior quarter. */
    sharesChangePct?: number | null;
    /** Filer counts behind the change: opened, added to, trimmed, sold out. */
    newPositions?: number | null;
    increasedPositions?: number | null;
    reducedPositions?: number | null;
    closedPositions?: number | null;
  } | null;
  topHolders: Array<{
    name: string;
    cik: string | null;
    shares: number;
    sharesChange: number | null;
    ownershipPct: number | null;
    marketValue: number | null;
    isNew: boolean;
  }>;
  shortInterest: {
    settlementDate: string;
    shortInterest: number;
    avgDailyVolume: number | null;
    daysToCover: number | null;
  } | null;
  sources: { institutional: "fmp" | null; shortInterest: "polygon" | null };
}

/** SEC Form 4 transaction codes (Form 4 General Instructions, Table 8). */
export const TX_CODE_LABEL: Record<string, string> = {
  P: "Open-market purchase",
  S: "Open-market sale",
  A: "Grant / award",
  D: "Disposition to issuer",
  F: "Tax withholding",
  M: "Option / RSU exercise",
  C: "Derivative conversion",
  G: "Gift",
  J: "Other acquisition / disposition",
  X: "Option exercise (in the money)",
  W: "Will / inheritance",
};

/**
 * EDGAR filing index for the Form 4 behind a transaction, built from the doc id.
 *
 * The id carries the accession number but no CIK. EDGAR serves a filing under
 * the CIK in the accession's first 10 digits (the filer / filing agent) as well
 * as the issuer's, so that prefix is enough to address it.
 */
export function form4Url(id: string | null | undefined): string | null {
  const digits = (id ?? "").split("_")[0].replace(/\D/g, "");
  if (digits.length !== 18) return null;
  const acc = `${digits.slice(0, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
  return `https://www.sec.gov/Archives/edgar/data/${Number(digits.slice(0, 10))}/${digits}/${acc}-index.htm`;
}
