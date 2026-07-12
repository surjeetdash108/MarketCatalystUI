import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { TICKER_UNIVERSE } from '../common/ticker-universe';
import { SyncRegistry } from '../common/sync-registry.service';

const JOB_NAME = 'technical-indicators';
const BARS_TO_READ = 120; // enough warm-up for a 26-period EMA + 9-period signal
const MIN_BARS = 40; // below this MACD/RSI aren't meaningful
const RVOL_WINDOW = 20; // trading days for the average-volume baseline

/** Standard EMA series (seeded with the first value), same length as input. */
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

/** Wilder-smoothed RSI over the whole close series; null if too short. */
function rsi(closes: number[], period = 14): number | null {
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

/** MACD(12,26,9) — the latest line/signal/histogram values; null if too short. */
function macd(
  closes: number[],
): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const line = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = ema(line, 9);
  const i = closes.length - 1;
  return {
    macd: line[i],
    signal: signal[i],
    histogram: line[i] - signal[i],
  };
}

/** Relative volume = latest day's volume ÷ average of the prior RVOL_WINDOW days. */
function rvol(volumes: number[], window = RVOL_WINDOW): number | null {
  if (volumes.length < window + 1) return null;
  const latest = volumes[volumes.length - 1];
  const prior = volumes.slice(-window - 1, -1);
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
  return avg > 0 ? latest / avg : null;
}

/**
 * Computes RSI(14), MACD(12/26/9), and RVOL(20) for every TICKER_UNIVERSE
 * symbol directly from the real ohlcv_bars this repo already syncs, and
 * upserts them (merge) onto `companies/{ticker}` — bounded, latest-snapshot
 * storage, so it adds nothing to the unbounded ohlcv_bars growth.
 *
 * Pure internal computation — no vendor call, no API key, no quota (same as
 * rs-rating.job.ts). Reads the last BARS_TO_READ bars per ticker via one
 * where(ticker==)+orderBy(barDate) query (the same composite index the
 * frontend's useOhlcvBars hook needs). Writes nothing useful until
 * stock-history.job.ts has accumulated enough real bars first; tickers under
 * MIN_BARS are skipped rather than scored with fabricated data.
 *
 * Replaces the seeded RSI/MACD on Stock Detail, and feeds Screener's
 * technical filters (RSI, volume trend) + Market Movers' RVOL column.
 */
@Injectable()
export class TechnicalIndicatorsJob implements OnModuleInit {
  private readonly logger = new Logger(TechnicalIndicatorsJob.name);

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run(), {
      collections: ['companies'],
      cronExpression: '10 4 * * *',
      timeZone: 'America/New_York',
    });
  }

  // 04:10 ET daily — after stock-history (03:00) and alongside rs-rating (04:00).
  @Cron('10 4 * * *', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  private async computeFor(ticker: string): Promise<{
    rsi14: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    rvol: number | null;
  } | null> {
    const snap = await this.firebase.firestore
      .collection('ohlcv_bars')
      .where('ticker', '==', ticker)
      .orderBy('barDate', 'desc')
      .limit(BARS_TO_READ)
      .get();

    if (snap.size < MIN_BARS) return null;

    // newest-first → oldest-first for indicator math
    const bars = snap.docs.map((d) => d.data()).reverse();
    const closes = bars.map((b) => b.close as number);
    const volumes = bars.map((b) => b.volume as number);

    const rsiVal = rsi(closes);
    const macdVal = macd(closes);
    if (rsiVal == null || macdVal == null) return null;

    return {
      rsi14: Math.round(rsiVal * 100) / 100,
      macd: Math.round(macdVal.macd * 10000) / 10000,
      macdSignal: Math.round(macdVal.signal * 10000) / 10000,
      macdHistogram: Math.round(macdVal.histogram * 10000) / 10000,
      rvol: (() => {
        const v = rvol(volumes);
        return v == null ? null : Math.round(v * 100) / 100;
      })(),
    };
  }

  async run() {
    try {
      const results: Array<{
        ticker: string;
        data: Record<string, unknown>;
      }> = [];
      let skipped = 0;

      for (const ticker of TICKER_UNIVERSE) {
        try {
          const ind = await this.computeFor(ticker);
          if (!ind) {
            skipped++;
            continue;
          }
          results.push({
            ticker,
            data: { ...ind, technicalsUpdatedAt: new Date().toISOString() },
          });
        } catch (err) {
          this.logger.error(
            `Failed computing indicators for ${ticker}: ${(err as Error).message}`,
          );
          skipped++;
        }
      }

      if (results.length === 0) {
        this.logger.warn(
          `No tickers had enough ohlcv_bars to compute indicators (${skipped}/${TICKER_UNIVERSE.length} skipped) — has stock-history.job.ts run yet?`,
        );
        await this.meta.record(JOB_NAME, { ok: true, count: 0 });
        return { computed: 0, skipped };
      }

      const batch = this.firebase.firestore.batch();
      const col = this.firebase.firestore.collection('companies');
      for (const r of results) {
        batch.set(col.doc(r.ticker), r.data, { merge: true });
      }
      await batch.commit();

      await this.meta.record(JOB_NAME, { ok: true, count: results.length });
      return { computed: results.length, skipped };
    } catch (err) {
      await this.meta.record(JOB_NAME, {
        ok: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
