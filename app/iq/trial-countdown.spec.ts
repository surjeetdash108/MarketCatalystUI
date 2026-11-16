import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trialCountdown } from "./trial-countdown";

const TZ = "America/New_York";
// Signed up Nov 13 (ET) -> access ends Nov 20 at 11:59:59 PM ET (04:59:59 UTC Nov 21).
const END = "2026-11-21T04:59:59.000Z";
const at = (iso: string) => Date.parse(iso);

describe("trialCountdown", () => {
  it("shows the end date only, on the US Eastern calendar", () => {
    assert.equal(trialCountdown(END, at("2026-11-14T05:00:00Z"), TZ).endsAt, "Nov 20, 2026");
  });
  it("counts calendar days: signed up Nov 13 -> 7 days left that day", () => {
    assert.equal(trialCountdown(END, at("2026-11-14T04:50:00Z"), TZ).left, "7 days left"); // Nov 13, 11:50 PM ET
    assert.equal(trialCountdown(END, at("2026-11-14T15:00:00Z"), TZ).left, "6 days left"); // Nov 14
  });
  it("the last day reads 'Ends today' (no hours or times)", () => {
    assert.equal(trialCountdown(END, at("2026-11-20T15:00:00Z"), TZ).left, "Ends today");
    assert.equal(trialCountdown(END, at("2026-11-21T04:30:00Z"), TZ).left, "Ends today"); // 11:30 PM ET
  });
  it("after the end", () => {
    const c = trialCountdown(END, at("2026-11-21T05:00:00Z"), TZ);
    assert.equal(c.ended, true);
    assert.equal(c.left, "Ended");
  });
  it("unknown end", () => {
    assert.deepEqual(trialCountdown(null), { left: "", endsAt: "", ended: false });
  });
});
