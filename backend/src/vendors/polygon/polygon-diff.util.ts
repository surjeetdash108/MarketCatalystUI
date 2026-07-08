import { candidateTradingDays } from '../../common/trading-days.util';
import { CanonicalMoverBase } from '../../adapters/types';
import { PolygonService } from './polygon.service';

const MIN_PRICE = 3;
const MIN_VOLUME = 500_000;

/**
 * Diffs the two most recent trading days' grouped-daily bars into a
 * per-ticker quote list (price, %change, volume) — the whole market in
 * exactly 2 Polygon calls, since grouped-daily returns every US ticker's
 * EOD bar for one day in a single response. Shared by
 * PolygonMoversAdapter (which filters this down to top gainers/losers)
 * and market-quotes.job.ts (which writes the unfiltered list for every
 * ticker) — extracted so both stay in sync with the same diff logic
 * instead of drifting apart.
 */
export async function diffGroupedDaily(
  polygon: PolygonService,
): Promise<{ date: string; quotes: CanonicalMoverBase[] }> {
  const today = await polygon.getLatestGroupedDaily(
    candidateTradingDays(new Date()),
  );
  if (!today) {
    throw new Error(
      'No grouped-daily data found in the last 7 candidate days — Polygon may be down or every candidate day was a holiday/weekend',
    );
  }

  const dayBefore = new Date(`${today.date}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const prior = await polygon.getLatestGroupedDaily(
    candidateTradingDays(dayBefore),
  );
  if (!prior) {
    throw new Error(
      `No prior trading day found before ${today.date} — cannot compute %change without a comparison day`,
    );
  }

  const priorByTicker = new Map(prior.bars.map((b) => [b.T, b]));

  const quotes = today.bars
    .map((bar): CanonicalMoverBase | null => {
      const prevBar = priorByTicker.get(bar.T);
      if (!prevBar || prevBar.c <= 0) return null;
      const pctChange = ((bar.c - prevBar.c) / prevBar.c) * 100;
      return {
        ticker: bar.T,
        price: bar.c,
        pctChange: Math.round(pctChange * 100) / 100,
        volume: bar.v,
        asOfDate: today.date,
      };
    })
    .filter((q): q is CanonicalMoverBase => q !== null);

  return { date: today.date, quotes };
}

/** Same MIN_PRICE/MIN_VOLUME mover-worthiness filter PolygonMoversAdapter applies before ranking gainers/losers. */
export function isMoverEligible(q: CanonicalMoverBase): boolean {
  return q.price >= MIN_PRICE && q.volume >= MIN_VOLUME;
}
