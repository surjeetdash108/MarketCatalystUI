/**
 * Key moments — the sessions where a stock moved far more than it normally
 * does, each paired with the news that best explains it (Google Finance's
 * "Key moments", built only from data already on hand).
 *
 * DETECTION is relative to the stock's own volatility, not a fixed %: a 3% day
 * is routine for a small-cap biotech and a shock for a utility. A session
 * qualifies when its close-to-close move is at least Z_MIN standard deviations
 * of the previous VOL_WINDOW sessions' moves AND at least MIN_ABS_PCT in
 * absolute terms. Neighbouring qualifiers within SPACING sessions collapse to
 * the biggest, so a two-day sell-off reads as one moment, not two.
 *
 * EXPLANATION is the best-matching article from the ticker's news feed, never
 * an invented narrative. Articles count for a session from the previous
 * session's 16:00 ET close to the end of the session's own day (after-close
 * recaps — "why X fell today" — land in the evening). An article only counts as
 * an explanation when it names the company; otherwise the card says no
 * matching news is on file and falls back to the market context (S&P 500 same
 * session, volume), which is real and often the actual answer.
 */

import { useMemo } from "react";
import { etSessionDate, type OHLCBar } from "./indicators";
import { useBackendBars } from "./hooks/useBackendBars";
import type { NewsArticleDoc } from "./types";

const VOL_WINDOW = 20;
const VOL_MIN_SAMPLES = 10;
const Z_MIN = 2.2;
const MIN_ABS_PCT = 2;
const SPACING = 3;
const DEFAULT_MAX = 12;

export interface KeyMomentArticle {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string | null;
}

export interface KeyMoment {
  /** ET session date of the move, YYYY-MM-DD. */
  date: string;
  /** Close vs the prior session's close, %. */
  pct: number;
  /** Session volume vs the prior VOL_WINDOW sessions' average. */
  volRatio: number | null;
  /** S&P 500 (SPY) move the same session, %; null when not on hand. */
  marketPct: number | null;
  /** Headline of the explaining article, or a plain description of the move. */
  title: string;
  /** The explaining article's summary; null when no article explains it. */
  summary: string | null;
  /** True when `title` / `summary` come from an article naming the company. */
  explained: boolean;
  /** Reaction to an earnings report (that session, or the prior evening's). */
  earnings: boolean;
  /** Matching coverage, best first. */
  articles: KeyMomentArticle[];
  /** Oldest article on file — set when this moment predates the news feed. */
  newsSince: string | null;
}

/** "YYYY-MM-DD HH:MM" in New York — compares correctly as a string. */
function etStamp(ms: number): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${String(parseInt(p.hour, 10) % 24).padStart(2, "0")}:${p.minute}`;
}

/** "The Goldman Sachs Group, Inc." → ["goldman sachs", "goldman"]. */
function nameKeys(name: string | null | undefined): string[] {
  if (!name) return [];
  const core = name
    .replace(/^the\s+/i, "")
    .split(",")[0]
    .replace(/\b(incorporated|inc|corporation|corp|company|co|group|holdings?|ltd|limited|plc|n\.?v|s\.?a|class [a-c]|common stock|the)\b\.?/gi, "")
    .replace(/[.&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!core) return [];
  const first = core.split(" ")[0];
  return first.length >= 4 && first !== core ? [core, first] : [core];
}

const MOVE_WORDS = /\b(why|falls?|fell|drops?|dropped|plunges?|plunged|slides?|slid|sinks?|sank|tumbles?|tumbled|slumps?|jumps?|jumped|soars?|soared|surges?|surged|rall(?:y|ies|ied)|rises?|rose|gains?|climbs?|climbed|spikes?|skyrockets?|craters?|selloff|sell-off)\b/i;

function isSpaced(picked: number[], i: number) {
  return picked.every((p) => Math.abs(p - i) > SPACING);
}

/**
 * @param bars         daily bars for the ticker, oldest first
 * @param marketBars   daily SPY bars, for the same-session market move
 * @param news         the ticker's news feed
 * @param earningsDates ISO report dates (BMO reacts that session, AMC the next)
 */
export function buildKeyMoments({
  sym, name, bars, marketBars, news, earningsDates = [], max = DEFAULT_MAX,
}: {
  sym: string;
  name?: string | null;
  bars: OHLCBar[] | undefined;
  marketBars?: OHLCBar[] | undefined;
  news?: NewsArticleDoc[] | null;
  earningsDates?: string[];
  max?: number;
}): KeyMoment[] {
  if (!bars || bars.length < VOL_MIN_SAMPLES + 2) return [];
  const rets: number[] = bars.map((b, i) => (i > 0 && bars[i - 1].c > 0 ? (b.c / bars[i - 1].c - 1) * 100 : NaN));

  // ── detect ──
  const cands: Array<{ i: number; z: number }> = [];
  for (let i = 1; i < bars.length; i++) {
    const r = rets[i];
    if (!Number.isFinite(r) || Math.abs(r) < MIN_ABS_PCT) continue;
    const prior = rets.slice(Math.max(1, i - VOL_WINDOW), i).filter(Number.isFinite);
    if (prior.length < VOL_MIN_SAMPLES) continue;
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    const sd = Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / prior.length);
    const z = sd > 0 ? Math.abs(r) / sd : Infinity;
    if (z >= Z_MIN) cands.push({ i, z });
  }
  const picked: number[] = [];
  for (const c of [...cands].sort((a, b) => b.z - a.z)) {
    if (picked.length >= max) break;
    if (isSpaced(picked, c.i)) picked.push(c.i);
  }
  picked.sort((a, b) => a - b);

  // ── context ──
  const mktByDate = new Map<string, number>();
  if (marketBars) {
    for (let i = 1; i < marketBars.length; i++) {
      const p = marketBars[i - 1].c;
      if (p > 0) mktByDate.set(etSessionDate(marketBars[i].t), (marketBars[i].c / p - 1) * 100);
    }
  }
  const articles = (news ?? [])
    .filter((a) => !a.filler && a.headline && a.publishedAt)
    .map((a) => ({ a, at: etStamp(Date.parse(a.publishedAt)) }));
  const newsOldest = articles.reduce<string | null>((m, x) => (m == null || x.at < m ? x.at : m), null);
  const keys = [sym.toLowerCase(), ...nameKeys(name)];
  const symRe = new RegExp(`(^|[^a-z0-9])\\$?${sym.replace(/[^A-Za-z0-9]/g, "\\$&").toLowerCase()}([^a-z0-9]|$)`);
  const mentions = (txt: string) => {
    const t = txt.toLowerCase();
    return symRe.test(t) || keys.slice(1).some((k) => t.includes(k));
  };
  const erSet = new Set(earningsDates);

  return picked.map((i) => {
    const b = bars[i];
    const date = etSessionDate(b.t);
    const prevDate = etSessionDate(bars[i - 1].t);
    const pct = rets[i];
    const up = pct >= 0;

    const prior = bars.slice(Math.max(0, i - VOL_WINDOW), i).map((x) => x.v).filter((v) => v > 0);
    const avgV = prior.length ? prior.reduce((a, c) => a + c, 0) / prior.length : 0;
    const volRatio = avgV > 0 && b.v > 0 ? b.v / avgV : null;
    const marketPct = mktByDate.get(date) ?? null;
    const earnings = erSet.has(date) || erSet.has(prevDate);

    // Articles from the prior close to the end of this session's day.
    const from = `${prevDate} 16:00`, to = `${date} 23:59`;
    const ranked = articles
      .filter((x) => x.at > from && x.at <= to)
      .map(({ a }) => {
        const named = mentions(`${a.headline} ${a.summary ?? ""}`);
        const headNamed = mentions(a.headline);
        const sentimentFits = a.sentiment === (up ? "positive" : "negative");
        const score =
          (headNamed ? 4 : named ? 2 : 0) +
          (a.tag && a.tag !== "other" ? 2 : 0) +
          (MOVE_WORDS.test(a.headline) ? 1 : 0) +
          (sentimentFits ? 1 : 0) +
          (a.summary ? 0.5 : 0);
        return { a, named, headNamed, score };
      })
      .sort((p, q) => q.score - p.score);

    // The explanation is the best article whose HEADLINE names the company: a
    // market story that never mentions it — or one naming it only in passing
    // (an underwriter in someone else's IPO) — does not explain this move.
    // Passing mentions still appear in the source list.
    const named = ranked.filter((x) => x.named);
    const top = ranked.find((x) => x.headNamed);
    const explained = !!top;
    const abs = Math.abs(pct);
    const verb = up ? (abs >= 8 ? "soars" : "jumps") : (abs >= 8 ? "plunges" : "slides");
    const title = explained
      ? top.a.headline
      : `${earnings ? "Earnings reaction: " : ""}${sym} ${verb} ${abs.toFixed(1)}%`;

    return {
      date, pct, volRatio, marketPct, title, explained, earnings,
      summary: explained ? top.a.summary : null,
      // Only coverage that names the company — an unrelated market story
      // listed under the move would read as its cause.
      articles: named.slice(0, 5).map(({ a }) => ({
        headline: a.headline, source: a.source, url: a.url, publishedAt: a.publishedAt, summary: a.summary,
      })),
      newsSince: newsOldest && `${date} 23:59` < newsOldest ? newsOldest.slice(0, 10) : null,
    };
  });
}

/**
 * Key moments for a ticker's 1Y daily bars, with SPY fetched for the market
 * context. Memoised on its inputs (the earnings dates by value), so the chart
 * gets the SAME array across renders — an opened card is pinned to it.
 */
export function useKeyMoments(
  enabled: boolean,
  { sym, name, bars, news, earningsDates }: {
    sym: string;
    name?: string | null;
    bars: OHLCBar[] | undefined;
    news?: NewsArticleDoc[] | null;
    earningsDates: string[];
  },
): KeyMoment[] {
  const { bars: spy } = useBackendBars("SPY", "1Y", enabled);
  const erKey = earningsDates.join("|");
  return useMemo(
    () => (enabled
      ? buildKeyMoments({ sym, name, bars, marketBars: spy, news, earningsDates: erKey ? erKey.split("|") : [] })
      : []),
    [enabled, sym, name, bars, spy, news, erKey],
  );
}
