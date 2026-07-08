import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson } from '../../common/http.util';

interface PolygonAggBar {
  T: string; // ticker (only present on grouped-daily results)
  v: number; // volume
  o: number; // open
  c: number; // close
  h: number; // high
  l: number; // low
  t: number; // epoch ms
  n?: number; // trade count
}

interface PolygonAggsResponse {
  status: string;
  resultsCount: number;
  results?: PolygonAggBar[];
}

export interface PolygonTickerRef {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type?: string; // 'CS' (common stock), 'ETF', 'ADRC', 'WARRANT', ...
  active: boolean;
  currency_name?: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  last_updated_utc?: string;
}

interface PolygonTickersResponse {
  results?: PolygonTickerRef[];
  status: string;
  count?: number;
  next_url?: string;
}

export interface PolygonOptionContract {
  ticker: string; // e.g. 'O:AAPL260717C00225000'
  underlying_ticker: string;
  contract_type: 'call' | 'put';
  strike_price: number;
  expiration_date: string; // YYYY-MM-DD
  exercise_style?: string;
  shares_per_contract?: number;
}

interface PolygonOptionContractsResponse {
  results?: PolygonOptionContract[];
  status: string;
}

export interface PolygonNewsInsight {
  ticker: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_reasoning: string;
}

export interface PolygonNewsArticle {
  id: string;
  publisher: { name: string };
  title: string;
  author?: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  description?: string;
  keywords?: string[];
  insights?: PolygonNewsInsight[];
}

interface PolygonNewsResponse {
  results?: PolygonNewsArticle[];
  status: string;
}

const BASE_URL = 'https://api.polygon.io';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Free-tier Polygon is 5 req/min; paginating the full ticker list needs
// several dozen requests, so this paces well under that cap.
const PAGE_DELAY_MS = 12_500;

/**
 * Free-tier Polygon access: NO real-time snapshots, gainers/losers, indices,
 * or forex — verified 403 NOT_AUTHORIZED against all of those during setup.
 * What DOES work: EOD aggregates (prev close, historical range, grouped-all-
 * tickers-for-a-day) and reference/ticker metadata. Every method below only
 * calls endpoints confirmed working on this plan.
 *
 * Options are the same split, verified 2026-07-07: the options SNAPSHOT
 * (real-time bid/ask, IV, greeks, open interest) and options QUOTES (NBBO)
 * are both 403 NOT_AUTHORIZED — need a paid plan. Options CONTRACTS
 * reference (strike/expiration/type) and options EOD aggregates (delayed
 * daily open/high/low/close/volume per contract) both work, same as the
 * equity side. So getOptionContracts/getOptionLatestBar below can supply
 * real strikes/expirations and a real (delayed) last price/volume — never
 * a real bid/ask, IV, or open interest.
 *
 * News (`/v2/reference/news`) also confirmed working 2026-07-08, and
 * genuinely richer than Finnhub's `/company-news`: multi-ticker tagging,
 * `keywords`, and per-ticker `insights` (sentiment + a reasoning string) —
 * none of which Finnhub's endpoint has. No analyst-ratings or earnings-
 * guidance/reaction product exists on Polygon at all (checked, both 404) —
 * this is specifically a news upgrade, not a broader Benzinga replacement.
 */
@Injectable()
export class PolygonService {
  private readonly logger = new Logger(PolygonService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('POLYGON_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn(
        'POLYGON_API_KEY not set — Polygon-backed jobs will fail.',
      );
    }
  }

  /** All US stock tickers' EOD bars for one date. Empty results = holiday/weekend. */
  async getGroupedDaily(date: string): Promise<PolygonAggBar[]> {
    const res = await fetchJson<PolygonAggsResponse>(
      `${BASE_URL}/v2/aggs/grouped/locale/us/market/stocks/${date}?apiKey=${this.apiKey}`,
    );
    return res.results ?? [];
  }

  /** Walks backward (skipping weekends) until it finds a non-empty trading day. */
  async getLatestGroupedDaily(
    candidateDates: Iterable<string>,
  ): Promise<{ date: string; bars: PolygonAggBar[] } | null> {
    for (const date of candidateDates) {
      const bars = await this.getGroupedDaily(date);
      if (bars.length > 0) {
        return { date, bars };
      }
      this.logger.log(
        `No grouped-daily data for ${date} (holiday/weekend) — trying prior day`,
      );
    }
    return null;
  }

  async getAggsRange(
    ticker: string,
    from: string,
    to: string,
    timespan = 'day',
    multiplier = 1,
  ) {
    const res = await fetchJson<PolygonAggsResponse>(
      `${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&apiKey=${this.apiKey}`,
    );
    return res.results ?? [];
  }

  async getTickerDetails(ticker: string) {
    const res = await fetchJson<{ results: Record<string, unknown> }>(
      `${BASE_URL}/v3/reference/tickers/${ticker}?apiKey=${this.apiKey}`,
    );
    return res.results;
  }

  /**
   * Full US ticker universe (paginated, ~1000/page) — reference metadata
   * only (name/exchange/type/active/cik), not quotes or fundamentals. Used
   * to discover the complete tradeable universe, as opposed to the
   * hand-curated TICKER_UNIVERSE list companies.job.ts syncs fundamentals
   * for. `active=true` by default; pass false to also include delisted
   * tickers. Paced at PAGE_DELAY_MS between pages to stay under the
   * free-tier 5 req/min cap — a full pull is tens of thousands of tickers
   * across ~10-25 pages, so budget a few minutes for this to complete.
   */
  async getAllTickers(active = true): Promise<PolygonTickerRef[]> {
    const all: PolygonTickerRef[] = [];
    let url: string | null =
      `${BASE_URL}/v3/reference/tickers?market=stocks&active=${active}&limit=1000&apiKey=${this.apiKey}`;

    while (url) {
      const res: PolygonTickersResponse =
        await fetchJson<PolygonTickersResponse>(url);
      all.push(...(res.results ?? []));
      url = res.next_url ? `${res.next_url}&apiKey=${this.apiKey}` : null;
      if (url) await sleep(PAGE_DELAY_MS);
    }

    return all;
  }

  /**
   * Nearest-expiration contracts for an underlying — real strikes/expirations/
   * types, no pricing. Sorted by expiration ascending so a small `limit`
   * naturally clusters around the soonest expiration rather than a random
   * slice of the full chain.
   */
  async getOptionContracts(
    underlyingTicker: string,
    fromDate: string,
    limit = 20,
  ): Promise<PolygonOptionContract[]> {
    const res = await fetchJson<PolygonOptionContractsResponse>(
      `${BASE_URL}/v3/reference/options/contracts?underlying_ticker=${underlyingTicker}` +
        `&expiration_date.gte=${fromDate}&sort=expiration_date&order=asc&limit=${limit}&apiKey=${this.apiKey}`,
    );
    return res.results ?? [];
  }

  /** Most recent daily bar for one option contract ticker, or null if it hasn't traded in `fromDate..toDate`. */
  async getOptionLatestBar(
    optionTicker: string,
    fromDate: string,
    toDate: string,
  ): Promise<PolygonAggBar | null> {
    const res = await fetchJson<PolygonAggsResponse>(
      `${BASE_URL}/v2/aggs/ticker/${optionTicker}/range/1/day/${fromDate}/${toDate}?sort=desc&limit=1&apiKey=${this.apiKey}`,
    );
    return res.results?.[0] ?? null;
  }

  /** Recent news mentioning `ticker` (may be multi-ticker articles) within [from, to], newest first. */
  async getNews(
    ticker: string,
    from: string,
    to: string,
    limit = 10,
  ): Promise<PolygonNewsArticle[]> {
    const res = await fetchJson<PolygonNewsResponse>(
      `${BASE_URL}/v2/reference/news?ticker=${ticker}` +
        `&published_utc.gte=${from}&published_utc.lte=${to}` +
        `&order=desc&sort=published_utc&limit=${limit}&apiKey=${this.apiKey}`,
    );
    return res.results ?? [];
  }
}
