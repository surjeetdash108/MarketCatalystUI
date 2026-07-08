import { Injectable } from '@nestjs/common';
import { FmpService } from '../vendors/fmp/fmp.service';
import {
  AdapterResult,
  AdapterWarning,
  CanonicalMoverBase,
  MoversAdapter,
} from './types';

const MIN_PRICE = 3;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fallback source for `/market-movers`. FMP computes the gainers/losers
 * ranking vendor-side (biggest-gainers / biggest-losers), so this doesn't
 * need the two-day EOD-bar diff PolygonMoversAdapter does — it's usable
 * even if Polygon's grouped-daily feed is down.
 *
 * Trade-off, declared as a warning rather than faked: FMP's response has
 * no volume figure, so `volume` comes back 0 and the MIN_VOLUME filter
 * PolygonMoversAdapter applies cannot be replicated here.
 */
@Injectable()
export class FmpMoversAdapter implements MoversAdapter {
  readonly sourceName = 'fmp';

  constructor(private readonly fmp: FmpService) {}

  async fetchTopMovers(topN: number): Promise<
    AdapterResult<{
      date: string;
      gainers: CanonicalMoverBase[];
      losers: CanonicalMoverBase[];
    }>
  > {
    const [rawGainers, rawLosers] = await Promise.all([
      this.fmp.getBiggestGainers(),
      this.fmp.getBiggestLosers(),
    ]);
    const date = isoDate(new Date());

    const toMover = (row: {
      symbol: string;
      price: number;
      changesPercentage: number;
    }): CanonicalMoverBase | null => {
      if (row.price == null || row.price < MIN_PRICE) return null;
      return {
        ticker: row.symbol,
        price: row.price,
        pctChange: Math.round(row.changesPercentage * 100) / 100,
        volume: 0,
        asOfDate: date,
      };
    };

    const gainers = rawGainers
      .map(toMover)
      .filter((m): m is CanonicalMoverBase => m !== null)
      .slice(0, topN);
    const losers = rawLosers
      .map(toMover)
      .filter((m): m is CanonicalMoverBase => m !== null)
      .slice(0, topN);

    const warnings: AdapterWarning[] = [
      {
        code: 'FIELD_NOT_SUPPORTED',
        field: 'volume',
        message:
          "FMP's biggest-gainers/biggest-losers endpoints do not report volume — this source cannot populate it or apply a minimum-volume filter.",
      },
    ];

    return {
      data: { date, gainers, losers },
      source: this.sourceName,
      warnings,
    };
  }
}
