import { Logger } from '@nestjs/common';
import {
  AllSourcesFailedError,
  isRetryableVendorError,
  SourceAttempt,
} from './adapter-error';
import {
  AdapterResult,
  AdapterWarning,
  CanonicalNewsArticle,
  NewsAdapter,
} from './types';

/**
 * Same fallback pattern as the other Composite*Adapters. An empty result
 * (no articles found for this ticker/window) is NOT a failure — that's
 * legitimate for a quiet ticker — so only a thrown error triggers
 * fallback, unlike CompositeMoverEnrichmentAdapter where "no data" from
 * the primary also falls through.
 */
export class CompositeNewsAdapter implements NewsAdapter {
  private readonly logger = new Logger(CompositeNewsAdapter.name);
  readonly sourceName: string;

  constructor(
    private readonly primary: NewsAdapter,
    private readonly secondary: NewsAdapter | null,
  ) {
    this.sourceName = secondary
      ? `${primary.sourceName}(fallback:${secondary.sourceName})`
      : primary.sourceName;
  }

  async fetchNews(
    ticker: string,
    from: string,
    to: string,
  ): Promise<AdapterResult<CanonicalNewsArticle[]>> {
    const attempts: SourceAttempt[] = [];

    try {
      return await this.primary.fetchNews(ticker, from, to);
    } catch (err) {
      const message = (err as Error).message;
      const retryable = isRetryableVendorError(err);
      attempts.push({
        source: this.primary.sourceName,
        error: message,
        retryable,
      });
      this.logger.warn(
        `${this.primary.sourceName} news fetch failed for ${ticker} (${retryable ? 'retryable' : 'not retryable'}): ${message}` +
          (this.secondary
            ? ` — falling back to ${this.secondary.sourceName}`
            : ' — no fallback configured'),
      );
    }

    if (!this.secondary) {
      throw new AllSourcesFailedError(`news ${ticker}`, attempts);
    }

    try {
      const fallbackResult = await this.secondary.fetchNews(ticker, from, to);
      const fallbackWarning: AdapterWarning = {
        code: 'FALLBACK_USED',
        message: `Primary news source ${this.primary.sourceName} failed (${attempts[0].error}) — served by fallback ${this.secondary.sourceName} instead.`,
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
      throw new AllSourcesFailedError(`news ${ticker}`, attempts);
    }
  }
}
