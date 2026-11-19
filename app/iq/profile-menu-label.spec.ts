import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("profile menu says 'Request a new feature'", () => {
  const src = readFileSync(new URL("./profile-menu.tsx", import.meta.url), "utf8");
  assert.match(src, /<span className="pd-icon">💡<\/span> Request a new feature/);
  assert.doesNotMatch(src, /Feature Requests/);
});
