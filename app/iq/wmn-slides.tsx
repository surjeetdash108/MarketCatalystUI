/**
 * "What Matters Now": assembles the carousel's slides from the backend response
 * and the live tape. One function, no hooks and no fetching, so the dashboard
 * stays a thin caller and the "which slide shows when" rules live in one place.
 *
 * Slide order follows the owner's spec:
 *   1 Market direction · 2 Catalysts & macro · 3 Earnings in focus (only when
 *   someone reports; no size floor) · 4 Breaking news · 5 What analysts are watching
 *   · 6 Stock in Focus (only once the desk has posted one).
 */
import type { ReactNode } from "react";
import { getMarketStatus, type MarketPhase } from "./market-status";
import type { WmnSlide, WmnStat } from "./wmn-carousel";
import {
  analystLead,
  breadthForSession,
  catalystSummary,
  contributorsFromQuotes,
  earningsSummary,
  extendedMove,
  focusDayLabel,
  focusPrice,
  marketHeadline,
  moveTone,
  sessionMove,
  STOCK_IN_FOCUS_NOTE,
  type WmnQuote,
} from "./wmn-model";
import { AnalystRows, CatalystList, ContributorBars, EarningsCards, FocusTicker } from "./wmn-visuals";
import type { WmnResponse } from "./types/wmn";
import { sign } from "./utils";

/** A live index row from the tape, reduced to what these slides read. */
export interface WmnIndexRow {
  value: number;
  /** % move. */
  pct: number;
  prevClose: number | null;
  /** True when the row is an ETF stand-in, whose price is not the index level. */
  isProxy: boolean;
}

export interface WmnBuildInput {
  wmn: WmnResponse | null | undefined;
  /** Live tape rows by id: SPX, NDX, DJI, RUT, VIX, US10Y, DXY. */
  indices: ReadonlyMap<string, WmnIndexRow>;
  fearGreed: { value: number; label: string | null } | null;
  phase: MarketPhase;
  now: Date;
  /** Live quotes: each heavy S&P name's move (Slide 1) and an after-hours reaction (Slide 3). */
  quotes: ReadonlyMap<string, WmnQuote>;
  onTicker?: (ticker: string) => void;
  /** Opens the Stock in Focus archive (rendered by the caller, outside the carousel). */
  onOpenArchive?: () => void;
}

/** "Thu, Nov 26, 2026 · 11:00 PM ET" */
export function wmnStamp(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return (
    d
      .toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      .replace(/, (\d{1,2}:\d{2})/, " · $1") + " ET"
  );
}

function directionSlide(i: WmnBuildInput): WmnSlide | null {
  const spx = i.indices.get("SPX");
  if (!spx) return null; // a market headline needs the market's own number
  const ndx = i.indices.get("NDX");
  const dji = i.indices.get("DJI");
  const rut = i.indices.get("RUT");
  const vix = i.indices.get("VIX");
  const us10y = i.indices.get("US10Y");
  const dxy = i.indices.get("DXY");
  const breadth = breadthForSession(i.wmn?.slides?.breadth, i.now);
  const weights = i.wmn?.slides?.weights ?? null;
  const contributors = weights ? contributorsFromQuotes(weights, i.quotes) : null;
  // A proxy row's value is a fund or ETN price, not the VIX; only its move is real.
  const vixLevel = vix && !vix.isProxy ? vix.value : null;

  const lead =
    marketHeadline({
      phase: i.phase,
      spx: spx.pct,
      ndx: ndx?.pct ?? null,
      vix: vixLevel,
      breadth: breadth
        ? { advancers: breadth.advancers, decliners: breadth.decliners, total: breadth.advancers + breadth.decliners + breadth.unchanged }
        : null,
    }) ?? "";

  const spxTone = moveTone(spx.pct);
  const stats: WmnStat[] = [{ label: "S&P 500", value: sign(spx.pct), tone: spxTone }];
  if (ndx) stats.push({ label: "Nasdaq", value: sign(ndx.pct), tone: moveTone(ndx.pct) });
  if (dji) stats.push({ label: "Dow", value: sign(dji.pct), tone: moveTone(dji.pct) });
  if (rut) stats.push({ label: "Russell 2000", value: sign(rut.pct), tone: moveTone(rut.pct) });
  if (us10y) {
    // The yield is a level, in percent; its move reads in basis points (0.03 pts = 3 bp).
    const bp = us10y.prevClose != null ? Math.round((us10y.value - us10y.prevClose) * 100) : null;
    stats.push({
      label: "10-yr yield",
      value: `${us10y.value.toFixed(2)}%${bp != null && bp !== 0 ? ` (${bp > 0 ? "+" : ""}${bp} bp)` : ""}`,
    });
  }
  if (dxy) stats.push({ label: "Dollar", value: sign(dxy.pct), tone: moveTone(dxy.pct) });
  if (vix) {
    stats.push({
      label: "VIX",
      value: vixLevel != null ? `${vixLevel.toFixed(2)} (${sign(vix.pct)})` : sign(vix.pct),
      tone: moveTone(vix.pct),
    });
  }
  if (i.fearGreed) {
    stats.push({ label: "Fear & Greed", value: `${Math.round(i.fearGreed.value)}${i.fearGreed.label ? ` · ${i.fearGreed.label}` : ""}` });
  }
  if (breadth && breadth.advancers + breadth.decliners > 0) {
    stats.push({
      label: "Breadth",
      value: `${breadth.advancers.toLocaleString("en-US")} up / ${breadth.decliners.toLocaleString("en-US")} down`,
      tone: breadth.advancers > breadth.decliners ? "up" : breadth.advancers < breadth.decliners ? "down" : "flat",
    });
  }

  const visual: ReactNode =
    contributors && contributors.length > 0 ? <ContributorBars rows={contributors} onTicker={i.onTicker} /> : undefined;

  return {
    key: "direction",
    tag: "MARKET DIRECTION",
    tone: spxTone === "flat" ? "warn" : spxTone,
    name: "Indices, sentiment & VIX",
    when: getMarketStatus(i.now).label,
    lead,
    stats,
    visual,
    split: true,
    cta: { label: "Read the full recap", href: "/menu/recap" },
  };
}

export function buildWmnSlides(i: WmnBuildInput): WmnSlide[] {
  const out: WmnSlide[] = [];
  const data = i.wmn?.slides ?? null;

  const direction = directionSlide(i);
  if (direction) out.push(direction);

  // 2 · Catalysts & macro. Shown whenever the data-backed payload exists: an
  // empty next 24 hours is itself the answer ("nothing scheduled"), not a reason
  // to drop the slide. When the payload failed to build there is nothing to say.
  if (data) {
    out.push({
      key: "catalysts",
      tag: "CATALYSTS & MACRO",
      tone: "warn",
      name: "Next 24 hours",
      lead: catalystSummary(data.catalysts),
      visual: data.catalysts.length > 0 ? <CatalystList items={data.catalysts} /> : undefined,
      cta: { label: "Open the Calendar", href: "/menu/macro" },
    });
  }

  // 3 · Earnings in focus: dropped entirely when nobody reports. No size floor.
  if (data?.earnings && data.earnings.items.length > 0) {
    const cards = data.earnings.items.map((item) => ({
      item,
      extended: extendedMove(i.quotes.get(item.ticker)),
    }));
    out.push({
      key: "earnings",
      tag: "EARNINGS IN FOCUS",
      tone: "info",
      name: "Biggest reports today",
      lead: earningsSummary(data.earnings.total, data.earnings.items.length),
      visual: <EarningsCards cards={cards} onTicker={i.onTicker} />,
      cta: { label: "Open the Earnings Hub", href: "/menu/earnings" },
    });
  }

  // 4 · Breaking news: the hourly digest (news, our analyses, Pulse, Live Feed).
  if (i.wmn?.summary) {
    out.push({
      key: "breaking",
      tag: "BREAKING NEWS",
      tone: "brand",
      name: "MarketCatalyst AI",
      when: wmnStamp(i.wmn.generatedAt),
      lead: i.wmn.summary,
      body: i.wmn.overallAssessment,
      points: (i.wmn.keyDevelopments ?? []).slice(0, 3),
      cta: { label: "See the Live Feed", href: "/menu/commentary" },
    });
  }

  // 5 · What analysts are watching. A quiet window is stated, not hidden.
  if (data) {
    const a = data.analysts;
    out.push({
      key: "analysts",
      tag: "ANALYSTS",
      tone: "info",
      name: "What analysts are watching",
      lead: a ? analystLead(a) : "No analyst rating changes or target moves since the last session.",
      visual: a && a.rows.length > 0 ? <AnalystRows rows={a.rows} /> : undefined,
      cta: { label: "Get more details", href: "/menu/analyst" },
    });
  }

  // 6 · Stock in Focus: the desk's newest note, with the company's live price.
  // Hidden until the desk has posted one. Editorial, not a pick, and says so.
  const focus = data?.stockInFocus ?? null;
  if (focus) {
    const q = i.quotes.get(focus.ticker);
    out.push({
      key: "focus",
      tag: "STOCK IN FOCUS",
      tone: "brand",
      name: "From the desk",
      when: focusDayLabel(focus.day, i.now),
      lead: focus.headline,
      visual: (
        <FocusTicker
          ticker={focus.ticker}
          name={q?.name ?? null}
          price={focusPrice(q)}
          pct={q ? sessionMove(q) : null}
          onTicker={i.onTicker}
        />
      ),
      body: focus.note || undefined,
      foot: STOCK_IN_FOCUS_NOTE,
      cta: i.onOpenArchive ? { label: "Browse the archive", onClick: i.onOpenArchive } : undefined,
    });
  }

  return out;
}
