"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useEntitlements, type Entitlements } from "../hooks/useEntitlements";
import { fetchPlans } from "./api";
import type { CatalogPlan } from "./catalog";
import { checkoutPath, loadIntent, type PlanIntent } from "./plan-intent";

/**
 * Paid plans unavailable (flag off, or no provider) and the visitor came from a
 * website plan tile: "<Plan> is launching soon. You're on Free until then."
 * The intent is kept, so the link goes to that plan's checkout once it opens.
 * Staff are unaffected.
 */
export function launchingSoonBanner(intent: PlanIntent | null, plans: CatalogPlan[], ent: Pick<Entitlements, "paidPlansAvailable" | "staff"> | null): { text: string; href: string } | null {
  if (!intent || !ent || ent.staff || ent.paidPlansAvailable) return null;
  const plan = plans.find((p) => p.id === intent.planId);
  if (!plan) return null;
  return { text: `${plan.name} is launching soon. You're on Free until then.`, href: checkoutPath(intent) };
}

export function LaunchingSoonBanner() {
  const { data: ent } = useEntitlements();
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  useEffect(() => {
    void fetchPlans().then((r) => setPlans(r.plans)).catch(() => setPlans([]));
  }, []);
  const banner = launchingSoonBanner(plans.length ? loadIntent(plans.map((p) => p.id)) : null, plans, ent);
  if (!banner) return null;
  return (
    <div data-testid="launching-soon-banner" role="status" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", margin: "0 0 12px", borderRadius: 10, border: "1px solid var(--brand)", background: "var(--brand-dim)", color: "var(--text-hi)", fontSize: ".86rem" }}>
      <span style={{ flex: 1 }}>{banner.text}</span>
      <Link href={banner.href} style={{ color: "var(--brand-2)", fontWeight: 700 }}>See the plan</Link>
    </div>
  );
}
