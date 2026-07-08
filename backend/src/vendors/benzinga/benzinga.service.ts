import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * BENZINGA_API_KEY is empty as of this build (confirmed: 401 "Access denied
 * for user 0 anonymous" against /api/v2.1/calendar/ratings). This service is
 * a ready-to-fill stub: real-time analyst ratings + category-tagged news.
 * Once a key is provided, implement getAnalystRatings()/getNews() here and
 * point analyst-actions.job.ts / news.job.ts at this instead of the FMP/
 * Finnhub interim sources.
 */
@Injectable()
export class BenzingaService implements OnModuleInit {
  private readonly logger = new Logger(BenzingaService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BENZINGA_API_KEY', '');
  }

  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn(
        'BENZINGA_API_KEY not configured — Analyst Actions and News run on FMP/Finnhub interim sources instead. Set BENZINGA_API_KEY in backend/.env to activate.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}
