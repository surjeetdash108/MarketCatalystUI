import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PEER_SORT, PEER_DEFAULT_LIMIT, mergePeers, nextPeerSort, peerView, sortPeers, topByMarketCap,
  type PeerLike,
} from "./peer-table";

// Market caps in $B. A pool like NVDA's: the vendor's 10 related names plus the rest of its industry.
const peer = (t: string, marketCap: number | null, over: Partial<PeerLike> = {}): PeerLike => ({
  t, c: 0, price: 100, marketCap, peRatio: 20, rsRating: 50, name: `${t} Inc.`, weeklyChange: 0, monthlyChange: 0, ...over,
});
const ts = (rows: PeerLike[]) => rows.map(r => r.t);

/** 40 peers, P01 the largest ($1000B) down to P40 ($1B). */
const pool40 = Array.from({ length: 40 }, (_, i) => peer(`P${String(i + 1).padStart(2, "0")}`, 1000 - i * 25));

describe("default view: the largest 25 by market cap", () => {
  it("keeps the 25 largest and orders them by market cap, largest first", () => {
    const v = peerView(pool40, { query: "", ...DEFAULT_PEER_SORT, showAll: false });
    assert.equal(v.rows.length, PEER_DEFAULT_LIMIT);
    assert.equal(v.rows[0].t, "P01");
    assert.equal(v.rows[24].t, "P25");
    assert.equal(v.matched, 40);
    assert.equal(v.limited, true);
  });

  it("does not depend on the order the pool arrives in", () => {
    const shuffled = [...pool40].reverse();
    assert.deepEqual(ts(topByMarketCap(shuffled)), ts(topByMarketCap(pool40)));
  });

  it("a stock with no market cap ranks below every stock that has one", () => {
    const withGap = [...pool40.slice(0, 25), peer("NOCAP", null)];
    assert.equal(topByMarketCap(withGap, 25).some(p => p.t === "NOCAP"), false);
    assert.equal(topByMarketCap(withGap, 26)[25].t, "NOCAP");
  });

  it("a pool of 25 or fewer is shown whole, not marked as limited", () => {
    const v = peerView(pool40.slice(0, 10), { query: "", ...DEFAULT_PEER_SORT, showAll: false });
    assert.equal(v.rows.length, 10);
    assert.equal(v.limited, false);
  });

  it("show all lifts the cap", () => {
    const v = peerView(pool40, { query: "", ...DEFAULT_PEER_SORT, showAll: true });
    assert.equal(v.rows.length, 40);
    assert.equal(v.limited, false);
  });
});

describe("sorting by a clicked column header", () => {
  it("the cap is applied first: sorting reorders the 25 largest, it does not pull in small ones", () => {
    const pool = pool40.map((p, i) => ({ ...p, c: i })); // the smallest company moved the most
    const v = peerView(pool, { query: "", by: "c", dir: "desc", showAll: false });
    assert.equal(v.rows.length, 25);
    assert.equal(v.rows[0].t, "P25", "highest % change among the 25 largest");
    assert.equal(v.rows.some(r => r.t === "P40"), false);
  });

  it("after Show all, the column orders everyone", () => {
    const pool = pool40.map((p, i) => ({ ...p, c: i }));
    const v = peerView(pool, { query: "", by: "c", dir: "desc", showAll: true });
    assert.equal(v.rows[0].t, "P40");
  });

  it("a new column starts at its first direction: numbers biggest first, tickers A to Z", () => {
    assert.deepEqual(nextPeerSort(DEFAULT_PEER_SORT, "c"), { by: "c", dir: "desc" });
    assert.deepEqual(nextPeerSort(DEFAULT_PEER_SORT, "sym"), { by: "sym", dir: "asc" });
  });

  it("clicking the same column again flips it, and again flips it back", () => {
    const a = nextPeerSort({ by: "c", dir: "desc" }, "c");
    assert.deepEqual(a, { by: "c", dir: "asc" });
    assert.deepEqual(nextPeerSort(a, "c"), { by: "c", dir: "desc" });
  });

  it("every column sorts: price, change, weekly, monthly, market cap, P/E, RS, ticker", () => {
    const rows = [
      peer("B", 20, { price: 5, c: 1, weeklyChange: -5, monthlyChange: 10, peRatio: 30, rsRating: 90 }),
      peer("A", 30, { price: 50, c: -2, weeklyChange: 3, monthlyChange: -4, peRatio: 10, rsRating: 40 }),
      peer("C", 10, { price: 20, c: 4, weeklyChange: 9, monthlyChange: 2, peRatio: 20, rsRating: 70 }),
    ];
    assert.deepEqual(ts(sortPeers(rows, "price", "desc")), ["A", "C", "B"]);
    assert.deepEqual(ts(sortPeers(rows, "c", "desc")), ["C", "B", "A"]);
    assert.deepEqual(ts(sortPeers(rows, "w", "desc")), ["C", "A", "B"]);
    assert.deepEqual(ts(sortPeers(rows, "m", "desc")), ["B", "C", "A"]);
    assert.deepEqual(ts(sortPeers(rows, "mcap", "desc")), ["A", "B", "C"]);
    assert.deepEqual(ts(sortPeers(rows, "pe", "desc")), ["B", "C", "A"]);
    assert.deepEqual(ts(sortPeers(rows, "rs", "desc")), ["B", "C", "A"]);
    assert.deepEqual(ts(sortPeers(rows, "sym", "asc")), ["A", "B", "C"]);
    assert.deepEqual(ts(sortPeers(rows, "sym", "desc")), ["C", "B", "A"]);
    assert.deepEqual(ts(sortPeers(rows, "price", "asc")), ["B", "C", "A"]);
  });

  it("a missing value is last whichever way the column is sorted", () => {
    const rows = [peer("HAS", 5, { rsRating: 10 }), peer("NONE", 9, { rsRating: null }), peer("TOP", 7, { rsRating: 99 })];
    assert.deepEqual(ts(sortPeers(rows, "rs", "desc")), ["TOP", "HAS", "NONE"]);
    assert.deepEqual(ts(sortPeers(rows, "rs", "asc")), ["HAS", "TOP", "NONE"]);
  });

  it("a P/E of zero or below is the table's 'n/a', so it sorts as empty", () => {
    const rows = [peer("LOSS", 5, { peRatio: -3 }), peer("LOW", 5, { peRatio: 8 }), peer("HIGH", 5, { peRatio: 40 })];
    assert.deepEqual(ts(sortPeers(rows, "pe", "asc")), ["LOW", "HIGH", "LOSS"]);
    assert.deepEqual(ts(sortPeers(rows, "pe", "desc")), ["HIGH", "LOW", "LOSS"]);
  });

  it("ties fall back to the ticker, so the order never jumps between renders", () => {
    const rows = [peer("ZZZ", 5, { rsRating: 50 }), peer("AAA", 5, { rsRating: 50 }), peer("MMM", 5, { rsRating: 50 })];
    assert.deepEqual(ts(sortPeers(rows, "rs", "desc")), ["AAA", "MMM", "ZZZ"]);
  });
});

describe("the filter box", () => {
  it("searches the whole pool, so a peer outside the default 25 is still found", () => {
    const v = peerView(pool40, { query: "p40", ...DEFAULT_PEER_SORT, showAll: false });
    assert.deepEqual(ts(v.rows), ["P40"]);
    assert.equal(v.limited, false);
  });

  it("matches the company name too, and shows every match without the cap", () => {
    const v = peerView(pool40, { query: " inc", ...DEFAULT_PEER_SORT, showAll: false });
    assert.equal(v.rows.length, 40, "every name contains 'Inc.', and a search is not capped");
    assert.equal(v.matched, 40);
  });

  it("no match gives no rows", () => {
    assert.deepEqual(peerView(pool40, { query: "zzzz", ...DEFAULT_PEER_SORT, showAll: false }).rows, []);
  });
});

describe("mergePeers", () => {
  it("joins lists by ticker and the first list's row wins", () => {
    const vendor = [peer("AMD", 696, { weeklyChange: -20.54 })];
    const industry = [peer("AMD", 696, { weeklyChange: null }), peer("TXN", 190)];
    const merged = mergePeers(vendor, industry);
    assert.deepEqual(ts(merged), ["AMD", "TXN"]);
    assert.equal(merged[0].weeklyChange, -20.54);
  });
});

describe("does not change what it is given", () => {
  it("sorting and the cap return new arrays", () => {
    const before = ts(pool40);
    peerView(pool40, { query: "", by: "sym", dir: "desc", showAll: false });
    sortPeers(pool40, "rs", "asc");
    assert.deepEqual(ts(pool40), before);
  });
});
