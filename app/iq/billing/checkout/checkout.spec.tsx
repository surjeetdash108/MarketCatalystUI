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
    assert.match(src("app/iq/billing/checkout/stripe-payment-form.tsx"), /Never crypto or UPI/);
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
    assert.match(page, /const ready = canComplete\(\{ consent,/);
    assert.match(page, /data-testid="co-complete" disabled=\{!ready\}/);
    assert.match(page, /data-testid="consent-box" checked=\{consent\}/);
    assert.match(page, /useState\(false\);\n  const \[busy/); // consent starts unticked
  });
  it("the plan can't be changed on the page except via 'Change plan' → Manage Plan; X/back navigation", () => {
    assert.match(page, /href="\/manage-plan"[^>]*data-testid="co-change-plan"/);
    assert.match(page, /data-testid="co-back" onClick=\{\(\) => setStep\(1\)\}/);
    assert.match(page, /data-testid="co-close" onClick=\{close\}/);
  });
  it("signed-out → signup with the same plan; existing subscribers redirect to manage-plan", () => {
    assert.match(page, /if \(!user\) return window\.location\.replace\(`\/auth\/signup\?plan=\$\{intent\.planId\}&interval=\$\{intent\.interval\}`\)/);
    assert.match(page, /window\.location\.replace\(`\/manage-plan\?plan=/);
    assert.match(page, /setPhase\(user\.emailVerified \? "checkout" : "verify"\)/);
  });
  it("checkout buttons beat the app's global button reset (.iq-root button { background:none })", () => {
    const css = src("app/iq/billing/checkout/checkout.css");
    for (const c of ["co-cta", "co-method", "co-radio", "co-iconbtn"]) assert.match(css, new RegExp(`\\.iq-root button\\.${c} \\{[^}]*background:`));
  });
  it("mobile: the two columns stack", () => {
    const css = src("app/iq/billing/checkout/checkout.css");
    assert.match(css, /@media \(max-width: 860px\) \{\s*\.co-wrap \{ grid-template-columns: minmax\(0, 1fr\);/);
  });
});

describe("Stripe adapter (Payment Element + Address Element, deferred intent)", () => {
  it("payment method types come from config; crypto and UPI are filtered out", async () => {
    const { stripePaymentMethodTypes } = await import("./stripe-payment-form");
    assert.deepEqual(stripePaymentMethodTypes(undefined), ["card", "link"]);
    assert.deepEqual(stripePaymentMethodTypes("card,link,paypal,crypto,upi"), ["card", "link", "paypal"]);
    assert.deepEqual(stripePaymentMethodTypes("crypto"), ["card"]);
  });
  it("needs a real publishable key; without one it says payments are being set up (never a broken form)", async () => {
    const { stripeConfigured, stripePaymentAdapter } = await import("./stripe-payment-form");
    assert.equal(stripeConfigured("pk_test_abc"), true);
    // Live keys need the separate approval (matches the backend's STRIPE_LIVE_APPROVED).
    assert.equal(stripeConfigured("pk_live_abc"), false);
    assert.equal(stripeConfigured("pk_live_abc", false), false);
    assert.equal(stripeConfigured("pk_live_abc", true), true);
    assert.equal(stripeConfigured("pk_test_abc", false), true);
    assert.equal(stripeConfigured("__PLACEHOLDER__"), false);
    assert.equal(stripeConfigured(""), false);
    const Form = stripePaymentAdapter.Form;
    const html = renderToStaticMarkup(<Form onChange={() => {}} amount={5900} currency="USD" />);
    assert.match(html, /Card payments are being set up/);
  });
  it("maps the Address Element value to our address (we keep only country/state/ZIP server-side)", async () => {
    const { addressFromStripe } = await import("./stripe-payment-form");
    assert.deepEqual(addressFromStripe({ name: "Tex", address: { line1: "500 Congress Ave", line2: "", city: "Austin", state: "TX", postal_code: "78701", country: "US" } }), {
      name: "Tex", line1: "500 Congress Ave", line2: null, city: "Austin", state: "TX", postalCode: "78701", country: "US",
    });
  });
  it("confirm without a client secret fails cleanly (no charge attempt)", async () => {
    const { confirmWithStripe } = await import("./stripe-payment-form");
    assert.equal((await confirmWithStripe("sub_1", null)).status, "failed");
  });
  it("the page validates with the provider before creating the session, then confirms with the returned client secret", () => {
    const page = src("app/iq/billing/checkout/checkout-page.tsx");
    const prep = page.indexOf("await adapter.prepare()");
    const start = page.indexOf("await startCheckout({");
    assert.ok(prep > 0 && start > prep);
    assert.match(page, /adapter\.confirm\(co\.sessionId, co\.payment\.clientSecret \?\? null\)/);
    const stripeSrc = src("app/iq/billing/checkout/stripe-payment-form.tsx");
    assert.match(stripeSrc, /mode: "subscription" as const/);
    assert.match(stripeSrc, /redirect: "if_required"/);
    assert.match(stripeSrc, /await live\.elements\.submit\(\)/);
  });
  it("Manage Plan: an upgrade needing 3-D Secure is handled by Stripe", () => {
    assert.match(src("app/iq/screens/manage-plan.tsx"), /if \(r\.status === "requires_action" && r\.clientSecret\) \{[\s\S]*?handleStripeAction\(r\.clientSecret\)/);
  });
});

describe("staff checkout preview (CHECKOUT_PREVIEW)", () => {
  const page = src("app/iq/billing/checkout/checkout-page.tsx");
  it("staff preview flag is captured for test mode", () => {
    assert.match(page, /const preview = ent\?\.staff === true && ent\.checkoutPreview === true;/);
  });
  it("the 'Preview: test mode, no real charges' banner is on every checkout step (verify, step 1, step 2)", async () => {
    const { PREVIEW_BANNER } = await import("../ui");
    assert.equal(PREVIEW_BANNER, "Preview: test mode, no real charges");
    assert.equal(page.match(/\{inPreview && [\s\S]{0,160}?testId="co-preview-banner">\{PREVIEW_BANNER\}/g)?.length, 2);
    assert.match(src("app/iq/billing/billing-pages.tsx"), /ent\?\.checkoutPreview && <Notice tone="warn" testId="success-preview-banner">\{PREVIEW_BANNER\}/);
  });
  it("no provider connected: the not-connected form only in preview; never a fake card form", () => {
    assert.match(page, /setAdapter\(paymentAdapterFor\(s\.provider\) \?\? \(preview \? notConnectedAdapter : null\)\)/);
    assert.equal(paymentAdapterFor("none"), null);
  });
  it("'Payment provider not connected': address renders, no card inputs, never ready (Complete purchase stays disabled)", async () => {
    const { notConnectedAdapter, PROVIDER_NOT_CONNECTED } = await import("./not-connected-form");
    const Form = notConnectedAdapter.Form;
    const seen: Array<{ ready: boolean }> = [];
    const html = renderToStaticMarkup(<Form onChange={(v) => seen.push(v)} amount={5900} currency="USD" />);
    assert.equal(PROVIDER_NOT_CONNECTED, "Payment provider not connected");
    assert.match(html, /data-testid="co-provider-missing"[^>]*>[\s\S]*Payment provider not connected/);
    for (const id of ["addr-name", "addr-country", "addr-line1", "addr-city", "addr-zip"]) assert.match(html, new RegExp(`data-testid="${id}"`));
    assert.doesNotMatch(html, /cc-number|cc-csc|cc-exp|cvc|cvv|card number|fake-card|payment-element/i);
    assert.ok(seen.every((v) => v.ready === false));
    assert.doesNotMatch(src("app/iq/billing/checkout/not-connected-form.tsx"), /ready: true/);
    assert.equal((await notConnectedAdapter.confirm("x", null)).status, "failed");
  });
  it("Manage Plan: renders BillingScreen with preview banner when in preview", () => {
    const mp = src("app/iq/screens/manage-plan.tsx");
    assert.match(mp, /<BillingScreen preview=\{ent\.checkoutPreview === true\} \/>/);
    assert.match(mp, /\{preview && <div className="col-12"><Notice tone="warn" testId="billing-preview-banner">\{PREVIEW_BANNER\}/);
  });
  it("admin: test-mode rows get a Test badge; counts say test is excluded", async () => {
    const { TestBadge } = await import("../../../admin/billing/admin-billing");
    assert.match(renderToStaticMarkup(<TestBadge />), /data-testid="test-badge"[^>]*>\s*Test\s*</);
    const admin = src("app/admin/billing/admin-billing.tsx");
    assert.match(admin, /\{r\.test && <TestBadge \/>\}/);
    assert.match(admin, /paying \(staff and test excluded\)/);
  });
});
