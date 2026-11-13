/**
 * Copilot answers built only from data Stock Intelligence already has on screen.
 *
 * Used when the live model does not answer (down, rate-limited, too slow), so the
 * reply still addresses the question asked. The page used to show one generic
 * "today it moved X%" summary no matter what was typed, so "Should I sell NVDA
 * now?" got an answer about sector attribution.
 *
 * Every figure comes from `CopilotLocalInput`. A figure that is not there is left
 * out, never filled in. Replies are plain markdown (**bold** and "- " bullets),
 * which the screen's `formatAiChatReply` renders.
 */
import { forwardPe, pct, pct1, usd, type SiFacts } from "./data";

export interface CopilotLocalInput {
  sym: string;
  price: number;
  changePct: number;
  setup: string;
  /** Signal categories scoring 60+, out of 7. */
  confluence: number;
  facts: SiFacts;
  /** Headline signals, e.g. "RS rating 44/99". */
  signals: string[];
  /** "What would break this setup": [title, condition], for levels still ahead of the price. */
  invalid: Array<[string, string]>;
  /** Levels the price is already through: [title, where price stands]. */
  broken?: Array<[string, string]>;
  catalysts: Array<{ date: string; days: string; n: string; txt: string }>;
  peers: Array<{ t: string; pe: number | null; changePct: number | null }>;
  /** Today's move in words. */
  movedTxt: string;
}

export type CopilotIntent =
  | "ownership"
  | "levels"
  | "decision"
  | "valuation"
  | "bull"
  | "bear"
  | "catalyst"
  | "technical"
  | "general";

const has = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** $8.2M, $950K: a dollar amount at the size people read it. */
const money = (v: number) => {
  const a = Math.abs(v);
  return a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : `$${Math.round(a / 1e3)}K`;
};

/** What the question is after. Order matters: the first match wins. */
export function copilotIntent(question: string): CopilotIntent {
  const q = question.toLowerCase();
  if (/\b(insiders?|13f|holders?|ownership|owns|owned)\b/.test(q)) return "ownership";
  if (/\b(invalidat\w*|break (this|the)|stop[- ]?loss|stops?|exact (price|levels?)|levels?)\b/.test(q)) return "levels";
  if (/\b(sell(?:ing)?|buy(?:ing)?|hold(?:ing)?|trim|exit|enter|entry|accumulate|take profits?|position|should i)\b/.test(q)) return "decision";
  if (/\b(valuation|valued|peers?|compare\w*|cheap|expensive|multiples?|p\/e|overvalued|undervalued)\b/.test(q)) return "valuation";
  if (/\b(bull\w*|upside|long case|opportunit\w*)\b/.test(q)) return "bull";
  if (/\b(bear\w*|downside|risks?|worr\w*|concern\w*|short case)\b/.test(q)) return "bear";
  if (/\b(catalysts?|earnings|report|upcoming|events?|when)\b/.test(q)) return "catalyst";
  if (/\b(technical\w*|trend|moving averages?|dma|rsi|momentum|chart|support|resistance)\b/.test(q)) return "technical";
  return "general";
}

const BUY_RE = /buy|outperform|overweight/i;
const SELL_RE = /sell|underperform|underweight/i;

/**
 * Which way each measured signal points. `tech` is price action, `street` is
 * analysts and insiders; both are kept apart so a reply can name them correctly.
 */
function readSignals(i: CopilotLocalInput) {
  const { facts: f, price: p } = i;
  const tech = { up: [] as string[], down: [] as string[] };
  const street = { up: [] as string[], down: [] as string[] };
  const vs = (ma: number | null, name: string) => {
    if (has(ma)) (p > ma ? tech.up : tech.down).push(`price is ${p > ma ? "above" : "below"} the ${name} (${usd(ma)})`);
  };
  vs(f.sma9, "9 DMA");
  vs(f.sma21, "21 DMA");
  vs(f.sma50, "50 DMA");
  vs(f.sma200, "200 DMA");
  if (has(f.rsi14)) {
    if (f.rsi14 >= 55) tech.up.push(`RSI is ${f.rsi14.toFixed(0)}, strong momentum`);
    else if (f.rsi14 <= 45) tech.down.push(`RSI is ${f.rsi14.toFixed(0)}, weak momentum`);
  }
  if (f.consensus) {
    const target = has(f.targetMean) && p > 0 ? ` with a ${usd(f.targetMean)} target (${pct1((f.targetMean / p - 1) * 100)})` : "";
    if (BUY_RE.test(f.consensus)) street.up.push(`analysts rate it ${f.consensus}${target}`);
    else if (SELL_RE.test(f.consensus)) street.down.push(`analysts rate it ${f.consensus}${target}`);
  }
  if (has(f.upgrades90) && has(f.downgrades90) && f.upgrades90 !== f.downgrades90) {
    (f.upgrades90 > f.downgrades90 ? street.up : street.down).push(
      `${plural(f.upgrades90, "upgrade")} vs ${plural(f.downgrades90, "downgrade")} in 90 days`,
    );
  }
  if (has(f.insiderNet90) && f.insiderNet90 < 0) street.down.push("insiders were net sellers over 90 days");
  if (has(f.insiderNet90) && f.insiderNet90 > 0) street.up.push("insiders were net buyers over 90 days");
  const up = [...tech.up, ...street.up];
  const down = [...tech.down, ...street.down];
  const net = up.length - down.length;
  const label = net >= 2 ? "bullish" : net <= -2 ? "bearish" : "mixed";
  return { tech, street, up, down, label };
}

function levelsLine(f: SiFacts): string | null {
  const parts = [
    has(f.pivotS1) ? `S1 ${usd(f.pivotS1)}` : null,
    has(f.pivotS2) ? `S2 ${usd(f.pivotS2)}` : null,
    has(f.pivotR1) ? `R1 ${usd(f.pivotR1)}` : null,
    has(f.pivotR2) ? `R2 ${usd(f.pivotR2)}` : null,
  ].filter(Boolean);
  return parts.length ? `**Key levels:** ${parts.join(" · ")}` : null;
}

/** "Price loses the 50 DMA: Daily close below $221.50", with the title in bold. */
const invalidLines = (i: CopilotLocalInput): string[] => i.invalid.map(([title, cond]) => `**${title}:** ${cond}`);

/**
 * Breaks that have already happened. On its own each reads "Already below the 50
 * DMA: Price $164 is below 50 DMA $217.12. ..."; under a `label` the condition
 * alone follows it, since the label already says "already".
 */
const brokenLines = (i: CopilotLocalInput, label = ""): string[] =>
  (i.broken ?? []).map(([title, cond]) => (label ? `**${label}:** ${cond}` : `**${title}:** ${cond}`));

function nextCatalyst(i: CopilotLocalInput, label = "Next catalyst"): string | null {
  const c = i.catalysts[0];
  return c ? `**${label}:** ${c.n}, ${c.date} (${c.days}). ${c.txt}` : null;
}

function analystLine(f: SiFacts, price: number): string | null {
  if (!f.consensus) return null;
  const counts = [f.buyCount, f.holdCount, f.sellCount].every(has) ? ` (${f.buyCount} buy / ${f.holdCount} hold / ${f.sellCount} sell)` : "";
  const target = has(f.targetMean) && price > 0 ? `, mean target ${usd(f.targetMean)} (${pct1((f.targetMean / price - 1) * 100)})` : "";
  return `**Analysts:** ${f.consensus}${counts}${target}`;
}

const bullets = (lines: Array<string | null | undefined | false>) =>
  lines.filter((l): l is string => !!l).map((l) => `- ${l}`);

function decision(i: CopilotLocalInput, q: string): string[] {
  const s = readSignals(i);
  const verb = /\b(buy(?:ing)?|enter|entry|accumulate)\b/i.test(q)
    ? "buy"
    : /\b(sell(?:ing)?|exit|trim|take profits?)\b/i.test(q)
      ? "sell"
      : "hold";
  const act = verb === "hold" ? "hold or sell" : verb;
  return [
    `**${i.sym}: ${act}, read from the data (not personal advice)**`,
    ...bullets([
      `**The data reads ${s.label} right now:** ${s.up.length} measured signals point up and ${s.down.length} point down. Setup: ${i.setup}, ${i.confluence}/7 categories confirming.`,
      s.down.length ? `**Pointing down:** ${s.down.join("; ")}.` : null,
      s.up.length ? `**Pointing up:** ${s.up.join("; ")}.` : null,
      levelsLine(i.facts),
      ...brokenLines(i, "Already broken").slice(0, 2),
      ...i.invalid.slice(0, 2).map(([title, cond]) => `**Would break the setup:** ${title}: ${lowerFirst(cond)}.`),
      nextCatalyst(i),
    ]),
    `Whether to ${act} depends on your cost basis, time horizon and risk tolerance. This is a read of the setup, not a recommendation.`,
  ];
}

function valuation(i: CopilotLocalInput): string[] {
  const f = i.facts;
  const fpe = forwardPe(f);
  const peerPes = i.peers.map((p) => p.pe).filter((v): v is number => has(v) && v > 0).sort((a, b) => a - b);
  const mid = peerPes.length >> 1;
  const median = peerPes.length >= 2 ? (peerPes.length % 2 ? peerPes[mid] : (peerPes[mid - 1] + peerPes[mid]) / 2) : null;
  const premium = has(f.trailingPe) && f.trailingPe > 0 && median != null ? (f.trailingPe / median - 1) * 100 : null;
  const peerRows = i.peers
    .filter((p) => has(p.pe) && p.pe > 0)
    .slice(0, 6)
    .map((p) => `${p.t} ${(p.pe as number).toFixed(1)}×${has(p.changePct) ? ` (${pct(p.changePct)} today)` : ""}`);
  const growth =
    has(f.fwdEps) && has(f.nextFyEps) && f.fwdEps > 0 ? `next-FY consensus EPS growth ${pct1((f.nextFyEps / f.fwdEps - 1) * 100)}` : null;
  const paying = [has(f.revGrowthYoY) ? `revenue ${pct1(f.revGrowthYoY)} y/y` : null, growth].filter(Boolean);
  return [
    `**${i.sym} valuation against peers**`,
    ...bullets([
      has(f.trailingPe) || fpe != null
        ? `**${i.sym}:** ${has(f.trailingPe) ? `trailing P/E ${f.trailingPe.toFixed(1)}×` : "trailing P/E unavailable"}${fpe != null ? `, forward P/E ${fpe.toFixed(1)}×` : ""}.`
        : "P/E data has not loaded for this stock yet.",
      peerRows.length ? `**Peers (P/E):** ${peerRows.join(", ")}.` : "Peer P/E data has not loaded for this stock yet.",
      median != null && premium != null
        ? `**Against the peer median of ${median.toFixed(1)}×,** ${i.sym} trades at a ${premium >= 0 ? "premium" : "discount"} of ${Math.abs(premium).toFixed(0)}%.`
        : null,
      paying.length ? `**What the multiple is paying for:** ${paying.join(", ")}.` : null,
      analystLine(f, i.price),
    ]),
  ];
}

function levels(i: CopilotLocalInput): string[] {
  const f = i.facts;
  const dmas = [
    has(f.sma9) ? `9 DMA ${usd(f.sma9)}` : null,
    has(f.sma21) ? `21 DMA ${usd(f.sma21)}` : null,
    has(f.sma50) ? `50 DMA ${usd(f.sma50)}` : null,
    has(f.sma200) ? `200 DMA ${usd(f.sma200)}` : null,
  ].filter(Boolean);
  return [
    i.broken?.length
      ? `**What has already broken for ${i.sym}, and what still could** (price now ${usd(i.price)})`
      : `**What would break the ${i.sym} setup** (price now ${usd(i.price)})`,
    ...bullets([...brokenLines(i), ...invalidLines(i), levelsLine(f), dmas.length ? `**Moving averages:** ${dmas.join(" · ")}` : null]),
  ];
}

function bull(i: CopilotLocalInput): string[] {
  const f = i.facts;
  const s = readSignals(i);
  const business = [
    has(f.revGrowthYoY) ? `revenue ${pct1(f.revGrowthYoY)} y/y` : null,
    has(f.grossMargin) ? `gross margin ${f.grossMargin.toFixed(1)}%` : null,
    has(f.epsBeats) && has(f.epsReports) ? `beat EPS estimates in ${f.epsBeats} of the last ${f.epsReports} reports` : null,
  ].filter(Boolean);
  return [
    `**Bull case for ${i.sym}**`,
    ...bullets([
      i.signals.length ? `**Signals:** ${i.signals.join("; ")}.` : null,
      analystLine(f, i.price),
      business.length ? `**Business:** ${business.join(", ")}.` : null,
      s.tech.up.length
        ? `**Technically supportive:** ${s.tech.up.join("; ")}.`
        : s.tech.down.length
          ? `**Technicals do not confirm yet:** ${s.tech.down.join("; ")}.`
          : null,
      has(f.pivotR1)
        ? `**To confirm the bull case:** a daily close above R1 ${usd(f.pivotR1)}${has(f.sma50) && i.price < f.sma50 ? ` and a reclaim of the 50 DMA (${usd(f.sma50)})` : ""}.`
        : null,
    ]),
  ];
}

function bear(i: CopilotLocalInput): string[] {
  const f = i.facts;
  const s = readSignals(i);
  const fpe = forwardPe(f);
  return [
    `**Main risks for ${i.sym}**`,
    ...bullets([
      s.tech.down.length ? `**Technical pressure:** ${s.tech.down.join("; ")}.` : null,
      fpe != null && fpe >= 30 ? `**Valuation:** forward P/E ${fpe.toFixed(1)}×, a rich multiple that leaves little room for a revenue or guidance miss.` : null,
      nextCatalyst(i, "Event risk"),
      has(f.downgrades90) && f.downgrades90 > 0 ? `**Analysts:** ${plural(f.downgrades90, "downgrade")} in the last 90 days.` : null,
      has(f.insiderNet90) && f.insiderNet90 < 0 ? "**Insiders:** net sellers over the last 90 days." : null,
      ...brokenLines(i, "Already confirming the bear case").slice(0, 2),
      ...i.invalid.slice(0, 2).map(([title, cond]) => `**Would confirm the bear case:** ${title}: ${lowerFirst(cond)}.`),
    ]),
  ];
}

function catalyst(i: CopilotLocalInput): string[] {
  return [
    `**Upcoming catalysts for ${i.sym}**`,
    ...bullets(
      i.catalysts.length
        ? i.catalysts.slice(0, 5).map((c) => `**${c.n}, ${c.date} (${c.days}):** ${c.txt}`)
        : ["No dated catalyst is on the calendar for this stock yet."],
    ),
  ];
}

function technical(i: CopilotLocalInput): string[] {
  const f = i.facts;
  const s = readSignals(i);
  return [
    `**${i.sym} technical read**`,
    ...bullets([
      `**Setup:** ${i.setup}, ${i.confluence}/7 categories confirming. The measured signals lean ${s.label}.`,
      s.tech.up.length ? `**Constructive:** ${s.tech.up.join("; ")}.` : null,
      s.tech.down.length ? `**Cautionary:** ${s.tech.down.join("; ")}.` : null,
      has(f.rvol) ? `**Volume:** ${f.rvol.toFixed(1)}× the 20-day average.` : null,
      has(f.pctFromHigh52) ? `**52-week range:** ${pct1(f.pctFromHigh52)} from the high.` : null,
      levelsLine(f),
    ]),
  ];
}

function ownership(i: CopilotLocalInput, q: string): string[] {
  const f = i.facts;
  const shares = has(f.instSharesChange) ? `${f.instSharesChange >= 0 ? "added" : "cut"} ${(Math.abs(f.instSharesChange) / 1e6).toFixed(1)}M shares in the latest 13F quarter` : null;
  const insiders = has(f.insiderNet90)
    ? `**Insiders (open-market, 90 days):** net ${f.insiderNet90 >= 0 ? "buyers" : "sellers"} of ${money(f.insiderNet90)}.`
    : null;
  const institutions = [
    has(f.instOwnershipPct) ? `**Institutional ownership:** ${f.instOwnershipPct.toFixed(1)}% of shares.` : null,
    has(f.instHoldersChange) ? `**13F filers:** ${f.instHoldersChange >= 0 ? "+" : "−"}${Math.abs(f.instHoldersChange).toLocaleString()} quarter over quarter.` : null,
    shares ? `**Institutions** ${shares}.` : null,
    has(f.instPutCallRatio) ? `**Put/call ratio (13F holdings):** ${f.instPutCallRatio.toFixed(2)}.` : null,
  ];
  // Lead with whichever the question is about.
  const lines = bullets(/insider/i.test(q) ? [insiders, ...institutions] : [...institutions, insiders]);
  return [`**${i.sym} ownership and positioning**`, ...(lines.length ? lines : ["- No 13F or insider data has loaded for this stock yet."])];
}

function general(i: CopilotLocalInput): string[] {
  const s = readSignals(i);
  return [
    `**${i.sym} snapshot**`,
    ...bullets([
      `**Today:** ${pct(i.changePct)}. ${i.movedTxt}`,
      `**Setup:** ${i.setup}, ${i.confluence}/7 categories confirming; the measured signals lean ${s.label}.`,
      analystLine(i.facts, i.price),
      levelsLine(i.facts),
      nextCatalyst(i),
    ]),
  ];
}

/** A reply to `question` from the on-screen data alone. */
export function localCopilotAnswer(question: string, input: CopilotLocalInput): string {
  const build = { ownership, levels, decision, valuation, bull, bear, catalyst, technical, general }[copilotIntent(question)];
  return build(input, question).join("\n");
}
