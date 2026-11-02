import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { CATALOG, detectPatterns, patternsToShow, type PBar, type PatternHit } from "./index";

/* ── builders: textbook shapes ─────────────────────────────────────────── */

/** 12 bars falling (or rising) 1 per bar: small bodies (0.5), range 1.1 — sets the "trend into" the next bar. */
function trend(dir: "down" | "up", start = 120): PBar[] {
  const out: PBar[] = [];
  for (let k = 0; k < 12; k++) {
    const c = dir === "down" ? start - k : start + k, o = dir === "down" ? c + 0.5 : c - 0.5;
    out.push({ o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 });
  }
  return out;
}
const bar = (o: number, h: number, l: number, c: number, v = 1000): PBar => ({ o, h, l, c, v });
/** Bars along straight lines between waypoints [index, price]; each bar opens at the previous close with 0.2 wicks. */
function path2(points: Array<[number, number]>, wick = 0.2): PBar[] {
  const closes: number[] = [];
  for (let k = 0; k + 1 < points.length; k++) {
    const [i0, p0] = points[k], [i1, p1] = points[k + 1];
    for (let i = i0; i < i1; i++) closes.push(p0 + ((p1 - p0) * (i - i0)) / (i1 - i0));
  }
  closes.push(points[points.length - 1][1]);
  return closes.map((c, i) => {
    const o = i ? closes[i - 1] : c;
    return { o, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, c, v: 1000 };
  });
}
const ids = (hits: PatternHit[]) => new Set(hits.map((h) => h.id));
const endingAt = (hits: PatternHit[], i: number) => new Set(hits.filter((h) => h.i1 === i).map((h) => h.id));

describe("candlestick patterns (textbook shapes)", () => {
  it("hammer after a decline, hanging man after a rise", () => {
    const d = [...trend("down"), bar(108.2, 108.9, 106.2, 108.8)];
    assert.ok(endingAt(detectPatterns(d), d.length - 1).has("hammer"));
    const u = [...trend("up"), bar(131.2, 131.9, 129.2, 131.8)];
    assert.ok(endingAt(detectPatterns(u), u.length - 1).has("hanging-man"));
  });
  it("shooting star after a rise; dragonfly and gravestone doji", () => {
    const u = [...trend("up"), bar(132.2, 134.8, 131.6, 131.6)];
    assert.ok(endingAt(detectPatterns(u), u.length - 1).has("shooting-star"));
    const df = [...trend("down"), bar(109, 109.02, 106, 109.01)];
    assert.ok(endingAt(detectPatterns(df), df.length - 1).has("dragonfly-doji"));
    const gs = [...trend("up"), bar(131, 134, 130.98, 131.01)];
    assert.ok(endingAt(detectPatterns(gs), gs.length - 1).has("gravestone-doji"));
  });
  it("bullish engulfing, piercing line, harami", () => {
    const e = [...trend("down"), bar(109.5, 109.6, 107.9, 108), bar(107.8, 110.2, 107.7, 110)];
    assert.ok(endingAt(detectPatterns(e), e.length - 1).has("engulfing-bull"));
    const p = [...trend("down"), bar(110, 110.1, 107.9, 108), bar(107.5, 109.6, 107.4, 109.4)];
    assert.ok(endingAt(detectPatterns(p), p.length - 1).has("piercing-line"));
    const h = [...trend("down"), bar(111, 111.1, 107.9, 108), bar(109, 109.8, 108.8, 109.6)];
    assert.ok(endingAt(detectPatterns(h), h.length - 1).has("harami-bull"));
  });
  it("morning star and three white soldiers", () => {
    const m = [...trend("down"), bar(110, 110.1, 106.9, 107), bar(106.5, 106.8, 105.9, 106.3), bar(106.6, 109.4, 106.5, 109.2)];
    assert.ok(endingAt(detectPatterns(m), m.length - 1).has("morning-star"));
    const s = [...trend("down"), bar(109, 111.1, 108.9, 111), bar(110, 113.1, 109.9, 113), bar(112, 115.1, 111.9, 115)];
    assert.ok(endingAt(detectPatterns(s), s.length - 1).has("three-white-soldiers"));
  });
  it("a plain trend bar is not a reversal pattern", () => {
    const d = trend("down");
    const last = endingAt(detectPatterns(d), d.length - 1);
    for (const id of ["hammer", "engulfing-bull", "morning-star", "piercing-line"]) assert.ok(!last.has(id), id);
  });
});

describe("bar patterns and gaps", () => {
  it("inside bar, outside bar, NR7", () => {
    const b = [...trend("up"), bar(131, 133, 129, 132), bar(131.5, 132.5, 130, 132)];
    assert.ok(endingAt(detectPatterns(b), b.length - 1).has("inside-bar"));
    const o = [...trend("up"), bar(131, 132, 130, 131.5), bar(131.5, 133, 129, 132.5)];
    assert.ok(endingAt(detectPatterns(o), o.length - 1).has("outside-bar"));
    const n = [...trend("up"), bar(132, 132.2, 131.9, 132.1)];
    assert.ok(endingAt(detectPatterns(n), n.length - 1).has("nr7"));
  });
  it("an island top: gap up, bars held above, gap down", () => {
    const base = trend("up", 100); // last close 111, high ≤ 111.3
    const isl = [bar(114, 115, 113.8, 114.5), bar(114.5, 115.2, 114, 114.2), bar(114.2, 114.8, 113.9, 114)];
    const after = [bar(110, 110.5, 109, 109.5), bar(109.5, 110, 108.5, 109)];
    const hits = detectPatterns([...base, ...isl, ...after]);
    assert.ok(ids(hits).has("island-top"), [...ids(hits)].join(","));
  });
});

describe("chart patterns (price paths)", () => {
  it("double top confirmed on the close below the trough, with its target", () => {
    const b = path2([[0, 100], [20, 120], [30, 110], [40, 120.2], [55, 100]]);
    const h = detectPatterns(b).find((q) => q.id === "double-top" || q.id === "big-m");
    assert.ok(h, "double top");
    assert.equal(h!.confirmed, true);
    assert.ok(Math.abs(h!.target! - (110 - (120 - 110))) < 1.5);
  });
  it("head and shoulders: head above both shoulders, neckline break", () => {
    const b = path2([[0, 90], [15, 110], [25, 100], [40, 120], [55, 100], [70, 110], [85, 88]]);
    const h = detectPatterns(b).find((q) => q.id === "head-shoulders-top");
    assert.ok(h, "head and shoulders");
    assert.equal(h!.confirmed, true);
    assert.deepEqual(h!.points!.map((p) => p.label), ["LS", "H", "RS"]);
  });
  it("ascending triangle: flat highs, rising lows", () => {
    const b = path2([[0, 90], [10, 110], [20, 96], [30, 110], [40, 101], [50, 110], [58, 105.5]]);
    assert.ok(ids(detectPatterns(b)).has("triangle-ascending"), [...ids(detectPatterns(b))].join(","));
  });
  it("bull flag: sharp pole, tight pullback, breakout", () => {
    const b = path2([[0, 100], [20, 100.5], [30, 130], [38, 126], [40, 127], [44, 125], [50, 134]], 0.15);
    assert.ok([...ids(detectPatterns(b))].some((id) => id === "flag-bull" || id === "pennant-bull"));
  });
  it("cup and handle confirmed above the rim", () => {
    const pts: Array<[number, number]> = [[0, 90], [10, 120]];
    for (let k = 1; k <= 30; k++) pts.push([10 + k, 120 - 25 * Math.sin((Math.PI * k) / 30)]);
    pts.push([47, 113], [52, 124]);
    assert.ok(ids(detectPatterns(path2(pts))).has("cup-handle"));
  });
  it("rounding bottom from a parabola", () => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 45; k++) pts.push([k, 100 + 30 * ((k - 22.5) / 22.5) ** 2]);
    assert.ok(ids(detectPatterns(path2(pts, 0.05))).has("rounding-bottom"));
  });
  it("Gartley from exact ratios", () => {
    // X 100 → A 130 (XA 30) → B 111.46 (61.8%) → C 123 → D 106.42 (78.6% of XA)
    const b = path2([[0, 100], [15, 130], [25, 111.46], [35, 123], [50, 106.42], [56, 112]]);
    assert.ok(ids(detectPatterns(b)).has("gartley-bull"), [...ids(detectPatterns(b))].join(","));
  });
});

/* ── real data ───────────────────────────────────────────────────────── */

const FX = path.join(import.meta.dirname, "../../../tests/strategy-lab/fixtures/fmp-bars-2026-10-30.json");
const fx = JSON.parse(fs.readFileSync(FX, "utf-8"));
const rows = (a: Array<[string, number, number, number, number, number]>): PBar[] => a.map(([, o, h, l, c, v]) => ({ o, h, l, c, v }));

describe("real FMP bars (AAPL / NVDA / MSFT daily, AAPL 5-minute)", () => {
  const sets: Array<[string, PBar[], boolean]> = [
    ...(["AAPL", "NVDA", "MSFT"] as const).map((t) => [t + " daily", rows(fx.daily[t]), true] as [string, PBar[], boolean]),
    ["AAPL 5m", rows(fx.m5.AAPL), false],
  ];
  for (const [name, bars, daily] of sets) {
    it(`${name}: every hit is a catalogued pattern inside the series, and candle hits hold their rule on the raw bars`, () => {
      const hits = detectPatterns(bars, { daily });
      assert.ok(hits.length > 0);
      for (const h of hits) {
        assert.ok(CATALOG[h.id], h.id);
        assert.ok(h.i0 >= 0 && h.i0 <= h.i1 && h.i1 < bars.length && h.at >= h.i0 && h.at <= h.i1, `${h.id} ${h.i0}-${h.i1}`);
        const b = bars[h.i1], a = bars[h.i1 - 1];
        const rng = b.h - b.l, body = Math.abs(b.c - b.o);
        if (h.id === "doji") assert.ok(body <= 0.1 * rng + 1e-9);
        if (h.id === "engulfing-bull") assert.ok(a.c < a.o && b.c > b.o && b.o <= a.c && b.c >= a.o);
        if (h.id === "engulfing-bear") assert.ok(a.c > a.o && b.c < b.o && b.o >= a.c && b.c <= a.o);
        if (h.id === "inside-bar") assert.ok(b.h < a.h && b.l > a.l);
        if (h.id === "outside-bar") assert.ok(b.h > a.h && b.l < a.l);
        if (h.id === "nr7") assert.ok(bars.slice(h.i1 - 6, h.i1).every((q) => q.h - q.l > rng));
        if (h.id === "hammer") assert.ok(Math.min(b.o, b.c) - b.l >= 2 * body && b.h - Math.max(b.o, b.c) <= 0.1 * rng + 1e-9);
      }
      assert.deepEqual(detectPatterns(bars, { daily }), hits, "deterministic");
    });
  }
  it("what a chart shows: at most 6 candle marks (one per bar) and 6 larger patterns in view", () => {
    const bars = rows(fx.daily.NVDA), hits = detectPatterns(bars, { daily: true });
    const shown = patternsToShow(hits, bars.length - 120, bars.length - 1);
    const small = shown.filter((h) => h.group === "candle" || h.group === "bar");
    assert.ok(small.length <= 6 && shown.length - small.length <= 6);
    assert.equal(new Set(small.map((h) => h.at)).size, small.length);
  });
});
