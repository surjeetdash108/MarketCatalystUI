import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { TICKER_UNIVERSE } from '../common/ticker-universe';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'tech-rating';
const BARS_TO_READ = 130;
const MIN_BARS = 65; // need a full 63-day momentum window + a couple of days
const MOMENTUM_DAYS = 63; // ~1 quarter
const SMA_PERIOD = 50;

interface Components {
  ticker: string;
  momentum: number; // trailing 63-day return
  trend: number; // price / SMA50 - 1
  rsi: number; // RSI(14)
}

function sma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  const slice = values.slice(values.length - n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function rsi14(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** Maps each ticker's raw value to a 0-100 percentile across the set. */
function percentiles(
  rows: Components[],
  pick: (c: Components) => number,
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => pick(a) - pick(b));
  const n = sorted.length;
  const out = new Map<string, number>();
  sorted.forEach((r, i) => {
    out.set(r.ticker, n === 1 ? 100 : (i / (n - 1)) * 100);
  });
  return out;
}

/**
 * An IBD-"Composite/Technical Rating"-style 1-99 score, computed from real
 * ohlcv_bars — NOT the proprietary formula, an independent approximation:
 * a blend of trailing momentum (50%), price-vs-50-day-MA trend (30%), and
 * RSI (20%), each percentile-ranked across TICKER_UNIVERSE and re-scaled to
 * 1-99. Also derives each stock's rank WITHIN its sector (from the sector on
 * its `companies` doc). Pure internal computation — no vendor call, no key,
 * no quota — and bounded, latest-snapshot storage (upserts onto `companies`).
 *
 * Depends on stock-history.job.ts having accumulated real bars; tickers under
 * MIN_BARS are skipped, not scored with fabricated data. Feeds Screener's
 * "Tech Rating" column/filter and the sector-rank display.
 */
@Injectable()
export class TechRatingJob implements OnModuleInit {
  private readonly logger = new Logger(TechRatingJob.name);

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['companies'],
      cronExpression: '15 4 * * *',
      timeZone: 'America/New_York',
    });
  }

  // 04:15 ET — after stock-history (03:00) and the other score jobs.
  @Cron('15 4 * * *', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  private async componentsFor(ticker: string): Promise<Components | null> {
    const snap = await this.firebase.firestore
      .collection('ohlcv_bars')
      .where('ticker', '==', ticker)
      .orderBy('barDate', 'desc')
      .limit(BARS_TO_READ)
      .get();
    if (snap.size < MIN_BARS) return null;

    const closes = snap.docs.map((d) => d.data().close as number).reverse();
    const price = closes[closes.length - 1];
    const past = closes[closes.length - 1 - MOMENTUM_DAYS];
    const ma50 = sma(closes, SMA_PERIOD);
    const rsiVal = rsi14(closes);
    if (past == null || past <= 0 || ma50 == null || ma50 <= 0 || rsiVal == null) {
      return null;
    }
    return {
      ticker,
      momentum: (price - past) / past,
      trend: price / ma50 - 1,
      rsi: rsiVal,
    };
  }

  async run() {
    try {
      const rows: Components[] = [];
      let skipped = 0;
      for (const ticker of TICKER_UNIVERSE) {
        try {
          const c = await this.componentsFor(ticker);
          if (!c) {
            skipped++;
            continue;
          }
          rows.push(c);
        } catch (err) {
          this.logger.error(
            `Failed tech-rating components for ${ticker}: ${(err as Error).message}`,
          );
          skipped++;
        }
      }

      if (rows.length === 0) {
        this.logger.warn(
          `No tickers had enough ohlcv_bars for tech rating (${skipped}/${TICKER_UNIVERSE.length}) — has stock-history run?`,
        );
        await this.meta.record(JOB_NAME, { ok: true, count: 0 });
        return { rated: 0, skipped };
      }

      const momP = percentiles(rows, (c) => c.momentum);
      const trendP = percentiles(rows, (c) => c.trend);
      const rsiP = percentiles(rows, (c) => c.rsi);

      // Composite percentile → 1-99 rating.
      const rating = new Map<string, number>();
      for (const r of rows) {
        const composite =
          0.5 * (momP.get(r.ticker) ?? 0) +
          0.3 * (trendP.get(r.ticker) ?? 0) +
          0.2 * (rsiP.get(r.ticker) ?? 0);
        rating.set(r.ticker, Math.min(99, Math.max(1, Math.round(composite))));
      }

      // Rank within sector, using the sector on each ticker's companies doc.
      const sectorByTicker = new Map<string, string>();
      const companiesSnap = await this.firebase.firestore
        .collection('companies')
        .get();
      companiesSnap.docs.forEach((d) => {
        const s = d.data().sector as string | undefined;
        if (s) sectorByTicker.set(d.id, s);
      });
      const bySector = new Map<string, string[]>();
      for (const r of rows) {
        const sec = sectorByTicker.get(r.ticker);
        if (!sec) continue;
        (bySector.get(sec) ?? bySector.set(sec, []).get(sec)!).push(r.ticker);
      }
      const sectorRank = new Map<string, { rank: number; total: number }>();
      for (const [, tickers] of bySector) {
        const ordered = tickers.sort(
          (a, b) => (rating.get(b) ?? 0) - (rating.get(a) ?? 0),
        );
        ordered.forEach((t, i) =>
          sectorRank.set(t, { rank: i + 1, total: ordered.length }),
        );
      }

      const batch = this.firebase.firestore.batch();
      const col = this.firebase.firestore.collection('companies');
      for (const r of rows) {
        const sr = sectorRank.get(r.ticker);
        batch.set(
          col.doc(r.ticker),
          {
            techRating: rating.get(r.ticker),
            sectorRank: sr?.rank ?? null,
            sectorRankTotal: sr?.total ?? null,
            techRatingUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }
      await batch.commit();

      await this.meta.record(JOB_NAME, { ok: true, count: rows.length });
      return { rated: rows.length, skipped };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
