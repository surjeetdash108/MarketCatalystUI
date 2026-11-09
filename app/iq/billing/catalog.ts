/**
 * Plan catalog as served by GET /plans (backend plans.registry is the single
 * source; nothing here hard-codes a price). Amounts are minor units.
 */
export type BillingInterval = "monthly" | "annual";
export const INTERVALS: BillingInterval[] = ["monthly", "annual"];

export interface CatalogPlan {
  id: string;
  name: string;
  description: string;
  currency: string;
  sortOrder: number;
  prices: Partial<Record<BillingInterval, { amount: number; lookupKey: string }>>;
  limits?: { watchlistTickers: number | null };
}

export function isPaid(plan: CatalogPlan | undefined): boolean {
  return !!plan && Object.keys(plan.prices ?? {}).length > 0;
}

export function formatMoney(amountMinor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

/** What the plan card shows as the headline price for an interval. */
export function displayPrice(plan: CatalogPlan, interval: BillingInterval): { perMonth: string; billed: string; savingPct: number | null } | null {
  const p = plan.prices?.[interval];
  if (!p) return null;
  if (interval === "monthly") return { perMonth: formatMoney(p.amount, plan.currency), billed: "Billed monthly", savingPct: null };
  const monthly = plan.prices?.monthly?.amount;
  const saving = monthly ? Math.round((1 - p.amount / (monthly * 12)) * 100) : null;
  return { perMonth: formatMoney(Math.round(p.amount / 12), plan.currency), billed: `Billed ${formatMoney(p.amount, plan.currency)}/year`, savingPct: saving };
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
