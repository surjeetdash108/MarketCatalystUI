import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { switchPreviewLines } from "./plan-switch";

const money = (n: number) => "$" + (n / 100).toFixed(2);
const date = (iso: string) => iso.slice(0, 10);
const base = { interval: "monthly" as const, amountDueNow: 0, creditToBalance: 0, effectiveAt: "", startsAt: "2026-11-14T00:00:00Z", nextRenewalAmount: 19900, nextRenewalDate: "2026-12-14T00:00:00Z", trialEndsAt: null };

test("upgrade: starts now, prorated charge to the card on file, next renewal", () => {
  const l = switchPreviewLines({ ...base, kind: "upgrade", amountDueNow: 13333 }, { from: "Pro", to: "Elite" }, money, date);
  assert.deepEqual(l, [
    "You switch to Elite (Monthly) now. The new features are available right away.",
    "Charged today: $133.33 (prorated), to your card on file.",
    "Next renewal: $199.00 on 2026-12-14.",
  ]);
});

test("scheduled (lower plan): starts at the period end, nothing today", () => {
  const l = switchPreviewLines({ ...base, kind: "scheduled", effectiveAt: "2026-12-14T00:00:00Z", nextRenewalAmount: 3900 }, { from: "Elite", to: "Starter" }, money, date);
  assert.equal(l[0], "Your Starter (Monthly) plan starts on 2026-12-14.");
  assert.equal(l[1], "You keep Elite until then. Nothing is charged today.");
});

test("in the free trial: switch now, nothing today, first charge at trial end", () => {
  const l = switchPreviewLines({ ...base, kind: "upgrade", trialEndsAt: "2026-11-20T00:00:00Z" }, { from: "Pro", to: "Elite" }, money, date);
  assert.deepEqual(l.slice(1), ["You're still in your free trial, so nothing is charged today.", "Your first charge is $199.00 on 2026-11-20, then every month."]);
});

test("Manage Plan and the plans page switch in the pop-up, not on the checkout page", () => {
  const manage = readFileSync(new URL("../screens/manage-plan.tsx", import.meta.url), "utf8");
  const choose = readFileSync(new URL("./choose-plan-screen.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("./plan-switch-dialog.tsx", import.meta.url), "utf8");
  assert.match(manage, /setSwitchTo\(plan\);/);
  assert.doesNotMatch(manage, /Subscribers change plan on the checkout page/);
  assert.match(choose, /if \(signedIn && userHasActivePlan && livePlan\) \{\s*e\.preventDefault\(\);\s*setSwitchTo\(livePlan\);/);
  assert.match(dialog, /Are you sure you want to switch\?/);
  assert.match(dialog, /consent: \{ accepted: true/);
});
