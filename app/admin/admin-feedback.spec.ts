import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("user feedback reaches the admin console", () => {
  it("the in-app box sends the text to the backend", () => {
    const src = read("../iq/welcome-feedback-modals.tsx");
    assert.match(src, /apiPost\("\/api\/feedback", \{ text \}\)/);
  });
  it("the console has a Feedback section (email, date & time, feedback) wired through the parent", () => {
    const html = read("../../public/admin/console.html");
    assert.match(html, /<div class="nav" data-view="feedback">/);
    assert.match(html, /<th style="width:24%">Email<\/th><th style="width:18%">Date &amp; time<\/th><th>Feedback<\/th>/);
    assert.match(html, /'mcpkeys','feedback'\]/);
    assert.match(html, /xesc\(f\.text\)/);
    const parent = read("./admin-console.tsx");
    assert.match(parent, /d\.type === "admin:feedbackList"/);
    assert.match(parent, /apiGet<\{ feedback: unknown\[\] \}>\("\/api\/admin\/feedback"\)/);
    assert.match(read("./[slug]/page.tsx"), /"mcpkeys", "feedback"\]/);
  });
});

describe("upgrade confirmation", () => {
  it("an upgrade shows no 'You're now on… / Nothing was charged… / Next renewal…' lines", () => {
    assert.match(read("../iq/billing/billing-pages.tsx"), /isPlanChange && change && change\.kind !== "upgrade" \? \(/);
  });
});
