import { Module } from '@nestjs/common';
import { BenzingaService } from './benzinga/benzinga.service';
import { TradierService } from './tradier/tradier.service';
import { UnusualWhalesService } from './unusual-whales/unusual-whales.service';

/**
 * Wave 3 vendors — Benzinga, Tradier, Unusual Whales — all blocked on empty
 * API keys as of this build. Each service just logs a one-time "not
 * configured" warning at boot so it's obvious in the logs without spamming
 * on every cron tick. See each service's file for what to build once a key
 * arrives.
 */
@Module({
  providers: [BenzingaService, TradierService, UnusualWhalesService],
  exports: [BenzingaService, TradierService, UnusualWhalesService],
})
export class Wave3Module {}
