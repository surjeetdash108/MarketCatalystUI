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

