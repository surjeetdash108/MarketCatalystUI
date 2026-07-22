"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { firebaseDb, firebaseAuth } from "../firebase";
import { useFlags, type FlagKey } from "./feature-flags";

/**
 * Plan entitlements — the COMMERCIAL half of feature gating.
 *
 * The other half is `feature-flags.tsx`, which answers "is this built and
 * released?". This file answers "does this user's plan include it?". They are
 * deliberately separate contexts and are combined only in `useEntitlement`,
 * because the two produce different UI:
 *
 *   not released  → "Coming soon"        (nobody has it; do not sell it)
 *   not in plan   → "Upgrade to unlock"  (it exists; this tier cannot use it)
 *
 * Merging them into one boolean would make an unbuilt feature look like a
 * paywall, which is the failure mode this split exists to prevent.
 */

export interface EntitlementDef {
  key: string;
  label: string;
  /** One plain sentence: what the user gets when this is ON. */
  description: string;
  group: string;
  staffOnly?: boolean;
  unbuilt?: boolean;
}

/**
 * Mirrors ENTITLEMENTS in the backend's plans.registry.ts — keep them in sync.
 * The backend is the source of truth; this copy exists so the client can gate
 * without a round-trip it currently cannot make.
 */
export const ENTITLEMENTS: EntitlementDef[] = [
  { key: "marketCatalyst", label: "Market Dashboard", group: "Core",
    description: "See the main dashboard with market pulse, movers and heatmap." },
  { key: "news", label: "News & Commentary", group: "Core",
    description: "Read the live news feed and commentary screen." },
  { key: "scanner", label: "Market Movers", group: "Core",
    description: "See daily gainers, losers and unusual-volume lists." },
  { key: "heatmap", label: "Sector Heatmap", group: "Core",
    description: "View the sector and stock heatmap with day/week performance." },
  { key: "macro", label: "Macro & Calendars", group: "Core",
    description: "Access the economic calendar, VIX and dividend calendars." },
  { key: "ipos", label: "IPO Corner", group: "Core",
    description: "Browse upcoming and recent IPOs with offer prices." },
  { key: "chartsDaily", label: "Daily Charts", group: "Charting",
    description: "View 3-month, 6-month and 1-year price charts." },
  { key: "chartsIntraday", label: "Intraday Charts", group: "Charting",
    description: "View 1-day, 1-week and 1-month charts built from minute bars." },
  { key: "chartsHistory", label: "Long History (5Y)", group: "Charting",
    description: "View the full five-year price history on any chart." },
  { key: "chartIndicators", label: "Chart Indicators", group: "Charting",
    description: "Overlay moving averages, EMAs, volume and the RSI pane." },
  { key: "chartNotes", label: "Chart Notes", group: "Charting",
    description: "Save personal notes pinned to a chart." },
  { key: "technicalRatings", label: "Technical Ratings", group: "Research",
    description: "See the technical rating gauge, RSI, MACD and moving-average table." },
  { key: "fundamentalRatings", label: "Financial Statements", group: "Research",
    description: "See quarterly revenue, EPS, balance sheet and cash flow." },
  { key: "dividendHistory", label: "Dividend History", group: "Research",
    description: "See full dividend history, yield, growth rate and payment dates." },
  { key: "peers", label: "Peer Comparison", group: "Research",
    description: "See comparable companies and how the stock ranks against them." },
  { key: "ownership", label: "Insider & 13F", group: "Research",
    description: "See insider trades and institutional fund holdings." },
  { key: "earningsDetail", label: "Earnings Detail", group: "Research",
    description: "See EPS history, estimate-vs-actual and the earnings calendar." },
  { key: "watchlist", label: "Watchlist", group: "My Money",
    description: "Build and track a personal watchlist of stocks." },
  { key: "portfolio", label: "Portfolio Tracking", group: "My Money",
    description: "Track holdings with live prices and profit/loss." },
  { key: "screener", label: "Stock Screener", group: "My Money",
    description: "Filter the universe by growth, technical and liquidity criteria." },
  { key: "themes", label: "Sector Themes", group: "My Money",
    description: "Browse curated theme baskets such as Mag7 and AI & Semis." },
  { key: "alerts", label: "Price Alerts", group: "My Money",
    description: "Create alerts that fire when a price or signal condition is met.", unbuilt: true },
  { key: "optionsChain", label: "Options Chain", group: "Advanced",
    description: "View the options chain with strikes, expirations and traded prices." },
  { key: "exportData", label: "Data Export", group: "Advanced",
    description: "Download screens and recaps as PDF or CSV.", unbuilt: true },
  { key: "apiAccess", label: "API Access", group: "Advanced",
    description: "Call the market-data API from your own scripts with a key.", unbuilt: true },
  { key: "aiAssistant", label: "AI Assistant", group: "Advanced",
    description: "Ask the AI copilot questions and get generated summaries.", unbuilt: true },
  { key: "backtesting", label: "Backtesting", group: "Advanced",
    description: "Test a strategy against historical price data.", unbuilt: true },
  { key: "paperTrading", label: "Paper Trading", group: "Advanced",
    description: "Place simulated trades without real money.", unbuilt: true },
  { key: "adminDashboard", label: "Admin Console", group: "Staff",
    description: "Open the admin console with revenue and user analytics.", staffOnly: true },
  { key: "userManagement", label: "User Management", group: "Staff",
    description: "View and manage other users’ accounts and subscriptions.", staffOnly: true },
];

export const ENTITLEMENT_KEYS = ENTITLEMENTS.map(e => e.key);
export const ENTITLEMENT_BY_KEY = new Map(ENTITLEMENTS.map(e => [e.key, e]));

export type EntitlementKey = string;
/** Mirrors RELEASE_FLAG_FOR in the backend's plans.controller.ts. */
const RELEASE_FLAG_FOR: Record<string, FlagKey> = {
  marketCatalyst: "FF_DASHBOARD",
  news: "FF_NEWS",
  scanner: "FF_MOVERS",
  heatmap: "FF_HEATMAP",
  macro: "FF_MACRO",
  ipos: "FF_IPOS",
  chartsDaily: "FF_STOCKDETAIL",
  chartsIntraday: "FF_STOCKDETAIL",
  chartsHistory: "FF_STOCKDETAIL",
  chartIndicators: "FF_STOCKDETAIL",
  technicalRatings: "FF_STOCKDETAIL",
  fundamentalRatings: "FF_EPSHIST",
  earningsDetail: "FF_EPSHIST",
  watchlist: "FF_WATCHLIST",
  portfolio: "FF_PORTFOLIO",
  screener: "FF_SCREENER",
  themes: "FF_THEMES",
  alerts: "FF_ALERTS",
  optionsChain: "FF_OPTIONS",
  aiAssistant: "FF_AI_MISC",
};

/** Modules with no implementation yet — never presented as purchasable. */
const UNBUILT: EntitlementKey[] = ENTITLEMENTS.filter(e => e.unbuilt).map(e => e.key);

export type SubscriptionStatus =
  | "ACTIVE" | "EXPIRED" | "CANCELLED" | "PAST_DUE" | "TRIALING" | "NONE";

export interface PlanDoc {
  id: string;
  name: string;
  amount: number;      // MINOR units (cents) — see formatAmount()
  currency: string;
  billingCycle: "monthly" | "yearly" | "none";
  description: string;
  featureFlags: Partial<Record<EntitlementKey, boolean>>;
  active: boolean;
  sortOrder?: number;
}

interface EntitlementState {
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  expiryDate: string | null;
  /** Plan-granted entitlements, before the release-flag AND. */
  granted: Record<EntitlementKey, boolean>;
  loaded: boolean;
}

const DEFAULT_GRANTED = Object.fromEntries(
  ENTITLEMENT_KEYS.map(k => [k, false]),
) as Record<EntitlementKey, boolean>;

const EntitlementContext = createContext<EntitlementState>({
  planId: "free", planName: "Free", status: "NONE",
  expiryDate: null, granted: DEFAULT_GRANTED, loaded: false,
});

/** Whole days until an ISO date; negative once passed. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T23:59:59Z` : iso);
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EntitlementState>({
    planId: "free", planName: "Free", status: "NONE",
    expiryDate: null, granted: DEFAULT_GRANTED, loaded: false,
  });
  const [plans, setPlans] = useState<Record<string, PlanDoc>>({});
  const [uid, setUid] = useState<string | null>(firebaseAuth.currentUser?.uid ?? null);
  const [userDoc, setUserDoc] = useState<Record<string, unknown> | null>(null);

  useEffect(() => firebaseAuth.onAuthStateChanged(u => setUid(u?.uid ?? null)), []);

  // Plans are global and few; one listener keeps pricing and entitlements live
  // so a change in Firestore reaches users without a redeploy or a reload.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(firebaseDb, "plans"),
      snap => {
        const map: Record<string, PlanDoc> = {};
        snap.docs.forEach(d => { map[d.id] = { ...(d.data() as PlanDoc), id: d.id }; });
        setPlans(map);
      },
      () => setPlans({}),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setUserDoc(null);
      setState(s => ({ ...s, loaded: true }));
      return;
    }
    const unsub = onSnapshot(
      doc(firebaseDb, "users", uid),
      snap => setUserDoc(snap.data() ?? {}),
      () => setUserDoc({}),
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const u = userDoc ?? {};
    const stored = (u.subscriptionStatus as SubscriptionStatus) ?? "NONE";
    const expiry = (u.subscriptionExpiryDate as string) ?? null;
    const remaining = daysUntil(expiry);

    // Expiry is evaluated client-side too, not just trusted from the stored
    // status: nothing rewrites the document at the moment a subscription
    // lapses, so a stored ACTIVE would otherwise keep granting paid features
    // indefinitely. Mirrors SubscriptionsService.resolve() on the backend.
    const lapsed = remaining != null && remaining < 0
      && (stored === "ACTIVE" || stored === "TRIALING");
    const status: SubscriptionStatus = lapsed ? "EXPIRED" : stored;
    const live = status === "ACTIVE" || status === "TRIALING";

    // A lapsed or absent subscription falls back to FREE, never to nothing —
    // an expired customer keeps free-tier access rather than being locked out.
    const planId = live ? ((u.currentPlan as string) ?? "free") : "free";
    const plan = plans[planId] ?? plans.free;

    const overrides = (u.featureFlags ?? {}) as Partial<Record<EntitlementKey, boolean>>;
    const granted = Object.fromEntries(
      ENTITLEMENT_KEYS.map(k => [
        k,
        typeof overrides[k] === "boolean"
          ? overrides[k]
          : plan?.featureFlags?.[k] === true,
      ]),
    ) as Record<EntitlementKey, boolean>;

    setState({
      planId,
      planName: plan?.name ?? planId,
      status,
      expiryDate: expiry,
      granted,
      // Only "loaded" once plans have arrived; gating on an empty plan map
      // would briefly hide every paid feature from a paying user.
      loaded: Object.keys(plans).length > 0 || userDoc === null,
    });
  }, [userDoc, plans]);

  return (
    <EntitlementContext.Provider value={state}>{children}</EntitlementContext.Provider>
  );
}

export function useSubscription(): EntitlementState {
  return useContext(EntitlementContext);
}

export type EntitlementVerdict = {
  enabled: boolean;
  released: boolean;
  entitled: boolean;
  reason: "ok" | "not-released" | "not-in-plan" | "both" | "loading";
};

/**
 * The combined verdict for one module. `enabled` is the only field to gate
 * rendering on; `reason` picks the message when it is false.
 */
export function useEntitlement(key: EntitlementKey): EntitlementVerdict {
  const { flags, loaded: flagsLoaded } = useFlags();
  const { granted, loaded: entLoaded } = useSubscription();

  const flagKey = RELEASE_FLAG_FOR[key];
  const released = UNBUILT.includes(key) ? false : flagKey ? flags[flagKey] === true : true;
  const entitled = granted[key] === true;

  if (!flagsLoaded || !entLoaded) {
    return { enabled: false, released, entitled, reason: "loading" };
  }
  return {
    enabled: released && entitled,
    released,
    entitled,
    reason: released && entitled ? "ok"
      : !released && !entitled ? "both"
      : released ? "not-in-plan" : "not-released",
  };
}

/**
 * Conditional render for a paid module.
 *
 * Default fallback is nothing. Pass `upgrade` to render an upsell only when the
 * feature is genuinely gated by plan — it is deliberately NOT shown for an
 * unreleased feature, so the app never advertises something it cannot deliver.
 */
export function EntitlementGate({
  feature, children, fallback = null, upgrade = null, comingSoon = null,
}: {
  feature: EntitlementKey;
  children: ReactNode;
  fallback?: ReactNode;
  upgrade?: ReactNode;
  comingSoon?: ReactNode;
}) {
  const v = useEntitlement(feature);
  if (v.enabled) return <>{children}</>;
  if (v.reason === "loading") return <>{fallback}</>;
  if (v.reason === "not-in-plan") return <>{upgrade ?? fallback}</>;
  return <>{comingSoon ?? fallback}</>;
}

/** Formats a MINOR-unit amount (499900 → "₹4,999"). Mirrors the backend helper. */
export function formatAmount(minor: number, currency = "USD"): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency", currency,
      // Always 2dp, matching the backend helper. Trimming whole amounts to 0dp
      // rendered $30.00 and $29.99 at different widths in the same column.
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
