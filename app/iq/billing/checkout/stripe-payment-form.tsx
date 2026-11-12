"use client";

import { AddressElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef } from "react";
import { firebaseAuth } from "../../../firebase";
import { Notice } from "../ui";
import { labelStyle } from "./address-fields";
import { addressComplete, type BillingAddress } from "./model";
import type { PaymentAdapter, PaymentFormProps, PaymentResult } from "./payment-form";

/**
 * Stripe adapter — Payment Element + Address Element in "deferred intent" mode:
 * the buyer fills both before anything exists at Stripe; on Complete purchase
 * the page calls prepare() (elements.submit() validates), the backend creates
 * the subscription and returns the first invoice's confirmation secret, and
 * confirm() runs stripe.confirmPayment (Stripe shows 3-D Secure and reports
 * declines; the buyer stays on the page).
 *
 * Payment methods come from the Stripe account, limited to
 * NEXT_PUBLIC_STRIPE_PAYMENT_METHOD_TYPES (default "card"; never Link; Apple Pay /
 * Google Pay appear under card once the domain is verified). Must match the
 * backend's STRIPE_PAYMENT_METHOD_TYPES. Never crypto or UPI.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const ALLOWED = new Set(["card", "paypal", "cashapp", "amazon_pay"]); // never Link (asks for a phone)

export function stripePaymentMethodTypes(raw: string | undefined): string[] {
  const types = String(raw ?? "card")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ALLOWED.has(s));
  return types.length ? types : ["card"];
}
const METHOD_TYPES = stripePaymentMethodTypes(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_METHOD_TYPES);

/**
 * A usable publishable key. Live keys (pk_live_) also need
 * NEXT_PUBLIC_STRIPE_LIVE_APPROVED=true — until then only test mode runs (the
 * staff checkout preview), matching the backend's STRIPE_LIVE_APPROVED.
 */
export function stripeConfigured(
  key: string = PUBLISHABLE_KEY,
  liveApproved: boolean = process.env.NEXT_PUBLIC_STRIPE_LIVE_APPROVED === "true",
): boolean {
  if (!/^pk_(test|live)_/.test(key) || key.includes("PLACEHOLDER")) return false;
  return key.startsWith("pk_test_") || liveApproved;
}

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(PUBLISHABLE_KEY));

/** Handles live between the mounted Elements and the adapter's prepare/confirm. */
const live: {
  stripe: Stripe | null;
  elements: StripeElements | null;
  address: BillingAddress | null;
  email: string | null;
} = { stripe: null, elements: null, address: null, email: null };

export function setStripeCheckoutContext(ctx: { address?: BillingAddress | null; email?: string | null }) {
  if (ctx.address !== undefined) live.address = ctx.address;
  if (ctx.email) live.email = ctx.email;
}

/** Maps the Address Element value to our address shape. */
export function addressFromStripe(v: { name?: string; address?: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null } }): BillingAddress {
  const a = v.address ?? {};
  return {
    name: v.name ?? "",
    line1: a.line1 ?? "",
    line2: a.line2 || null,
    city: a.city ?? "",
    state: a.state || null,
    postalCode: a.postal_code || null,
    country: a.country ?? "US",
  };
}

function Inner({ onChange }: Pick<PaymentFormProps, "onChange">) {
  const stripe = useStripe();
  const elements = useElements();
  const state = useRef<{ ready: boolean; address: BillingAddress | null; addressDone: boolean }>({ ready: false, address: null, addressDone: false });
  useEffect(() => {
    live.stripe = stripe;
    live.elements = elements;
  }, [stripe, elements]);
  const emit = () => {
    live.address = state.current.address;
    onChange({ ready: state.current.ready && (state.current.addressDone || addressComplete(state.current.address)), address: state.current.address });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-testid="payment-element">
        <PaymentElement
          options={{
            layout: "tabs",
            // No Stripe Link: no "Save my information for faster checkout" box
            // (it also asks for a mobile number). Card only.
            wallets: { applePay: "auto", googlePay: "auto", link: "never" },
            fields: { billingDetails: { name: "never", email: "never", phone: "never", address: "never" } },
            // Our own renewal consent (checkbox + text in the summary) is the authorisation;
            // hide Stripe's duplicate "By subscribing, you authorize … to charge you" line.
            terms: { card: "never" },
          }}
          onChange={(e) => {
            state.current.ready = e.complete;
            emit();
          }}
        />
      </div>
      <div data-testid="address-element">
        <span style={{ ...labelStyle, marginBottom: 10 }}>Billing address <span style={{ color: "#ef4444" }}>*</span></span>
        <AddressElement
          options={{ mode: "billing", defaultValues: { address: { country: "US" } } }}
          onChange={(e) => {
            state.current.address = addressFromStripe(e.value);
            state.current.addressDone = e.complete;
            emit();
          }}
        />
      </div>
    </div>
  );
}

export function stripeElementsOptions(purpose: PaymentFormProps["purpose"], amount: number, currency: string) {
  const appearance = { theme: "night" as const, variables: { colorPrimary: "#4ade80", borderRadius: "8px" } };
  // A plan change collects the card only; the backend charges it for the
  // change (prorated invoice), so Elements just creates the payment method.
  if (purpose === "planChange")
    return { mode: "setup" as const, currency: currency.toLowerCase(), paymentMethodTypes: ["card"], paymentMethodCreation: "manual" as const, appearance };
  // Free trial: the card is saved (SetupIntent, $0) and charged when the trial ends.
  if (purpose === "trial")
    return { mode: "setup" as const, currency: currency.toLowerCase(), paymentMethodTypes: ["card"], appearance };
  return { mode: "subscription" as const, amount: Math.max(0, amount), currency: currency.toLowerCase(), paymentMethodTypes: ["card"], appearance };
}

function StripeForm({ onChange, amount, currency, purpose }: PaymentFormProps) {
  const options = useMemo(
    () => stripeElementsOptions(purpose, amount, currency),
    // Elements is created once; amount changes are pushed with elements.update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency],
  );
  useEffect(() => {
    if (purpose !== "planChange" && purpose !== "trial") live.elements?.update({ amount: Math.max(0, amount) });
  }, [amount, purpose]);
  if (!stripeConfigured()) {
    return <Notice tone="warn" testId="stripe-not-ready">Card payments are being set up. Please try again soon.</Notice>;
  }
  return (
    <Elements stripe={getStripe()} options={options}>
      <Inner onChange={onChange} />
    </Elements>
  );
}

export async function confirmWithStripe(sessionId: string, clientSecret: string | null): Promise<PaymentResult> {
  const { stripe, elements } = live;
  if (!stripe || !elements || !clientSecret) return { status: "failed", message: "The payment form isn't ready. Refresh and try again." };

  const sessionEmail = typeof window !== "undefined" ? window.sessionStorage.getItem("mc:checkout-email") : null;
  const email = (
    firebaseAuth.currentUser?.email ||
    live.email ||
    sessionEmail ||
    ""
  ).trim();
  const name = (live.address?.name || firebaseAuth.currentUser?.displayName || "").trim();

  // Only real values: no placeholder email or name is ever sent to Stripe.
  const billing_details: Record<string, unknown> = {};
  if (email) billing_details.email = email;
  if (name) billing_details.name = name;
  if (live.address) {
    const addr: Record<string, string> = {
      line1: live.address.line1,
      city: live.address.city,
      country: live.address.country,
    };
    if (live.address.line2?.trim()) addr.line2 = live.address.line2.trim();
    if (live.address.state?.trim()) addr.state = live.address.state.trim();
    if (live.address.postalCode?.trim()) addr.postal_code = live.address.postalCode.trim();
    billing_details.address = addr;
  }

  const isSetup = clientSecret.startsWith("seti_");
  if (isSetup) {
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/billing/success?session=${encodeURIComponent(sessionId)}`,
        payment_method_data: {
          billing_details,
        },
      },
      redirect: "if_required",
    });
    if (error) return { status: "failed", message: error.message ?? "The card setup didn't go through. Try another payment method." };
    if (setupIntent && (setupIntent.status === "succeeded" || setupIntent.status === "processing")) return { status: "succeeded" };
    return { status: "failed", message: "Card setup could not be completed. Try again." };
  }

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    clientSecret,
    confirmParams: {
      return_url: `${window.location.origin}/billing/success?session=${encodeURIComponent(sessionId)}`,
      payment_method_data: {
        billing_details,
      },
    },
    redirect: "if_required",
  });
  if (error) return { status: "failed", message: error.message ?? "The payment didn't go through. Try another payment method." };
  if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) return { status: "succeeded" };
  return { status: "failed", message: "The payment wasn't completed. Try again." };
}

/** Manage Plan upgrade that needs 3-D Secure: Stripe shows the challenge for the invoice's payment. */
export async function handleStripeAction(clientSecret: string): Promise<boolean> {
  if (!stripeConfigured()) return false;
  const stripe = await getStripe();
  if (!stripe) return false;
  const { error } = await stripe.handleNextAction({ clientSecret });
  return !error;
}

/** Plan change: validate the entered card + address, then create its payment method (pm_…). */
export async function createPaymentMethodWithStripe(): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { stripe, elements } = live;
  if (!stripe || !elements) return { ok: false, message: "The payment form isn't ready. Refresh and try again." };
  const submitted = await elements.submit();
  if (submitted.error) return { ok: false, message: submitted.error.message ?? "Check your payment details." };
  const a = live.address;
  const { error, paymentMethod } = await stripe.createPaymentMethod({
    elements,
    params: {
      billing_details: {
        name: a?.name || undefined,
        email: firebaseAuth.currentUser?.email || undefined,
        ...(a
          ? { address: { line1: a.line1, line2: a.line2 || undefined, city: a.city, state: a.state || undefined, postal_code: a.postalCode || undefined, country: a.country } }
          : {}),
      },
    },
  });
  if (error || !paymentMethod) return { ok: false, message: error?.message ?? "Your card couldn't be used. Try another card." };
  return { ok: true, id: paymentMethod.id };
}

export const stripePaymentAdapter: PaymentAdapter = {
  provider: "stripe",
  Form: StripeForm,
  prepare: async () => {
    if (!live.elements) return { ok: false, message: "The payment form isn't ready. Refresh and try again." };
    const { error } = await live.elements.submit();
    return error ? { ok: false, message: error.message ?? "Check your payment details." } : { ok: true };
  },
  confirm: (sessionId, clientSecret) => confirmWithStripe(sessionId, clientSecret),
  createPaymentMethod: () => createPaymentMethodWithStripe(),
};
