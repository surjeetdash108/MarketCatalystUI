import { Injectable, Logger } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.provider';

export interface SyncResult {
  ok: boolean;
  count?: number;
  error?: string;
}

@Injectable()
export class SyncMetaService {
  private readonly logger = new Logger(SyncMetaService.name);

  constructor(private readonly firebase: FirebaseAdminService) {}

  async record(jobName: string, result: SyncResult) {
    const doc = {
      lastSyncedAt: new Date().toISOString(),
      lastStatus: result.ok ? 'ok' : 'error',
      lastCount: result.count ?? null,
      lastError: result.error ?? null,
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
