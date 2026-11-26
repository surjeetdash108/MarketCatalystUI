"use client";

import { useEffect } from "react";

/**
 * Checks whether an error is caused by a missing or failed chunk/module download,
 * which typically occurs when a new deployment invalidates hashed chunk URLs
 * while a user still has an older version loaded in their browser tab.
 */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && err !== null) {
    if ("cause" in err && (err as any).cause && isChunkLoadError((err as any).cause)) {
      return true;
    }
  }
  const msg = typeof err === "string" ? err : (err as any)?.message || String(err);
  const name = (err as any)?.name || "";
  const stack = (err as any)?.stack || "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk .* failed/i.test(msg) ||
    /Loading CSS chunk .* failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    ((/_next\/static\/chunks/i.test(msg) || /_next\/static\/chunks/i.test(stack)) &&
      /(failed|missing|404|net::ERR)/i.test(msg + " " + stack))
  );
}

/** In-memory copy of the last reload time, used when sessionStorage is missing or blocked. */
let lastReloadMs = 0;

function readLastReload(key: string): number {
  try {
    const v = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
    if (v) return Math.max(lastReloadMs, parseInt(v, 10) || 0);
  } catch { /* storage blocked (private mode, strict settings) */ }
  return lastReloadMs;
}

function writeLastReload(key: string, now: number): void {
  lastReloadMs = now;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, String(now));
  } catch { /* storage blocked: the in-memory copy still guards this page */ }
}

/**
 * Safely refreshes the browser window with an anti-infinite-loop guard: at most
 * once per 15 seconds. The guard used to live only in sessionStorage, so where
 * storage is unavailable (blocked by the browser, or Node 22 in CI) it was
 * skipped and every call reloaded; an in-memory copy now backs it up.
 */
export function reloadForChunkError(reloadFn?: () => void): boolean {
  if (typeof window === "undefined" && !reloadFn) return false;
  const doReload = reloadFn || (() => window.location.reload());
  const RELOAD_KEY = "mc_chunk_reload_ts";
  const now = Date.now();
  // Guard against rapid infinite reload loops (e.g. offline state or persistent outage).
  if (now - readLastReload(RELOAD_KEY) > 15000) {
    writeLastReload(RELOAD_KEY, now);
    doReload();
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
    function onError(event: ErrorEvent | Event) {
      // In browsers, script and link 404/load errors do not bubble and are captured on the element itself
      const target = (event as any)?.target;
      if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
        const src = target.src || target.href || "";
        if (typeof src === "string" && (src.includes("/_next/static/") || src.endsWith(".js") || src.endsWith(".css"))) {
          reloadForChunkError();
          return;
        }
      }

      const err = (event as ErrorEvent).error || (event as ErrorEvent).message;
      if (isChunkLoadError(err)) {
        reloadForChunkError();
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) {
        reloadForChunkError();
      }
    }

    // useCapture: true is required to capture script tag load errors
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
