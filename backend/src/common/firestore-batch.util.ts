import { Firestore } from 'firebase-admin/firestore';

const MAX_BATCH_WRITES = 500;

/** Commits `docs` in chunks of <=500 writes — Firestore's per-batch limit. */
export async function chunkedBatchSet<T>(
  firestore: Firestore,
  collectionName: string,
  docs: Array<{ id: string; data: T }>,
) {
  const col = firestore.collection(collectionName);
  for (let i = 0; i < docs.length; i += MAX_BATCH_WRITES) {
    const chunk = docs.slice(i, i + MAX_BATCH_WRITES);
    const batch = firestore.batch();
    for (const { id, data } of chunk) {
      batch.set(col.doc(id), data as object, { merge: true });
    }
    await batch.commit();
  }
}
