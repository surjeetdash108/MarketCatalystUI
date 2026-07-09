import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { chunkedBatchSet } from '../common/firestore-batch.util';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'ticker-universe';

/**
 * Full US ticker discovery, written to `tickers/{ticker}` — reference
 * metadata only (name/exchange/type/active/cik), NOT fundamentals or
 * quotes. This is deliberately separate from companies.job.ts, which stays
 * limited to the hand-curated TICKER_UNIVERSE
 * (backend/src/common/ticker-universe.ts) to respect FMP's daily quota —
 * discovering "what tickers exist" and "syncing full fundamentals for a
 * ticker" are different costs and different cadences.
 *
 * Weekly, not daily: reference data (which tickers exist, exchange, type,
 * active/delisted) changes far less often than price/fundamentals, and a
 * full pull is tens of thousands of Firestore writes — not worth repeating
 * every day. MUTABLE/upsert-latest (see Doc/openapi.yaml x-write-pattern):
 * each run overwrites the same ticker docs, no history is kept here.
 */
@Injectable()
export class TickerUniverseJob implements OnModuleInit {
  private readonly logger = new Logger(TickerUniverseJob.name);

  constructor(
    private readonly polygon: PolygonService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['tickers'],
      cronExpression: '0 3 * * 0',
      timeZone: 'America/New_York',
    });
  }

  // Sunday 03:00 ET — low-traffic window, clear of the weekday EOD jobs.
  @Cron('0 3 * * 0', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const tickers = await this.polygon.getAllTickers(true);
      if (tickers.length === 0) {
        throw new Error(
          'Polygon reference/tickers returned zero results — check POLYGON_API_KEY / plan access to /v3/reference/tickers',
        );
      }

      const docs = tickers
        .filter((t) => t.ticker) // defensive: skip any malformed row missing the natural key
        .map((t) => ({
          id: t.ticker,
          data: {
            ticker: t.ticker,
            name: t.name ?? null,
            market: t.market ?? null,
            locale: t.locale ?? null,
            primaryExchange: t.primary_exchange ?? null,
            type: t.type ?? null,
            active: t.active,
            currencyName: t.currency_name ?? null,
            cik: t.cik ?? null,
            compositeFigi: t.composite_figi ?? null,
            shareClassFigi: t.share_class_figi ?? null,
            source: 'polygon',
            updatedAt: new Date().toISOString(),
          },
        }));

      await chunkedBatchSet(this.firebase.firestore, 'tickers', docs);

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
