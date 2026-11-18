import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCREENS } from "./alpha-signals-model";
import type { IpoEventDoc } from "./types";
import type { CompanyDoc } from "./types";

const NOW = Date.parse("2026-11-18T17:40:00Z");
const ipo = (o: Partial<IpoEventDoc>): IpoEventDoc => ({
  date: "2026-10-23", symbol: "LYCA", name: "Lycia", status: "history", offerPrice: 18, currentPrice: 26.4, returnSinceIpoPct: 55.29, ...o,
} as IpoEventDoc);
const rows = (ipos: IpoEventDoc[], quotes = new Map<string, { price: number | null; pctChange: number | null }>(), companies: CompanyDoc[] = []) =>
  SCREENS.find(s => s.id === "ipo")!.rows({ companies, sigs: [], analyst: new Map(), ipos, now: NOW, quotes });

// Errors 1–6, Logic #4.
describe("Recent IPOs: live price, since-IPO from it, honest gaps", () => {
  it("LYCA: the live quote's price and day %, and since IPO measured from it ($31.50 / $18 = +75%)", () => {
    const [r] = rows([ipo({})], new Map([["LYCA", { price: 31.5, pctChange: 1.9 }]]));
    assert.equal(r.price, 31.5);
    assert.equal(r.pct, 1.9);
    assert.match(r.why, /Listed 2026-10-23 at \$18\.00 · \+75% since IPO/);
  });
  it("CTY: below the offer is negative ($17.63 / $18 = −2%), never the stored +15%", () => {
    const [r] = rows([ipo({ symbol: "CTY", offerPrice: 18, currentPrice: 20.71, returnSinceIpoPct: 15.06 })], new Map([["CTY", { price: 17.63, pctChange: -1 }]]));
    assert.match(r.why, /−2% since IPO|-2% since IPO/);
    assert.doesNotMatch(r.why, /\+15%/);
  });
  it("a string offer price from the store is still a number", () => {
    const [r] = rows([ipo({ symbol: "IAM", offerPrice: "16" as unknown as number })], new Map([["IAM", { price: 14.64, pctChange: 3 }]]));
    assert.match(r.why, /at \$16\.00 · -8% since IPO/); // 14.64 / 16 − 1 = −8.5%
  });
  it("no trades yet (HRIAU units): says so instead of a bare dash", () => {
    const [r] = rows([ipo({ symbol: "HRIAU", offerPrice: 10, currentPrice: null, returnSinceIpoPct: null })]);
    assert.equal(r.price, null);
    assert.match(r.why, /no trades yet/i);
  });
  it("no offer price: says it's unavailable rather than inventing one", () => {
    const [r] = rows([ipo({ symbol: "ABC", offerPrice: null })], new Map([["ABC", { price: 5, pctChange: 0 }]]));
    assert.match(r.why, /offer price unavailable/);
    assert.doesNotMatch(r.why, /since IPO/);
  });
});
