import type { SiFacts } from "./data";
import type { Dir, FundamentalRead, ReadFacts, TechnicalRead, Verdict } from "./si-reads";

/**
 * The MarketCatalyst read on the Overview: a one-line headline, a short body and the two prices to watch,
 * written from the technical read, the fundamental read and the overall verdict. Every clause rests on a
 * figure the page has; a clause whose figure is missing is left out.
 */

/** A daily bar: close price and time (ms). */
export type CloseBar = { t: number; c: number };

export type MoveSummary = { text: string; lastPct: number; prevPct: number };

const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const money = (v: number) => `$${v.toFixed(2)}`;
const mag = (v: number) => Math.abs(v).toFixed(1);
const weekday = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/**
 * The last session's move in words ("NVDA jumped 31.5% on Monday"), or, if the stock touched its 52-week low in
 * the five sessions before, "hit a 52-week low on Friday, then jumped ...". Null with fewer than three bars.
 */
export function moveSummary(ticker: string, bars: ReadonlyArray<CloseBar> | null | undefined, low52: number | null | undefined): MoveSummary | null {
  const b = (bars ?? []).filter((x) => x && x.c > 0);
  if (b.length < 3) return null;
  const n = b.length;
  const change = (i: number) => (b[i].c / b[i - 1].c - 1) * 100;
  const last = change(n - 1);
  const prev = change(n - 2);
  const verb = last >= 5 ? "jumped" : last <= -5 ? "dropped" : last >= 0 ? "rose" : "slipped";
  const lastClause = `${verb} ${mag(last)}% on ${weekday(b[n - 1].t)}`;
  const lowAt = has(low52) ? b.slice(Math.max(0, n - 6), n - 1).findIndex((x) => x.c <= low52 * 1.005) : -1;
  if (lowAt >= 0) {
    return { text: `${ticker} hit a 52-week low on ${weekday(b[Math.max(0, n - 6) + lowAt].t)}, then ${lastClause}.`, lastPct: last, prevPct: prev };
  }
  const week = n >= 6 ? (b[n - 1].c / b[n - 6].c - 1) * 100 : null;
  const tail = week != null && Math.abs(week) >= 3 ? `, and is ${week >= 0 ? "up" : "down"} ${mag(week)}% over the last five sessions` : "";
  return { text: `${ticker} ${lastClause}${tail}.`, lastPct: last, prevPct: prev };
}

export type WatchLevel = { title: string; price: number; priceText: string; sub: string; tone: "up" | "down" };

/** One row of the read's body: what it is about, which way it leans, and its sentences (one short line each). */
export type ReadSection = { key: "move" | "business" | "technicals"; label: string; tone: Dir; lines: string[] };

export type HeadlineRead = {
  headline: string;
  /** The same sentences as one paragraph (used where there is no room for the rows). */
  body: string;
  sections: ReadSection[];
  chart: { label: string; agrees: boolean } | null;
  levels: WatchLevel[];
};

/**
 * A line cut into the runs the page prints plainly and the figures it prints bold: percentages, multiples,
 * prices and moving averages ("3.1%", "1.8×", "$150.49", "50 DMA"). A number inside "52-week" stays plain.
 */
export function splitFigures(text: string): Array<{ t: string; fig: boolean }> {
  return text
    .split(/((?!\d+-week)\$?\d[\d,]*(?:\.\d+)?(?:%|×| DMA)?)/)
    .map((t, i) => ({ t, fig: i % 2 === 1 }))
    .filter((p) => p.t !== "");
}

export function headlineRead(
  ticker: string,
  facts: ReadFacts | SiFacts,
  tech: TechnicalRead,
  fund: FundamentalRead,
  overall: Verdict,
  opts: { bars?: ReadonlyArray<CloseBar> | null; low52?: number | null } = {},
): HeadlineRead | null {
  if (!overall.n) return null;
  const f = facts as ReadFacts;
  const direction: Dir = overall.dir;
  const chartAgrees = tech.verdict.n > 0 && tech.verdict.dir === direction;
  const move = moveSummary(ticker, opts.bars, opts.low52);

  // How the price compares with the peers' P/E (only with at least three peers that have one).
  const peerRatio = has(f.trailingPe) && f.trailingPe > 0 && has(f.peerPe) && f.peerPe > 0 && (f.peerPeCount ?? 0) >= 3 ? f.trailingPe / f.peerPe : null;
  const cheap = peerRatio != null && peerRatio <= 0.8;
  const pricey = peerRatio != null && peerRatio >= 1.25;

  // "The business is strong and cheap"
  const business = fund.verdict.n === 0 ? "" : fund.verdict.dir === "up" ? "strong" : fund.verdict.dir === "down" ? "weak" : "mixed";
  let businessClause = "";
  if (business) {
    const price = fund.verdict.dir === "up" ? (cheap ? " and cheap" : pricey ? " but pricey" : "") : fund.verdict.dir === "down" ? (cheap ? " but cheap" : pricey ? " and pricey" : "") : "";
    businessClause = `The business is ${business}${price}`;
  }

  // "...and the technicals agree" / "but the technicals haven't confirmed the rebound"
  const bounced = move != null && (move.lastPct >= 3 || ((opts.bars ?? []).length >= 6 && ((opts.bars![opts.bars!.length - 1].c / opts.bars![opts.bars!.length - 6].c - 1) * 100) >= 3));
  let chartClause = "";
  if (tech.verdict.n > 0) {
    if (chartAgrees) chartClause = direction === "flat" ? "" : "and the technicals agree";
    else if (direction === "up") chartClause = `but the technicals haven't confirmed the ${bounced ? "rebound" : "move"}`;
    else if (direction === "down") chartClause = "though the technicals haven't broken down yet";
    else chartClause = tech.verdict.dir === "up" ? "and the technicals are leaning up" : "and the technicals are leaning down";
  }

  const reversal =
    move && move.lastPct >= 8 && move.prevPct <= -8 ? "The sell-off reversed. " : move && move.lastPct <= -8 && move.prevPct >= 8 ? "The rally reversed. " : "";
  const sentence = businessClause
    ? `${businessClause}${chartClause ? (chartClause.startsWith("and ") && !businessClause.includes(" and ") ? ` ${chartClause}` : `, ${chartClause}`) : ""}.`
    : chartClause
      ? `${chartClause.replace(/^(and|but|though) /, "").replace(/^./, (c) => c.toUpperCase())}.`
      : "";
  const fallback = direction === "up" ? "Leaning up" : direction === "down" ? "Leaning down" : "No clear direction";
  const headline = `${reversal}${sentence}`.trim() || `${fallback}.`;

  // The body: what moved, then what the business and the averages say. `sections` is the same text as three
  // rows, one short sentence per line.
  const body: string[] = [];
  const sections: ReadSection[] = [];
  const asSentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
  if (move) {
    body.push(move.text);
    sections.push({ key: "move", label: "RECENT MOVE", tone: move.lastPct > 0.05 ? "up" : move.lastPct < -0.05 ? "down" : "flat", lines: [move.text] });
  }
  const facts2: string[] = [];
  if (has(f.revGrowthYoY)) {
    let revenue = `Revenue is ${f.revGrowthYoY >= 0 ? "up" : "down"} ${mag(f.revGrowthYoY)}% y/y`;
    const peerGrowth = (f as { peerRevGrowth4q?: number | null }).peerRevGrowth4q;
    if (has(peerGrowth) && peerGrowth > 0 && f.revGrowthYoY > 0 && f.revGrowthYoY / peerGrowth >= 1.5) revenue += `, about ${(f.revGrowthYoY / peerGrowth).toFixed(1)}× the peer average`;
    facts2.push(revenue);
  }
  if (peerRatio != null) {
    if (peerRatio <= 0.55) facts2.push("the stock trades at half the peer P/E");
    else if (peerRatio <= 0.9) facts2.push(`the stock trades ${Math.round((1 - peerRatio) * 100)}% below the peer P/E`);
    else if (peerRatio >= 1.1) facts2.push(`the stock trades ${Math.round((peerRatio - 1) * 100)}% above the peer P/E`);
  }
  if (facts2.length) {
    body.push(`${facts2.join(", and ")}.`);
    sections.push({ key: "business", label: "THE BUSINESS", tone: fund.verdict.n ? fund.verdict.dir : "flat", lines: facts2.map(asSentence) });
  }
  const support = tech.nextSupport;
  const resistance = tech.nextResistance;
  if (has(f.price) && has(f.sma50) && has(f.sma200)) {
    const above50 = f.price > f.sma50;
    const above200 = f.price > f.sma200;
    const where = above50 && above200 ? "Price holds above its 50 DMA and 200 DMA" : !above50 && !above200 ? "Price is still below its 50 DMA and 200 DMA" : "Price sits between its 50 DMA and 200 DMA";
    const decide = !!(resistance && support && !chartAgrees);
    body.push(`${where}${decide ? ", and two prices decide what happens next" : ""}.`);
    sections.push({ key: "technicals", label: "THE TECHNICALS", tone: tech.verdict.n ? tech.verdict.dir : "flat", lines: [`${where}.`, ...(decide ? ["Two prices decide what happens next."] : [])] });
  }

  // The two prices to watch, named for what a close beyond each would mean.
  const above = (title: string): WatchLevel | null =>
    resistance ? { title, price: resistance.value, priceText: money(resistance.value), sub: `Next resistance · ${resistance.pct.toFixed(1)}% above today's price`, tone: "up" } : null;
  const below = (title: string): WatchLevel | null =>
    support ? { title, price: support.value, priceText: money(support.value), sub: `Next support · ${Math.abs(support.pct).toFixed(1)}% below today's price`, tone: "down" } : null;
  const wanted =
    direction === "up"
      ? [above("Confirms: a close above"), below("Voids: a close below")]
      : direction === "down"
        ? [above("Voids: a close above"), below("Confirms: a close below")]
        : [above("Turns up: a close above"), below("Turns down: a close below")];

  return {
    headline,
    body: body.join(" "),
    sections,
    chart: tech.verdict.n > 0 && has(f.price) ? { label: chartAgrees ? "Chart agrees" : "Chart not confirming", agrees: chartAgrees } : null,
    levels: wanted.filter((l): l is WatchLevel => !!l),
  };
}
