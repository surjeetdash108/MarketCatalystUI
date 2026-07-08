import { Logger } from '@nestjs/common';
import {
  AllSourcesFailedError,
  isRetryableVendorError,
  SourceAttempt,
} from './adapter-error';
import {
  AdapterResult,
  AdapterWarning,
  CanonicalMoverBase,
  MoversAdapter,
} from './types';

/**
 * Tries `primary` first; on a thrown error, falls back to `secondary` if
 * configured. This is a whole-batch fallback (unlike the per-ticker
 * CompositeCompanyProfileAdapter) since a movers fetch is a single request
 * for the entire gainers/losers list, not one call per ticker.
 *
 * Never fails silently: a successful fallback carries a FALLBACK_USED
 * warning naming what failed and why; if every configured source fails,
 * throws AllSourcesFailedError with every attempt listed — the job's
 * outer catch (there is nothing to write without base movers data) treats
 * that as a full job failure, same as before this adapter existed.
 */
export class CompositeMoversAdapter implements MoversAdapter {
  private readonly logger = new Logger(CompositeMoversAdapter.name);
  readonly sourceName: string;

  constructor(
    private readonly primary: MoversAdapter,
    private readonly secondary: MoversAdapter | null,
  ) {
    this.sourceName = secondary
      ? `${primary.sourceName}(fallback:${secondary.sourceName})`
      : primary.sourceName;
  }

  async fetchTopMovers(topN: number): Promise<
    AdapterResult<{
      date: string;
      gainers: CanonicalMoverBase[];
      losers: CanonicalMoverBase[];
    }>
  > {
    const attempts: SourceAttempt[] = [];

    try {
      return await this.primary.fetchTopMovers(topN);
    } catch (err) {
      const message = (err as Error).message;
      const retryable = isRetryableVendorError(err);
      attempts.push({
        source: this.primary.sourceName,
        error: message,
        retryable,
      });
      this.logger.warn(
        `${this.primary.sourceName} movers fetch failed (${retryable ? 'retryable' : 'not retryable'}): ${message}` +
          (this.secondary
            ? ` — falling back to ${this.secondary.sourceName}`
            : ' — no fallback configured'),
      );
    }

    if (!this.secondary) {
      throw new AllSourcesFailedError('market movers', attempts);
    }

    try {
      const fallbackResult = await this.secondary.fetchTopMovers(topN);
      const fallbackWarning: AdapterWarning = {
        code: 'FALLBACK_USED',
        message: `Primary source ${this.primary.sourceName} failed (${attempts[0].error}) — served by fallback ${this.secondary.sourceName} instead.`,
      };
      return {
        ...fallbackResult,
        warnings: [fallbackWarning, ...fallbackResult.warnings],
      };
    } catch (err) {
      attempts.push({
        source: this.secondary.sourceName,
        error: (err as Error).message,
        retryable: isRetryableVendorError(err),
      });
      throw new AllSourcesFailedError('market movers', attempts);
    }
  }
}
