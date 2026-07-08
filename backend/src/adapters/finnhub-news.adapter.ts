import { Injectable } from '@nestjs/common';
import { FinnhubService } from '../vendors/finnhub/finnhub.service';
import { AdapterResult, CanonicalNewsArticle, NewsAdapter } from './types';

/**
 * Interim/fallback source (see adapters.module.ts NEWS_FALLBACK_SOURCE) —
 * was the primary until 2026-07-08, when Polygon's news endpoint was
 * confirmed to give the same core data plus sentiment/keywords Finnhub
 * structurally doesn't have. Kept as the fallback since it's a proven,
 * independently-working source (different vendor infra than Polygon).
 */
@Injectable()
export class FinnhubNewsAdapter implements NewsAdapter {
  readonly sourceName = 'finnhub';

  constructor(private readonly finnhub: FinnhubService) {}

  async fetchNews(
    ticker: string,
    from: string,
    to: string,
  ): Promise<AdapterResult<CanonicalNewsArticle[]>> {
    const articles = await this.finnhub.getCompanyNews(ticker, from, to);

    const data: CanonicalNewsArticle[] = articles.map((a) => ({
      id: String(a.id),
      ticker,
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      url: a.url,
      category: a.category,
      sentiment: null, // structurally absent on Finnhub — see AdapterWarning FIELD_NOT_SUPPORTED convention
      sentimentReasoning: null,
      keywords: [],
      publishedAt: new Date(a.datetime * 1000).toISOString(),
    }));

    const warnings =
      data.length > 0
        ? [
            {
              code: 'FIELD_NOT_SUPPORTED' as const,
              field: 'sentiment,sentimentReasoning,keywords',
              message:
                'Finnhub /company-news has no sentiment/keyword fields — structurally null on this source, not a transient failure.',
            },
          ]
        : [];

    return { data, source: this.sourceName, warnings };
  }
}
