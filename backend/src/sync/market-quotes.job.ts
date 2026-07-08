import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { chunkedBatchSet } from '../common/firestore-batch.util';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { diffGroupedDaily } from '../vendors/polygon/polygon-diff.util';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'market-quotes';

/**
 * Real price/%change/volume for literally every US ticker Polygon covers
 * (~10,000+), not just the curated 241-ticker TICKER_UNIVERSE `companies`
 * covers. This is essentially free: the same 2-call grouped-daily diff
 * market-movers.job.ts already does via PolygonMoversAdapter (see
 * polygon-diff.util.ts, shared by both) — the whole market comes back in
 * one response per day, market-movers just discards everything outside
 * the top/bottom 20. This job writes the rest.
 *
 * Merged onto `tickers/{ticker}` (written weekly by ticker-universe.job.ts
 * with name/exchange/type/cik) rather than a new collection — one doc per
 * ticker ends up with both "does it exist" reference data and its latest
 * price. A ticker this job sees before ticker-universe.job.ts has ever
 * discovered it still gets a doc, just missing name/exchange until the
 * next weekly sync fills those in.
 *
 * Fundamentals (P/E, sector, dividend yield, peers, beta) are NOT here —
 * those still require one FMP call per ticker (see companies.job.ts),
 * which doesn't scale to the full universe on the current plan without a
 * verified quota increase. This job is price-only, by design.
 */
@Injectable()
export class MarketQuotesJob implements OnModuleInit {
  private readonly logger = new Logger(MarketQuotesJob.name);

  constructor(
    private readonly polygon: PolygonService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // 18:07 ET daily — after market-movers/sectors (18:00), before market-indices (18:05)... actually after both, avoiding an exact-second collision.
  @Cron('7 18 * * 1-5', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const { date, quotes } = await diffGroupedDaily(this.polygon);

      const docs = quotes.map((q) => ({
        id: q.ticker,
        data: {
          ticker: q.ticker,
          price: q.price,
          pctChange: q.pctChange,
          volume: q.volume,
          asOfDate: q.asOfDate,
          quoteSource: 'polygon',
          quoteUpdatedAt: new Date().toISOString(),
        },
      }));

      await chunkedBatchSet(this.firebase.firestore, 'tickers', docs);

      await this.meta.record(JOB_NAME, { ok: true, count: docs.length });
      return { count: docs.length, asOfDate: date };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
