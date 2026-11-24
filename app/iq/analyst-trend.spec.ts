import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trendLine, trendWindow } from "./analyst-trend";

const today = "2026-11-24";
const calls = [
  { act: "Upgrade", dir: 1, pt1: 200, ptSource: "firm" as const, date: "2026-11-20" },
  { act: "PT Raise", dir: 1, pt1: 220, ptSource: "firm" as const, date: "2026-11-10" },
  { act: "PT Cut", dir: -1, pt1: 150, ptSource: "consensus" as const, date: "2026-11-01" },
  { act: "Downgrade", dir: -1, pt1: 0, date: "2026-09-15" },
  { act: "Upgrade", dir: 1, pt1: 0, date: "2026-05-01" }, // outside 90 days
];

describe("analyst trend", () => {
  it("counts each kind of call in the window", () => {
    const w = trendWindow(calls, today, 30);
    assert.deepEqual(
      { calls: w.calls, up: w.upgrades, down: w.downgrades, raises: w.raises, cuts: w.cuts, bull: w.bullish, bear: w.bearish },
      { calls: 3, up: 1, down: 0, raises: 1, cuts: 1, bull: 2, bear: 1 },
    );
    assert.equal(w.avgTarget, 210); // firm targets only; the consensus fallback is left out
  });

  it("90 days reaches further back", () => {
    assert.equal(trendWindow(calls, today, 90).downgrades, 1);
  });

  it("states the direction in one line", () => {
    const line = trendLine(trendWindow(calls, today, 30), trendWindow(calls, today, 90));
    assert.equal(line, "Leaning bullish over the last 30 days: 1 upgrade, 1 target raise, 1 target cut.");
    assert.equal(trendLine(trendWindow([], today, 30), trendWindow([], today, 90)), "No analyst calls in the last 90 days.");
  });
});
