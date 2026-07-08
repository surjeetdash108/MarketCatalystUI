/**
 * Canonical shapes + adapter interfaces for data whose vendor might change.
 *
 * The contract (these types, and the OpenAPI schemas in Doc/openapi.yaml
 * they mirror field-for-field) is the thing that must never change when a
 * vendor is swapped. Sync jobs depend only on these interfaces via the DI
 * tokens below — never on a concrete vendor service directly — so swapping
 * a source is a one-line env var change (see adapters.module.ts), not a
 * job/schema/frontend edit.
 *
 * Nothing here fails silently: every adapter method returns an
 * `AdapterResult<T>` carrying which source actually served the data plus
 * any `warnings` (degraded-but-not-fatal conditions, e.g. "ratios
 * unavailable on this plan — peRatio is null"), instead of returning a
 * bare value where a null field is indistinguishable from "vendor legitimately
 * has no data" vs. "a sub-request failed." A hard failure (no data at all,
 * from any configured source) throws AllSourcesFailedError — see
 * adapter-error.ts — rather than returning null and letting the caller
 * silently skip it.
 */

// ---- Canonical domain shapes (mirror Doc/openapi.yaml components.schemas) ----

export interface CanonicalCompany {
  ticker: string;
  name: string | null;
  price: number | null;
  pctChange: number | null;
  marketCap: number | null;
  beta: number | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  week52Range: string | null;
  volume: number | null;
  averageVolume: number | null;
  description: string | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  dividendPerShare: number | null;
  peers: string[];
}

export interface CanonicalMoverBase {
  ticker: string;
  price: number;
  pctChange: number;
  volume: number;
  asOfDate: string;
}

export type CapBucket = 'Mega' | 'Large' | 'Mid' | 'Small' | 'Micro';

export interface MoverEnrichment {
  name: string | null;
  sector: string | null;
  cap: CapBucket | null;
}

export interface CanonicalNewsArticle {
  id: string;
  ticker: string;
  headline: string;
  summary: string | null;
  source: string;
  url: string;
  category: string | null;
  /** Per-ticker sentiment classification — structurally absent on some sources (e.g. Finnhub), not just unavailable this run. */
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentimentReasoning: string | null;
  keywords: string[];
  publishedAt: string;
}

// ---- Warnings + result envelope (mirror Doc/openapi.yaml AdapterWarning) ----

/**
 * A non-fatal, structured degradation note — never a silent null. `code` is
 * machine-matchable (for alerting/tests), `message` is human-readable,
 * `field` names which canonical field(s) are affected so a consumer can
 * decide whether to trust/hide them.
 */
export interface AdapterWarning {
  code:
    | 'SUB_REQUEST_FAILED' // one of several parallel vendor calls failed; others succeeded
    | 'FIELD_NOT_SUPPORTED' // this source structurally never has this field (not a transient failure)
    | 'FALLBACK_USED' // the primary source failed/returned nothing; this result came from the fallback
    | 'STALE_DATA'; // returned data is older than expected (e.g. last successful sync, not this run)
  message: string;
  field?: string; // comma-separated canonical field names, when applicable
}

export interface AdapterResult<T> {
  data: T;
  /** Which concrete adapter actually produced `data` (e.g. "fmp", "polygon") — NOT the composite's combined name. */
  source: string;
  warnings: AdapterWarning[];
}

// ---- Adapter interfaces ----

export interface CompanyProfileAdapter {
  readonly sourceName: string;
  /** Returns null only when this specific source has no record of the ticker at all (not an error). */
  fetchCompany(ticker: string): Promise<AdapterResult<CanonicalCompany> | null>;
}

export interface MoversAdapter {
  readonly sourceName: string;
  /** Returns the top `topN` gainers and top `topN` losers for the latest available trading day. */
  fetchTopMovers(topN: number): Promise<
    AdapterResult<{
      date: string;
      gainers: CanonicalMoverBase[];
      losers: CanonicalMoverBase[];
    }>
  >;
}

export interface MoverEnrichmentAdapter {
  readonly sourceName: string;
  enrichTicker(ticker: string): Promise<AdapterResult<MoverEnrichment> | null>;
}

export interface NewsAdapter {
  readonly sourceName: string;
  fetchNews(
    ticker: string,
    from: string,
    to: string,
  ): Promise<AdapterResult<CanonicalNewsArticle[]>>;
}

// ---- DI tokens (bind these to a concrete adapter in adapters.module.ts) ----

export const COMPANY_PROFILE_ADAPTER = Symbol('COMPANY_PROFILE_ADAPTER');
export const MOVERS_ADAPTER = Symbol('MOVERS_ADAPTER');
export const MOVER_ENRICHMENT_ADAPTER = Symbol('MOVER_ENRICHMENT_ADAPTER');
export const NEWS_ADAPTER = Symbol('NEWS_ADAPTER');

// ---- Shared helper (was duplicated inline in market-movers.job.ts) ----

export function capBucket(marketCap: number | null): CapBucket | null {
  if (marketCap == null) return null;
  if (marketCap >= 200e9) return 'Mega';
  if (marketCap >= 10e9) return 'Large';
  if (marketCap >= 2e9) return 'Mid';
  if (marketCap >= 300e6) return 'Small';
  return 'Micro';
}
