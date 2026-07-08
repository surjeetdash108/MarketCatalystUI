import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson } from '../../common/http.util';

const BASE_URL = 'https://financialmodelingprep.com/stable';

/**
 * All calls hit /stable/ — the legacy /api/v3/ path 403s on the current key
 * (deprecated per FMP's migration notice, confirmed during setup).
 * Endpoints confirmed working on the current plan: quote, profile,
 * key-metrics-ttm, ratios-ttm, stock-peers, sector-performance-snapshot,
 * grades-consensus, analyst-estimates, earnings-calendar,
 * dividends-calendar (verified 2026-07-07 with a real call).
 * Confirmed RESTRICTED (needs plan upgrade): economic-calendar,
 * ipos-calendar, institutional-ownership/*.
 * NOT YET VERIFIED against this plan: biggest-gainers, biggest-losers
 * (used by adapters/fmp-movers.adapter.ts as a fallback source — if this
 * plan restricts them the same way it restricts ratios-ttm for some
 * symbols, calls will throw and the composite adapter's fallback path
 * simply won't be usable until confirmed; that failure surfaces as a
 * normal UPSTREAM_VENDOR_ERROR, never silently).
 */
@Injectable()
export class FmpService {
  private readonly logger = new Logger(FmpService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FMP_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('FMP_API_KEY not set — FMP-backed jobs will fail.');
    }
  }

  private async get<T>(path: string): Promise<T> {
    const sep = path.includes('?') ? '&' : '?';
    return fetchJson<T>(`${BASE_URL}/${path}${sep}apikey=${this.apiKey}`);
  }

  async getProfile(symbol: string) {
    const res = await this.get<Array<Record<string, unknown>>>(
      `profile?symbol=${symbol}`,
    );
    return res[0] ?? null;
  }

  async getRatiosTtm(symbol: string) {
    const res = await this.get<Array<Record<string, unknown>>>(
      `ratios-ttm?symbol=${symbol}`,
    );
    return res[0] ?? null;
  }

  async getPeers(symbol: string) {
    return this.get<
      Array<{
        symbol: string;
        companyName: string;
        price: number;
        mktCap: number;
      }>
    >(`stock-peers?symbol=${symbol}`);
  }

  async getGradesConsensus(symbol: string) {
    const res = await this.get<Array<Record<string, unknown>>>(
      `grades-consensus?symbol=${symbol}`,
    );
    return res[0] ?? null;
  }

  async getSectorPerformanceSnapshot(date: string) {
    return this.get<
      Array<{
        date: string;
        sector: string;
        exchange: string;
        averageChange: number;
      }>
    >(`sector-performance-snapshot?date=${date}`);
  }

  /** See the NOT YET VERIFIED note above the class docblock. */
  async getBiggestGainers() {
    return this.get<
      Array<{
        symbol: string;
        name: string;
        change: number;
        price: number;
        changesPercentage: number;
      }>
    >('biggest-gainers');
  }

  /** See the NOT YET VERIFIED note above the class docblock. */
  async getBiggestLosers() {
    return this.get<
      Array<{
        symbol: string;
        name: string;
        change: number;
        price: number;
        changesPercentage: number;
      }>
    >('biggest-losers');
  }

  async getEarningsCalendar(from: string, to: string) {
    return this.get<
      Array<{
        symbol: string;
        date: string;
        epsActual: number | null;
        epsEstimated: number | null;
        revenueActual: number | null;
        revenueEstimated: number | null;
      }>
    >(`earnings-calendar?from=${from}&to=${to}`);
  }

  async getDividendsCalendar(from: string, to: string) {
    return this.get<
      Array<{
        symbol: string;
        date: string; // ex-dividend date
        recordDate: string | null;
        paymentDate: string | null;
        declarationDate: string | null;
        dividend: number;
        yield: number | null;
        frequency: string | null;
      }>
    >(`dividends-calendar?from=${from}&to=${to}`);
  }
}
