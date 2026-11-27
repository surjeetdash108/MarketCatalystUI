import { fiscalLabel, type ChartQuarter, type GrowthPoint } from "./overview-charts";
import { sentenceCase, topTargets, type Dir, type FundamentalOutlook, type FundamentalRead, type Read, type ReadFacts } from "./si-reads";

/**
 * The Overview's Fundamentals pane from the new design (pltr-fundamentals.html): a pill and one headline over a
 * 2 x 2 grid of tiles, Growth, Margins, Earnings and Valuation. This file turns the stock's real facts, reads and
 * quarter series into exactly what those tiles draw (fundamentals-pane.tsx only paints it). A figure the data
 * does not have is left out of its tile, never filled in; a tile whose read has no data is left out of the grid.
 */

/** hi = plain text, mid = muted, blue = the EPS colour, warn = amber. */
export type FxTone = "up" | "dn" | "hi" | "mid" | "blue" | "warn";
export type FxStatus = { text: string; tone: FxTone };
export type FxChip = { label: string; value: string; tone: FxTone };
/** A run of text in a sub-line; `strong` ones are the figures. */
export type FxSeg = { t: string; strong?: boolean; tone?: FxTone };

export type FxBar = {
  /** The label under the bar ("Q3'26"). */
  x: string;
  /** The label over it ("96%", "n/a"). */
  text: string;
  /** Signed height in px; 0 draws the 2px stub of a missing quarter. */
  h: number;
  tone: "up" | "blue" | "dn" | "none";
  latest: boolean;
};
export type FxMini = { bars: FxBar[]; ariaLabel: string };

export type FxStatTile = {
  kind: "growth" | "earnings" | "analysts";
  title: string;
  status: FxStatus;
  caption: string;
  /** The quarter or moment the caption is about, in the brighter colour. */
  period: string;
  big: { text: string; tone: FxTone };
  /** The amber "Slowing" mark next to the big figure. */
  badge: FxStatus | null;
  chips: FxChip[];
  mini: FxMini | null;
  note: string | null;
};

export type FxMarginRow = {
  name: string;
  text: string;
  tone: FxTone;
  /** Bar length in percent of the track (0-100). */
  width: number;
  fill: "up" | "blue" | "dn";
  /** The white peers tick, in percent of the track; only when the peers' margin fits the 0-100 scale. */
  tick: { at: number; label: string } | null;
  sub: FxSeg[];
};
export type FxMarginsTile = { kind: "margins"; title: string; status: FxStatus; rows: FxMarginRow[] };

/** `at` is where the dot sits, `labelAt` where its label is centred (both in percent of the line); `above` puts the label over the line. */
export type FxMarker = { key: "peers" | "fwd" | "now"; name: string; text: string; at: number; labelAt: number; tone: FxTone; above: boolean };
/** Least distance between the two labels under the line, and how close to either end a label may be centred (percent of the line). */
const LABEL_GAP = 20;
const LABEL_EDGE = 11;
export type FxPeLine = {
  max: number;
  mid: number;
  markers: FxMarker[];
  /** The gradient between the outermost markers: `r` = grey to colour (the price is the right end), `l` = colour to grey. */
  seg: { from: number; to: number; side: "r" | "l"; tone: "up" | "dn" | "hi" } | null;
  ariaLabel: string;
};
export type FxValuationTile = {
  kind: "valuation";
  title: string;
  status: FxStatus;
  caption: string;
  period: string;
  big: { text: string; tone: FxTone };
  badge: FxStatus | null;
  chips: FxChip[];
  line: FxPeLine | null;
  note: string | null;
};

export type FxTile = FxStatTile | FxMarginsTile | FxValuationTile;
export type FundamentalsPaneModel = { pill: FxStatus; lead: string; tiles: FxTile[] };

export type FundamentalsInput = {
  ticker: string;
  facts: ReadFacts;
  forwardPe: number | null | undefined;
  fund: FundamentalRead;
  /** Revenue and EPS growth over the last four quarters, oldest first. */
  revenue: ReadonlyArray<GrowthPoint>;
  eps: ReadonlyArray<GrowthPoint>;
  /** The four latest reported quarters, newest first. */
  quarters: ReadonlyArray<ChartQuarter>;
};

// -------------------------------------------------------------------------------------------------- formatting

const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const MINUS = "−";
const sign = (v: number) => (v < 0 ? MINUS : "+");
/** "+96%" / "+7.2%": whole numbers from 10 up, one decimal below. */
export const bigPct = (v: number) => `${sign(v)}${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`;
/** "+1.0%", "+85.9%", "−2.9%": one decimal, whole numbers from 100 up ("+306%"). */
export const chipPct = (v: number) => `${sign(v)}${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`;
/** "70%", "−5.2%": the label over a bar. */
export const barPct = (v: number) => `${v < 0 ? MINUS : ""}${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`;
/** "46.9%", "−12.3%". */
export const level = (v: number) => `${v < 0 ? MINUS : ""}${Math.abs(v).toFixed(1)}%`;
export const times = (v: number) => `${v.toFixed(1)}×`;
const dollars = (v: number) => `${v < 0 ? MINUS : ""}$${Math.abs(v).toFixed(2)}`;
const upper = (s: string) => s.toUpperCase();

const dirTone = (d: Dir): FxTone => (d === "up" ? "up" : d === "down" ? "dn" : "mid");
const dirGlyph = (d: Dir) => (d === "up" ? "▲" : d === "down" ? "▼" : "▬");
const statusOf = (r: Read): FxStatus => ({ text: `${r.caution ? "◆" : dirGlyph(r.dir)} ${r.headline}`, tone: r.caution ? "warn" : dirTone(r.dir) });
const negTone = (v: number): FxTone => (v < 0 ? "dn" : "hi");

/** "Q3'26" -> "Q3 FY26"; the label the new design puts after "y/y". */
const periodOf = (label: string | undefined, fallback: string) => (label ? fiscalLabel(label) : fallback);

// ------------------------------------------------------------------------------------------------ the headline

/** The pane's headline, from the same call `fundamentalRead` makes, worded as the design has it and naming the stock. */
export function fundamentalLead(ticker: string, outlook: FundamentalOutlook): string {
  switch (outlook) {
    case "strong-rich":
      return `Strong business, but the price already reflects it. ${ticker} has to keep beating to hold this multiple.`;
    case "strong":
      return "Strong business, and the price isn’t stretched against it.";
    case "rich":
      return `Expensive without growth to back it. ${ticker} is vulnerable to any miss.`;
    case "weakening":
      return "Fundamentals are weakening. Earnings need to turn before the story improves.";
    case "mixed":
      return "Mixed picture. No strong fundamental push either way.";
    default:
      return "Quarterly fundamentals aren’t synced for this stock yet.";
  }
}

// ----------------------------------------------------------------------------------------------- mini charts

/** The tallest bar, in px; the value labels sit over it inside the 76px plot. */
const BAR_MAX = 60;
const slowing = (latest: number | null | undefined, previous: number | null | undefined): FxStatus | null =>
  has(latest) && has(previous) && latest < previous - 1 ? { text: "▼ Slowing", tone: "warn" } : null;

function barsOf(points: ReadonlyArray<GrowthPoint>, tone: "up" | "blue"): FxBar[] {
  const present = points.map((p) => p.yoy).filter(has);
  const scale = BAR_MAX / Math.max(1e-9, ...present.map((v) => Math.abs(v)));
  return points.map((p, i) => ({
    x: p.label,
    text: has(p.yoy) ? barPct(p.yoy) : "n/a",
    h: has(p.yoy) ? Math.sign(p.yoy || 1) * Math.max(3, Math.abs(p.yoy) * scale) : 0,
    tone: !has(p.yoy) ? "none" : p.yoy < 0 ? "dn" : tone,
    latest: i === points.length - 1,
  }));
}

const hasSeries = (points: ReadonlyArray<GrowthPoint>) => points.some((p) => has(p.yoy));

// ------------------------------------------------------------------------------------------------------ tiles

function growthTile(read: Read, input: FundamentalsInput): FxStatTile {
  const f = input.facts;
  const pts = input.revenue;
  const last = pts[pts.length - 1];
  const latest = has(last?.yoy) ? last.yoy : has(f.revGrowthYoY) ? f.revGrowthYoY : null;
  const chips: FxChip[] = [];
  if (has(f.peerRevGrowth4q)) chips.push({ label: "PEERS AVG", value: chipPct(f.peerRevGrowth4q), tone: negTone(f.peerRevGrowth4q) });
  if (has(f.revGrowth4q)) chips.push({ label: `${upper(input.ticker)} 4Q AVG`, value: chipPct(f.revGrowth4q), tone: negTone(f.revGrowth4q) });
  return {
    kind: "growth",
    title: "GROWTH",
    status: statusOf(read),
    caption: "Revenue growth y/y",
    period: periodOf(last?.label, "latest quarter"),
    big: { text: latest == null ? "n/a" : bigPct(latest), tone: latest == null ? "mid" : latest < 0 ? "dn" : "up" },
    badge: slowing(latest, pts[pts.length - 2]?.yoy),
    chips,
    mini: hasSeries(pts) ? { bars: barsOf(pts, "up"), ariaLabel: "Revenue growth year over year, last four quarters" } : null,
    note: null,
  };
}

function earningsTile(read: Read, input: FundamentalsInput): FxStatTile {
  const f = input.facts;
  const pts = input.eps;
  if (hasSeries(pts)) {
    const last = pts[pts.length - 1];
    const latest = has(last?.yoy) ? last.yoy : null;
    const chips: FxChip[] = [];
    if (has(f.peerEpsGrowth4q)) chips.push({ label: "PEERS AVG", value: chipPct(f.peerEpsGrowth4q), tone: negTone(f.peerEpsGrowth4q) });
    // The best quarter of the four, unless it is the latest one (then the four-quarter average says more).
    const peak = pts.reduce<GrowthPoint | null>((best, p) => (has(p.yoy) && (!best || p.yoy > (best.yoy as number)) ? p : best), null);
    if (peak && peak !== last && has(peak.yoy)) chips.push({ label: `PEAK · ${peak.label}`, value: chipPct(peak.yoy), tone: negTone(peak.yoy) });
    else if (has(f.epsGrowth4q)) chips.push({ label: `${upper(input.ticker)} 4Q AVG`, value: chipPct(f.epsGrowth4q), tone: negTone(f.epsGrowth4q) });
    return {
      kind: "earnings",
      title: "EARNINGS",
      status: statusOf(read),
      caption: "EPS growth y/y",
      period: periodOf(last?.label, "latest quarter"),
      big: { text: latest == null ? "n/a" : bigPct(latest), tone: latest == null ? "mid" : latest < 0 ? "dn" : "blue" },
      badge: slowing(latest, pts[pts.length - 2]?.yoy),
      chips,
      mini: { bars: barsOf(pts, "blue"), ariaLabel: "EPS growth year over year, last four quarters" },
      note: null,
    };
  }

  // No year-over-year EPS to show (no year-ago quarter, or a base too close to zero): the beat record and the EPS itself.
  const reported = [...input.quarters].reverse().filter((q) => has(q.epsActualReported) && has(q.epsEstimateReported));
  const beats = f.epsBeats ?? 0;
  const reports = f.epsReports ?? 0;
  const rate = reports ? beats / reports : 0;
  const chips: FxChip[] = [];
  if (has(f.fwdEps) && has(f.nextFyEps) && f.fwdEps > 0) {
    const g = (f.nextFyEps / f.fwdEps - 1) * 100;
    chips.push({ label: "NEXT FY EST.", value: bigPct(g), tone: negTone(g) });
  }
  const top = Math.max(1e-9, ...reported.map((q) => Math.abs(q.epsActualReported as number)));
  return {
    kind: "earnings",
    title: "EARNINGS",
    status: statusOf(read),
    caption: "Quarters that beat estimates",
    period: `last ${reports}`,
    big: { text: `${beats} of ${reports}`, tone: rate >= 0.75 ? "up" : rate >= 0.5 ? "warn" : "dn" },
    badge: null,
    chips,
    mini:
      reported.length >= 2
        ? {
            ariaLabel: "EPS reported in the last quarters, green where it beat the estimate",
            bars: reported.map((q, i) => {
              const actual = q.epsActualReported as number;
              return {
                x: `${q.fiscalPeriod ?? ""}'${String(q.fiscalYear ?? "").slice(-2)}`,
                text: dollars(actual),
                h: Math.sign(actual || 1) * Math.max(3, (Math.abs(actual) / top) * BAR_MAX),
                tone: actual >= (q.epsEstimateReported as number) ? "up" : "dn",
                latest: i === reported.length - 1,
              };
            }),
          }
        : null,
    note: null,
  };
}

const quarterName = (q: ChartQuarter) => `${q.fiscalPeriod ?? ""} FY${String(q.fiscalYear ?? "").slice(-2)}`;

function marginsTile(read: Read, input: FundamentalsInput): FxMarginsTile {
  const f = input.facts;
  const oldestFirst = [...input.quarters].reverse();
  const grossByQuarter = oldestFirst
    .map((q) => ({ q, v: q.revenue && has(q.grossProfit) ? ((q.grossProfit as number) / q.revenue) * 100 : null }))
    .filter((x): x is { q: ChartQuarter; v: number } => x.v != null);

  /** The peers' margin: a tick on the bar when it fits the 0-100 scale, otherwise a figure in the sub-line. */
  const peerParts = (peer: number | null | undefined): { tick: FxMarginRow["tick"]; seg: FxSeg[] } => {
    if (!has(peer)) return { tick: null, seg: [] };
    if (peer > 0 && peer <= 100) return { tick: { at: peer, label: `Peers ${level(peer)}` }, seg: [{ t: "white tick = peers " }, { t: level(peer), strong: true, tone: "hi" }] };
    return { tick: null, seg: [{ t: "peers " }, { t: level(peer), strong: true, tone: negTone(peer) }] };
  };
  const join = (...parts: FxSeg[][]): FxSeg[] =>
    parts.filter((p) => p.length).flatMap((p, i) => (i ? [{ t: " · " }, ...p] : p));

  const rows: FxMarginRow[] = [];
  if (has(f.opMargin)) {
    const ya = f.opMarginYearAgo;
    const moved = has(ya) ? f.opMargin - ya : null;
    const trend: FxSeg[] = !has(ya) ? [] : moved != null && Math.abs(moved) >= 0.5 ? [{ t: `${moved > 0 ? "Up" : "Down"} from ${level(ya)} a year ago` }] : [{ t: `Flat against ${level(ya)} a year ago` }];
    const peers = peerParts(f.peerOpMargin4q);
    rows.push({
      name: "Operating",
      text: level(f.opMargin),
      tone: f.opMargin < 0 ? "dn" : "hi",
      width: Math.max(0, Math.min(100, f.opMargin)),
      fill: f.opMargin < 0 ? "dn" : "up",
      tick: peers.tick,
      sub: join(trend, peers.seg),
    });
  }
  if (has(f.grossMargin)) {
    const values = grossByQuarter.map((x) => x.v);
    let trend: FxSeg[] = [];
    if (values.length >= 2) {
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      if (hi - lo <= 5) {
        const a = Math.round(lo);
        const b = Math.round(hi);
        trend = [{ t: a === b ? `Steady at ${a}%` : `Steady at ${a}–${b}%` }];
      } else {
        const first = grossByQuarter[0];
        trend = [{ t: `${f.grossMargin > first.v ? "Up" : "Down"} from ${level(first.v)} in ${quarterName(first.q)}` }];
      }
    }
    const peers = peerParts(f.peerGrossMargin4q);
    rows.push({
      name: "Gross",
      text: level(f.grossMargin),
      tone: f.grossMargin < 0 ? "dn" : "hi",
      width: Math.max(0, Math.min(100, f.grossMargin)),
      fill: f.grossMargin < 0 ? "dn" : "blue",
      tick: peers.tick,
      sub: join(trend, peers.seg),
    });
  }
  return { kind: "margins", title: "MARGINS", status: statusOf(read), rows };
}

/** A round axis end for the P/E line, so its middle tick is round too: 116.5 -> 120, 29.2 -> 40, 230 -> 300. */
export function niceMax(v: number): number {
  const step = v <= 200 ? 20 : 100;
  return Math.max(step, Math.ceil(v / step) * step);
}

function valuationTile(read: Read, input: FundamentalsInput): FxValuationTile {
  const f = input.facts;
  const trailing = has(f.trailingPe) && f.trailingPe > 0 ? f.trailingPe : null;
  const forward = has(input.forwardPe) && input.forwardPe > 0 ? input.forwardPe : null;
  const onTrailing = trailing != null;
  const now = (trailing ?? forward) as number;
  const peers = onTrailing ? ((f.peerPeCount ?? 0) >= 3 && has(f.peerPe) && f.peerPe > 0 ? f.peerPe : null) : (f.peerFwdPeCount ?? 0) >= 3 && has(f.peerFwdPe) && f.peerFwdPe > 0 ? f.peerFwdPe : null;
  const tone: FxTone = read.dir === "down" ? "dn" : read.dir === "up" ? "up" : "hi";
  const ratio = peers != null ? now / peers : null;

  const chips: FxChip[] = [];
  if (peers != null) chips.push({ label: "PEERS AVG", value: times(peers), tone: "hi" });
  if (onTrailing && forward != null) chips.push({ label: "FORWARD P/E", value: times(forward), tone: "warn" });

  const markers: FxMarker[] = [];
  const max = niceMax(Math.max(now, peers ?? 0, onTrailing ? (forward ?? 0) : 0));
  const at = (v: number) => (v / max) * 100;
  if (peers != null) markers.push({ key: "peers", name: "Peers", text: times(peers), at: at(peers), labelAt: at(peers), tone: "mid", above: false });
  if (onTrailing && forward != null) markers.push({ key: "fwd", name: "Fwd", text: times(forward), at: at(forward), labelAt: at(forward), tone: "warn", above: false });
  markers.push({ key: "now", name: "Now", text: times(now), at: at(now), labelAt: at(now), tone, above: true });
  const nowMark = markers[markers.length - 1];
  // The Peers and Forward labels share the row under the line. Close markers would print one over the other, so
  // their labels (not their dots) are moved apart, in the order of the dots, and kept inside the line.
  const fwd = markers.find((m) => m.key === "fwd");
  const peer = markers.find((m) => m.key === "peers");
  if (fwd && peer && Math.abs(fwd.at - peer.at) < LABEL_GAP) {
    const [left, right] = fwd.at >= peer.at ? [peer, fwd] : [fwd, peer];
    const mid = (left.at + right.at) / 2;
    const l = Math.max(LABEL_EDGE, Math.min(100 - LABEL_EDGE - LABEL_GAP, mid - LABEL_GAP / 2));
    left.labelAt = l;
    right.labelAt = l + LABEL_GAP;
  }

  const ends = markers.map((m) => m.at);
  const from = Math.min(...ends);
  const to = Math.max(...ends);
  const line: FxPeLine | null =
    markers.length >= 2
      ? {
          max,
          mid: max / 2,
          markers,
          seg: { from, to, side: nowMark.at >= to ? "r" : "l", tone: tone === "dn" ? "dn" : tone === "up" ? "up" : "hi" },
          ariaLabel: `P/E ${markers.map((m) => `${m.name} ${m.text}`).join(", ")}`,
        }
      : null;

  let note: string | null = null;
  if (onTrailing && forward != null) {
    const priced = (trailing / forward - 1) * 100;
    note = priced > 0 ? `Forward P/E implies about ${Math.round(priced)}% EPS growth is already priced in.` : "Forward P/E is above trailing, so earnings are expected to shrink.";
  }
  return {
    kind: "valuation",
    title: "VALUATION",
    status: statusOf(read),
    caption: onTrailing ? "Trailing P/E" : "Forward P/E",
    period: "today",
    big: { text: times(now), tone },
    badge: ratio == null ? null : { text: `${ratio.toFixed(1)}× peers`, tone: ratio > 1.25 ? "dn" : ratio < 0.8 ? "up" : "mid" },
    chips,
    line,
    note,
  };
}

/** With no P/E at all the fourth tile is the analysts' targets (the Analysts read stands in for Valuation). */
function analystsTile(read: Read, input: FundamentalsInput): FxStatTile {
  const f = input.facts;
  const top = topTargets(f.analystTargets);
  const target = top?.avg ?? (has(f.targetMean) ? f.targetMean : null);
  const chips: FxChip[] = [];
  if (target != null) chips.push({ label: top ? `TOP ${top.n} AVG TARGET` : "AVG TARGET", value: dollars(target), tone: "hi" });
  if (top) chips.push({ label: "MEDIAN", value: dollars(top.median), tone: "hi" });
  else if (f.consensus) chips.push({ label: "CONSENSUS", value: f.consensus, tone: "hi" });
  const upside = target != null && has(f.price) && f.price > 0 ? (target / f.price - 1) * 100 : null;
  return {
    kind: "analysts",
    title: "VALUATION",
    status: statusOf(read),
    caption: "Upside to the analysts’ average target",
    period: "",
    big: { text: upside == null ? "n/a" : bigPct(upside), tone: upside == null ? "mid" : upside < 0 ? "dn" : "up" },
    badge: null,
    chips,
    mini: null,
    note: "No P/E yet, so the analysts’ targets stand in for valuation.",
  };
}

// --------------------------------------------------------------------------------------------------- the pane

/** The whole pane; null when there is nothing to draw (the caller then shows the "not synced" line). */
export function fundamentalsPane(input: FundamentalsInput): FundamentalsPaneModel | null {
  const { fund, ticker } = input;
  if (!fund.reads.length) return null;
  const readOf = (k: string) => fund.reads.find((r) => r.k === k) ?? null;
  const growth = readOf("Growth");
  const margins = readOf("Margins");
  const earnings = readOf("Earnings");
  const valuation = readOf("Valuation");
  const analysts = readOf("Analysts");
  const tiles: FxTile[] = [];
  if (growth) tiles.push(growthTile(growth, input));
  if (margins) tiles.push(marginsTile(margins, input));
  if (earnings) tiles.push(earningsTile(earnings, input));
  if (valuation) tiles.push(valuationTile(valuation, input));
  else if (analysts) tiles.push(analystsTile(analysts, input));
  const v = fund.verdict;
  return {
    pill: { text: `Fundamentals · ${sentenceCase(v.label)}`, tone: dirTone(v.dir) },
    lead: fundamentalLead(ticker, fund.outlook),
    tiles,
  };
}
