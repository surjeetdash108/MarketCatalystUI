import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// The Peers tab's table: every column heading is a button that sorts, the default
// view is the 25 largest by market cap, and the whole industry is in the pool.
// Source checks, like the repo's other screen specs: the tab needs the whole stock
// screen's state to render. The ordering rules themselves are tested in peer-table.spec.ts.
const src = fs.readFileSync(path.join(process.cwd(), "app/iq/screens/stock.tsx"), "utf8");

describe("Peers tab column headings sort", () => {
  it("has a heading for every column, each tied to its sort key", () => {
    for (const [key, label] of [
      ["sym", "Company"], ["price", "Price"], ["c", "Today's Change"], ["w", "Weekly Change"],
      ["m", "Monthly Change"], ["mcap", "Market Cap"], ["pe", "P/E Ratio"], ["rs", "RS Rating"],
    ]) {
      assert.ok(src.includes(`["${key}", "${label}"`), `heading ${label} -> ${key}`);
    }
  });

  it("headings are buttons that flip the sort on click, and say which way they sort", () => {
    assert.match(src, /onClick=\{\(\) => setPeerTbl\(cur => nextPeerSort\(cur, key\)\)\}/);
    assert.match(src, /aria-sort=\{on \? \(peerTbl\.dir === "desc" \? "descending" : "ascending"\) : "none"\}/);
    assert.match(src, /label\}\{on \? \(peerTbl\.dir === "desc" \? " ▼" : " ▲"\) : ""\}/);
  });

  it("the old row of Sort buttons is gone", () => {
    assert.ok(!src.includes('aria-label="Sort peers"'));
    assert.ok(!src.includes("setPeerSortBy"));
  });
});

describe("Peers tab default view", () => {
  it("opens ordered by market cap and shows the largest 25, with the table fed by the whole pool", () => {
    assert.match(src, /useState<PeerSort>\(DEFAULT_PEER_SORT\)/);
    assert.match(src, /const peersAll: PeerRow\[\] = topByMarketCap\(peersAllFull\);/);
    assert.match(src, /peerView\(peersAllFull, \{ query: peerQuery, by: peerTbl\.by, dir: peerTbl\.dir, showAll: peersShowAll \}\)/);
  });

  it("says how many are shown and offers all of them", () => {
    assert.match(src, /peerTable\.limited \? ` of \$\{peerTable\.matched\}` : ""/);
    assert.match(src, /Show all \$\{peerTable\.matched\} →/);
  });

  it("goes back to the largest 25 when another stock is opened", () => {
    assert.match(src, /useEffect\(\(\) => \{ setPeersShowAll\(false\); \}, \[sym\]\)/);
  });

  it("the View all drawer lists every peer, not only the default 25", () => {
    assert.match(src, /sortedPeersAll\.map\(peer => \{/);
  });
});

describe("Peers pool", () => {
  it("adds the company's industry to the vendor's related names, so the list is not just ~10", () => {
    assert.match(src, /c\.industry === myIndustry && c\.ticker !== sym && c\.pctChange != null/);
    assert.match(src, /mergePeers\(relatedPeersAll, industryPeers\)/);
  });

  it("takes the industry from the synced list, so no whole-sector placeholder shows while the company record loads", () => {
    assert.match(src, /companies\.find\(x => x\.ticker === sym\)\?\.industry \?\? liveCompany\?\.industry/);
  });
});
