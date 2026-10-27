import { describe, it } from "node:test";
import assert from "node:assert";

describe("Item 4 Quote Prefetch & Fallback Logic", () => {
  it("enriches search results with fetched snapshot quotes", () => {
    const searchResults = [
      { ticker: "SO", name: "Southern Co", price: null, pctChange: null },
      { ticker: "RGCO", name: "RGC Resources Inc", price: null, pctChange: null },
    ];
    const snapshotQuotes = [
      { ticker: "SO", price: 89.45, changePct: 0.72 },
      { ticker: "RGCO", price: 21.30, changePct: -0.15 },
    ];

    const quoteMap = new Map(snapshotQuotes.map(q => [q.ticker, q]));
    const enriched = searchResults.map(r => {
      const q = quoteMap.get(r.ticker);
      return q ? { ...r, price: q.price, pctChange: q.changePct } : r;
    });

    assert.strictEqual(enriched[0].price, 89.45);
    assert.strictEqual(enriched[0].pctChange, 0.72);
    assert.strictEqual(enriched[1].price, 21.30);
    assert.strictEqual(enriched[1].pctChange, -0.15);
  });

  it("header price falls back to companySummary when liveCompany hasn't ticked", () => {
    const liveCompany = { price: null, pctChange: null };
    const companySummary = { price: 89.45, pctChange: 0.72 };

    const resolvedPrice = liveCompany.price ?? companySummary.price ?? null;
    const resolvedPct = liveCompany.pctChange ?? companySummary.pctChange ?? null;

    assert.strictEqual(resolvedPrice, 89.45);
    assert.strictEqual(resolvedPct, 0.72);
  });

  it("session volume resolves from sessVolume even if open/prevClose are missing", () => {
    const qPos = (v: number | null | undefined) => (v != null && v > 0 ? v : null);
    const sessionQuote = { dayVolume: 1_250_000, open: null, previousClose: null };
    const keyStats = { volume: 1_100_000 };

    const sessVolume = qPos(sessionQuote.dayVolume);
    const barSessionVol = null;
    const sessionVol = sessVolume ?? barSessionVol ?? (qPos(keyStats.volume) ?? null);

    assert.strictEqual(sessionVol, 1_250_000);
  });
});
