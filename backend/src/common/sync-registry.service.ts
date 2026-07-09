import { Injectable } from '@nestjs/common';

export type SyncRunner = () => Promise<unknown>;

/**
 * Declared once by each job at registration time, right next to its
 * @Cron(...) decorator so the schedule and this description can't drift
 * apart. cronExpression/timeZone are the literal values passed to @Cron —
 * kept here in string form (not re-derived from the decorator, which
 * NestJS's scheduler doesn't expose back out) purely for display/audit on
 * the ops dashboard and in Firestore (see SyncMetaService.record).
 */
export interface JobMeta {
  collections: string[];
  cronExpression: string;
  timeZone: string;
}

interface RegisteredJob {
  runner: SyncRunner;
  isRunning: boolean;
  runningSince: string | null;
  meta: JobMeta;
}

/**
 * Each sync job registers itself here on module init so the manual-trigger
 * controller (POST /sync/:job/run) can dispatch by name without every job
 * needing its own controller route. Also tracks live "is this running right
 * now" state (distinct from sync_meta's "when did it last finish") for the
 * ops dashboard, and — since 2026-07-09 — each job's declared collections
 * + cron schedule, so "which table does this affect and how often" is
 * answerable without reading source. This in-memory copy always reflects
 * what's actually registered (works even when Firestore is unreachable);
 * SyncMetaService.record() additionally persists the same collections/
 * schedule into the `sync_meta/{jobName}` Firestore doc on every run so
 * it's queryable from Firebase itself, not just this process.
 */
@Injectable()
export class SyncRegistry {
  private readonly jobs = new Map<string, RegisteredJob>();

  register(name: string, runner: SyncRunner, meta: JobMeta) {
    this.jobs.set(name, { runner, isRunning: false, runningSince: null, meta });
  }

  get(name: string): SyncRunner | undefined {
    const job = this.jobs.get(name);
    if (!job) return undefined;

    // Wrap so every dispatch path (cron tick or manual trigger) updates
    // running state, not just the controller's POST /:job/run.
    return async () => {
      job.isRunning = true;
      job.runningSince = new Date().toISOString();
      try {
        return await job.runner();
      } finally {
        job.isRunning = false;
        job.runningSince = null;
      }
    };
  }

  getMeta(name: string): JobMeta | undefined {
    return this.jobs.get(name)?.meta;
  }

  names(): string[] {
    return [...this.jobs.keys()];
  }

  list(): Array<{
    name: string;
    isRunning: boolean;
    runningSince: string | null;
    collections: string[];
    cronExpression: string;
    timeZone: string;
  }> {
    return [...this.jobs.entries()].map(([name, job]) => ({
      name,
      isRunning: job.isRunning,
      runningSince: job.runningSince,
      collections: job.meta.collections,
      cronExpression: job.meta.cronExpression,
      timeZone: job.meta.timeZone,
    }));
  }
}
