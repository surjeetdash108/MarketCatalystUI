// Live Feed → Intraday commentary renders 50 stories at a time with Start /
// Prev / Next / End, quoting only the visible page; a new tab / search /
// filter starts again at page 1.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/screens/commentary.tsx", import.meta.url), "utf8");

describe("intraday commentary is paged", () => {
  it("renders and quotes only the current page", () => {
    assert.match(src, /const pageFeed = feed\.slice\(pw\.from, pw\.to\);/);
    assert.match(src, /\) : pageFeed\.map\(\(item, i\) => \(/);
    assert.match(src, /useLiveQuotes\(pageFeed\.map/);
    assert.doesNotMatch(src, /\) : feed\.map\(\(item, i\) => \(/);
  });
  it("Start / Prev / Next / End buttons", () => {
    for (const l of ["« Start", "‹ Prev", "Next ›", "End »"]) assert.ok(src.includes(`>${l}</button>`), l);
  });
  it("a new tab, search or filter goes back to page 1", () => {
    assert.match(src, /const feedKey = `\$\{activeTab\}\|\$\{q\}\|\$\{tagFilter\}\|\$\{catFilter\}\|\$\{effSec\}\|\$\{capFilter\}`;/);
    assert.match(src, /if \(prevFeedKey !== feedKey\) \{ setPrevFeedKey\(feedKey\); setFeedPage\(0\); \}/);
  });
});
