import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeIssuers, isFundType, issuerKey } from "./issuer-dedupe";
import { buildSectorList } from "./live-market-indices";
import { indexMemberSet, INDEX_MEMBERS } from "./index-constituents";
import { liveCapBillions } from "./heatmap-design";
import type { CompanyDoc } from "./types/companies";
import type { SectorApiDoc } from "./types/sectors";

const B = 1e9;
const co = (o: Partial<CompanyDoc> & { ticker: string }) =>
  ({ id: o.ticker, name: null, price: null, pctChange: 0, marketCap: 1 * B, sector: "Finance", ...o }) as unknown as CompanyDoc;

// 24 Nov 2026: Alphabet three times, Berkshire twice, 43 ETFs ($7.3T) in Finance.
describe("issuer-dedupe", () => {
  it("one company once: the ordinary listing beats the depositary share that carries the whole cap", () => {
    const out = dedupeIssuers([
      { ticker: "GOOGM", name: "Alphabet Inc. Depository Shs Repr 1/20th Conv Pfd Registered Shs", marketCap: 3547 * B },
      { ticker: "GOOGL", name: "Alphabet Inc.", marketCap: 3441 * B },
      { ticker: "GOOG", name: "Alphabet Inc.", marketCap: 3438 * B },
    ]);
    assert.deepEqual(out.map((d) => d.ticker), ["GOOGL"]);
  });
  it("Berkshire A and B are one company; the larger cap (A) stays", () => {
    const out = dedupeIssuers([
      { ticker: "BRK.B", name: "Berkshire Hathaway Inc.", marketCap: 800 * B },
      { ticker: "BRK.A", name: "Berkshire Hathaway Inc.", marketCap: 1229 * B },
    ]);
    assert.deepEqual(out.map((d) => d.ticker), ["BRK.A"]);
  });
  it("funds are dropped; companies without a name keep their own ticker", () => {
    assert.ok(["ETF", "ETN", "ETV", "FUND"].every(isFundType));
    assert.ok(!["CS", "ADRC", "PFD", null, undefined].some((t) => isFundType(t as string)));
    assert.equal(issuerKey({ ticker: "XYZ", name: null }), "TKR_XYZ");
    assert.equal(issuerKey({ ticker: "A", name: "Alphabet Inc.", cik: "0001652044" }), "CIK_1652044");
    const out = dedupeIssuers([
      { ticker: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", marketCap: 2182 * B },
      { ticker: "JPM", name: "JPMorgan Chase & Co.", type: "CS", marketCap: 841 * B },
    ]);
    assert.deepEqual(out.map((d) => d.ticker), ["JPM"]);
  });
});

describe("buildSectorList (Heatmap and Dashboard)", () => {
  const live = [{ sector: "Finance", pctChange: -0.18 }] as unknown as SectorApiDoc[];
  it("Finance holds the banks once; the ETFs and the second Berkshire class are gone", () => {
    const rows = buildSectorList(
      [
        co({ ticker: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", marketCap: 2182 * B, pctChange: -0.7 }),
        co({ ticker: "SPY", name: "SPDR S&P 500 ETF", type: "ETF", marketCap: 763 * B, pctChange: -0.8 }),
        co({ ticker: "BRK.A", name: "Berkshire Hathaway Inc.", type: "CS", marketCap: 1229 * B, pctChange: 0.6 }),
        co({ ticker: "BRK.B", name: "Berkshire Hathaway Inc.", type: "CS", marketCap: 800 * B, pctChange: 0.7 }),
        co({ ticker: "JPM", name: "JPMorgan Chase & Co.", type: "CS", marketCap: 841 * B, pctChange: -0.1 }),
      ],
      live,
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].items.map((i) => i[0]), ["BRK.A", "JPM"]);
    assert.equal(rows[0].items[0][1], 1229); // $B
  });
  it("a sector made only of funds has no row; sector order and docs without a type still work", () => {
    const rows = buildSectorList(
      [co({ ticker: "QQQ", name: "Invesco QQQ Trust", type: "ETF", sector: "Funds" }), co({ ticker: "WAT", name: "Waters Corporation", sector: "Health Technology", marketCap: 44 * B })],
      [{ sector: "Funds", pctChange: 0 }, { sector: "Health Technology", pctChange: 1 }] as unknown as SectorApiDoc[],
    );
    assert.deepEqual(rows.map((r) => r.name), ["Health Technology"]);
  });
});

describe("indexMemberSet", () => {
  const list = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);
  it("uses the live list when it looks complete", () => {
    const s = indexMemberSet("SP500", { sp500: [...list(502, "S"), "PLTR"] });
    assert.equal(s.size, 503);
    assert.ok(s.has("PLTR"));
    assert.ok(indexMemberSet("NDX", { nasdaq100: [...list(100, "N"), "SPCX"] }).has("SPCX"));
    assert.equal(indexMemberSet("DOW", { dow30: list(30, "D") }).size, 30);
  });
  it("keeps the static list while loading, on failure, or when the live answer is thin", () => {
    assert.equal(indexMemberSet("SP500", null), INDEX_MEMBERS.SP500);
    assert.equal(indexMemberSet("SP500", { sp500: list(12, "S") }), INDEX_MEMBERS.SP500);
    assert.equal(indexMemberSet("DOW", { sp500: list(500, "S") }), INDEX_MEMBERS.DOW); // dow30 not stored yet
  });
});

describe("liveCapBillions", () => {
  it("the live quote's cap replaces a lagging stored one (AMD: $744B stored, $680B live)", () => {
    assert.equal(liveCapBillions(680e9, 743.7), 680);
  });
  it("keeps the stored cap when there is no live cap or it is implausible", () => {
    assert.equal(liveCapBillions(null, 743.7), 743.7);
    assert.equal(liveCapBillions(0, 743.7), 743.7);
    assert.equal(liveCapBillions(5e9, 743.7), 743.7); // 0.007x: a bad figure, not a move
    assert.equal(liveCapBillions(5000e9, 743.7), 743.7);
  });
});
