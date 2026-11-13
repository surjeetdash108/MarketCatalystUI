// A major story must outrank filler, and the chart must explain the sessions
// that matter. Fixture = the NVDA situation of 12 Nov 2026: a burst of articles
// about one story on a −5.17% day, a bigger −9.26% day a week earlier explained
// only by a "what $10,000 invested" listicle.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreNews, summarizeNewsSentiment, classifyDirection } from "./news-significance";
import { getSixMonthMajorEvents, aboutTicker, buildDrivers, EMPTY_FACTS, newsSentimentText } from "./data";

const DAY = 86_400_000;
const NAME = "NVIDIA Corporation";
const day0 = Date.UTC(2026, 4, 12); // 12 May
const iso = (i: number, hour = 14) => new Date(day0 + i * DAY + hour * 3_600_000).toISOString();

/** 126 flat sessions, a −9.26% drop at index 177-... → see below, and a −5.17% last session. */
function makeBars() {
  const n = 126;
  const bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
  let c = 200;
  for (let i = 0; i < n; i++) {
    if (i === n - 5) c *= 1 - 0.0926; // the bigger drop, 4 sessions before the end
    else if (i === n - 1) c *= 1 - 0.0517; // today
    else c *= 1 + (i % 2 ? 0.003 : -0.003);
    bars.push({ t: day0 + i * DAY, o: c, h: c, l: c, c, v: 1 });
  }
  return bars;
}

const today = 125;
const storyNews = [
  { headline: "Can Nvidia Survive Without Jensen Huang?", summary: "In a shakeup for the AI world, Jensen Huang is stepping down as Nvidia's CEO. Analysts break down what Huang's exit means for Nvidia stock.", publishedAt: iso(today), source: "youtube.com", tag: "news" },
  { headline: "Jensen Huang steps down: the hands-on kingmaker behind the AI boom", summary: "Jensen Huang steps down: the hands-on kingmaker behind the AI boom", publishedAt: iso(today, 13), source: "reuters.com", tag: "news" },
  { headline: "Nvidia Stock Just Got Downgraded After Jensen Huang's Exit. Should You Sell?", summary: "Truist and Craig-Hallum downgraded Nvidia to Hold after the CEO departure.", publishedAt: iso(today, 15), source: "fool.com", tag: "analyst" },
  { headline: "Alice Huang tied to Nvidia's biggest Chinese competitor", summary: "Alice Huang, with whom ousted Nvidia CEO Jensen Huang reportedly had a relationship, has owned stakes in companies that benefited Huawei.", publishedAt: iso(today, 16), source: "cnbc.com", tag: "news" },
  { headline: "Nvidia's Meteoric Rise, in One Chart", summary: "A once-modest company soared after ChatGPT unleashed demand for its chips.", publishedAt: iso(today, 12), source: "wsj.com", tag: "news" },
];
const filler = { headline: "Here's What $10,000 Invested in SpaceX and Nvidia Could Be Worth", summary: "SpaceX and Nvidia represent two complementary angles on AI investment.", publishedAt: iso(today - 4, 15), source: "fool.com", tag: "news" };

describe("scoreNews", () => {
  const bars = makeBars();
  const all = [...storyNews, filler];
  const sig = scoreNews(all, { ticker: "NVDA", name: NAME, bars });

  it("articles telling one story outrank an unrelated article from the same day", () => {
    const burst = sig.get(storyNews[1])!;
    const odd = sig.get(storyNews[4])!;
    assert.ok(burst.coverage >= 3, `coverage ${burst.coverage}`);
    assert.equal(burst.tier, "HIGH");
    assert.ok(burst.score > odd.score + 20);
    assert.notEqual(odd.tier, "HIGH");
  });

  it("an evergreen 'what $X invested' headline is filler and never high impact", () => {
    const f = sig.get(filler)!;
    assert.ok(f.filler);
    assert.equal(f.tier, "LOW");
  });

  it("reports the stock's reaction so a neutral-tagged story can take its direction", () => {
    const r = sig.get(storyNews[0])!.reactionPct;
    assert.ok(r != null && r < -4.5 && r > -5.6, `reaction ${r}`);
  });

  it("every article on a well-covered story is high impact, even before price data loads", () => {
    const noBars = scoreNews(storyNews, { ticker: "NVDA", name: NAME });
    for (const a of storyNews.slice(0, 4)) assert.equal(noBars.get(a)!.tier, "HIGH", a.headline);
    assert.equal(noBars.get(storyNews[4])!.tier, "LOW");
  });

  it("a clickbait-styled headline is real news once several outlets run the story", () => {
    const sell = storyNews[2]; // "…Should You Sell?"
    assert.equal(scoreNews(storyNews, { ticker: "NVDA", name: NAME }).get(sell)!.filler, false);
    assert.equal(scoreNews([sell], { ticker: "NVDA", name: NAME }).get(sell)!.filler, true);
  });

  it("works without price data", () => {
    const s = scoreNews(storyNews, { ticker: "NVDA", name: NAME }).get(storyNews[1])!;
    assert.equal(s.reactionPct, null);
    assert.ok(s.score > 0);
  });
});

describe("six-month catalysts surface what matters", () => {
  const bars = makeBars();
  const stock = { t: "NVDA", name: NAME } as never;
  const evs = getSixMonthMajorEvents("NVDA", stock, bars, null, [...storyNews, filler], null);

  it("always returns five, in date order", () => {
    assert.equal(evs.length, 5);
    assert.deepEqual(evs.map((e) => e.num), [1, 2, 3, 4, 5]);
  });

  it("includes the latest session and explains it with the real story, not the other articles", () => {
    const last = evs[evs.length - 1];
    assert.ok(Math.abs(last.mv - -5.17) < 0.05, `mv ${last.mv}`);
    assert.match(last.label, /Huang/);
    assert.ok(!/Meteoric/.test(last.label));
  });

  it("does not label the bigger earlier drop with listicle filler", () => {
    assert.ok(evs.every((e) => !/\$10,000 Invested/i.test(e.label)));
  });

  it("still marks the bigger earlier drop", () => {
    assert.ok(evs.some((e) => Math.abs(e.mv - -9.26) < 0.05));
  });
});

describe("news sentiment weighs what matters, not tag counts", () => {
  const bars = makeBars();
  const letters = (n: number) => { let o = ""; do { o = String.fromCharCode(97 + (n % 26)) + o; n = Math.floor(n / 26) - 1; } while (n >= 0); return o; };
  // Unrelated routine items: each has its own vocabulary, so none reads as a shared story.
  const routine = (i: number, sentiment: "positive" | "negative") => ({
    headline: `Nvidia ${sentiment === "positive" ? "gains" : "slips"} as wq${letters(i)}x covers zq${letters(i + 500)}y`,
    summary: `Item hq${letters(i + 1000)}z notes kq${letters(i + 1500)}v.`,
    publishedAt: iso(today - 1 - (i % 5)),
    source: `src${i}`,
    tag: "news",
    sentiment,
  });
  // 48 positive / 47 negative routine headlines, vendor-tagged, plus the Huang stories the vendor tagged neutral.
  const crowd = [
    ...Array.from({ length: 48 }, (_, i) => routine(i, "positive")),
    ...Array.from({ length: 47 }, (_, i) => routine(100 + i, "negative")),
  ];
  const neutralStory = storyNews.slice(0, 4).map((a) => ({ ...a, sentiment: "neutral" }));
  const isAbout = (x: { headline?: unknown }) => aboutTicker(x, "NVDA", NAME);
  const run = (arts: unknown[]) => summarizeNewsSentiment(arts as never[], { ticker: "NVDA", name: NAME, bars, isAbout });

  it("a high-impact story the vendor tagged neutral still counts, in the stock's direction", () => {
    const s = run([...crowd, ...neutralStory]);
    // "Jensen Huang steps down…" never names Nvidia in its headline, so only three of the four pass the about-the-stock check.
    assert.equal(s.highNeg, 3);
    assert.equal(s.highPos, 0);
    assert.ok(s.wNeg > s.wPos, `weighted neg ${s.wNeg} vs pos ${s.wPos}`);
  });

  it("the same headline twice counts once; filler and off-topic articles are dropped", () => {
    const offTopic = { headline: "AAPL vs MSFT: which is the better buy?", summary: "x", publishedAt: iso(today), sentiment: "positive", source: "z" };
    const s = run([neutralStory[0], { ...neutralStory[0] }, neutralStory[3], offTopic, filler]);
    assert.equal(s.total, 2);
  });

  it("scores the mood from weighted shares: the old formula said 58 (neutral); with the story it is clearly negative", () => {
    const s = run([...crowd, ...neutralStory]);
    const drivers = buildDrivers({
      ...EMPTY_FACTS,
      newsPos: s.pos, newsNeg: s.neg, newsHighPos: s.highPos, newsHighNeg: s.highNeg, newsWPos: s.wPos, newsWNeg: s.wNeg,
    });
    const news = drivers.find((d) => d[1] === "News sentiment");
    assert.ok(news, "News sentiment driver present");
    assert.ok(news[3] < 50, `score ${news[3]}`);
    assert.ok(news[2].startsWith("3 high-impact (3 negative)"), news[2]);
    assert.equal(50 + (48 - 47) * 8, 58); // the old formula, for comparison
  });

  it("without impact fields it falls back to plain counts and stays inside the 5-95 band", () => {
    const sc = buildDrivers({ ...EMPTY_FACTS, newsPos: 60, newsNeg: 5 }).find((d) => d[1] === "News sentiment")![3];
    assert.ok(sc <= 95 && sc > 50);
    assert.equal(newsSentimentText({ newsPos: 3, newsNeg: 2 }), "3 positive / 2 negative headlines (7 days)");
  });
});

describe("direction is a vote, not just the vendor tag", () => {
  const bars = makeBars();
  const t = iso(today);
  // The Nov 12 stories as the vendor delivered them: all tagged neutral.
  const stories = [
    { headline: "Can Nvidia Survive Without Jensen Huang?", summary: "Jensen Huang is stepping down as Nvidia's CEO. Analysts break down what his exit means.", publishedAt: t },
    { headline: "Jensen Huang steps down: the hands-on kingmaker behind the AI boom", summary: "Jensen Huang steps down: the hands-on kingmaker behind the AI boom", publishedAt: t },
    { headline: "Nvidia: Ex-prosecutor Joon Kim bring big track record to investigation", summary: "Joon Kim has been retained by Nvidia to investigate allegations against then-CEO Jensen Huang. Huang resigned Thursday after reports of an affair.", publishedAt: t },
    { headline: "Nvidia loses its 'Godfather of AI' and now faces first big test without him", summary: "Jensen Huang's resignation sent Nvidia stock plunging 14% before losses narrowed.", publishedAt: t },
    { headline: "Retail buyers limit Nvidia stock rout", summary: "Retail buyers limit Nvidia stock rout", publishedAt: t },
    { headline: "Nvidia's Meteoric Rise, in One Chart", summary: "A once-modest company soared after ChatGPT unleashed demand for its chips.", publishedAt: t },
  ].map((a) => ({ ...a, sentiment: "neutral" }));
  const sig = scoreNews(stories, { ticker: "NVDA", name: NAME, bars });
  const dir = (i: number) => classifyDirection(stories[i], sig.get(stories[i]));

  it("a neutral-tagged resignation, probe or rout reads as Risk", () => {
    assert.equal(dir(0), "Risk");
    assert.equal(dir(1), "Risk");
    assert.equal(dir(2), "Risk");
    assert.equal(dir(3), "Risk");
    assert.equal(dir(4), "Risk");
  });

  it("an unrelated explainer leans on its own wording and stays low impact", () => {
    // "soared" reads positive, but nothing corroborates it: no story, no price reaction.
    assert.equal(dir(5), "Positive");
    assert.equal(sig.get(stories[5])!.tier, "LOW");
  });

  it("conflicting signals with no majority read as Mixed", () => {
    // wording pulling both ways casts no vote, so a neutral tag leaves it Neutral
    const a = { headline: "Nvidia beats estimates but warns on China", summary: "x", sentiment: "neutral" };
    assert.equal(classifyDirection(a, undefined), "Neutral");
    const b = { headline: "Nvidia upgrade lands as the stock slumps", sentiment: "negative" };
    // wording is both ways (upgrade, slumps) so it casts no vote; the vendor's negative tag decides
    assert.equal(classifyDirection(b, undefined), "Risk");
    const c = { headline: "Nvidia surges on record revenue", sentiment: "negative" };
    assert.equal(classifyDirection(c, undefined), "Mixed");
  });

  it("agreeing signals stay positive", () => {
    assert.equal(classifyDirection({ headline: "Nvidia raises guidance and beats estimates", sentiment: "positive" }, undefined), "Positive");
  });

  it("the stories group into one story with a shared id, the unrelated one stands alone", () => {
    const ids = stories.map((s) => sig.get(s)!.story);
    assert.equal(new Set([ids[0], ids[1], ids[2], ids[3]]).size, 1);
    assert.notEqual(ids[5], ids[0]);
    assert.ok(sig.get(stories[0])!.storySize >= 4);
    assert.equal(sig.get(stories[5])!.storySize, 1);
  });
});
