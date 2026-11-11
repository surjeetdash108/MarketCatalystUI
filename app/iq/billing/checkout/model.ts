import type { BillingInterval, CatalogPlan } from "../catalog";

/** Step 1 numbers for the Annual card: "$X/year", "$Y/month", "Save $Z compared with monthly". */
export function annualOffer(plan: CatalogPlan): { perYear: number; perMonth: number; saveVsMonthly: number } | null {
  const a = plan.prices?.annual?.amount;
  const m = plan.prices?.monthly?.amount;
  if (!a) return null;
  return { perYear: a, perMonth: Math.round(a / 12), saveVsMonthly: m ? m * 12 - a : 0 };
}

export interface BillingAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

/** Complete enough to send: US needs state + 5-digit ZIP (same rule as the backend). */
export function addressComplete(a: BillingAddress | null): boolean {
  if (!a) return false;
  if (!a.name.trim() || !a.line1.trim() || !a.city.trim() || !/^[A-Z]{2}$/.test(a.country)) return false;
  if (a.country === "US") return !!a.state && /^\d{5}(-\d{4})?$/.test(a.postalCode ?? "");
  return true;
}

export interface CompleteGate {
  consent: boolean;
  phoneE164: string | null;
  address: BillingAddress | null;
  paymentReady: boolean;
  busy: boolean;
}

/** "Complete purchase" is enabled only when the box is ticked and the form is valid. */
export function canComplete(g: CompleteGate): boolean {
  return g.consent && !!g.phoneE164 && addressComplete(g.address) && g.paymentReady && !g.busy;
}

/** Copy for the "Next payment" box. */
export function renewalLine(renewsAtIso: string, amount: string): string {
  const d = new Date(renewsAtIso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  return `Renews on ${d} at ${amount}`;
}

export function cadence(interval: BillingInterval): { word: string; unit: string } {
  return interval === "annual" ? { word: "annually", unit: "year" } : { word: "monthly", unit: "month" };
}

export function formatDuration(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return "0 Year 0 Month 1 Day";
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = (diffDays % 365) % 30;
  return `${years} Year ${months} Month ${days} Day${days === 1 ? "" : "s"}`;
}

/** Where X goes: the page the buyer came from (same site only), else the dashboard. */
export function exitPath(referrer: string | null | undefined, origin: string): string {
  try {
    if (!referrer) return "/dashboard";
    const u = new URL(referrer);
    if (u.origin !== origin || u.pathname.startsWith("/checkout") || u.pathname.startsWith("/auth") || u.pathname.startsWith("/verify-email")) return "/dashboard";
    return `${u.pathname}${u.search}`;
  } catch {
    return "/dashboard";
  }
}
