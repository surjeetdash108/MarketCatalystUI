import { Injectable } from '@nestjs/common';
import {
  diffGroupedDaily,
  isMoverEligible,
} from '../vendors/polygon/polygon-diff.util';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { AdapterResult, CanonicalMoverBase, MoversAdapter } from './types';

/**
 * Primary (only) source today — no fallback is configured for movers (see
 * adapters.module.ts), so a failure here propagates as a thrown Error
 * straight through to the job's catch block and sync_meta.lastError,
 * rather than being silently swallowed into an empty result. Polygon's
 * current plan has no real-time gainers/losers endpoint (confirmed
 * NOT_AUTHORIZED), so movers are computed by diffing EOD bars across the
 * two most recent trading days — see polygon-diff.util.ts (shared with
 * market-quotes.job.ts, which writes the same diff unfiltered for every
 * ticker instead of just the top gainers/losers).
 */
@Injectable()
export class PolygonMoversAdapter implements MoversAdapter {
  readonly sourceName = 'polygon';

  constructor(private readonly polygon: PolygonService) {}

  async fetchTopMovers(topN: number): Promise<
    AdapterResult<{
      date: string;
      gainers: CanonicalMoverBase[];
      losers: CanonicalMoverBase[];
    }>
  > {
    const { date, quotes } = await diffGroupedDaily(this.polygon);
    const movers = quotes.filter(isMoverEligible);

    const gainers = [...movers]
      .sort((a, b) => b.pctChange - a.pctChange)
      .slice(0, topN);
    const losers = [...movers]
      .sort((a, b) => a.pctChange - b.pctChange)
      .slice(0, topN);

    const warnings =
      movers.length === 0
        ? [
            {
              code: 'SUB_REQUEST_FAILED' as const,
              message: `No tickers passed the mover-eligibility filter for ${date} — check whether the filter thresholds still match current market conditions.`,
            },
          ]
        : [];

    return {
      data: { date, gainers, losers },
      source: this.sourceName,
      warnings,
    };
  }
}
