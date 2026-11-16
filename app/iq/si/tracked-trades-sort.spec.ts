import assert from "node:assert/strict";
import test from "node:test";
import { sortTrades, tradeProfitPct, type TrackedTrade } from "./tracked-trades-list";

const trade = (id: string, over: Partial<TrackedTrade> = {}): TrackedTrade => ({
  id,
  ticker: id.toUpperCase(),
  dir: "Bull",
  hz: "6M",
  target: 120,
  stop: 90,
  entryPx: 100,
  savedAt: "2026-11-10T12:00:00.000Z",
  ...over,
});

test("profit is measured from the entry price, and flips for a short", () => {
  assert.equal(tradeProfitPct({ entryPx: 100, dir: "Bull" }, 110), 10);
  assert.equal(tradeProfitPct({ entryPx: 100, dir: "Bear" }, 110), -10);
  assert.equal(tradeProfitPct({ entryPx: 100, dir: "Bear" }, 90), 10);
});

test("no profit figure without an entry price or a live price", () => {
  assert.equal(tradeProfitPct({ entryPx: null, dir: "Bull" }, 110), null);
  assert.equal(tradeProfitPct({ entryPx: 0, dir: "Bull" }, 110), null);
  assert.equal(tradeProfitPct({ entryPx: 100, dir: "Bull" }, undefined), null);
});

test("newest first and oldest first go by the saved time; trades with none count as oldest", () => {
  const trades = [
    trade("old", { savedAt: "2026-11-01T00:00:00.000Z" }),
    trade("new", { savedAt: "2026-11-12T00:00:00.000Z" }),
    trade("none", { savedAt: undefined }),
  ];
  const price = () => 100;
  assert.deepEqual(sortTrades(trades, "newest", price).map((t) => t.id), ["new", "old", "none"]);
  assert.deepEqual(sortTrades(trades, "oldest", price).map((t) => t.id), ["none", "old", "new"]);
});

test("most and least profitable use the live price; trades without a figure always go last", () => {
  const trades = [
    trade("flat"),
    trade("up"),
    trade("down"),
    trade("noentry", { entryPx: null }),
    trade("short", { dir: "Bear" }),
  ];
  const prices: Record<string, number> = { FLAT: 100, UP: 120, DOWN: 80, NOENTRY: 150, SHORT: 85 };
  const priceOf = (ticker: string) => prices[ticker];
  assert.deepEqual(sortTrades(trades, "most", priceOf).map((t) => t.id), ["up", "short", "flat", "down", "noentry"]);
  assert.deepEqual(sortTrades(trades, "least", priceOf).map((t) => t.id), ["down", "flat", "short", "up", "noentry"]);
});

test("sorting does not change the array it is given", () => {
  const trades = [trade("a", { savedAt: "2026-11-01T00:00:00.000Z" }), trade("b", { savedAt: "2026-11-02T00:00:00.000Z" })];
  sortTrades(trades, "newest", () => 100);
  assert.deepEqual(trades.map((t) => t.id), ["a", "b"]);
});
