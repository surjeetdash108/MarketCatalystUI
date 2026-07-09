import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AllSourcesFailedError } from '../adapters/adapter-error';
import { MOVER_ENRICHMENT_ADAPTER, MOVERS_ADAPTER } from '../adapters/types';
import type {
  AdapterWarning,
  MoverEnrichment,
  MoverEnrichmentAdapter,
  MoversAdapter,
} from '../adapters/types';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'market-movers';
const TOP_N = 20;
const DELAY_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Writes market_movers/{gainer_TICKER | loser_TICKER}. Vendor-agnostic by
 * design: this job only calls the injected MoversAdapter (raw EOD diff) and
 * MoverEnrichmentAdapter (name/sector/cap lookup) — see ../adapters/types.ts.
 * Which vendor(s) back each — including automatic fallback — is chosen
 * once, in adapters.module.ts, via the MOVERS_SOURCE/MOVERS_FALLBACK_SOURCE
 * and MOVER_ENRICHMENT_SOURCE/MOVER_ENRICHMENT_FALLBACK_SOURCE env vars;
 * swapping any of them never touches this file, the Firestore schema, or
 * the frontend.
 *
 * A MoversAdapter failure (both primary and fallback exhausted) propagates
 * straight to the outer catch and sync_meta.lastError — there's nothing to
 * write without base movers data, so the whole job legitimately fails. A
 * per-ticker enrichment failure (both primary and fallback exhausted for
 * just that ticker) is caught here specifically and downgraded to a
 * warning on that one document instead of failing the whole sync —
 * enrichment is a best-effort addition to an already-valid mover, not a
 * required field — but it is never silently dropped without a trace.
 */
@Injectable()
export class MarketMoversJob implements OnModuleInit {
  private readonly logger = new Logger(MarketMoversJob.name);

  constructor(
    @Inject(MOVERS_ADAPTER) private readonly movers: MoversAdapter,
    @Inject(MOVER_ENRICHMENT_ADAPTER)
    private readonly enrichment: MoverEnrichmentAdapter,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['market_movers', 'market_movers_history'],
      cronExpression: '0 18 * * 1-5',
      timeZone: 'America/New_York',
    });
  }

  // 18:00 ET, well after market close and the EOD aggregation window.
  @Cron('0 18 * * 1-5', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const moversResult = await this.movers.fetchTopMovers(TOP_N);
      const { date, gainers, losers } = moversResult.data;
      const topMovers = [...gainers, ...losers];

      if (moversResult.warnings.length > 0) {
        this.logger.warn(
          `market-movers: ${moversResult.warnings.map((w) => w.message).join(' | ')}`,
        );
      }

      const enrichmentByTicker = new Map<
        string,
        { value: MoverEnrichment | null; warnings: AdapterWarning[] }
      >();
      for (const m of topMovers) {
        try {
          const enriched = await this.enrichment.enrichTicker(m.ticker);
          if (enriched) {
            enrichmentByTicker.set(m.ticker, {
              value: enriched.data,
              warnings: enriched.warnings,
            });
          } else {
            enrichmentByTicker.set(m.ticker, {
              value: null,
              warnings: [
                {
                  code: 'SUB_REQUEST_FAILED',
                  field: 'name,sector,cap',
                  message: `${this.enrichment.sourceName} found no profile for ${m.ticker}.`,
                },
              ],
            });
          }
        } catch (err) {
          if (err instanceof AllSourcesFailedError) {
            this.logger.warn(
              `Enrichment failed for mover ${m.ticker}: every source failed — ${err.attempts.map((a) => `${a.source}: ${a.error}`).join(' | ')}`,
            );
            enrichmentByTicker.set(m.ticker, {
              value: null,
              warnings: [
                {
                  code: 'SUB_REQUEST_FAILED',
                  field: 'name,sector,cap',
                  message: err.message,
                },
              ],
            });
          } else {
            throw err; // unexpected shape — don't hide it, let the outer catch treat it as a hard failure
          }
        }
        await sleep(DELAY_MS);
      }

      const batch = this.firebase.firestore.batch();
      const col = this.firebase.firestore.collection('market_movers');
      // Additive, append-only sibling of `market_movers`: that collection
      // only ever holds the LATEST snapshot per ticker (doc id gainer_TICKER
      // is overwritten every run, so yesterday's mover data is gone the
      // moment today's sync completes). This collection keeps one doc per
      // (date, direction, ticker) — a closed trading day's mover data never
      // changes, so re-running the same day's sync just re-writes the same
      // doc id harmlessly; a new day never touches a prior day's doc. No
      // separate "has this been synced" check is needed because the doc id
      // itself is the natural key — Firestore's set() is already the
      // dedup/upsert. See Doc/openapi.yaml x-write-pattern on this path.
      const historyCol = this.firebase.firestore.collection(
        'market_movers_history',
      );
      let enrichmentFailures = 0;

      const writeMover = (
        m: (typeof gainers)[number],
        direction: 'gainer' | 'loser',
      ) => {
        const enriched = enrichmentByTicker.get(m.ticker);
        const warnings = [
          ...moversResult.warnings,
          ...(enriched?.warnings ?? []),
        ];
        if (enriched?.value == null) enrichmentFailures++;
        const doc = {
          ...m,
          ...enriched?.value,
          direction,
          source: this.movers.sourceName,
          warnings,
          updatedAt: new Date().toISOString(),
        };
        batch.set(col.doc(`${direction}_${m.ticker}`), doc);
        batch.set(historyCol.doc(`${date}_${direction}_${m.ticker}`), doc);
      };

      gainers.forEach((g) => writeMover(g, 'gainer'));
      losers.forEach((l) => writeMover(l, 'loser'));
      await batch.commit();

      await this.meta.record(JOB_NAME, {
        ok: true,
        count: gainers.length + losers.length,
        ...(enrichmentFailures > 0
          ? {
              error: `${enrichmentFailures}/${topMovers.length} movers missing name/sector/cap enrichment`,
            }
          : {}),
      });
      return {
        gainers: gainers.length,
        losers: losers.length,
        asOfDate: date,
        enrichmentFailures,
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
