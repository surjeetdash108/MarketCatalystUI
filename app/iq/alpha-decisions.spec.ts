import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCREENS, actionOf, scoreCompany, type ScreenCtx } from "./alpha-signals-model";
import type { AnalystConsensusDoc, CompanyDoc } from "./types";

const ctx = (companies: CompanyDoc[], extra: Partial<ScreenCtx> = {}): ScreenCtx => ({ companies, sigs: [], analyst: new Map(), ipos: [], now: Date.parse("2026-11-19T15:00:00Z"), ...extra });
const rows = (id: string, c: ScreenCtx) => SCREENS.find(s => s.id === id)!.rows(c);
const stock = (o: Partial<CompanyDoc>): CompanyDoc => ({ ticker: "X", name: "X Corp", sector: "Technology", type: "CS", price: 50, pctChange: 1, avgVolume20: 2e6, marketCap: 5e9, ...o } as CompanyDoc);

describe("decision 3: a strong score in a weakening trend is Watch, not Avoid", () => {
  it("score 81 → Watch with the reason; a weak score stays Avoid", () => {
    const c = stock({});
    const hi = actionOf(c, 81, "Weakening", 100, 0);
    assert.equal(hi.key, "watch");
    assert.match(hi.why, /trend is deteriorating/);
    assert.equal(actionOf(c, 40, "Weakening", 100, 0).key, "avoid");
  });
});

describe("decision 4: EPS growth is labelled adjusted", () => {
  it("Earnings Acceleration says adjusted EPS", () => {
    const [r] = rows("eps", ctx([stock({ epsGrowthYoY: 8.11, revenueGrowthYoY: 2.56 })]));
    assert.match(r.why, /^Adjusted EPS \+811% YoY, revenue \+256% YoY\.$/);
  });
});

describe("decision 6: Institutional Accumulation compares one quarter", () => {
  it("only rows from the newest reported quarter", () => {
    const inst = (ticker: string, asOf: string) => stock({ ticker, inst13FShares: 1_200_000, inst13FSharesChange: 200_000, inst13FHolders: 50, inst13FHoldersChange: 3, instAsOf: asOf });
    const out = rows("inst", ctx([inst("A", "Q2 2026"), inst("B", "Q3 2026"), inst("C", "Q3 2026")])).map(r => r.ticker);
    assert.deepEqual(out.sort(), ["B", "C"]);
  });
});

describe("decision 7: the target names its source", () => {
  it("catalyst metric says FMP consensus target", () => {
    const a = { ticker: "AI", priceTargetConsensus: 11.25, strongBuy: 1, buy: 1, hold: 1, sell: 0, strongSell: 0, recentGrades: [] } as unknown as AnalystConsensusDoc;
    const s = scoreCompany(stock({ ticker: "AI", price: 9.97, rsRating: 40 }), a, 0)!;
    assert.match(s.comps.find(x => x.key === "c")!.metric, /FMP consensus target \+13% vs price/);
  });
});

describe("decision 9: stock screens list stocks", () => {
  const etf = stock({ ticker: "UUP", name: "Invesco DB US Dollar Index Bullish Fund", type: "ETV", pctFromHigh52: -0.1, high52: 29.6 });
  const spac = stock({ ticker: "QRED", name: "Quasaredge Acquisition Corporation", sicCode: "6770", pctFromHigh52: -0.1, high52: 10.1 } as Partial<CompanyDoc>);
  const pfd = stock({ ticker: "WVVIP", type: "PFD", pctFromHigh52: -0.1, high52: 5 });
  const real = stock({ ticker: "AAPL", pctFromHigh52: -0.2, high52: 360 });
  it("ETFs, preferreds and SPACs are off New 52W High", () => {
    assert.deepEqual(rows("h52", ctx([etf, spac, pfd, real])).map(r => r.ticker), ["AAPL"]);
  });
  it("Highest Volatility needs $5+ and $20M+ a day", () => {
    const v = (ticker: string, price: number, avgVolume20: number) => stock({ ticker, price, avgVolume20, realizedVol30: 120 });
    assert.deepEqual(rows("vol", ctx([v("PARA", 0.06, 1e8), v("THIN", 20, 1e5), v("OK", 20, 2e6)])).map(r => r.ticker), ["OK"]);
  });
});

describe("decision 8: Top S&P 500 uses the live membership when it's loaded", () => {
  it("live list wins over the static one", () => {
    const c = [stock({ ticker: "AIZ", marketCap: 1e10 }), stock({ ticker: "AAPL", marketCap: 4e12 })];
    const out = rows("sp", ctx(c, { indexMembers: { sp500: new Set(["AIZ", "AAPL"]) } })).map(r => r.ticker);
    assert.deepEqual(out, ["AAPL", "AIZ"]);
  });
});
