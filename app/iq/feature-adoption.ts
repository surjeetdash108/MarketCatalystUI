"use client";

import { doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseDb, firebaseAuth } from "../firebase";
import { menuItems } from "../dashboard/menu-items";

/**
 * Feature-adoption tracking: which parts of the product people actually open.
 *
 * One document per (feature, user) at `feature_adoption/{feature}__{uid}`, so a
 * per-user count and an aggregate are both one read away. Aggregating in the
 * document id rather than a subcollection keeps the admin roll-up to a single
 * collection scan.
 *
 * Counting rules that keep the numbers meaningful:
 *  - A repeat open within DEDUPE_MS is not counted. Without it, React strict
 *    mode double-invokes effects and every screen would log 2 opens, and a user
 *    toggling between two tabs would inflate both.
 *  - Failures are swallowed. Analytics must never break a screen it is
 *    measuring — a denied write or an offline client loses a data point, which
 *    is strictly better than an error boundary over the product.
 */

/** Repeat opens of the same feature inside this window count once. */
const DEDUPE_MS = 30_000;

/** Last recorded open per feature, this tab only. */
const lastLogged = new Map<string, number>();

/**
 * Every trackable surface.
 *
 * Two kinds of row, deliberately in one catalog:
 *
 *   SCREENS  — a route was opened. Derived from `menuItems` so the nav and this
 *              list cannot drift apart.
 *   ACTIONS  — something was actually USED inside a screen. These are the rows
 *              that answer "is this feature earning its keep": a user can open
 *              Stock Detail daily and never once open the financials drawer, and
 *              screen-level counts alone would hide that completely.
 *
 * `group` drives how the admin panel sections the list.
 */
export const TRACKED_FEATURES: Array<{ key: string; label: string; group: string }> = [
  // ── Screens (from the nav) ────────────────────────────────────────────────
  ...menuItems.map(m => ({ key: m.slug, label: m.label, group: m.group as string })),

  // ── Screens with no nav entry ─────────────────────────────────────────────
  { key: "earnings-calendar", label: "Earnings Calendar", group: "Intelligence" },
  { key: "settings", label: "Settings", group: "Account" },
  { key: "manage-plan", label: "Manage Plan", group: "Account" },
  { key: "profile", label: "Profile", group: "Account" },

  // ── Stock Detail: the drawers ─────────────────────────────────────────────
  { key: "stock.drawer.techrating", label: "Technical Rating drawer", group: "Stock Detail" },
  { key: "stock.drawer.peers", label: "Peers drawer", group: "Stock Detail" },
  { key: "stock.drawer.industry", label: "Industry Group drawer", group: "Stock Detail" },
  { key: "stock.drawer.insider", label: "Insider & Institutional drawer", group: "Stock Detail" },
  { key: "stock.drawer.keylevels", label: "Key Levels drawer", group: "Stock Detail" },
  { key: "stock.drawer.earnings", label: "Earnings History drawer", group: "Stock Detail" },
  { key: "stock.drawer.financials", label: "Financials drawer", group: "Stock Detail" },
  { key: "stock.drawer.dividend", label: "Dividend History drawer", group: "Stock Detail" },

  // ── Charting ──────────────────────────────────────────────────────────────
  { key: "chart.timeframe.intraday", label: "Chart · intraday (1D/1W/1M)", group: "Charting" },
  { key: "chart.timeframe.long", label: "Chart · long range (1Y/5Y)", group: "Charting" },
  { key: "chart.type", label: "Chart · type changed", group: "Charting" },
  { key: "chart.indicator.ma", label: "Chart · moving averages", group: "Charting" },
  { key: "chart.indicator.ema", label: "Chart · EMA", group: "Charting" },
  { key: "chart.indicator.rsi", label: "Chart · RSI pane", group: "Charting" },
  { key: "chart.indicator.volume", label: "Chart · volume", group: "Charting" },
  { key: "chart.indicator.earnings", label: "Chart · earnings markers", group: "Charting" },
  { key: "chart.expand", label: "Chart · expanded view", group: "Charting" },
  { key: "chart.note", label: "Chart · note added", group: "Charting" },

  // ── Portfolio & watchlist actions ─────────────────────────────────────────
  { key: "watchlist.add", label: "Watchlist · add symbol", group: "My Money" },
  { key: "watchlist.remove", label: "Watchlist · remove symbol", group: "My Money" },
  { key: "portfolio.add", label: "Portfolio · add holding", group: "My Money" },
  { key: "portfolio.import", label: "Portfolio · import from photo", group: "My Money" },

  // ── Discovery ─────────────────────────────────────────────────────────────
  { key: "search.ticker", label: "Ticker search", group: "Discovery" },
  { key: "screener.preset", label: "Screener · preset applied", group: "Discovery" },
  { key: "screener.save", label: "Screener · screen saved", group: "Discovery" },
  { key: "movers.tab", label: "Movers · tab switched", group: "Discovery" },
  { key: "heatmap.mode", label: "Heatmap · day/week toggle", group: "Discovery" },

  // ── Content ───────────────────────────────────────────────────────────────
  { key: "news.drawer", label: "News drawer", group: "Content" },
  { key: "news.tab", label: "Commentary · tab switched", group: "Content" },
  { key: "recap.export", label: "Recap · export", group: "Content" },
  { key: "earnings.call", label: "Earnings call drawer", group: "Content" },

  // ── Gated / not yet built ─────────────────────────────────────────────────
  { key: "ai-assistant", label: "AI Assistant", group: "AI" },
  { key: "alerts.create", label: "Alert created", group: "Alerts" },
  { key: "options.chain", label: "Options chain viewed", group: "Options" },
];

export const FEATURE_LABEL = new Map(TRACKED_FEATURES.map(f => [f.key, f.label]));
export const FEATURE_GROUP = new Map(TRACKED_FEATURES.map(f => [f.key, f.group]));

function docIdFor(feature: string, uid: string): string {
  return `${feature}__${uid}`;
}

/**
 * Records one open of `feature` by the signed-in user.
 *
 * Fire-and-forget: callers should not await it, and it never throws.
 */
export function trackFeatureOpen(feature: string): void {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid || !feature) return;

  const now = Date.now();
  const last = lastLogged.get(feature) ?? 0;
  if (now - last < DEDUPE_MS) return;
  lastLogged.set(feature, now);

  const ref = doc(firebaseDb, "feature_adoption", docIdFor(feature, uid));

  // set(merge) rather than update: the first open for a (feature, user) has no
  // document yet, and update() would fail on it. `increment` keeps concurrent
  // opens from clobbering each other.
  void (async () => {
    try {
      const exists = (await getDoc(ref)).exists();
      if (exists) {
        await setDoc(ref, {
          openCount: increment(1),
          lastOpened: new Date().toISOString(),
          lastOpenedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        // The create rule requires the full shape, so a first write cannot be a
        // bare increment.
        await setDoc(ref, {
          feature,
          userId: uid,
          openCount: 1,
          label: FEATURE_LABEL.get(feature) ?? feature,
          firstOpened: new Date().toISOString(),
          lastOpened: new Date().toISOString(),
          lastOpenedAt: serverTimestamp(),
        });
      }
    } catch {
      // Deliberately silent — see the docblock. A lost data point must not
      // surface as an error in the product being measured.
    }
  })();
}
