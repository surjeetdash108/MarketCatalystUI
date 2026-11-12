import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { OnboardingStepper } from "../onboarding-stepper";

const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const page = () => src("app/iq/billing/checkout/checkout-page.tsx");

describe("checkout bug fixes (2026-11-12)", () => {
  it("1. the stepper connector runs only between the first and last circle", () => {
    const html = renderToStaticMarkup(<OnboardingStepper currentStep={2} />);
    assert.match(html, /left:calc\(100% \/ 6\);right:calc\(100% \/ 6\)/);
    assert.doesNotMatch(html, /left:12%/);
  });

  it("2. Stripe's 'By subscribing, you authorize…' card terms line is hidden", () => {
    assert.match(src("app/iq/billing/checkout/stripe-payment-form.tsx"), /terms: \{ card: "never" \}/);
  });

  it("3. a plan change sends what the backend checks for its kind (upgrade: amount; downgrade: credit; scheduled: neither)", () => {
    const p = page();
    assert.match(p, /changePrev\.kind === "upgrade" \? \{ expectedAmountDue: changePrev\.amountDueNow \} : \{\}/);
    assert.match(p, /changePrev\.kind === "downgrade" \? \{ expectedCredit: changePrev\.creditToBalance \} : \{\}/);
    assert.match(p, /b\.code === "preview_stale"[\s\S]{0,120}previewChange/);
  });

  it("4. the purchase never sends an invented consent version; it waits for the server's preview", () => {
    const p = page();
    assert.doesNotMatch(p, /"v1"/);
    assert.match(p, /paymentReady: payment\.ready && !!preview\?\.consent\?\.version/);
    // A preview (and its consent text) for another plan/interval is replaced, never reused.
    assert.match(p, /curr && curr\.planId === plan\.id && curr\.interval === interval \? curr :/);
    assert.match(p, /p\.planId === plan\.id && p\.interval === interval && setPreview\(p\)/);
  });

  it("5. no 'Tick the agreement checkbox' helper", () => {
    assert.doesNotMatch(page(), /Tick the agreement checkbox/);
  });

  it("6. no trial heading / 'Add your card to begin' text above the card form", () => {
    const p = page();
    assert.doesNotMatch(p, /Start your 7 day free trial"/);
    assert.doesNotMatch(p, /Add your card to begin/);
    assert.doesNotMatch(p, /Pay securely with Stripe/);
  });

  it("7. after a successful purchase all three steps show as completed", () => {
    const html = renderToStaticMarkup(<OnboardingStepper currentStep={4} />);
    assert.equal(html.match(/Completed/g)?.length, 3);
    assert.doesNotMatch(html, /Step 3/);
    const pages = src("app/iq/billing/billing-pages.tsx");
    assert.match(pages, /\{!isPlanChange && <OnboardingStepper currentStep=\{view\.phase === "active" \? 4 : 3\} \/>\}/);
  });

  it("8. an upgrade from Manage Plan is one payment step: the card is entered there and only that card is charged", async () => {
    const p = page();
    const confirm = p.slice(p.indexOf("async function handleChangeConfirm"), p.indexOf("const close = () =>"));
    assert.ok(confirm.indexOf("adapter.createPaymentMethod()") > 0 && confirm.indexOf("adapter.createPaymentMethod()") < confirm.indexOf("applyChange("));
    assert.match(confirm, /\.\.\.\(paymentMethodId \? \{ paymentMethodId \} : \{\}\)/);
    assert.doesNotMatch(p, /card on file today/);
    assert.match(p, /purpose="planChange"/);
    const upgrade = p.slice(p.indexOf('if (phase === "upgrade" && plan && changePrev)'), p.indexOf('if (phase !== "checkout" || !plan)'));
    assert.doesNotMatch(upgrade, /OnboardingStepper/);
    assert.doesNotMatch(upgrade, /3900|5900/); // no hard-coded plan prices in the breakdown
    const { stripeElementsOptions } = await import("./stripe-payment-form");
    assert.deepEqual(
      { ...stripeElementsOptions("planChange", 1333, "USD"), appearance: undefined },
      { mode: "setup", currency: "usd", paymentMethodTypes: ["card"], paymentMethodCreation: "manual", appearance: undefined },
    );
    assert.equal(stripeElementsOptions("purchase", 3900, "USD").mode, "subscription");
  });
});
