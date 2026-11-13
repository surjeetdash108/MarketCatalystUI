import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripeErrorMessage } from "./payment-form";

describe("stripeErrorMessage", () => {
  it("a declined card says 'Card declined' with Stripe's reason, not 'bank could not confirm'", () => {
    assert.equal(stripeErrorMessage({ type: "card_error", code: "card_declined", decline_code: "generic_decline", message: "Your card was declined." }), "Card declined: Your card was declined.");
    assert.equal(stripeErrorMessage({ type: "card_error", code: "expired_card", message: "Your card has expired." }), "Card declined: Your card has expired.");
  });
  it("known decline codes use our wording", () => {
    assert.equal(stripeErrorMessage({ type: "card_error", code: "card_declined", decline_code: "insufficient_funds", message: "x" }), "Your card has insufficient funds. Try another card.");
  });
  it("a failed bank check is reported as that", () => {
    assert.match(stripeErrorMessage({ type: "invalid_request_error", code: "payment_intent_authentication_failure", message: "x" }), /wasn't confirmed with your bank/);
    assert.match(stripeErrorMessage(null), /wasn't confirmed with your bank/);
  });
});
