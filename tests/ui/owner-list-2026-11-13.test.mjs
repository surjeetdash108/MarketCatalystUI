// Owner list 2026-11-13: menu/settings renames, Strategy Lab fails closed, the
// intro banner on SI and Money Flow, a Money Flow progress bar, ¾-width
// Settings, and no mobile number in the profile. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("profile menu says 'Manage Plan'; Settings says 'Manage Plan' and 'Purchase history'", () => {
  for (const f of ["app/iq/shell.tsx", "app/iq/profile-menu.tsx"]) {
    assert.match(read(f), /◈<\/span> Manage Plan/, f);
    assert.doesNotMatch(read(f), /Manage Account/, f);
  }
  const s = read("app/iq/screens/settings.tsx");
  assert.match(s, />Manage Plan<\/button>/);
  assert.match(s, />Purchase history<\/button>/);
});

test("Strategy Lab stays locked if the plan can't be loaded (it runs in the browser)", () => {
  assert.match(read("app/iq/entitlement-gate.tsx"), /const failClosed = key === "strategyLab" && !state\.data && state\.error;/);
});

test("the trial banner also shows on Stock Intelligence and Money Flow", () => {
  const s = read("app/iq/shell.tsx");
  assert.equal(s.match(/\{ent\?\.status === "INTRO" && <ContextualBanner ent=\{ent\} \/>\}/g)?.length, 2);
});

test("Money Flow shows a progress bar while the board loads", () => {
  const s = read("app/iq/screens/money-flow.tsx");
  assert.match(s, /\{!board && !boardError && \([\s\S]{0,200}role="progressbar"/);
});

test("Settings sections are ¾ of the screen and centred (full width on a phone)", () => {
  assert.match(read("app/iq/screens/settings.tsx"), /data-testid="settings-sections" style=\{\{ gridTemplateColumns: "1fr", width: "max\(75%, min\(100%, 640px\)\)", maxWidth: "100%", margin: "0 auto" \}\}/);
});

test("no mobile number field, check or save in the profile", () => {
  for (const f of ["app/profile/profile-fields.tsx", "app/iq/shell.tsx", "app/iq/screens/settings.tsx"]) assert.doesNotMatch(read(f), /mobileNumber"|Mobile number/, f);
});
