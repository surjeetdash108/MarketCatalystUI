import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { pulseAgo, pulseLetter, pulseMatchCount, pulseQueryPath, pulseSegments, pulseTerms, pulseTime } from "./community-pulse";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("Market Catalyst Pulse (dashboard)", () => {
  it("is the renamed card with admin posts only — no tweet or chat tabs", () => {
    const src = read("./community-pulse.tsx");
    assert.match(src, /<h3>Market Catalyst Pulse<\/h3>/);
    assert.doesNotMatch(src, /Latest Tweets|Trader Chat|Walter Bloomberg/);
    assert.match(src, /useApiResource<\{ posts: PulsePost\[\] \}>\(pulseQueryPath\(sentQ\), POLL_MS\)/);
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

describe("Market Catalyst Pulse search", () => {
  it("an empty box reads the newest posts; a query is sent to the backend search", () => {
    assert.equal(pulseQueryPath("  "), "/api/pulse");
    assert.equal(pulseQueryPath(" $NVDA chips "), "/api/pulse?q=%24NVDA%20chips");
  });
  it("the card has the search box", () => {
    const src = read("./community-pulse.tsx");
    assert.match(src, /data-testid="pulse-search"/);
    assert.match(src, /No posts match/);
  });
});

describe("Market Catalyst Pulse long posts", () => {
  it("each post's text collapses with a Show more / Show less toggle", () => {
    const src = read("./community-pulse.tsx");
    assert.match(src, /<PulseText text=\{p\.text\} terms=\{terms\} \/>/);
    assert.match(src, /Show more/);
    assert.match(src, /Show less/);
    assert.match(src, /aria-expanded=\{open\}/);
    assert.match(read("../iq.css"), /\.cpulse-tw-text\.clamp \{[^}]*-webkit-line-clamp: 4/);
  });
});

describe("Market Catalyst Pulse search highlight", () => {
  it("terms: split on spaces, $ and @ dropped, lower-cased, no duplicates", () => {
    assert.deepEqual(pulseTerms("  $NVDA chips nvda @Market "), ["nvda", "chips", "market"]);
    assert.deepEqual(pulseTerms("   "), []);
    assert.deepEqual(pulseTerms("$"), []);
  });
  it("marks every match, any case, as the user types", () => {
    const segs = pulseSegments("Nvidia ($NVDA) beat; NVIDIA rallied", ["nvi"]);
    assert.deepEqual(segs.filter(s => s.hit).map(s => s.t), ["Nvi", "NVI"]);
    assert.equal(segs.map(s => s.t).join(""), "Nvidia ($NVDA) beat; NVIDIA rallied");
  });
  it("a ticker query marks the symbol inside $TICKER; several words each mark", () => {
    assert.deepEqual(pulseSegments("($NVDA) up", pulseTerms("$nvda")).filter(s => s.hit).map(s => s.t), ["NVDA"]);
    assert.deepEqual(pulseSegments("chip bid, chips up", pulseTerms("chips bid")).filter(s => s.hit).map(s => s.t), ["bid", "chips"]);
  });
  it("regex characters in the box are matched literally; no terms means no marks", () => {
    assert.deepEqual(pulseSegments("a (b) c", pulseTerms("(b")).filter(s => s.hit).map(s => s.t), ["(b"]);
    assert.deepEqual(pulseSegments("plain text", []), [{ t: "plain text", hit: false }]);
  });
  it("the card marks the text, name, handle and ticker, and shows full posts while searching", () => {
    const src = read("./community-pulse.tsx");
    assert.match(src, /<mark key=\{i\} className="cpulse-hl">/);
    assert.match(src, /<PulseText text=\{p\.text\} terms=\{terms\} \/>/);
    assert.match(src, /const terms = pulseTerms\(q\)/);
    assert.match(src, /const clamped = !open && !searching/);
  });
});

describe("Market Catalyst Pulse match count and find-style highlight", () => {
  const post = "Nvidia ($NVDA) interim CEO; NVDA up. Nvidia again.";
  it("counts every marked occurrence, any case", () => {
    assert.equal(pulseMatchCount(post, pulseTerms("nvda")), 2);
    assert.equal(pulseMatchCount(post, pulseTerms("nvidia")), 2);
    assert.equal(pulseMatchCount(post, pulseTerms("nvid nvda")), 4);
    assert.equal(pulseMatchCount(post, []), 0);
  });
  it("a typo that is in no post (nvdi) matches nothing — the box says so instead of staying silent", () => {
    assert.equal(pulseMatchCount(post, pulseTerms("nvdi")), 0);
    const src = read("./community-pulse.tsx");
    assert.match(src, /No matches/);
    assert.match(src, /data-testid="pulse-count"/);
  });
  it("matches are bright yellow with dark ink, like the browser's find", () => {
    assert.match(read("../iq.css"), /\.cpulse mark\.cpulse-hl \{ background: #ffe600; color: #111;/);
  });
});

