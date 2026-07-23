"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { firebaseDb } from "../../firebase";

/**
 * Live Firestore collection read, with ONE listener per collection process-wide.
 *
 * WHY THE SHARED REGISTRY
 * Every call to this hook used to open its own `onSnapshot`. Components cannot
 * know what their siblings read, so the same collection was routinely subscribed
 * more than once on a single screen: the Earnings page mounts the calendar and
 * the detail section, and BOTH read `earnings_events` and `companies` — 299
 * documents fetched and billed twice per page load. Firestore charges per
 * document delivered per listener, so the duplication costs money and bytes,
 * not just an extra socket.
 *
 * The registry keys live subscriptions by collection name and ref-counts
 * subscribers. The first mount opens the listener; later mounts attach to it and
 * immediately adopt the last snapshot, so they render with data on their first
 * paint instead of flashing empty. The last unmount closes it.
 *
 * WHY THE CLOSE IS DEFERRED
 * React StrictMode double-invokes effects, and a route change can unmount one
 * reader of a collection just before mounting another. Closing synchronously
 * would tear down the listener and immediately reopen it, re-downloading the
 * whole collection for nothing. A short grace period lets the incoming
 * subscriber adopt the still-open listener.
 */

const IDLE_CLOSE_MS = 5_000;

interface Entry {
  /** Latest snapshot, replayed to every new subscriber on attach. */
  data: unknown[];
  error: string | null;
  loading: boolean;
  refs: number;
  unsub: Unsubscribe | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  listeners: Set<(e: Entry) => void>;
}

const registry = new Map<string, Entry>();

function emit(entry: Entry) {
  for (const l of entry.listeners) l(entry);
}

function acquire(name: string, onChange: (e: Entry) => void): Entry {
  let entry = registry.get(name);

  if (entry) {
    // A pending close from a previous unmount is cancelled — reuse the open
    // listener rather than paying for another full read.
    if (entry.closeTimer) {
      clearTimeout(entry.closeTimer);
      entry.closeTimer = null;
    }
  } else {
    const e: Entry = {
      data: [],
      error: null,
      loading: true,
      refs: 0,
      unsub: null,
      closeTimer: null,
      listeners: new Set(),
    };
    registry.set(name, e);
    e.unsub = onSnapshot(
      collection(firebaseDb, name),
      (snap) => {
        e.data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        e.loading = false;
        e.error = null;
        emit(e);
      },
      (err) => {
        console.error(`Firestore read failed for "${name}":`, err);
        e.error = err.message;
        e.loading = false;
        emit(e);
      },
    );
    entry = e;
  }

  entry.refs++;
  entry.listeners.add(onChange);
  return entry;
}

function release(name: string, onChange: (e: Entry) => void) {
  const entry = registry.get(name);
  if (!entry) return;
  entry.listeners.delete(onChange);
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.closeTimer) return;

  entry.closeTimer = setTimeout(() => {
    entry.closeTimer = null;
    // Re-check: a subscriber may have arrived while the timer was pending.
    if (entry.refs > 0) return;
    entry.unsub?.();
    registry.delete(name);
  }, IDLE_CLOSE_MS);
}

export function useCollection<T>(collectionName: string) {
  const [state, setState] = useState<{ data: T[]; loading: boolean; error: string | null }>(() => {
    // Seed from the registry so a second subscriber paints with data straight
    // away instead of rendering an empty array it must immediately re-render past.
    const existing = registry.get(collectionName);
    return existing
      ? { data: existing.data as T[], loading: existing.loading, error: existing.error }
      : { data: [], loading: true, error: null };
  });

  useEffect(() => {
    const onChange = (e: Entry) =>
      setState({ data: e.data as T[], loading: e.loading, error: e.error });

    const entry = acquire(collectionName, onChange);
    // Adopt what the shared entry already holds: onSnapshot only calls back on
    // the NEXT change, so a late subscriber would otherwise sit empty until the
    // collection happened to change.
    onChange(entry);

    return () => release(collectionName, onChange);
  }, [collectionName]);

  return state;
}
