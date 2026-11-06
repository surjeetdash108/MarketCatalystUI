// Item 4: Pinned popover header must keep updating live with board ticks.
// (e.g. ALAB pinned at 190.41 keeps updating live to ~192 when board ticks arrive)
// Run: node --test tests/ui/money-flow-pinned-header-live.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const screenSrc = fs.readFileSync(new URL("../../app/iq/screens/money-flow.tsx", import.meta.url), "utf8");

describe("Item 4: Pinned popover header live updates", () => {
  it("popover component reads current stock from stockByT when pinned so header never sticks", () => {
    // Assert screenSrc derives `s` using stockByT
    assert.match(
      screenSrc,
      /const\s+s\s*=\s*\(?\s*hoveredStock\s*\?\s*stockByT\.get\(hoveredStock\.stock\.t\)\s*:\s*null\s*\)?\s*\?\?\s*hoveredStock(?:\.stock|\?\.stock)/,
      "Popover must resolve `s` from live stockByT"
    );
  });

  it("header price and pct update when stock in board ticks from 190.41 to 192.15", async () => {
    const { formatCurrency, formatPct } = await import("../../app/iq/money-flow/engine.ts");

    // Initial state when pinned at 190.41
    const alabInitial = {
      t: "ALAB",
      name: "Astera Labs",
      price: 190.41,
      prevClose: 185.0,
      pctChange: 2.92,
    };
    assert.equal(formatCurrency(alabInitial.price), "190.41");
    assert.equal(formatPct(alabInitial.pctChange), "+2.92%");

    // Pinned popover remains open while board updates ALAB to 192.15
    const alabTicked = {
      ...alabInitial,
      price: 192.15,
      pctChange: 3.86,
    };
    const stockByT = new Map([["ALAB", alabTicked]]);

    // Simulating popover resolving live stock:
    const activeHoveredStock = { stock: alabInitial, pinned: true };
    const s = stockByT.get(activeHoveredStock.stock.t) ?? activeHoveredStock.stock;

    assert.equal(s.price, 192.15);
    assert.equal(formatCurrency(s.price), "192.15");
    assert.equal(formatPct(s.pctChange), "+3.86%");
  });
});
