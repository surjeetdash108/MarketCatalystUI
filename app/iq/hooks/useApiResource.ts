"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../backend";
import { retryDelayMs } from "./retry-policy";

/**
 * Fetches a backend REST endpoint, replacing useCollection()'s direct
 * Firestore onSnapshot for screens migrated to the backend. No live push —
 * pass a refetchMs to poll, otherwise it fetches once per (path, deps) change.
 * Pass path === null to skip fetching (e.g. waiting on an auth-dependent id).
 */
export function useApiResource<T>(path: string | null, refetchMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path === null) {
      // Deferred so this stays a callback, not a synchronous setState in the
      // effect body (see react-hooks/set-state-in-effect).
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;

    // Path changed: clear the previous resource and show a loading state so
    // consumers render loading instead of lingering on the prior ticker's data
    // until this fetch resolves (BUG-DATA-009). Deferred like the null branch
    // above to avoid a synchronous setState in the effect body; the `cancelled`
    // guard below still stops a superseded path's late response from overwriting
    // the current data.
    queueMicrotask(() => {
      if (!cancelled) {
        setData(null);
        setError(null);
        setLoading(true);
      }
    });

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    async function load(attempt = 0) {
      try {
        const result = await apiGet<T>(path as string);
        if (!cancelled) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        // A transient failure (timeout, network, 429, 5xx) is retried before the
        // screen is told — it renders a failed read the same as "no data".
        const wait = retryDelayMs(err, attempt);
        if (wait != null) {
          retryTimer = setTimeout(() => void load(attempt + 1), wait);
          return;
        }
        if ((err as Error)?.name !== "AbortError") {
          console.error(`Backend fetch failed for "${path}":`, err);
        }
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }

    void load();
    const interval = refetchMs ? setInterval(() => void load(), refetchMs) : undefined;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [path, refetchMs]);

  return { data, loading, error };
}
