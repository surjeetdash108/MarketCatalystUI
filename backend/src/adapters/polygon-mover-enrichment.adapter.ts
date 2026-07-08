import { Injectable } from '@nestjs/common';
import { PolygonService } from '../vendors/polygon/polygon.service';
import {
  AdapterResult,
  capBucket,
  MoverEnrichment,
  MoverEnrichmentAdapter,
} from './types';

/**
 * Fallback source for mover name/sector/cap enrichment — reuses the same
 * Polygon reference/tickers endpoint as PolygonCompanyProfileAdapter, so no
 * new vendor integration is needed. Structurally weaker than FMP for
 * `sector`: Polygon only has a free-text SIC description, not the same
 * clean sector taxonomy FMP uses — declared as a warning, not hidden.
 */
@Injectable()
export class PolygonMoverEnrichmentAdapter implements MoverEnrichmentAdapter {
  readonly sourceName = 'polygon';

  constructor(private readonly polygon: PolygonService) {}

  async enrichTicker(
    ticker: string,
  ): Promise<AdapterResult<MoverEnrichment> | null> {
    const details = await this.polygon.getTickerDetails(ticker);
    if (!details) return null;

    const data: MoverEnrichment = {
      name: (details.name as string) ?? null,
      sector: (details.sic_description as string) ?? null,
      cap: capBucket((details.market_cap as number) ?? null),
    };

    return {
      data,
      source: this.sourceName,
      warnings: [
        {
          code: 'FIELD_NOT_SUPPORTED',
          field: 'sector',
          message:
            "Polygon reports a free-text SIC description, not FMP's sector taxonomy — treat as approximate.",
        },
      ],
    };
  }
}
