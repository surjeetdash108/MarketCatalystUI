"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../backend";
import { subscribeAuthedStream } from "./shared-event-source";
import type { TapeFrame } from "../types/tape";

/** How stale the last SSE frame must be before the JSON poll steps in (ms). */
const SSE_STALE_MS = 8000;
const POLL_MS = 20000;

let sharedFrame: TapeFrame | null = null;
let sharedConnected = false;
let subscribersCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let streamUnsub: (() => void) | null = null;
let lastSse = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function fetchSharedTape() {
  try {
    const f = await apiGet<TapeFrame>("/live/tape");
    if (Date.now() - lastSse > SSE_STALE_MS) {
      sharedFrame = f;
      notify();
    }
  } catch {
    /* transient */
  }
}

function startSharedTape() {
  if (subscribersCount === 0) {
    void fetchSharedTape();
    const onTape = (ev: MessageEvent<string>) => {
      try {
        lastSse = Date.now();
        sharedFrame = JSON.parse(ev.data) as TapeFrame;
        sharedConnected = true;
        notify();
      } catch (err) {
        console.error("tape stream: malformed frame", err);
      }
    };
    const onError = () => {
      sharedConnected = false;
      notify();
    };
    streamUnsub = subscribeAuthedStream("/live/tape/stream", {
      tape: onTape,
      heartbeat: () => {},
      error: onError,
    });
    pollTimer = setInterval(() => void fetchSharedTape(), POLL_MS);
  }
  subscribersCount++;
}

function stopSharedTape() {
  subscribersCount--;
  if (subscribersCount <= 0) {
    subscribersCount = 0;
    if (pollTimer) clearInterval(pollTimer);
    if (streamUnsub) streamUnsub();
    pollTimer = null;
    streamUnsub = null;
  }
}

/**
 * Subscribes to the backend's ticker-tape SSE broadcast for live push, with a
 * JSON fallback so the tape ALWAYS populates.
 *
 * State is shared across all consumers on the page so the marquee ticker and the
 * dashboard index tiles read from the exact same source and never drift.
 */
export function useTapeStream() {
  const [frame, setFrame] = useState<TapeFrame | null>(sharedFrame);
  const [connected, setConnected] = useState(sharedConnected);

  useEffect(() => {
    startSharedTape();
    const listener = () => {
      setFrame(sharedFrame);
      setConnected(sharedConnected);
    };
    listeners.add(listener);
    // Sync immediate state if already available
    if (sharedFrame !== frame) {
      setFrame(sharedFrame);
    }
    return () => {
      listeners.delete(listener);
      stopSharedTape();
    };
  }, []);

  return { frame, connected };
}
