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
