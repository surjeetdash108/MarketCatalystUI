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

export interface CheckoutResponse { sessionId: string; url: string; amountDueToday: number; tax: number; currency: string; payment: { provider: string; clientSecret?: string | null } }
export interface CheckoutBody {
  planId: string;
  interval: BillingInterval;
  promoCode?: string;
  consent: { accepted: boolean; version: string };
  phone?: string;
  marketingOptIn: boolean;
  billing: { name: string; address: { line1: string; line2: string | null; city: string; state: string | null; postalCode: string | null; country: string } };
}
export const startCheckout = (body: CheckoutBody) => apiPost<CheckoutResponse>("/api/billing/checkout", body);

export interface CheckoutPreview {
  planId: string;
  interval: BillingInterval;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  taxLabel: string | null;
  taxPending: boolean;
  promo: { code: string; description: string } | null;
  renewsAt: string;
  renewalAmount: number;
  consent: { version: string; text: string };
  refundPolicy: { enabled: boolean; windowDays: number; checkoutLine: string };
  /** Free trial for this buyer, or null (already used / has paid before). */
  trial?: { days: number; endsAt: string } | null;
  /** Charged today: 0 during a trial, else total. */
  dueToday?: number;
  /** The first real charge (incl. tax) and when — the trial end, or today. */
  firstCharge?: { amount: number; at: string };
}
export const previewCheckout = (body: { planId: string; interval: BillingInterval; promoCode?: string; region?: { country: string; state?: string | null; postalCode?: string | null } }) =>
  apiPost<CheckoutPreview>("/api/billing/checkout/preview", body);

/** Fake provider only (TEST MODE): the simulated payment form confirms through these. */
export type FakeCompletion = { status: "complete"; subscriptionId: string; redirectUrl: string } | { status: "requires_action"; actionId: string } | { status: "failed"; code: string };
export const fakeCompleteCheckout = (sessionId: string, card: string) => apiPost<FakeCompletion>(`/api/billing/fake/checkout/${encodeURIComponent(sessionId)}/complete`, { card });
export const fakeConfirmAction = (actionId: string, approve: boolean) => apiPost<FakeCompletion>(`/api/billing/fake/actions/${encodeURIComponent(actionId)}`, { approve });

export interface Contact { phone: string | null; marketingOptIn: { optedIn: boolean; at: string | null } }
export const getContact = () => apiGet<Contact>("/api/billing/contact");
export const updateContact = (body: { phone?: string; marketingOptIn?: boolean }) => apiPost<Contact>("/api/billing/contact", body);

export type RefundEligibility =
  | { eligible: true; kind: "first_payment" | "annual_renewal"; paymentId: string; amount: number; currency: string; refundableUntil: string; windowDays: number }
  | { eligible: false; reason: string; windowDays: number };
export const refundEligibility = () => apiGet<RefundEligibility>("/api/billing/refund");
export const requestRefund = () => apiPost<{ refunded: true; amount: number; currency: string }>("/api/billing/refund");
export const checkoutStatus = (id: string) => apiGet<{ status: string; planId: string; active: boolean; currentPlan: string }>(`/api/billing/checkout/${encodeURIComponent(id)}`);

export interface PromoPreview { code: string; amount: number; discountAmount: number; amountDueToday: number; description: string; currency: string }
export const previewPromo = (body: { code: string; planId: string; interval: BillingInterval }) => apiPost<PromoPreview>("/api/billing/promo/preview", body);

export interface SignupPromoResponse {
  valid: true;
  code: string;
  amount: number;
  discountAmount: number;
  amountDueToday: number;
}
export const checkSignupPromo = (body: { code: string; planId: string; interval: BillingInterval }) =>
  apiPost<SignupPromoResponse>("/api/billing/signup/promo", body);

export interface ChangeBreakdown {
  fromPlanName: string;
  toPlanName: string;
  periodStart: string;
  today: string;
  periodEnd: string;
  usedOnCurrent: number;
  newPlanCharge: number;
  alreadyPaid: number;
  net: number;
  chargedNow: number;
  creditToBalance: number;
}

export interface ChangePreview {
  kind: "upgrade" | "downgrade" | "scheduled";
  planId: string;
  interval: BillingInterval;
  currency: string;
  amountDueNow: number;
  creditToBalance: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  breakdown: ChangeBreakdown | null;
  creditBalanceAfter: number;
  nextInvoiceAfterCredit: number;
  prorationDate: number;
  effectiveAt: string;
  nextRenewalAmount: number;
  nextRenewalDate: string;
  fromPlanId: string;
  fromInterval: BillingInterval;
  cancelsPendingDowngrade: boolean;
  resumesCancelledPlan: boolean;
  keepsCancelDate?: boolean;
}
export const previewChange = (body: { planId: string; interval: BillingInterval }) => apiPost<ChangePreview>("/api/billing/change/preview", body);
export type ChangeResult =
  | { kind: string; status: "applied"; amountCharged: number; creditToBalance?: number }
  | { kind: string; status: "scheduled"; effectiveAt: string }
  | { kind: string; status: "requires_action"; actionId: string; amountDue: number; clientSecret?: string | null };
export const applyChange = (body: { planId: string; interval: BillingInterval; expectedAmountDue?: number; expectedCredit?: number; prorationDate?: number; paymentMethodId?: string }) => apiPost<ChangeResult>("/api/billing/change", body);
export const keepCurrentPlan = () => apiPost<{ kept: boolean }>("/api/billing/change/keep");
export const cancelPlan = () => apiPost<{ endsAt: string }>("/api/billing/cancel");
export const resumePlan = () => apiPost<{ renewsAt: string }>("/api/billing/resume");

export interface RetentionOffer { mode: string; percentOff: number; months: number; interval: BillingInterval; creditAmount: number | null; currency: string; appliesFrom: string; headline: string; description: string }
export const retentionOffer = () => apiGet<{ eligible: true; offer: RetentionOffer } | { eligible: false; reason: string }>("/api/billing/retention");
export const acceptRetention = () => apiPost<{ applied: true; description: string; appliesFrom: string }>("/api/billing/retention/accept");

export interface BillingSummary {
  subscriptionsLive: boolean;
  paidPlansAvailable: boolean;
  /** Staff checkout preview (Stripe test mode, no real charges). */
  checkoutPreview?: boolean;
  provider: string;
  planId: string;
  planName: string;
  status: string;
  interval: BillingInterval | null;
  source: string | null;
  /** Account credit used automatically on next invoices. Minor units. */
  creditBalance: number;
  currentPeriodStart: string | null;
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

export interface InvoiceLine {
  description: string;
  amount: number;
  proration: boolean;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  planName: string;
  interval: string;
  amount: number;
  currency: string;
  discountAmount: number;
  creditApplied: number;
  amountRefunded: number;
  lines?: InvoiceLine[] | null;
  status: string;
  reason: string | null;
  documentPath: string;
}
export const listInvoices = () => apiGet<{ invoices: InvoiceRow[] }>("/api/billing/invoices").then((r) => r.invoices);
export interface HistoryRow { type: string; from: unknown; to: unknown; at: string }
/** One line of the plan history timeline (server-formatted, exact timestamp). */
export interface TimelineEntry {
  at: string;
  kind: "plan" | "payment" | "credit" | "refund" | "trial" | "cancel" | "discount" | "status";
  type: string;
  title: string;
  detail: string | null;
  amount: number | null;
  currency: string | null;
  planId: string | null;
  invoiceId: string | null;
}
export const listTimeline = () => apiGet<{ entries: TimelineEntry[] }>("/api/billing/timeline").then((r) => r.entries);
export const listHistory = () => apiGet<{ history: HistoryRow[] }>("/api/billing/history").then((r) => r.history);
export const openPortal = () => apiPost<{ url: string }>("/api/billing/portal");

// ── account: email verification + staff claim ───────────────────────────────
export const emailVerificationStatus = () => apiGet<{ email: string | null; verified: boolean }>("/api/account/email-verification");
export const sendEmailCode = () => apiPost<{ sent?: true; alreadyVerified?: true; expiresInSeconds?: number; resendInSeconds?: number }>("/api/account/email-verification/send");
export const verifyEmailCode = (code: string) => apiPost<{ verified: true }>("/api/account/email-verification/verify", { code });
export const syncClaims = () => apiPost<{ staff: boolean; refreshToken: boolean }>("/api/account/sync-claims");
