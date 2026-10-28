/**
 * One active login per account. Each login claims a session id on the backend
 * (POST /api/session/claim); every API call then carries it as X-Session-Id and
 * the backend refuses any id that a newer login has replaced. The id lives in
 * localStorage so tabs on this device share it and a reload keeps it.
 *
 * The claim is lazy — made by the first authenticated request that finds no id
 * for the signed-in uid — so no login form needs to know about it.
 */

const STORAGE_KEY = "mc.session";
const CLAIM_LOCK = "mc-session-claim";

export const SESSION_SUPERSEDED = "SESSION_SUPERSEDED";

type StoredSession = { uid: string; id: string };

function readStored(uid: string): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredSession>;
    return stored.uid === uid && typeof stored.id === "string" ? stored.id : null;
  } catch {
    return null;
  }
}

function writeStored(uid: string, id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ uid, id } satisfies StoredSession));
  } catch {
    // Storage blocked: this device claims again on its next page load.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, or storage blocked.
  }
}

function newSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Claims in flight, so concurrent requests on a fresh login share one claim. */
const claims = new Map<string, Promise<string>>();

/**
 * The session id to send for `uid`, claiming a new one if this device has none.
 * `post` performs the claim request; it is injected so this module never
 * imports backend.ts (which imports it).
 */
export function sessionIdFor(uid: string, post: (sessionId: string) => Promise<void>): Promise<string> {
  const stored = readStored(uid);
  if (stored) return Promise.resolve(stored);

  const running = claims.get(uid);
  if (running) return running;

  const claim = async (): Promise<string> => {
    // Another tab may have claimed while this one waited for the lock.
    const raced = readStored(uid);
    if (raced) return raced;
    const id = newSessionId();
    await post(id);
    writeStored(uid, id);
    return id;
  };
  const locked = async (): Promise<string> =>
    navigator.locks ? await navigator.locks.request(CLAIM_LOCK, claim) : claim();
  const p = locked().finally(() => claims.delete(uid));
  claims.set(uid, p);
  return p;
}
