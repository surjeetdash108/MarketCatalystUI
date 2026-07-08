import { Injectable } from '@nestjs/common';

export type SyncRunner = () => Promise<unknown>;

interface RegisteredJob {
  runner: SyncRunner;
  isRunning: boolean;
  runningSince: string | null;
}

/**
 * Each sync job registers itself here on module init so the manual-trigger
 * controller (POST /sync/:job/run) can dispatch by name without every job
 * needing its own controller route. Also tracks live "is this running right
 * now" state (distinct from sync_meta's "when did it last finish") for the
 * ops dashboard.
 */
@Injectable()
export class SyncRegistry {
  private readonly jobs = new Map<string, RegisteredJob>();

  register(name: string, runner: SyncRunner) {
    this.jobs.set(name, { runner, isRunning: false, runningSince: null });
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

  names(): string[] {
    return [...this.jobs.keys()];
  }

  list(): Array<{
    name: string;
    isRunning: boolean;
    runningSince: string | null;
  }> {
    return [...this.jobs.entries()].map(([name, job]) => ({
      name,
      isRunning: job.isRunning,
      runningSince: job.runningSince,
    }));
  }
}
