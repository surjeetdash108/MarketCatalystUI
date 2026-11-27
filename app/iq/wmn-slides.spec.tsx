import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWmnSlides, type WmnBuildInput, type WmnIndexRow } from "./wmn-slides";
import { STOCK_IN_FOCUS_NOTE, type WmnQuote } from "./wmn-model";
import type { WmnResponse, WmnSlidesData, WmnStockInFocus } from "./types/wmn";

// Thu 26 Nov 2026, 15:00 ET.
const NOW = new Date("2026-11-26T20:00:00Z");

const emptySlides: WmnSlidesData = {
  breadth: null,
  weights: null,
  catalysts: [],
  earnings: null,
  analysts: null,
};
const entry: WmnStockInFocus = {
  day: "2026-11-26",
  ticker: "NVDA",
  headline: "Why the chip bid matters today",
  note: "A short note from the desk.",
  createdAt: "2026-11-26T14:00:00Z",
  updatedAt: "2026-11-26T14:00:00Z",
};
const indices = new Map<string, WmnIndexRow>([["SPX", { value: 6800, pct: 0.4, prevClose: null, isProxy: false }]]);

const build = (wmn: WmnResponse | null, over: Partial<WmnBuildInput> = {}) =>
  buildWmnSlides({ wmn, indices, fearGreed: null, phase: "open", now: NOW, quotes: new Map(), ...over });

const keys = (wmn: WmnResponse | null, over: Partial<WmnBuildInput> = {}) => build(wmn, over).map((s) => s.key);

describe("Earnings in Focus slide", () => {
  const item = {
    ticker: "ENLV", name: "Enlivex Therapeutics", marketCap: 30e6, session: "BMO" as const, date: "2026-11-26", reported: false,
    eps: { actual: null, estimate: -0.1, surprisePct: null }, revenue: { actual: null, estimate: null, surprisePct: null },
    guidance: null, reactionPct: null,
  };

  it("shows for a small company: there is no size floor", () => {
    const k = keys({ slides: { ...emptySlides, earnings: { date: "2026-11-26", items: [item], total: 1 } } });
    assert.ok(k.includes("earnings"));
    const s = build({ slides: { ...emptySlides, earnings: { date: "2026-11-26", items: [item], total: 1 } } }).find((x) => x.key === "earnings")!;
    assert.equal(s.lead, "One company reports today.");
  });

  it("is dropped only when nobody reports", () => {
    assert.ok(!keys({ slides: { ...emptySlides, earnings: null } }).includes("earnings"));
    assert.ok(!keys({ slides: { ...emptySlides, earnings: { date: "2026-11-26", items: [], total: 0 } } }).includes("earnings"));
  });
});

describe("Stock in Focus slide", () => {
  it("is the last slide, after the analysts", () => {
    const k = keys({ slides: { ...emptySlides, stockInFocus: entry } });
    assert.deepEqual(k, ["direction", "catalysts", "analysts", "focus"]);
  });

  it("is absent until the desk has posted one", () => {
    assert.ok(!keys({ slides: { ...emptySlides, stockInFocus: null } }).includes("focus"));
    // An older backend does not send the field at all.
    assert.ok(!keys({ slides: emptySlides }).includes("focus"));
    assert.ok(!keys(null).includes("focus"));
  });

  it("shows the headline, the note, the date and the editorial disclaimer", () => {
    const s = build({ slides: { ...emptySlides, stockInFocus: entry } }).find((x) => x.key === "focus")!;
    assert.equal(s.lead, entry.headline);
    assert.equal(s.body, entry.note);
    assert.equal(s.when, "Today");
    assert.equal(s.foot, STOCK_IN_FOCUS_NOTE);
    assert.equal(s.tag, "STOCK IN FOCUS");
  });

  it("an entry with no note has no body line", () => {
    const s = build({ slides: { ...emptySlides, stockInFocus: { ...entry, note: "" } } }).find((x) => x.key === "focus")!;
    assert.equal(s.body, undefined);
  });

  it("labels an older entry by its day, not 'Today'", () => {
    const s = build({ slides: { ...emptySlides, stockInFocus: { ...entry, day: "2026-11-24" } } }).find((x) => x.key === "focus")!;
    assert.equal(s.when, "Tue, Nov 24");
  });

  it("opens the archive from a button, and has no button when the caller gives none", () => {
    let opened = 0;
    const withCb = build({ slides: { ...emptySlides, stockInFocus: entry } }, { onOpenArchive: () => { opened++; } }).find((x) => x.key === "focus")!;
    assert.equal(withCb.cta?.label, "Browse the archive");
    assert.equal(withCb.cta?.href, undefined);
    withCb.cta?.onClick?.();
    assert.equal(opened, 1);
    const without = build({ slides: { ...emptySlides, stockInFocus: entry } }).find((x) => x.key === "focus")!;
    assert.equal(without.cta, undefined);
  });

  it("the disclaimer says editorial and never reads as a pick or advice to act", () => {
    assert.match(STOCK_IN_FOCUS_NOTE, /editorial/i);
    assert.match(STOCK_IN_FOCUS_NOTE, /not a recommendation/i);
    assert.doesNotMatch(STOCK_IN_FOCUS_NOTE, /\b(buy|sell|pick of the day|top pick)\b/i);
  });

  it("still builds when the quote for its ticker has not arrived", () => {
    const quotes = new Map<string, WmnQuote>();
    assert.doesNotThrow(() => build({ slides: { ...emptySlides, stockInFocus: entry } }, { quotes }));
  });
});
