"use client";

import { Notice } from "../ui";
import type { PaymentAdapter, PaymentFormProps } from "./payment-form";

/**
 * Stripe adapter — NOT IMPLEMENTED YET (see "What's left for Stripe").
 *
 * TODO
 *  - npm install @stripe/stripe-js @stripe/react-stripe-js
 *  - const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
 *  - <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: "night" } }}>
 *      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
 *      <AddressElement options={{ mode: "billing", fields: { phone: "never" } }} />   // phone is our own field
 *    </Elements>
 *    Payment methods come from the Stripe account (card, Apple Pay, Google Pay, Link; PayPal only if
 *    enabled). Never enable crypto or UPI.
 *  - onChange: PaymentElement "change" → ready = event.complete; AddressElement "change" → address
 *    (value.name, value.address.{line1,line2,city,state,postal_code,country}).
 *  - confirm(sessionId): the backend returns the subscription's client secret for sessionId;
 *    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required",
 *      confirmParams: { return_url: `${location.origin}/billing/success?session=${sessionId}` } })
 *    error → { status: "failed", message: error.message } (declines, 3-D Secure failure — Stripe shows the challenge)
 *    else → { status: "succeeded" }.
 */
function StripeForm(_props: PaymentFormProps) {
  return <Notice tone="warn" testId="stripe-not-ready">Card payments are being set up. Please try again soon.</Notice>;
}

export const stripePaymentAdapter: PaymentAdapter = {
  provider: "stripe",
  Form: StripeForm,
  confirm: () => Promise.resolve({ status: "failed", message: "Card payments are being set up. Please try again soon." }),
};
