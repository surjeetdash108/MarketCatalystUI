import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { TICKER_UNIVERSE } from '../common/ticker-universe';
import { FmpService } from '../vendors/fmp/fmp.service';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'analyst-actions';
const BATCH_SIZE = 60;
const DELAY_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * INTERIM source: FMP grades-consensus gives a current Buy/Hold/Sell
 * snapshot per ticker, not a real-time upgrade/downgrade event feed.
 * Switch to Benzinga's real-time analyst ratings stream (Wave 3) once that
 * key is provided — this keeps the Analyst Actions screen non-empty until then.
 */
@Injectable()
export class AnalystActionsJob implements OnModuleInit {
  private readonly logger = new Logger(AnalystActionsJob.name);

  constructor(
    private readonly fmp: FmpService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // 06:00 ET daily.
  @Cron('0 6 * * *', { timeZone: 'America/New_York' })
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

      let written = 0;
      const col = this.firebase.firestore.collection('analyst_actions');

      for (const symbol of batch) {
        try {
          const consensus = await this.fmp.getGradesConsensus(symbol);
          if (!consensus) continue;

          await col.doc(symbol).set(
            {
              ticker: symbol,
              source: 'fmp_consensus_interim',
              strongBuy: consensus.strongBuy,
              buy: consensus.buy,
              hold: consensus.hold,
              sell: consensus.sell,
              strongSell: consensus.strongSell,
              consensus: consensus.consensus,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
          written++;
        } catch (err) {
          this.logger.error(
            `Failed syncing analyst grades for ${symbol}: ${(err as Error).message}`,
          );
        }
        await sleep(DELAY_MS);
      }

      await this.meta.setCursor(
        JOB_NAME,
        (cursor + BATCH_SIZE) % TICKER_UNIVERSE.length,
      );
      await this.meta.record(JOB_NAME, { ok: true, count: written });
      return { written };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
