// Stock Intelligence "+ Watch" adds the stock to the user's Market Catalyst
// watchlist (the shared watchlist state), not a local flag.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../app/iq/si/stock-intelligence.tsx", import.meta.url), "utf8");

describe("SI Watch = Market Catalyst watchlist", () => {
  it("reads and writes the shared watchlists", () => {
    assert.match(src, /const wl = useWatchlistsContext\(\);/);
    assert.match(src, /const isWatched = !!stock && wl\.watchlists\.some\(\(w\) => w\.tickers\.includes\(stock\.t\.toUpperCase\(\)\)\);/);
    assert.doesNotMatch(src, /useState\(false\);\s*\n?.*setIsWatched|const \[isWatched, setIsWatched\]/);
  });
  it("Watch adds to the first list (creating one if there is none); Watching removes it from every list", () => {
    assert.match(src, /wl\.watchlists\[0\] \?\? \(await wl\.createList\("My Watchlist"\)\)/);
    assert.match(src, /await wl\.addTicker\(list\.id, sym\)/);
    assert.match(src, /for \(const w of wl\.watchlists\) if \(w\.tickers\.includes\(sym\)\) await wl\.removeTicker\(w\.id, sym\);/);
  });
  it("a refused add (full list, signed out) says why", () => {
    assert.match(src, /setWatchMsg\(res\.message\)/);
  });
});
