"use client";

import { AddressElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef } from "react";
import { Notice } from "../ui";
import { labelStyle } from "./address-fields";
import type { BillingAddress } from "./model";
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
 * NEXT_PUBLIC_STRIPE_PAYMENT_METHOD_TYPES (default "card,link"; Apple Pay /
 * Google Pay appear under card once the domain is verified). Must match the
 * backend's STRIPE_PAYMENT_METHOD_TYPES. Never crypto or UPI.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const ALLOWED = new Set(["card", "link", "paypal", "us_bank_account", "cashapp", "amazon_pay"]);

export function stripePaymentMethodTypes(raw: string | undefined): string[] {
  const types = String(raw ?? "card,link")
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
const live: { stripe: Stripe | null; elements: StripeElements | null } = { stripe: null, elements: null };

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
  const emit = () => onChange({ ready: state.current.ready && state.current.addressDone, address: state.current.address });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div data-testid="payment-element">
        <PaymentElement
          options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }}
          onChange={(e) => {
            state.current.ready = e.complete;
            emit();
          }}
        />
      </div>
      <div data-testid="address-element">
        <span style={{ ...labelStyle, marginBottom: 10 }}>Billing address</span>
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

function StripeForm({ onChange, amount, currency }: PaymentFormProps) {
  const options = useMemo(
    () => ({
      mode: "subscription" as const,
      amount: Math.max(0, amount),
      currency: currency.toLowerCase(),
      paymentMethodTypes: METHOD_TYPES,
      appearance: { theme: "night" as const, variables: { colorPrimary: "#22c55e", borderRadius: "8px" } },
    }),
    // Elements is created once; amount changes are pushed with elements.update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency],
  );
  useEffect(() => {
    live.elements?.update({ amount: Math.max(0, amount) });
  }, [amount]);
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
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    clientSecret,
    confirmParams: { return_url: `${window.location.origin}/billing/success?session=${encodeURIComponent(sessionId)}` },
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

export const stripePaymentAdapter: PaymentAdapter = {
  provider: "stripe",
  Form: StripeForm,
  prepare: async () => {
    if (!live.elements) return { ok: false, message: "The payment form isn't ready. Refresh and try again." };
    const { error } = await live.elements.submit();
    return error ? { ok: false, message: error.message ?? "Check your payment details." } : { ok: true };
  },
  confirm: (sessionId, clientSecret) => confirmWithStripe(sessionId, clientSecret),
};
