// Pipeline status rows have Edit and Delete (owner request, 26 Nov 2026), and
// the parent page forwards them to PATCH / DELETE /api/admin/content/:id.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const consoleHtml = read("public/admin/console.html");
const bridge = read("app/admin/admin-console.tsx");

describe("content pipeline edit and delete", () => {
  it("every row offers Delete, and Edit where it applies", () => {
    assert.match(consoleHtml, /onclick="cpDelete\(/);
    assert.match(consoleHtml, /it\.canEdit \? '<button class="cp-btn alt" onclick="cpEditOpen\(/);
    assert.match(consoleHtml, /id="cpEditModal" class="cp-modal" hidden/);
  });
  it("the bridge sends edit as PATCH and delete as DELETE", () => {
    assert.match(bridge, /d\.type === "admin:contentEdit" \? "edit"/);
    assert.match(bridge, /action === "edit"\) data = await apiPatch\(`\/api\/admin\/content\/\$\{id\}`/);
    assert.match(bridge, /action === "delete"\) data = await apiDelete\(`\/api\/admin\/content\/\$\{id\}`/);
  });
});
