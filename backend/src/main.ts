import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';

// Error monitoring. No-op until SENTRY_DSN is set in backend/.env, so this is
// safe to ship as-is; drop in the DSN to start receiving crash reports.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0, // errors only for now; raise to enable performance tracing
});

// Process-level safety nets. A cron @Cron handler that rejects (a sync job
// throwing) would otherwise surface as an unhandled rejection and, on
// uncaughtException, tear the whole API down. For a data-sync backend a single
// job failing must NOT take everything else offline — so we log and keep
// serving. (Node considers the process' state undefined after an
// uncaughtException; that trade-off is accepted here in favour of availability.
// Prefer a supervisor/PM2 + health checks in production for a clean restart.)
const procLogger = new Logger('Process');
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
  procLogger.error(
    `Unhandled promise rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
});
process.on('uncaughtException', (err) => {
  Sentry.captureException(err);
  procLogger.error(`Uncaught exception: ${err.stack ?? err.message}`);
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // backendUI (a separate static origin) polls this API for job status
  app.enableShutdownHooks(); // graceful shutdown on SIGTERM/SIGINT
  const port = process.env.PORT ?? 4100;
  await app.listen(port);
  logger.log(`finapp26-backend listening on port ${port}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `Failed to start: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
  );
  process.exit(1);
});
