"use client";

import { useEffect } from "react";

/**
 * Checks whether an error is caused by a missing or failed chunk/module download,
 * which typically occurs when a new deployment invalidates hashed chunk URLs
 * while a user still has an older version loaded in their browser tab.
 */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : (err as any)?.message || String(err);
  const name = (err as any)?.name || "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk .* failed/i.test(msg) ||
    /Loading CSS chunk .* failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    (/_next\/static\/chunks/i.test(msg) && /(failed|missing|404)/i.test(msg))
  );
}

/**
 * Safely refreshes the browser window with an anti-infinite-loop guard.
 */
export function reloadForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const RELOAD_KEY = "mc_chunk_reload_ts";
    const last = sessionStorage.getItem(RELOAD_KEY);
    const now = Date.now();
    // Guard against rapid infinite reload loops (e.g. offline state or persistent outage):
    // Max once per 15 seconds.
    if (!last || now - parseInt(last, 10) > 15000) {
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    window.location.reload();
    return true;
  }
  return false;
}

/**
 * Client component placed at the root level to automatically intercept
 * chunk load errors and reload the page so users get the fresh deployment.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      if (isChunkLoadError(event.error || event.message)) {
        reloadForChunkError();
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) {
        reloadForChunkError();
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
