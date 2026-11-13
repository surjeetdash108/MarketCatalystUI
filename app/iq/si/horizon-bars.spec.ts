import { describe, it } from "node:test";
import assert from "node:assert";
import { barsForHorizon, horizonMonths, sliceBarsToHorizon } from "./horizon-bars";

const DAY = 86_400_000;
const END = Date.UTC(2026, 10, 13); // 13 Nov 2026

// One bar per calendar day, oldest → newest, close = day index.
function daily(n: number) {
  return Array.from({ length: n }, (_, i) => ({ t: END - (n - 1 - i) * DAY, c: i }));
}

describe("Trade Builder horizon bars", () => {
  it("maps each button to months, 12M and 1Y alike, unknown to 6", () => {
    assert.equal(horizonMonths("1M"), 1);
    assert.equal(horizonMonths("3M"), 3);
    assert.equal(horizonMonths("6M"), 6);
    assert.equal(horizonMonths("12M"), 12);
    assert.equal(horizonMonths("1Y"), 12);
    assert.equal(horizonMonths("nope"), 6);
  });

  it("slices to the window ending at the latest bar", () => {
    const bars = daily(400);
    const m1 = sliceBarsToHorizon(bars, "1M");
    assert.equal(m1[m1.length - 1].t, END);
    assert.equal(m1[0].t, Date.UTC(2026, 9, 13)); // 13 Oct 2026
    assert.ok(sliceBarsToHorizon(bars, "3M").length > m1.length);
    assert.ok(sliceBarsToHorizon(bars, "6M").length > sliceBarsToHorizon(bars, "3M").length);
  });

  it("gives a different return per horizon from the same series", () => {
    const bars = daily(400);
    const ret = (hz: string) => {
      const s = barsForHorizon(hz, bars, undefined)!;
      return s[s.length - 1].c / s[0].c - 1;
    };
    const rs = ["1M", "3M", "6M", "12M"].map(ret);
    assert.equal(new Set(rs).size, 4, `returns should differ: ${rs}`);
  });

  it("uses the 6M series for short horizons when 1Y is missing", () => {
    const six = daily(130);
    assert.ok(barsForHorizon("1M", undefined, six));
    assert.ok(barsForHorizon("6M", undefined, six));
  });

  it("never shows 6M data as 12M", () => {
    assert.equal(barsForHorizon("12M", undefined, daily(130)), null);
  });

  it("returns null when too few bars fall in the window", () => {
    assert.equal(barsForHorizon("1M", daily(5), undefined), null);
    assert.equal(barsForHorizon("1M", undefined, undefined), null);
  });
});
