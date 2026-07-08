import { Injectable, Logger } from '@nestjs/common';
import { PolygonService } from '../vendors/polygon/polygon.service';
import {
  AdapterResult,
  AdapterWarning,
  CanonicalCompany,
  CompanyProfileAdapter,
} from './types';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Alternate source for `/companies` — faster to activate than FMP for the
 * price-tier fields (no new vendor onboarding, the backend already holds a
 * working Polygon key) but structurally CANNOT populate peRatio, eps,
 * dividendYield, dividendPerShare, or peers: Polygon's reference/tickers
 * endpoint carries no fundamentals ratios. Those gaps are declared as
 * `FIELD_NOT_SUPPORTED` warnings (a permanent, structural limitation) so
 * they're never confused with `SUB_REQUEST_FAILED` (a transient failure
 * that a retry might fix).
 */
@Injectable()
export class PolygonCompanyProfileAdapter implements CompanyProfileAdapter {
  readonly sourceName = 'polygon';
  private readonly logger = new Logger(PolygonCompanyProfileAdapter.name);

  constructor(private readonly polygon: PolygonService) {}

  async fetchCompany(
    ticker: string,
  ): Promise<AdapterResult<CanonicalCompany> | null> {
    const details = await this.polygon.getTickerDetails(ticker);
    if (!details) return null;

    const warnings: AdapterWarning[] = [
      {
        code: 'FIELD_NOT_SUPPORTED',
        field: 'peRatio,eps,dividendYield,dividendPerShare,peers',
        message:
          'Polygon reference/tickers has no fundamentals ratios or peer list — these fields are structurally null on this source, not a transient failure.',
      },
    ];

    let price: number | null = null;
    let pctChange: number | null = null;
    try {
      const to = new Date();
      const from = new Date(to);
      from.setUTCDate(from.getUTCDate() - 7);
      const bars = await this.polygon.getAggsRange(
        ticker,
        isoDate(from),
        isoDate(to),
      );
      if (bars.length >= 2) {
        const last = bars[bars.length - 1];
        const prev = bars[bars.length - 2];
        price = last.c;
        pctChange =
          prev.c > 0
            ? Math.round(((last.c - prev.c) / prev.c) * 10000) / 100
            : null;
      } else if (bars.length === 1) {
        price = bars[0].c;
        warnings.push({
          code: 'SUB_REQUEST_FAILED',
          field: 'pctChange',
          message:
            'Only one trading day of bars returned in the lookback window — cannot compute pctChange.',
        });
      } else {
        warnings.push({
          code: 'SUB_REQUEST_FAILED',
          field: 'price,pctChange',
          message:
            'No recent bars returned for this ticker in the last 7 days.',
        });
      }
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.warn(`Failed fetching recent bars for ${ticker}: ${reason}`);
      warnings.push({
        code: 'SUB_REQUEST_FAILED',
        field: 'price,pctChange',
        message: `Recent-bars request failed: ${reason}`,
      });
    }

    const data: CanonicalCompany = {
      ticker,
      name: (details.name as string) ?? null,
      price,
      pctChange,
      marketCap: (details.market_cap as number) ?? null,
      beta: null,
      sector: (details.sic_description as string) ?? null,
      industry: (details.sic_description as string) ?? null,
      exchange: (details.primary_exchange as string) ?? null,
      week52Range: null,
      volume: null,
      averageVolume: null,
      description: (details.description as string) ?? null,
      peRatio: null,
      eps: null,
      dividendYield: null,
      dividendPerShare: null,
      peers: [],
    };

    return { data, source: this.sourceName, warnings };
  }
}
