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

describe("trades saved by an older build (no id, no save time)", () => {
  // The old single-trade record per stock: no `id`, no `savedAt`.
  const oldRecord = (ticker: string, over: Record<string, unknown> = {}) => ({ ticker, dir: "Bull", hz: "6M", title: `LONG ${ticker}`, target: 200, stop: 150, confAtSave: 70, savedDate: "Just now · Active", ...over });
  const withOld = (...tickers: string[]) => {
    const store = new FakeStore();
    for (const t of tickers) store.setItem(`si_thesis_${t}`, JSON.stringify(oldRecord(t)));
    return store;
  };

  it("old trades in different stocks get different ids (they used to share t-0, so the tracker list had three rows with one key)", () => {
    const all = listAllTrades(withOld("AAPL", "MSFT", "NVDA"));
    assert.equal(all.length, 3);
    assert.equal(new Set(all.map((t) => t.id)).size, 3, `ids: ${all.map((t) => t.id).join(", ")}`);
    assert.ok(all.every((t) => !/^t-0$/.test(t.id)));
  });

  it("two id-less trades in one stock's list get different ids", () => {
    const store = new FakeStore();
    store.setItem(tradesKey("NVDA"), JSON.stringify([oldRecord("NVDA"), oldRecord("NVDA", { dir: "Bear", title: "SHORT NVDA", target: 130, stop: 180 })]));
    const list = readTrades(store, "NVDA");
    assert.equal(list.length, 2);
    assert.notEqual(list[0].id, list[1].id);
  });

  it("ids stay the same on every read, so a selected or half-deleted row keeps its identity", () => {
    const store = new FakeStore();
    store.setItem(tradesKey("NVDA"), JSON.stringify([oldRecord("NVDA"), oldRecord("NVDA", { dir: "Bear", target: 130, stop: 180 })]));
    assert.deepEqual(readTrades(store, "NVDA").map((t) => t.id), readTrades(store, "NVDA").map((t) => t.id));
  });

  it("removing one old trade removes only that one", () => {
    const all = listAllTrades(withOld("AAPL", "MSFT", "NVDA"));
    const msft = all.find((t) => t.ticker === "MSFT")!;
    const left = removeTrade(all, msft.id);
    assert.deepEqual(left.map((t) => t.ticker), ["AAPL", "NVDA"]);
  });

  it("a trade that already has an id keeps it", () => {
    const store = new FakeStore();
    store.setItem(tradesKey("NVDA"), JSON.stringify([{ ...oldRecord("NVDA"), id: "abc-1234", savedAt: "2026-11-14T02:00:00.000Z" }]));
    assert.equal(readTrades(store, "NVDA")[0].id, "abc-1234");
  });
});

describe("trades already migrated by the earlier build (id `t-0` stored)", () => {
  const stored = (ticker: string, id: string) => ({ id, ticker, dir: "Bull", hz: "6M", title: `LONG ${ticker}`, target: 200, stop: 150, confAtSave: 70, savedDate: "Just now · Active" });
  const storeWith = (...rows: Array<[string, string]>) => {
    const store = new FakeStore();
    for (const [ticker, id] of rows) store.setItem(tradesKey(ticker), JSON.stringify([stored(ticker, id)]));
    return store;
  };

  it("a browser that already saved three trades as `t-0` reads them back with three different ids", () => {
    const all = listAllTrades(storeWith(["AAPL", "t-0"], ["MSFT", "t-0"], ["NVDA", "t-0"]));
    assert.equal(all.length, 3);
    assert.equal(new Set(all.map((t) => t.id)).size, 3, `ids: ${all.map((t) => t.id).join(", ")}`);
  });

  it("the old `t-<time>` shape is replaced whatever the number", () => {
    const all = listAllTrades(storeWith(["AAPL", "t-1731550000000"], ["MSFT", "t-1731550000000"]));
    assert.equal(new Set(all.map((t) => t.id)).size, 2);
  });

  it("real ids, as addTrade makes them, are never replaced", () => {
    const { trade } = addTrade([], { ticker: "NVDA", dir: "Bull", hz: "6M", title: "LONG NVDA", target: 200, stop: 150, confAtSave: 60, savedDate: "Just now", savedAt: "2026-11-14T02:00:00.000Z" }, Date.parse("2026-11-14T02:00:00Z"), "ab12");
    const store = new FakeStore();
    writeTrades(store, "NVDA", [trade]);
    assert.equal(readTrades(store, "NVDA")[0].id, trade.id);
    assert.ok(!/^t-\d+$/.test(trade.id));
  });

  it("the replacement is the same on every read", () => {
    const store = storeWith(["AAPL", "t-0"], ["NVDA", "t-0"]);
    assert.deepEqual(listAllTrades(store).map((t) => t.id), listAllTrades(store).map((t) => t.id));
  });
});
