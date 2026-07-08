import { Injectable } from '@nestjs/common';
import { FmpService } from '../vendors/fmp/fmp.service';
import {
  AdapterResult,
  capBucket,
  MoverEnrichment,
  MoverEnrichmentAdapter,
} from './types';

/**
 * Primary source today. A request failure is NOT swallowed here — it's
 * left to throw naturally so a configured composite adapter can catch it
 * and retry against a fallback (see composite-mover-enrichment.adapter.ts).
 * Only "no profile for this ticker" (a genuine absence of data, not a
 * failure) returns null.
 */
@Injectable()
export class FmpMoverEnrichmentAdapter implements MoverEnrichmentAdapter {
  readonly sourceName = 'fmp';

  constructor(private readonly fmp: FmpService) {}

  async enrichTicker(
    ticker: string,
  ): Promise<AdapterResult<MoverEnrichment> | null> {
    const profile = await this.fmp.getProfile(ticker);
    if (!profile) return null;

    const data: MoverEnrichment = {
      name: (profile.companyName as string) ?? null,
      sector: (profile.sector as string) ?? null,
      cap: capBucket((profile.marketCap as number) ?? null),
    };
    return { data, source: this.sourceName, warnings: [] };
  }
}
