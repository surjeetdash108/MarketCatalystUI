"use client";

/**
 * Screen slug (app/dashboard/menu-items.ts) → the plan entitlement that unlocks it.
 *
 * Sourced from the generated feature map (app/iq/feature-map.generated.ts,
 * mirroring the backend's plans.registry.ts). MarketCatalystBackEnd's
 * entitlement-map.spec.ts verifies consistency.
 *
 * <EntitlementGate slug> renders the screen, or "Available on <plan>" with an
 * Upgrade button when the plan does not include it. It enforces nothing by
 * itself — the backend's EntitlementGuard does — and it is a no-op while
 * SUBSCRIPTIONS_ENABLED is off. A slug absent here is on every plan.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ENTITLEMENTS } from "../admin/entitlement-catalog";
import {
  SCREEN_FEATURES,
  LOWEST_PLAN,
  FEATURE_GROUPS,
  FEATURE_GROUP_OF,
  PLANS,
} from "./feature-map.generated";
import { featureDecision, useEntitlements } from "./hooks/useEntitlements";

const KNOWN_KEYS = new Set(ENTITLEMENTS.map((e) => e.key));

/**
 * The entitlement a screen needs, or null when it needs none. An unknown key
 * fails OPEN (null): denying a screen because of a typo here would paywall a
 * feature for every customer, including those who paid for it.
 */
export function entitlementForSlug(slug: string): string | null {
  const key = (SCREEN_FEATURES as Record<string, string>)[slug];
  if (!key || !KNOWN_KEYS.has(key)) return null;
  return key;
}

export function groupForEntitlement(entitlement: string): string | null {
  const groupId = (FEATURE_GROUP_OF as Record<string, string>)[entitlement];
  if (!groupId) return null;
  const group = FEATURE_GROUPS.find((g) => g.id === groupId);
  return group?.name ?? null;
}

const PLAN_NAMES: Record<string, string> = Object.fromEntries(PLANS.map((p) => [p.id, p.name]));

/** Where every lock leads: the plans page, with the plan that unlocks it highlighted. */
export function plansHref(requiredPlan: string | null): string {
  return requiredPlan ? `/choose-plan?plan=${encodeURIComponent(requiredPlan)}` : "/choose-plan";
}

/**
 * The locked panel, the same everywhere: what the feature is, which plan has
 * it, and one button — "See the plans" (the plans page offers the free trial).
 * `variant="widget"` is the compact form that fills a dashboard card body.
 * It renders no data and makes no API call.
 */
export function LockedFeature({
  entitlement,
  requiredPlan,
  variant = "screen",
}: {
  entitlement: string;
  requiredPlan: string | null;
  variant?: "screen" | "widget";
}) {
  const { data: ent } = useEntitlements();
  const def = ENTITLEMENTS.find((e) => e.key === entitlement);
  const planKey = requiredPlan ?? (LOWEST_PLAN as Record<string, string | null>)[entitlement] ?? null;
  const planName = planKey ? (PLAN_NAMES[planKey] ?? planKey) : null;
  const groupName = groupForEntitlement(entitlement);
  const featureTitle = def?.label ?? groupName ?? "This feature";
  const widget = variant === "widget";
  const trialDays = ent?.trialDays ?? 0;
  const badge = (
    <span data-testid="locked-badge" style={{ padding: "3px 12px", borderRadius: 99, fontSize: ".72rem", fontWeight: 700, background: "var(--brand-dim)", color: "var(--brand-2)", border: "1px solid var(--brand)" }}>
      {planName ? `Available on ${planName}${planKey === "elite" ? "" : " and up"}` : "Not on your plan"}
    </span>
  );
  const cta = (
    <Link
      href={plansHref(planKey)}
      data-testid="see-plans-btn"
      style={{ padding: widget ? "7px 18px" : "11px 26px", borderRadius: 99, background: "var(--brand, #4ADE80)", color: "var(--on-brand, #07080A)", fontWeight: 700, fontSize: widget ? ".78rem" : ".92rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      See the plans
    </Link>
  );
  if (widget) {
    return (
      <div data-testid="locked-feature" data-variant="widget" data-entitlement={entitlement} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center", padding: "18px 8px" }}>
        <span aria-hidden="true">🔒</span>
        {badge}
        <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".8rem", lineHeight: 1.45 }}>{def?.description ?? (groupName ? `Part of ${groupName}.` : "")}</p>
        {cta}
      </div>
    );
  }
  return (
    <div data-testid="locked-feature" data-variant="screen" data-entitlement={entitlement} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 14, textAlign: "center", margin: "0 auto", maxWidth: 520 }}>
      <div style={{ fontSize: "2.6rem", lineHeight: 1 }} aria-hidden="true">🔒</div>
      <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-hi)" }} data-testid="locked-title">
        {groupName && groupName !== featureTitle ? `${featureTitle} is part of ${groupName}` : featureTitle}
      </h2>
      {badge}
      <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".88rem", lineHeight: 1.5 }}>
        {def?.description ?? ""}
        {trialDays > 0 ? ` Every plan starts with a ${trialDays}-day free trial.` : ""}
      </p>
      {cta}
    </div>
  );
}

/**
 * Renders `children` if the user's plan includes the screen (`slug`) or the
 * entitlement (`entitlement`); otherwise the locked panel.
 */
export function EntitlementGate({
  slug,
  entitlement,
  variant = "screen",
  children,
}: {
  slug?: string;
  entitlement?: string;
  variant?: "screen" | "widget";
  children: ReactNode;
}) {
  const key = entitlement ?? (slug ? entitlementForSlug(slug) : null);
  const state = useEntitlements();
  // Strategy Lab runs its backtests in the browser, so the backend can't stop
  // it once the screen is open: if the plan couldn't be loaded it stays
  // locked (fail closed) instead of opening (every other screen fails open).
  const failClosed = key === "strategyLab" && !state.data && state.error;
  const d = failClosed
    ? ({ kind: "locked", requiredPlan: "elite" } as const)
    : featureDecision(state, key);
  if (d.kind === "allow") return <>{children}</>;
  if (d.kind === "loading") return null;
  if (d.kind === "hidden") return null;
  return (
    <LockedFeature
      entitlement={key as string}
      requiredPlan={d.requiredPlan}
      variant={variant}
    />
  );
}
