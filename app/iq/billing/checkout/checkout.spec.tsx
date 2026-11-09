import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { CheckoutPreview } from "../api";
import { REFUND_POLICY } from "../refund-policy.generated";
import { paymentAdapterFor } from "./adapters";
import { SimulatedAddressFields } from "./address-fields";
import { SummaryCard } from "./summary-card";

const pro = { id: "pro", name: "Pro", description: "", currency: "USD", sortOrder: 2, prices: { monthly: { amount: 5900, lookupKey: "pro_monthly" }, annual: { amount: 56640, lookupKey: "pro_annual" } } };
const preview: CheckoutPreview = {
  planId: "pro", interval: "monthly", currency: "USD", subtotal: 5900, discount: 590, tax: 438, total: 5748, taxLabel: "Sales tax (TX, simulated)", taxPending: false,
  promo: { code: "SAVE10", description: "10% off your first payment" }, renewsAt: "2026-12-10T12:00:00.000Z", renewalAmount: 5900,
  consent: { version: "2026-11-10.1", text: "I agree that my Pro plan renews monthly at the price shown until I cancel. I agree to the Terms of Use and have read the Privacy Policy." },
  refundPolicy: { enabled: true, windowDays: 14, checkoutLine: REFUND_POLICY.checkoutLine },
};
const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("checkout summary card", () => {
  it("step 1: plan, price, total (+ tax), no tax line yet", () => {
    const html = renderToStaticMarkup(<SummaryCard plan={pro} interval="annual" step={1} preview={null} action={null} />);
    assert.match(html, /Pro<\/b> · Annual/);
    assert.match(html, /\$566\.40\/year/);
    assert.match(html, /\$566\.40 \+ tax/);
    assert.doesNotMatch(html, /summary-tax/);
  });
  it("step 2: subtotal, discount, tax from the provider preview, total, next payment, how it works (refund line from REFUND_WINDOW_DAYS)", () => {
    const html = renderToStaticMarkup(<SummaryCard plan={pro} interval="monthly" step={2} preview={preview} action={null} />);
    assert.match(html, /data-testid="summary-subtotal">\$59</);
    assert.match(html, /Discount \(SAVE10\)<\/span><span data-testid="summary-discount">−\$5\.90/);
    assert.match(html, /Sales tax \(TX, simulated\)<\/span><span data-testid="summary-tax">\$4\.38/);
    assert.match(html, /data-testid="summary-total">\$57\.48/);
    assert.match(html, /Renews on December 10, 2026 at \$59 plus any applicable tax/);
    assert.match(html, /Renews at the full price every month until you cancel/);
    assert.match(html, /Cancel anytime in Manage Plan and keep access until the end of the period/);
    assert.ok(html.includes(REFUND_POLICY.checkoutLine.replace(/'/g, "&#x27;")));
  });
  it("no tax rates in the UI: tax only from the preview", () => {
    for (const f of fs.readdirSync(path.join(process.cwd(), "app/iq/billing/checkout"))) {
      if (f.endsWith(".spec.tsx") || f.endsWith(".spec.ts")) continue;
      assert.doesNotMatch(src(`app/iq/billing/checkout/${f}`), /0\.0825|8\.25|taxRate|TAX_RATE/);
    }
  });
});

describe("payment form adapter", () => {
  it("payment methods come from the provider adapter; no card fields of our own", () => {
    assert.equal(paymentAdapterFor("fake")?.provider, "fake");
    assert.equal(paymentAdapterFor("stripe")?.provider, "stripe");
    assert.equal(paymentAdapterFor(null), null);
    const page = src("app/iq/billing/checkout/checkout-page.tsx");
    assert.doesNotMatch(page, /cardNumber|cc-number|cvc|cvv|expiry/i);
    assert.doesNotMatch(src("app/iq/billing/checkout/fake-payment-form.tsx"), /cc-number|cvc|cvv/i);
    assert.match(src("app/iq/billing/checkout/stripe-payment-form.tsx"), /Never enable crypto or UPI/);
  });
  it("the simulated address element has Stripe's fields in Stripe's order", () => {
    const html = renderToStaticMarkup(<SimulatedAddressFields value={{ name: "", line1: "", line2: null, city: "", state: null, postalCode: null, country: "US" }} onChange={() => {}} />);
    const order = ["addr-name", "addr-country", "addr-line1", "addr-line2", "addr-city", "addr-state", "addr-zip"].map((id) => html.indexOf(`data-testid="${id}"`));
    assert.ok(order.every((i) => i > 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });
});

describe("checkout page wiring", () => {
  const page = src("app/iq/billing/checkout/checkout-page.tsx");
  it("Complete purchase is disabled until the consent box is ticked and the form is valid", () => {
    assert.match(page, /const ready = canComplete\(\{ consent, phoneE164, address: payment\.address, paymentReady: payment\.ready && !!preview, busy \}\)/);
    assert.match(page, /data-testid="co-complete" disabled=\{!ready\}/);
    assert.match(page, /data-testid="consent-box" checked=\{consent\}/);
    assert.match(page, /useState\(false\);\n  const \[busy/); // consent starts unticked
  });
  it("the plan can't be changed on the page except via 'Change plan' → Manage Plan; X/back navigation", () => {
    assert.match(page, /href="\/manage-plan"[^>]*data-testid="co-change-plan"/);
    assert.match(page, /data-testid="co-back" onClick=\{\(\) => setStep\(1\)\}/);
    assert.match(page, /data-testid="co-close" onClick=\{close\}/);
  });
  it("signed-out → signup with the same plan; staff, launching-soon and existing subscribers never see a payment form", () => {
    assert.match(page, /if \(!user\) return window\.location\.replace\(`\/auth\/signup\?plan=\$\{intent\.planId\}&interval=\$\{intent\.interval\}`\)/);
    assert.match(page, /if \(ent\?\.staff\) return live && setPhase\("staff"\)/);
    assert.match(page, /if \(!paidPlansAvailable\) return live && setPhase\("soon"\)/);
    assert.match(page, /window\.location\.replace\(`\/manage-plan\?plan=/);
    assert.match(page, /setPhase\(user\.emailVerified \? "checkout" : "verify"\)/);
  });
  it("mobile: the two columns stack", () => {
    const css = src("app/iq/billing/checkout/checkout.css");
    assert.match(css, /@media \(max-width: 860px\) \{\s*\.co-wrap \{ grid-template-columns: minmax\(0, 1fr\);/);
  });
});
