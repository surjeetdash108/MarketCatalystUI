import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCREENS } from "./alpha-signals-model";
import type { CompanyDoc, IpoEventDoc } from "./types";

const ctx = (companies: CompanyDoc[], ipos: IpoEventDoc[] = []) => ({ companies, sigs: [], analyst: new Map(), ipos, now: Date.parse("2026-11-19T15:00:00Z") });
const rows = (id: string, companies: CompanyDoc[], ipos: IpoEventDoc[] = []) => SCREENS.find(s => s.id === id)!.rows(ctx(companies, ipos));
const at52Low = (ticker: string, o: Partial<CompanyDoc>) =>
  ({ ticker, name: `${ticker} Inc.`, sector: "Technology", type: "CS", price: 10, pctChange: -1, low52: 10, high52: 20, pctFromLow52: 0, exchange: "XNAS", ...o }) as CompanyDoc;

describe("stock screens list common stock only (Nov 19 Logic #2, row 1)", () => {
  it("ETV/ETS/SP/ETF/PFD/UNIT are off; CS, ADRC and OS stay", () => {
    const out = rows("l52", [
      at52Low("GLD", { type: "ETV", name: "SPDR Gold Shares" }), at52Low("MSTY", { type: "ETS" }), at52Low("AOMD", { type: "SP" }),
      at52Low("AAPL", { type: "CS" }), at52Low("AAPG", { type: "ADRC" }), at52Low("ORD", { type: "OS" }),
    ]).map(r => r.ticker).sort();
    assert.deepEqual(out, ["AAPG", "AAPL", "ORD"]);
  });
  it("OTC listings are off (TCGLF, OTC Link)", () => {
    assert.deepEqual(rows("l52", [at52Low("TCGLF", { exchange: "OTC Link" })]), []);
  });
});

describe("Recent IPOs drop SPAC units and blank-check issuers", () => {
  const ipo = (symbol: string, name: string, securityType: string | null): IpoEventDoc => ({ date: "2026-11-14", symbol, name, status: "history", offerPrice: 10, securityType } as unknown as IpoEventDoc);
  it("SP units (BHAIU) and an Acquisition Corp's class A (TCXB) are off; an operating company stays", () => {
    const out = rows("ipo", [], [ipo("BHAIU", "BHAV Acquisition Corp. II", "SP"), ipo("TCXB", "TCGX Acquisition Corp. II", "CS"), ipo("MDRN", "Modern Mining Technology Corp", "CS")]).map(r => r.ticker);
    assert.deepEqual(out, ["MDRN"]);
  });
});

describe("singular holder (Nov 19 Logic #4)", () => {
  it("'1 more institutional holder'", () => {
    const c = { ticker: "XYZ", name: "XYZ", sector: "Health Technology", type: "CS", price: 25, avgVolume20: 2_000_000, pctChange: 0, inst13FShares: 1_285_000, inst13FSharesChange: 285_000, inst13FHolders: 9, inst13FHoldersChange: 1, instAsOf: "Q3 2026" } as CompanyDoc;
    assert.match(rows("inst", [c])[0].why, /^1 more institutional holder and /);
  });
});

describe("ranked screens: investable floor, tie-break, new listings, Nasdaq 100", () => {
  const base = { sector: "Technology", type: "CS", pctChange: 0 };
  it("RS Leaders: $10+ and $20M+ a day, ties broken by the raw RS score", () => {
    const cs = [
      { ...base, ticker: "PENNY", price: 5, avgVolume20: 9e6, rsRating: 99, rsScore: 3 },
      { ...base, ticker: "LOWER", price: 50, avgVolume20: 1e6, rsRating: 99, rsScore: 1.2 },
      { ...base, ticker: "TOP", price: 50, avgVolume20: 1e6, rsRating: 99, rsScore: 2.5 },
    ] as unknown as CompanyDoc[];
    assert.deepEqual(rows("rsl", cs).map(r => r.ticker), ["TOP", "LOWER"]);
  });
  it("Institutional Accumulation leaves out stocks listed in the last 9 months (first 13F quarters)", () => {
    const inst = { ...base, price: 80, avgVolume20: 1e6, inst13FShares: 100e6, inst13FSharesChange: 18e6, inst13FHolders: 600, inst13FHoldersChange: 150, instAsOf: "Q3 2026" };
    const cs = [
      { ...inst, ticker: "CBRS", listingDate: "2026-05-14" },
      { ...inst, ticker: "OLD", listingDate: "2010-01-04" },
    ] as unknown as CompanyDoc[];
    assert.deepEqual(rows("inst", cs).map(r => r.ticker), ["OLD"]);
  });
  it("there is a Top Nasdaq 100 screen", () => {
    assert.ok(SCREENS.some(s => s.id === "ndx" && s.label === "Top Nasdaq 100"));
  });
});
