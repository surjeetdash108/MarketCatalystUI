/**
 * "What Matters Now": the wording and arithmetic behind each slide.
 *
 * Pure functions, no React and no fetching, so each rule can be tested with a
 * fixture. `wmn-slides.tsx` assembles these into the carousel's slides.
 *
 * Everything here is stated fact: moves, counts, times, and how a number sits
 * against a published forecast. Nothing is a view, a pick or a prediction.
 */
import { latestSessionDate, type MarketPhase } from "./market-status";
import type {
  WmnAnalystRow,
  WmnAnalysts,
  WmnBreadth,
  WmnCatalyst,
  WmnContributor,
  WmnEarningsItem,
  WmnStockInFocus,
  WmnVersus,
  WmnWeight,
} from "./types/wmn";

const pct = (n: number, dp = 2) => `${Math.abs(n).toFixed(dp)}%`;

// ───────────────────────────── Slide 1 ─────────────────────────────

/**
 * Breadth only if it belongs to the session the live index moves belong to.
 *
 * The index moves come from the live tape; breadth comes from a job that runs a
 * few times a day and is skipped until half the universe has reported. Early in
 * a session the newest settled count is therefore YESTERDAY's, and printing it
 * beside today's live move ("the S&P is up 0.6%, with 941 stocks advancing")
 * mixes two days in one sentence. `latestSessionDate` is holiday- and
 * weekend-aware, so the count is also dropped when its day is not the last session.
 */
export function breadthForSession(b: WmnBreadth | null | undefined, now: Date): WmnBreadth | null {
  return b && b.date === latestSessionDate(now) ? b : null;
}

/**
 * Colour class for a % move. Rounds the way `sign()` prints (2 dp), so a move
 * shown as "0.00%" is flat, never red or green. (`cls()` in utils does the same
 * but returns a bare string; the slide model needs the union.)
 */
export function moveTone(n: number): "up" | "down" | "flat" {
  const r = Math.round(n * 100) / 100;
  return r > 0 ? "up" : r < 0 ? "down" : "flat";
}

/** A session move smaller than this reads as "flat". */
const FLAT_BAND = 0.1;
/** A move at least this big reads as a big day. */
const BIG_DAY = 1.5;

export interface DirectionInput {
  phase: MarketPhase;
  /** % moves of the headline indices, from the live tape. */
  spx: number | null;
  ndx: number | null;
  /** The VIX level (not its move). */
  vix: number | null;
  /** Advance/decline over the universe we track; `total` is how many stocks that is. */
  breadth: { advancers: number; decliners: number; total: number } | null;
}

function tone(p: number): "up" | "down" | "flat" {
  return p >= FLAT_BAND ? "up" : p <= -FLAT_BAND ? "down" : "flat";
}

/**
 * One sentence on the session, built only from numbers on the page.
 *
 * It states what moved and what the internals looked like. It deliberately does
 * not say WHY ("tech-led", "on rate fears"): a cause is a claim, and nothing
 * here can establish one. Returns null without an S&P 500 move, because
 * a market headline without the market's own number would be decoration.
 */
export function marketHeadline(i: DirectionInput): string | null {
  if (i.spx == null) return null;
  const live = i.phase === "open";
  const t = tone(i.spx);
  const big = Math.abs(i.spx) >= BIG_DAY;

  let lead: string;
  if (t === "flat") {
    lead = live ? "Stocks are little changed" : "Stocks closed little changed";
  } else if (i.ndx != null && tone(i.ndx) !== "flat" && tone(i.ndx) !== t) {
    lead = live ? "Stocks are mixed" : "Stocks closed mixed";
  } else {
    const dir = t === "up" ? "higher" : "lower";
    lead = live ? `Stocks are ${big ? "sharply " : ""}${dir}` : `Stocks closed ${big ? "sharply " : ""}${dir}`;
  }

  const move = (name: string, p: number) =>
    live ? `${name} is ${p >= 0 ? "up" : "down"} ${pct(p)}` : `${name} ${p >= 0 ? "gained" : "lost"} ${pct(p)}`;
  // The Nasdaq shares the S&P's verb when both went the same way; otherwise it
  // gets its own clause so the sentence never says two indices moved alike.
  let moves = `the ${move("S&P 500", i.spx)}`;
  if (i.ndx != null) {
    const sameWay = (i.ndx >= 0) === (i.spx >= 0);
    moves += sameWay ? ` and the Nasdaq ${pct(i.ndx)}` : `, while the ${move("Nasdaq", i.ndx)}`;
  }
  const tail: string[] = [];
  if (i.breadth && i.breadth.advancers + i.breadth.decliners > 0) {
    // Said against the universe we track, not "the market": the count covers
    // ~1,500 names, and a reader would otherwise take it for NYSE + Nasdaq breadth.
    const n = (v: number) => v.toLocaleString("en-US");
    tail.push(`${n(i.breadth.advancers)} of the ${n(i.breadth.total)} stocks we track advancing and ${n(i.breadth.decliners)} declining`);
  }
  if (i.vix != null) tail.push(`the VIX at ${i.vix.toFixed(2)}`);
  // "with A and B" reads cleanly for two facts; breadth is itself an "X and Y"
  // clause, so a third fact is set off with a comma instead of a second "and".
  const withTail = tail.length === 0 ? "" : tail.length === 1 ? `, with ${tail[0]}` : `, with ${tail[0]}, and ${tail[1]}`;
  return `${lead}: ${moves}${withTail}.`;
}

export interface WmnQuote extends ExtendedQuote {
  /** Company name, when the quote carries one. */
  name?: string | null;
  pctChange: number | null;
  /** The move of the latest COMPLETED regular session; null while one is running. */
  lastSessionPct?: number | null;
}

/**
 * The move to attribute to a stock: the live day move while the session runs, the
 * last completed session's move otherwise. Outside the session `pctChange` is a
 * pre-market print against the close (0.00 for most names), which would draw an
 * empty chart on exactly the evenings and mornings people open the page.
 */
export function sessionMove(q: WmnQuote | undefined): number | null {
  if (!q) return null;
  const m = q.marketStatus === "open" ? q.pctChange : (q.lastSessionPct ?? q.pctChange);
  return m != null && Number.isFinite(m) ? m : null;
}

/** Fewer quoted names than this and the chart would rank a partial list. */
const MIN_QUOTED = 25;
/** Fewer names that actually moved than this is a flat or empty tape, not a session. */
const MIN_MOVED = 10;

/**
 * Who moved the S&P 500: each heavy name's cap weight × its move, ranked by size
 * whichever way it pushed. Null (no chart) when too few names have a quote or the
 * tape is flat, rather than five zero-length bars.
 */
export function contributorsFromQuotes(
  weights: WmnWeight[],
  quotes: ReadonlyMap<string, WmnQuote>,
  n = 5,
): WmnContributor[] | null {
  const rows: WmnContributor[] = [];
  for (const w of weights) {
    const m = sessionMove(quotes.get(w.ticker));
    if (m == null) continue;
    rows.push({
      ticker: w.ticker,
      name: w.name,
      changePct: Math.round(m * 100) / 100,
      weightPct: w.weightPct,
      contributionPct: Math.round(((w.weightPct * m) / 100) * 1000) / 1000,
    });
  }
  if (rows.length < MIN_QUOTED) return null;
  if (rows.filter((r) => Math.abs(r.changePct) >= 0.005).length < MIN_MOVED) return null;
  return rows.sort((a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct)).slice(0, n);
}

/**
 * Bar geometry for the contributors chart: each bar's share (0-100) of the
 * HALF-width, scaled to the biggest contribution, so the longest bar fills its
 * side and the rest are honest fractions of it.
 */
export function contributorBars(rows: WmnContributor[]): Array<WmnContributor & { widthPct: number }> {
  const max = Math.max(0, ...rows.map((r) => Math.abs(r.contributionPct)));
  return rows.map((r) => ({
    ...r,
    widthPct: max === 0 ? 0 : Math.max(4, Math.round((Math.abs(r.contributionPct) / max) * 100)),
  }));
}

/** "+0.14" / "-0.09" in percentage points. */
export function signedPoints(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (r === 0) return "0.00";
  return `${r > 0 ? "+" : "-"}${Math.abs(r).toFixed(2)}`;
}

// ───────────────────────────── Slide 2 ─────────────────────────────

export interface Countdown {
  text: string;
  /** "due" = the scheduled time has passed but nothing has printed yet. */
  state: "upcoming" | "due";
}

/** "in 2h 15m", "in 40m", "due now". Under a minute out reads "in <1m". */
export function countdown(targetIso: string, now: Date): Countdown {
  const ms = Date.parse(targetIso) - now.getTime();
  if (!Number.isFinite(ms)) return { text: "", state: "upcoming" };
  if (ms <= 0) return { text: "due now", state: "due" };
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return { text: "in <1m", state: "upcoming" };
  if (mins < 60) return { text: `in ${mins}m`, state: "upcoming" };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { text: m ? `in ${h}h ${m}m` : `in ${h}h`, state: "upcoming" };
}

/** "8:30 AM ET" for a UTC ISO time. */
export function etClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }).format(d) + " ET"
  );
}

/** "Today" / "Tomorrow" / "Fri, Nov 27" for a New York calendar day. */
export function dayLabel(day: string, now: Date): string {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  if (day === key(now)) return "Today";
  if (day === key(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}

/** A macro figure with its unit: 3.4 + "%" → "3.4%", 225 + "K" → "225K". */
export function figure(v: number | null, unit: string | null): string {
  if (v == null) return "—";
  const n = Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : String(Math.round(v * 1000) / 1000);
  if (!unit) return n;
  return /^[%KMBT]$/i.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}

export function versusLabel(v: WmnVersus): string {
  return v === "above" ? "Above forecast" : v === "below" ? "Below forecast" : "In line with forecast";
}

export function catalystSummary(items: WmnCatalyst[]): string {
  if (items.length === 0) return "No major economic releases are scheduled in the next 24 hours.";
  const out = items.filter((c) => c.status === "released").length;
  const next = items.length - out;
  if (next === 0) return `${out} major release${out === 1 ? "" : "s"} printed in the last few hours.`;
  return `${next} major release${next === 1 ? "" : "s"} ahead in the next 24 hours${out ? `, ${out} already out` : ""}.`;
}

// ───────────────────────────── Slide 3 ─────────────────────────────

/** "$2.40" and "-$4.48": the minus sign goes in front of the dollar sign, never between it and the number. */
const dollars = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

function money(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return `${sign}$${a.toLocaleString("en-US")}`;
}

const surprise = (s: number | null) => (s == null ? "" : ` (${s > 0 ? "+" : ""}${s.toFixed(1)}%)`);

export function epsLine(it: WmnEarningsItem): string {
  const { actual, estimate, surprisePct } = it.eps;
  if (actual != null && estimate != null) return `EPS ${dollars(actual)} vs ${dollars(estimate)} est.${surprise(surprisePct)}`;
  if (actual != null) return `EPS ${dollars(actual)}`;
  if (estimate != null) return `EPS est. ${dollars(estimate)}`;
  return "EPS estimate not available";
}

export function revenueLine(it: WmnEarningsItem): string | null {
  const { actual, estimate, surprisePct } = it.revenue;
  if (actual != null && estimate != null) return `Revenue ${money(actual)} vs ${money(estimate)} est.${surprise(surprisePct)}`;
  if (actual != null) return `Revenue ${money(actual)}`;
  if (estimate != null) return `Revenue est. ${money(estimate)}`;
  return null;
}

export function guidanceLabel(g: WmnEarningsItem["guidance"]): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!g) return null;
  switch (g.direction) {
    case "raised":
      return { text: "Guidance raised ↑", tone: "up" };
    case "cut":
      return { text: "Guidance cut ↓", tone: "down" };
    case "mixed":
      return { text: "Guidance mixed", tone: "flat" };
    case "reaffirmed":
      return { text: "Guidance reaffirmed →", tone: "flat" };
    default:
      return g.range ? { text: `Guidance: ${g.range}`, tone: "flat" } : null;
  }
}

export function sessionLabel(s: WmnEarningsItem["session"]): string | null {
  return s === "BMO" ? "Before the open" : s === "AMC" ? "After the close" : s === "Intraday" ? "During the session" : null;
}

export interface ExtendedQuote {
  price: number | null;
  /** Latest regular-session (16:00 ET) close. */
  regularClose: number | null;
  /** The vendor's session state, verbatim ("open", "early_trading", "late_trading", "closed"). */
  marketStatus: string | null;
}

/**
 * The move since the regular close, when the latest trade is an extended-hours
 * one. Off-hours the quote's `price` IS the last extended-hours trade (see
 * LiveQuote.regularClose), so the two differ by exactly that move.
 *
 * This, and not the 8-K `reactionPct`, is the after-hours reaction: for an
 * after-close reporter `reactionPct` is the NEXT regular session's move and is
 * empty until that session ends. Null while the market is open, without both
 * numbers, or when nothing has traded away from the close.
 */
export function extendedMove(
  q: ExtendedQuote | null | undefined,
): { pct: number; label: "After hours" | "Pre-market" | "Extended hours" } | null {
  if (!q || q.marketStatus === "open" || q.marketStatus == null) return null;
  if (q.price == null || q.regularClose == null || q.regularClose <= 0) return null;
  const pct = ((q.price - q.regularClose) / q.regularClose) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.005) return null;
  const label = q.marketStatus === "late_trading" ? "After hours" : q.marketStatus === "early_trading" ? "Pre-market" : "Extended hours";
  return { pct, label };
}

/**
 * The line over the cards. There is no size floor on who is shown (owner
 * decision, 27 Nov 2026), so it says "biggest", never "notable" or "important".
 */
export function earningsSummary(count: number, shown: number): string {
  if (count > shown) return `The ${shown} biggest of ${count} reports today, by market cap.`;
  if (count === 1) return "One company reports today.";
  return `The ${count} companies reporting today, by market cap.`;
}

// ───────────────────────────── Slide 6 ─────────────────────────────

/**
 * Said on the slide and in the archive. Stock in Focus is the desk pointing at a
 * company it thinks is worth a look, which is exactly the thing the footer says we
 * do not do as a service: it must never read as a pick or a call to act.
 */
export const STOCK_IN_FOCUS_NOTE = "MarketCatalyst editorial. Not a recommendation or investment advice.";

/** "Today" / "Thu, Nov 26", with the year once it is not this year's. A New York calendar day in, a label out. */
export function focusDayLabel(day: string, now: Date): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
  if (day === today) return "Today";
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(`${day}T12:00:00Z`));
}

/** "$123.45" for a live price, or null without one. */
export function focusPrice(q: Pick<WmnQuote, "price"> | undefined): string | null {
  return q?.price != null && Number.isFinite(q.price)
    ? `$${q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
}

/** Newest day first, whatever order the entries arrive in. */
export function archiveOrder(entries: WmnStockInFocus[]): WmnStockInFocus[] {
  return [...entries].sort((a, b) => b.day.localeCompare(a.day));
}

// ───────────────────────────── Slide 5 ─────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Since Wed: 12 upgrades, 7 downgrades and 5 initiations; 30 price-target raises and 8 cuts." */
export function analystLead(a: WmnAnalysts): string {
  const since = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${a.since}T12:00:00Z`));
  const ratings: string[] = [];
  if (a.upgrades) ratings.push(plural(a.upgrades, "upgrade"));
  if (a.downgrades) ratings.push(plural(a.downgrades, "downgrade"));
  if (a.initiations) ratings.push(plural(a.initiations, "initiation"));
  const targets: string[] = [];
  if (a.ptRaises) targets.push(plural(a.ptRaises, "price-target raise"));
  if (a.ptCuts) targets.push(plural(a.ptCuts, "cut"));
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);
  const bits: string[] = [];
  if (ratings.length) bits.push(list(ratings));
  if (targets.length) bits.push(list(targets));
  return bits.length ? `Since ${since}: ${bits.join("; ")}.` : "No analyst rating changes or target moves since the last session.";
}

export function analystRowText(r: WmnAnalystRow): string {
  const verb = r.action === "upgrade" ? "upgraded" : r.action === "downgrade" ? "downgraded" : "initiated coverage of";
  const grade = r.newGrade ? (r.action === "initiate" ? ` at ${r.newGrade}` : ` to ${r.newGrade}`) : "";
  const from = r.previousGrade && r.action !== "initiate" ? ` (from ${r.previousGrade})` : "";
  const pt = r.priceTarget != null ? `, target $${r.priceTarget.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "";
  return `${r.firm ?? "A firm"} ${verb} ${r.ticker}${grade}${from}${pt}`;
}
