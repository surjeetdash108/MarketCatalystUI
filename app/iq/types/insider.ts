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
