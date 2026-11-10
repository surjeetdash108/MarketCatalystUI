import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launchingSoonBanner } from "./launching-soon-banner";

const plans = [
  { id: "free", name: "Free", description: "", currency: "USD", sortOrder: 0, prices: {} },
  { id: "elite", name: "Elite", description: "", currency: "USD", sortOrder: 3, prices: { annual: { amount: 179100, lookupKey: "elite_annual" } } },
];

describe("paid plans unavailable: dashboard banner", () => {
  it("tile → signup → dashboard says '<Plan> is launching soon. You're on Free until then.' and keeps the intent", () => {
    assert.deepEqual(launchingSoonBanner({ planId: "elite", interval: "annual" }, plans, { paidPlansAvailable: false }), {
      text: "Elite is launching soon. You're on Free until then.",
      href: "/checkout?plan=elite&interval=annual",
    });
  });
  it("no banner when paid plans are available, without an intent, or for staff", () => {
    assert.equal(launchingSoonBanner({ planId: "elite", interval: "annual" }, plans, { paidPlansAvailable: true }), null);
    assert.equal(launchingSoonBanner(null, plans, { paidPlansAvailable: false }), null);
    assert.equal(launchingSoonBanner({ planId: "elite", interval: "annual" }, plans, { paidPlansAvailable: false, staff: true }), null);
  });
  it("is on the dashboard", () => {
    assert.match(fs.readFileSync(path.join(process.cwd(), "app/iq/screens/dashboard.tsx"), "utf8"), /<LaunchingSoonBanner \/>/);
  });
});
