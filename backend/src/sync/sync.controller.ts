import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { AllSourcesFailedError } from '../adapters/adapter-error';
import { SyncMetaService } from '../common/sync-meta.service';
import { SyncRegistry } from './sync-registry.service';

/** Matches Doc/openapi.yaml's ErrorResponse schema so every error here is the same shape as the documented contract. */
function errorBody(
  statusCode: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return {
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

@Controller('sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    private readonly registry: SyncRegistry,
    private readonly meta: SyncMetaService,
  ) {}

  /**
   * Full picture for the ops dashboard: every registered job + its live
   * running state + its last completed run. The registry (which jobs exist,
   * whether one is running right now) is in-memory — it needs no cloud
   * access at all. The last-run history comes from Firestore and is
   * best-effort on top of that: if Firestore is unreachable, this still
   * returns every registered job (so "what services exist" always works),
   * just with `metaError` set instead of quietly returning nothing.
   */
  @Get('jobs')
  async jobs() {
    const registered = this.registry.list();
    let metaByJob = new Map<string, Record<string, unknown>>();
    let metaError: string | null = null;

    try {
      metaByJob = new Map((await this.meta.statusAll()).map((m) => [m.job, m]));
    } catch (err) {
      metaError = (err as Error).message;
      this.logger.warn(
        `sync_meta unavailable — returning registered jobs without run history: ${metaError}`,
      );
    }

    return registered.map((job) => {
      const m = metaByJob.get(job.name);
      return {
        name: job.name,
        isRunning: job.isRunning,
        runningSince: job.runningSince,
        lastSyncedAt: (m?.lastSyncedAt as string) ?? null,
        lastStatus: (m?.lastStatus as string) ?? null,
        lastCount: (m?.lastCount as number) ?? null,
        lastError: (m?.lastError as string) ?? null,
        // null when Firestore history loaded fine; otherwise explains why the four fields above are all null
        metaError,
      };
    });
  }

  /** Unlike GET /sync/jobs, this endpoint's entire purpose is Firestore-backed history — if Firestore is down there's nothing honest to return but an error. */
  @Get('status')
  async status() {
    try {
      return await this.meta.statusAll();
    } catch (err) {
      throw new HttpException(
        errorBody(
          HttpStatus.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          `Firestore sync_meta read failed: ${(err as Error).message}`,
        ),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get(':job/status')
  async jobStatus(@Param('job') job: string) {
    try {
      return await this.meta.status(job);
    } catch (err) {
      throw new HttpException(
        errorBody(
          HttpStatus.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          `Firestore sync_meta read failed for "${job}": ${(err as Error).message}`,
        ),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post(':job/run')
  async run(@Param('job') job: string) {
    const runner = this.registry.get(job);
    if (!runner) {
      throw new NotFoundException(
        `Unknown job "${job}". Available: ${this.registry.names().join(', ')}`,
      );
    }
    try {
      return await runner();
    } catch (err) {
      if (err instanceof AllSourcesFailedError) {
        throw new HttpException(
          errorBody(
            HttpStatus.BAD_GATEWAY,
            'UPSTREAM_VENDOR_ERROR',
            err.message,
            {
              retryable: err.anyRetryable,
              fallbackAttempted: err.attempts.map((a) => ({
                source: a.source,
                error: a.error,
              })),
            },
          ),
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(
        errorBody(
          HttpStatus.BAD_GATEWAY,
          'UPSTREAM_VENDOR_ERROR',
          `Job "${job}" failed: ${(err as Error).message}`,
          { retryable: true },
        ),
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
