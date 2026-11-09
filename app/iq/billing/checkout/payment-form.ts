import type { ComponentType } from "react";
import type { BillingAddress } from "./model";

/**
 * Payment methods and the billing address come from the billing provider
 * through this adapter — never from our own card fields. Stripe: Payment
 * Element (card, Apple Pay, Google Pay, Link; PayPal only if the account
 * supports it — no crypto, no UPI) + Address Element. The fake provider renders
 * a simulated form with the same layout, so the page and its tests are identical.
 */
export interface PaymentFormValue {
  /** The provider says the payment details are complete. */
  ready: boolean;
  /** From the provider's address element. We keep only country/state/ZIP. */
  address: BillingAddress | null;
}

export interface PaymentFormProps {
  onChange: (v: PaymentFormValue) => void;
  disabled?: boolean;
}

export type PaymentResult =
  | { status: "succeeded" }
  | { status: "requires_action"; actionId: string }
  | { status: "failed"; message: string };

export interface PaymentAdapter {
  provider: string;
  Form: ComponentType<PaymentFormProps>;
  /** Pays the session created by POST /api/billing/checkout. */
  confirm(sessionId: string): Promise<PaymentResult>;
  /** 3-D Secure / bank challenge (Stripe handles it inside confirm). */
  completeAction?(actionId: string, approve: boolean): Promise<PaymentResult>;
}

export const DECLINE_MESSAGES: Record<string, string> = {
  card_declined: "Your card was declined. Try another card or payment method.",
  insufficient_funds: "Your card has insufficient funds. Try another card.",
  authentication_required: "Your bank needs you to confirm this payment. Try again.",
  authentication_failed: "The payment wasn't confirmed with your bank. Try again or use another card.",
  session_expired: "This checkout expired. Start again.",
};
export const declineMessage = (code: string) => DECLINE_MESSAGES[code] ?? "The payment didn't go through. Try another payment method.";
