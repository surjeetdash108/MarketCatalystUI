import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeIssuers, isNonStockType } from "./issuer-dedupe";

describe("heatmap universe: company shares only", () => {
  it("funds, warrants, rights and units are not stocks", () => {
    for (const t of ["ETF", "WARRANT", "RIGHT", "UNIT", "SP"]) assert.equal(isNonStockType(t), true, t);
    for (const t of ["CS", "ADRC", null]) assert.equal(isNonStockType(t), false, String(t));
  });
  it("a lone warrant (ENVXW +109%) is dropped even when its company isn't in the list", () => {
    const out = dedupeIssuers([
      { ticker: "ENVXW", name: "Enovix Corporation", type: "WARRANT", marketCap: 8e6 },
      { ticker: "AAPL", name: "Apple Inc.", type: "CS", marketCap: 5e12 },
    ]);
    assert.deepEqual(out.map(x => x.ticker), ["AAPL"]);
  });
});
