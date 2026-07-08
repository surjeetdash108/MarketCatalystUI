import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson } from '../../common/http.util';

const BASE_URL = 'https://finnhub.io/api/v1';

export interface FinnhubQuote {
  c: number; // current/last price
  d: number; // change
  dp: number; // change percent
  h: number;
  l: number;
  o: number;
  pc: number; // previous close
  t: number;
}

export interface FinnhubIpoEvent {
  date: string;
  symbol: string | null;
  name: string;
  exchange: string | null;
  price: string | null; // "8.00-10.00" (range), "10.00" (fixed), or null
  numberOfShares: number | null;
  totalSharesValue: number | null;
  status: 'expected' | 'priced' | 'filed' | 'withdrawn';
}

/**
 * Confirmed working on the current (free) key: /quote for regular
 * stock/ETF tickers, /company-news, /calendar/earnings, /stock/market-status,
 * /calendar/ipo (verified 2026-07-07 — a genuinely separate endpoint from
 * /calendar/economic below, not covered by the same plan restriction).
 * Confirmed BLOCKED: raw index quotes (^GSPC, ^VIX, etc. — "Market data
 * subscription required for CFD indices") and /calendar/economic
 * ("You don't have access to this resource"). Both need a paid plan.
 */
@Injectable()
export class FinnhubService {
  private readonly logger = new Logger(FinnhubService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FINNHUB_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn(
        'FINNHUB_API_KEY not set — Finnhub-backed jobs will fail.',
      );
    }
  }

  async getQuote(symbol: string): Promise<FinnhubQuote> {
    return fetchJson<FinnhubQuote>(
      `${BASE_URL}/quote?symbol=${symbol}&token=${this.apiKey}`,
    );
  }

  async getCompanyNews(symbol: string, from: string, to: string) {
    return fetchJson<
      Array<{
        id: number;
        headline: string;
        summary: string;
        source: string;
        url: string;
        datetime: number;
        category: string;
      }>
    >(
      `${BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${this.apiKey}`,
    );
  }

  /** Economic calendar is Restricted on the current plan — kept for when it's upgraded. */
  async getEconomicCalendar() {
    return fetchJson<{ economicCalendar: unknown[] }>(
      `${BASE_URL}/calendar/economic?token=${this.apiKey}`,
    );
  }

  async getIpoCalendar(from: string, to: string): Promise<FinnhubIpoEvent[]> {
    const res = await fetchJson<{ ipoCalendar: FinnhubIpoEvent[] }>(
      `${BASE_URL}/calendar/ipo?from=${from}&to=${to}&token=${this.apiKey}`,
    );
    return res.ipoCalendar ?? [];
  }
}
