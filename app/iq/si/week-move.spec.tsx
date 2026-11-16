import assert from "node:assert/strict";
import test from "node:test";
import { weekMove } from "./week-move";

const DAY = 86_400_000;
const bar = (i: number, c: number, v = 1000) => ({ t: Date.UTC(2026, 10, 1) + i * DAY, c, h: c * 1.01, l: c * 0.99, v });

test("needs seven bars before it explains a week", () => {
  assert.equal(weekMove("NVDA", undefined, []), null);
  assert.equal(weekMove("NVDA", [bar(0, 100), bar(1, 101)], []), null);
});

test("describes a rising week, with the move over the last five sessions", () => {
  const closes = [90, 91, 92, 100, 101, 102, 104, 105, 106];
  const bars = closes.map((c, i) => bar(i, c));
  const m = weekMove("NVDA", bars, [])!;
  // last bar 106 against the close five sessions earlier (100)
  assert.ok(Math.abs(m.pct - ((106 / 100 - 1) * 100)) < 1e-9);
  assert.match(m.text, /^NVDA rose sharply|^NVDA rose /);
  assert.match(m.text, /closing higher on 5 of 5 sessions\.$/);
  assert.equal(m.ev.length >= 4, true);
});

test("says so when the stock has no headlines in the last seven days", () => {
  const bars = Array.from({ length: 10 }, (_, i) => bar(i, 100 + i));
  const m = weekMove("AAA", bars, [{ publishedAt: new Date(bars[0].t - 30 * DAY).toISOString(), headline: "Old", source: "X" }])!;
  assert.equal(m.ev[m.ev.length - 1], "No headlines for this stock in the last 7 days");
});

test("a flat week reads as roughly flat", () => {
  const bars = Array.from({ length: 10 }, (_, i) => bar(i, 100 + (i % 2) * 0.1));
  assert.match(weekMove("FLAT", bars, [])!.text, /^FLAT was roughly flat/);
});
