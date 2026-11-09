"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../backend";
import { firebaseAuth } from "../../firebase";

/** GET /api/me/entitlements — what the signed-in user's plan includes. */
export interface Entitlements {
  subscriptionsEnabled: boolean;
  paidPlansAvailable: boolean;
  provider: string;
  planId: string;
  planName: string;
  status: string;
  interval: "monthly" | "annual" | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  inGrace: boolean;
  graceEndsAt: string | null;
  entitlements: Record<string, boolean>;
  requiredPlan: Record<string, string | null>;
  hidden: string[];
  limits: { watchlistTickers: number | null };
}

type State = { data: Entitlements | null; loading: boolean; error: boolean };

let cache: State = { data: null, loading: false, error: false };
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: State) => void>();

function publish(next: State) {
  cache = next;
  for (const l of listeners) l(cache);
}

async function load(): Promise<void> {
  if (inflight) return inflight;
  publish({ ...cache, loading: true });
  inflight = apiGet<Entitlements>("/api/me/entitlements")
    .then((data) => publish({ data, loading: false, error: false }))
    .catch(() => publish({ data: cache.data, loading: false, error: true }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Re-reads entitlements after a plan change. Forces a fresh ID token first so
 * the `plan` custom claim (used by Firestore rules) is current too.
 */
export async function refreshEntitlements(): Promise<Entitlements | null> {
  try {
    await firebaseAuth.currentUser?.getIdToken(true);
  } catch {
    /* offline: the API call below still reflects the backend */
  }
  inflight = null;
  await load();
  return cache.data;
}

/** Shared, cached entitlements for every component on the page. */
export function useEntitlements(): State & { refresh: () => Promise<Entitlements | null> } {
  const [state, setState] = useState<State>(cache);
  useEffect(() => {
    listeners.add(setState);
    if (!cache.data && !cache.loading) void load();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { ...state, refresh: refreshEntitlements };
}

/** Pure decision used by the gate (tested without React). */
export function gateDecisionFor(e: Entitlements | null, key: string | null): { kind: "allow" } | { kind: "loading" } | { kind: "locked"; requiredPlan: string | null } | { kind: "hidden" } {
  if (!key) return { kind: "allow" };
  if (!e) return { kind: "loading" };
  if (e.hidden.includes(key)) return { kind: "hidden" };
  if (!e.subscriptionsEnabled) return { kind: "allow" };
  if (e.entitlements[key] === true) return { kind: "allow" };
  return { kind: "locked", requiredPlan: e.requiredPlan[key] ?? null };
}
