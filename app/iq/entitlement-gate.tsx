"use client";

import type { ReactNode } from "react";
import {
  useEntitlement, useSubscription, ENTITLEMENT_BY_KEY, type EntitlementKey,
} from "./entitlements";

/**
 * Screen slug → the plan entitlement that unlocks it.
 *
 * Separate from SLUG_FLAG in feature-flags.tsx, which maps a slug to its
 * RELEASE flag. A screen can be released to everyone and still be outside a
 * given tier — the two gates answer different questions and produce different
 * UI, so they are resolved independently and combined by useEntitlement().
 *
 * A slug absent here is not sold separately and is available on every plan.
 */
export const SLUG_ENTITLEMENT: Record<string, EntitlementKey> = {
  // Free tier
  dashboard: "marketCatalyst",
  commentary: "news",
  movers: "scanner", // the requirement's name for the movers/scanning surface
  heatmap: "heatmap",
  macro: "macro",
  ipos: "ipos",
  watchlist: "watchlist",
  // Stock Detail is Free — `chartsDaily` is in the Free grant. The deeper
  // capabilities inside it (intraday, 5Y, indicators) gate individually.
  stock: "chartsDaily",

  // Plus tier
  screener: "screener",
  themes: "themes",
  portfolio: "portfolio",
  earnings: "earningsDetail",
  "earnings-calendar": "earningsDetail",

  // Pro tier
  options: "optionsChain",
  insider: "ownership",

  // Intentionally unmapped (available on every plan): analyst, recap.
};

/**
 * Guards against a slug pointing at an entitlement that no longer exists.
 *
 * This bit us in production: `stock` and `options` still referenced
 * `advancedCharts` after it was split into finer keys, so the lookup returned
 * undefined and BOTH screens were denied to every user — including Pro. An
 * unknown key must fail OPEN, because the alternative is silently paywalling a
 * feature the customer has paid for, with no error anywhere to notice it by.
 */
function resolveKey(slug: string): EntitlementKey | null {
  const key = SLUG_ENTITLEMENT[slug];
  if (!key) return null;
  if (!ENTITLEMENT_BY_KEY.has(key)) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[entitlements] slug "${slug}" maps to unknown key "${key}" — ` +
          `allowing access. Fix SLUG_ENTITLEMENT in entitlement-gate.tsx.`,
      );
    }
    return null; // fail open
  }
  return key;
}

/**
 * Blocks a screen the user's plan does not include.
 *
 * Deliberately NOT a "coming soon" message: the feature exists and works, the
 * tier simply does not include it, so the honest thing to show is an upgrade
 * path. Rendering the same placeholder for both cases is what makes an unbuilt
 * feature look like a paywall and vice versa.
 */
export function PlanGate({ slug, children }: { slug: string; children: ReactNode }) {
  const key = resolveKey(slug);
  // The fallback key is only a placeholder to satisfy the hook's signature —
  // when `key` is null the verdict is discarded and the screen renders.
  const verdict = useEntitlement(key ?? ("marketCatalyst" as EntitlementKey));
  const { planName } = useSubscription();

  if (!key) return <>{children}</>;
  // Never flash the paywall while plans/subscription are still resolving.
  if (verdict.reason === "loading") return null;
  if (verdict.entitled) return <>{children}</>;

  return (
    <div className="ff-comingsoon">
      <div className="ff-cs-badge" style={{ background: "rgba(124,108,245,.16)", color: "var(--brand-2)" }}>
        Upgrade required
      </div>
      <h2>Not included in {planName}</h2>
      <p>
        This feature is available on a higher plan.{" "}
        <a href="/manage-plan" style={{ color: "var(--brand-2)" }}>Compare plans →</a>
      </p>
    </div>
  );
}

/** True when the user's plan includes the screen — used to hide nav entries. */
export function useSlugEntitled(slug: string): boolean {
  const key = resolveKey(slug);
  const verdict = useEntitlement(key ?? ("marketCatalyst" as EntitlementKey));
  // Unmapped screens are always available; while loading, keep the nav item
  // visible rather than letting the menu jump around on every page load.
  if (!key) return true;
  return verdict.reason === "loading" ? true : verdict.entitled;
}
