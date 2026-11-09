// admin-data.ts feeds the admin console iframe, which renders rows with
// innerHTML. User-supplied strings must be escaped, status must default to
// free, and MRR must come from payments. Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/admin/admin-data.ts", import.meta.url), "utf8");
describe("admin console data mapping", () => {
  it("escapes the user's name and email", () => {
    assert.match(src, /name:\s*escapeHtml\(/);
    assert.match(src, /email:\s*escapeHtml\(/);
  });
  it("uses the shared status mapping and payments-only MRR", () => {
    assert.match(src, /toConsoleStatus\(u\.status\)/);
    assert.match(src, /mrr:\s*mrrFromPayments\(payments, u\.uid/);
    assert.doesNotMatch(src, /default: return "active"/);
    assert.doesNotMatch(src, /mrr:\s*isPaying/);
  });
});
