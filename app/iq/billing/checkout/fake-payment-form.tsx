"use client";

import { useEffect, useState } from "react";
import { fakeCompleteCheckout, fakeConfirmAction, type FakeCompletion } from "../api";
import { SimulatedAddressFields, labelStyle } from "./address-fields";
import type { BillingAddress } from "./model";
import { declineMessage, type PaymentAdapter, type PaymentFormProps, type PaymentResult } from "./payment-form";

/** SIMULATED payment methods (fake provider / TEST MODE). Same layout as the Stripe Payment Element. */
const METHODS = [
  { id: "card", label: "Card" },
  { id: "apple_pay", label: "Apple Pay" },
  { id: "google_pay", label: "Google Pay" },
  { id: "link", label: "Link" },
] as const;
const TEST_CARDS = [
  { id: "success", label: "4242 4242 4242 4242 — succeeds" },
  { id: "decline", label: "4000 0000 0000 0002 — declined" },
  { id: "insufficient_funds", label: "4000 0000 0000 9995 — insufficient funds" },
  { id: "requires_3ds", label: "4000 0025 0000 3155 — 3-D Secure" },
] as const;

let chosenCard: string = "success";
const EMPTY: BillingAddress = { name: "", line1: "", line2: null, city: "", state: null, postalCode: null, country: "US" };

function FakeForm({ onChange, disabled }: PaymentFormProps) {
  const [method, setMethod] = useState<string>("card");
  const [card, setCard] = useState<string>("success");
  const [address, setAddress] = useState<BillingAddress>(EMPTY);

  useEffect(() => {
    chosenCard = method === "card" ? card : "success"; // wallets: simulated approval
    onChange({ ready: true, address });
  }, [method, card, address, onChange]);

  return (
    <div data-testid="payment-element" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <span style={labelStyle}>Payment method <em style={{ textTransform: "none", fontStyle: "normal", color: "var(--warn)" }}>(simulated)</em></span>
        <div className="co-methods" role="radiogroup" aria-label="Payment method">
          {METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} disabled={disabled} data-testid={`pm-${m.id}`} onClick={() => setMethod(m.id)} className={`co-method${method === m.id ? " on" : ""}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {method === "card" && (
        <label>
          <span style={labelStyle}>Test card</span>
          <select data-testid="fake-card" disabled={disabled} value={card} onChange={(e) => setCard(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-hi)" }}>
            {TEST_CARDS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      )}
      <div>
        <span style={{ ...labelStyle, marginBottom: 10 }}>Billing address</span>
        <SimulatedAddressFields value={address} onChange={setAddress} disabled={disabled} />
      </div>
    </div>
  );
}

function toResult(r: FakeCompletion): PaymentResult {
  if (r.status === "complete") return { status: "succeeded" };
  if (r.status === "requires_action") return { status: "requires_action", actionId: r.actionId };
  return { status: "failed", message: declineMessage(r.code) };
}

export const fakePaymentAdapter: PaymentAdapter = {
  provider: "fake",
  Form: FakeForm,
  confirm: async (sessionId) => toResult(await fakeCompleteCheckout(sessionId, chosenCard)),
  completeAction: async (actionId, approve) => {
    const r = await fakeConfirmAction(actionId, approve);
    return r.status === "failed" ? { status: "failed", message: declineMessage("authentication_failed") } : toResult(r);
  },
};
