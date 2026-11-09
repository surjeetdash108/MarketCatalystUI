import { fakePaymentAdapter } from "./fake-payment-form";
import type { PaymentAdapter } from "./payment-form";
import { stripePaymentAdapter } from "./stripe-payment-form";

/** The PaymentForm adapter for the backend's billing provider ("fake" | "stripe"). */
export function paymentAdapterFor(provider: string | null | undefined): PaymentAdapter | null {
  if (provider === "fake") return fakePaymentAdapter;
  if (provider === "stripe") return stripePaymentAdapter;
  return null;
}
