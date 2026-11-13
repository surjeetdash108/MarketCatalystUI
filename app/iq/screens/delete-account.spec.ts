import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settings = readFileSync(new URL("./settings.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("./delete-account-dialog.tsx", import.meta.url), "utf8");

test("Settings opens the delete dialog instead of deleting only the sign-in in the browser", () => {
  assert.match(settings, /<DeleteAccountDialog onClose=/);
  assert.doesNotMatch(settings, /deleteUser\(/);
  assert.doesNotMatch(settings, /window\.prompt\(/);
});

test("the dialog explains what happens, needs DELETE typed, and deletes on the server", () => {
  for (const s of ["cancelled right away", "watchlists, portfolio, notes and alerts", "referral credit is lost", "can't be undone"])
    assert.ok(dialog.includes(s), s);
  assert.match(dialog, /typed\.trim\(\) === "DELETE"/);
  assert.match(dialog, /apiDelete\("\/api\/account", \{ confirm: "DELETE" \}\)/);
});
