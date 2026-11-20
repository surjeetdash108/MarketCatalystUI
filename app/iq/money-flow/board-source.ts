/**
 * Where the Money Flow board comes from, fastest first.
 *
 * 1. The board this browser saw last (IndexedDB), shown at once on a return visit.
 * 2. The saved board in Firestore `money_flow/latest`, written every market
 *    minute by the worker's money-flow-snapshot job and read directly here
 *    (firestore.rules: Pro plans, staff). ~1–2 s, whether or not a backend
 *    instance is awake.
 * 3. GET /live/money-flow — serves the same saved board, or builds one only if
 *    none is usable. Also called once per open in the background, so usage stats
 *    and the backend's own entitlement check see every visit.
 *
 * The newest board (by asOf) wins. A saved board too old to trust while the
 * session runs is ignored (same rule as the backend's snapshotUsable), so
 * pausing the scheduler job turns this path off without a deploy.
 */

/** Same limits as MarketCatalystBackEnd money-flow-snapshot.ts. */
export const SNAPSHOT_SCHEMA = 1;
export const SNAPSHOT_MAX_AGE_MS = 10 * 60_000;
export const SNAPSHOT_OFFHOURS_MAX_AGE_MS = 4 * 24 * 60 * 60_000;

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Weekday 09:30–16:30 ET. */
export function sessionRunning(nowMs: number): boolean {
  const p = Object.fromEntries(ET_PARTS.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  const minutes = (Number(p.hour) % 24) * 60 + Number(p.minute);
  return minutes >= 9 * 60 + 30 && minutes <= 16 * 60 + 30;
}

export function snapshotUsable(builtAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(builtAtMs)) return false;
  const age = nowMs - builtAtMs;
  if (age <= SNAPSHOT_MAX_AGE_MS) return true;
  return !sessionRunning(nowMs) && age <= SNAPSHOT_OFFHOURS_MAX_AGE_MS;
}

type WithAsOf = { asOf?: string | null };

/** The board with the later asOf; `a` when they tie or neither parses. */
export function newerBoard<T extends WithAsOf>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a.asOf ?? "");
  const tb = Date.parse(b.asOf ?? "");
  if (!Number.isFinite(tb)) return a;
  if (!Number.isFinite(ta)) return b;
  return tb > ta ? b : a;
}

/** base64(gzip(JSON)) → parsed JSON, using the browser's DecompressionStream. */
export async function decodeGzBase64<T>(gz: string): Promise<T> {
  const bytes = Uint8Array.from(atob(gz), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as T;
}

export interface SavedDoc {
  schema?: number;
  gz?: string;
  builtAt?: number;
}

/** A Firestore money_flow/latest document → its board, or null if unusable now. */
export async function boardFromSavedDoc<T>(data: SavedDoc | null | undefined, nowMs: number): Promise<T | null> {
  if (!data || data.schema !== SNAPSHOT_SCHEMA || typeof data.gz !== "string") return null;
  if (typeof data.builtAt !== "number" || !snapshotUsable(data.builtAt, nowMs)) return null;
  return decodeGzBase64<T>(data.gz);
}

/** Read money_flow/latest straight from Firestore (lite SDK, loaded only here). */
export async function readSavedBoard<T>(nowMs: number = Date.now()): Promise<T | null> {
  if (typeof DecompressionStream === "undefined") return null; // very old browser → API path
  const [{ getFirestore, doc, getDoc }, { firebaseApp }] = await Promise.all([
    import("firebase/firestore/lite"),
    import("../../firebase"),
  ]);
  const db = getFirestore(firebaseApp, process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "mc-regional");
  const snap = await getDoc(doc(db, "money_flow", "latest"));
  return boardFromSavedDoc<T>(snap.exists() ? (snap.data() as SavedDoc) : null, nowMs);
}

// ── This browser's copy of the last board (IndexedDB; a board is too big for localStorage) ──

const IDB_NAME = "mc-money-flow";
const IDB_STORE = "board";
const IDB_KEY = "latest";

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadCachedBoard<T>(): Promise<T | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCachedBoard<T>(board: T): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(board, IDB_KEY);
  } catch {
    // Private window / storage full: the board still shows, just not cached.
  }
}
