import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { searchMatchesFor, QUICK_ACCESS_COUNT } from "./search-matches";

const co = (ticker: string, name: string, marketCap: number) => ({ ticker, name, price: 10, pctChange: 1, marketCap });

describe("ticker search (shared by MC's search box and the admin Pulse picker)", () => {
  const companies = [co("AAPL", "Apple Inc.", 4e12), co("NVDA", "NVIDIA Corp", 5e12), co("APLE", "Apple Hospitality REIT", 3e9), co("PINEAPP", "Pineapple Energy", 1e8)];
  it("empty query: the largest companies first (quick access)", () => {
    const q = searchMatchesFor("", [], companies);
    assert.deepEqual(q.map(m => m.sym), ["NVDA", "AAPL", "APLE", "PINEAPP"]);
    assert.ok(q.length <= QUICK_ACCESS_COUNT);
  });
  it("ranks exact ticker → ticker prefix → name prefix → substring", () => {
    const res = searchMatchesFor("apl", [{ ticker: "APL", name: "Apl Corp" }, { ticker: "APLD", name: "Applied Digital" }], companies);
    assert.deepEqual(res.map(m => m.sym).slice(0, 3), ["APL", "APLD", "APLE"]);
    const byName = searchMatchesFor("apple", [], companies).map(m => m.sym);
    assert.deepEqual(byName, ["AAPL", "APLE", "PINEAPP"]);
  });
  it("MC's search box and the admin picker both use it", () => {
    assert.match(readFileSync(new URL("./shell.tsx", import.meta.url), "utf8"), /searchMatchesFor\(searchQ, tickerSearchResults, shellCompanies\)/);
    // The admin picker gets the same ranking from the backend (the admin account has no plan for the user routes).
    assert.match(readFileSync(new URL("../admin/admin-console.tsx", import.meta.url), "utf8"), /\/api\/admin\/ticker-search\?q=/);
    const html = readFileSync(new URL("../../public/admin/console.html", import.meta.url), "utf8");
    assert.match(html, /placeholder="Search tickers and stocks…"/);
    assert.match(html, /click to select/);
  });
});
