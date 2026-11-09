import { apiGet, apiPost, BackendApiError } from "../backend";
import type { BillingInterval, CatalogPlan } from "./catalog";

/** Typed client for /plans, /api/billing/* and /api/me/entitlements. */

export interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
  reason?: string;
  amountDue?: number;
  requiredPlan?: string;
}

/** The structured body of a backend error, when there is one. */
export function errorBody(err: unknown): ApiErrorBody & { status: number } {
  if (err instanceof BackendApiError) {
    try {
      return { status: err.status, ...(JSON.parse(err.message) as ApiErrorBody) };
    } catch {
      return { status: err.status, message: err.message };
    }
  }
  return { status: 0, message: err instanceof Error ? err.message : String(err) };
}

export interface PlansResponse { plans: CatalogPlan[]; paidPlansAvailable: boolean }
export const fetchPlans = () =>
  apiGet<PlansResponse>("/plans").then((r) => ({ plans: [...r.plans].sort((a, b) => a.sortOrder - b.sortOrder), paidPlansAvailable: r.paidPlansAvailable === true }));

export interface CheckoutResponse { sessionId: string; url: string; amountDueToday: number; currency: string }
export const startCheckout = (body: { planId: string; interval: BillingInterval; promoCode?: string }) => apiPost<CheckoutResponse>("/api/billing/checkout", body);
export const checkoutStatus = (id: string) => apiGet<{ status: string; planId: string; active: boolean; currentPlan: string }>(`/api/billing/checkout/${encodeURIComponent(id)}`);

export interface PromoPreview { code: string; amount: number; discountAmount: number; amountDueToday: number; description: string; currency: string }
export const previewPromo = (body: { code: string; planId: string; interval: BillingInterval }) => apiPost<PromoPreview>("/api/billing/promo/preview", body);

export interface ChangePreview {
  kind: "upgrade" | "downgrade";
  planId: string;
  interval: BillingInterval;
  currency: string;
  amountDueNow: number;
  prorationDate: number;
  effectiveAt: string;
  nextRenewalAmount: number;
  nextRenewalDate: string;
  fromPlanId: string;
  fromInterval: BillingInterval;
  cancelsPendingDowngrade: boolean;
  resumesCancelledPlan: boolean;
}
export const previewChange = (body: { planId: string; interval: BillingInterval }) => apiPost<ChangePreview>("/api/billing/change/preview", body);
export type ChangeResult =
  | { kind: string; status: "applied"; amountCharged: number }
  | { kind: string; status: "scheduled"; effectiveAt: string }
  | { kind: string; status: "requires_action"; actionId: string; amountDue: number };
export const applyChange = (body: { planId: string; interval: BillingInterval; expectedAmountDue?: number; prorationDate?: number }) => apiPost<ChangeResult>("/api/billing/change", body);
export const keepCurrentPlan = () => apiPost<{ kept: boolean }>("/api/billing/change/keep");
export const cancelPlan = () => apiPost<{ endsAt: string }>("/api/billing/cancel");
export const resumePlan = () => apiPost<{ renewsAt: string }>("/api/billing/resume");

export interface RetentionOffer { mode: string; percentOff: number; months: number; interval: BillingInterval; creditAmount: number | null; currency: string; appliesFrom: string; headline: string; description: string }
export const retentionOffer = () => apiGet<{ eligible: true; offer: RetentionOffer } | { eligible: false; reason: string }>("/api/billing/retention");
export const acceptRetention = () => apiPost<{ applied: true; description: string; appliesFrom: string }>("/api/billing/retention/accept");

export interface BillingSummary {
  subscriptionsLive: boolean;
  paidPlansAvailable: boolean;
  provider: string;
  planId: string;
  planName: string;
  status: string;
  interval: BillingInterval | null;
  source: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  renewsAt: string | null;
  endsAt: string | null;
  inGrace: boolean;
  graceEndsAt: string | null;
  scheduledChange: { planId: string; interval: BillingInterval; effectiveAt: string } | null;
  discount: { source: string | null; code: string | null; description: string; endsAt: string | null } | null;
  nextCharge: { amount: number; currency: string; date: string; discountAmount: number; creditApplied: number } | null;
  hasBillingAccount: boolean;
}
export const billingSummary = () => apiGet<BillingSummary>("/api/billing/summary");

export interface InvoiceRow { id: string; number: string; date: string; planName: string; interval: string; amount: number; currency: string; discountAmount: number; creditApplied: number; amountRefunded: number; status: string; reason: string | null; documentPath: string }
export const listInvoices = () => apiGet<{ invoices: InvoiceRow[] }>("/api/billing/invoices").then((r) => r.invoices);
export interface HistoryRow { type: string; from: unknown; to: unknown; at: string }
export const listHistory = () => apiGet<{ history: HistoryRow[] }>("/api/billing/history").then((r) => r.history);
export const openPortal = () => apiPost<{ url: string }>("/api/billing/portal");

// ── account: email verification + staff claim ───────────────────────────────
export const emailVerificationStatus = () => apiGet<{ email: string | null; verified: boolean }>("/api/account/email-verification");
export const sendEmailCode = () => apiPost<{ sent?: true; alreadyVerified?: true; expiresInSeconds?: number; resendInSeconds?: number }>("/api/account/email-verification/send");
export const verifyEmailCode = (code: string) => apiPost<{ verified: true }>("/api/account/email-verification/verify", { code });
export const syncClaims = () => apiPost<{ staff: boolean; refreshToken: boolean }>("/api/account/sync-claims");
