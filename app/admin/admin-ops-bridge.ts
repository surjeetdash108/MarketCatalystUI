import { BackendApiError } from "../iq/backend";

/**
 * Bridge for the admin console's Jobs and API Docs tabs.
 *
 * The console (public/admin/console.html) runs in an iframe that holds no
 * backend token, so every call these tabs make is delegated here, to the parent
 * that owns the Firebase session — the same arrangement as the blog and MCP-key
 * tabs. What is different is that two of these messages DO things:
 *
 *   admin:jobRun    starts a production job
 *   admin:apiCheck  fires a burst of authenticated reads
 *
 * so admin-console.tsx only lets them through from the console iframe itself
 * (source and origin), and this module keeps the rest of the trust where it
 * belongs: the iframe names WHAT it wants, and this side decides the URL.
 * In particular "Run checks" receives API keys, never URLs — each is looked up
 * in the catalogue this module fetched, so a forged message cannot make the
 * admin's browser GET an arbitrary path with the admin's token.
 */

export const OPS_MESSAGE_TYPES = [
  "admin:screenApis",
  "admin:jobRuns",
  "admin:jobRun",
  "admin:apiCheck",
] as const;

export type OpsMessageType = (typeof OPS_MESSAGE_TYPES)[number];

export function isOpsMessage(type: unknown): type is OpsMessageType {
  return typeof type === "string" && (OPS_MESSAGE_TYPES as readonly string[]).includes(type);
}

export interface OpsBridgeDeps {
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  /** Sends a message back to the console iframe. */
  reply: (message: Record<string, unknown>) => void;
  /** Milliseconds, for timing a check. Defaults to performance.now(). */
  clock?: () => number;
}

/** Job names are registry keys: lowercase words joined by hyphens. */
const JOB_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** One click of "Run checks" never fires more than this many reads. */
export const MAX_CHECKS = 80;
/** ...and never more than this many at once, so it cannot swamp the backend. */
export const CHECK_CONCURRENCY = 3;

type CheckPlan = { url: string } | { skip: string };

/** What the backend said about a failed call, in a form the console can show. */
export function describeBackendError(err: unknown): {
  error: string;
  status: number;
  code?: string;
  detail?: Record<string, unknown>;
} {
  if (err instanceof BackendApiError) {
    try {
      const body = JSON.parse(err.message) as Record<string, unknown>;
      const { lock, run, risk } = body;
      return {
        error: typeof body.message === "string" && body.message ? body.message : `HTTP ${err.status}`,
        status: err.status,
        ...(typeof body.code === "string" ? { code: body.code } : {}),
        ...(lock || run || risk ? { detail: { lock, run, risk } } : {}),
      };
    } catch {
      // not JSON (a proxy error page, say) — fall through to the raw text
    }
    return { error: err.message.trim().slice(0, 300) || `HTTP ${err.status}`, status: err.status };
  }
  return { error: (err as Error)?.message || "Request failed.", status: 0 };
}

/** The number of records in a response, when it is a list or wraps one. */
export function countRows(data: unknown): number | null {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(value)) return value.length;
    }
  }
  return null;
}

export function createOpsBridge(deps: OpsBridgeDeps) {
  const clock = deps.clock ?? (() => performance.now());
  /** key -> what to send, from the last catalogue THIS side fetched. */
  let plans = new Map<string, CheckPlan>();

  async function screenApis(d: Record<string, unknown>): Promise<void> {
    try {
      const data = await deps.get<{ apis?: Record<string, { check?: CheckPlan }> }>(
        `/api/admin/screen-apis${d.fresh === true ? "?fresh=1" : ""}`,
      );
      plans = new Map(
        Object.entries(data.apis ?? {})
          .filter(([, row]) => row?.check)
          .map(([key, row]) => [key, row.check as CheckPlan]),
      );
      deps.reply({ type: "admin:screenApisResult", ok: true, data });
    } catch (err) {
      deps.reply({ type: "admin:screenApisResult", ok: false, ...describeBackendError(err) });
    }
  }

  async function jobRuns(d: Record<string, unknown>): Promise<void> {
    const limit = Math.min(Math.max(Math.trunc(Number(d.limit)) || 25, 1), 50);
    try {
      const data = await deps.get(`/api/admin/jobs/runs?limit=${limit}`);
      deps.reply({ type: "admin:jobRunsResult", ok: true, data });
    } catch (err) {
      deps.reply({ type: "admin:jobRunsResult", ok: false, ...describeBackendError(err) });
    }
  }

  async function jobRun(d: Record<string, unknown>): Promise<void> {
    const job = typeof d.job === "string" ? d.job : "";
    if (!JOB_NAME_RE.test(job)) {
      deps.reply({ type: "admin:jobRunResult", ok: false, job, status: 400, error: "That is not a job name." });
      return;
    }
    try {
      const out = await deps.post<{ run?: unknown; message?: string }>(
        `/api/admin/jobs/${encodeURIComponent(job)}/run`,
        {
          ...(typeof d.confirm === "string" ? { confirm: d.confirm } : {}),
          clearStaleLock: d.clearStaleLock === true,
        },
      );
      deps.reply({ type: "admin:jobRunResult", ok: true, job, run: out?.run, message: out?.message });
    } catch (err) {
      deps.reply({ type: "admin:jobRunResult", ok: false, job, ...describeBackendError(err) });
    }
  }

  async function checkOne(runId: unknown, key: string): Promise<void> {
    const plan = plans.get(key);
    const base = { type: "admin:apiCheckResult", runId, key };
    if (!plan) {
      deps.reply({ ...base, skipped: "Not in the catalogue — refresh the tab and try again." });
      return;
    }
    if ("skip" in plan) {
      deps.reply({ ...base, skipped: plan.skip });
      return;
    }
    const started = clock();
    try {
      const data = await deps.get(plan.url);
      deps.reply({ ...base, ok: true, status: 200, ms: Math.round(clock() - started), rows: countRows(data) });
    } catch (err) {
      const e = describeBackendError(err);
      deps.reply({ ...base, ok: false, status: e.status, error: e.error, ms: Math.round(clock() - started) });
    }
  }

  async function apiCheck(d: Record<string, unknown>): Promise<void> {
    const keys = (Array.isArray(d.keys) ? d.keys : [])
      .filter((k): k is string => typeof k === "string")
      .slice(0, MAX_CHECKS);
    let next = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const i = next++;
        if (i >= keys.length) return;
        await checkOne(d.runId, keys[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHECK_CONCURRENCY, keys.length) }, worker));
    deps.reply({ type: "admin:apiCheckDone", runId: d.runId });
  }

  return async function handle(d: Record<string, unknown>): Promise<void> {
    switch (d.type) {
      case "admin:screenApis":
        return screenApis(d);
      case "admin:jobRuns":
        return jobRuns(d);
      case "admin:jobRun":
        return jobRun(d);
      case "admin:apiCheck":
        return apiCheck(d);
    }
  };
}
