import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FmpModule } from '../vendors/fmp/fmp.module';
import { FmpService } from '../vendors/fmp/fmp.service';
import { PolygonModule } from '../vendors/polygon/polygon.module';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { CompositeCompanyProfileAdapter } from './composite-company-profile.adapter';
import { CompositeMoverEnrichmentAdapter } from './composite-mover-enrichment.adapter';
import { CompositeMoversAdapter } from './composite-movers.adapter';
import { FmpCompanyProfileAdapter } from './fmp-company-profile.adapter';
import { FmpMoverEnrichmentAdapter } from './fmp-mover-enrichment.adapter';
import { FmpMoversAdapter } from './fmp-movers.adapter';
import { PolygonCompanyProfileAdapter } from './polygon-company-profile.adapter';
import { PolygonMoverEnrichmentAdapter } from './polygon-mover-enrichment.adapter';
import { PolygonMoversAdapter } from './polygon-movers.adapter';
import {
  COMPANY_PROFILE_ADAPTER,
  MOVER_ENRICHMENT_ADAPTER,
  MOVERS_ADAPTER,
} from './types';

const VALID_SOURCES = ['fmp', 'polygon', 'none'] as const;
type SourceName = (typeof VALID_SOURCES)[number];

function parseSource(
  config: ConfigService,
  key: string,
  fallbackDefault: SourceName,
): SourceName {
  const raw = config.get<string>(key, fallbackDefault);
  if (!VALID_SOURCES.includes(raw as SourceName)) {
    throw new Error(
      `Unknown ${key}="${raw}" — expected one of: ${VALID_SOURCES.join(', ')}`,
    );
  }
  return raw as SourceName;
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
  imports: [FmpModule, PolygonModule],
  providers: [
    FmpCompanyProfileAdapter,
    PolygonCompanyProfileAdapter,
    FmpMoversAdapter,
    PolygonMoversAdapter,
    FmpMoverEnrichmentAdapter,
    PolygonMoverEnrichmentAdapter,
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
          'fmp',
        );
        const fallbackSource = parseSource(
          config,
          'COMPANY_PROFILE_FALLBACK_SOURCE',
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
        const primarySource = parseSource(config, 'MOVERS_SOURCE', 'polygon');
        const fallbackSource = parseSource(
          config,
          'MOVERS_FALLBACK_SOURCE',
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
          'fmp',
        );
        const fallbackSource = parseSource(
          config,
          'MOVER_ENRICHMENT_FALLBACK_SOURCE',
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
  ],
  exports: [COMPANY_PROFILE_ADAPTER, MOVERS_ADAPTER, MOVER_ENRICHMENT_ADAPTER],
})
export class AdaptersModule {}
