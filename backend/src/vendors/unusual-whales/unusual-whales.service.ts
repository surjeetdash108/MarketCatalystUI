import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * UNUSUAL_WHALES_API_KEY is empty as of this build (confirmed: the API
 * requires a UUID-format token via `Authorization: Bearer <uuid>`, and the
 * configured value is blank). This service is a ready-to-fill stub for
 * unusual options flow + dark pool prints (Phase 2 per the coverage sheet —
 * not MVP-critical). Once a key is provided, implement getFlow()/
 * getDarkPoolPrints() here and wire jobs writing to options_flow/{flowId}
 * and block_trades/{tradeId}.
 */
@Injectable()
export class UnusualWhalesService implements OnModuleInit {
  private readonly logger = new Logger(UnusualWhalesService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('UNUSUAL_WHALES_API_KEY', '');
  }

  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn(
        'UNUSUAL_WHALES_API_KEY not configured — options flow/dark pool prints unavailable (Phase 2, not MVP-critical). Set UNUSUAL_WHALES_API_KEY in backend/.env to activate.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}
