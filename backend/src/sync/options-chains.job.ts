import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { OPTIONS_UNIVERSE } from '../common/options-universe';
import { SyncMetaService } from '../common/sync-meta.service';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'options-chains';
const CONTRACTS_PER_TICKER = 20;
const AGG_LOOKBACK_DAYS = 10;
const REQUEST_DELAY_MS = 12_500; // same free-tier pacing as ticker-universe.job.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Polygon options contracts + EOD aggs -> options_chains/{underlyingTicker}.
 * Real strikes/expirations and a real (delayed) last price/volume per
 * contract, for a small curated OPTIONS_UNIVERSE only — options snapshot
 * (real-time bid/ask, IV, greeks, open interest) is confirmed 403
 * NOT_AUTHORIZED on the current Polygon plan, verified 2026-07-07 (see
 * PolygonService's docblock). Those fields are simply not written here;
 * they stay simulated in options.tsx's existing chain table, which this
 * job's data is additive to, not a replacement for.
 */
@Injectable()
export class OptionsChainsJob implements OnModuleInit {
  private readonly logger = new Logger(OptionsChainsJob.name);

  constructor(
    private readonly polygon: PolygonService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['options_chains'],
      cronExpression: '0 19 * * 1-5',
      timeZone: 'America/New_York',
    });
  }

  // 19:00 ET daily — after market-indices (18:05) and macro-events (18:10).
  @Cron('0 19 * * 1-5', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    const today = isoDate(new Date());
    const lookback = new Date();
    lookback.setUTCDate(lookback.getUTCDate() - AGG_LOOKBACK_DAYS);
    const from = isoDate(lookback);

    let tickersWritten = 0;

    for (const ticker of OPTIONS_UNIVERSE) {
      try {
        const contracts = await this.polygon.getOptionContracts(
          ticker,
          today,
          CONTRACTS_PER_TICKER,
        );
        await sleep(REQUEST_DELAY_MS);

        const enriched: Array<Record<string, unknown>> = [];
        for (const c of contracts) {
          try {
            const bar = await this.polygon.getOptionLatestBar(
              c.ticker,
              from,
              today,
            );
            enriched.push({
              contractTicker: c.ticker,
              contractType: c.contract_type,
              strike: c.strike_price,
              expirationDate: c.expiration_date,
              lastClose: bar?.c ?? null,
              lastVolume: bar?.v ?? null,
              lastBarDate: bar ? isoDate(new Date(bar.t)) : null,
            });
          } catch (err) {
            this.logger.warn(
              `Failed fetching bar for ${c.ticker}: ${(err as Error).message}`,
            );
          }
          await sleep(REQUEST_DELAY_MS);
        }

        await this.firebase.firestore
          .collection('options_chains')
          .doc(ticker)
          .set(
            {
              underlyingTicker: ticker,
              contracts: enriched,
              source: 'polygon',
              note: 'Strikes/expirations and last close/volume are real (delayed). Bid/ask, IV, greeks, and open interest are not available on the current Polygon plan.',
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        tickersWritten++;
      } catch (err) {
        this.logger.error(
          `Failed syncing options for ${ticker}: ${(err as Error).message}`,
        );
      }
    }

    await this.meta.record(JOB_NAME, { ok: true, count: tickersWritten });
    return { tickersWritten };
  }
}
