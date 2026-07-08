import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { chunkedBatchSet } from '../common/firestore-batch.util';
import { SyncMetaService } from '../common/sync-meta.service';
import { FinnhubService } from '../vendors/finnhub/finnhub.service';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'ipos';
const LOOKBACK_DAYS = 45;
const LOOKAHEAD_DAYS = 90;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parsePriceRange(price: string | null): {
  low: number | null;
  high: number | null;
} {
  if (!price) return { low: null, high: null };
  const parts = price.split('-').map((p) => Number(p.trim()));
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return { low: parts[0], high: parts[1] };
  }
  const single = Number(price);
  return Number.isNaN(single)
    ? { low: null, high: null }
    : { low: single, high: single };
}

/**
 * Finnhub /calendar/ipo -> ipos/{ipoId}. Confirmed working on the free key
 * (a separate endpoint from Finnhub's blocked /calendar/economic) — no FMP
 * plan upgrade or scraper needed after all; see FinnhubService's docblock.
 *
 * Doc id is `{date}_{symbol|slugified-name}`, not a stable per-company key
 * across its whole filed->priced lifecycle — the same real IPO can appear
 * under more than one doc as its status/date changes (e.g. once as
 * "filed" pre-ticker, later as "priced" with a symbol). This mirrors
 * market_movers_history's date-keyed approach: each doc is an accurate
 * point-in-time snapshot, not a definitive single record per company.
 */
@Injectable()
export class IposJob implements OnModuleInit {
  private readonly logger = new Logger(IposJob.name);

  constructor(
    private readonly finnhub: FinnhubService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // 06:15 ET daily — alongside the other calendar-style jobs.
  @Cron('15 6 * * *', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS);
      const to = new Date();
      to.setUTCDate(to.getUTCDate() + LOOKAHEAD_DAYS);

      const events = await this.finnhub.getIpoCalendar(
        isoDate(from),
        isoDate(to),
      );

      const docs = events.map((e) => {
        const { low, high } = parsePriceRange(e.price);
        const id = `${e.date}_${e.symbol || slugify(e.name)}`;
        return {
          id,
          data: {
            date: e.date,
            symbol: e.symbol,
            name: e.name,
            exchange: e.exchange,
            priceLow: low,
            priceHigh: high,
            numberOfShares: e.numberOfShares,
            totalSharesValue: e.totalSharesValue,
            status: e.status,
            source: 'finnhub',
            updatedAt: new Date().toISOString(),
          },
        };
      });

      await chunkedBatchSet(this.firebase.firestore, 'ipos', docs);

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
