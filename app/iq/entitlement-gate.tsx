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
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ENTITLEMENTS } from "../admin/entitlement-catalog";
import {
  SCREEN_FEATURES,
  LOWEST_PLAN,
  FEATURE_GROUPS,
  FEATURE_GROUP_OF,
} from "./feature-map.generated";
import { featureDecision, useEntitlements } from "./hooks/useEntitlements";
import { ChoosePlanScreen } from "./billing/choose-plan-screen";

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

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

/**
 * The locked panel: what it is, which plan has it, and an Upgrade button.
 * `variant="widget"` is the compact form that fills a dashboard card body.
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
  const [gateInterval, setGateInterval] = useState<"monthly" | "annual">("annual");
  const def = ENTITLEMENTS.find((e) => e.key === entitlement);
  const planKey =
    requiredPlan ??
    (LOWEST_PLAN as Record<string, string>)[entitlement] ??
    null;
  const isMF = entitlement === "moneyFlow";
  const plan = isMF ? "Pro or Elite" : planKey ? PLAN_NAMES[planKey] ?? planKey : null;
  const groupName = groupForEntitlement(entitlement);
  const widget = variant === "widget";
  const badge = (
    <span
      style={{
        padding: "3px 12px",
        borderRadius: 99,
        fontSize: ".72rem",
        fontWeight: 700,
        background: "var(--brand-dim)",
        color: "var(--brand-2)",
        border: "1px solid var(--brand)",
      }}
    >
      {plan ? `Available on ${plan}` : "Not on your plan"}
    </span>
  );
  const featureTitle = def?.label ?? groupName ?? "this feature";
  const targetPlanName = isMF ? "Pro" : planKey ? PLAN_NAMES[planKey] ?? planKey : "Pro";
  const upgradeHeading = `Upgrade to ${targetPlanName} for ${featureTitle}`;

  const intervalToggle = !widget && (
    <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", borderRadius: 99, padding: 3, border: "1px solid rgba(255,255,255,0.12)", marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setGateInterval("monthly")}
        style={{
          padding: "4px 12px",
          borderRadius: 99,
          border: "none",
          fontSize: ".75rem",
          fontWeight: 700,
          cursor: "pointer",
          background: gateInterval === "monthly" ? "var(--brand, #22c55e)" : "transparent",
          color: gateInterval === "monthly" ? "#000" : "var(--text-dim-solid, #8a96a3)",
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => setGateInterval("annual")}
        style={{
          padding: "4px 12px",
          borderRadius: 99,
          border: "none",
          fontSize: ".75rem",
          fontWeight: 700,
          cursor: "pointer",
          background: gateInterval === "annual" ? "var(--brand, #22c55e)" : "transparent",
          color: gateInterval === "annual" ? "#000" : "var(--text-dim-solid, #8a96a3)",
        }}
      >
        Annual <span style={{ opacity: 0.8, fontSize: ".68rem" }}>· Save 20%</span>
      </button>
    </div>
  );

  const upgrade = isMF && !widget ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14, alignItems: "center" }}>
      {intervalToggle}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href={`/checkout?plan=pro&interval=${gateInterval}`}
          style={{
            padding: "10px 24px",
            borderRadius: 99,
            background: "var(--brand)",
            color: "#fff",
            fontWeight: 700,
            fontSize: ".88rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Upgrade to Pro ({gateInterval === "annual" ? "$566.40/yr" : "$59/mo"})
        </Link>
        <Link
          href={`/checkout?plan=elite&interval=${gateInterval}`}
          style={{
            padding: "10px 24px",
            borderRadius: 99,
            background: "var(--surface-2)",
            color: "var(--text-hi)",
            fontWeight: 700,
            fontSize: ".88rem",
            textDecoration: "none",
            border: "1px solid var(--border)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Upgrade to Elite ({gateInterval === "annual" ? "$1,791/yr" : "$199/mo"})
        </Link>
      </div>
      <Link
        href="/dashboard"
        style={{
          marginTop: 6,
          fontSize: ".82rem",
          color: "var(--text-dim-solid)",
          textDecoration: "none",
        }}
      >
        Maybe later
      </Link>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: widget ? 4 : 14, alignItems: "center" }}>
      {intervalToggle}
      <Link
        href={
          planKey
            ? `/checkout?plan=${planKey}&interval=${gateInterval}`
            : "/manage-plan"
        }
        style={{
          padding: widget ? "7px 18px" : "10px 24px",
          borderRadius: 99,
          background: "var(--brand)",
          color: "#fff",
          fontWeight: 700,
          fontSize: widget ? ".78rem" : ".88rem",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        Upgrade{planKey ? ` to ${PLAN_NAMES[planKey] ?? planKey}` : ""}
      </Link>
      {!widget && (
        <Link
          href="/dashboard"
          style={{
            marginTop: 6,
            fontSize: ".82rem",
            color: "var(--text-dim-solid)",
            textDecoration: "none",
          }}
        >
          Maybe later
        </Link>
      )}
    </div>
  );
  if (widget) {
    return (
      <div
        data-testid="locked-feature"
        data-variant="widget"
        data-entitlement={entitlement}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          textAlign: "center",
          padding: "18px 8px",
        }}
      >
        {badge}
        <p
          style={{
            margin: 0,
            color: "var(--text-dim-solid)",
            fontSize: ".8rem",
            lineHeight: 1.45,
          }}
        >
          {def?.description ?? (groupName ? `Part of ${groupName}.` : "")}
        </p>
        {upgrade}
      </div>
    );
  }
  return (
    <div
      className="card"
      data-testid="locked-feature"
      data-variant="screen"
      data-entitlement={entitlement}
      style={{ maxWidth: 560, margin: "48px auto", textAlign: "center" }}
    >
      <div
        className="card-b"
        style={{
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "2.4rem", marginBottom: 2 }} aria-hidden="true">🔒</div>
        {badge}
        <h2 style={{ margin: 0, color: "var(--text-hi)", fontSize: "1.25rem", fontWeight: 700 }}>
          {upgradeHeading}
        </h2>
        <span style={{ display: "none" }}>{def?.label ?? groupName}</span>
        {upgrade}
      </div>
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
  if (state.data?.subscriptionsEnabled && !state.data?.staff && state.data?.planId === "none") {
    if (variant === "widget") {
      return (
        <LockedFeature
          entitlement={key as string}
          requiredPlan="starter"
          variant="widget"
        />
      );
    }
    return <ChoosePlanScreen />;
  }
  const d = featureDecision(state, key);
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
