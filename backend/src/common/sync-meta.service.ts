import { Injectable, Logger } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.provider';
import { SyncRegistry } from './sync-registry.service';

export interface SyncResult {
  ok: boolean;
  count?: number;
  error?: string;
}

@Injectable()
export class SyncMetaService {
  private readonly logger = new Logger(SyncMetaService.name);

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly registry: SyncRegistry,
  ) {}

  /**
   * Looked up from the registry (declared once per job at registration
   * time, next to its @Cron(...) — see SyncRegistry.JobMeta) rather than
   * passed in by every call site, so every one of the ~30 existing
   * meta.record(...) calls across the 17 job files keeps working
   * unchanged. Lands in the sync_meta/{jobName} doc itself so "which
   * collection(s) did this affect, and how often does it run" is
   * answerable straight from Firestore, not just from backend source.
   */
  async record(jobName: string, result: SyncResult) {
    const jobMeta = this.registry.getMeta(jobName);
    const now = new Date().toISOString();
    const doc = {
      // Most recent attempt of any outcome + its status — overwritten each run,
      // so lastStatus always reflects current health ('ok' | 'error').
      lastSyncedAt: now,
      lastStatus: result.ok ? 'ok' : 'error',
      lastCount: result.count ?? null,
      // Success and failure land in SEPARATE fields (written only on that
      // outcome) so one never erases the other: after a job succeeds and then
      // later fails you can still read when it last succeeded, and after it
      // recovers you can still read when it last failed and why. The
      // merge:true set() below is what preserves the field this run leaves
      // untouched. (Previously a single lastSyncedAt/lastError pair was
      // overwritten every run, so the prior outcome was lost.)
      ...(result.ok
        ? { lastSuccessAt: now, lastSuccessCount: result.count ?? null }
        : { lastFailedAt: now, lastError: result.error ?? null }),
      ...(jobMeta
        ? {
            collections: jobMeta.collections,
            cronExpression: jobMeta.cronExpression,
            timeZone: jobMeta.timeZone,
          }
        : {}),
    };

    try {
      await this.firebase.firestore
        .collection('sync_meta')
        .doc(jobName)
        .set(doc, { merge: true });
    } catch (err) {
      this.logger.error(
        `Failed to record sync_meta for ${jobName}: ${(err as Error).message}`,
      );
    }

    if (!result.ok) {
      this.logger.error(`[${jobName}] sync failed: ${result.error}`);
    } else {
      this.logger.log(`[${jobName}] synced ${result.count ?? 0} docs`);
    }
  }

  async status(jobName: string) {
    const snap = await this.firebase.firestore
      .collection('sync_meta')
      .doc(jobName)
      .get();
    return snap.exists
      ? { job: jobName, ...snap.data() }
      : { job: jobName, lastSyncedAt: null };
  }

  async statusAll(): Promise<Array<{ job: string } & Record<string, unknown>>> {
    const snap = await this.firebase.firestore.collection('sync_meta').get();
    return snap.docs.map((d) => ({ job: d.id, ...d.data() }));
  }

  /**
   * Rotating cursor for jobs that page through a ticker universe across
   * multiple runs to stay within a vendor's daily quota — e.g. companies.job
   * processes a batch per run and resumes from here next time instead of
   * restarting from index 0.
   */
  async getCursor(jobName: string): Promise<number> {
    const snap = await this.firebase.firestore
      .collection('sync_meta')
      .doc(jobName)
      .get();
    return (snap.data()?.cursor as number) ?? 0;
  }

  async setCursor(jobName: string, cursor: number) {
    await this.firebase.firestore
      .collection('sync_meta')
      .doc(jobName)
      .set({ cursor }, { merge: true });
  }

  /**
   * High-water mark for incremental time-series ingestion — e.g. "the last
   * bar_date already stored for ticker X" so a future job (stock-history)
   * can ask the vendor for only what's new instead of re-fetching a whole
   * range every run and re-writing rows that can never change once the
   * trading day/filing/period they describe is in the past. Doc id is
   * `{jobName}__{entityKey}` in a dedicated collection (not reused from
   * getCursor/setCursor above, which is a single rotating integer per job,
   * not a per-entity value).
   */
  async getWatermark(
    jobName: string,
    entityKey: string,
  ): Promise<string | null> {
    const snap = await this.firebase.firestore
      .collection('sync_watermarks')
      .doc(`${jobName}__${entityKey}`)
      .get();
    return (snap.data()?.lastSyncedThrough as string) ?? null;
  }

  async setWatermark(
    jobName: string,
    entityKey: string,
    lastSyncedThrough: string,
  ) {
    await this.firebase.firestore
      .collection('sync_watermarks')
      .doc(`${jobName}__${entityKey}`)
      .set(
        {
          jobName,
          entityKey,
          lastSyncedThrough,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
  }
}
