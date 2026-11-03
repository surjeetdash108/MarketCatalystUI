import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fullChartInterval, groupBars, smcOverlays, type SmcLayers } from "./smc";
import { computeFvgs, computeOrderBlocks } from "./engine";
import { etSessionDate } from "../indicators";

/** Real AAPL 1-minute bars for 2026-10-29 (same fixture as engine.spec.ts). */
const fx = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/money-flow-2026-10-29.json"), "utf-8"));
const raw: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = fx.aapl1m;
const m1 = raw.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));

const OFF: SmcLayers = { ob: false, vwap: false, fvg: false, liq: false, str: false, pat: false };
const only = (k: keyof SmcLayers): SmcLayers => ({ ...OFF, [k]: true });

describe("Full chart: bars for the pop-up's timeframe", () => {
  it("asks the backend for the candle size it has; 3m is built from 1m", () => {
    assert.deepEqual(fullChartInterval(1), { interval: "1m", group: 1 });
    assert.deepEqual(fullChartInterval(3), { interval: "1m", group: 3 });
    assert.deepEqual(fullChartInterval(5), { interval: "5m", group: 1 });
    assert.deepEqual(fullChartInterval(15), { interval: "15m", group: 1 });
  });
  it("groups 1-minute bars into 3-minute candles aligned to the 9:30 open", () => {
    assert.ok(m1.length > 30, "fixture has 1-minute bars");
    const g = groupBars(m1, 3);
    const first = m1.slice(0, 3);
    assert.equal(g[0].t, m1[0].t);
    assert.equal(g[0].o, first[0].o);
    assert.equal(g[0].c, first[2].c);
    assert.equal(g[0].h, Math.max(...first.map((b) => b.h)));
    assert.equal(g[0].l, Math.min(...first.map((b) => b.l)));
    assert.equal(g[0].v, first.reduce((s, b) => s + b.v, 0));
    assert.equal(g.length, new Set(m1.map((b) => Math.floor(b.t / 180_000))).size);
  });
});

describe("Full chart overlays (Order blocks, FVG, Liquidity, Structure)", () => {
  const bars = groupBars(m1, 5);
  it("draws nothing with every layer off, and nothing of its own for VWAP or Patterns (the chart draws those)", () => {
    assert.deepEqual(smcOverlays(bars, OFF, 5), []);
    assert.deepEqual(smcOverlays(bars, { ...OFF, vwap: true, pat: true }, 5), []);
  });
  it("order blocks: one box per block, open ones run to the right edge and are labelled", () => {
    const obs = computeOrderBlocks(bars).slice(-12);
    const ops = smcOverlays(bars, only("ob"), 5);
    assert.equal(ops.length, obs.length);
    ops.forEach((o, k) => {
      assert.equal(o.k, "box");
      if (o.k !== "box") return;
      assert.equal(o.i0, obs[k].i);
      assert.equal(o.i1, obs[k].mit ? obs[k].end + 1 : null);
      assert.equal(o.label, obs[k].mit ? undefined : obs[k].bull ? "BULL OB" : "BEAR OB");
    });
  });
  it("FVGs: the same gaps as the pop-up", () => {
    const f = computeFvgs(bars);
    const ops = smcOverlays(bars, only("fvg"), 5);
    assert.deepEqual(ops.map((o) => (o.k === "box" ? [o.i0, o.lo, o.hi] : null)), f.map((g) => [g.i, g.lo, g.hi]));
  });
  it("liquidity: unswept swings run to the right edge with a BSL/SSL price, swept ones stop where they were taken", () => {
    const ops = smcOverlays(bars, only("liq"), 5);
    assert.ok(ops.length > 0 && ops.length <= 10);
    for (const o of ops) {
      assert.equal(o.k, "line");
      if (o.k !== "line") continue;
      if (o.i1 == null) assert.match(o.label ?? "", /^(BSL|SSL) \d/);
      else assert.equal(o.label, "✕ swept");
    }
  });
  it("structure: day range, EQ, opening range and HOD/LOD come from the latest session only", () => {
    const two = [...groupBars(m1, 5).map((b) => ({ ...b, t: b.t - 86_400_000, h: b.h + 50, l: b.l - 50 })), ...bars];
    const ops = smcOverlays(two, only("str"), 5);
    const last = etSessionDate(two[two.length - 1].t);
    const day = two.filter((b) => etSessionDate(b.t) === last);
    const hod = Math.max(...day.map((b) => b.h)), lod = Math.min(...day.map((b) => b.l));
    const txt = ops.filter((o) => o.k === "text").map((o) => (o.k === "text" ? o.text : ""));
    assert.ok(txt.some((t) => t.includes(`HOD $${hod.toFixed(2)}`)), "HOD is today's high, not yesterday's");
    assert.ok(txt.some((t) => t.includes(`LOD $${lod.toFixed(2)}`)));
    const eq = ops.find((o) => o.k === "line" && o.label === "EQ 50%");
    assert.ok(eq && eq.k === "line" && Math.abs(eq.p - (hod + lod) / 2) < 1e-9);
    const pdh = ops.find((o) => o.k === "line" && (o.label ?? "").startsWith("PDH"));
    assert.ok(pdh && pdh.k === "line" && Math.abs(pdh.p - Math.max(...two.slice(0, two.length - bars.length).map((b) => b.h))) < 1e-9, "PDH from the previous session");
  });
});
