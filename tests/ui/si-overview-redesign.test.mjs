// Stock Intelligence redesign: six tabs, the masthead above them, and an Overview whose left menu
// holds Why it moved and Why it could move as panels (they are no longer tabs).
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../app/iq/si/${p}`, import.meta.url), "utf8");
const src = read("stock-intelligence.tsx");
const data = read("data.ts");
const types = read("types.ts");
const overview = read("si-overview.tsx");
const masthead = read("si-masthead.tsx");

describe("six tabs", () => {
  it("the tab list is Overview, Fundamentals, Technicals, AI Research, Trade Builder, Trade Tracker", () => {
    const block = data.match(/export const TABS[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1] ?? "";
    const tabs = [...block.matchAll(/\["(\w+)", "([^"]+)"\]/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(tabs, [
      ["overview", "Overview"],
      ["fund", "Fundamentals"],
      ["tech", "Technicals"],
      ["ai", "AI Research"],
      ["lab", "Trade Builder"],
      ["mon", "Trade Tracker"],
    ]);
  });
  it("moved and could are not tabs any more", () => {
    assert.doesNotMatch(types, /"moved"|"could"/);
    assert.doesNotMatch(src, /activeTab === "moved"|activeTab === "could"/);
  });
});

describe("header", () => {
  it("the top bar scrolls away; the masthead and the tab rail follow it, once, above every tab", () => {
    const main = src.indexOf("{/* Main Container */}");
    for (const marker of ['className="si-topbar"', "<SiMasthead", "<SiTabRail"]) {
      const at = src.indexOf(marker);
      assert.ok(at > 0 && at < main, `${marker} sits above the tab content`);
      assert.equal(src.split(marker).length - 1, 1, `${marker} appears once`);
    }
    assert.match(src, /className="si-topbar" style=\{\{ display: "contents" \}\}/);
  });
  it("only the tab rail sticks", () => {
    assert.match(masthead, /className="si-tabrail"[\s\S]*?position: "sticky"/);
    const topbar = src.slice(src.indexOf('className="si-topbar"'), src.indexOf("<SiMasthead"));
    assert.doesNotMatch(topbar, /position: "sticky"/);
  });
  it("the watchlist star stays beside the ticker", () => {
    assert.match(src, /afterTicker=\{[\s\S]*?toggleWatch/);
    assert.match(masthead, /<strong data-caps>\{p\.ticker\}<\/strong>\s*\{p\.afterTicker\}/);
  });
});

describe("Overview", () => {
  it("the left menu lists the read, Fundamentals, Technicals, Why it moved and Why it could move", () => {
    assert.match(overview, /type PaneId = "read" \| "fund" \| "tech" \| "moved" \| "could"/);
    for (const label of ["MarketCatalyst read", "Fundamentals", "Technicals", "Why it moved", "Why it could move"]) {
      assert.ok(src.includes(`label: "${label}"`), label);
    }
  });
  it("Fundamentals and Technicals link to their full tab; the other two panels have none", () => {
    assert.match(src, /fund: <ReadPanel [^>]*onOpen=\{\(\) => setActiveTab\("fund"\)\}/);
    assert.match(src, /onOpen=\{\(\) => setActiveTab\("tech"\)\}/);
    assert.doesNotMatch(src, /<MovedPanel [^>]*onOpen/);
    assert.doesNotMatch(src, /<CouldPanel [^>]*onOpen/);
  });
  it("the ring and every score row open how MC Confidence is calculated", () => {
    assert.match(overview, /className="ovx-sr"[\s\S]*?onClick=\{data\.onScores\}/);
    assert.match(overview, /aria-label="How MC Confidence is calculated"[\s\S]*?onClick=\{data\.onScores\}/);
    assert.match(src, /<ConfidenceDialog /);
  });
  it("the old price-history chart and its bars request are gone", () => {
    assert.doesNotMatch(src, /overviewBars|PRICE HISTORY|useBackendBars\([^)]*range/);
  });
  it("a part with no data is left out, not filled in", () => {
    assert.match(overview, /\{growth\.length > 0 && \(/);
    assert.match(overview, /read\.low \|\| read\.high/);
  });
});

describe("Technicals tab", () => {
  const tech = src.slice(src.indexOf('{activeTab === "tech"'), src.indexOf("TAB 7: AI RESEARCH"));
  it("four tiles on top, then the chart beside the price ladder", () => {
    assert.ok(tech.indexOf("<TechnicalTiles") > 0);
    assert.ok(tech.indexOf("<TechnicalTiles") < tech.indexOf("<StockChart"), "tiles above the chart");
    assert.ok(tech.indexOf("<StockChart") < tech.indexOf("<PriceLadder"), "chart before the ladder");
    assert.match(tech, /Where Price Sits/);
  });
  it("the old read card and the key-levels list are gone", () => {
    assert.doesNotMatch(src, /technicalReadCard|KEY SUPPORT & RESISTANCE LEVELS/);
  });
});

describe("Overview reads", () => {
  it("the menu statuses and the panels come from the read engine, not from the score rows", () => {
    assert.match(src, /verdictStatus\(overall\)/);
    assert.match(src, /verdictStatus\(fund\.verdict\)/);
    assert.match(src, /verdictStatus\(tech\.verdict\)/);
    assert.match(src, /headlineRead\(stock\.t, siFacts, tech, fund, overall,/);
    assert.match(src, /read\?\.levels\.find\(\(l\) => l\.tone === "down"\)/);
  });
});
