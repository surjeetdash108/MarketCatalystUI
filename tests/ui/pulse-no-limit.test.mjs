// Pulse posts have no length limit (owner decision, 26 Nov 2026): the admin
// Pulse box has no maxlength and its counter just counts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync(new URL("../../public/admin/console.html", import.meta.url), "utf8");
describe("Pulse admin input", () => {
  it("has no 500-character cap or '/ 500' counter", () => {
    assert.match(html, /<textarea id="plText" class="inp" rows="4" placeholder=/);
    assert.doesNotMatch(html, /id="plText"[^>]*maxlength/);
    assert.match(html, /<span id="plCount">0<\/span> characters/);
  });
});
