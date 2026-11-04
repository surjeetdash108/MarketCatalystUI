import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FullChartSvg } from "./chart-svg";
import { formatCurrency, sessionCandles, type MoneyFlowBoard } from "./engine";

const fx = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/money-flow-2026-10-29.json"), "utf-8"));
const board: MoneyFlowBoard = fx.board;

describe("Intra-Day chart price line", () => {
  it("sits at the live price the header shows, not the last bar's close", () => {
    const s = board.gainers[0];
    const candles = sessionCandles(fx.aapl1m, board.sessionDate, 5).map((b) => ({ ...b, c: s.price - 1, h: s.price, l: s.price - 2, o: s.price - 1 }));
    const live = { ...s, price: s.price }; // last candle closes 1.00 under it
    const svg = renderToStaticMarkup(createElement(FullChartSvg, { stock: live, candles, layers: { ob: false, vwap: false, fvg: false, liq: false, str: false, pat: false }, tf: 5 }));
    assert.match(svg, new RegExp(`>${formatCurrency(s.price).replace(".", "\\.")}<`), "price tag shows the live price");
    assert.doesNotMatch(svg, new RegExp(`>${formatCurrency(s.price - 1).replace(".", "\\.")}<`), "not the last close");
  });
});

describe("Intra-Day chart with every layer on stays readable", () => {
  const s = board.gainers[0];
  const all = { ob: true, vwap: true, fvg: true, liq: true, str: true, pat: true };
  const render = (tf: number) => {
    const candles = sessionCandles(fx.aapl1m, board.sessionDate, tf);
    return renderToStaticMarkup(createElement(FullChartSvg, { stock: { ...s, price: candles.at(-1)!.c }, candles, layers: all, tf }));
  };
  const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  it("1m shows at most two swept marks per side (was ~14 '✕ swept' tags)", () => {
    assert.ok(texts(render(1)).filter((t) => t.includes("✕")).length <= 4);
  });
  it("swing tags and BOS marks are limited to the most recent ones (no wall of HH / HL on 1m)", () => {
    const t = texts(render(1));
    assert.ok(t.filter((x) => /^(H|L|HH|HL|LH|LL)$/.test(x)).length <= 6, `${t.filter((x) => /^(H|L|HH|HL|LH|LL)$/.test(x)).length}`);
    assert.ok(t.filter((x) => x === "BOS").length <= 3);
  });
  it("one label per price: ORL / LOD / SSL at the same price are one label, not three", () => {
    for (const tf of [1, 5]) {
      const priced = texts(render(tf)).map((t) => t.match(/\$([\d,]+\.\d\d)$/)?.[1]).filter(Boolean);
      assert.equal(new Set(priced).size, priced.length, `tf ${tf}: ${priced.join(", ")}`);
    }
  });
  it("EQ 50% carries its price; HOD / LOD markers no longer repeat it beside the candle", () => {
    const t = texts(render(5));
    assert.ok(t.some((x) => /EQ 50%.*\$\d/.test(x)), t.join(" | "));
    assert.ok(!t.some((x) => /^(HOD|LOD) \$/.test(x)));
  });
});
