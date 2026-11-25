import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.join(process.cwd(), "scripts/no-placeholders.mjs");
const run = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nph-"));
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), body);
  }
  return spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
};

test("release gate: a placeholder or example.com address in shipped copy fails the build", () => {
  assert.equal(run({ "components/T.tsx": "<li>Contact [SUPPORT CONTACT PLACEHOLDER]</li>" }).status, 1);
  assert.equal(run({ "app/p.tsx": '<a href="mailto:support@example.com">x</a>' }).status, 1);
});

test("release gate: input hints, tests and docs don't count", () => {
  assert.equal(run({
    "app/f.tsx": '<input placeholder="you@example.com" />',
    "tests/x.test.ts": "PLACEHOLDER",
    "docs/draft.txt": "[LEGAL REVIEW PLACEHOLDER]",
  }).status, 0);
});

test("this repo passes the gate, and the build runs it first", () => {
  assert.equal(spawnSync(process.execPath, [script], { encoding: "utf8" }).status, 0);
  assert.match(fs.readFileSync("package.json", "utf8"), /"prebuild": "node scripts\/no-placeholders\.mjs/);
});
