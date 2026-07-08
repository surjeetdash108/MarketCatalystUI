import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinnhubModule } from '../vendors/finnhub/finnhub.module';
import { FinnhubService } from '../vendors/finnhub/finnhub.service';
import { FmpModule } from '../vendors/fmp/fmp.module';
import { FmpService } from '../vendors/fmp/fmp.service';
import { PolygonModule } from '../vendors/polygon/polygon.module';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { CompositeCompanyProfileAdapter } from './composite-company-profile.adapter';
import { CompositeMoverEnrichmentAdapter } from './composite-mover-enrichment.adapter';
import { CompositeMoversAdapter } from './composite-movers.adapter';
import { CompositeNewsAdapter } from './composite-news.adapter';
import { FinnhubNewsAdapter } from './finnhub-news.adapter';
import { FmpCompanyProfileAdapter } from './fmp-company-profile.adapter';
import { FmpMoverEnrichmentAdapter } from './fmp-mover-enrichment.adapter';
import { FmpMoversAdapter } from './fmp-movers.adapter';
import { PolygonCompanyProfileAdapter } from './polygon-company-profile.adapter';
import { PolygonMoverEnrichmentAdapter } from './polygon-mover-enrichment.adapter';
import { PolygonMoversAdapter } from './polygon-movers.adapter';
import { PolygonNewsAdapter } from './polygon-news.adapter';
import {
  COMPANY_PROFILE_ADAPTER,
  MOVER_ENRICHMENT_ADAPTER,
  MOVERS_ADAPTER,
  NEWS_ADAPTER,
} from './types';

const FMP_POLYGON_SOURCES = ['fmp', 'polygon', 'none'] as const;
const NEWS_SOURCES = ['polygon', 'finnhub', 'none'] as const;

/** Generic over each factory's own valid-source set, rather than one shared union every factory would have to filter against. */
function parseSource<S extends string>(
  config: ConfigService,
  key: string,
  validSources: readonly S[],
  fallbackDefault: S,
): S {
  const raw = config.get<string>(key, fallbackDefault);
  if (!validSources.includes(raw as S)) {
    throw new Error(
      `Unknown ${key}="${raw}" — expected one of: ${validSources.join(', ')}`,
    );
  }
  return raw as S;
}

/**
 * The one place that decides which vendor backs each canonical data need,
 * and whether a fallback is configured. Swapping a source, or enabling/
 * disabling its fallback, is: (1) add the new adapter class implementing
 * the same interface from ./types if it doesn't exist yet, (2) add a
 * branch here, (3) flip the env var — no changes to sync jobs, Firestore
 * documents, the OpenAPI contract, or the frontend, all of which depend
 * only on the canonical shape + AdapterResult envelope.
 *
 * Fallback is NOT silent for any of the three data needs below: every
 * Composite*Adapter attaches a FALLBACK_USED warning to a result served by
 * its secondary source, and throws AllSourcesFailedError (never returns a
 * bare null/empty result) when every configured source fails.
 */
@Module({
  imports: [FmpModule, PolygonModule, FinnhubModule],
  providers: [
    FmpCompanyProfileAdapter,
    PolygonCompanyProfileAdapter,
    FmpMoversAdapter,
    PolygonMoversAdapter,
    FmpMoverEnrichmentAdapter,
    PolygonMoverEnrichmentAdapter,
    PolygonNewsAdapter,
    FinnhubNewsAdapter,
    {
      provide: COMPANY_PROFILE_ADAPTER,
      inject: [ConfigService, FmpService, PolygonService],
      useFactory: (
        config: ConfigService,
        fmp: FmpService,
        polygon: PolygonService,
      ) => {
        const primarySource = parseSource(
          config,
          'COMPANY_PROFILE_SOURCE',
          FMP_POLYGON_SOURCES,
          'fmp',
        );
        const fallbackSource = parseSource(
          config,
          'COMPANY_PROFILE_FALLBACK_SOURCE',
          FMP_POLYGON_SOURCES,
          'polygon',
        );

        const bySource = {
          fmp: () => new FmpCompanyProfileAdapter(fmp),
          polygon: () => new PolygonCompanyProfileAdapter(polygon),
          none: () => null,
        };
        if (primarySource === 'none') {
          throw new Error(
            'COMPANY_PROFILE_SOURCE cannot be "none" — a primary source is required',
          );
        }
        const primary = bySource[primarySource]();
        const fallback =
          fallbackSource === 'none' || fallbackSource === primarySource
            ? null
            : bySource[fallbackSource]();
        return new CompositeCompanyProfileAdapter(primary, fallback);
      },
    },
    {
      provide: MOVERS_ADAPTER,
      inject: [ConfigService, FmpService, PolygonService],
      useFactory: (
        config: ConfigService,
        fmp: FmpService,
        polygon: PolygonService,
      ) => {
        const primarySource = parseSource(
          config,
          'MOVERS_SOURCE',
          FMP_POLYGON_SOURCES,
          'polygon',
        );
        const fallbackSource = parseSource(
          config,
          'MOVERS_FALLBACK_SOURCE',
          FMP_POLYGON_SOURCES,
          'fmp',
        );

        const bySource = {
          fmp: () => new FmpMoversAdapter(fmp),
          polygon: () => new PolygonMoversAdapter(polygon),
          none: () => null,
        };
        if (primarySource === 'none') {
          throw new Error(
            'MOVERS_SOURCE cannot be "none" — a primary source is required',
          );
        }
        const primary = bySource[primarySource]();
        const fallback =
          fallbackSource === 'none' || fallbackSource === primarySource
            ? null
            : bySource[fallbackSource]();
        return new CompositeMoversAdapter(primary, fallback);
      },
    },
    {
      provide: MOVER_ENRICHMENT_ADAPTER,
      inject: [ConfigService, FmpService, PolygonService],
      useFactory: (
        config: ConfigService,
        fmp: FmpService,
        polygon: PolygonService,
      ) => {
        const primarySource = parseSource(
          config,
          'MOVER_ENRICHMENT_SOURCE',
          FMP_POLYGON_SOURCES,
          'fmp',
        );
        const fallbackSource = parseSource(
          config,
          'MOVER_ENRICHMENT_FALLBACK_SOURCE',
          FMP_POLYGON_SOURCES,
          'polygon',
        );

        const bySource = {
          fmp: () => new FmpMoverEnrichmentAdapter(fmp),
          polygon: () => new PolygonMoverEnrichmentAdapter(polygon),
          none: () => null,
        };
        if (primarySource === 'none') {
          throw new Error(
            'MOVER_ENRICHMENT_SOURCE cannot be "none" — a primary source is required',
          );
        }
        const primary = bySource[primarySource]();
        const fallback =
          fallbackSource === 'none' || fallbackSource === primarySource
            ? null
            : bySource[fallbackSource]();
        return new CompositeMoverEnrichmentAdapter(primary, fallback);
      },
    },
    {
      provide: NEWS_ADAPTER,
      inject: [ConfigService, PolygonService, FinnhubService],
      useFactory: (
        config: ConfigService,
        polygon: PolygonService,
        finnhub: FinnhubService,
      ) => {
        const primarySource = parseSource(
          config,
          'NEWS_SOURCE',
          NEWS_SOURCES,
          'polygon',
        );
        const fallbackSource = parseSource(
          config,
          'NEWS_FALLBACK_SOURCE',
          NEWS_SOURCES,
          'finnhub',
        );

        const bySource = {
          polygon: () => new PolygonNewsAdapter(polygon),
          finnhub: () => new FinnhubNewsAdapter(finnhub),
          none: () => null,
        };
        if (primarySource === 'none') {
          throw new Error(
            'NEWS_SOURCE cannot be "none" — a primary source is required',
          );
        }
        const primary = bySource[primarySource]();
        const fallback =
          fallbackSource === 'none' || fallbackSource === primarySource
            ? null
            : bySource[fallbackSource]();
        return new CompositeNewsAdapter(primary, fallback);
      },
    },
  ],
  exports: [
    COMPANY_PROFILE_ADAPTER,
    MOVERS_ADAPTER,
    MOVER_ENRICHMENT_ADAPTER,
    NEWS_ADAPTER,
  ],
})
export class AdaptersModule {}
