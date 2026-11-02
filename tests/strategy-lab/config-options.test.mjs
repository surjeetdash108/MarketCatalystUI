// Strategy Lab options as in the prototype: intraday "More" periods (capped at
// what the server serves) and the exit-plan choices.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IPER, IPERX, STOP_PCTS, TP_PCTS, periodOf, periodChoices, valCfg } from "../../app/iq/sl/lab-config.js";
import { MAX_INTRADAY_DAYS } from "../../app/iq/sl/lab-run.js";

describe("backtest period choices", () => {
  it("intraday More periods are the prototype's, minus what the server can't serve", () => {
    assert.deepEqual(IPERX["5m"], [60, 90, 120]);
    assert.deepEqual(IPERX["1m"], [14, 30, 60]);
    assert.deepEqual(IPERX["30m"], [270, 365, 730]);
    for (const tf of Object.keys(IPERX)) for (const d of IPERX[tf]) assert.ok(d <= MAX_INTRADAY_DAYS, tf + " " + d);
  });
  it("a More period is kept, not reset to the default", () => {
    assert.deepEqual(periodOf({ idays_5m: "90" }, "5m"), { days: 90 });
    assert.equal(valCfg({ idays_15m: "365" }, "15m").idays, 365);
    assert.deepEqual(periodOf({ idays_5m: "45" }, "5m"), { days: 21 });
  });
  it("chips: base periods, More periods only when opened", () => {
    assert.deepEqual(periodChoices("5m", false), { base: IPER["5m"], more: [60, 90, 120], list: [7, 14, 21, 30] });
    assert.deepEqual(periodChoices("5m", true).list, [7, 14, 21, 30, 60, 90, 120]);
    assert.deepEqual(periodChoices("d", true), { base: [1, 3, 5, 10], more: [], list: [1, 3, 5, 10] });
  });
});

describe("exit plan choices", () => {
  it("stop 1–10%, target 1–10, 15, 20, 30%", () => {
    assert.deepEqual(STOP_PCTS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(TP_PCTS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30]);
    assert.equal(valCfg({ stopM: "pct", stop: "3", tpM: "pct", tp: "15" }, "d").stop, 0.03);
    assert.equal(valCfg({ stopM: "pct", stop: "3", tpM: "pct", tp: "15" }, "d").tp, 0.15);
  });
});
