// Sales are held in $ millions. A company with $1B+ of sales shows billions
// everywhere (charts and tables, one unit per company); a smaller one stays in millions.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { salesDisplay } from "./eps-sales-data";

describe("salesDisplay", () => {
  it("a large company (AMD, NVDA) shows billions", () => {
    const sd = salesDisplay([7658, 9246, 34639, null, 136243.3]);
    assert.equal(sd.inB, true);
    assert.equal(sd.heading, "$B");
    assert.equal(sd.title, "Sales ($B)");
    assert.equal(sd.cell(34639), "34.64");
    assert.equal(sd.cell(7658), "7.66");
    assert.equal(sd.cell(null), "—");
    assert.equal(sd.bar(96221), "96.22");
    assert.equal(sd.axis(50000), "50");
    assert.equal(sd.axis(12500), "12.5");
    assert.equal(sd.short(96221), "96.2");
    assert.equal(sd.short(7658), "7.66");
  });

  it("a small company stays in millions", () => {
    const sd = salesDisplay([120.4, 98.2, null, 410]);
    assert.equal(sd.inB, false);
    assert.equal(sd.heading, "$M");
    assert.equal(sd.title, "Sales ($Mil)");
    assert.equal(sd.cell(120.4), "120.4");
    assert.equal(sd.bar(410), "410");
    assert.equal(sd.short(98.2), "98");
  });

  it("one figure at $1B flips the whole company to billions", () => {
    assert.equal(salesDisplay([800, 1000]).inB, true);
    assert.equal(salesDisplay([800, 999.9]).inB, false);
  });

  it("a negative or empty series does not break it", () => {
    assert.equal(salesDisplay([]).inB, false);
    assert.equal(salesDisplay([null, undefined]).inB, false);
    assert.equal(salesDisplay([-2500, 100]).inB, true);
  });
});
