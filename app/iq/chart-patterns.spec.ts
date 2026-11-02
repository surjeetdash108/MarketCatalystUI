import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { chartPatternOptions, chartPatterns, patternDrawOps } from "./chart-patterns";

/** Real FMP daily bars (NVDA, 2024-10-01 → 2026-10-30). */
const fx = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../tests/strategy-lab/fixtures/fmp-bars-2026-10-30.json"), "utf-8"));
const bars = (fx.daily.NVDA as Array<[string, number, number, number, number, number]>).map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T21:00:00Z"), o, h, l, c, v }));

describe("Market Catalyst chart: Pattern overlay", () => {
  it("picks daily / weekly options from the bars' spacing", () => {
    assert.deepEqual(chartPatternOptions(bars, false), { daily: true, weekly: false });
    const weekly = bars.filter((_, k) => k % 5 === 0);
    assert.deepEqual(chartPatternOptions(weekly, false), { daily: true, weekly: true });
    assert.deepEqual(chartPatternOptions(bars, true), { daily: false });
  });
  it("draws the last 120 bars' patterns inside the plot with no two name tags overlapping", () => {
    const hits = chartPatterns(bars, false);
    const from = bars.length - 120, to = bars.length - 1;
    const plot = { l: 8, r: 900, top: 14, bottom: 400 };
    const lo = Math.min(...bars.slice(from).map((b) => b.l)), hi = Math.max(...bars.slice(from).map((b) => b.h));
    const xOf = (i: number) => plot.l + ((i - from + 0.5) / (to - from + 1)) * (plot.r - plot.l);
    const yOf = (p: number) => plot.top + ((hi - p) / (hi - lo)) * (plot.bottom - plot.top);
    const ops = patternDrawOps(hits, from, to, xOf, yOf, plot);
    assert.ok(ops.tags.length > 0 && ops.tags.length <= 12);
    for (const t of ops.tags) assert.ok(t.x >= plot.l && t.x + t.w <= plot.r + 0.01 && t.y >= plot.top && t.y + t.h <= plot.bottom + 0.01);
    for (let a = 0; a < ops.tags.length; a++)
      for (let b = a + 1; b < ops.tags.length; b++) {
        const p = ops.tags[a], q = ops.tags[b];
        const clash = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
        // tags clamped at the plot edge may meet; elsewhere none overlap
        if (p.y > plot.top && q.y > plot.top && p.y + p.h < plot.bottom && q.y + q.h < plot.bottom) assert.ok(!clash, `${p.text} / ${q.text}`);
      }
    for (const c of [...ops.lines, ...ops.tags].map((o) => o.color)) assert.ok(["#3ddc84", "#f0565a", "#7fa8d0"].includes(c));
  });
});
