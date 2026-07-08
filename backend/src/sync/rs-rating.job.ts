import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { TICKER_UNIVERSE } from '../common/ticker-universe';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'rs-rating';
const BARS_PER_TICKER = 260; // ~1 trading year
const QUARTER_DAYS = 63; // ~1 trading quarter
const MIN_BARS_REQUIRED = 65; // need at least one full quarter + 1 to compute any return
const QUARTER_WEIGHTS = [0.4, 0.2, 0.2, 0.2]; // most-recent-quarter-weighted, re-normalized over however many quarters are actually available

interface RawScore {
  ticker: string;
  score: number;
}

/**
 * IBD-style relative-strength score (NOT the literal proprietary IBD RS
 * Rating formula — this is an independent, from-scratch approximation:
 * a most-recent-quarter-weighted blend of trailing quarterly returns,
 * ranked as a 1-99 percentile within TICKER_UNIVERSE). Depends entirely
 * on stock-history.job.ts having accumulated real ohlcv_bars first —
 * tickers with fewer than MIN_BARS_REQUIRED real bars are skipped
 * (not scored with fabricated data), so this job legitimately writes
 * nothing useful until stock-history has run a few times.
 *
 * Pure internal computation — no vendor call, no API quota, no key
 * needed. Reads ohlcv_bars via one where(ticker==)+orderBy(barDate) query
 * per ticker; needs the same Firestore composite index the frontend's
 * useOhlcvBars() hook needs (see that file's comment) — if it's missing,
 * Firestore's own error includes a one-click console link to create it.
 */
@Injectable()
export class RsRatingJob implements OnModuleInit {
  private readonly logger = new Logger(RsRatingJob.name);

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // 04:00 ET daily — after stock-history's 03:00 ET batch has had time to finish.
  @Cron('0 4 * * *', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  private async computeScore(ticker: string): Promise<number | null> {
    const snap = await this.firebase.firestore
      .collection('ohlcv_bars')
      .where('ticker', '==', ticker)
      .orderBy('barDate', 'desc')
      .limit(BARS_PER_TICKER)
      .get();

    if (snap.size < MIN_BARS_REQUIRED) return null;

    // snap is newest-first; reverse to oldest-first so index 0 = oldest.
    const closes = snap.docs.map((d) => d.data().close as number).reverse();

    const quarterlyReturns: number[] = [];
    for (let q = 0; q < 4; q++) {
      const endIdx = closes.length - 1 - q * QUARTER_DAYS;
      const startIdx = endIdx - QUARTER_DAYS;
      if (startIdx < 0) break;
      const startPrice = closes[startIdx];
      const endPrice = closes[endIdx];
      if (startPrice <= 0) break;
      quarterlyReturns.push((endPrice - startPrice) / startPrice);
    }
    if (quarterlyReturns.length === 0) return null;

    const weights = QUARTER_WEIGHTS.slice(0, quarterlyReturns.length);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const score =
      quarterlyReturns.reduce((sum, r, i) => sum + r * weights[i], 0) /
      weightSum;

    return score;
  }

  async run() {
    try {
      const raw: RawScore[] = [];
      let skipped = 0;

      for (const ticker of TICKER_UNIVERSE) {
        try {
          const score = await this.computeScore(ticker);
          if (score == null) {
            skipped++;
            continue;
          }
          raw.push({ ticker, score });
        } catch (err) {
          this.logger.error(
            `Failed computing RS score for ${ticker}: ${(err as Error).message}`,
          );
          skipped++;
        }
      }

      if (raw.length === 0) {
        this.logger.warn(
          `No tickers had enough ohlcv_bars history to score (${skipped}/${TICKER_UNIVERSE.length} skipped) — has stock-history.job.ts run yet?`,
        );
        await this.meta.record(JOB_NAME, { ok: true, count: 0 });
        return { scored: 0, skipped };
      }

      raw.sort((a, b) => a.score - b.score);
      const n = raw.length;
      const batch = this.firebase.firestore.batch();
      const col = this.firebase.firestore.collection('companies');

      raw.forEach((r, i) => {
        // 1-99 percentile, worst=1, best=99, matching IBD's convention.
        const percentile = n === 1 ? 99 : Math.round(1 + (i / (n - 1)) * 98);
        batch.set(
          col.doc(r.ticker),
          {
            rsRating: percentile,
            rsRatingUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      });
      await batch.commit();

      await this.meta.record(JOB_NAME, { ok: true, count: raw.length });
      return { scored: raw.length, skipped };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
