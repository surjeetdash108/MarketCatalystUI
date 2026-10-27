import { describe, it } from "node:test";
import assert from "node:assert";
import {
  resolvePeMultiple,
  resolveEvEbitdaMultiple,
  resolvePegMultiple,
  resolveFcfYieldMultiple,
} from "./multiples";

describe("Item 3 Multiples Uncomputable / n/m Handling", () => {
  describe("GS & BAC (Financials / Banks)", () => {
    it("GS: EV/EBITDA is n/m with reason 'Not meaningful for financials'", () => {
      const res = resolveEvEbitdaMultiple(true, 150e9, 10e9);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Not meaningful for financials");
    });

    it("BAC: PEG is n/m with reason 'Not meaningful for financials'", () => {
      const res = resolvePegMultiple(true, 14.5, 8.2);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Not meaningful for financials");
    });

    it("GS: FCF Yield is n/m with reason 'Not meaningful for financials'", () => {
      const res = resolveFcfYieldMultiple(true, 5e9, 150e9);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Not meaningful for financials");
    });
  });

  describe("POST & CALM (Negative / Zero Growth)", () => {
    it("POST: PEG with negative expected growth renders n/m with reason 'Negative growth'", () => {
      const res = resolvePegMultiple(false, 18.2, -4.5);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Negative growth");
    });

    it("CALM: PEG with zero expected growth renders n/m with reason 'Negative growth'", () => {
      const res = resolvePegMultiple(false, 12.0, 0);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Negative growth");
    });
  });

  describe("TLYS (Negative EBITDA)", () => {
    it("TLYS: EV/EBITDA with negative EBITDA renders n/m with reason 'Negative EBITDA'", () => {
      const res = resolveEvEbitdaMultiple(false, 120e6, -5e6);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Negative EBITDA");
    });
  });

  describe("EPM (Negative Earnings / Unprofitable)", () => {
    it("EPM: P/E with null PE and negative TTM EPS renders n/m with reason 'Negative earnings'", () => {
      const res = resolvePeMultiple(null, -0.25);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Negative earnings");
    });

    it("EPM: PEG with negative earnings renders n/m with reason 'Negative earnings'", () => {
      const res = resolvePegMultiple(false, null, 15.0, -0.25);
      assert.strictEqual(res.v, "n/m");
      assert.strictEqual(res.reason, "Negative earnings");
    });
  });

  describe("Normal Profitable Non-Financial Equities", () => {
    it("calculates valid P/E", () => {
      const res = resolvePeMultiple(25.4, 4.2);
      assert.strictEqual(res.v, "25.4×");
      assert.strictEqual(res.reason, undefined);
    });

    it("calculates valid EV/EBITDA", () => {
      const res = resolveEvEbitdaMultiple(false, 100e9, 10e9);
      assert.strictEqual(res.v, "10.0×");
      assert.strictEqual(res.reason, undefined);
    });

    it("calculates valid PEG", () => {
      const res = resolvePegMultiple(false, 20.0, 10.0);
      assert.strictEqual(res.v, "2.00");
      assert.strictEqual(res.reason, undefined);
    });
  });
});
