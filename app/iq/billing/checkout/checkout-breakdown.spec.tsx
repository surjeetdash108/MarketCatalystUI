import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("checkout and manage-plan change breakdown UI lines", () => {
  it("breakdown lines are shown in the required order and hide zero lines except 'Charged now'", () => {
    const page = src("app/iq/billing/checkout/checkout-page.tsx");
    // Extract breakdown block inside checkout-page.tsx
    const bdIndex = page.indexOf('data-testid="change-breakdown"');
    assert.ok(bdIndex > 0, "change-breakdown container exists");
    const bdSection = page.slice(bdIndex, bdIndex + 1500);

    const fromLine = bdSection.indexOf("bd.fromPlanName");
    const toLine = bdSection.indexOf("bd.toPlanName");
    const paidLine = bdSection.indexOf("Already paid for");
    const discountLine = bdSection.indexOf("bd.discount > 0");
    const taxLine = bdSection.indexOf("bd.tax > 0");
    const creditUsedLine = bdSection.indexOf("bd.creditUsed > 0");
    const chargedLine = bdSection.indexOf("Charged now");

    assert.ok(fromLine > 0, "from line present");
    assert.ok(toLine > fromLine, "to line after from line");
    assert.ok(paidLine > toLine, "already paid line after to line");
    assert.ok(discountLine > paidLine, "discount line after already paid");
    assert.ok(taxLine > discountLine, "tax line after discount");
    assert.ok(creditUsedLine > taxLine, "credit used line after tax");
    assert.ok(chargedLine > creditUsedLine, "charged now line after credit used");

    // Zero lines are hidden:
    assert.match(bdSection, /bd\.discount > 0 &&/);
    assert.match(bdSection, /bd\.tax > 0 &&/);
    assert.match(bdSection, /bd\.creditUsed > 0 &&/);
  });

  it("manage-plan preview dialog shows lines in the required order and hides zero lines", () => {
    const page = src("app/iq/screens/manage-plan.tsx");
    const bdIndex = page.indexOf('data-testid="preview-breakdown"');
    assert.ok(bdIndex > 0, "preview-breakdown container exists");
    const bdSection = page.slice(bdIndex, bdIndex + 3000);

    const fromLine = bdSection.indexOf("fromPlanName");
    const toLine = bdSection.indexOf("toPlanName");
    const paidLine = bdSection.indexOf("Already paid for");
    const discountLine = bdSection.indexOf("discount > 0");
    const taxLine = bdSection.indexOf("tax > 0");
    const creditUsedLine = bdSection.indexOf("creditUsed > 0");
    const chargedLine = bdSection.indexOf("Charged now");

    assert.ok(fromLine > 0, "from line present");
    assert.ok(toLine > fromLine, "to line after from line");
    assert.ok(paidLine > toLine, "already paid line after to line");
    assert.ok(discountLine > paidLine, "discount line after already paid");
    assert.ok(taxLine > discountLine, "tax line after discount");
    assert.ok(creditUsedLine > taxLine, "credit used line after tax");
    assert.ok(chargedLine > creditUsedLine, "charged now line after credit used");
  });
});
