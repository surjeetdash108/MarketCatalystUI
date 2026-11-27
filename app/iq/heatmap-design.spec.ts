import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asOfLabel, framePct, ytdPct, windowPctToLive, lastSessionPct, dayMovePct, floorWeights, sectorHeaderPlan, heatGradient, heatTile, NO_DATA_TILE, squarify, packStocks, MORE_KEY, tileFontRem } from "./heatmap-design";

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
  it("a field that is not synced is null, never the day move; YTD with no stored base is null too", () => {
    assert.equal(framePct("1W", 0.8, {}), null);
    assert.equal(framePct("1M", 0.8, undefined), null);
    assert.equal(framePct("YTD", 0.8, co), null);
    assert.equal(framePct("YTD", 0.8, undefined), null);
  });
});

describe("ytdPct", () => {
  const co = { ytdBaseClose: 100, ytdYear: 2026 };
  it("is the price against the stored prior-year-end close", () => {
    assert.equal(ytdPct(co, 125, "2026-11-27")?.toFixed(2), "25.00");
    assert.equal(ytdPct(co, 80, "2026-11-27")?.toFixed(2), "-20.00");
  });
  it("is null with no base, no price, or a bad one", () => {
    assert.equal(ytdPct(null, 125, "2026-11-27"), null);
    assert.equal(ytdPct({}, 125, "2026-11-27"), null);
    assert.equal(ytdPct({ ytdBaseClose: null, ytdYear: 2026 }, 125, "2026-11-27"), null);
    assert.equal(ytdPct({ ytdBaseClose: 0, ytdYear: 2026 }, 125, "2026-11-27"), null);
    assert.equal(ytdPct(co, null, "2026-11-27"), null);
    assert.equal(ytdPct(co, 0, "2026-11-27"), null);
  });
  it("is null when the base is another year's: around New Year the job has not rolled yet", () => {
    assert.equal(ytdPct({ ytdBaseClose: 100, ytdYear: 2025 }, 125, "2026-01-02"), null);
    assert.equal(ytdPct({ ytdBaseClose: 100 }, 125, "2026-01-02"), null);
    assert.equal(ytdPct(co, 125, null), null);
  });
});

describe("framePct for YTD", () => {
  const co = { ytdBaseClose: 200, ytdYear: 2026, price: 220 };
  it("measures to the live price when there is one", () => {
    assert.equal(framePct("YTD", 0.8, co, { price: 250, dateIso: "2026-11-27" })?.toFixed(2), "25.00");
  });
  it("falls back to the doc's own price with no live price", () => {
    assert.equal(framePct("YTD", 0.8, co, { price: null, dateIso: "2026-11-27" })?.toFixed(2), "10.00");
  });
  it("needs the session date to check the base's year", () => {
    assert.equal(framePct("YTD", 0.8, co, null), null);
  });
  it("ignores the 1W/1M stored moves and the day move", () => {
    const withMoves = { ...co, week5ChangePct: 9, monthChangePct: 9 };
    assert.equal(framePct("YTD", 99, withMoves, { price: 250, dateIso: "2026-11-27" })?.toFixed(2), "25.00");
  });
  it("is null across an unadjusted split in the stored closes, like 1W and 1M", () => {
    const split = { ...co, week5Closes: [
      { date: "2026-11-19", close: 100 }, { date: "2026-11-20", close: 100 }, { date: "2026-11-23", close: 10 },
      { date: "2026-11-24", close: 10 }, { date: "2026-11-25", close: 10 }, { date: "2026-11-26", close: 10 },
    ] };
    assert.equal(framePct("YTD", 0.8, split, { price: 250, dateIso: "2026-11-27" }), null);
  });
});

// 24 Nov 2026, 15:45 ET: NVDA's 1W tile read +5.71% (the five sessions to Monday's close) while the
// five sessions up to the live price were -1.33%. Synthetic closes with the same shape.
describe("windowPctToLive", () => {
  const w5 = [
    { date: "2026-11-16", close: 100 }, { date: "2026-11-17", close: 101 }, { date: "2026-11-18", close: 102 },
    { date: "2026-11-19", close: 103 }, { date: "2026-11-20", close: 104 }, { date: "2026-11-23", close: 105 },
  ];
  it("a later session is live: today counts as one of the five, so the base is the SECOND close", () => {
    assert.equal(windowPctToLive(w5, 99, "2026-11-24")?.toFixed(2), ((99 / 101 - 1) * 100).toFixed(2));
  });
  it("the newest stored close is the live price's own session: the base is the FIRST close", () => {
    assert.equal(windowPctToLive(w5, 105, "2026-11-23")?.toFixed(2), "5.00");
  });
  it("null (caller keeps the stored move) when the live price is older than the newest close, or anything is missing", () => {
    assert.equal(windowPctToLive(w5, 99, "2026-11-20"), null);
    assert.equal(windowPctToLive(null, 99, "2026-11-24"), null);
    assert.equal(windowPctToLive(w5, null, "2026-11-24"), null);
    assert.equal(windowPctToLive(w5, 99, null), null);
    assert.equal(windowPctToLive([{ date: "2026-11-23", close: 0 }, { date: "2026-11-24", close: 1 }], 99, "2026-11-25"), null);
  });
  it("works for the 22-close monthly window the same way", () => {
    const m21 = Array.from({ length: 22 }, (_, i) => ({ date: "2026-10-" + String(i + 1).padStart(2, "0"), close: 100 + i }));
    assert.equal(windowPctToLive(m21, 130, "2026-11-24")?.toFixed(2), ((130 / 101 - 1) * 100).toFixed(2));
  });
});

describe("framePct with the live price", () => {
  const w5 = [
    { date: "2026-11-16", close: 100 }, { date: "2026-11-17", close: 101 }, { date: "2026-11-18", close: 102 },
    { date: "2026-11-19", close: 103 }, { date: "2026-11-20", close: 104 }, { date: "2026-11-23", close: 105 },
  ];
  const m21 = Array.from({ length: 22 }, (_, i) => ({ date: "2026-10-" + String(i + 1).padStart(2, "0"), close: 100 + i }));
  const co = { week5ChangePct: 5.71, monthChangePct: 21, week5Closes: w5, month21Closes: m21 };
  const live = { price: 99, dateIso: "2026-11-24" };
  it("1W re-measures to the live price instead of reading the stored move", () => {
    assert.equal(framePct("1W", 0.8, co, live)?.toFixed(2), ((99 / 101 - 1) * 100).toFixed(2));
  });
  it("1M uses the monthly closes when the job has written them, the stored move until then", () => {
    assert.equal(framePct("1M", 0.8, co, live)?.toFixed(2), ((99 / 101 - 1) * 100).toFixed(2));
    assert.equal(framePct("1M", 0.8, { ...co, month21Closes: null }, live), 21);
  });
  it("without a live price or closes the stored move stands; 1D is unchanged and YTD with no base is null", () => {
    assert.equal(framePct("1W", 0.8, co, null), 5.71);
    assert.equal(framePct("1W", 0.8, { week5ChangePct: 5.71 }, live), 5.71);
    assert.equal(framePct("1D", 0.8, co, live), 0.8);
    assert.equal(framePct("YTD", 0.8, co, live), null);
  });
});

// 24 Nov 2026, 04:32 ET: the page says "As of Monday close" but the stored change
// had been re-based to 0 at the 04:30 sweep and the quote's change is the
// pre-market print, so nearly every tile read 0.00%. Closes below are AAPL's and
// MSFT's real week5Closes from that morning.
describe("lastSessionPct", () => {
  const aapl = [{ date: "2026-11-19", close: 349.21 }, { date: "2026-11-20", close: 342.56 }, { date: "2026-11-23", close: 349.08 }];
  const msft = [{ date: "2026-11-19", close: 498.3 }, { date: "2026-11-20", close: 484.52 }];
  it("is the newest close against the one before it", () => {
    assert.equal(lastSessionPct(aapl, "2026-11-23")?.toFixed(2), "1.90");
  });
  it("is null when the newest stored close is not that session (technicals a session behind)", () => {
    assert.equal(lastSessionPct(msft, "2026-11-23"), null);
  });
  it("is null with fewer than two closes or bad prices", () => {
    assert.equal(lastSessionPct(null, "2026-11-23"), null);
    assert.equal(lastSessionPct([{ date: "2026-11-23", close: 10 }], "2026-11-23"), null);
    assert.equal(lastSessionPct([{ date: "2026-11-20", close: 0 }, { date: "2026-11-23", close: 10 }], "2026-11-23"), null);
  });
});

describe("dayMovePct", () => {
  const closes = [{ date: "2026-11-20", close: 342.56 }, { date: "2026-11-23", close: 349.08 }];
  const SESSION = "2026-11-23";
  it("during the session it is the live day move", () => {
    const q = { pctChange: 0.8, marketStatus: "open", previousClose: 100, regularClose: 100.8 };
    assert.equal(dayMovePct(q, 0.1, closes, SESSION, "open"), 0.8);
  });
  it("pre-market never shows the pre-market print or the re-based stored 0: it is the last session's move", () => {
    const q = { pctChange: 0, marketStatus: "early_trading", previousClose: 349.08, regularClose: 349.08 };
    assert.equal(dayMovePct(q, 0, closes, SESSION, "pre")?.toFixed(2), "1.90");
    const withPrint = { ...q, pctChange: 0.35 };
    assert.equal(dayMovePct(withPrint, 0, closes, SESSION, "pre")?.toFixed(2), "1.90");
  });
  it("pre-market uses the vendor's own last-session move first, so a stale-closes stock (MSFT) still has its number", () => {
    // MSFT, 04:36 ET 24 Nov: stored closes stop at 20 Nov, the vendor row still held Monday's +1.647%.
    const q = { pctChange: 0, marketStatus: "early_trading", previousClose: 492.5, regularClose: 492.5, lastSessionPct: 1.64699 };
    const stale = [{ date: "2026-11-19", close: 498.3 }, { date: "2026-11-20", close: 484.52 }];
    assert.equal(dayMovePct(q, 0, stale, SESSION, "pre"), 1.64699);
    // and a server that does not send it yet falls back to the closes
    assert.equal(dayMovePct({ ...q, lastSessionPct: undefined }, 0, stale, SESSION, "pre"), null);
  });
  it("after hours / closed prefer the vendor's own move over rebuilding it", () => {
    const q = { pctChange: 3.2, marketStatus: "late_trading", previousClose: 1, regularClose: 2, lastSessionPct: 1.9 };
    assert.equal(dayMovePct(q, 0, null, SESSION, "after"), 1.9);
  });
  it("pre-market with no usable closes is no number, not 0.00%", () => {
    const q = { pctChange: 0, marketStatus: "early_trading", previousClose: 100, regularClose: 100 };
    assert.equal(dayMovePct(q, 0, null, SESSION, "pre"), null);
    assert.equal(dayMovePct(q, 0, [{ date: "2026-11-19", close: 1 }, { date: "2026-11-20", close: 2 }], SESSION, "pre"), null);
  });
  it("after hours the move excludes the after-hours print", () => {
    // 349.08 regular close vs 342.56 the day before; the quote's own pctChange (3.2) runs on to the after-hours price.
    const q = { pctChange: 3.2, marketStatus: "late_trading", previousClose: 342.56, regularClose: 349.08 };
    assert.equal(dayMovePct(q, 1.9, closes, SESSION, "after")?.toFixed(2), "1.90");
  });
  it("closed (overnight / weekend) is the regular close against the one before", () => {
    const q = { pctChange: 1.9, marketStatus: "closed", previousClose: 342.56, regularClose: 349.08 };
    assert.equal(dayMovePct(q, null, null, SESSION, "closed")?.toFixed(2), "1.90");
  });
  it("without a live quote it follows the market clock", () => {
    assert.equal(dayMovePct(undefined, 0.6, closes, SESSION, "open"), 0.6);
    assert.equal(dayMovePct(undefined, 0, closes, SESSION, "pre")?.toFixed(2), "1.90");
    assert.equal(dayMovePct(undefined, 0, null, SESSION, "pre"), null);
    assert.equal(dayMovePct(undefined, 1.2, null, SESSION, "closed"), 1.2);
  });
  it("a quote with no session info keeps its own change", () => {
    assert.equal(dayMovePct({ pctChange: -0.7 }, 0.2, closes, SESSION, "closed"), -0.7);
  });
});

describe("floorWeights", () => {
  const share = (ws: number[]) => { const t = ws.reduce((a, b) => a + b, 0); return ws.map(w => w / t); };
  // Roughly the real spread: one sector near 40% of the map, a long tail under 1%.
  const real = [4000, 3000, 1500, 600, 300, 120, 60, 40, 25, 12, 4, 1];

  it("every sector ends up with at least the minimum share of the map", () => {
    const out = share(floorWeights(real, 0.02));
    for (const s of out) assert.ok(s >= 0.02 - 1e-9, `share ${s}`);
  });

  it("only the small sectors move; the big ones keep their weight", () => {
    const out = floorWeights(real, 0.02);
    assert.equal(out[0], 4000);
    assert.equal(out[1], 3000);
    assert.ok(out[real.length - 1] > 1);
  });

  it("keeps the order, and never lowers a weight", () => {
    const out = floorWeights(real, 0.02);
    out.forEach((w, i) => assert.ok(w >= real[i]));
    for (let i = 1; i < out.length; i++) assert.ok(out[i] <= out[i - 1], "still largest first");
  });

  it("changes nothing when every sector is already big enough", () => {
    assert.deepEqual(floorWeights([50, 30, 20], 0.05), [50, 30, 20]);
  });

  it("falls back to equal blocks when the minimum cannot be met for everyone", () => {
    assert.deepEqual(floorWeights([9, 1, 1], 0.4), [1, 1, 1]);
  });

  it("handles no sectors, and a zero minimum, without changing anything", () => {
    assert.deepEqual(floorWeights([], 0.02), []);
    assert.deepEqual(floorWeights([3, 2, 1], 0), [3, 2, 1]);
  });

  it("does not modify the array it is given", () => {
    const input = [100, 5, 1];
    floorWeights(input, 0.1);
    assert.deepEqual(input, [100, 5, 1]);
  });
});

// 24 Nov 2026: the live map's small sector blocks (about 100px wide) read "CONS…",
// "C…", "UTIL…", "CO…", "ENER…" because the move sat beside the name and took ~40px.
describe("sectorHeaderPlan", () => {
  it("a wide block keeps name and move on one row", () => {
    const p = sectorHeaderPlan(330, 400, "ELECTRONIC TECHNOLOGY", "-2.14%");
    assert.deepEqual(p, { inline: true, showPct: true, nameLines: 1, h: 26 });
  });

  it("UTILITIES in a ~100px block shows in full: the move goes under it", () => {
    const p = sectorHeaderPlan(100, 150, "UTILITIES", "+0.07%");
    assert.equal(p.inline, false);
    assert.equal(p.showPct, true);
    assert.equal(p.nameLines, 1);
    assert.equal(p.h, 8 + 13 * 2);
  });

  it("CONSUMER DEFENSIVE (153px of text) wraps to two rows in a ~100px block", () => {
    const p = sectorHeaderPlan(100, 150, "CONSUMER DEFENSIVE", "+0.53%");
    assert.equal(p.nameLines, 2, "CONSUMER / DEFENSIVE, each word fits");
    assert.equal(p.inline, false);
    assert.equal(p.h, 8 + 13 * 3);
  });

  it("names of the other small sectors in the screenshot all wrap at word breaks", () => {
    for (const name of ["CONSUMER DURABLES", "CONSUMER SERVICES", "ENERGY MINERALS", "NON-ENERGY MINERALS", "PRODUCER MANUFACTURING", "PROCESS INDUSTRIES"]) {
      const p = sectorHeaderPlan(100, 150, name, "-1.79%");
      assert.equal(p.inline, false, name);
      assert.ok(p.nameLines === 2, `${name} should take two rows`);
    }
  });

  it("one long word (COMMUNICATIONS, 119px) breaks across two rows rather than being clipped", () => {
    const p = sectorHeaderPlan(100, 150, "COMMUNICATIONS", "+0.24%");
    assert.equal(p.nameLines, 2);
    assert.equal(p.inline, false);
  });

  it("a short name that fits alone is one row, never padded to two", () => {
    assert.equal(sectorHeaderPlan(100, 150, "FINANCE", "-0.11%").nameLines, 1);
  });

  it("a block too short to stack keeps one row and drops the move, so the name still shows", () => {
    const p = sectorHeaderPlan(100, 40, "CONSUMER DEFENSIVE", "+0.53%");
    assert.deepEqual(p, { inline: true, showPct: false, nameLines: 1, h: 26 });
  });

  it("always leaves room below the header for stocks", () => {
    for (const w of [60, 80, 100, 140, 200, 300]) {
      for (const h of [40, 60, 90, 130, 200]) {
        const p = sectorHeaderPlan(w, h, "COMMERCIAL SERVICES", "+0.01%");
        if (!p.inline) assert.ok(h - p.h >= 22, `w=${w} h=${h}: header ${p.h}px leaves ${h - p.h}px`);
      }
    }
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

