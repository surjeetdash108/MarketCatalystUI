import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trialCountdown } from "./trial-countdown";

const TZ = "America/New_York";
// Signed up 7:00 PM ET Nov 13 → access ends 7:00 PM ET Nov 20 (00:00 UTC Nov 21).
const END = "2026-11-21T00:00:00.000Z";
const at = (iso: string) => Date.parse(iso);

describe("trialCountdown", () => {
  it("shows the exact end time", () => {
    assert.equal(trialCountdown(END, at("2026-11-14T00:00:00Z"), TZ).endsAt, "Nov 20, 7:00 PM");
  });
  it("right after sign-up: 7 days left", () => {
    assert.equal(trialCountdown(END, at("2026-11-14T00:00:01Z"), TZ).left, "6 days left");
    assert.equal(trialCountdown(END, at("2026-11-14T00:00:00Z"), TZ).left, "7 days left");
  });
  it("a day after sign-up counts down (no rounding up)", () => {
    assert.equal(trialCountdown(END, at("2026-11-14T21:00:00Z"), TZ).left, "6 days left");
  });
  it("last day counts hours", () => {
    assert.equal(trialCountdown(END, at("2026-11-20T19:00:00Z"), TZ).left, "5 hours left");
    assert.equal(trialCountdown(END, at("2026-11-20T23:00:00Z"), TZ).left, "1 hour left");
    assert.equal(trialCountdown(END, at("2026-11-20T23:30:00Z"), TZ).left, "Less than an hour left");
  });
  it("after the end", () => {
    const c = trialCountdown(END, at("2026-11-21T00:00:01Z"), TZ);
    assert.equal(c.ended, true);
    assert.equal(c.left, "Ended");
  });
  it("unknown end", () => {
    assert.deepEqual(trialCountdown(null), { left: "", endsAt: "", ended: false });
  });
});
