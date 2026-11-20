/**
 * Browser-side logo album (Cache Storage).
 *
 * Why this exists: Firebase Hosting adds `Vary: cookie` to every response it
 * forwards from Cloud Run. The browser's HTTP cache therefore treats the stored
 * logo as "for this exact cookie jar only" and revalidates it (a 304 round trip
 * per logo) whenever a cookie changed since the last load, even though the
 * logo's own headers say it is good for a day. Cache Storage is under our
 * control and `ignoreVary: true` makes the lookup ignore cookies, so a logo
 * that was fetched once is shown from disk with no request at all.
 *
 * Lifecycle of one logo:
 *   1. in-session map         -> object URL already known, synchronous
 *   2. Cache Storage lookup   -> hit: show it; if older than REFRESH_AFTER_MS,
 *                                 quietly refetch for the next visit
 *   3. network fetch          -> 200: store + show; 204: "no logo" (caller
 *                                 remembers it); anything else / no Cache API:
 *                                 "direct" = let the <img> load the URL itself
 *
 * Everything degrades to the old behaviour (plain <img src>) when Cache Storage
 * is unavailable (insecure context, blocked storage, private windows).
 */

export type LogoResult =
  | { kind: "blob"; url: string }
  | { kind: "missing" }
  | { kind: "direct" };

/** Shown straight from storage up to this age; older entries are refreshed in the background. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
/** Entries not refreshed for this long are deleted by the once-per-session sweep. */
const EVICT_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "mc-logos-";
const STAMP_HEADER = "x-mc-cached-at";

const objectUrls = new Map<string, string>(); // logo URL -> blob: URL (kept for the session)
const inFlight = new Map<string, Promise<LogoResult>>();
const refreshed = new Set<string>();
let swept = false;

function cacheApiAvailable(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined" && typeof Blob !== "undefined";
}

/** Synchronous: the blob URL if this logo was already resolved in this page session. */
export function peekLogoObjectUrl(url: string): string | undefined {
  return objectUrls.get(url);
}

async function openStore(version: string): Promise<Cache> {
  return caches.open(`${CACHE_PREFIX}v${version}`);
}

function ageOf(res: Response): number {
  const at = Number(res.headers.get(STAMP_HEADER));
  return Number.isFinite(at) && at > 0 ? Date.now() - at : Number.POSITIVE_INFINITY;
}

async function fetchAndStore(url: string, store: Cache): Promise<{ blob: Blob } | "missing" | "direct"> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return "direct"; // offline / blocked: let the <img> try (and fail) the normal way
  }
  if (res.status === 204) return "missing";
  if (!res.ok) return "direct";
  const blob = await res.blob();
  if (!blob.size || (blob.type && !blob.type.startsWith("image/"))) return "direct";
  try {
    // Synthetic response: we own the headers, so no Vary and our own timestamp.
    await store.put(
      url,
      new Response(blob, { headers: { "Content-Type": blob.type, [STAMP_HEADER]: String(Date.now()) } }),
    );
  } catch {
    // Quota exceeded or storage blocked: still show it this session.
  }
  return { blob };
}

function toBlobResult(url: string, blob: Blob): LogoResult {
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(url, objectUrl);
  return { kind: "blob", url: objectUrl };
}

async function resolve(url: string, version: string): Promise<LogoResult> {
  try {
    const store = await openStore(version);
    const hit = await store.match(url, { ignoreVary: true });
    if (hit) {
      const blob = await hit.blob();
      const result = toBlobResult(url, blob);
      if (ageOf(hit) > REFRESH_AFTER_MS && !refreshed.has(url)) {
        refreshed.add(url);
        // Next visit gets the fresh copy; this one keeps what is on screen.
        void fetchAndStore(url, store).catch(() => undefined);
      }
      return result;
    }
    const got = await fetchAndStore(url, store);
    if (got === "missing") return { kind: "missing" };
    if (got === "direct") return { kind: "direct" };
    return toBlobResult(url, got.blob);
  } catch {
    return { kind: "direct" };
  }
}

/** Delete other versions' albums and entries nobody has refreshed for a month. Once per session, when idle. */
function scheduleSweep(version: string) {
  if (swept) return;
  swept = true;
  setTimeout(async () => {
    try {
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== `${CACHE_PREFIX}v${version}`) await caches.delete(name);
      }
      const store = await openStore(version);
      for (const req of await store.keys()) {
        const res = await store.match(req, { ignoreVary: true });
        if (res && ageOf(res) > EVICT_AFTER_MS) await store.delete(req);
      }
    } catch {
      // Best effort only.
    }
  }, 15_000);
}

/**
 * Resolve one logo URL to something an <img> can show. Never rejects.
 * Concurrent callers for the same URL share one lookup / one network request.
 */
export function resolveLogo(url: string, version: string): Promise<LogoResult> {
  const known = objectUrls.get(url);
  if (known) return Promise.resolve({ kind: "blob", url: known });
  if (!cacheApiAvailable()) return Promise.resolve({ kind: "direct" });
  let p = inFlight.get(url);
  if (!p) {
    scheduleSweep(version);
    p = resolve(url, version).finally(() => inFlight.delete(url));
    inFlight.set(url, p);
  }
  return p;
}
