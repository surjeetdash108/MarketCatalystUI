import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AllSourcesFailedError } from '../adapters/adapter-error';
import { COMPANY_PROFILE_ADAPTER } from '../adapters/types';
import type { CompanyProfileAdapter } from '../adapters/types';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { TICKER_UNIVERSE } from '../common/ticker-universe';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'companies';
const BATCH_SIZE = 60; // keeps daily vendor call volume conservative
const DELAY_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Profile + fundamentals + peers for the curated ticker universe, written to
 * companies/{ticker}. Processes a rotating batch per run (not the whole
 * universe at once) so we don't blow through the vendor's daily quota — the
 * cursor persists in sync_meta so the full universe cycles over several runs.
 *
 * Vendor-agnostic by design: this job only calls the injected
 * CompanyProfileAdapter (see ../adapters/types.ts) and writes whatever
 * canonical shape comes back. Which vendor(s) actually back that adapter —
 * including its automatic fallback — is chosen once, in adapters.module.ts;
 * swapping sources never touches this file.
 *
 * Nothing here fails silently: a per-ticker AllSourcesFailedError is logged
 * with every attempted source and reason, tallied into `failed`, and the
 * failing tickers list is written into sync_meta so a stale/never-synced
 * document is distinguishable from "this ticker was never in a batch yet."
 */
@Injectable()
export class CompaniesJob implements OnModuleInit {
  private readonly logger = new Logger(CompaniesJob.name);

  constructor(
    @Inject(COMPANY_PROFILE_ADAPTER)
    private readonly companyProfile: CompanyProfileAdapter,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // 02:00 ET daily — fundamentals don't move intraday.
  @Cron('0 2 * * *', { timeZone: 'America/New_York' })
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
      const failed: Array<{ ticker: string; error: string }> = [];
      const col = this.firebase.firestore.collection('companies');

      for (const symbol of batch) {
        try {
          const result = await this.companyProfile.fetchCompany(symbol);
          if (!result) {
            const msg = `No profile found for ${symbol} on ${this.companyProfile.sourceName}`;
            this.logger.warn(msg);
            failed.push({ ticker: symbol, error: msg });
            continue;
          }

          const { data, source, warnings } = result;
          if (warnings.length > 0) {
            this.logger.log(
              `${symbol}: ${warnings.length} warning(s) from ${source} — ${warnings.map((w) => w.code).join(', ')}`,
            );
          }

          await col.doc(symbol).set(
            {
              ...data,
              source,
              warnings,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
          written++;
        } catch (err) {
          if (err instanceof AllSourcesFailedError) {
            this.logger.error(
              `${symbol}: every configured source failed — ${err.attempts.map((a) => `${a.source}: ${a.error}`).join(' | ')}`,
            );
            failed.push({ ticker: symbol, error: err.message });
          } else {
            this.logger.error(
              `Failed syncing ${symbol}: ${(err as Error).message}`,
            );
            failed.push({ ticker: symbol, error: (err as Error).message });
          }
        }
        await sleep(DELAY_MS);
      }

      await this.meta.setCursor(
        JOB_NAME,
        (cursor + BATCH_SIZE) % TICKER_UNIVERSE.length,
      );
      await this.meta.record(JOB_NAME, {
        ok: true,
        count: written,
        ...(failed.length > 0
          ? {
              error: `${failed.length}/${batch.length} tickers failed: ${failed.map((f) => f.ticker).join(', ')}`,
            }
          : {}),
      });
      return {
        written,
        failed,
        cursorAdvancedTo: (cursor + BATCH_SIZE) % TICKER_UNIVERSE.length,
      };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
