// The backend runs a copy of the Strategy Lab engine (written by
// scripts/strategy-lab/sync-engine.sh). This fails when engine.js changes
// without re-running the script, or when the two copies differ.
// Run: node --test tests/strategy-lab/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const UI = new URL("../../app/iq/sl/", import.meta.url);
const BE = new URL("../../../MarketCatalystBackEnd/src/live/strategy-lab/", import.meta.url);
const HEADER_LINES = 4; // the generated banner sync-engine.sh puts on the backend copy
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

describe("engine copies stay in sync", () => {
  const src = fs.readFileSync(new URL("engine.js", UI), "utf8");
  it("engine.js matches the hash sync-engine.sh recorded", () => {
    const rec = fs.readFileSync(new URL("engine.sha256", UI), "utf8").trim();
    assert.equal(sha(src), rec, "app/iq/sl/engine.js changed: run scripts/strategy-lab/sync-engine.sh");
  });
  it("the backend copy is byte-identical (when the backend repo sits next to this one)", (t) => {
    const p = new URL("engine.ts", BE);
    if (!fs.existsSync(p)) return t.skip("MarketCatalystBackEnd not checked out alongside");
    const body = fs.readFileSync(p, "utf8").split("\n").slice(HEADER_LINES).join("\n");
    assert.equal(sha(body), sha(src), "backend engine.ts differs: run scripts/strategy-lab/sync-engine.sh");
    assert.equal(fs.readFileSync(new URL("engine.sha256", BE), "utf8").trim(), sha(src));
  });
});
