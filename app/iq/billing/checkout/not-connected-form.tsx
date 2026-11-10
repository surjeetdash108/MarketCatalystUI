"use client";

import { useEffect, useState } from "react";
import { Notice } from "../ui";
import { SimulatedAddressFields } from "./address-fields";
import type { BillingAddress } from "./model";
import type { PaymentAdapter, PaymentFormProps } from "./payment-form";

/**
 * Staff checkout preview before Stripe keys are set: steps 1–2 render fully
 * (the address still feeds the summary), the card area says the provider isn't
 * connected, and the form never reports ready — so Complete purchase stays
 * disabled. No card fields of any kind.
 */
export const PROVIDER_NOT_CONNECTED = "Payment provider not connected";

const EMPTY: BillingAddress = { name: "", line1: "", line2: null, city: "", state: null, postalCode: null, country: "US" };

function NotConnectedForm({ onChange, disabled }: PaymentFormProps) {
  const [address, setAddress] = useState<BillingAddress>(EMPTY);
  useEffect(() => {
    onChange({ ready: false, address });
  }, [address, onChange]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Notice tone="warn" testId="co-provider-missing">
        {PROVIDER_NOT_CONNECTED}. The card form appears once Stripe test keys are set; nothing can be charged yet.
      </Notice>
      <SimulatedAddressFields value={address} onChange={setAddress} disabled={disabled} />
    </div>
  );
}

export const notConnectedAdapter: PaymentAdapter = {
  provider: "none",
  Form: NotConnectedForm,
  confirm: () => Promise.resolve({ status: "failed", message: `${PROVIDER_NOT_CONNECTED}.` }),
};
