import { Injectable } from '@nestjs/common';
import { candidateTradingDays } from '../common/trading-days.util';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { AdapterResult, CanonicalMoverBase, MoversAdapter } from './types';

const MIN_PRICE = 3;
const MIN_VOLUME = 500_000;

/**
 * Primary (only) source today — no fallback is configured for movers (see
 * adapters.module.ts), so a failure here propagates as a thrown Error
 * straight through to the job's catch block and sync_meta.lastError,
 * rather than being silently swallowed into an empty result. Moved
 * verbatim from market-movers.job.ts's inline grouped-daily diff: Polygon's
 * current plan has no real-time gainers/losers endpoint (confirmed
 * NOT_AUTHORIZED), so movers are computed by diffing EOD bars across the
 * two most recent trading days.
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
    const today = await this.polygon.getLatestGroupedDaily(
      candidateTradingDays(new Date()),
    );
    if (!today) {
      throw new Error(
        'No grouped-daily data found in the last 7 candidate days — Polygon may be down or every candidate day was a holiday/weekend',
      );
    }

    const dayBefore = new Date(`${today.date}T00:00:00Z`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const prior = await this.polygon.getLatestGroupedDaily(
      candidateTradingDays(dayBefore),
    );
    if (!prior) {
      throw new Error(
        `No prior trading day found before ${today.date} — cannot compute %change without a comparison day`,
      );
    }

    const priorByTicker = new Map(prior.bars.map((b) => [b.T, b]));

    const movers = today.bars
      .filter((bar) => bar.c >= MIN_PRICE && bar.v >= MIN_VOLUME)
      .map((bar): CanonicalMoverBase | null => {
        const prevBar = priorByTicker.get(bar.T);
        if (!prevBar || prevBar.c <= 0) return null;
        const pctChange = ((bar.c - prevBar.c) / prevBar.c) * 100;
        return {
          ticker: bar.T,
          price: bar.c,
          pctChange: Math.round(pctChange * 100) / 100,
          volume: bar.v,
          asOfDate: today.date,
        };
      })
      .filter((m): m is CanonicalMoverBase => m !== null);

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
              message: `No tickers passed the $${MIN_PRICE}/${MIN_VOLUME.toLocaleString()}-volume filter for ${today.date} — check whether the filter thresholds still match current market conditions.`,
            },
          ]
        : [];

    return {
      data: { date: today.date, gainers, losers },
      source: this.sourceName,
      warnings,
    };
  }
}
