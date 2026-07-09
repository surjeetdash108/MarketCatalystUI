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
import { CronJob } from 'cron';
import { AllSourcesFailedError } from '../adapters/adapter-error';
import { SyncMetaService } from '../common/sync-meta.service';
import { SyncRegistry } from '../common/sync-registry.service';

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

/**
 * Computes the next fire time for a cron expression without actually
 * scheduling anything (start: false) — uses the exact same `cron` library
 * @nestjs/schedule's @Cron(...) decorator relies on internally, so this
 * always agrees with when the job will really fire, not a re-implemented
 * approximation. Returns null rather than throwing on a malformed
 * expression — a display glitch, not a reason to fail the whole response.
 */
function nextRunAt(cronExpression: string, timeZone: string): string | null {
  try {
    const job = CronJob.from({
      cronTime: cronExpression,
      onTick: () => {},
      start: false,
      timeZone,
    });
    return job.nextDate().toJSDate().toISOString();
  } catch {
    return null;
  }
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
        // Registry copy (in-memory, always available) — same values
        // sync_meta persists per run, shown here even when Firestore itself
        // is unreachable (metaError set) so "what does this job affect and
        // how often" is never blocked on the same outage as run history.
        collections: job.collections,
        cronExpression: job.cronExpression,
        timeZone: job.timeZone,
        // Computed fresh on every call (not cached/stored) — always correct
        // relative to "now", including right after a manual/run-all trigger
        // that doesn't itself shift the next scheduled cron fire.
        nextRunAt: nextRunAt(job.cronExpression, job.timeZone),
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

  /**
   * Triggers every registered job, one at a time (not in parallel) — several
   * jobs already rate-limit themselves internally against a single vendor
   * (e.g. news.job.ts's per-ticker delay, SEC EDGAR's 10 req/sec throttle),
   * and running them concurrently would stack unrelated jobs' bursts on top
   * of each other for no benefit; this is a manual ops action, not a
   * latency-sensitive path. A job already mid-run (cron fired concurrently)
   * is skipped rather than double-invoked. One job's failure doesn't stop
   * the rest — each result is captured independently, same error shape as
   * POST /:job/run's catch block.
   */
  @Post('run-all')
  async runAll() {
    const results: Array<{
      job: string;
      ok: boolean;
      skipped?: boolean;
      count?: number;
      error?: string;
    }> = [];

    for (const name of this.registry.names()) {
      const jobState = this.registry.list().find((j) => j.name === name);
      if (jobState?.isRunning) {
        results.push({ job: name, ok: false, skipped: true });
        continue;
      }
      const runner = this.registry.get(name)!;
      try {
        const result = await runner();
        const count =
          result && typeof result === 'object' && 'count' in result
            ? ((result as { count?: number }).count ?? undefined)
            : undefined;
        results.push({ job: name, ok: true, count });
      } catch (err) {
        results.push({ job: name, ok: false, error: (err as Error).message });
      }
    }

    return {
      total: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
    };
  }
}
