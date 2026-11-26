import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FACTS, type SiFacts } from "./data";
import { bigMovesIn10, couldMove, dropForming, titleWords, weekRows, yesterdayMove, yesterdayRows, type MoveBar, type MoveNews } from "./si-moves";

// The design file's own sample stock (NVDA) on its own day (26 Nov 2026): its last 27 daily bars, the 11 headlines
// its news feed returned, and the facts its engine read. The expected rows are what the design renders.
const BARS: MoveBar[] = [{"t": 1792157400000, "o": 146.62, "h": 146.71, "l": 145.09, "c": 146.04, "v": 26259921}, {"t": 1792416600000, "o": 146.24, "h": 146.6, "l": 144.73, "c": 146.53, "v": 13341299}, {"t": 1792503000000, "o": 146.75, "h": 147.16, "l": 145.81, "c": 146.52, "v": 29823502}, {"t": 1792589400000, "o": 146.14, "h": 146.64, "l": 145.01, "c": 146.55, "v": 25451726}, {"t": 1792675800000, "o": 146.73, "h": 147.94, "l": 145.12, "c": 147.22, "v": 27469296}, {"t": 1792762200000, "o": 147.55, "h": 149.25, "l": 144.67, "c": 146.17, "v": 7311393}, {"t": 1793021400000, "o": 146.14, "h": 148.99, "l": 144.56, "c": 147.41, "v": 11351517}, {"t": 1793107800000, "o": 147.31, "h": 149.04, "l": 146.18, "c": 148.86, "v": 21794427}, {"t": 1793194200000, "o": 148.89, "h": 150.95, "l": 147.98, "c": 150.46, "v": 11309321}, {"t": 1793280600000, "o": 150.15, "h": 150.7, "l": 148.72, "c": 148.91, "v": 2497000}, {"t": 1793367000000, "o": 149.25, "h": 150.98, "l": 149.06, "c": 150.92, "v": 10784765}, {"t": 1793629800000, "o": 151.04, "h": 151.39, "l": 149.55, "c": 150.79, "v": 26842799}, {"t": 1793716200000, "o": 150.56, "h": 150.72, "l": 148.27, "c": 149.48, "v": 22115783}, {"t": 1793802600000, "o": 149.64, "h": 150.33, "l": 148.88, "c": 149.09, "v": 28563495}, {"t": 1793889000000, "o": 149.19, "h": 150.85, "l": 147.73, "c": 150.73, "v": 21204148}, {"t": 1793975400000, "o": 150.65, "h": 153.05, "l": 148.89, "c": 152.31, "v": 29554209}, {"t": 1794234600000, "o": 152.38, "h": 153.18, "l": 150.09, "c": 150.58, "v": 11558449}, {"t": 1794321000000, "o": 150.88, "h": 151.92, "l": 149.63, "c": 151.03, "v": 21103986}, {"t": 1794407400000, "o": 151.47, "h": 153.11, "l": 151.33, "c": 152.27, "v": 7712053}, {"t": 1794493800000, "o": 152.48, "h": 152.8, "l": 151.22, "c": 151.69, "v": 4501258}, {"t": 1794580200000, "o": 151.66, "h": 153.28, "l": 150.75, "c": 151.1, "v": 28016075}, {"t": 1794839400000, "o": 151.09, "h": 152.35, "l": 148.24, "c": 148.98, "v": 11014317}, {"t": 1794925800000, "o": 148.64, "h": 149.97, "l": 147.24, "c": 148.95, "v": 6807350}, {"t": 1795012200000, "o": 148.53, "h": 151.56, "l": 147.04, "c": 150.96, "v": 11246782}, {"t": 1795098600000, "o": 150.21, "h": 151.56, "l": 144.52, "c": 145.98, "v": 15951398}, {"t": 1795185000000, "o": 143.79, "h": 146.56, "l": 124.27, "c": 125.53, "v": 13868067}, {"t": 1795444200000, "o": 167.04, "h": 171.5, "l": 156.93, "c": 165.05, "v": 12760000}];
const NEWS: MoveNews[] = [{"headline": "Nvidia Stock Is Falling Again. Why the Jensen Jubilation Is Already Fading.", "source": "Barron's / News Corp", "sentiment": "negative", "publishedAt": "2026-11-26T20:24:32.753Z"}, {"headline": "Nvidia board's Huang reversal raises doubts about independence, critics say", "source": "Euronext Markets", "sentiment": "negative", "publishedAt": "2026-11-26T20:18:32.753Z"}, {"headline": "Nvidia, Anthropic, Intel, HPE, Sanofi, and More Stocks That Explain Today's Market", "source": "Barron's", "sentiment": "neutral", "publishedAt": "2026-11-26T20:24:32.753Z"}, {"headline": "Jensen Huang's Return as Nvidia CEO Changes US-China Chip Trade Outlook Overnight, Says BofA — But a Bigger Chip Fight Could Be Coming", "source": "Benzinga", "sentiment": "neutral", "publishedAt": "2026-11-26T18:12:32.753Z"}, {"headline": "Nvidia Is 'No Ordinary Company' and Jensen Huang Is 'No Ordinary CEO,' Says El-Erian — but Analysts Warn of Risks", "source": "Benzinga", "sentiment": "neutral", "publishedAt": "2026-11-26T17:12:32.753Z"}, {"headline": "Nvidia board reinstates co-founder Jensen Huang as CEO after abrupt resignation", "source": "TipRanks / Google Finance", "sentiment": "positive", "publishedAt": "2026-11-26T01:12:32.753Z"}, {"headline": "Nvidia falls 14% on reports of SEC probe into accounting practices", "source": "Gotrade", "sentiment": "negative", "publishedAt": "2026-11-23T17:12:32.753Z"}, {"headline": "California Attorney General serves investigative subpoena on Nvidia", "source": "Gotrade", "sentiment": "negative", "publishedAt": "2026-11-22T17:12:32.753Z"}, {"headline": "JPMorgan raises Nvidia target to $230; Jefferies cuts to $250", "source": "Benzinga", "sentiment": "neutral", "publishedAt": "2026-11-21T23:12:32.753Z"}, {"headline": "Melius Research upgrades Nvidia to Buy", "source": "Defense World", "sentiment": "positive", "publishedAt": "2026-11-26T15:12:32.753Z"}, {"headline": "Nvidia Q3 revenue $115.8B, up 103%; guides Q4 to about $130B", "source": "NVIDIA / SEC 8-K", "sentiment": "positive", "publishedAt": "2026-11-20T15:12:32.753Z"}];
const FACTS: SiFacts = { ...EMPTY_FACTS, "price": 165.05,
  "changePct": 31.482514140046213,
  "sector": "Technology",
  "revGrowthYoY": 103.2136968038452,
  "grossMargin": 74.8213114188046,
  "opMargin": 66.91757881288629,
  "opMarginYearAgo": 63.16878925025436,
  "epsBeats": 4,
  "epsReports": 4,
  "trailingPe": 17.73,
  "consensus": "Buy",
  "buyCount": 28,
  "holdCount": 6,
  "sellCount": 0,
  "targetMean": 248.43,
  "analystTargets": [
    270,
    300,
    200,
    200,
    240
  ],
  "upgrades90": 2,
  "downgrades90": 0,
  "sma9": 148.95,
  "sma21": 149.58,
  "sma50": 206.08,
  "sma200": 203.04,
  "rsi14": 61.4,
  "pctFromHigh52": -32.18,
  "beta": 2.21,
  "realizedVol30": 60,
  "pivotR1": 172.05666666666667,
  "pivotR2": 179.06333333333333,
  "pivotS1": 157.48666666666668,
  "pivotS2": 149.92333333333335,
  "sectorRank": 10,
  "sectorRankTotal": 60,
  "instOwnershipPct": 63.71,
  "instHoldersChange": 48,
  "newsPos": 3,
  "newsNeg": 4,
  "revGrowth4q": 89.61053662852083,
  "epsGrowth4q": 98.88888888888889,
  "opMargin4q": 65.94365249772005,
  "grossMargin4q": 74.93171384440947,
  "peerRevGrowth4q": 37.647383745705255,
  "peerEpsGrowth4q": 53.142109777935865,
  "peerOpMargin4q": 32.83746783504436,
  "peerGrossMargin4q": 60.032641156358366,
  "peerTickers": [
    "AMD",
    "AVGO",
    "INTC",
    "QCOM",
    "MU"
  ],
  "peerPe": 36.88999999999999,
  "peerPeCount": 4,
  "peerFwdPe": 20.734,
  "peerFwdPeCount": 5 };
const TODAY = "2026-11-26";

const bars = dropForming(BARS, TODAY);

test("yesterday: the scare, the gap at the open and where it closed", () => {
  const y = yesterdayMove(bars)!;
  assert.equal(y.pct.toFixed(2), "31.48");
  const rows = yesterdayRows(y, NEWS);
  assert.deepEqual(
    rows.map((r) => [r.title, r.tag, r.tone]),
    [
      ["The scare", "Legal", "down"],
      ["Opened higher", "+33.1%", "up"],
      ["Where it closed", "No winner", "flat"],
    ],
  );
  assert.equal(rows[0].detail, "\u201CNvidia falls 14% on reports of SEC probe into accounting practices\u201D (Gotrade)");
  assert.equal(rows[1].detail, "At $167.04, from a $125.53 close. Most of the move came right at the open.");
  assert.equal(rows[2].detail, "$165.05. Mid-range, so no clear winner by the close. The day's range was 9.3%.");
});

test("the last five sessions: a roller-coaster week and the headline behind each big day", () => {
  const rows = weekRows(bars, NEWS);
  assert.deepEqual(
    rows.map((r) => [r.title, r.tag]),
    [
      ["A roller-coaster week", "+10.8%"],
      ["Mon, Nov 23", "+31.5%"],
      ["Fri, Nov 20", "\u221214.0%"],
    ],
  );
  assert.equal(rows[0].detail, "\u221214.0% on Fri, Nov 20, then +31.5% on Mon, Nov 23. It ended +10.8% overall, from $148.98 to $165.05.");
});

test("a bar dated today is still forming and is left out", () => {
  const todayBar = { ...BARS[BARS.length - 1], t: Date.parse("2026-11-26T14:30:00Z") };
  assert.equal(dropForming([...BARS, todayBar], TODAY).length, BARS.length);
  assert.equal(dropForming(BARS, TODAY).length, BARS.length);
});

test("could move: what pushes it up and pulls it down, in the design's order", () => {
  const { up, down } = couldMove(FACTS, {
    sector: [
      { t: "AMD", pct: -7.86 },
      { t: "AVGO", pct: -2.24 },
      { t: "INTC", pct: -5.3 },
      { t: "QCOM", pct: -1.56 },
      { t: "MU", pct: -7.48 },
    ],
    market: [
      { label: "Nasdaq 100", pct: -2.27 },
      { label: "S&P 500", pct: -0.92 },
    ],
    news: NEWS,
    bigMoves10: bigMovesIn10(bars),
    todayIso: TODAY,
  });
  assert.deepEqual(
    up.map((r) => [r.title, r.tag]),
    [
      ["Analysts see big upside", "+46.6%"],
      ["Sales are growing fast", "+103.2%"],
      ["The good news is fresh", "Upgrade"],
      ["Upgrades are building", "2 in 90d"],
      ["Cheap for its growth", "\u00BD the P/E"],
    ],
  );
  assert.deepEqual(
    down.map((r) => [r.title, r.tag]),
    [
      ["Negative news is weighing", "Overhang"],
      ["US\u2013China chip trade risk", "AI & chips"],
      ["The probe is still open", "Open"],
      ["Its sector is weak today", "Peers \u22124.9%"],
      ["The market is risk-off today", "NDX \u22122.3%"],
    ],
  );
  assert.equal(up[0].detail, "Top 5 analysts: average target $242 (+46.6%), median $240 (+45.4%). Consensus Buy.");
  assert.equal(up[4].detail, "17.7\u00D7 trailing P/E vs. 36.9\u00D7 for peers");
  assert.equal(down[3].detail, "AMD \u22127.9%, MU \u22127.5%, INTC \u22125.3%");
  assert.equal(down[4].detail, "Nasdaq 100 \u22122.3%, S&P 500 \u22120.9%");
});

test("without peer or index moves those two rows are left out, never invented", () => {
  const { down } = couldMove(FACTS, { news: NEWS, todayIso: TODAY });
  assert.ok(!down.some((r) => r.title.startsWith("Its sector") || r.title.startsWith("The market")));
});

test("nothing is said without data", () => {
  const none = couldMove(EMPTY_FACTS, { todayIso: TODAY });
  assert.deepEqual(none, { up: [], down: [] });
  assert.equal(yesterdayMove([]), null);
  assert.deepEqual(weekRows([], []), []);
});

test("headings are capitalised word by word, acronyms kept", () => {
  assert.equal(titleWords("What could push it up"), "What Could Push It Up");
  assert.equal(titleWords("NEXT EVENT \u00B7 Dec 9 \u00B7 in 13 days"), "Next Event \u00B7 Dec 9 \u00B7 In 13 Days");
  assert.equal(titleWords("FOMC rate decision"), "FOMC Rate Decision");
});
