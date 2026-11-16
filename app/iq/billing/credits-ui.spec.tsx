import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { LeftoverCreditsWarning, UseCreditsChoice, creditsToUse } from "./credits-ui";
import { switchPreviewLines } from "./plan-switch";

const money = (n: number) => `$${(n / 100).toFixed(2)}`;

describe("Market Catalyst credits on payment screens", () => {
  it("uses at most the charge, never more than available", () => {
    assert.equal(creditsToUse(5000, 3000), 3000);
    assert.equal(creditsToUse(2000, 3000), 2000);
    assert.equal(creditsToUse(0, 3000), 0);
  });

  it("the 'use my credits' choice is unticked unless chosen, and hidden with no credits or nothing to pay", () => {
    const off = renderToStaticMarkup(<UseCreditsChoice available={5000} charge={3000} checked={false} onChange={() => {}} money={money} appliesTo="today's payment" />);
    assert.match(off, /Use my Market Catalyst credits \(\$50\.00 available\)/);
    assert.doesNotMatch(off, /checked=""/);
    const on = renderToStaticMarkup(<UseCreditsChoice available={5000} charge={3000} checked onChange={() => {}} money={money} appliesTo="today's payment" />);
    assert.match(on, /\$30\.00 comes off today&#x27;s payment/);
    assert.equal(renderToStaticMarkup(<UseCreditsChoice available={0} charge={3000} checked={false} onChange={() => {}} money={money} appliesTo="x" />), "");
    assert.equal(renderToStaticMarkup(<UseCreditsChoice available={5000} charge={0} checked={false} onChange={() => {}} money={money} appliesTo="x" />), "");
  });

  it("warns before a switch that leaves unused value: it becomes credits, not a refund", () => {
    const html = renderToStaticMarkup(<LeftoverCreditsWarning amount={32085} money={money} onContinue={() => {}} onBack={() => {}} />);
    assert.match(html, /\$320\.85 will be added to your Market Catalyst credits/);
    assert.match(html, /isn&#x27;t refunded/);
    assert.match(html, /Continue and switch/);
    assert.match(html, /Go back/);
  });

  it("the switch pop-up says the unused value goes to credits", () => {
    const lines = switchPreviewLines(
      { kind: "upgrade", interval: "monthly", amountDueNow: 0, creditToBalance: 32085, effectiveAt: "", startsAt: "", nextRenewalAmount: 19900, nextRenewalDate: "2026-12-17T00:00:00.000Z", trialEndsAt: null },
      { from: "Pro", to: "Elite" },
      money,
      () => "Dec 17, 2026",
    );
    assert.ok(lines.includes("The unused value of Pro, $320.85, is added to your Market Catalyst credits."));
    assert.ok(lines.includes("Nothing is charged today."));
  });
});
