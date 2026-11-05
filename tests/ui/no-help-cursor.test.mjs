// The pointer never turns into the "?" help cursor: tooltips (title attributes) still show on hover.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && !e.name.startsWith(".")) files(p, out); }
    else if (/\.(css|tsx?|jsx?)$/.test(e.name) && !/\.(spec|test)\./.test(e.name)) out.push(p);
  }
  return out;
}

describe("no help cursor", () => {
  it("no stylesheet or inline style in app/, components/ or lib/ sets cursor: help", () => {
    const hits = [];
    for (const d of ["app", "components", "lib"]) {
      if (!fs.existsSync(ROOT + d)) continue;
      for (const f of files(ROOT + d)) {
        fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/cursor\s*:\s*["']?help\b/.test(l)) hits.push(path.relative(ROOT, f) + ":" + (i + 1)); });
      }
    }
    assert.deepEqual(hits, []);
  });
});
