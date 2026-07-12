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
   * Trailing-twelve-month diluted EPS from Polygon's fundamentals
   * (/vX/reference/financials, timeframe=ttm) — the input for a computed P/E
   * in PolygonCompanyProfileAdapter. Falls back to basic EPS when diluted is
   * absent; returns null when no TTM statement is available.
   */
  async getTtmEps(ticker: string): Promise<number | null> {
    const res = await fetchJson<{
      results?: Array<{
        financials?: {
          income_statement?: {
            diluted_earnings_per_share?: { value?: number };
            basic_earnings_per_share?: { value?: number };
          };
        };
      }>;
    }>(
      `${BASE_URL}/vX/reference/financials?ticker=${ticker}` +
        `&timeframe=ttm&limit=1&apiKey=${this.apiKey}`,
    );
    const inc = res.results?.[0]?.financials?.income_statement;
    const eps =
      inc?.diluted_earnings_per_share?.value ??
      inc?.basic_earnings_per_share?.value;
    return typeof eps === 'number' ? eps : null;
  }

  /**
   * Sector performance via the 11 SPDR sector ETFs as proxies — Polygon
   * replacement for FMP's sector-performance-snapshot (sectors.job.ts).
   * Returned in FMP's field shape ({date, sector, exchange, averageChange})
   * with FMP's exact sector NAMES so the frontend's sector merge is unchanged.
   * `averageChange` is the ETF's day-over-day % (a proxy for the sector's
   * average move, not a cap-weighted average of its constituents). One
   * getDailyQuote call per ETF — fine on a paid plan; pace on free.
   */
  async getSectorPerformance(): Promise<
    Array<{
      date: string;
      sector: string;
      exchange: string;
      averageChange: number;
    }>
  > {
    const SECTOR_ETFS: Record<string, string> = {
      Technology: 'XLK',
      'Financial Services': 'XLF',
      Energy: 'XLE',
      Healthcare: 'XLV',
      Industrials: 'XLI',
      'Consumer Defensive': 'XLP',
      'Consumer Cyclical': 'XLY',
      Utilities: 'XLU',
      'Basic Materials': 'XLB',
      'Real Estate': 'XLRE',
      'Communication Services': 'XLC',
    };
    const out: Array<{
      date: string;
      sector: string;
      exchange: string;
      averageChange: number;
    }> = [];
    for (const [sector, etf] of Object.entries(SECTOR_ETFS)) {
      const q = await this.getDailyQuote(etf);
      if (!q) continue;
      out.push({
        date: new Date(q.t).toISOString().slice(0, 10),
        sector,
        exchange: 'ETF-proxy',
        averageChange: q.dp,
      });
    }
    return out;
  }

  /**
   * A single ticker's latest daily bar + day-over-day change, in the same
   * field shape as Finnhub's /quote (c/d/dp/o/h/l/pc/t) so it can back
   * market-indices.job's ETF-proxy quotes. Derived from the last ~10 calendar
   * days of daily aggregates (adjusted), taking the two most recent bars.
   * Returns null when the ticker has no bars in that window. On the free tier
   * this is one call per ticker (5 req/min cap) — fine for the ~11 index
   * proxies on a paid plan; pace the caller if you hit 429s on free.
   */
  async getDailyQuote(ticker: string): Promise<{
    c: number;
    d: number;
    dp: number;
    o: number;
    h: number;
    l: number;
    pc: number;
    t: number;
  } | null> {
    const to = new Date();
    const from = new Date(to.getTime() - 10 * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const bars = await this.getAggsRange(ticker, iso(from), iso(to)); // ascending
    if (bars.length === 0) return null;
    const latest = bars[bars.length - 1];
    const prior = bars.length > 1 ? bars[bars.length - 2] : null;
    const pc = prior ? prior.c : latest.o;
    const d = latest.c - pc;
    return {
      c: latest.c,
      d,
      dp: pc ? (d / pc) * 100 : 0,
      o: latest.o,
      h: latest.h,
      l: latest.l,
      pc,
      t: latest.t,
    };
  }

  /**
   * Cash dividends across the whole market, filtered by ex-dividend date
   * window — the Polygon replacement for FMP's dividends-calendar
   * (dividends.job.ts). Returned in FMP's field shape so the job's mapper is
   * unchanged. Caveat: Polygon carries no dividend YIELD (FMP did), so `yield`
   * is null here — compute downstream from amount/price if needed. Polygon's
   * integer `frequency` is mapped to FMP's string form. Paginated via next_url
   * and paced under the free-tier rate cap, same as getAllTickers.
   */
  async getDividendsCalendar(
    from: string,
    to: string,
  ): Promise<
    Array<{
      symbol: string;
      date: string;
      recordDate: string | null;
      paymentDate: string | null;
      declarationDate: string | null;
      dividend: number;
      yield: number | null;
      frequency: string | null;
    }>
  > {
    const FREQ: Record<number, string> = {
      0: 'One-Time',
      1: 'Annual',
      2: 'Semi-Annual',
      4: 'Quarterly',
      12: 'Monthly',
    };
    const out: Array<{
      symbol: string;
      date: string;
      recordDate: string | null;
      paymentDate: string | null;
      declarationDate: string | null;
      dividend: number;
      yield: number | null;
      frequency: string | null;
    }> = [];
    let url: string | null =
      `${BASE_URL}/v3/reference/dividends?ex_dividend_date.gte=${from}` +
      `&ex_dividend_date.lte=${to}&limit=1000&apiKey=${this.apiKey}`;

    while (url) {
      const res = await fetchJson<{
        results?: Array<{
          ticker: string;
          cash_amount: number;
          ex_dividend_date: string;
          record_date?: string;
          pay_date?: string;
          declaration_date?: string;
          frequency?: number;
        }>;
        next_url?: string;
      }>(url);
      for (const d of res.results ?? []) {
        out.push({
          symbol: d.ticker,
          date: d.ex_dividend_date,
          recordDate: d.record_date ?? null,
          paymentDate: d.pay_date ?? null,
          declarationDate: d.declaration_date ?? null,
          dividend: d.cash_amount,
          yield: null,
          frequency:
            d.frequency != null ? (FREQ[d.frequency] ?? null) : null,
        });
      }
      url = res.next_url ? `${res.next_url}&apiKey=${this.apiKey}` : null;
      if (url) await sleep(PAGE_DELAY_MS);
    }

    return out;
  }

  /**
   * IPOs listed within a date window — Polygon replacement for Finnhub's
   * /calendar/ipo (ipos.job.ts). Returned in Finnhub's field shape (date /
   * symbol / name / exchange / price string / share counts / status) so the
   * job's mapper is unchanged. Filters on listing_date, so it captures priced/
   * listed IPOs in the window; `price` is built as a "low-high" string from
   * Polygon's offer-price range for parsePriceRange() downstream.
   */
  async getIpoCalendar(
    from: string,
    to: string,
  ): Promise<
    Array<{
      date: string;
      symbol: string;
      name: string;
      exchange: string;
      price: string | null;
      numberOfShares: number | null;
      totalSharesValue: number | null;
      status: string;
    }>
  > {
    const out: Array<{
      date: string;
      symbol: string;
      name: string;
      exchange: string;
      price: string | null;
      numberOfShares: number | null;
      totalSharesValue: number | null;
      status: string;
    }> = [];
    let url: string | null =
      `${BASE_URL}/vX/reference/ipos?listing_date.gte=${from}` +
      `&listing_date.lte=${to}&limit=1000&apiKey=${this.apiKey}`;

    while (url) {
      const res = await fetchJson<{
        results?: Array<{
          ticker?: string;
          issuer_name?: string;
          primary_exchange?: string;
          listing_date?: string;
          announced_date?: string;
          final_issue_price?: number;
          lowest_offer_price?: number;
          highest_offer_price?: number;
          max_shares_offered?: number;
          shares_outstanding?: number;
          total_offer_size?: number;
          ipo_status?: string;
        }>;
        next_url?: string;
      }>(url);
      for (const r of res.results ?? []) {
        const lo = r.lowest_offer_price ?? r.final_issue_price ?? null;
        const hi = r.highest_offer_price ?? r.final_issue_price ?? null;
        const price =
          lo != null && hi != null
            ? lo === hi
              ? String(lo)
              : `${lo}-${hi}`
            : lo != null
              ? String(lo)
              : null;
        out.push({
          date: r.listing_date ?? r.announced_date ?? '',
          symbol: r.ticker ?? '',
          name: r.issuer_name ?? '',
          exchange: r.primary_exchange ?? '',
          price,
          numberOfShares: r.max_shares_offered ?? r.shares_outstanding ?? null,
          totalSharesValue: r.total_offer_size ?? null,
          status: r.ipo_status ?? '',
        });
      }
      url = res.next_url ? `${res.next_url}&apiKey=${this.apiKey}` : null;
      if (url) await sleep(PAGE_DELAY_MS);
    }

    return out;
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
