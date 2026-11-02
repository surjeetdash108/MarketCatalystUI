// Progressive Strategy Lab scan: results stream in per stock, the first three
// matches stay put, row 4 counts the rest, tiles cover every match so far, and
// a result from an old run is never mixed into a new one.
// Rows are computed by the real pipeline (computeRow) on real FMP bars.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { valCfg } from "../../app/iq/sl/lab-config.js";
import { acceptRow, computeRow, fetchWithRetry, newRunState, prepBars, progressiveView, scanChunk, universeUrl, windowStats, windowSummary } from "../../app/iq/sl/lab-run.js";

const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/fmp-bars-2026-10-30.json", import.meta.url), "utf8"));
const rows = (a) => a.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }));
// "Close above its 20-day average" holds on the last bar for some stocks, not others.
const SPEC = { entry: [{ a: { ind: "close" }, op: ">", b: { ind: "sma", n: 20 } }], exit: [{ a: { ind: "close" }, op: "<", b: { ind: "sma", n: 50 } }] };
const CFG = valCfg({ yrs: "1" }, "d");
const real = Object.fromEntries(["AAPL", "NVDA", "MSFT"].map((t) => [t, computeRow(t, t, prepBars(rows(fx.daily[t]), "d"), SPEC, CFG, "d")]));
/** A stream of results: the real rows, re-labelled as more stocks, alternating matched / not matched. */
function stream(n) {
  const base = Object.values(real), out = [];
  for (let i = 0; i < n; i++) { const r = base[i % base.length]; out.push({ ...r, t: r.t + "_" + i, ago: i % 3 === 2 ? null : 0, sh: r.sh + i / 100 }); }
  return out;
}
const statOf = (r) => windowStats(r, 4, false);

describe("run accumulator", () => {
  it("appends results of the current run in arrival order and drops results of an old run", () => {
    let s = newRunState(7, 10);
    const [a, b, c] = stream(3);
    s = acceptRow(s, 7, a);
    s = acceptRow(s, 7, b);
    const before = s;
    assert.equal(acceptRow(s, 6, c), before, "a stale run's result leaves the state untouched");
    s = acceptRow(s, 7, { t: "X", status: "unavailable" });
    s = acceptRow(s, 7, { t: "Y", status: "insufficient" });
    assert.deepEqual(s.rows.map((r) => r.t), [a.t, b.t]);
    assert.equal(s.done, 4);
    assert.equal(s.fail, 1);
    assert.equal(s.insuf, 1);
  });
});

describe("progressive view", () => {
  it("scanning with no match yet", () => {
    const v = progressiveView({ ...newRunState(1, 50), done: 12, busy: true }, statOf, false);
    assert.equal(v.state, "scanning-empty");
    assert.equal(v.head, "Scanning… no matches so far (12/50)");
    assert.equal(v.visible.length, 0);
    assert.equal(v.more, null);
  });

  it("first three matches stay fixed while later ones arrive; row 4 counts the rest live", () => {
    let s = newRunState(1, 40);
    const all = stream(12);
    s.busy = true;
    for (const r of all.slice(0, 5)) s = acceptRow(s, 1, r);
    const v1 = progressiveView(s, statOf, false);
    const first3 = v1.visible.map((r) => r.t);
    assert.equal(first3.length, 3);
    assert.equal(v1.matches, 4); // 5 results, one without a match
    assert.equal(v1.more.label, "+1 more stock matches · scanning 5/40 → View all");
    for (const r of all.slice(5)) s = acceptRow(s, 1, r);
    const v2 = progressiveView(s, statOf, false);
    assert.deepEqual(v2.visible.map((r) => r.t), first3, "the first three never reshuffle");
    assert.equal(v2.matches, 8);
    assert.equal(v2.more.label, "+5 more stocks match · scanning 12/40 → View all");
    assert.equal(v2.soFar, true);
    const done = progressiveView({ ...s, busy: false }, statOf, false);
    assert.equal(done.more.label, "View all 8 matches");
    assert.equal(done.soFar, false);
  });

  it("expanded: every match in the existing order (Signal, then Sharpe), with Show less", () => {
    let s = newRunState(1, 12);
    for (const r of stream(12)) s = acceptRow(s, 1, r);
    const v = progressiveView(s, statOf, true);
    assert.equal(v.visible.length, 8);
    const sh = v.visible.map((r) => r.sh);
    assert.deepEqual(sh, [...sh].sort((a, b) => b - a));
    assert.equal(v.less, true);
    assert.equal(v.more, null);
  });

  it("no row 4 with three matches or fewer; finished with none is the empty state", () => {
    let s = newRunState(1, 4);
    for (const r of stream(4)) s = acceptRow(s, 1, r); // 3 matches
    const v = progressiveView(s, statOf, false);
    assert.equal(v.matches, 3);
    assert.equal(v.more, null);
    let e = newRunState(1, 2);
    e = acceptRow(e, 1, { ...real.AAPL, ago: null });
    e = acceptRow(e, 1, { ...real.NVDA, ago: 3 });
    assert.equal(progressiveView({ ...e, busy: false }, statOf, false).state, "empty");
  });

  it("tiles use every match so far with the existing formulas, and equal the final tiles on the same rows", () => {
    let s = newRunState(1, 12);
    s.busy = true;
    for (const r of stream(12)) s = acceptRow(s, 1, r);
    const partial = progressiveView(s, statOf, false).summary;
    const full = windowSummary(s.rows, statOf, true);
    assert.deepEqual(partial, full);
    assert.equal(partial.n, 8);
    assert.deepEqual(progressiveView({ ...s, busy: false }, statOf, false).summary, full);
  });

  it("a different return window recomputes from the stored rows only", () => {
    let s = newRunState(1, 3);
    for (const r of Object.values(real)) s = acceptRow(s, 1, { ...r, ago: 0 });
    const w30 = progressiveView(s, (r) => windowStats(r, 30, false), false).summary;
    const w4 = progressiveView(s, statOf, false).summary;
    assert.equal(w30.n, w4.n);
    assert.notDeepEqual(w30, w4);
  });
});

describe("fetch with retry", () => {
  const data = Object.fromEntries(["AAPL", "NVDA", "MSFT"].map((t) => [t, rows(fx.daily[t])]));
  it("retries a failed chunk once, then each missing symbol once, then gives up on it", async () => {
    const calls = [];
    let n = 0;
    const fetchChunk = async (syms) => {
      calls.push(syms.join(","));
      n++;
      if (n === 1) throw new Error("502");
      return Object.fromEntries(syms.map((t) => [t, t === "MSFT" ? null : data[t]]));
    };
    const r = await fetchWithRetry(["AAPL", "NVDA", "MSFT"], fetchChunk);
    assert.deepEqual(calls, ["AAPL,NVDA,MSFT", "AAPL,NVDA,MSFT", "MSFT"]);
    assert.equal(r.bars.AAPL.length, data.AAPL.length);
    assert.equal(r.bars.MSFT, null);
    assert.deepEqual(r.unavailable, ["MSFT"]);
  });
  it("stops at once when the run is cancelled", async () => {
    const ac = new AbortController();
    ac.abort();
    let called = 0;
    const r = await fetchWithRetry(["AAPL"], async () => { called++; throw new DOMException("aborted", "AbortError"); }, ac.signal);
    assert.equal(called, 1);
    assert.equal(r.aborted, true);
  });
});

describe("scan chunks", () => {
  it("three symbols on each worker's first request, then 10 daily / 4 intraday", () => {
    assert.equal(scanChunk("d", 0), 3);
    assert.equal(scanChunk("d", 1), 10);
    assert.equal(scanChunk("5m", 1), 4);
  });
  it("before the universe loads the count reads … not 0", () => {
    assert.equal(progressiveView({ ...newRunState(1, 0), busy: true }, () => null, false).head, "Scanning… no matches so far (0/…)");
  });
});

describe("universe request", () => {
  it("asks for the candle's universe (full S&P 500 unless the server caps it)", () => {
    assert.equal(universeUrl("d"), "/live/strategy-lab/universe?tf=d");
    assert.equal(universeUrl("5m"), "/live/strategy-lab/universe?tf=5m");
  });
});
