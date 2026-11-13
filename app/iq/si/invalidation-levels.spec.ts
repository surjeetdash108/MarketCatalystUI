// "What would break this setup" listed "Price loses the 50 DMA" for NVDA at
// $173 with the 50 DMA at $217 (Vinay, 13 Nov): a level the price was already
// through was shown as a risk still to come. Levels now split on where the price is.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FACTS, detail, invalidationLevels, type SiFacts } from "./data";
import { localCopilotAnswer, type CopilotLocalInput } from "./copilot-local";

const facts = (o: Partial<SiFacts>): SiFacts => ({ ...EMPTY_FACTS, ...o });
const titles = (l: [string, string][]) => l.map(([t]) => t);

describe("invalidationLevels", () => {
  it("price below the 50 DMA, 200 DMA and S1: all three are already broken, none pending", () => {
    const r = invalidationLevels(facts({ price: 173.73, sma50: 217.12, sma200: 204.47, pivotS1: 178.49 }));
    assert.deepEqual(titles(r.broken), ["Already below the 50 DMA", "First support already broken", "Already below the 200 DMA"]);
    assert.deepEqual(r.pending, []);
    assert.match(r.broken[0][1], /Price \$173\.73 is below 50 DMA \$217\.12/);
    assert.match(r.broken[1][1], /below S1 \$178\.49/);
  });

  it("price above every level: all three stay as a risk still ahead", () => {
    const r = invalidationLevels(facts({ price: 250, sma50: 217.12, sma200: 204.47, pivotS1: 178.49 }));
    assert.deepEqual(r.broken, []);
    assert.deepEqual(r.pending, [
      ["Price loses the 50 DMA", "Daily close below $217.12"],
      ["Breaks first support", "Daily close below S1 $178.49"],
      ["Price loses the 200 DMA", "Daily close below $204.47"],
    ]);
  });

  it("between the levels: each lands on its own side", () => {
    const r = invalidationLevels(facts({ price: 210, sma50: 217.12, sma200: 204.47, pivotS1: 205 }));
    assert.deepEqual(titles(r.broken), ["Already below the 50 DMA"]);
    assert.deepEqual(titles(r.pending), ["Breaks first support", "Price loses the 200 DMA"]);
  });

  it("price exactly on a level has not broken it", () => {
    const r = invalidationLevels(facts({ price: 217.12, sma50: 217.12 }));
    assert.deepEqual(r.broken, []);
    assert.deepEqual(titles(r.pending), ["Price loses the 50 DMA"]);
  });

  it("no price: cannot tell, so every level stays pending", () => {
    const r = invalidationLevels(facts({ price: null, sma50: 217.12, pivotS1: 178.49 }));
    assert.deepEqual(r.broken, []);
    assert.deepEqual(titles(r.pending), ["Price loses the 50 DMA", "Breaks first support"]);
  });

  it("a level with no value is left out", () => {
    const r = invalidationLevels(facts({ price: 100, sma50: null, pivotS1: null, sma200: null }));
    assert.deepEqual(r, { pending: [], broken: [] });
  });
});

describe("detail().invalid / broken", () => {
  it("keeps the EPS-cut risk in invalid and puts passed levels in broken", () => {
    const d = detail("NVDA", { price: 173.73, facts: facts({ price: 173.73, sma50: 217.12, pivotS1: 178.49 }) });
    assert.deepEqual(titles(d.broken), ["Already below the 50 DMA", "First support already broken"]);
    assert.deepEqual(titles(d.invalid), ["Forward EPS cuts"]);
  });
});

describe("chat answers", () => {
  const input = (o: Partial<CopilotLocalInput> = {}): CopilotLocalInput => ({
    sym: "NVDA",
    price: 173.73,
    changePct: -2,
    setup: "Downtrend",
    confluence: 4,
    facts: facts({ price: 173.73, sma50: 217.12, sma200: 204.47, pivotS1: 178.49 }),
    signals: [],
    invalid: [["Forward EPS cuts", "Next-FY consensus EPS revised down more than 10%"]],
    broken: [["Already below the 50 DMA", "Price $173.73 is below 50 DMA $217.12. A daily close back above it repairs the trend."]],
    catalysts: [],
    peers: [],
    movedTxt: "",
    ...o,
  });
  const text = (q: string, i: CopilotLocalInput) => localCopilotAnswer(q, i);

  it("'what would break' leads with what already broke, not 'would break'", () => {
    const t = text("what would break this setup?", input());
    assert.match(t, /already broken for NVDA/);
    assert.match(t, /Price \$173\.73 is below 50 DMA \$217\.12/);
  });

  it("with nothing broken it reads as before", () => {
    const t = text("what would break this setup?", input({ broken: [] }));
    assert.match(t, /What would break the NVDA setup/);
    assert.doesNotMatch(t, /already broken/i);
  });

  it("the bear case says what already confirms it instead of what 'would'", () => {
    const t = text("what is the bear case?", input());
    assert.match(t, /Already confirming the bear case/);
  });
});
