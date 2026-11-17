import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { pulseAgo, pulseLetter, pulseTime } from "./community-pulse";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("Market Catalyst Pulse (dashboard)", () => {
  it("is the renamed card with admin posts only — no tweet or chat tabs", () => {
    const src = read("./community-pulse.tsx");
    assert.match(src, /<h3>Market Catalyst Pulse<\/h3>/);
    assert.doesNotMatch(src, /Latest Tweets|Trader Chat|Walter Bloomberg/);
    assert.match(src, /useApiResource<\{ posts: PulsePost\[\] \}>\("\/api\/pulse", POLL_MS\)/);
  });
  it("time since the post and the post time (US Eastern)", () => {
    const at = "2026-11-18T14:41:00Z"; // 9:41 AM ET
    const now = Date.parse("2026-11-18T14:42:00Z");
    assert.equal(pulseAgo(at, now), "1m");
    assert.equal(pulseAgo(at, Date.parse("2026-11-18T14:41:20Z")), "now");
    assert.equal(pulseAgo(at, Date.parse("2026-11-18T17:41:00Z")), "3h");
    assert.equal(pulseTime(at, now), "9:41 AM");
    assert.equal(pulseTime(at, Date.parse("2026-11-19T15:00:00Z")), "Nov 18 · 9:41 AM");
  });
  it("no ticker: the avatar is the post's first letter; a ticker shows its logo", () => {
    assert.equal(pulseLetter("  nvda leads the chip bid"), "N");
    assert.match(read("./community-pulse.tsx"), /p\.ticker \? \([\s\S]{0,200}<StockLogo sym=\{p\.ticker\}/);
  });
  it("admin console has a Market Catalyst Pulse section after Articles, wired through the parent", () => {
    const html = read("../../public/admin/console.html");
    const articles = html.indexOf("<h2>Articles</h2>");
    const pulse = html.indexOf("<h2>Market Catalyst Pulse</h2>");
    assert.ok(articles > 0 && pulse > articles);
    for (const t of ["admin:pulseList", "admin:pulseSave", "admin:pulseDelete", "admin:pulseSearch"]) {
      assert.ok(html.includes(t), t);
      assert.ok(read("../admin/admin-console.tsx").includes(t), t);
    }
  });
});

describe("module toggle", () => {
  it("order: Market Catalyst, Stock Intelligence, Money Flow, Alpha Signals, Strategy Lab", () => {
    const src = read("./module-switcher.tsx");
    const order = [...src.matchAll(/\["(MC|SI|MF|AS|SL)", "[^"]+"\]/g)].map(m => m[1]);
    assert.deepEqual(order, ["MC", "SI", "MF", "AS", "SL"]);
  });
  it("shows no lock until the plan is known", () => {
    assert.match(read("./module-switcher.tsx"), /const locked = !!entitlements && !canAccessModule\(m, entitlements\);/);
  });
});
