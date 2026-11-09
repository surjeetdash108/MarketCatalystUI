/**
 * Screen slug (app/dashboard/menu-items.ts) → the plan entitlement that unlocks it.
 *
 * Keys must exist in the entitlement catalog (app/admin/entitlement-catalog.ts,
 * mirroring the backend's plans.registry.ts). MarketCatalystBackEnd's
 * entitlement-map.spec.ts parses this map and fails when a slug points at an
 * unknown, staff-only or unbuilt key, or when this file is missing.
 *
 * Not yet enforced: nothing renders a gate from this map until the entitlement
 * gate component and GET /api/me/entitlements land (milestone M1). A slug
 * absent here is available on every plan.
 */
import { ENTITLEMENTS } from "../admin/entitlement-catalog";

export const SLUG_ENTITLEMENT: Record<string, string> = {
  dashboard: "marketCatalyst",
  commentary: "news",
  movers: "scanner",
  heatmap: "heatmap",
  macro: "macro",
  ipos: "ipos",
  watchlist: "watchlist",
  screener: "screener",
  portfolio: "portfolio",
  earnings: "earningsDetail",
  insider: "ownership",
  options: "optionsChain",
};

const KNOWN_KEYS = new Set(ENTITLEMENTS.map((e) => e.key));

/**
 * The entitlement a screen needs, or null when it needs none. An unknown key
 * fails OPEN (null): denying a screen because of a typo here would paywall a
 * feature for every customer, including those who paid for it.
 */
export function entitlementForSlug(slug: string): string | null {
  const key = SLUG_ENTITLEMENT[slug];
  if (!key || !KNOWN_KEYS.has(key)) return null;
  return key;
}
