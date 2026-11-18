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
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { fetchPlans } from "./billing/api";
import { displayPrice, isPaid, type CatalogPlan } from "./billing/catalog";
import { ENTITLEMENTS } from "../admin/entitlement-catalog";
import {
  SCREEN_FEATURES,
  LOWEST_PLAN,
  FEATURE_GROUPS,
  FEATURE_GROUP_OF,
  PLANS,
} from "./feature-map.generated";
import { featureDecision, hiddenInTrial, useEntitlements, type Entitlements } from "./hooks/useEntitlements";

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
  const ended = trialEnded(ent);
  if (ended) return <TrialEndedCard entitlement={entitlement} ended={ended} variant={variant} />;
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
  // Alpha Signals is computed in the browser from shared feeds, so it fails
  // closed the same way.
  const failClosed = (key === "strategyLab" || key === "alphaSignals") && !state.data && state.error;
  if (key && hiddenInTrial(state.data, key)) return <TrialHidden variant={variant} />;
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

/**
 * A feature the free trial doesn't reveal (Alpha Signals), reached by its URL:
 * no feature details, only that it isn't part of the trial.
 */
function TrialHidden({ variant }: { variant: "screen" | "widget" }) {
  if (variant === "widget") return null;
  return (
    <div data-testid="trial-hidden" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 14, textAlign: "center", margin: "0 auto", maxWidth: 520 }}>
      <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-hi)" }}>Not part of the free trial</h2>
      <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".88rem", lineHeight: 1.5 }}>
        This screen opens once your plan&apos;s first payment goes through.
      </p>
      <Link
        href="/dashboard"
        style={{ padding: "11px 26px", borderRadius: 99, background: "var(--brand, #4ADE80)", color: "var(--on-brand, #07080A)", fontWeight: 700, fontSize: ".92rem", textDecoration: "none" }}
      >
        Back to the dashboard
      </Link>
    </div>
  );
}

/**
 * The person's 7 free days are over and nothing replaced them: no plan, no
 * intro, not staff. "trial" = never paid (the intro ran out); "plan" = a paid
 * plan that was cancelled or stopped paying. Null when they have something
 * (then a lock means "this needs a bigger plan", the usual panel).
 */
export function trialEnded(ent: Entitlements | null | undefined): "trial" | "plan" | null {
  if (!ent || !ent.subscriptionsEnabled || ent.staff) return null;
  if (ent.subscriptionPlanId || ent.inGrace) return null;
  if (ent.status === "INTRO" || ent.status === "ACTIVE" || ent.status === "TRIALING") return null;
  return ent.status === "CANCELLED" || ent.status === "PAST_DUE" ? "plan" : "trial";
}

/** "…to keep getting <this>." per screen; anything else: "…to keep using <label>." */
const KEEP_GETTING: Record<string, string> = {
  marketCatalyst: "the market pulse, movers and heatmap on your Dashboard",
  news: "real-time market news and commentary in the Live Feed",
  scanner: "the day's gainers, losers and unusual volume in Movers",
  heatmap: "sector and stock performance in the Heatmap",
  macro: "the economic, VIX and dividend Calendar",
  ipos: "upcoming and recent IPOs with their offer prices",
  earningsHub: "the earnings calendar and latest results in the Earnings Hub",
  recaps: "the daily and weekly market Recaps",
  watchlist: "live prices on your Watchlist",
  workspaces: "every Market Catalyst workspace",
  screener: "filtered stock lists in the Screener",
  ownership: "insider trades and 13F fund holdings",
  portfolio: "your Portfolio's live value and moves",
};

export function trialEndedLine(entitlement: string): string {
  const keep = KEEP_GETTING[entitlement];
  if (keep) return `Choose a plan to keep getting ${keep}.`;
  const label = ENTITLEMENTS.find((e) => e.key === entitlement)?.label;
  return label ? `Choose a plan to keep using ${label}.` : "Choose a plan to keep using Market Catalyst.";
}

/** "Starter from $31.20/mo, billed annually" from the live catalog (no hard-coded price). */
export function cheapestPlanLine(plans: CatalogPlan[]): string | null {
  const paid = plans.filter((p) => isPaid(p) && p.prices?.annual).sort((a, b) => (a.prices.annual?.amount ?? 0) - (b.prices.annual?.amount ?? 0));
  const p = paid[0];
  const price = p ? displayPrice(p, "annual") : null;
  return p && price ? `${p.name} from ${price.perMonth}/mo, billed annually` : null;
}

let planLineCache: string | null | undefined;
function usePlanLine(): string | null {
  const [line, setLine] = useState<string | null>(planLineCache ?? null);
  useEffect(() => {
    if (planLineCache !== undefined) return;
    let on = true;
    void fetchPlans()
      .then((r) => {
        planLineCache = cheapestPlanLine(r.plans);
        if (on) setLine(planLineCache);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return line;
}

function LockTile({ size }: { size: number }) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.25, background: "var(--brand-dim, rgba(74,222,128,.14))", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="var(--brand, #4ADE80)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="11" width="16" height="10" rx="2.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="16" r="1" fill="var(--brand, #4ADE80)" />
      </svg>
    </div>
  );
}

/**
 * What every locked Market Catalyst screen and widget shows once the free
 * trial is over and there's no plan: one card, one "Choose a plan" button.
 */
export function TrialEndedCard({
  entitlement,
  ended,
  variant = "screen",
  planLine,
}: {
  entitlement: string;
  ended: "trial" | "plan";
  variant?: "screen" | "widget";
  /** Test hook; normally read from the plan catalog. */
  planLine?: string | null;
}) {
  const live = usePlanLine();
  const priceLine = planLine !== undefined ? planLine : live;
  const widget = variant === "widget";
  const title = ended === "plan" ? "Your plan has ended" : "Your free trial has ended";
  const button = (
    <Link
      href="/choose-plan"
      data-testid="choose-plan-btn"
      style={{ display: "block", width: "100%", boxSizing: "border-box", padding: widget ? "9px 14px" : "14px 18px", borderRadius: 10, background: "var(--brand, #4ADE80)", color: "var(--on-brand, #07080A)", fontWeight: 700, fontSize: widget ? ".82rem" : "1rem", textAlign: "center", textDecoration: "none" }}
    >
      Choose a plan
    </Link>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: widget ? "10px 6px" : "64px 16px", width: "100%", boxSizing: "border-box" }}>
      <div
        data-testid="trial-ended"
        data-variant={variant}
        data-entitlement={entitlement}
        style={{ width: "100%", maxWidth: widget ? 320 : 420, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: widget ? 8 : 12, padding: widget ? "16px 14px" : "32px 34px 22px", borderRadius: widget ? 12 : 16, background: "var(--surface-2, rgba(255,255,255,.03))", border: "1px solid var(--border, rgba(255,255,255,.08))" }}
      >
        <LockTile size={widget ? 36 : 48} />
        <h2 data-testid="trial-ended-title" style={{ margin: widget ? "2px 0 0" : "6px 0 0", fontSize: widget ? ".98rem" : "1.35rem", fontWeight: 800, color: "var(--text-hi)" }}>{title}</h2>
        <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: widget ? ".78rem" : ".92rem", lineHeight: 1.5 }}>{trialEndedLine(entitlement)}</p>
        <div style={{ width: "100%", marginTop: widget ? 4 : 10 }}>{button}</div>
        <p data-testid="trial-ended-foot" style={{ margin: widget ? "2px 0 0" : "4px 0 0", color: "var(--text-dim-solid)", fontSize: widget ? ".68rem" : ".76rem" }}>
          {priceLine ? `${priceLine} · Cancel anytime` : "Cancel anytime"}
        </p>
      </div>
    </div>
  );
}
