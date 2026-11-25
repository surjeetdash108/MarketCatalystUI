import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitTainted, uniqueTickers, withoutSplitTaint } from "./alpha-signals-model";
import { framePct } from "./heatmap-design";
import type { CompanyDoc } from "./types";

const closes = (vals: number[]) => vals.map((close, i) => ({ date: `2026-11-${17 + i}`, close }));
// SNDK, 20 Nov 2026: an 8-for-1 split the stored history hadn't applied.
const sndk = { ticker: "SNDK", week5ChangePct: -90.22, pctFromHigh52: -90, week5Closes: closes([797.24, 776.22, 755.16, 79.24, 87.71, 77.95]) } as unknown as CompanyDoc;

describe("unadjusted split guard", () => {
  it("spots a held split jump, not a bad print that reverts or a normal week", () => {
    assert.equal(splitTainted(sndk), true);
    assert.equal(splitTainted({ week5Closes: closes([10, 10.2, 30, 10.1, 10.3, 10]) }), false);
    assert.equal(splitTainted({ week5Closes: closes([45.2, 40.8, 39.5, 32.9, 38.7, 38.4]) }), false);
  });
  it("blanks history-derived figures (no '-90% in 5 days') while tainted", () => {
    const c = withoutSplitTaint(sndk);
    assert.equal(c.week5ChangePct, null);
    assert.equal(c.pctFromHigh52, null);
    assert.equal(framePct("1W", -5, sndk, { price: 76, dateIso: "2026-11-24" }), null);
  });
  it("one company per ticker", () => {
    const cs = [{ ticker: "AMRO" }, { ticker: "amro" }, { ticker: "DG" }] as CompanyDoc[];
    assert.deepEqual(uniqueTickers(cs).map(c => c.ticker), ["AMRO", "DG"]);
  });
});
