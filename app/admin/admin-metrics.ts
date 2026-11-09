/**
 * Pure helpers behind the admin console's numbers. Kept free of Firebase and
 * network imports so they are unit-tested directly.
 *
 * Rules:
 * - Status: anything that is not a known live/ended subscription is "free".
 *   The console used to read a missing status as "active", so every free user
 *   looked like a subscriber.
 * - MRR comes ONLY from successful payments (the `payments` collection the
 *   Stripe webhook writes), never from plan fields on the user document.
 * - Strings typed by users are HTML-escaped: the console renders rows with
 *   innerHTML, so a profile name could otherwise run script in the admin's
 *   session.
 */

export interface PaymentRow {
  userId: string | null;
  amount?: number;              // minor units
  currency?: string | null;
  paymentStatus?: string | null; // SUCCESS | FAILED | REFUNDED | ...
  paymentDate?: string | null;
  billingCycle?: string | null;  // monthly | annual | yearly
  subscriptionExpiryDate?: string | null;
}

export type ConsoleStatus = "active" | "trialing" | "past_due" | "canceled" | "free";

export function toConsoleStatus(status: string | null | undefined): ConsoleStatus {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE": return "active";
    case "TRIALING": return "trialing";
    case "PAST_DUE": return "past_due";
    case "CANCELLED":
    case "CANCELED":
    case "EXPIRED": return "canceled";
    default: return "free";
  }
}

function endOfPeriodMs(iso: string): number {
  return Date.parse(iso.length === 10 ? `${iso}T23:59:59Z` : iso);
}

/**
 * Monthly recurring revenue for one user, in major units: the latest
 * SUCCESS payment whose paid period still covers `now`, with annual payments
 * divided by 12. Zero when there is no such payment.
 */
export function mrrFromPayments(payments: PaymentRow[], uid: string, now: number = Date.now()): number {
  const live = payments
    .filter((p) => p.userId === uid && p.paymentStatus === "SUCCESS")
    .filter((p) => {
      if (!p.subscriptionExpiryDate) return false;
      const end = endOfPeriodMs(p.subscriptionExpiryDate);
      return Number.isFinite(end) && end >= now;
    })
    .sort((a, b) => String(b.paymentDate ?? "").localeCompare(String(a.paymentDate ?? "")));
  const latest = live[0];
  if (!latest) return 0;
  const major = (latest.amount ?? 0) / 100;
  const cycle = (latest.billingCycle ?? "").toLowerCase();
  const monthly = cycle === "annual" || cycle === "yearly" ? major / 12 : major;
  return Math.round(monthly * 100) / 100;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
