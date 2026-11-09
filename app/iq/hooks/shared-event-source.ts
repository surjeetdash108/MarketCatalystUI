"use client";

/**
 * One EventSource per stream URL, shared by every component that subscribes.
 *
 * Each open SSE connection holds a concurrency slot on the backend's live
 * service. The dashboard opened the ticker tape twice (shell + page) and a
 * stock page opened the same ticker's stream twice (screen + panel), doubling
 * the slots a tab held. Subscribers now share one connection, closed when the
 * last one leaves.
 *
 * A stream that delivers NOTHING within FIRST_EVENT_MS of opening is closed
 * and not retried for this page: that is the signature of a proxy buffering the
 * response (Firebase Hosting does), which would otherwise hold a backend slot
 * while the browser receives nothing. The callers' JSON polls cover the data.
 */

import { apiPost, streamUrl } from "../backend";
import { createTicketCache, withTicket, type TicketResponse } from "./stream-ticket";

type Handler = (ev: MessageEvent<string>) => void;

/** Longest a fresh stream may stay silent before it is treated as stuck. */
const FIRST_EVENT_MS = 30_000;

interface Entry {
  es: EventSource;
  handlers: Map<string, Set<Handler>>;
  refs: number;
  watchdog: ReturnType<typeof setTimeout> | null;
  /** Starts forwarding a named event type (once per type). */
  listen: (type: string) => void;
}

const streams = new Map<string, Entry>();
/** URLs that proved stuck on this page — not reopened until reload. */
const stuck = new Set<string>();

function dispatch(entry: Entry, type: string) {
  return (ev: Event) => {
    if (entry.watchdog) {
      clearTimeout(entry.watchdog);
      entry.watchdog = null;
    }
    for (const h of entry.handlers.get(type) ?? []) h(ev as MessageEvent<string>);
  };
}

function open(url: string, types: string[]): Entry | null {
  if (stuck.has(url) || typeof EventSource === "undefined") return null;
  const es = new EventSource(url);
  const seen = new Set<string>();
  const entry: Entry = {
    es,
    handlers: new Map(),
    refs: 0,
    watchdog: null,
    listen: (type: string) => {
      if (seen.has(type)) return;
      seen.add(type);
      es.addEventListener(type, dispatch(entry, type));
    },
  };
  // "open" alone does not prove data flows (a buffering proxy opens too), so
  // only a real event clears the watchdog — "error" is passed through as-is.
  for (const t of types) entry.listen(t);
  es.addEventListener("error", (ev) => {
    if (es.readyState === EventSource.CLOSED) {
      console.warn(`[live-stream] Connection closed on ${url}, reconnecting with backoff.`);
    }
    for (const h of entry.handlers.get("error") ?? []) h(ev as MessageEvent<string>);
  });
  entry.watchdog = setTimeout(() => {
    stuck.add(url);
    es.close();
    streams.delete(url);
    for (const h of entry.handlers.get("error") ?? []) h(new MessageEvent("error"));
  }, FIRST_EVENT_MS);
  return entry;
}

/**
 * Subscribe to named SSE events on `url`. Returns the unsubscribe function.
 * "error" handlers are also called if the stream is closed as stuck.
 */
export function subscribeStream(url: string, handlers: Record<string, Handler>): () => void {
  const dataTypes = Object.keys(handlers).filter((t) => t !== "error");
  let entry = streams.get(url) ?? null;
  if (!entry) {
    entry = open(url, dataTypes);
    if (!entry) return () => {};
    streams.set(url, entry);
  } else {
    for (const t of dataTypes) entry.listen(t);
  }
  const e = entry;
  e.refs++;
  for (const [type, h] of Object.entries(handlers)) {
    const set = e.handlers.get(type) ?? new Set<Handler>();
    set.add(h);
    e.handlers.set(type, set);
  }
  return () => {
    for (const [type, h] of Object.entries(handlers)) e.handlers.get(type)?.delete(h);
    e.refs--;
    if (e.refs <= 0) {
      if (e.watchdog) clearTimeout(e.watchdog);
      e.es.close();
      if (streams.get(url) === e) streams.delete(url);
    }
  };
}

/** One ticket cache for every authenticated stream on the page. */
const tickets = createTicketCache(() => apiPost<TicketResponse>("/api/stream-ticket"));

/** Consecutive failures without a single event before giving up for this subscription. */
const MAX_FAILURES = 3;

/**
 * Subscribe to an authenticated SSE endpoint by PATH (e.g. "/live/tape/stream").
 *
 * Fetches a short-lived stream ticket, opens the stream at the direct stream
 * origin with `?ticket=`, and — because a refused or expired ticket closes an
 * EventSource for good — reconnects with a freshly issued ticket on error, up
 * to MAX_FAILURES times in a row. Any received event resets the count. If no
 * ticket can be issued, "error" handlers fire once and the caller's REST poll
 * carries the data, exactly as when a proxy buffers the stream.
 */
export function subscribeAuthedStream(path: string, handlers: Record<string, Handler>): () => void {
  let closed = false;
  let inner: (() => void) | null = null;
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const connect = async (force: boolean) => {
    const ticket = await tickets.get(force);
    if (closed) return;
    if (!ticket) {
      handlers.error?.(new MessageEvent("error"));
      return;
    }
    inner?.();
    const wrapped: Record<string, Handler> = {};
    for (const [type, h] of Object.entries(handlers)) {
      if (type === "error") continue;
      wrapped[type] = (ev) => {
        failures = 0;
        h(ev);
      };
    }
    wrapped.error = (ev) => {
      handlers.error?.(ev);
      if (closed || retry || failures >= MAX_FAILURES) return;
      failures++;
      retry = setTimeout(() => {
        retry = null;
        void connect(true);
      }, 2_000 * failures);
    };
    inner = subscribeStream(withTicket(streamUrl(path), ticket), wrapped);
  };

  void connect(false);
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    inner?.();
    inner = null;
  };
}
