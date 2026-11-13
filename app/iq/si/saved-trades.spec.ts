// Trade Tracker keeps every saved trade, per stock. A bullish and a bearish trade
// for NVDA used to overwrite each other (one `si_thesis_NVDA` key).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addTrade, removeTrade, readTrades, writeTrades, listAllTrades, tradesKey, formatSavedAt, type SavedTrade, type TradeStore } from "./saved-trades";

class FakeStore implements TradeStore {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const base = (over: Partial<SavedTrade> = {}): Omit<SavedTrade, "id"> => ({
  ticker: "NVDA", dir: "Bull", hz: "6M", title: "LONG NVDA → $203.06 · 6M", target: 203.06, stop: 151.97,
  confAtSave: 60, savedDate: "Just now · Active", entryPx: 161.9, savedAt: "2026-11-14T02:00:00.000Z", wO: null, ...over,
});

describe("saved trades keep every trade", () => {
  it("a bearish trade is added next to a bullish one instead of replacing it", () => {
    const first = addTrade([], base(), Date.parse("2026-11-14T02:00:00Z"));
    const second = addTrade(first.trades, base({ dir: "Bear", title: "SHORT NVDA → $152.17 · 6M", target: 152.17, stop: 175.21, savedAt: "2026-11-14T02:08:00.000Z" }), Date.parse("2026-11-14T02:08:00Z"));
    assert.equal(second.trades.length, 2);
    assert.deepEqual(second.trades.map((t) => t.dir), ["Bear", "Bull"]); // newest first
    assert.notEqual(second.trades[0].id, second.trades[1].id);
  });

  it("three set-ups with different horizons all stay", () => {
    let trades: SavedTrade[] = [];
    for (const [i, hz] of ["1M", "6M", "12M"].entries()) {
      trades = addTrade(trades, base({ hz, savedAt: new Date(Date.UTC(2026, 10, 14, 2, i * 5)).toISOString() }), Date.UTC(2026, 10, 14, 2, i * 5)).trades;
    }
    assert.deepEqual(trades.map((t) => t.hz).sort(), ["12M", "1M", "6M"]);
  });

  it("saving the identical set-up twice within a minute (a double click) adds one", () => {
    const now = Date.parse("2026-11-14T02:00:10Z");
    const a = addTrade([], base(), Date.parse("2026-11-14T02:00:00Z"));
    const b = addTrade(a.trades, base(), now);
    assert.equal(b.trades.length, 1);
    assert.equal(b.trade.id, a.trade.id);
    // The same set-up saved an hour later is a new trade (new entry price and date).
    const c = addTrade(a.trades, base({ savedAt: "2026-11-14T03:00:00.000Z" }), Date.parse("2026-11-14T03:00:00Z"));
    assert.equal(c.trades.length, 2);
  });

  it("removing one trade leaves the others", () => {
    const a = addTrade([], base(), 1_000);
    const b = addTrade(a.trades, base({ dir: "Bear", savedAt: "2026-11-14T02:08:00.000Z" }), 2_000_000_000_000);
    const left = removeTrade(b.trades, b.trade.id);
    assert.equal(left.length, 1);
    assert.equal(left[0].id, a.trade.id);
  });
});

describe("storage", () => {
  it("round-trips the list, and an empty list removes the key", () => {
    const store = new FakeStore();
    const { trades } = addTrade([], base(), Date.parse("2026-11-14T02:00:00Z"));
    writeTrades(store, "nvda", trades);
    assert.equal(readTrades(store, "NVDA").length, 1);
    writeTrades(store, "NVDA", []);
    assert.equal(store.getItem(tradesKey("NVDA")), null);
  });

  it("moves the old one-trade-per-stock record into the list and removes the old key", () => {
    const store = new FakeStore();
    store.setItem("si_thesis_NVDA", JSON.stringify({ ...base({ dir: "Bear" }), savedDate: "Just now · Active" }));
    const trades = readTrades(store, "NVDA");
    assert.equal(trades.length, 1);
    assert.equal(trades[0].dir, "Bear");
    assert.ok(trades[0].id);
    assert.equal(store.getItem("si_thesis_NVDA"), null);
    // A new trade saved next to the migrated one keeps both.
    const next = addTrade(trades, base({ savedAt: "2026-11-14T05:00:00.000Z" }), Date.parse("2026-11-14T05:00:00Z"));
    writeTrades(store, "NVDA", next.trades);
    assert.equal(readTrades(store, "NVDA").length, 2);
  });

  it("migrating twice does not duplicate the old trade", () => {
    const store = new FakeStore();
    store.setItem("si_thesis_NVDA", JSON.stringify(base()));
    readTrades(store, "NVDA");
    store.setItem("si_thesis_NVDA", JSON.stringify(base())); // an old tab writes it again
    assert.equal(readTrades(store, "NVDA").length, 1);
  });

  it("ignores corrupt or foreign records", () => {
    const store = new FakeStore();
    store.setItem(tradesKey("NVDA"), "{not json");
    store.setItem("si_thesis_AMD", JSON.stringify({ nope: true }));
    assert.deepEqual(readTrades(store, "NVDA"), []);
    assert.deepEqual(listAllTrades(store), []);
  });

  it("lists every stock's trades, A to Z, newest first within a stock", () => {
    const store = new FakeStore();
    const nv1 = addTrade([], base({ savedAt: "2026-11-14T02:00:00.000Z" }), Date.parse("2026-11-14T02:00:00Z"));
    const nv2 = addTrade(nv1.trades, base({ dir: "Bear", savedAt: "2026-11-14T02:08:00.000Z" }), Date.parse("2026-11-14T02:08:00Z"));
    writeTrades(store, "NVDA", nv2.trades);
    writeTrades(store, "AMD", addTrade([], base({ ticker: "AMD", title: "LONG AMD" }), Date.parse("2026-11-13T10:00:00Z")).trades);
    store.setItem("si_thesis_SHOP", JSON.stringify(base({ ticker: "SHOP", hz: "12M" })));
    const all = listAllTrades(store);
    assert.deepEqual(all.map((t) => `${t.ticker}:${t.dir}`), ["AMD:Bull", "NVDA:Bear", "NVDA:Bull", "SHOP:Bull"]);
  });
});

describe("saved date", () => {
  it("is shown when the trade has a save time and blank when it has none", () => {
    assert.match(formatSavedAt("2026-11-14T02:08:00.000Z"), /2026/);
    assert.equal(formatSavedAt(undefined), "");
    assert.equal(formatSavedAt("garbage"), "");
  });
});
