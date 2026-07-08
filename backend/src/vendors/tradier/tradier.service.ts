import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TRADIER_ACCESS_TOKEN is empty as of this build (confirmed: 401 "Invalid
 * access token"). This service is a ready-to-fill stub for the Options Chain
 * screen's core data (strikes, bid/ask, IV, OI, Greeks). Once a token is
 * provided (free with a Tradier brokerage account per the vendor sheet),
 * implement getOptionsChain()/getExpirations() here and wire an
 * options-chains.job.ts writing to the options_chains/{ticker} collection.
 */
@Injectable()
export class TradierService implements OnModuleInit {
  private readonly logger = new Logger(TradierService.name);
  private readonly accessToken: string;

  constructor(private readonly config: ConfigService) {
    this.accessToken = this.config.get<string>('TRADIER_ACCESS_TOKEN', '');
  }

  onModuleInit() {
    if (!this.accessToken) {
      this.logger.warn(
        'TRADIER_ACCESS_TOKEN not configured — Options Chain has no data source yet. Set TRADIER_ACCESS_TOKEN in backend/.env to activate.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken);
  }
}
