import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { chunkedBatchSet } from '../common/firestore-batch.util';
import { SyncMetaService } from '../common/sync-meta.service';
import { FmpService } from '../vendors/fmp/fmp.service';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'dividends';
const LOOKAHEAD_DAYS = 30;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Cash dividends over a forward window -> dividends/{ticker}, one doc per
 * ticker holding its next upcoming ex-dividend event (same forward-window-only
 * shape as earnings.job.ts; no ticker-universe filtering). Primary source is
 * now Polygon /v3/reference/dividends (migrated 2026-07-12); FMP's
 * dividends-calendar stays as a fallback. Trade-off: Polygon carries no
 * dividend yield, so `yieldPct` is null on Polygon-sourced docs (present only
 * when the FMP fallback is used). The `source` field records which vendor
 * served each run.
 */
@Injectable()
export class DividendsJob implements OnModuleInit {
  private readonly logger = new Logger(DividendsJob.name);

  constructor(
    private readonly polygon: PolygonService,
    private readonly fmp: FmpService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['dividends'],
      cronExpression: '20 6 * * *',
      timeZone: 'America/New_York',
    });
  }

  // 06:20 ET daily — alongside the other calendar-style jobs.
  @Cron('20 6 * * *', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const from = isoDate(new Date());
      const to = new Date();
      to.setUTCDate(to.getUTCDate() + LOOKAHEAD_DAYS);
      const toStr = isoDate(to);

      // Polygon primary; fall back to FMP if it errors (e.g. transient 5xx).
      let events: Awaited<ReturnType<FmpService['getDividendsCalendar']>>;
      let source = 'polygon';
      try {
        events = await this.polygon.getDividendsCalendar(from, toStr);
      } catch (err) {
        this.logger.warn(
          `Polygon dividends failed, falling back to FMP: ${(err as Error).message}`,
        );
        events = await this.fmp.getDividendsCalendar(from, toStr);
        source = 'fmp';
      }

      await chunkedBatchSet(
        this.firebase.firestore,
        'dividends',
        events.map((e) => ({
          id: e.symbol,
          data: {
            ticker: e.symbol,
            exDividendDate: e.date,
            recordDate: e.recordDate,
            paymentDate: e.paymentDate,
            declarationDate: e.declarationDate,
            dividendAmount: e.dividend,
            yieldPct: e.yield,
            frequency: e.frequency,
            source,
            updatedAt: new Date().toISOString(),
          },
        })),
      );

      await this.meta.record(JOB_NAME, { ok: true, count: events.length });
      return { count: events.length };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
