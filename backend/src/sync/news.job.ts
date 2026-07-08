import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { chunkedBatchSet } from '../common/firestore-batch.util';
import { SyncMetaService } from '../common/sync-meta.service';
import { TICKER_UNIVERSE } from '../common/ticker-universe';
import { FinnhubService } from '../vendors/finnhub/finnhub.service';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'news';
const BATCH_SIZE = 80;
const LOOKBACK_DAYS = 2;
const DELAY_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * INTERIM source: Finnhub /company-news gives per-symbol recent headlines,
 * not Benzinga's category-tagged real-time feed. Switch to Benzinga (Wave 3)
 * once that key is provided for richer tagging + faster delivery.
 */
@Injectable()
export class NewsJob implements OnModuleInit {
  private readonly logger = new Logger(NewsJob.name);

  constructor(
    private readonly finnhub: FinnhubService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // Every 30 min during market hours — news is time-sensitive even on a free plan.
  @Cron('*/30 9-16 * * 1-5', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const cursor = await this.meta.getCursor(JOB_NAME);
      const batch = Array.from(
        { length: BATCH_SIZE },
        (_, i) => TICKER_UNIVERSE[(cursor + i) % TICKER_UNIVERSE.length],
      );

      const to = new Date();
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS);

      const docs: Array<{ id: string; data: Record<string, unknown> }> = [];

      for (const symbol of batch) {
        try {
          const articles = await this.finnhub.getCompanyNews(
            symbol,
            isoDate(from),
            isoDate(to),
          );
          for (const a of articles.slice(0, 5)) {
            docs.push({
              id: `${symbol}_${a.id}`,
              data: {
                ticker: symbol,
                headline: a.headline,
                summary: a.summary,
                source: a.source,
                url: a.url,
                category: a.category,
                publishedAt: new Date(a.datetime * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
              },
            });
          }
        } catch (err) {
          this.logger.error(
            `Failed fetching news for ${symbol}: ${(err as Error).message}`,
          );
        }
        await sleep(DELAY_MS);
      }

      await chunkedBatchSet(this.firebase.firestore, 'news', docs);
      await this.meta.setCursor(
        JOB_NAME,
        (cursor + BATCH_SIZE) % TICKER_UNIVERSE.length,
      );
      await this.meta.record(JOB_NAME, { ok: true, count: docs.length });
      return { count: docs.length };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
