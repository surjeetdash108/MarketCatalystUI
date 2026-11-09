import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addressComplete, annualOffer, canComplete, exitPath, renewalLine, type BillingAddress } from "./model";
import { DIAL_COUNTRIES, toE164 } from "./phone";

const pro = { id: "pro", name: "Pro", description: "", currency: "USD", sortOrder: 2, prices: { monthly: { amount: 5900, lookupKey: "pro_monthly" }, annual: { amount: 56640, lookupKey: "pro_annual" } } };
const TX: BillingAddress = { name: "Tex", line1: "500 Congress Ave", line2: null, city: "Austin", state: "TX", postalCode: "78701", country: "US" };

describe("checkout step 1", () => {
  it("annual card: per year, per month, saving vs monthly (from the catalog only)", () => {
    assert.deepEqual(annualOffer(pro), { perYear: 56640, perMonth: 4720, saveVsMonthly: 5900 * 12 - 56640 });
  });
});

describe("mobile number (E.164, US preselected)", () => {
  it("US is first and the default", () => assert.equal(DIAL_COUNTRIES[0].iso, "US"));
  it("normalises and validates", () => {
    assert.equal(toE164("+1", "(512) 555-0147"), "+15125550147");
    assert.equal(toE164("+1", "1 512 555 0147"), "+15125550147");
    assert.equal(toE164("+44", "07911 123456"), "+447911123456");
    for (const bad of ["555-0147", "012 555 0147", "512 155 0147", ""]) assert.equal(toE164("+1", bad), null);
  });
});

describe("Complete purchase gate", () => {
  const ok = { consent: true, phoneE164: "+15125550147", address: TX, paymentReady: true, busy: false };
  it("enabled only with consent ticked, valid phone, full address and a ready payment method", () => {
    assert.equal(canComplete(ok), true);
    assert.equal(canComplete({ ...ok, consent: false }), false);
    assert.equal(canComplete({ ...ok, phoneE164: null }), false);
    assert.equal(canComplete({ ...ok, address: { ...TX, postalCode: "787" } }), false);
    assert.equal(canComplete({ ...ok, paymentReady: false }), false);
    assert.equal(canComplete({ ...ok, busy: true }), false);
  });
  it("US addresses need state and ZIP; others don't", () => {
    assert.equal(addressComplete({ ...TX, state: null }), false);
    assert.equal(addressComplete({ ...TX, country: "GB", state: null, postalCode: "SW1A 1AA" }), true);
  });
});

describe("summary copy and navigation", () => {
  it("next payment line", () => assert.equal(renewalLine("2026-12-10T12:00:00.000Z", "$59"), "Renews on December 10, 2026 at $59"));
  it("X returns to a same-site page the buyer came from, else the dashboard", () => {
    const o = "https://app.example.com";
    assert.equal(exitPath(`${o}/manage-plan`, o), "/manage-plan");
    assert.equal(exitPath(`${o}/auth/signup?plan=pro`, o), "/dashboard");
    assert.equal(exitPath("https://marketcatalyst.example/pricing", o), "/dashboard");
    assert.equal(exitPath("", o), "/dashboard");
  });
});
