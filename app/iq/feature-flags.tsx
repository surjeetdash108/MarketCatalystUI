"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "../firebase";

/**
 * Feature-flag system (delivery-plan R6) — client side.
 *
 * Subscribes to the single `feature_flags/default` Firestore doc with
 * onSnapshot, so flipping a flag in Firestore (or via the backend
 * POST /feature-flags/:key) toggles the UI LIVE, with no redeploy and no page
 * reload. Precedence is resolved on the backend (default → env → Firestore);
 * here the Firestore doc is authoritative, falling back to the code defaults
 * below only until the first snapshot lands or if the read is denied.
 *
 * DEFAULTS MUST MATCH the backend registry (feature-flags.registry.ts). A flag
 * absent from the live doc resolves to its default here — an unbuilt feature is
 * OFF so a flip is the deliberate act of releasing it.
 */

export type FlagKey =
  | "FF_MOVERS" | "FF_HEATMAP" | "FF_DASHBOARD"
  | "FF_MACRO" | "FF_IPOS" | "FF_NEWS" | "FF_THEMES" | "FF_NAMESEARCH"
  | "FF_PORTFOLIO" | "FF_WATCHLIST"
  | "FF_STOCKDETAIL" | "FF_SCREENER" | "FF_FEARGREED"
  | "FF_RECAPS_DATA" | "FF_EPSHIST" | "FF_OPTIONS"
  | "FF_AI_WMN" | "FF_AI_RECAPS" | "FF_AI_STOCK" | "FF_AI_MISC"
  | "FF_ANALYST_EVENTS" | "FF_EARNINGS_DEPTH" | "FF_OPTIONS_FLOW" | "FF_ALERTS"
  | "FF_REAL_CALENDARS";

const DEFAULTS: Record<FlagKey, boolean> = {
  FF_MOVERS: true, FF_HEATMAP: true, FF_DASHBOARD: true,
  FF_MACRO: true, FF_IPOS: true, FF_NEWS: true, FF_THEMES: true, FF_NAMESEARCH: true,
  FF_PORTFOLIO: true, FF_WATCHLIST: true,
  FF_STOCKDETAIL: true, FF_SCREENER: true, FF_FEARGREED: true,
  FF_RECAPS_DATA: false, FF_EPSHIST: false, FF_OPTIONS: false,
  FF_AI_WMN: false, FF_AI_RECAPS: false, FF_AI_STOCK: false, FF_AI_MISC: false,
  FF_ANALYST_EVENTS: false, FF_EARNINGS_DEPTH: false, FF_OPTIONS_FLOW: false, FF_ALERTS: false,
  FF_REAL_CALENDARS: true,
};

interface FlagState {
  flags: Record<FlagKey, boolean>;
  /** True once the live doc has been read at least once. */
  loaded: boolean;
}

const FlagContext = createContext<FlagState>({ flags: DEFAULTS, loaded: false });

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlagState>({ flags: DEFAULTS, loaded: false });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firebaseDb, "feature_flags", "default"),
      (snap) => {
        const live = (snap.data()?.flags ?? {}) as Record<string, unknown>;
        const merged = { ...DEFAULTS };
        for (const k of Object.keys(DEFAULTS) as FlagKey[]) {
          if (typeof live[k] === "boolean") merged[k] = live[k] as boolean;
        }
        setState({ flags: merged, loaded: true });
      },
      // Denied read or offline: keep code defaults, mark loaded so the app
      // renders rather than hanging on a perpetual "loading" state.
      () => setState({ flags: DEFAULTS, loaded: true }),
    );
    return () => unsub();
  }, []);

  return <FlagContext.Provider value={state}>{children}</FlagContext.Provider>;
}

/** True/false for one flag. Unknown/absent flags default per DEFAULTS. */
export function useFlag(key: FlagKey): boolean {
  return useContext(FlagContext).flags[key] ?? false;
}

/** The whole resolved map + load state, for admin/debug surfaces. */
export function useFlags(): FlagState {
  return useContext(FlagContext);
}

/**
 * Conditional render helper.
 *   <Gate flag="FF_OPTIONS"><OptionsScreen/></Gate>
 * Renders `fallback` (default: nothing) when the flag is off.
 */
export function Gate({
  flag, children, fallback = null,
}: {
  flag: FlagKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useFlag(flag) ? <>{children}</> : <>{fallback}</>;
}

/** Maps a screen slug → its release flag (mirror of menu-items `flag`). */
const SLUG_FLAG: Record<string, FlagKey | null> = {
  dashboard: "FF_DASHBOARD", earnings: null, movers: "FF_MOVERS",
  heatmap: "FF_HEATMAP", analyst: null, screener: "FF_SCREENER",
  themes: "FF_THEMES", ipos: "FF_IPOS", stock: "FF_STOCKDETAIL",
  options: null, insider: null, commentary: "FF_NEWS",
  recap: null, macro: "FF_MACRO", portfolio: "FF_PORTFOLIO",
  watchlist: "FF_WATCHLIST",
};

/**
 * Wraps a screen so that reaching it by URL while its flag is off shows a
 * "coming soon" placeholder instead of the screen. The nav already hides the
 * link; this covers direct navigation and bookmarks.
 */
export function ScreenGate({ slug, children }: { slug: string; children: ReactNode }) {
  const { flags, loaded } = useFlags();
  const flag = SLUG_FLAG[slug] ?? null;
  if (!flag) return <>{children}</>;
  // Hold render until the live doc is read, so an enabled screen never flashes
  // the placeholder on first paint before flags resolve.
  if (!loaded) return null;
  if (flags[flag]) return <>{children}</>;
  return (
    <div className="ff-comingsoon">
      <div className="ff-cs-badge">Coming soon</div>
      <h2>This screen isn&apos;t available yet</h2>
      <p>It&apos;s behind a release flag that hasn&apos;t been switched on.</p>
    </div>
  );
}
