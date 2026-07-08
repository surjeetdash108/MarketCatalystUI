import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseAdminService } from '../common/firebase-admin.provider';
import { SyncMetaService } from '../common/sync-meta.service';
import { FinnhubService } from '../vendors/finnhub/finnhub.service';
import { SyncRegistry } from './sync-registry.service';

const JOB_NAME = 'market-indices';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Neither Polygon nor Finnhub's current keys allow real index/CFD quotes
 * (both confirmed 401/403 during setup), so indices are approximated with
 * liquid ETF proxies via Finnhub's working /quote endpoint. TLT and VIXY
 * are directional proxies only — TLT tracks 20+yr treasuries (not the 10Y
 * yield itself) and VIXY is a decaying futures ETN (not the spot VIX
 * index level). Both are clearly labeled `isProxy: true` so the frontend
 * can caveat them, and both get swapped for real index feeds the moment
 * a plan upgrade unlocks Polygon/Finnhub's indices products.
 */
const INDEX_PROXIES: Array<{
  symbol: string;
  label: string;
  proxyTicker: string;
  isProxy: boolean;
  note?: string;
}> = [
  {
    symbol: 'SPX',
    label: 'S&P 500',
    proxyTicker: 'SPY',
    isProxy: true,
    note: 'ETF proxy for the S&P 500 index',
  },
  {
    symbol: 'NDX',
    label: 'Nasdaq',
    proxyTicker: 'QQQ',
    isProxy: true,
    note: 'ETF proxy for the Nasdaq-100 index',
  },
  {
    symbol: 'DJI',
    label: 'Dow',
    proxyTicker: 'DIA',
    isProxy: true,
    note: 'ETF proxy for the Dow Jones index',
  },
  {
    symbol: 'RUT',
    label: 'Russell 2K',
    proxyTicker: 'IWM',
    isProxy: true,
    note: 'ETF proxy for the Russell 2000 index',
  },
  {
    symbol: 'GOLD',
    label: 'Gold',
    proxyTicker: 'GLD',
    isProxy: true,
    note: 'ETF proxy for spot gold',
  },
  {
    symbol: 'WTI',
    label: 'WTI Crude',
    proxyTicker: 'USO',
    isProxy: true,
    note: 'ETF proxy for WTI crude oil',
  },
  {
    symbol: 'DXY',
    label: 'Dollar (DXY)',
    proxyTicker: 'UUP',
    isProxy: true,
    note: 'ETF proxy for the US Dollar Index',
  },
  {
    symbol: 'US10Y',
    label: '10Y Yield',
    proxyTicker: 'TLT',
    isProxy: true,
    note: 'Long-treasury ETF, inverse-correlated with the 10Y yield — NOT the yield itself',
  },
  {
    symbol: 'VIX',
    label: 'VIX',
    proxyTicker: 'VIXY',
    isProxy: true,
    note: 'Decaying VIX futures ETN — directional proxy only, not the spot VIX level',
  },
];

@Injectable()
export class MarketIndicesJob implements OnModuleInit {
  private readonly logger = new Logger(MarketIndicesJob.name);

  constructor(
    private readonly finnhub: FinnhubService,
    private readonly firebase: FirebaseAdminService,
    private readonly meta: SyncMetaService,
    private readonly registry: SyncRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(JOB_NAME, () => this.run());
  }

  // 18:05 ET daily, after close.
  @Cron('5 18 * * 1-5', { timeZone: 'America/New_York' })
  async scheduled() {
    await this.registry.get(JOB_NAME)!();
  }

  async run() {
    try {
      const batch = this.firebase.firestore.batch();
      const col = this.firebase.firestore.collection('market_indices');
      // Additive, append-only sibling: `market_indices` only ever holds the
      // LATEST snapshot per symbol (doc id is the symbol, overwritten every
      // run). This collection keeps one doc per (date, symbol) so a closed
      // trading day's index level is never lost — same dedup-by-doc-id
      // reasoning as market_movers_history/sectors_history.
      const historyCol = this.firebase.firestore.collection(
        'market_indices_history',
      );
      const today = isoDate(new Date());
      let written = 0;

      for (const idx of INDEX_PROXIES) {
        try {
          const quote = await this.finnhub.getQuote(idx.proxyTicker);
          const doc = {
            label: idx.label,
            proxyTicker: idx.proxyTicker,
            isProxy: idx.isProxy,
            note: idx.note ?? null,
            value: quote.c,
            change: quote.d,
            pctChange: quote.dp,
            open: quote.o,
            prevClose: quote.pc,
            updatedAt: new Date().toISOString(),
          };
          batch.set(col.doc(idx.symbol), doc, { merge: true });
          batch.set(historyCol.doc(`${today}_${idx.symbol}`), {
            ...doc,
            asOfDate: today,
          });
          written++;
        } catch (err) {
          this.logger.error(
            `Failed fetching proxy quote for ${idx.symbol} (${idx.proxyTicker}): ${(err as Error).message}`,
          );
        }
      }
      await batch.commit();

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
