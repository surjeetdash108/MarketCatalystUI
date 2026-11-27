import assert from "node:assert/strict";
import test from "node:test";
import { dailyPivots, rsiOf } from "./data";

test("RSI needs period + 1 closes", () => {
  assert.equal(rsiOf([1, 2, 3], 14), null);
  assert.equal(rsiOf(Array.from({ length: 14 }, (_, i) => 100 + i), 14), null);
});

test("a straight rise is RSI 100, a straight fall is RSI 0, no change is 50", () => {
  assert.equal(rsiOf(Array.from({ length: 30 }, (_, i) => 100 + i)), 100);
  assert.equal(rsiOf(Array.from({ length: 30 }, (_, i) => 200 - i)), 0);
  assert.equal(rsiOf(Array.from({ length: 30 }, () => 100)), 50);
});

test("RSI follows Wilder's smoothing (worked example)", () => {
  // 14 alternating changes of +1 and -0.5, then one more +1: the seed averages are gain 7/14, loss 3.5/14.
  const closes = [100];
  for (let i = 0; i < 14; i++) closes.push(closes[closes.length - 1] + (i % 2 === 0 ? 1 : -0.5));
  closes.push(closes[closes.length - 1] + 1);
  const seedGain = 7 / 14;
  const seedLoss = 3.5 / 14;
  const avgGain = (seedGain * 13 + 1) / 14;
  const avgLoss = (seedLoss * 13) / 14;
  const expected = Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
  assert.equal(rsiOf(closes), expected);
});

const bar = (day: string, h: number, l: number, c: number) => ({ t: Date.parse(`${day}T14:30:00Z`), h, l, c });

test("pivots come from the last completed daily bar", () => {
  const bars = [bar("2026-11-19", 110, 100, 105), bar("2026-11-20", 120, 100, 110)];
  // today is the 23rd, so the 20th is the last completed bar: pivot (120+100+110)/3 = 110, range 20
  const p = dailyPivots(bars, "2026-11-23", 10)!;
  assert.equal(p.r1, 2 * 110 - 100);
  assert.equal(p.s1, 2 * 110 - 120);
  assert.equal(p.r2, 110 + 20);
  assert.equal(p.s2, 110 - 20);
});

test("today's bar is skipped until the market has closed (4 pm ET)", () => {
  const bars = [bar("2026-11-19", 110, 100, 105), bar("2026-11-20", 120, 100, 110)];
  const before = dailyPivots(bars, "2026-11-20", 15)!; // still forming: use the 19th
  assert.equal(before.r1, 2 * ((110 + 100 + 105) / 3) - 100);
  const after = dailyPivots(bars, "2026-11-20", 16)!; // closed: use the 20th
  assert.equal(after.r1, 2 * 110 - 100);
});

test("no usable bar, no pivots", () => {
  assert.equal(dailyPivots([], "2026-11-20", 10), null);
  assert.equal(dailyPivots([bar("2026-11-20", 0, 0, 0)], "2026-11-21", 10), null);
});
