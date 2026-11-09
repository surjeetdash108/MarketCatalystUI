"use client";

/**
 * Screen slug (app/dashboard/menu-items.ts) → the plan entitlement that unlocks it.
 *
 * Keys must exist in the entitlement catalog (app/admin/entitlement-catalog.ts,
 * mirroring the backend's plans.registry.ts). MarketCatalystBackEnd's
 * entitlement-map.spec.ts parses this map and fails when a slug points at an
 * unknown, staff-only or unbuilt key, or when this file is missing.
 *
 * <EntitlementGate slug> renders the screen, or "Available on <plan>" with an
 * Upgrade button when the plan does not include it (decision f). It enforces
 * nothing by itself — the backend's EntitlementGuard does — and it is a no-op
 * while SUBSCRIPTIONS_ENABLED is off. A slug absent here is on every plan.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ENTITLEMENTS } from "../admin/entitlement-catalog";
import { gateDecisionFor, useEntitlements } from "./hooks/useEntitlements";

export const SLUG_ENTITLEMENT: Record<string, string> = {
  // Free
  dashboard: "marketCatalyst",
  commentary: "news",
  movers: "scanner",
  heatmap: "heatmap",
  macro: "macro",
  ipos: "ipos",
  watchlist: "watchlist",
  // Starter
  earnings: "earningsDetail",
  analyst: "workspaces",
  screener: "screener",
  insider: "ownership",
  "etf-corner": "workspaces",
  "ai-infrastructure": "workspaces",
  recap: "workspaces",
  portfolio: "portfolio",
  // Pro
  options: "optionsChain",
  "money-flow": "moneyFlow",
  // Elite
  sl: "strategyLab",
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

const PLAN_NAMES: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", elite: "Elite" };

/** The locked-screen panel: what it is, which plan has it, and an Upgrade button. */
export function LockedFeature({ entitlement, requiredPlan }: { entitlement: string; requiredPlan: string | null }) {
  const def = ENTITLEMENTS.find((e) => e.key === entitlement);
  const plan = requiredPlan ? PLAN_NAMES[requiredPlan] ?? requiredPlan : null;
  return (
    <div className="card" data-testid="locked-feature" style={{ maxWidth: 560, margin: "48px auto", textAlign: "center" }}>
      <div className="card-b" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <span style={{ padding: "3px 12px", borderRadius: 99, fontSize: ".72rem", fontWeight: 700, background: "var(--brand-dim)", color: "var(--brand-2)", border: "1px solid var(--brand)" }}>
          {plan ? `Available on ${plan}` : "Not on your plan"}
        </span>
        <h2 style={{ margin: 0, color: "var(--text-hi)", fontSize: "1.2rem" }}>{def?.label ?? "This feature"}</h2>
        <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".86rem", lineHeight: 1.5 }}>{def?.description}</p>
        <Link
          href={requiredPlan ? `/manage-plan?plan=${requiredPlan}&interval=annual` : "/manage-plan"}
          style={{ marginTop: 6, padding: "9px 22px", borderRadius: 99, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: ".84rem", textDecoration: "none" }}
        >
          Upgrade{plan ? ` to ${plan}` : ""}
        </Link>
      </div>
    </div>
  );
}

/** Renders `children` if the user's plan includes the screen; otherwise the locked panel. */
export function EntitlementGate({ slug, children }: { slug: string; children: ReactNode }) {
  const key = entitlementForSlug(slug);
  const { data } = useEntitlements();
  const d = gateDecisionFor(data, key);
  if (d.kind === "allow") return <>{children}</>;
  if (d.kind === "loading") return null;
  if (d.kind === "hidden") return null;
  return <LockedFeature entitlement={key as string} requiredPlan={d.requiredPlan} />;
}
