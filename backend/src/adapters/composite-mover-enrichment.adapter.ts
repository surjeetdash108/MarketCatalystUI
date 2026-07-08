import { Logger } from '@nestjs/common';
import {
  AllSourcesFailedError,
  isRetryableVendorError,
  SourceAttempt,
} from './adapter-error';
import {
  AdapterResult,
  AdapterWarning,
  MoverEnrichment,
  MoverEnrichmentAdapter,
} from './types';

/**
 * Same fallback pattern as CompositeCompanyProfileAdapter, applied to the
 * per-ticker name/sector/cap enrichment step. Throws AllSourcesFailedError
 * (never returns a bare null on failure) if every configured source fails
 * for a ticker — market-movers.job.ts catches that specifically and
 * downgrades it to a per-ticker warning rather than failing the whole
 * sync, since enrichment is a best-effort addition to an already-valid
 * mover, not a required field.
 */
export class CompositeMoverEnrichmentAdapter implements MoverEnrichmentAdapter {
  private readonly logger = new Logger(CompositeMoverEnrichmentAdapter.name);
  readonly sourceName: string;

  constructor(
    private readonly primary: MoverEnrichmentAdapter,
    private readonly secondary: MoverEnrichmentAdapter | null,
  ) {
    this.sourceName = secondary
      ? `${primary.sourceName}(fallback:${secondary.sourceName})`
      : primary.sourceName;
  }

  async enrichTicker(
    ticker: string,
  ): Promise<AdapterResult<MoverEnrichment> | null> {
    const attempts: SourceAttempt[] = [];

    try {
      const result = await this.primary.enrichTicker(ticker);
      if (result) return result;
      attempts.push({
        source: this.primary.sourceName,
        error: 'no data returned (ticker not found on this source)',
        retryable: false,
      });
    } catch (err) {
      const message = (err as Error).message;
      const retryable = isRetryableVendorError(err);
      attempts.push({
        source: this.primary.sourceName,
        error: message,
        retryable,
      });
      this.logger.warn(
        `${this.primary.sourceName} enrichment failed for ${ticker} (${retryable ? 'retryable' : 'not retryable'}): ${message}` +
          (this.secondary
            ? ` — falling back to ${this.secondary.sourceName}`
            : ' — no fallback configured'),
      );
    }

    if (!this.secondary) {
      throw new AllSourcesFailedError(`mover enrichment ${ticker}`, attempts);
    }

    let fallbackResult: AdapterResult<MoverEnrichment> | null = null;
    try {
      fallbackResult = await this.secondary.enrichTicker(ticker);
      if (!fallbackResult) {
        attempts.push({
          source: this.secondary.sourceName,
          error: 'no data returned (ticker not found on this source)',
          retryable: false,
        });
      }
    } catch (err) {
      attempts.push({
        source: this.secondary.sourceName,
        error: (err as Error).message,
        retryable: isRetryableVendorError(err),
      });
    }

    if (!fallbackResult) {
      throw new AllSourcesFailedError(`mover enrichment ${ticker}`, attempts);
    }

    const fallbackWarning: AdapterWarning = {
      code: 'FALLBACK_USED',
      message: `Primary enrichment source ${this.primary.sourceName} failed (${attempts[0].error}) — served by fallback ${this.secondary.sourceName} instead.`,
    };
    return {
      ...fallbackResult,
      warnings: [fallbackWarning, ...fallbackResult.warnings],
    };
  }
}
