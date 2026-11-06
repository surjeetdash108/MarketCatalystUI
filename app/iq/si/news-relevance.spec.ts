// Why it moved: an event's headline must be about the stock itself. FMP / Polygon
// tag an article with every ticker it mentions, so AMD's feed carried
// "NVDA vs AAPL: …" and it became AMD's catalyst.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aboutTicker, getSixMonthMajorEvents } from "./data";

describe("aboutTicker", () => {
  it("a headline naming the ticker or the company is about it", () => {
    assert.ok(aboutTicker({ headline: "AMD unveils MI400 accelerators" }, "AMD", "Advanced Micro Devices, Inc."));
    assert.ok(aboutTicker({ headline: "Advanced Micro Devices beats on data-center sales" }, "AMD", "Advanced Micro Devices, Inc."));
    assert.ok(aboutTicker({ headline: "Cardinal Health raises outlook" }, "CAH", "Cardinal Health, Inc."));
    assert.ok(aboutTicker({ headline: "Apple's iPhone sales jump" }, "AAPL", "Apple Inc."));
  });
  it("a headline about other companies is not", () => {
    assert.ok(!aboutTicker({ headline: "NVDA vs AAPL: Which Mega-Cap Is the Better Buy?" }, "AMD", "Advanced Micro Devices, Inc."));
    assert.ok(!aboutTicker({ headline: "3 chip stocks to watch" }, "AMD", "Advanced Micro Devices, Inc."));
  });
  it("the ticker must be a whole word in capitals (no 'amd' inside other words)", () => {
    assert.ok(!aboutTicker({ headline: "Samdisk merger closes" }, "AMD", "Advanced Micro Devices, Inc."));
  });
});

describe("six-month events use only the stock's own news", () => {
  const day = (i: number) => Date.UTC(2026, 5, 1) + i * 86_400_000;
  const bars = Array.from({ length: 60 }, (_, i) => ({ t: day(i), o: 100, h: 101, l: 99, c: i === 30 ? 112 : 100, v: 1 }));
  it("an off-topic article on the move day does not label the move", () => {
    const news = [{ headline: "NVDA vs AAPL: Which Mega-Cap Is the Better Buy?", publishedAt: new Date(day(30)).toISOString(), summary: "x" }];
    const evs = getSixMonthMajorEvents("AMD", { t: "AMD", name: "Advanced Micro Devices, Inc." } as never, bars, null, news, null);
    assert.ok(evs.length > 0);
    assert.ok(evs.every((e) => !/NVDA vs AAPL/.test(e.label) && !(e.context ?? []).some((c) => /NVDA vs AAPL/.test(c.text))));
  });
  it("the stock's own article still labels it", () => {
    const news = [{ headline: "AMD soars on OpenAI deal", publishedAt: new Date(day(30)).toISOString(), summary: "x" }];
    const evs = getSixMonthMajorEvents("AMD", { t: "AMD", name: "Advanced Micro Devices, Inc." } as never, bars, null, news, null);
    assert.ok(evs.some((e) => e.label === "AMD soars on OpenAI deal"));
  });
});
