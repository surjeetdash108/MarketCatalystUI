import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.join(process.cwd(), "app/admin/billing/admin-billing.tsx"), "utf8");

describe("admin billing v2", () => {
  it("Staff tab edits the allowlist through the audited API only (never in app code)", () => {
    assert.match(src, /"subscribers", "staff", "promos", "audit"/);
    assert.match(src, /apiPost<\{ emails: string\[\] \}>\("\/api\/admin\/staff-access", \{ email \}\)/);
    assert.match(src, /apiDelete<\{ emails: string\[\] \}>\(`\/api\/admin\/staff-access\/\$\{encodeURIComponent\(e\)\}`\)/);
    assert.doesNotMatch(src, /@(gmail|conyxit)\.com/);
  });
  it("subscribers: Staff badge, staff filter, paying count excludes staff", () => {
    assert.match(src, /\{r\.staff && <span data-testid="staff-badge"/);
    assert.match(src, /sel\("staff", \["true", "false"\]\)/);
    assert.match(src, /paying \(staff excluded\)/);
  });
  it("detail: phone masked, click-to-reveal is a POST (audited); consent and refund action", () => {
    assert.match(src, /detail\.phoneMasked/);
    assert.match(src, /apiPost<\{ phone: string \| null \}>\(`\/api\/admin\/billing\/subscribers\/\$\{uid\}\/phone\/reveal`\)/);
    assert.match(src, /data-testid="sub-consent"/);
    assert.match(src, /apiPost<\{ amount: number \}>\(`\/api\/admin\/billing\/subscribers\/\$\{uid\}\/refund`\)/);
    assert.match(src, /errorBody\(e\)\.status === 404 \? "off"/); // REFUND_WINDOW_DAYS = 0 → no refund action
  });
  it("the subscriber detail renders outside the table card (a fixed drawer inside the card gets clipped)", () => {
    const sub = src.slice(src.indexOf("function Subscribers()"), src.indexOf("function SubscriberContact"));
    assert.match(sub, /<\/table>\s*<\/div>\s*<\/div>\s*\{detail && \(/);
  });
});
