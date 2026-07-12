import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { candidateTradingDays } from '../common/trading-days.util';
import { FmpService } from '../vendors/fmp/fmp.service';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'sectors';
const MAX_LOOKBACK_DAYS = 5;

function slug(sector: string) {
  return sector
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** FMP sector-performance-snapshot -> sectors/{sectorId}. Feeds Sector Heatmap/Themes. */
@Injectable()
export class SectorsJob implements OnModuleInit {
  private readonly logger = new Logger(SectorsJob.name);

  constructor(
    private readonly polygon: PolygonService,
    private readonly fmp: FmpService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['sectors', 'sectors_history'],
      cronExpression: '0 18 * * 1-5',
      timeZone: 'America/New_York',
    });
  }

  // 18:00 ET daily, after market close settles.
  @Cron('0 18 * * 1-5', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      // Polygon (SPDR sector-ETF proxies) primary; FMP's snapshot as fallback.
      let rows: Awaited<
        ReturnType<FmpService['getSectorPerformanceSnapshot']>
      > = [];
      let source = 'polygon';
      try {
        rows = await this.polygon.getSectorPerformance();
        if (rows.length === 0) {
          throw new Error('Polygon returned no sector-ETF data');
        }
      } catch (err) {
        this.logger.warn(
          `Polygon sectors failed, falling back to FMP: ${(err as Error).message}`,
        );
        source = 'fmp';
        rows = [];
        for (const date of candidateTradingDays(new Date(), MAX_LOOKBACK_DAYS)) {
          rows = await this.fmp.getSectorPerformanceSnapshot(date);
          if (rows.length > 0) break;
          this.logger.log(
            `No sector performance data for ${date} — trying prior day`,
          );
        }
      }
      if (rows.length === 0) {
        throw new Error(
          `No sector performance data found (Polygon + FMP fallback both empty)`,
        );
      }

      const batch = this.firebase.firestore.batch();
      const col = this.firebase.firestore.collection('sectors');
      // Additive, append-only sibling: `sectors` only ever holds the LATEST
      // snapshot per sector (doc id is the slug, overwritten every run). This
      // collection keeps one doc per (date, sector) so a closed trading
      // day's sector performance is never lost — same dedup-by-doc-id
      // reasoning as market_movers_history.
      const historyCol = this.firebase.firestore.collection('sectors_history');

      for (const row of rows) {
        const doc = {
          sector: row.sector,
          exchange: row.exchange,
          // averageChange from FMP is already in percentage-point units (e.g. 1.75 == 1.75%)
          pctChange: Math.round(row.averageChange * 100) / 100,
          asOfDate: row.date,
          source,
          updatedAt: new Date().toISOString(),
        };
        batch.set(col.doc(slug(row.sector)), doc, { merge: true });
        batch.set(historyCol.doc(`${row.date}_${slug(row.sector)}`), doc);
      }
      await batch.commit();

      await this.meta.record(JOB_NAME, { ok: true, count: rows.length });
      return { count: rows.length };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
