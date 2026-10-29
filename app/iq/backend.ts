import { signOut } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { normalizeSector } from "./sector-filter";
import { clearSession, SESSION_SUPERSEDED, sessionIdFor } from "./session";

/**
 * Base URL for the MarketCatalystBackEnd REST/SSE surface, resolved at RUNTIME
 * so a single static build works in every environment without a rebuild:
 *
 *   - Local dev (localhost / 127.0.0.1) -> http://localhost:4400 (local backend)
 *   - Firebase Hosting (deployed)        -> same-origin, i.e. the Firebase base
 *     URL. firebase.json rewrites /api, /market-data and /live to the backend
 *     Cloud Run service, so there is no CORS and responses are CDN-cacheable.
 *
 * NEXT_PUBLIC_BACKEND_URL is honoured only as an explicit REMOTE override (e.g.
 * pointing a local UI at a deployed backend). A localhost value is ignored once
 * the page itself is served from a real host, so a dev env baked into a
 * production build can never misroute deployed traffic back to localhost.
 */
function resolveBackendBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "");
  const isRemoteOverride = !!override && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(override);

  // SSR / static-generation has no window; no client API calls happen there.
  if (typeof window === "undefined") return override || "http://localhost:4400";

  if (isRemoteOverride) return override as string;

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:4400";

  // Deployed on Firebase Hosting -> talk to our own origin (proxied to backend).
  return window.location.origin;
}

const BASE_URL = resolveBackendBaseUrl();

/**
 * Origin for long-lived SSE streams (/live/stream, /live/tape/stream) — kept
 * SEPARATE from BASE_URL on purpose.
 *
 * REST goes same-origin so Firebase Hosting can CDN-cache it. But Hosting's CDN
 * BUFFERS a long-lived streaming response: an EventSource opened at the
 * same-origin rewrite never receives a frame (the whole reason useTapeStream /
 * useLiveTick also carry a REST poll fallback). Cloud Run streams SSE fine when
 * hit directly, and the `live` service's CORS allowlist already includes the
 * hosting origin (main.ts corsOptions, credentials:false; the streams are
 * public so EventSource's no-auth-header limitation is a non-issue). So point
 * EventSource straight at that service via NEXT_PUBLIC_LIVE_STREAM_ORIGIN — the
 * market-catalyst-live *.run.app URL, or a custom domain mapped to Cloud Run.
 *
 * Only a REMOTE value is honoured (same guard as the backend override): a
 * localhost value baked into a production build is ignored. Unset -> BASE_URL,
 * which in local dev is localhost:4400 and streams directly with no Hosting in
 * the way, so streaming already works in dev with no env var.
 */
function resolveStreamOrigin(): string {
  const direct = process.env.NEXT_PUBLIC_LIVE_STREAM_ORIGIN?.trim().replace(/\/$/, "");
  const isRemote = !!direct && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(direct);
  if (isRemote) return direct as string;
  // The production app hosts stream straight from the live Cloud Run service
  // even when the build lacks the env var. A build without it once sent every
  // stream through Hosting, which buffered them while each held a backend slot
  // for an hour — 22 Oct 2026, the service ran out of slots and answered 429.
  if (typeof window !== "undefined" && PROD_APP_HOSTS.has(window.location.hostname)) {
    return LIVE_STREAM_ORIGIN_PROD;
  }
  return BASE_URL;
}

/** The `market-catalyst-live` Cloud Run service (CORS allows the hosts below). */
const LIVE_STREAM_ORIGIN_PROD = "https://market-catalyst-live-h66dwv5tjq-uc.a.run.app";
/** Deployed app hosts allowed by that service's CORS list. */
const PROD_APP_HOSTS = new Set([
  "app.marketcatalyst.ai",
  "marketcatalyst.web.app",
  "marketcatalyst.firebaseapp.com",
]);

const STREAM_ORIGIN = resolveStreamOrigin();

export class BackendApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

async function claimSession(token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/session/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new BackendApiError(res.status, (await res.text().catch(() => "")) || res.statusText);
}

/** Another device logged in as this user: drop this device's login and return to the login page. */
let endingSession = false;
async function endSupersededSession(): Promise<void> {
  if (endingSession) return;
  endingSession = true;
  clearSession();
  try {
    await signOut(firebaseAuth);
  } catch {
    // Already signed out, or the SDK is unavailable — the redirect below still applies.
  }
  window.location.assign("/auth/login?reason=signed-in-elsewhere");
}

function isSupersededResponse(status: number, body: string): boolean {
  return status === 401 && body.includes(SESSION_SUPERSEDED);
}

/**
 * Attaches the current Firebase ID token and this device's session id, if
 * signed in. Anonymous/public GETs get no header at all.
 */
async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined" && firebaseAuth?.authStateReady) {
    try {
      await firebaseAuth.authStateReady();
    } catch {
      // Ignore if authStateReady fails or isn't supported
    }
  }
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  const sessionId = await sessionIdFor(user.uid, (id) => claimSession(token, id));
  return { Authorization: `Bearer ${token}`, "X-Session-Id": sessionId };
}

/** Requests abort after this long so a stalled mobile connection can't hang forever. */
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Without this a stalled connection (common on flaky mobile networks) leaves
  // the fetch pending indefinitely. Callers that await it — e.g. the auth
  // listener's profile fetch — would then never settle. The timer covers the
  // whole request: the auth token, the headers AND the body. It used to be
  // cleared once headers arrived, so a body that stalled mid-download (the
  // full earnings list) left a widget on "Loading…" for good.
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    try {
      controller.abort("Request timed out");
    } catch {
      controller.abort();
    }
  }, REQUEST_TIMEOUT_MS);
  try {
    const aborted = new Promise<Record<string, string>>((_, reject) =>
      controller.signal.addEventListener("abort", () => reject(new Error("Request timed out")), { once: true }),
    );
    // Settles late (or never) once the race is decided — never an unhandled rejection.
    aborted.catch(() => {});
    const auth = await Promise.race([authHeaders(), aborted]);
    const headers = { ...auth, ...(init.headers ?? {}) };
    const isLiveOrMarketData = path.startsWith("/market-data/") || path.startsWith("/live/");
    const res = await fetch(`${BASE_URL}${path}`, {
      cache: isLiveOrMarketData ? "no-store" : init.cache,
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (isSupersededResponse(res.status, body)) void endSupersededSession();
      throw new BackendApiError(res.status, body || res.statusText);
    }
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!text.trim()) return undefined as T;
    return JSON.parse(text, sectorReviver) as T;
  } catch (err) {
    if (timedOut && !(err instanceof BackendApiError)) throw new Error(`Request timed out: ${path}`);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Applied to every API response as it is parsed:
 *  - renames backend sector labels (see normalizeSector);
 *  - shows the vendor's published beta (`betaVendor`, FMP — the 5-year monthly
 *    figure quote pages show) as `beta` when a company has one, keeping our
 *    own computed beta as the fallback. One place, so every screen agrees.
 */
function sectorReviver(key: string, value: unknown): unknown {
  if (key === "sector" && typeof value === "string") return normalizeSector(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as { beta?: unknown; betaVendor?: unknown };
    if (typeof o.betaVendor === "number" && Number.isFinite(o.betaVendor)) o.beta = o.betaVendor;
  }
  return value;
}

/**
 * GETs already on the wire, by path. The shell and the dashboard both mount
 * useApiList("/market-data/companies") (and sectors/earnings) at load; without
 * this each fires its own request at an already-saturated backend.
 */
const inflightGets = new Map<string, Promise<unknown>>();

export function apiGet<T>(path: string): Promise<T> {
  const running = inflightGets.get(path);
  if (running) return running as Promise<T>;
  const p = request<T>(path).finally(() => inflightGets.delete(path));
  inflightGets.set(path, p);
  return p;
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/** How much of a request body has reached the server so far. */
export type UploadProgress = { loaded: number; total: number };

/**
 * Upload ceiling. Generous next to REQUEST_TIMEOUT_MS because the body can be
 * megabytes — but note the real limit is upstream: Firebase Hosting returns 503
 * on any rewrite that runs past 60s, so this only prevents the CLIENT from
 * giving up early on a slow connection; it cannot buy more server time.
 */
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * POST/PATCH a large JSON body, reporting how much has been sent.
 *
 * XMLHttpRequest rather than fetch for two reasons: fetch cannot report request
 * upload progress at all, so a file import has nothing to show but a spinner;
 * and the shared 20s timeout aborts a multi-megabyte upload mid-flight, which
 * surfaces as a generic failure after the admin has waited.
 */
export async function apiUpload<T>(
  path: string,
  body: unknown,
  opts: {
    method?: "POST" | "PATCH";
    onProgress?: (progress: UploadProgress) => void;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const headers = await authHeaders();
  const payload = body !== undefined ? JSON.stringify(body) : "";

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? "POST", `${BASE_URL}${path}`);
    xhr.timeout = opts.timeoutMs ?? UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", "application/json");
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    if (opts.onProgress) {
      xhr.upload.onprogress = (event) => {
        // Not computable when the body is chunked or the browser declines to
        // say; the caller then keeps whatever indeterminate state it had.
        if (event.lengthComputable) {
          opts.onProgress?.({ loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204 || !xhr.responseText) return resolve(undefined as T);
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          // A 2xx with an unparseable body still means the write landed.
          resolve(undefined as T);
        }
        return;
      }
      if (isSupersededResponse(xhr.status, xhr.responseText)) void endSupersededSession();
      reject(new BackendApiError(xhr.status, xhr.responseText || xhr.statusText));
    };
    // Status 0: the request never completed, so there is no HTTP status to
    // report — the browser withholds the reason for cross-origin failures.
    xhr.onerror = () => reject(new BackendApiError(0, "Network error during upload"));
    xhr.ontimeout = () => reject(new BackendApiError(0, "Upload timed out"));
    xhr.onabort = () => reject(new BackendApiError(0, "Upload cancelled"));

    xhr.send(payload);
  });
}

/** Absolute backend URL for a path — for EventSource/WebSocket construction, which can't go through fetch. */
export function backendUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * Absolute URL for an SSE endpoint. Resolves to the direct Cloud Run stream
 * origin (NEXT_PUBLIC_LIVE_STREAM_ORIGIN) when set, bypassing Firebase Hosting's
 * stream-buffering CDN; otherwise same as backendUrl(). See resolveStreamOrigin.
 */
export function streamUrl(path: string): string {
  return `${STREAM_ORIGIN}${path}`;
}
