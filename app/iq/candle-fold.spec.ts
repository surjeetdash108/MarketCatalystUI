import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldLiveOntoBars, type OfficialClose } from "./candle-chart";

// 24 Nov 2026. The stored daily doc for AAPL was saved at 11:35 ET Monday, so its
// Monday candle was half-finished (close 348.37) while the quote's official close
// was 349.08. Before: an after-hours print (349.66) was folded in, wrong the other
// way. NVDA's stored doc ended on Friday, before its +31% Monday.
const at = (iso: string) => Date.parse(iso); // ISO strings carry the ET offset
const bar = (day: string, o: number, h: number, l: number, c: number) => ({ t: at(`${day}T00:00:00-05:00`), o, h, l, c, v: 1 });

const fri = bar("2026-11-20", 346, 349, 340, 342.56);
const monPartial = bar("2026-11-23", 343.1, 349.9, 342.9, 348.3673);
const official: OfficialClose = { close: 349.08, high: 350.12, low: 342.9, sessionIso: "2026-11-23" };

describe("foldLiveOntoBars: after the close, the official close goes on the candle", () => {
  it("1D: a half-finished Monday candle gets the official close and the session's high/low", () => {
    const out = foldLiveOntoBars([fri, monPartial], null, "1D", official);
    assert.equal(out[1].c, 349.08);
    assert.equal(out[1].h, 350.12);
    assert.equal(out[1].l, 342.9);
    assert.equal(out[1].o, 343.1, "the open is kept");
    assert.deepEqual(out[0], fri, "earlier candles are untouched");
  });

  it("1D: an after-hours print never becomes the close (the old bug: 349.66)", () => {
    const ah = { price: 349.66, high: 350.4, low: 341.9, at: at("2026-11-23T17:30:00-05:00") };
    const out = foldLiveOntoBars([fri, monPartial], ah, "1D", official);
    assert.equal(out[1].c, 349.08);
    assert.equal(out[1].h, 350.12, "after-hours high/low are not used either");
  });

  it("1D: the 16:00:01 closing print is not used as the close; the official one is", () => {
    const closePrint = { price: 349.1, high: 350, low: 342.9, at: at("2026-11-23T16:00:01-05:00") };
    assert.equal(foldLiveOntoBars([fri, monPartial], closePrint, "1D", official)[1].c, 349.08);
  });

  it("1W: this week's candle takes the official close", () => {
    const week = bar("2026-11-23", 343.1, 349.9, 342.9, 348.3673); // week of Mon 23 Nov
    assert.equal(foldLiveOntoBars([bar("2026-11-16", 350, 355, 340, 346), week], null, "1W", official)[1].c, 349.08);
  });

  it("1M: this month's candle takes the official close", () => {
    const month = bar("2026-11-02", 340, 351, 330, 348.3673);
    assert.equal(foldLiveOntoBars([bar("2026-10-01", 330, 345, 320, 340), month], null, "1M", official)[1].c, 349.08);
  });

  it("range mode with daily bars behaves the same", () => {
    assert.equal(foldLiveOntoBars([fri, monPartial], null, undefined, official)[1].c, 349.08);
  });
});

describe("foldLiveOntoBars: never writes onto the wrong candle", () => {
  it("NVDA: stored bars end on Friday, so Monday's official close is not painted onto Friday's candle", () => {
    const nvdaFri = bar("2026-11-20", 143.52, 143.73, 124.5, 125.53);
    const nvdaThu = bar("2026-11-19", 146, 148, 144, 145.98);
    const nvdaOfficial: OfficialClose = { close: 165.05, high: 166, low: 150, sessionIso: "2026-11-23" };
    const base = [nvdaThu, nvdaFri];
    assert.equal(foldLiveOntoBars(base, null, "1D", nvdaOfficial), base, "same array: nothing changed");
  });

  it("1W: last week's candle is not touched by this week's close", () => {
    const base = [bar("2026-11-09", 1, 2, 1, 1.5), bar("2026-11-16", 1, 2, 1, 1.6)];
    assert.equal(foldLiveOntoBars(base, null, "1W", official), base);
  });

  it("intraday candles are left exactly as stored", () => {
    const a = { t: at("2026-11-23T15:50:00-05:00"), o: 349, h: 349.2, l: 348.9, c: 349.05, v: 1 };
    const b = { t: at("2026-11-23T15:55:00-05:00"), o: 349.05, h: 349.2, l: 348.97, c: 349.08, v: 1 };
    assert.equal(foldLiveOntoBars([a, b], null, "5m", official).length, 2);
    assert.deepEqual(foldLiveOntoBars([a, b], null, "5m", official)[1], b);
    const ah = { price: 349.66, high: 350, low: 349, at: at("2026-11-23T17:30:00-05:00") };
    assert.deepEqual(foldLiveOntoBars([a, b], ah, "5m", official)[1], b);
  });

  it("range mode over 5-minute bars (1D/1W ranges) is left as stored", () => {
    const a = { t: at("2026-11-23T15:50:00-05:00"), o: 349, h: 349.2, l: 348.9, c: 349.05, v: 1 };
    const b = { t: at("2026-11-23T15:55:00-05:00"), o: 349.05, h: 349.2, l: 348.97, c: 349.08, v: 1 };
    assert.deepEqual(foldLiveOntoBars([a, b], null, undefined, official)[1], b);
  });
});

describe("foldLiveOntoBars: during the session the live tick still folds", () => {
  it("a regular-hours tick updates the forming 1D candle", () => {
    const tick = { price: 350.3, high: 350.6, low: 342.9, at: at("2026-11-23T11:00:00-05:00") };
    const out = foldLiveOntoBars([fri, monPartial], tick, "1D", null);
    assert.equal(out[1].c, 350.3);
    assert.equal(out[1].h, 350.6);
  });

  it("1D: stored bars end on the previous session, so today's candle is started from the tick (NVDA 81.32 vs 87.21)", () => {
    const tick = { price: 87.21, high: 88.1, low: 82.4, open: 82.9, at: at("2026-11-24T10:41:00-05:00") };
    const out = foldLiveOntoBars([fri, monPartial], tick, "1D", null);
    assert.equal(out.length, 3);
    assert.deepEqual(out[2], { t: at("2026-11-24T00:00:00-05:00"), o: 82.9, h: 88.1, l: 82.4, c: 87.21, v: 0 });
  });

  it("1m: a tick past the last stored minute starts its own minute candle", () => {
    const m1 = { t: at("2026-11-24T10:30:00-05:00"), o: 86, h: 86.2, l: 85.9, c: 86.1, v: 10 };
    const m2 = { t: at("2026-11-24T10:31:00-05:00"), o: 86.1, h: 86.3, l: 86, c: 86.2, v: 10 };
    const tick = { price: 87.21, high: 88.1, low: 82.4, at: at("2026-11-24T10:44:27-05:00") };
    const out = foldLiveOntoBars([m1, m2], tick, "1m", null);
    assert.equal(out.length, 3);
    assert.deepEqual(out[2], { t: at("2026-11-24T10:44:00-05:00"), o: 87.21, h: 87.21, l: 87.21, c: 87.21, v: 0 }, "the day's range is not put on a 1-minute candle");
  });

  it("1H: the new candle is aligned to the 09:30 open", () => {
    const h1 = { t: at("2026-11-24T09:30:00-05:00"), o: 86, h: 86.2, l: 85.9, c: 86.1, v: 10 };
    const h0 = { t: at("2026-11-23T15:30:00-05:00"), o: 86, h: 86.2, l: 85.9, c: 86.1, v: 10 };
    const out = foldLiveOntoBars([h0, h1], { price: 87, high: null, low: null, at: at("2026-11-24T11:05:00-05:00") }, "1H", null);
    assert.equal(out[2].t, at("2026-11-24T10:30:00-05:00"));
  });

  it("1W: the first session of a new week starts this week's candle", () => {
    const w1 = bar("2026-11-16", 300, 310, 295, 305);
    const w2 = bar("2026-11-23", 305, 351, 300, 349.08);
    const tick = { price: 352, high: 353, low: 348, open: 349.5, at: at("2026-11-30T10:00:00-05:00") };
    const out = foldLiveOntoBars([w1, w2], tick, "1W", null);
    assert.equal(out.length, 3);
    assert.equal(out[2].t, at("2026-11-30T00:00:00-05:00"));
    assert.equal(out[2].o, 349.5);
  });

  it("an after-hours or pre-market tick never starts a candle", () => {
    const base = [fri, monPartial];
    assert.equal(foldLiveOntoBars(base, { price: 351, high: null, low: null, at: at("2026-11-24T08:00:00-05:00") }, "1D", null), base);
    assert.equal(foldLiveOntoBars(base, { price: 351, high: null, low: null, at: at("2026-11-23T17:00:00-05:00") }, "1D", null).length, 2);
  });

  it("a REST-poll tick without a time folds nothing", () => {
    const base = [fri, monPartial];
    assert.equal(foldLiveOntoBars(base, { price: 350, high: null, low: null, at: null }, "1D", null), base);
  });
});

describe("foldLiveOntoBars: edge cases", () => {
  it("no official figure, or a bad one: same array back", () => {
    const base = [fri, monPartial];
    assert.equal(foldLiveOntoBars(base, null, "1D", null), base);
    assert.equal(foldLiveOntoBars(base, null, "1D", { ...official, close: 0 }), base);
  });

  it("a bad high/low pair is ignored, the close still lands", () => {
    const out = foldLiveOntoBars([fri, monPartial], null, "1D", { close: 349.08, high: 0, low: 0, sessionIso: "2026-11-23" });
    assert.equal(out[1].c, 349.08);
    assert.equal(out[1].h, 349.9, "kept: a zero high must not shrink or stretch the candle");
    assert.equal(out[1].l, 342.9);
  });

  it("already correct: same array back", () => {
    const done = bar("2026-11-23", 343.1, 350.12, 342.9, 349.08);
    const base = [fri, done];
    assert.equal(foldLiveOntoBars(base, null, "1D", official), base);
  });

  it("does not change the bars it is given, and fewer than two bars are returned as is", () => {
    const base = [fri, monPartial];
    foldLiveOntoBars(base, null, "1D", official);
    assert.equal(base[1].c, 348.3673);
    const one = [monPartial];
    assert.equal(foldLiveOntoBars(one, null, "1D", official), one);
  });
});
