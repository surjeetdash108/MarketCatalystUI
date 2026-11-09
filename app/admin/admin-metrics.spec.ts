import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, mrrFromPayments, toConsoleStatus, type PaymentRow } from "./admin-metrics";

const NOW = Date.parse("2026-11-09T12:00:00Z");

describe("toConsoleStatus", () => {
  it("reads a missing or NONE status as free, never active", () => {
    for (const s of [undefined, null, "", "NONE", "something-new"]) assert.equal(toConsoleStatus(s as never), "free", String(s));
  });
  it("maps the live statuses", () => {
    assert.equal(toConsoleStatus("ACTIVE"), "active");
    assert.equal(toConsoleStatus("TRIALING"), "trialing");
    assert.equal(toConsoleStatus("PAST_DUE"), "past_due");
    assert.equal(toConsoleStatus("CANCELLED"), "canceled");
    assert.equal(toConsoleStatus("EXPIRED"), "canceled");
  });
});

describe("mrrFromPayments", () => {
  const pay = (p: Partial<PaymentRow>): PaymentRow => ({
    userId: "u1", amount: 5900, currency: "USD", paymentStatus: "SUCCESS",
    paymentDate: "2026-11-01", billingCycle: "monthly", subscriptionExpiryDate: "2026-12-01", ...p,
  });

  it("is zero for a user with no payments, whatever their user doc says", () => {
    assert.equal(mrrFromPayments([], "u1", NOW), 0);
  });
  it("uses the latest successful payment whose period covers today", () => {
    assert.equal(mrrFromPayments([pay({})], "u1", NOW), 59);
    assert.equal(mrrFromPayments([pay({ paymentDate: "2026-10-01", amount: 3900, subscriptionExpiryDate: "2026-11-01" }), pay({})], "u1", NOW), 59);
  });
  it("normalises annual payments to a monthly figure", () => {
    assert.equal(mrrFromPayments([pay({ amount: 56640, billingCycle: "annual", subscriptionExpiryDate: "2027-11-01" })], "u1", NOW), 47.2);
    assert.equal(mrrFromPayments([pay({ amount: 179100, billingCycle: "yearly", subscriptionExpiryDate: "2027-11-01" })], "u1", NOW), 149.25);
  });
  it("ignores failed and refunded payments, other users, and lapsed periods", () => {
    assert.equal(mrrFromPayments([pay({ paymentStatus: "FAILED" })], "u1", NOW), 0);
    assert.equal(mrrFromPayments([pay({ paymentStatus: "REFUNDED" })], "u1", NOW), 0);
    assert.equal(mrrFromPayments([pay({ userId: "u2" })], "u1", NOW), 0);
    assert.equal(mrrFromPayments([pay({ subscriptionExpiryDate: "2026-11-08" })], "u1", NOW), 0);
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in user-supplied strings before the console renders them with innerHTML", () => {
    assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    assert.equal(escapeHtml("O'Brien & Co"), "O&#39;Brien &amp; Co");
    assert.equal(escapeHtml(null), "");
  });
});
