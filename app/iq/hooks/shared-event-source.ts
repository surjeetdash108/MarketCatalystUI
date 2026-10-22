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
