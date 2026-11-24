import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asOfLabel, framePct, heatGradient, heatTile, NO_DATA_TILE, squarify, packStocks, MORE_KEY, tileFontRem } from "./heatmap-design";

describe("heatTile", () => {
  it("is the same slate at 0%, saturates at ±3% and does not go past it", () => {
    assert.equal(heatTile(0).bg, "rgb(47,58,64)");
    assert.equal(heatTile(3).bg, "rgb(24,166,84)");
    assert.equal(heatTile(9).bg, heatTile(3).bg);
    assert.equal(heatTile(-3).bg, "rgb(214,69,75)");
    assert.equal(heatTile(-12).bg, heatTile(-3).bg);
  });
  it("blends between the stops", () => {
    // halfway between the +1 and +2 stops
    assert.equal(heatTile(1.5).bg, "rgb(39,115,80)");
  });
  it("greens up and reds down; the colour-blind palette uses blue and orange instead", () => {
    const g = heatTile(2).bg.match(/\d+/g)!.map(Number);
    const r = heatTile(-2).bg.match(/\d+/g)!.map(Number);
    assert.ok(g[1] > g[0] && g[1] > g[2], "up is green-dominant");
    assert.ok(r[0] > r[1] && r[0] > r[2], "down is red-dominant");
    const up = heatTile(3, true).bg.match(/\d+/g)!.map(Number);
    const down = heatTile(-3, true).bg.match(/\d+/g)!.map(Number);
    assert.ok(up[2] > up[0], "up is blue");
    assert.ok(down[0] > down[2], "down is orange");
  });
  it("no change known: a tile darker than a flat one, never a 0% tile", () => {
    for (const v of [null, undefined, NaN]) assert.deepEqual(heatTile(v), NO_DATA_TILE);
    assert.notEqual(NO_DATA_TILE.bg, heatTile(0).bg);
  });
});

describe("heatGradient", () => {
  it("runs from the −3% colour to the +3% colour", () => {
    const g = heatGradient();
    assert.match(g, /^linear-gradient\(to right, rgb\(214,69,75\) 0\.0%/);
    assert.match(g, /rgb\(24,166,84\) 100\.0%\)$/);
    assert.match(g, /rgb\(47,58,64\) 50\.0%/);
  });
});

describe("framePct", () => {
  const co = { week5ChangePct: 2.5, monthChangePct: -4.1 };
  it("1D is the live day move; 1W and 1M read the synced fields", () => {
    assert.equal(framePct("1D", 0.8, co), 0.8);
    assert.equal(framePct("1W", 0.8, co), 2.5);
    assert.equal(framePct("1M", 0.8, co), -4.1);
  });
  it("a field that is not synced is null, never the day move; YTD is always null", () => {
    assert.equal(framePct("1W", 0.8, {}), null);
    assert.equal(framePct("1M", 0.8, undefined), null);
    assert.equal(framePct("YTD", 0.8, co), null);
  });
});

describe("asOfLabel", () => {
  it("names the session once the market has closed", () => {
    assert.equal(asOfLabel("closed", "2026-11-20", "~15 min delayed"), "As of Friday close, Nov 20, 2026");
    assert.equal(asOfLabel("after", "2026-11-23", "~15 min delayed"), "As of Monday close, Nov 23, 2026");
  });
  it("says live, with the feed delay, during the session", () => {
    assert.equal(asOfLabel("open", "2026-11-23", "~15 min delayed"), "Live · ~15 min delayed");
  });
});

describe("squarify", () => {
  // Market caps in $B, largest first — roughly a tech-heavy sector.
  const caps = [5100, 4000, 1500, 1100, 800, 600, 400, 300, 220, 150, 90, 60, 40, 25, 12, 8, 5, 3, 2, 1];
  const items = caps.map((w, i) => ({ key: `S${i}`, weight: w }));
  const W = 1100, H = 560;
  const rects = squarify(items, 0, 0, W, H);

  it("places every item, with area exactly proportional to weight", () => {
    assert.equal(rects.length, items.length);
    const total = caps.reduce((a, b) => a + b, 0);
    for (const r of rects) {
      const w = items.find(i => i.key === r.key)!.weight;
      assert.ok(Math.abs((r.w * r.h) / (W * H) - w / total) < 1e-9, r.key);
    }
  });
  it("tiles the box with no overlap and nothing outside it", () => {
    let area = 0;
    for (const a of rects) {
      assert.ok(a.x >= -1e-6 && a.y >= -1e-6 && a.x + a.w <= W + 1e-6 && a.y + a.h <= H + 1e-6, `${a.key} inside`);
      area += a.w * a.h;
    }
    assert.ok(Math.abs(area - W * H) < 1e-6);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        assert.ok(ox <= 1e-6 || oy <= 1e-6, `${a.key} overlaps ${b.key}`);
      }
    }
  });
  it("keeps the big tiles close to square (no long thin slices)", () => {
    for (const r of rects.slice(0, 6)) {
      const ratio = Math.max(r.w / r.h, r.h / r.w);
      assert.ok(ratio < 3, `${r.key} is ${ratio.toFixed(1)}:1`);
    }
  });
  it("skips zero weights; empty or flat boxes give nothing", () => {
    assert.equal(squarify([{ key: "a", weight: 0 }, { key: "b", weight: 3 }], 0, 0, 10, 10).length, 1);
    assert.deepEqual(squarify([], 0, 0, 10, 10), []);
    assert.deepEqual(squarify(items, 0, 0, 0, 100), []);
    assert.deepEqual(squarify(items, 0, 0, 100, -5), []);
  });
  it("one item fills the box; offsets are respected", () => {
    assert.deepEqual(squarify([{ key: "a", weight: 7 }], 5, 6, 40, 20), [{ key: "a", x: 5, y: 6, w: 40, h: 20 }]);
  });
});

describe("packStocks", () => {
  // 200 stocks, a few big and a long tail of tiny ones — a busy sector.
  const stocks = Array.from({ length: 200 }, (_, i) => ({ sym: `T${i}`, weight: Math.max(0.2, 2000 / (i + 1) ** 1.6) }));
  const minTile = (): [number, number] => [26, 17];
  const minMore: [number, number] = [30, 18];

  it("bundles the tail into one '+N more' tile and keeps every other tile readable", () => {
    const p = packStocks(stocks, 340, 380, minTile, minMore);
    assert.ok(p.more.length > 0 && p.more.length < stocks.length);
    assert.equal(p.visible.length + p.more.length, stocks.length);
    for (const s of p.visible) {
      const r = p.rects.get(s.sym)!;
      assert.ok(r.w >= 26 - 1e-6 && r.h >= 17 - 1e-6, `${s.sym} is ${r.w.toFixed(0)}×${r.h.toFixed(0)}`);
    }
    const m = p.rects.get(MORE_KEY)!;
    assert.ok(m.w >= 30 && m.h >= 18);
  });
  it("the kept stocks are the largest ones", () => {
    const p = packStocks(stocks, 340, 380, minTile, minMore);
    assert.deepEqual(p.visible.map(s => s.sym), stocks.slice(0, p.visible.length).map(s => s.sym));
  });
  it("everything stays when it all fits; nothing when the box is too small", () => {
    const few = stocks.slice(0, 4);
    const p = packStocks(few, 800, 500, minTile, minMore);
    assert.equal(p.more.length, 0);
    assert.equal(p.visible.length, 4);
    assert.equal(p.rects.has(MORE_KEY), false);
    const none = packStocks(stocks, 0, 100, minTile, minMore);
    assert.deepEqual([none.visible.length, none.more.length, none.rects.size], [0, 0, 0]);
  });
  it("tiles do not overlap and the bundle's area is the weight of what it holds", () => {
    const p = packStocks(stocks, 340, 380, minTile, minMore);
    const all = [...p.rects.values()];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        assert.ok(ox <= 1e-6 || oy <= 1e-6);
      }
    }
    const total = stocks.reduce((n, s) => n + s.weight, 0);
    const bundled = p.more.reduce((n, s) => n + s.weight, 0);
    const m = p.rects.get(MORE_KEY)!;
    assert.ok(Math.abs((m.w * m.h) / (340 * 380) - bundled / total) < 1e-9);
  });
});

describe("tileFontRem", () => {
  it("grows with the tile: small names stay small, big names read at a glance", () => {
    assert.ok(tileFontRem(30, 30) <= 0.55);
    assert.ok(Math.abs(tileFontRem(110, 110) - 1) < 0.1);
    assert.ok(tileFontRem(240, 240) > 1.2 && tileFontRem(240, 240) < 1.4);
    assert.ok(tileFontRem(900, 600) <= 1.5);
    assert.ok(tileFontRem(30, 30) < tileFontRem(110, 110) && tileFontRem(110, 110) < tileFontRem(240, 240));
  });
  it("never goes below the floor, even for a degenerate tile", () => {
    assert.equal(tileFontRem(0, 0), 0.45);
  });
});

