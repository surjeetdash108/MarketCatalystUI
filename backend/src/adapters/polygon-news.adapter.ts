import { Injectable } from '@nestjs/common';
import { PolygonService } from '../vendors/polygon/polygon.service';
import { AdapterResult, CanonicalNewsArticle, NewsAdapter } from './types';

/**
 * Primary news source (default — see adapters.module.ts NEWS_SOURCE).
 * Richer than Finnhub's /company-news: multi-ticker tagging, keywords, and
 * per-ticker sentiment + reasoning via `insights`. Confirmed working
 * 2026-07-08 with a real call — see PolygonService's docblock.
 */
@Injectable()
export class PolygonNewsAdapter implements NewsAdapter {
  readonly sourceName = 'polygon';

  constructor(private readonly polygon: PolygonService) {}

  async fetchNews(
    ticker: string,
    from: string,
    to: string,
  ): Promise<AdapterResult<CanonicalNewsArticle[]>> {
    const articles = await this.polygon.getNews(ticker, from, to);

    const data: CanonicalNewsArticle[] = articles.map((a) => {
      const insight = a.insights?.find((i) => i.ticker === ticker) ?? null;
      return {
        id: a.id,
        ticker,
        headline: a.title,
        summary: a.description ?? null,
        source: a.publisher?.name ?? 'Polygon',
        url: a.article_url,
        category: null, // Polygon has no category field — keywords/insights are the richer substitute
        sentiment: insight?.sentiment ?? null,
        sentimentReasoning: insight?.sentiment_reasoning ?? null,
        keywords: a.keywords ?? [],
        publishedAt: a.published_utc,
      };
    });

    return { data, source: this.sourceName, warnings: [] };
  }
}
