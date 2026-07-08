import { Injectable, Logger } from '@nestjs/common';
import { FmpService } from '../vendors/fmp/fmp.service';
import {
  AdapterResult,
  AdapterWarning,
  CanonicalCompany,
  CompanyProfileAdapter,
} from './types';

/**
 * Primary source today. Same Promise.allSettled behavior as the original
 * inline job code (a rejected ratios-ttm call, which FMP restricts to an
 * undocumented symbol whitelist on this plan, doesn't discard profile/peers
 * data that DID succeed) — but the rejection is now surfaced as an explicit
 * warning on the result instead of only a server log line, so a consumer
 * can tell "peRatio is null because this vendor plan doesn't cover this
 * symbol" apart from "peRatio is null because FMP genuinely has no P/E."
 */
@Injectable()
export class FmpCompanyProfileAdapter implements CompanyProfileAdapter {
  readonly sourceName = 'fmp';
  private readonly logger = new Logger(FmpCompanyProfileAdapter.name);

  constructor(private readonly fmp: FmpService) {}

  async fetchCompany(
    ticker: string,
  ): Promise<AdapterResult<CanonicalCompany> | null> {
    const [profileResult, ratiosResult, peersResult] = await Promise.allSettled(
      [
        this.fmp.getProfile(ticker),
        this.fmp.getRatiosTtm(ticker),
        this.fmp.getPeers(ticker),
      ],
    );

    if (profileResult.status === 'rejected') {
      const reason = profileResult.reason as Error;
      throw new Error(
        `FMP profile request failed for ${ticker}: ${reason.message ?? reason}`,
      );
    }
    const profile = profileResult.value;
    if (!profile) return null;

    const warnings: AdapterWarning[] = [];

    if (ratiosResult.status === 'rejected') {
      const reason =
        (ratiosResult.reason as Error)?.message ?? String(ratiosResult.reason);
      this.logger.warn(
        `ratios-ttm unavailable for ${ticker} (plan restriction): ${reason}`,
      );
      warnings.push({
        code: 'SUB_REQUEST_FAILED',
        field: 'peRatio,eps,dividendYield,dividendPerShare',
        message: `FMP ratios-ttm request failed for ${ticker} (${reason}) — likely this plan's undocumented per-symbol restriction, not a genuine absence of data.`,
      });
    }
    if (peersResult.status === 'rejected') {
      const reason =
        (peersResult.reason as Error)?.message ?? String(peersResult.reason);
      this.logger.warn(`stock-peers unavailable for ${ticker}: ${reason}`);
      warnings.push({
        code: 'SUB_REQUEST_FAILED',
        field: 'peers',
        message: `FMP stock-peers request failed for ${ticker} (${reason}).`,
      });
    }
    const ratios =
      ratiosResult.status === 'fulfilled' ? ratiosResult.value : null;
    const peers = peersResult.status === 'fulfilled' ? peersResult.value : [];

    const data: CanonicalCompany = {
      ticker,
      name: (profile.companyName as string) ?? null,
      price: (profile.price as number) ?? null,
      pctChange: (profile.changePercentage as number) ?? null,
      marketCap: (profile.marketCap as number) ?? null,
      beta: (profile.beta as number) ?? null,
      sector: (profile.sector as string) ?? null,
      industry: (profile.industry as string) ?? null,
      exchange: (profile.exchange as string) ?? null,
      week52Range: (profile.range as string) ?? null,
      volume: (profile.volume as number) ?? null,
      averageVolume: (profile.averageVolume as number) ?? null,
      description: (profile.description as string) ?? null,
      peRatio: (ratios?.priceToEarningsRatioTTM as number) ?? null,
      eps: (ratios?.netIncomePerShareTTM as number) ?? null,
      dividendYield: (ratios?.dividendYieldTTM as number) ?? null,
      dividendPerShare: (ratios?.dividendPerShareTTM as number) ?? null,
      peers: peers.map((p) => p.symbol),
    };

    return { data, source: this.sourceName, warnings };
  }
}
