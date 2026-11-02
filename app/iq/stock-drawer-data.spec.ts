import { describe, it } from "node:test";
import assert from "node:assert";
import {
  resolveStockDrawerData,
  computeSectorSentence,
  formatDrawerMarketCap,
  type StockDrawerContext,
} from "./stock-drawer-data";

describe("Stock Drawer data resolution", () => {
  it("Item 1: reads exact live quote and computed values at moment of click instead of stale company doc", () => {
    // Evidence from Nov 2 test: LITE card showed 747.14 / -11.13%, window had old doc 755.51 / -10.13%
    const context: StockDrawerContext = {
      price: 747.14,
      pctChange: -11.13,
      rvol: 4.5,
      marketCap: 63188788688,
      name: "Lumentum Holdings Inc.",
      sector: "Electronic Technology",
      sectorPctChange: 0.1,
    };
    const staleCompany = {
      name: "Lumentum",
      sector: "Electronic Technology",
      price: 755.51,
      pctChange: -10.13,
      rvol: null,
      rsRating: 85,
      marketCap: 64500000000,
    };

    const resolved = resolveStockDrawerData("LITE", context, null, staleCompany);
    assert.strictEqual(resolved.price, 747.14);
    assert.strictEqual(resolved.pctChange, -11.13);
    assert.strictEqual(resolved.rvol, 4.5);
    assert.strictEqual(resolved.name, "Lumentum Holdings Inc.");
    assert.strictEqual(resolved.marketCapText, "$63.2B");
  });

  it("Item 2: PNR and APA missing from companies doc resolve correctly and never show empty", () => {
    // PNR had live popover data but was missing from companies
    const pnrCtx: StockDrawerContext = {
      price: 70.52,
      pctChange: 6.43,
      rvol: 1.8,
      marketCap: 11258848175,
      name: "Pentair plc",
      sector: "Producer Manufacturing",
      sectorPctChange: 0.53,
    };

    const pnr = resolveStockDrawerData("PNR", pnrCtx, null, null);
    assert.strictEqual(pnr.hasData, true);
    assert.strictEqual(pnr.name, "Pentair plc");
    assert.strictEqual(pnr.price, 70.52);
    assert.strictEqual(pnr.pctChange, 6.43);
    assert.strictEqual(pnr.marketCapText, "$11.3B");

    // APA with live quote fallback
    const apaLive = {
      price: 49.08,
      pctChange: -7.08,
      marketCap: 17195252111,
      name: "APA Corporation",
    };
    const apa = resolveStockDrawerData("APA", null, apaLive, null);
    assert.strictEqual(apa.hasData, true);
    assert.strictEqual(apa.name, "APA Corporation");
    assert.strictEqual(apa.price, 49.08);
    assert.strictEqual(apa.pctChange, -7.08);
  });

  it("Item 3: sector sentence uses same value as sector board and correct wording logic", () => {
    // Both positive: CRH in Non-Energy Minerals (+3.96%, stock +6.71%)
    const crhSentence = computeSectorSentence("Non-Energy Minerals", 6.71, 3.96);
    assert.strictEqual(crhSentence.direction, "up");
    assert.strictEqual(crhSentence.pctText, "+3.96%");
    assert.strictEqual(crhSentence.relation, "in line with sector strength.");

    // Both negative: stock down -5%, sector down -1.22% -> in line with sector weakness
    const bothDown = computeSectorSentence("Electronic Technology", -5.0, -1.22);
    assert.strictEqual(bothDown.direction, "down");
    assert.strictEqual(bothDown.pctText, "-1.22%");
    assert.strictEqual(bothDown.relation, "in line with sector weakness.");

    // Stock up, sector down -> bucking sector weakness
    const stockUpSecDown = computeSectorSentence("Electronic Technology", 2.5, -1.22);
    assert.strictEqual(stockUpSecDown.direction, "down");
    assert.strictEqual(stockUpSecDown.relation, "bucking its sector today (advancing despite sector weakness).");

    // Stock down, sector up -> lagging sector strength
    const stockDownSecUp = computeSectorSentence("Technology Services", -3.2, 1.64);
    assert.strictEqual(stockDownSecUp.direction, "up");
    assert.strictEqual(stockDownSecUp.relation, "lagging its sector today (declining despite sector strength).");
  });

  it("Item 4: market cap formats live price × shares", () => {
    // ORCL: $367.8B live (vs $396.1B from Friday's close)
    assert.strictEqual(formatDrawerMarketCap(367807733600), "$367.8B");
    assert.strictEqual(formatDrawerMarketCap(2687945927083), "$2.69T");
    assert.strictEqual(formatDrawerMarketCap(null), null);
  });
});

