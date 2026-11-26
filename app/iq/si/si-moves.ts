import { fmtMarketDate } from "../calendar-range";
import type { SiFacts } from "./data";
import { topTargets } from "./si-reads";

/**
 * The engines behind the Overview's "Why it moved" and "Why it could move" panels, ported from the new
 * Stock Intelligence design: what yesterday's session says, what the last five sessions say, and what
 * could push the stock up or pull it down. Pure functions: the page supplies bars, headlines, peer and
 * index moves, and renders the rows.
 */

export type MoveBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type MoveNews = { headline?: string | null; publishedAt?: string | null; sentiment?: string | null; source?: string | null };
export type MoveTone = "up" | "down" | "flat";
export type MoveRow = { title: string; detail: string; tag?: string; tone?: MoveTone; isNew?: boolean };

/** What the "could move" engine reads besides the stock's own facts. */
export type MoveContext = {
  /** The stock's peers' moves today, in percent. */
  sector?: ReadonlyArray<{ t: string; pct: number }>;
  /** The market's moves today (Nasdaq 100, S&P 500). */
  market?: ReadonlyArray<{ label: string; pct: number }>;
  news?: ReadonlyArray<MoveNews> | null;
  /** Sessions in the last 10 that moved 5% or more. */
  bigMoves10?: number | null;
  /** Today's date in New York, YYYY-MM-DD. */
  todayIso: string;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const usd2 = (v: number) => `$${v.toFixed(2)}`;
const signed1 = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const dayLabel = (t: number) => fmtMarketDate(t, { weekday: "short", month: "short", day: "numeric" });

// ── The headline's tag: what kind of story it is ──
const POSITIVE_TAGS: Array<[RegExp, string]> = [
  [/upgrad/i, "Upgrade"],
  [/\b(beats?|tops?|exceeds?|surpass\w*)\b/i, "Beat"],
  [/\b(raises?|boosts?|lifts?|hikes?)\b.*\b(guidance|forecast|outlook|target)\b/i, "Raised"],
  [
    /\b(reinstat\w*|rehire\w*|appoint\w*|names?|hires?|returns?)\b.*\b(CEO|chief|chair\w*|president|founder)\b|\b(CEO|chief|chair\w*|president|founder)\b.*\b(returns?|reinstat\w*|appointed|named)\b/i,
    "Leadership",
  ],
  [/\b(partnership|partners?|deal|contract|orders?|wins?)\b/i, "Deal"],
  [/\b(approv\w*|clears?)\b/i, "Approval"],
  [/\b(record|all-time high|surges?|soars?|jumps?|rall(y|ies))\b/i, "Surge"],
];
const NEGATIVE_TAGS: Array<[RegExp, string]> = [
  [/downgrad/i, "Downgrade"],
  [/\b(subpoena\w*|investigat\w*|probe|lawsuit|sues?|sued|antitrust|fraud|indict\w*)\b/i, "Legal"],
  [/\b(resign\w*|steps? down|ousted|departs?|exits?)\b/i, "Leadership"],
  [/\b(misses?|cuts?|lowers?|slashes?)\b/i, "Cut"],
  [/\b(falls?|plunges?|tumbles?|slides?|drops?|sinks?|sell-?off)\b/i, "Selloff"],
  [/\b(bans?|restrict\w*|tariffs?|export controls?)\b/i, "Policy"],
];

function storyTag(headline: string | null | undefined, sentiment: "positive" | "negative" | "neutral"): { title: string; tag: string } {
  const text = headline ?? "";
  if (sentiment === "positive") {
    const hit = POSITIVE_TAGS.find(([re]) => re.test(text));
    return { title: "The catalyst", tag: hit ? hit[1] : "Tailwind" };
  }
  if (sentiment === "negative") {
    const hit = NEGATIVE_TAGS.find(([re]) => re.test(text));
    return { title: "The scare", tag: hit ? hit[1] : "Headwind" };
  }
  const hit = NEGATIVE_TAGS.find(([re]) => re.test(text)) ?? POSITIVE_TAGS.find(([re]) => re.test(text));
  return { title: "In the news", tag: hit ? hit[1] : "Context" };
}

const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The bars without the one still forming today (a bar dated today or later is dropped). */
export function dropForming<T extends { t: number }>(bars: ReadonlyArray<T> | null | undefined, todayIso: string): T[] {
  if (!bars?.length) return [];
  const last = bars[bars.length - 1];
  return isoOf(last.t) >= todayIso ? bars.slice(0, -1) : bars.slice();
}

export type SessionMove = {
  t: number;
  pct: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  gapPct: number;
  volRatio: number | null;
  closePos: number | null;
};

/** The last completed session against the one before it. `bars` come without the forming one (see dropForming). */
export function yesterdayMove(bars: ReadonlyArray<MoveBar>): SessionMove | null {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  if (!(prev.c > 0) || !(last.c > 0)) return null;
  const before = bars.slice(Math.max(0, bars.length - 21), bars.length - 1);
  const avgVol = before.length >= 10 ? before.reduce((a, b) => a + b.v, 0) / before.length : null;
  return {
    t: last.t,
    pct: (last.c / prev.c - 1) * 100,
    open: last.o,
    high: last.h,
    low: last.l,
    close: last.c,
    prevClose: prev.c,
    gapPct: (last.o / prev.c - 1) * 100,
    volRatio: avgVol && avgVol > 0 ? last.v / avgVol : null,
    closePos: last.h > last.l ? (last.c - last.l) / (last.h - last.l) : null,
  };
}

/** Headlines near one session, the ones that agree with the move first, then the closest to the close. */
function headlinesAround(t: number, pct: number, news: ReadonlyArray<MoveNews> | null | undefined): MoveNews[] {
  const want = pct >= 0 ? "positive" : "negative";
  return (Array.isArray(news) ? news : [])
    .filter((n) => n.headline && n.publishedAt && Date.parse(n.publishedAt) >= t - 18 * 36e5 && Date.parse(n.publishedAt) <= t + 40 * 36e5)
    .sort(
      (a, b) =>
        +(b.sentiment === want) - +(a.sentiment === want) ||
        Math.abs(Date.parse(a.publishedAt!) - (t + 4 * 36e5)) - Math.abs(Date.parse(b.publishedAt!) - (t + 4 * 36e5)),
    );
}

const toneOf = (sentiment: string | null | undefined): MoveTone => (sentiment === "positive" ? "up" : sentiment === "negative" ? "down" : "flat");

/** Why yesterday moved: the headlines, the gap at the open, where it closed, and heavy trading. */
export function yesterdayRows(y: SessionMove, news: ReadonlyArray<MoveNews> | null | undefined, max = 3): MoveRow[] {
  const rows: MoveRow[] = [];
  for (const n of headlinesAround(y.t, y.pct, news).slice(0, 2)) {
    const story = storyTag(n.headline, n.sentiment === "positive" ? "positive" : n.sentiment === "negative" ? "negative" : "neutral");
    rows.push({ title: story.title, detail: `“${n.headline}”${n.source ? ` (${n.source})` : ""}`, tag: story.tag, tone: toneOf(n.sentiment) });
  }
  if (Math.abs(y.gapPct) >= 1) {
    rows.push({
      title: `Opened ${y.gapPct >= 0 ? "higher" : "lower"}`,
      detail: `At ${usd2(y.open)}, from a ${usd2(y.prevClose)} close.${Math.abs(y.gapPct) >= 5 ? " Most of the move came right at the open." : ""}`,
      tag: signed1(y.gapPct),
      tone: y.gapPct >= 0 ? "up" : "down",
    });
  }
  const range = ((y.high / y.low - 1) * 100).toFixed(1);
  const closeNote =
    y.closePos == null
      ? ""
      : y.closePos >= 0.75
        ? " Near the day's high, so buyers held on."
        : y.closePos <= 0.25
          ? " Near the day's low, so sellers took control."
          : " Mid-range, so no clear winner by the close.";
  rows.push({
    title: "Where it closed",
    detail: `${usd2(y.close)}.${closeNote} The day's range was ${range}%.`,
    tag: y.closePos == null ? `Range ${range}%` : y.closePos >= 0.75 ? "Buyers held" : y.closePos <= 0.25 ? "Sellers won" : "No winner",
    tone: y.closePos == null ? "flat" : y.closePos >= 0.75 ? "up" : y.closePos <= 0.25 ? "down" : "flat",
  });
  if (y.volRatio != null && y.volRatio >= 1.5) {
    rows.push({
      title: "Heavy trading",
      detail: `Volume was ${y.volRatio.toFixed(1)}× normal, so the move had real money behind it`,
      tag: `${y.volRatio.toFixed(1)}×`,
      tone: "flat",
    });
  }
  return rows.slice(0, max);
}

/** Why the last five sessions moved: the shape of the week, then the headline behind each big day. */
export function weekRows(bars: ReadonlyArray<MoveBar> | null | undefined, news: ReadonlyArray<MoveNews> | null | undefined, max = 3): MoveRow[] {
  if (!bars || bars.length < 6) return [];
  const n = bars.length;
  const base = bars[n - 6];
  const week = bars.slice(n - 5);
  if (!(base.c > 0)) return [];
  const days = week.map((b, i) => ({ t: b.t, pct: (b.c / (i === 0 ? base.c : week[i - 1].c) - 1) * 100 }));
  const total = (week[4].c / base.c - 1) * 100;
  const up = days.filter((d) => d.pct > 0).length;
  const big = days.filter((d) => Math.abs(d.pct) >= 5).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const bigInOrder = [...big].sort((a, b) => a.t - b.t);
  const tone = (v: number): MoveTone => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");
  const span = `from $${base.c.toFixed(2)} to $${week[4].c.toFixed(2)}`;
  const rows: MoveRow[] = [];
  if (bigInOrder.length >= 2 && bigInOrder.some((d) => d.pct > 0) && bigInOrder.some((d) => d.pct < 0)) {
    rows.push({
      title: "A roller-coaster week",
      detail: `${bigInOrder.map((d) => `${signed1(d.pct)} on ${dayLabel(d.t)}`).join(", then ")}. It ended ${signed1(total)} overall, ${span}.`,
      tag: signed1(total),
      tone: tone(total),
    });
  } else if (bigInOrder.length === 1) {
    const rest = total - bigInOrder[0].pct;
    rows.push({
      title: "One day did most of the work",
      detail: `${signed1(bigInOrder[0].pct)} on ${dayLabel(bigInOrder[0].t)}. The other four sessions together moved about ${signed1(rest)}.`,
      tag: signed1(total),
      tone: tone(total),
    });
  } else {
    rows.push({
      title: Math.abs(total) < 1.5 ? "A quiet stretch" : total > 0 ? "A steady climb" : "A steady slide",
      detail: `Up on ${up} of 5 sessions, ${signed1(total)} overall (${span}).`,
      tag: signed1(total),
      tone: tone(total),
    });
  }
  for (const d of big.slice(0, 2)) {
    const n1 = headlinesAround(d.t, d.pct, news)[0];
    if (n1) rows.push({ title: dayLabel(d.t), detail: `“${n1.headline}”${n1.source ? ` (${n1.source})` : ""}`, tag: signed1(d.pct), tone: tone(d.pct) });
  }
  return rows.slice(0, max);
}

// ── What could push it up or pull it down ──
const money = (v: number) => `$${v >= 100 ? v.toFixed(0) : v.toFixed(2)}`;
const compactUsd = (v: number) => {
  const a = Math.abs(v);
  return `${v < 0 ? "−" : ""}$${a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : a.toFixed(0)}`;
};
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const signedPct1 = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const vsPrice = (v: number, price: number) => `${v >= 0 ? "+" : ""}${((v / price - 1) * 100).toFixed(1)}%`;
const INDEX_TICKER: Record<string, string> = { "nasdaq 100": "NDX", "nasdaq-100": "NDX", "s&p 500": "SPX", "s&p500": "SPX", "dow jones": "DJIA", "russell 2000": "RUT" };
const indexTag = (m: { label: string; pct: number }) => `${INDEX_TICKER[m.label.toLowerCase()] ?? m.label} ${signedPct1(m.pct)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthDay = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const quoted = (n: MoveNews) => `“${n.headline}”${n.source ? ` (${n.source})` : ""}`;
const row = (title: string, detail: string, tag: string, extra?: Partial<MoveRow>): MoveRow => ({ title, detail, tag, ...extra });

const AI_AND_CHIPS = /\b(AI|A\.I\.|artificial intelligence|chips?|semiconductors?|GPUs?|data ?centers?|export|tariffs?|China|hyperscal\w*)\b/i;
const LEGAL_NOUNS: Array<[RegExp, string]> = [
  [/\bsubpoena/i, "subpoena"],
  [/\bindict/i, "indictment"],
  [/\b(class[- ]action|lawsuit|sues?|sued)\b/i, "lawsuit"],
  [/\b(investigat\w*)\b/i, "investigation"],
  [/\bprobe\b/i, "probe"],
  [/\bantitrust\b/i, "antitrust case"],
  [/\b(SEC|DOJ|FTC) (charges?|action|complaint)\b/i, "regulatory action"],
  [/\bfraud\b/i, "fraud allegation"],
  [/\brecall\b/i, "recall"],
];
const RESOLVED =
  /\b(dismiss\w*|settle[sd]?|settlement|clear(s|ed)|drops?|dropped|closes?|closed|resolved|ends?|ended|lifted)\b.*\b(probe|case|suit|lawsuit|investigation|subpoena|charges?|inquiry)\b|\b(probe|case|suit|lawsuit|investigation|subpoena|charges?|inquiry)\b.*\b(dismissed|settled|resolved|closed|dropped|ended|lifted)\b/i;

/** The stock's headlines of the last seven days with this sentiment, newest first. */
function recentNews(ctx: MoveContext, sentiment: string): MoveNews[] {
  const since = Date.parse(`${ctx.todayIso}T00:00:00Z`) - 6048e5;
  return (Array.isArray(ctx.news) ? ctx.news : [])
    .filter((n) => n.headline && n.sentiment === sentiment && n.publishedAt && Date.parse(n.publishedAt) >= since)
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
}

/** How the peers are moving today: their average and the three furthest from flat in that direction. */
function sectorToday(ctx: MoveContext): { avg: number; names: string } | null {
  const peers = (ctx.sector ?? []).filter((p) => p && Number.isFinite(p.pct));
  if (peers.length < 3) return null;
  const avg = peers.reduce((a, p) => a + p.pct, 0) / peers.length;
  const lead = [...peers].sort((a, b) => (avg < 0 ? a.pct - b.pct : b.pct - a.pct)).slice(0, 3);
  return { avg, names: lead.map((p) => `${p.t} ${signedPct1(p.pct)}`).join(", ") };
}

/** A legal or regulatory headline from the last week that no later headline has settled. */
function openLegalStory(ctx: MoveContext, used: ReadonlySet<string>): { a: MoveNews; noun: string } | null {
  const since = Date.parse(`${ctx.todayIso}T00:00:00Z`) - 6048e5;
  const list = (Array.isArray(ctx.news) ? ctx.news : [])
    .filter((n) => n.headline && n.publishedAt && Date.parse(n.publishedAt) >= since)
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
  for (const a of list) {
    if (used.has(a.headline!) || RESOLVED.test(a.headline!)) continue;
    const hit = LEGAL_NOUNS.find(([re]) => re.test(a.headline!));
    if (!hit) continue;
    return list.some((o) => Date.parse(o.publishedAt!) > Date.parse(a.publishedAt!) && RESOLVED.test(o.headline!)) ? null : { a, noun: hit[1] };
  }
  return null;
}

/** What could push the stock up and what could pull it down, each at most `max` long. */
export function couldMove(e: SiFacts, ctx: MoveContext, max = 5): { up: MoveRow[]; down: MoveRow[] } {
  const up: MoveRow[] = [];
  const down: MoveRow[] = [];
  const top = topTargets(e.analystTargets);
  const price = e.price;
  if (top && finite(price) && price > 0) {
    if (top.avg / price - 1 >= 0.1) {
      up.push(
        row(
          "Analysts see big upside",
          `Top ${top.n} analysts: average target ${money(top.avg)} (${vsPrice(top.avg, price)}), median ${money(top.median)} (${vsPrice(top.median, price)}).${e.consensus ? ` Consensus ${e.consensus}.` : ""}`,
          vsPrice(top.avg, price),
        ),
      );
    }
  } else if (finite(e.targetMean) && finite(price) && price > 0 && (e.targetMean / price - 1) * 100 >= 10) {
    up.push(row("Analysts see big upside", `Average price target ${money(e.targetMean)} (${vsPrice(e.targetMean, price)}).${e.consensus ? ` Consensus ${e.consensus}.` : ""}`, vsPrice(e.targetMean, price)));
  }
  if (finite(e.revGrowthYoY) && e.revGrowthYoY >= 15) {
    up.push(row("Sales are growing fast", `+${e.revGrowthYoY.toFixed(1)}% y/y. More quarters like this keep the story going.`, `+${e.revGrowthYoY.toFixed(1)}%`));
  }
  const good = recentNews(ctx, "positive");
  const fresh = good[0];
  if (fresh) up.push(row("The good news is fresh", quoted(fresh), storyTag(fresh.headline, "positive").tag));
  const tailwind = good.find((n) => n !== fresh && AI_AND_CHIPS.test(n.headline!));
  if (tailwind) up.push(row("An AI and chip tailwind", quoted(tailwind), "AI & chips"));
  const sector = sectorToday(ctx);
  if (sector && sector.avg >= 1) up.push(row("Its sector is strong today", sector.names, `Peers ${signedPct1(sector.avg)}`));
  const market = (ctx.market ?? []).filter((m) => m && Number.isFinite(m.pct));
  if (market.length && Math.max(...market.map((m) => m.pct)) >= 1 && Math.min(...market.map((m) => m.pct)) > 0) {
    up.push(row("The market is firm today", market.map((m) => `${m.label} ${signedPct1(m.pct)}`).join(", "), indexTag([...market].sort((a, b) => b.pct - a.pct)[0])));
  }
  if (finite(e.upgrades90) && e.upgrades90 > 0) {
    up.push(row("Upgrades are building", `${plural(e.upgrades90, "analyst upgrade")} in the last 90 days`, `${e.upgrades90} in 90d`));
  }
  if (finite(e.trailingPe) && e.trailingPe > 0 && finite(e.peerPe) && e.peerPe > 0 && (e.peerPeCount ?? 0) >= 3 && e.trailingPe <= e.peerPe * 0.8) {
    const ratio = e.trailingPe / e.peerPe;
    const growing = finite(e.revGrowthYoY) && e.revGrowthYoY >= 10;
    up.push(
      row(
        growing ? "Cheap for its growth" : "Cheaper than its peers",
        `${e.trailingPe.toFixed(1)}× trailing P/E vs. ${e.peerPe.toFixed(1)}× for peers`,
        ratio <= 0.55 ? "½ the P/E" : `${Math.round((1 - ratio) * 100)}% cheaper`,
      ),
    );
  }
  if (finite(e.epsBeats) && e.epsReports && e.epsReports >= 2 && e.epsBeats / e.epsReports >= 0.75) {
    up.push(row("It keeps beating estimates", `Beat earnings estimates in ${e.epsBeats} of the last ${e.epsReports} reports`, `${e.epsBeats} of ${e.epsReports}`));
  }
  if (finite(e.pctFromHigh52) && e.pctFromHigh52 <= -15 && finite(price)) {
    const high = price / (1 + e.pctFromHigh52 / 100);
    up.push(row("Room to recover", `Still ${Math.abs(e.pctFromHigh52).toFixed(0)}% below its 52-week high of ${money(high)}, with room to recover if confidence returns`, `−${Math.abs(e.pctFromHigh52).toFixed(0)}%`));
  }
  if (finite(e.insiderNet90) && e.insiderNet90 > 0) {
    up.push(row("Insiders are buying", `Company insiders are net buyers (${compactUsd(e.insiderNet90)} in 90 days)`, "Net buy"));
  }

  const bad = recentNews(ctx, "negative");
  const used = new Set<string>();
  if (bad[0]) {
    used.add(bad[0].headline!);
    down.push(row("Negative news is weighing", quoted(bad[0]), "Overhang"));
  }
  const aiNews = [...bad, ...recentNews(ctx, "neutral")].find((n) => n !== bad[0] && AI_AND_CHIPS.test(n.headline!));
  if (aiNews) {
    used.add(aiNews.headline!);
    down.push(row(/\b(China|export|tariffs?)\b/i.test(aiNews.headline!) ? "US–China chip trade risk" : "AI and chip news", quoted(aiNews), "AI & chips"));
  }
  const legal = openLegalStory(ctx, used);
  if (legal) {
    used.add(legal.a.headline!);
    const hours = (Date.parse(`${ctx.todayIso}T12:00:00Z`) - Date.parse(legal.a.publishedAt!)) / 36e5;
    down.push(row(`The ${legal.noun} is still open`, `${quoted(legal.a)} · ${monthDay(legal.a.publishedAt!)}`, "Open", { isNew: hours <= 48 }));
  }
  const weak = sectorToday(ctx);
  if (weak && weak.avg <= -1) down.push(row("Its sector is weak today", weak.names, `Peers ${signedPct1(weak.avg)}`));
  const indexes = (ctx.market ?? []).filter((m) => m && Number.isFinite(m.pct));
  if (indexes.length && Math.min(...indexes.map((m) => m.pct)) <= -0.7) {
    down.push(row("The market is risk-off today", indexes.map((m) => `${m.label} ${signedPct1(m.pct)}`).join(", "), indexTag([...indexes].sort((a, b) => a.pct - b.pct)[0])));
  }
  if (bad[1] && !used.has(bad[1].headline!) && down.length < max) down.push(row("More negative news", quoted(bad[1]), "Overhang"));
  if (finite(e.downgrades90) && e.downgrades90 > 0) {
    down.push(row("Analysts are cutting ratings", `${plural(e.downgrades90, "analyst downgrade")} in the last 90 days`, `${e.downgrades90} in 90d`));
  }
  const forwardPe = finite(e.fwdEps) && e.fwdEps > 0 && finite(price) ? price / e.fwdEps : null;
  if (forwardPe != null && forwardPe >= 35) {
    down.push(row("Priced for perfection", `${forwardPe.toFixed(0)}× this year's earnings leaves little room for a miss`, `${forwardPe.toFixed(0)}× P/E`));
  }
  if (finite(e.opMargin) && finite(e.opMarginYearAgo) && e.opMarginYearAgo - e.opMargin >= 2) {
    const drop = e.opMarginYearAgo - e.opMargin;
    down.push(row("Profit margins are shrinking", `Operating margin ${e.opMargin.toFixed(1)}%, down ${drop.toFixed(1)} points from a year ago`, `−${drop.toFixed(1)} pts`));
  }
  if (finite(ctx.bigMoves10) && ctx.bigMoves10 >= 2) {
    down.push(row("Very jumpy", `Moved 5% or more on ${ctx.bigMoves10} of the last 10 trading days, so big swings can come either way`, `${ctx.bigMoves10} of 10`));
  }
  if (finite(e.revGrowthYoY) && e.revGrowthYoY < 0) {
    down.push(row("Sales are shrinking", `${e.revGrowthYoY.toFixed(1)}% y/y`, `${e.revGrowthYoY.toFixed(1)}%`));
  }
  if (finite(e.insiderNet90) && e.insiderNet90 < 0) {
    down.push(row("Insiders are selling", `Company insiders are net sellers (${compactUsd(e.insiderNet90)} in 90 days)`, "Net sell"));
  }
  return { up: up.slice(0, max), down: down.slice(0, max) };
}

/** Sessions of the last ten that moved 5% or more (the "Very jumpy" rule); null with fewer than eleven bars. */
export function bigMovesIn10(bars: ReadonlyArray<{ c: number }>): number | null {
  if (bars.length < 11) return null;
  return bars.slice(-10).filter((b, i) => {
    const before = bars[bars.length - 11 + i];
    return before.c > 0 && Math.abs(b.c / before.c - 1) >= 0.05;
  }).length;
}

const KEEP_CAPS = new Set(["AI", "MC", "EPS", "P/E", "RSI", "DMA", "MACD", "YTD", "SI", "FOMC", "GAAP", "CEO", "ETF", "USD", "TTM", "RS", "EBITDA", "EV/EBITDA", "FCF", "IPO", "SEC", "FY", "ATR", "ADX", "VWAP", "PEG", "US"]);

/** Capitalises each word as the design's headings are written ("What could push it up" is "What Could Push It Up"); known acronyms stay in capitals. */
export function titleWords(text: string): string {
  return text.replace(/[A-Za-z0-9][A-Za-z0-9/&'\u2019.-]*/g, (w) =>
    w.toUpperCase() === "MARKETCATALYST" ? "MarketCatalyst" : KEEP_CAPS.has(w.toUpperCase()) ? w.toUpperCase() : /\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}
