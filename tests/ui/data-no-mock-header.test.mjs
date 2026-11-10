// app/iq/data.ts holds shared types, small helpers and the screener presets —
// no mock data. Its header must say so (a stale "MOCK DATA" banner invites
// someone to "replace the mocks" with fabricated values).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("data.ts header describes what it holds, not mock data", () => {
  const head = fs.readFileSync("app/iq/data.ts", "utf8").split("\n").slice(0, 8).join("\n");
  assert.doesNotMatch(head, /MOCK DATA|STOCKWISE/);
  assert.match(head, /types/i);
});
