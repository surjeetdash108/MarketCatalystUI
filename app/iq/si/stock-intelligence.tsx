"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSI } from "./si-context";
import { barsForHorizon } from "./horizon-bars";
import { TrackedTradesList, type TrackedTrade } from "./tracked-trades-list";
import { addTrade, formatSavedAt, listAllTrades, readTrades, removeTrade, writeTrades, type SavedTrade } from "./saved-trades";
import { SITab, StockItem, DetailStock, UpcomingEvent } from "./types";
import {
  POPULAR,
  EMPTY_FACTS,
  type SiFacts,
  LG,
  LG_COL,
  ORDER,
  TABS,
  UP,
  DN,
  STEEL,
  getStock,
  detail,
  fundSeries,
  thesisWeights,
  thesisRun,
  thesisTargets,
  usd,
  pct,
  pct1,
  sc,
  CATS_T,
  SHORT,
  KEYS,
  getTP,
  normW,
  smaOf,
  MajorSixMonthEvent,
  getSixMonthMajorEvents,
  aboutTicker,
  trendRead,
  trendRows,
  type TrendRow,
} from "./data";
import { applyAiCards, moveCardPath, type AiMoveCard } from "./move-card-ai";
import { summarizeNewsSentiment } from "./news-significance";
import { localCopilotAnswer } from "./copilot-local";
import { BullBearChecks } from "./could-checks";
import { ReadCard, InfoTip, highlightNumbers, highlightSignedPercents } from "./read-cards";
import { weekMove } from "./week-move";
import { ConfidenceBreakdown, ConfidenceExplainer, TradeBuilderGuide } from "./trade-builder-parts";
import { fundamentalReadText, technicalReadText } from "./read-text";
import { useTickerSearch } from "../hooks/useTickerSearch";
import { BarInterval } from "../candle-chart";
import { StockChart } from "../stock-panel";
import { buildChartEarnings, type ChartEarnings } from "../chart-earnings";
import { nextEarningsDate, withOneUpcomingReport } from "../next-earnings";
import { useIntervalBars, useBackendBars } from "../hooks/useBackendBars";
import { useLiveQuotes } from "../live-quotes-context";
import { useLiveTick } from "../hooks/useLiveTick";
import { etTodayIso, fmtMarketDate, next13fDeadline, nextFomcDecision, nextMonthlyOpex, previous13fDeadline, previousFomcDecision, previousMonthlyOpex, upcomingPoliticalEvents } from "../calendar-range";
import { StockLogo } from "../utils";
import { resolveActionMeta } from "../analyst-actions-engine";
import { useHeadlineQuote } from "../quote-headline";
import { range52 } from "../range52";
import { forwardAnnualEstimates } from "../eps-sales-data";
import { ModuleSwitcher } from "../module-switcher";
import { useApiResource } from "../hooks/useApiResource";
import { useApiList } from "../hooks/useApiList";
import { apiGet, apiPost } from "../backend";
import type {
  CompanyDoc,
  FinancialsDoc,
  QuarterFinancials,
  AnalystConsensusDoc,
  AnalystRatingChange,
  InsiderTxDoc,
  NewsArticleDoc,
  LiveEarningsDoc,
  AiAnalysisDoc,
} from "../types";
import { computeTtmFcf, computeQuarterFcf, computeOperatingIncomeSeries, gaapQuarterEps, quarterYoY, surprisePct, quarterEpsSurprisePct } from "../types";
import { useIQActions } from "../shell";
import { useWatchlistsContext } from "../hooks/useWatchlists";
import type { Stock13FResponse } from "../stock-13f-view";
import { useEntitlements } from "../hooks/useEntitlements";
import { LockedFeature } from "../entitlement-gate";
import { ProfileMenu } from "../profile-menu";

const toneColor = (tone?: "up" | "dn") =>
  tone === "up" ? "var(--up, #16a34a)" : tone === "dn" ? "var(--down, #dc2626)" : "var(--si-text-hi, #e8eef4)";

/**
 * The context behind a major move, shown in full (nothing cut off): the
 * earnings figures (growth, surprise, margins), what the press said about the
 * print, and notable headlines such as a CEO leaving, a deal or a probe.
 * `compact` is the hover tooltip's tighter spacing.
 */
function EventContextBlocks({ ev, compact, metricsOnly }: { ev: MajorSixMonthEvent; compact?: boolean; metricsOnly?: boolean }) {
  const label: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--si-accent-light, #93a1af)", marginBottom: 3 };
  const body: React.CSSProperties = { fontFamily: "'Manrope', sans-serif", fontSize: compact ? 11 : 11.5, color: "var(--si-text-dim, #93a1af)", lineHeight: 1.4 };
  const block: React.CSSProperties = { marginTop: compact ? 6 : 8, paddingTop: compact ? 6 : 8, borderTop: "1px solid var(--si-border, #1c2733)" };
  return (
    <>
      {ev.metrics && ev.metrics.length > 0 && (
        <div style={{ ...block, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
          {ev.metrics.map((m) => (
            <div key={m.k}>
              <div style={label}>{m.k.toUpperCase()}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: toneColor(m.tone) }}>{m.v}</div>
            </div>
          ))}
        </div>
      )}
      {!metricsOnly && ev.commentary && (
        <div style={block}>
          <div style={label}>EARNINGS COMMENTARY</div>
          <div style={body}>{ev.commentary}</div>
        </div>
      )}
      {!metricsOnly && ev.context && ev.context.length > 0 && (
        <div style={block}>
          <div style={label}>NOTABLE EVENTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {ev.context.map((c, i) => (
              <div key={i} style={body}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, color: toneColor(c.tone), marginRight: 6 }}>{c.kind.toUpperCase()}</span>
                {c.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Upcoming Catalysts timeline: how many days ahead an event may be and still show. */
const CATALYST_WINDOW_DAYS = 45;
/** ...and how many days back an event that already happened stays on the timeline. */
const CATALYST_LOOKBACK_DAYS = 14;
/** At most this many past events are shown, the most recent ones, so they never crowd out what is ahead. */
const CATALYST_MAX_PAST = 3;
/** The stock's own major moves (big price days with their cause) stay on the timeline this long. */
const CATALYST_MAJOR_LOOKBACK_DAYS = 30;
/**
 * Hand edits to the stock's own recent events on the catalyst timeline, keyed "TICKER|YYYY-MM-DD".
 * The wording comes from news headlines, so a long or vague one can be hidden or given a short title here.
 * Only the timeline is affected; the "Why it moved" chart pins keep their own text.
 */
const CATALYST_EVENT_EDITS: Record<string, { hide?: boolean; title?: string }> = {
  "NVDA|2026-11-05": { hide: true }, // "Why Nvidia Stock Is Getting Punished Today"
  "NVDA|2026-11-10": { title: "CEO Scandal" }, // "Nvidia Stock Plunges 5.5% as CEO Scandal Overshadows Its Up…"
};

const clampLines = (n: number): React.CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden" });

function SixMonthAreaChart({
  ticker,
  stock,
  bars,
  events: baseEvents,
}: {
  ticker: string;
  stock: StockItem;
  bars?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
  events: MajorSixMonthEvent[];
}) {
  // AI-written heading and summary per card (GET /live/move-explanation). The rule-based text shows first and is
  // swapped for this when it arrives; no answer (none for the day, model busy, route missing) leaves the old text.
  const [aiCards, setAiCards] = useState<{ ticker: string; byIso: Record<string, AiMoveCard> }>({ ticker: "", byIso: {} });
  const aiRequests = useMemo(
    () =>
      baseEvents
        .map((ev) => ({ iso: ev.iso, path: moveCardPath(ticker, stock.name, ev) }))
        .filter((r): r is { iso: string; path: string } => !!r.iso && !!r.path),
    [baseEvents, ticker, stock.name],
  );
  const aiRequestKey = aiRequests.map((r) => r.path).join("|");
  useEffect(() => {
    if (!aiRequests.length) return;
    const ctl = new AbortController();
    (async () => {
      // One at a time: each is a model call, and the model has a per-minute token limit.
      for (const r of aiRequests) {
        if (ctl.signal.aborted) return;
        try {
          const doc = await apiGet<AiMoveCard>(r.path, { signal: ctl.signal });
          if (ctl.signal.aborted) return;
          setAiCards((cur) => ({ ticker, byIso: { ...(cur.ticker === ticker ? cur.byIso : {}), [r.iso]: doc } }));
        } catch {
          // keep the rule-based text for this card
        }
      }
    })();
    return () => ctl.abort();
    // aiRequestKey stands for aiRequests: same requests, same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiRequestKey, ticker]);
  const events = useMemo(() => applyAiCards(baseEvents, aiCards.ticker === ticker ? aiCards.byIso : {}), [baseEvents, aiCards, ticker]);

  // A pin opens its dialog on hover (a short grace period lets the pointer reach the dialog) and stays open,
  // larger, once clicked; Escape or a click on the chart closes it. The chart fills whatever height its
  // card is given (it sits beside the taller read), so its drawing area is measured.
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);
  const enterPin = (num: number) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHover(num);
  };
  const leavePin = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHover(null), 220);
  };

  // Real 6-month daily bars
  const chartBars = useMemo(() => {
    if (bars && bars.length >= 5) return bars;
    const fallback: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
    const now = Date.now();
    const dayMs = 86_400_000;
    const hi = stock.hi || (stock.p > 0 ? stock.p * 1.15 : 100);
    const lo = stock.lo || (stock.p > 0 ? stock.p * 0.85 : 50);
    const count = 126;
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const t = now - (count - 1 - i) * dayMs;
      const base = lo + (hi - lo) * (0.35 + 0.3 * Math.sin(frac * Math.PI));
      const c = +(base + (stock.p - base) * frac).toFixed(2);
      fallback.push({ t, o: c, h: +(c * 1.01).toFixed(2), l: +(c * 0.99).toFixed(2), c, v: 1_200_000 });
    }
    return fallback;
  }, [bars, stock]);

  const n = chartBars.length;
  const pValues = useMemo(() => (chartBars.length > 0 ? chartBars.map((b) => b.c) : [stock.p]), [chartBars, stock.p]);
  const minP = Math.min(...pValues);
  const maxP = Math.max(...pValues);
  const pad = Math.max((maxP - minP) * 0.08, 1);
  const pLo = Math.max(0.1, minP - pad);
  const pHi = maxP + pad;

  const plotLeft = 14;
  const plotRight = 920;
  const plotTop = 24;
  const H = Math.max(340, size.h || 340);
  const plotBottom = H - 44;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const xOf = (i: number) => plotLeft + (i / Math.max(1, n - 1)) * plotW;
  const yOf = (price: number) => plotTop + ((pHi - price) / (pHi - pLo || 1)) * plotH;

  // Build SVG path
  let pathD = "";
  chartBars.forEach((b, i) => {
    const x = xOf(i);
    const y = yOf(b.c);
    if (i === 0) pathD += `M ${x.toFixed(1)},${y.toFixed(1)}`;
    else pathD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaD = chartBars.length > 0 ? `${pathD} L ${xOf(n - 1).toFixed(1)},${plotBottom} L ${plotLeft},${plotBottom} Z` : "";

  // 4 Horizontal Gridlines & Price Labels
  const gridSteps = 4;
  const gridTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = (pHi - pLo) / (gridSteps + 1);
    for (let i = 1; i <= gridSteps; i++) {
      ticks.push(pLo + i * step);
    }
    return ticks;
  }, [pLo, pHi]);

  // Current Price line and badge
  const curY = yOf(stock.p);

  // 8-10 Dates on X Axis
  const dateTicks = useMemo(() => {
    if (n < 2) return [];
    const count = 9;
    const ticks: Array<{ x: number; label: string }> = [];
    for (let k = 0; k < count; k++) {
      const idx = Math.min(n - 1, Math.round((k / (count - 1)) * (n - 1)));
      const b = chartBars[idx];
      const d = new Date(b.t);
      const label = fmtMarketDate(d);
      ticks.push({ x: xOf(idx), label });
    }
    return ticks;
  }, [chartBars, n]);

  // Map 5 Major Events to coordinates on the chart
  const mappedEvents = useMemo(() => {
    if (chartBars.length === 0) return [];
    // The five most extreme moves get a numbered pin.
    return events.filter((ev) => ev.card !== false).map((ev, idx) => {
      const targetIdx = Math.min(n - 1, Math.max(0, Math.round(ev.fr * (n - 1))));
      const bar = chartBars[targetIdx];
      const x = xOf(targetIdx);
      const y = yOf(bar.c);
      return {
        ...ev,
        num: idx + 1,
        targetIdx,
        x,
        y,
        priceAtEvent: bar.c,
      };
    });
  }, [events, chartBars, n, H]);

  const active = hover ?? pinned;
  const activeHover = mappedEvents.find((e) => e.num === active);



  // The dialog sits beside its pin, on the side and height where it covers the fewest other pins;
  // when there is no clear spot it drops below the chart.
  const dialogPos = (() => {
    if (!activeHover) return null;
    const dw = 260;
    const dh = 148;
    const W = size.w || 840;
    const px = (e: { x: number }) => (e.x / 1000) * W;
    const others = mappedEvents.filter((e) => e.num !== activeHover.num);
    const hits = (left: number, top: number) => others.filter((o) => px(o) > left - 14 && px(o) < left + dw + 14 && o.y > top - 14 && o.y < top + dh + 14).length;
    const options: Array<{ left: number; top: number; hits: number; score: number }> = [];
    for (const side of ["right", "left"] as const) {
      const left = side === "right" ? px(activeHover) + 18 : px(activeHover) - 18 - dw;
      if (left < 4 || left + dw > W - 4) continue;
      for (let top = 6; top <= H - dh - 6; top += 6) {
        const h = hits(left, top);
        options.push({ left, top, hits: h, score: h * 1000 + Math.abs(top + dh / 2 - activeHover.y) + (side === "left" ? 40 : 0) });
      }
    }
    const best = options.sort((a, b) => a.score - b.score)[0];
    const below = { left: Math.max(4, Math.min(W - dw - 4, px(activeHover) - dw / 2)), top: H + 4 };
    return best && best.hits === 0 ? { left: best.left, top: best.top } : below;
  })();

  return (
    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", boxSizing: "border-box", height: "100%" }}>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
          LAST 6-MONTH TRAJECTORY &amp; MAJOR CATALYSTS
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: stock.c >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)" }}>
            {usd(stock.p)}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: stock.c >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)" }}>
            {pct(stock.c)} Today
          </span>
        </div>
      </div>

      {/* Area chart: fills the card's height */}
      <div
        ref={wrapRef}
        onClick={() => setPinned(null)}
        style={{ position: "relative", width: "100%", flex: 1, minHeight: 340, background: "var(--si-card-sec, #06080c)", border: "1px solid var(--si-border, #1c2733)", borderRadius: 4, overflow: "visible" }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, display: "block" }}>
          <defs>
            <linearGradient id="siSixMonthAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--up, #22c55e)" stopOpacity="0.25" />
              <stop offset="50%" stopColor="var(--up, #22c55e)" stopOpacity="0.08" />
              <stop offset="90%" stopColor="var(--up, #22c55e)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="var(--up, #22c55e)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="siPinGlow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal gridlines & price readouts on the right axis */}
          {gridTicks.map((pVal, idx) => {
            const y = yOf(pVal);
            return (
              <g key={idx}>
                <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="var(--si-border, rgba(255,255,255,0.06))" strokeWidth="1" />
                <text x={plotRight + 8} y={y + 4} fill="var(--si-text-dim, #64748b)" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                  ${pVal.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Area under the curve, price line */}
          <path d={areaD} fill="url(#siSixMonthAreaGrad)" />
          <path d={pathD} fill="none" stroke="var(--up, #22c55e)" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Current price: dashed line and the tag on the right axis */}
          <line x1={plotLeft} y1={curY} x2={plotRight} y2={curY} stroke="#818cf8" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.85" />
          <g>
            <rect x={plotRight + 4} y={curY - 10} width={68} height={20} rx={4} fill="#6366f1" />
            <text x={plotRight + 38} y={curY + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
              ${stock.p.toFixed(2)}
            </text>
          </g>

          {/* Bottom axis dates */}
          {dateTicks.map((dt, idx) => (
            <text key={idx} x={dt.x} y={H - 12} textAnchor="middle" fill="var(--si-text-dim, #64748b)" fontSize="10.5" fontFamily="'JetBrains Mono', monospace">
              {dt.label}
            </text>
          ))}

          {/* Numbered pins on the five biggest moves */}
          {mappedEvents.map((ev) => {
            const on = active === ev.num;
            return (
              <g
                key={ev.num}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => enterPin(ev.num)}
                onMouseLeave={leavePin}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned((cur) => (cur === ev.num ? null : ev.num));
                }}
              >
                <line x1={ev.x} y1={ev.y} x2={ev.x} y2={plotBottom} stroke={on ? "#ffffff" : "var(--si-border-sec, rgba(127,168,208,0.22))"} strokeDasharray="3 3" strokeWidth={on ? 1.5 : 1} />
                <circle cx={ev.x} cy={ev.y} r={on ? 17 : 11} fill={on ? "rgba(169,198,227,0.55)" : "rgba(34,197,94,0.18)"} stroke={on ? "#ffffff" : "var(--up, #22c55e)"} strokeWidth="1" filter={on ? "url(#siPinGlow)" : undefined} />
                <circle cx={ev.x} cy={ev.y} r="9" fill={on ? "var(--si-accent, #5980a6)" : "var(--si-card-solid, #080b10)"} stroke={on ? "#ffffff" : "var(--si-accent-soft, #7fa8d0)"} strokeWidth="2" filter={on ? "url(#siPinGlow)" : undefined} />
                <text x={ev.x} y={ev.y + 3.5} textAnchor="middle" fill={on ? "#ffffff" : "var(--si-accent-soft, #a9c6e3)"} fontSize="10" fontWeight="800" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>
                  {ev.num}
                </text>
              </g>
            );
          })}
        </svg>

        {/* The pin's dialog: a short read on hover, the full one (with the earnings detail) once pinned */}
        {activeHover && dialogPos && (
          <div
            role="dialog"
            aria-label={`Catalyst #${activeHover.num}`}
            onMouseEnter={() => enterPin(activeHover.num)}
            onMouseLeave={leavePin}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: dialogPos.top,
              left: dialogPos.left,
              width: 260,
              height: pinned === activeHover.num ? 290 : 148,
              transition: "height 180ms ease",
              maxWidth: "calc(100% - 24px)",
              boxSizing: "border-box",
              zIndex: 20,
              overflowY: "auto",
              borderStyle: "solid",
              borderTopWidth: 2,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderLeftWidth: 1,
              borderTopColor: "var(--si-accent-soft, #7fa8d0)",
              borderRightColor: pinned === activeHover.num ? "#ffffff" : "var(--si-border-sec, #2a3a4a)",
              borderBottomColor: pinned === activeHover.num ? "#ffffff" : "var(--si-border-sec, #2a3a4a)",
              borderLeftColor: pinned === activeHover.num ? "#ffffff" : "var(--si-border-sec, #2a3a4a)",
              background: "var(--si-card, #0c1118)",
              boxShadow: "0 18px 44px rgba(0,0,0,0.6), 0 0 18px rgba(169,198,227,0.18)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap" }}>
                  #{activeHover.num} · {activeHover.date}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "1px 5px", background: "var(--si-accent-bg, rgba(89,128,166,0.2))", color: "#ffffff", borderRadius: 2 }}>
                  {activeHover.category.toUpperCase()}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: activeHover.mv >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)" }}>
                  {activeHover.mv >= 0 ? "+" : ""}{activeHover.mv.toFixed(2)}%
                </span>
                {pinned === activeHover.num && (
                  <button type="button" aria-label="Close" onClick={() => setPinned(null)} style={{ width: 22, height: 22, border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "#ffffff", fontSize: 14, lineHeight: 1, cursor: "pointer", padding: 0 }}>
                    ×
                  </button>
                )}
              </span>
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14.5, fontWeight: 700, color: "#ffffff", lineHeight: 1.3, ...(pinned === activeHover.num ? {} : clampLines(1)) }}>
              {activeHover.label}
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffffff", lineHeight: 1.35, ...(pinned === activeHover.num ? {} : clampLines(2)) }}>
              {activeHover.details}
            </div>
            {pinned === activeHover.num && <EventContextBlocks ev={activeHover} compact />}
            {pinned !== activeHover.num && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned(activeHover.num);
                }}
                style={{ marginTop: "auto", alignSelf: "flex-start", border: "1px solid var(--si-accent, #5980a6)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", padding: "4px 10px", cursor: "pointer" }}
              >
                READ MORE ▸
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const rangesDef: Record<string, [number, number, number]> = {
  "1D": [78, 0.003, 0.005],
  "5D": [39, 0.008, 0.015],
  "1M": [30, 0.012, 0.04],
  "3M": [60, 0.016, 0.10],
  "6M": [120, 0.018, 0.20],
  "1Y": [250, 0.020, 0.35],
  "5Y": [350, 0.024, 0.80],
};


/** How the estimated factor attribution on Why It Moved is split (shown by its "i" button). */
const FACTOR_INFO: [string, string][] = [
  ["What it is:", "A model of how the move splits across four drivers, not a measured cause."],
  ["Sector Momentum:", "Scales with the stock's beta (beta × 28%), kept between 20% and 55%."],
  ["Company News:", "What the sector share leaves of 65%, kept between 20% and 45%."],
  ["Market Regime:", "The remainder after sector and news, less 12%, with a floor of 12%."],
  ["Technical Factors:", "Whatever is left, with a floor of 5%. The four always add up to 100%."],
];

/** How each Fundamentals scorecard grade is worked out (shown by its "i" button). */
const SCORECARD_INFO: Record<string, [string, string][]> = {
  GROWTH: [
    ["Measure:", "Latest quarter's revenue against the same quarter a year earlier."],
    ["Strong:", "20% or more."],
    ["Solid:", "8% to 20%."],
    ["Slow:", "0% to 8%."],
    ["Shrinking:", "below 0%."],
  ],
  PROFITABILITY: [
    ["Measure:", "Latest quarter's operating margin (operating income / revenue). The y/y change is shown beside it."],
    ["Strong:", "25% or more."],
    ["Solid:", "12% to 25%."],
    ["Thin:", "0% to 12%."],
    ["Losing money:", "below 0%."],
  ],
  "FINANCIAL HEALTH": [
    ["Measure:", "The balance-sheet checks in the Financial Health card below: cash against debt, current ratio, debt / equity, debt / EBITDA."],
    ["Strong:", "at least two checks are healthy and none is flagged."],
    ["Mixed:", "a check carries a caution."],
    ["Stretched:", "a check is flagged as a problem."],
  ],
  VALUATION: [
    ["Measure:", "P/E (forward P/E when there is no trailing one) against a sector reference."],
    ["Attractive:", "under 0.8× the reference."],
    ["Fair:", "0.8× to 1.2×."],
    ["Rich:", "1.2× to 1.8×."],
    ["Expensive:", "above 1.8×."],
  ],
};

/** Colours the numbers in a scorecard note: signed changes green/red, the sector reference amber, the other figures in the grade's colour. */
function highlightScoreNote(text: string, gradeCol: string): React.ReactNode[] {
  const re = /([+−-]\d[\d.,]*(?:%| pts)?)|(\d[\d.,]*×(?= sector))|(\$?\d[\d.,]*(?:%|×|[BMKT])?)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const col = m[1] ? (m[1].startsWith("+") ? "var(--up, #4ade80)" : "var(--down, #f87171)") : m[2] ? "#f5b031" : gradeCol;
    out.push(
      <span key={k++} style={{ color: col, fontWeight: 700 }}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** How the Technical Read card on Overview is worked out (shown by its "i" button). */
const TECHNICAL_READ_INFO: [string, string][] = [
  ["TREND", "compares the price to the 50 DMA and the 200 DMA."],
  ["Bullish (green):", "price is above both."],
  ["Bearish (red):", "price is below both."],
  ["Mixed (steel blue):", "price is between them."],
  ["MOMENTUM", "uses 14-day RSI."],
  ["Overbought (amber):", "RSI 70 or above."],
  ["Strong (green):", "RSI 55 to under 70."],
  ["Neutral (amber):", "RSI above 45 and under 55."],
  ["Weak (red):", "RSI above 30 and up to 45."],
  ["Oversold (red):", "RSI 30 or below."],
  ["52W HIGH", "is how far price sits below its 52-week high. Within 3% reads as at / near the high."],
  ["RISK", "uses 30-day realized volatility, which is annualized price volatility and not beta or drawdown."],
  ["High (red):", "50% or more."],
  ["Elevated (amber):", "30% to under 50%."],
  ["Moderate (green):", "under 30%."],
];

export function StockIntelligenceScreen() {
  const { data: ent } = useEntitlements();
  const isUnsubscribed = ent?.subscriptionsEnabled === true && !ent?.staff && (ent?.planId === "none" || ent?.planId === "free");
  const { theme, setTheme } = useIQActions();
  const isLight = theme === "light";
  // The shell's setTheme persists to localStorage + backend, keeping MC in sync.
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const router = useRouter();
  const { siTicker, setSiTicker, activeTab, setActiveTab, goToSearch } = useSI();

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchResults = useTickerSearch(searchQuery);

  // Timeframe and chart range for SI overview price chart (default 3M per MC standard)
  const [range, setRange] = useState<"1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y">("3M");
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  // Technicals chart candle interval (matches MC Overview & StockChart)
  const [barInterval, setBarInterval] = useState<BarInterval>("1D");

  // Active stock — the URL (?sym=) is the single source of truth on /si, so
  // /si is always the home view and /si?sym=X is always that stock. Reading it
  // through useSearchParams keeps it correct on the first render after a
  // router.push and on back/forward, with no stale copy to fall out of sync.
  const searchParams = useSearchParams();
  const currentTicker = searchParams?.get("sym")?.toUpperCase().trim() || null;

  // Mirror it into the SI context so the switcher knows which stock to carry
  // back to Market Catalyst.
  useEffect(() => {
    setSiTicker(currentTicker);
  }, [currentTicker, setSiTicker]);

  // Live price stream via SSE + /live/quotes polling fallback (identical to MC StockScreen)
  const live = useLiveTick(currentTicker || "");
  const liveQuotesMap = useLiveQuotes(currentTicker ? [currentTicker] : []);
  // Landing-page chips: live change for each popular ticker (no stored prices).
  const popularQuotes = useLiveQuotes(ORDER);
  const sharedQuote = currentTicker ? liveQuotesMap.get(currentTicker) : undefined;

  // Live vendor & MC backend data
  const { data: liveCompany, loading: liveCompanyLoading } = useApiResource<CompanyDoc>(
    currentTicker ? `/live/company?ticker=${encodeURIComponent(currentTicker)}` : null,
    30000
  );
  const { data: financialsDoc, loading: financialsLoading, error: financialsError } = useApiResource<FinancialsDoc>(
    currentTicker ? `/live/financials?ticker=${encodeURIComponent(currentTicker)}` : null
  );
  const { data: tickerNews } = useApiResource<NewsArticleDoc[]>(
    currentTicker ? `/live/news?ticker=${encodeURIComponent(currentTicker)}` : null,
    30000
  );
  // Scoped to this ticker: FMP on demand, so any stock has its own consensus
  // and full insider history (not just tickers a nightly sweep covered).
  const { data: liveConsensusList } = useApiList<AnalystConsensusDoc>(
    currentTicker ? `/market-data/analyst-actions?ticker=${encodeURIComponent(currentTicker)}` : null,
  );
  const { data: liveAnalystHistory } = useApiList<AnalystRatingChange>(
    currentTicker ? `/market-data/analyst-history?ticker=${encodeURIComponent(currentTicker)}` : null,
  );
  const { data: liveInsiderList } = useApiList<InsiderTxDoc>(
    currentTicker ? `/market-data/insider-transactions?ticker=${encodeURIComponent(currentTicker)}` : null,
  );
  const { data: liveEarningsList } = useApiList<LiveEarningsDoc>("/market-data/earnings");
  const { data: companiesList, loading: companiesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: aiAnalysisDoc } = useApiResource<AiAnalysisDoc>(
    currentTicker ? `/live/ai-analysis?ticker=${encodeURIComponent(currentTicker)}` : null,
    // Re-check: a slow model outlives the request timeout; the backend still
    // finishes and caches the synthesis for the next poll.
    30_000,
  );

  const [pendingPeerOpen, setPendingPeerOpen] = useState<{ ticker: string; name?: string } | null>(null);

  // Form 13F Institutional Holdings (FMP)
  const [inst13FData, setInst13FData] = useState<Stock13FResponse | null>(null);
  useEffect(() => {
    if (!currentTicker) return;
    let cancelled = false;
    apiGet<Stock13FResponse>(`/live/13f-filings?ticker=${encodeURIComponent(currentTicker)}`)
      .then((res) => {
        if (!cancelled) setInst13FData(res);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [currentTicker]);

  // Live technical bars for the Technicals tab (matches MC Overview)
  const { bars: realBars, asOf: barsAsOf, loading: barsLoading } = useIntervalBars(
    currentTicker || "NVDA",
    barInterval
  );

  // 6-Month bars for Why It Moved tab (matches stock function 6M area chart)
  const { bars: sixMonthBars, loading: sixMonthLoading } = useBackendBars(
    currentTicker || "NVDA",
    "6M"
  );

  // Real bars for Overview Price History chart across selected timeframe (1D, 5D, 1M, 3M, 6M, 1Y, 5Y)
  const { bars: overviewBars, loading: overviewBarsLoading } = useBackendBars(
    currentTicker || "NVDA",
    range
  );

  // 1-Year daily bars for chart key moments & context (matching MC stock function)
  const { bars: yearBars } = useBackendBars(
    currentTicker || "NVDA",
    "1Y"
  );

  // Chart earnings with EPS estimate/actual beat/miss markers (matching MC stock function)
  const chartEarnings: ChartEarnings[] = useMemo(() => {
    const sym = currentTicker || "NVDA";
    const symEvents = (liveEarningsList ?? []).filter((e) => e.ticker === sym);
    return buildChartEarnings(financialsDoc, symEvents, etTodayIso());
  }, [financialsDoc, liveEarningsList, currentTicker]);

  // Real-time price and change from live tick, quotes context, or backend company resource
  // Same headline rule as the stock page (useHeadlineQuote): outside regular
  // hours the price is the last REGULAR close with that session's change; the
  // extended-hours move is separate. Taking the after-hours trade with a % that
  // still included the regular session mixed the two (E2E Oct 23: BAC −0.90%
  // vs −0.79%, EPM, GE, JACK).
  const headline = useHeadlineQuote(currentTicker || "", live, {
    price: liveCompany?.price ?? null,
    pctChange: liveCompany?.pctChange ?? null,
  });
  const currentPrice = (headline.regPrice > 0 ? headline.regPrice : null) ?? live.tick?.price ?? sharedQuote?.price ?? liveCompany?.price ?? undefined;
  const currentChange = (headline.regPrice > 0 ? headline.regPct : null) ?? live.pct ?? sharedQuote?.pctChange ?? liveCompany?.pctChange ?? undefined;

  // Every input the Stock Intelligence engine reasons from — all real data
  // loaded above. Missing inputs stay null; the engine drops what needs them.
  const siFacts: SiFacts = useMemo(() => {
    if (!currentTicker) return EMPTY_FACTS;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const qs = [...(financialsDoc?.quarters ?? [])]
      .filter((q) => q.endDate)
      .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
    const latest = qs[0];
    const yearAgo = latest
      ? qs.find((q) => q.fiscalPeriod === latest.fiscalPeriod && Number(q.fiscalYear) === Number(latest.fiscalYear) - 1) ?? qs[4]
      : undefined;
    const margin = (q: typeof latest | undefined, field: "grossProfit" | "operatingIncome") =>
      q && q.revenue && q[field] != null ? ((q[field] as number) / q.revenue) * 100 : null;
    const last4 = qs.slice(0, 4).filter((q) => q.epsActualReported != null && q.epsEstimateReported != null);
    // The fiscal year in progress is the first after the last REPORTED year,
    // matched on period end dates (see forwardAnnualEstimates — label
    // comparison put January year-ends one year behind).
    const est = forwardAnnualEstimates(financialsDoc);
    const curEst = est[0]?.epsEstimate != null ? est[0] : null;
    const nextEst = curEst ? est.find((e) => Number(e.fiscalYear) === Number(curEst.fiscalYear) + 1 && e.epsEstimate != null) ?? null : null;
    const cons = (Array.isArray(liveConsensusList) ? liveConsensusList : []).find((c) => c.ticker === currentTicker) ?? null;
    // Windows anchored on today's ET date (render-pure, no clock read).
    const todayMs = Date.parse(`${etTodayIso()}T00:00:00Z`);
    const since90 = todayMs - 90 * 86_400_000;
    const grades90 = (cons?.recentGrades ?? []).filter((g) => g.date && Date.parse(g.date) >= since90);
    const insider90 = (Array.isArray(liveInsiderList) ? liveInsiderList : []).filter(
      (x) => (x.transactionCode === "P" || x.transactionCode === "S") && x.pricePerShare && Date.parse(x.transactionDate) >= since90,
    );
    const insiderNet = insider90.reduce((a, x) => a + (x.transactionCode === "P" ? 1 : -1) * x.shares * (x.pricePerShare ?? 0), 0);
    const news7 = (Array.isArray(tickerNews) ? tickerNews : []).filter((n) => n.publishedAt && Date.parse(n.publishedAt) >= todayMs - 7 * 86_400_000);
    // Impact-weighted mood of the stock's own news (not a raw count of vendor tags).
    const newsSent = summarizeNewsSentiment(news7, {
      ticker: currentTicker,
      name: liveCompany?.name,
      bars: sixMonthBars,
      isAbout: (x) => aboutTicker(x, currentTicker, liveCompany?.name),
    });
    // Next report on or after today: the stored date when it is still ahead,
    // else the earnings calendar (a stored date can be a report already made).
    const todayIso = etTodayIso();
    const erDate = nextEarningsDate(
      liveCompany?.nextEarningsDate,
      (Array.isArray(liveEarningsList) ? liveEarningsList : []).filter((e) => e.ticker === currentTicker),
      todayIso,
    );
    const erDays = erDate ? Math.round((Date.parse(erDate + "T00:00:00Z") - todayMs) / 86_400_000) : null;
    const pivots = liveCompany?.keyLevels?.daily ?? null;
    const isBank = /bank|savings|thrift|financial/i.test(liveCompany?.industry ?? "") || /financial/i.test(liveCompany?.sector ?? "");
    const isUtilityOrSame = latest?.grossProfit != null && latest?.operatingIncome != null && latest.grossProfit === latest.operatingIncome;
    const suppressGross = isBank || isUtilityOrSame;
    const dailyCloses = (yearBars ?? []).map((b) => b.c).filter((c) => Number.isFinite(c));
    return {
      price: num(currentPrice),
      changePct: num(currentChange),
      sector: liveCompany?.sector ?? null,
      revGrowthYoY: latest?.revenue != null && yearAgo?.revenue ? ((latest.revenue - yearAgo.revenue) / Math.abs(yearAgo.revenue)) * 100 : null,
      grossMargin: suppressGross ? null : margin(latest, "grossProfit"),
      opMargin: margin(latest, "operatingIncome"),
      opMarginYearAgo: margin(yearAgo, "operatingIncome"),
      epsBeats: last4.length ? last4.filter((q) => (q.epsActualReported as number) >= (q.epsEstimateReported as number)).length : null,
      epsReports: last4.length || null,
      fwdEps: curEst?.epsEstimate ?? null,
      nextFyEps: nextEst?.epsEstimate ?? null,
      trailingPe: num(liveCompany?.peRatio),
      consensus: cons?.consensus ?? null,
      buyCount: cons ? cons.strongBuy + cons.buy : null,
      holdCount: cons ? cons.hold : null,
      sellCount: cons ? cons.sell + cons.strongSell : null,
      targetMean: num(cons?.priceTargetConsensus),
      upgrades90: cons ? grades90.filter((g) => /upgrade/i.test(g.action ?? "")).length : null,
      downgrades90: cons ? grades90.filter((g) => /downgrade/i.test(g.action ?? "")).length : null,
      // Same label the Analyst Actions tab shows: target cut, rating unchanged.
      ptCuts90: cons
        ? grades90.filter((g) => resolveActionMeta(g.action, g.previousGrade, g.newGrade, g.priceTarget, g.previousPriceTarget, g.priceTargetChange).shownAction === "PT Cut").length
        : null,
      // The backend stores only the 50/200; the short-term pair comes from the
      // same daily closes the chart draws.
      sma9: smaOf(dailyCloses, 9),
      sma21: smaOf(dailyCloses, 21),
      sma50: num(liveCompany?.sma50),
      sma200: num(liveCompany?.sma200),
      rsi14: num(liveCompany?.rsi14),
      rvol: num(liveCompany?.rvol),
      rsRating: num(liveCompany?.rsRating),
      pctFromHigh52: num(liveCompany?.pctFromHigh52),
      beta: num(liveCompany?.beta),
      realizedVol30: num(liveCompany?.realizedVol30),
      pivotR1: num(pivots?.r1),
      pivotR2: num(pivots?.r2),
      pivotS1: num(pivots?.s1),
      pivotS2: num(pivots?.s2),
      sectorRank: num(liveCompany?.sectorRank),
      sectorRankTotal: num(liveCompany?.sectorRankTotal),
      instOwnershipPct: num(liveCompany?.instOwnershipPct),
      instHoldersChange: num(liveCompany?.inst13FHoldersChange),
      instSharesChange: num(liveCompany?.inst13FSharesChange),
      instPutCallRatio: num(liveCompany?.instPutCallRatio),
      insiderNet90: insider90.length ? insiderNet : null,
      daysToEarnings: erDays != null && erDays >= 0 ? erDays : null,
      newsPos: newsSent.total ? newsSent.pos : null,
      newsNeg: newsSent.total ? newsSent.neg : null,
      newsHighPos: newsSent.total ? newsSent.highPos : null,
      newsHighNeg: newsSent.total ? newsSent.highNeg : null,
      newsWPos: newsSent.total ? newsSent.wPos : null,
      newsWNeg: newsSent.total ? newsSent.wNeg : null,
    };
  }, [currentTicker, currentPrice, currentChange, liveCompany, financialsDoc, liveConsensusList, liveInsiderList, tickerNews, liveEarningsList, yearBars, sixMonthBars]);

  const stock: StockItem | null = useMemo(() => {
    if (!currentTicker) return null;
    return getStock(currentTicker, {
      price: currentPrice,
      change: currentChange,
      name: liveCompany?.name ?? undefined,
      sector: liveCompany?.sector ?? undefined,
      mcap: liveCompany?.marketCap ?? undefined,
      pe: liveCompany?.peRatio ?? undefined,
      hi: liveCompany?.high52 ?? undefined,
      lo: liveCompany?.low52 ?? undefined,
    }, false, siFacts);
  }, [currentTicker, currentPrice, currentChange, liveCompany, siFacts]);

  const stockDetail: DetailStock | null = useMemo(() => {
    if (!currentTicker) return null;
    return detail(currentTicker, {
      price: currentPrice,
      change: currentChange,
      name: liveCompany?.name ?? undefined,
      sector: liveCompany?.sector ?? undefined,
      mcap: liveCompany?.marketCap ?? undefined,
      pe: liveCompany?.peRatio ?? undefined,
      hi: liveCompany?.high52 ?? undefined,
      lo: liveCompany?.low52 ?? undefined,
      beta: liveCompany?.beta ?? undefined,
      rvol: liveCompany?.rvol ?? undefined,
      avgVolume20: liveCompany?.avgVolume20 ?? undefined,
      volume: liveCompany?.avgVolume20 != null && liveCompany?.rvol != null ? liveCompany.avgVolume20 * liveCompany.rvol : undefined,
      inst13FSharesChange: liveCompany?.inst13FSharesChange ?? undefined,
      instPutCallRatio: liveCompany?.instPutCallRatio ?? undefined,
      realizedVol30: liveCompany?.realizedVol30 ?? undefined,
      keyLevels: liveCompany?.keyLevels ?? undefined,
      sma50: liveCompany?.sma50 ?? undefined,
      facts: siFacts,
    });
  }, [currentTicker, currentPrice, currentChange, liveCompany, siFacts]);

  // Declared ahead of the catalysts timeline below, which also lists the recent ones.
  const majorEvents = useMemo(() => {
    if (!stock) return [];
    return getSixMonthMajorEvents(
      stock.t,
      stock,
      sixMonthBars,
      financialsDoc?.quarters,
      tickerNews,
      financialsDoc?.epsHistory,
    );
  }, [stock, sixMonthBars, financialsDoc?.quarters, tickerNews, financialsDoc?.epsHistory]);

  // Real upcoming catalysts derived from actual exchange earnings calendar & corporate events (replaces hardcoded dates)
  const upcomingCatalysts = useMemo<UpcomingEvent[]>(() => {
    if (!stock) return [];
    const todayStr = etTodayIso();
    const todayMs = new Date(todayStr + "T00:00:00-04:00").getTime();

    const symEvents = (Array.isArray(liveEarningsList) ? liveEarningsList : [])
      .filter((e) => e.ticker === stock.t)
      .sort((a, b) => a.date.localeCompare(b.date));

    // One next-report date for every card (next-earnings.ts).
    const realErDate = nextEarningsDate(liveCompany?.nextEarningsDate, symEvents, todayStr);
    const upcomingEr = withOneUpcomingReport(symEvents, realErDate, todayStr).find((e) => e.date >= todayStr) ?? null;

    const items: UpcomingEvent[] = [];

    // Earliest day an already-happened event may be and still show.
    const lookback = new Date(`${todayStr}T12:00:00Z`);
    lookback.setUTCDate(lookback.getUTCDate() - CATALYST_LOOKBACK_DAYS);
    const lookbackIso = lookback.toISOString().slice(0, 10);

    // 0. The report this stock just made (inside the look-back window), with its result.
    const lastReport = [...symEvents]
      .reverse()
      .find((e) => e.date < todayStr && e.date >= lookbackIso && (e.epsActual != null || e.revenueActual != null));
    if (lastReport) {
      const erMs = new Date(lastReport.date + "T09:30:00-04:00").getTime();
      const ago = Math.max(1, Math.round((todayMs - erMs) / 86_400_000));
      const eps = lastReport.epsActual != null ? `EPS $${lastReport.epsActual.toFixed(2)}` : null;
      const epsVs = lastReport.epsActual != null && lastReport.epsEstimate != null ? ` vs $${lastReport.epsEstimate.toFixed(2)} est` : "";
      const rev = lastReport.revenueActual != null ? `Rev $${(lastReport.revenueActual / 1e9).toFixed(1)}B` : null;
      items.push({
        date: fmtMarketDate(lastReport.date),
        iso: lastReport.date,
        days: ago === 1 ? "yesterday" : `${ago} days ago`,
        n: lastReport.session ? `Earnings Reported (${lastReport.session})` : "Quarterly Earnings Reported",
        txt: [eps ? `${eps}${epsVs}` : null, rev].filter(Boolean).join(" · ") || `${stock.t} reported quarterly results`,
        imp: "HIGH",
        col: "#f5b031",
        cat: "Earnings",
        past: true,
      });
    }

    // 1. Real Earnings Report from backend/FMP
    if (realErDate && realErDate >= todayStr) {
      const erMs = new Date(realErDate + "T09:30:00-04:00").getTime();
      const diffDays = Math.max(0, Math.round((erMs - todayMs) / (1000 * 60 * 60 * 24)));
      const daysStr = diffDays === 0 ? "today" : diffDays === 1 ? "in 1 day" : `in ${diffDays} days`;
      const dateParts = realErDate.split("-");
      const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
      const fmtDateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const epsEst = upcomingEr?.epsEstimate != null ? `$${upcomingEr.epsEstimate.toFixed(2)}` : null;
      const revEst = upcomingEr?.revenueEstimate != null ? `$${(upcomingEr.revenueEstimate / 1e9).toFixed(1)}B` : null;
      const estTxt = epsEst || revEst
        ? `Consensus: ${[epsEst ? `EPS ${epsEst}` : "", revEst ? `Rev ${revEst}` : ""].filter(Boolean).join(" · ")}`
        : `Consensus quarterly revenue and EPS report for ${stock.t}`;

      const isConfirmed = Boolean(
        (upcomingEr as any)?.confirmed ?? (liveCompany as any)?.earningsConfirmed
      );
      const estBadge = !isConfirmed ? " (Estimated)" : "";

      items.push({
        date: `${fmtDateStr}${estBadge}`,
        iso: realErDate,
        days: daysStr,
        n: upcomingEr?.session ? `Earnings Release (${upcomingEr.session})` : "Quarterly Earnings Release",
        txt: `${estTxt}; historical event volatility window`,
        imp: "HIGH",
        col: "#f5b031",
        cat: "Earnings",
      });
    }

    // 2. Upcoming Macro & Regulatory Dates
    const fomcDay = nextFomcDecision(todayStr);
    const prevFomcDay = previousFomcDecision(todayStr);
    // Events that already happened stay for CATALYST_LOOKBACK_DAYS (an election
    // or a Fed decision is still moving the market for a while); the window
    // filter below drops anything older.
    const POLITICAL_COL = "#a78bfa";
    const OPEX = { name: "Monthly Options Expiry (OpEx)", desc: `Pinning pressure expected around key ${stock.t} open interest strikes`, imp: "LOW" as const, col: "#93a1af", cat: "Market" };
    const FOMC = { name: "FOMC Rate Decision", desc: "Federal Reserve policy decision and press conference; macro equity multiple driver", imp: "HIGH" as const, col: STEEL, cat: "Macro" };
    const F13 = { name: "13F Filing Deadline", desc: "Institutional ownership updates and hedge fund positioning reports filed with SEC", imp: "MED" as const, col: STEEL, cat: "Market" };
    const calendarEvents: Array<{ date: string; name: string; desc: string; imp: "HIGH" | "MED" | "LOW"; col: string; cat: string }> = [
      { date: previousMonthlyOpex(todayStr), ...OPEX },
      { date: nextMonthlyOpex(todayStr), ...OPEX },
      ...(prevFomcDay ? [{ date: prevFomcDay, ...FOMC }] : []),
      ...(fomcDay ? [{ date: fomcDay, ...FOMC }] : []),
      { date: previous13fDeadline(todayStr), ...F13 },
      { date: next13fDeadline(todayStr), ...F13 },
      ...upcomingPoliticalEvents(todayStr, CATALYST_LOOKBACK_DAYS).map((p) => ({ ...p, col: POLITICAL_COL, cat: "Political" })),
    ];
    calendarEvents.sort((a, b) => a.date.localeCompare(b.date));

    calendarEvents.forEach((ev) => {
      if (ev.date < lookbackIso) return; // calendar dates keep the short look-back
      const evMs = new Date(ev.date + "T09:30:00-04:00").getTime();
      const diffDays = Math.round((evMs - todayMs) / (1000 * 60 * 60 * 24));
      const daysStr = diffDays === 0 ? "today" : diffDays === 1 ? "in 1 day" : diffDays === -1 ? "yesterday" : diffDays < 0 ? `${-diffDays} days ago` : `in ${diffDays} days`;
      const dateParts = ev.date.split("-");
      const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
      const fmtDateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(diffDays > 180 ? { year: "numeric" as const } : {}) });
      items.push({
        date: fmtDateStr,
        iso: ev.date,
        days: daysStr,
        n: ev.name,
        txt: ev.desc,
        imp: ev.imp,
        col: ev.col,
        cat: ev.cat,
        past: ev.date < todayStr,
      });
    });

    // 3. The stock's own recent major events: the big price days from "Why it
    // moved", each with its real cause (earnings, a headline, an analyst call).
    // Those pins carry display dates only, so the day is found from the chart bars.
    const majorLookback = new Date(`${todayStr}T12:00:00Z`);
    majorLookback.setUTCDate(majorLookback.getUTCDate() - CATALYST_MAJOR_LOOKBACK_DAYS);
    const majorLookbackIso = majorLookback.toISOString().slice(0, 10);
    const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
    const barDay = new Map<string, string>(); // "Nov 12" -> latest bar day with that label
    for (const b of sixMonthBars ?? []) {
      barDay.set(fmtMarketDate(b.t, { month: "short", day: "2-digit" }), new Date(b.t).toISOString().slice(0, 10));
    }
    for (const ev of majorEvents) {
      const iso = barDay.get(ev.date);
      if (!iso || iso >= todayStr || iso < majorLookbackIso) continue;
      if (ev.category === "Earnings" && lastReport) continue; // already shown as the report itself
      const edit = CATALYST_EVENT_EDITS[`${stock.t.toUpperCase()}|${iso}`];
      if (edit?.hide) continue;
      const ago = Math.max(1, Math.round((todayMs - new Date(iso + "T09:30:00-04:00").getTime()) / 86_400_000));
      const ret = `${ev.mv >= 0 ? "+" : "−"}${Math.abs(ev.mv).toFixed(1)}%`;
      const high = Boolean(ev.card);
      items.push({
        date: fmtMarketDate(iso),
        iso,
        days: ago === 1 ? "yesterday" : `${ago} days ago`,
        n: edit?.title ?? clip(ev.label, 60),
        txt: `${stock.t} ${ret} that session. ${clip(ev.details.replace(/\s*Stock moved [^.]*\.$/, ""), 100)}`.trim(),
        imp: high ? "HIGH" : "MED",
        col: high ? "#f5b031" : STEEL,
        cat: ev.category === "Macro" ? "Price move" : ev.category,
        past: true,
      });
    }

    if (!realErDate || realErDate < todayStr) {
      items.unshift({
        date: "TBD",
        days: "date pending",
        n: "Next Earnings Announcement",
        txt: `Next quarterly report date for ${stock.t} has not yet been officially scheduled with the exchange.`,
        imp: "MED",
        col: STEEL,
      });
    }

    // Only what is coming up soon, and strictly in date order. Without the
    // window a far-off calendar item (e.g. a Sep-2027 funding deadline) landed
    // on the timeline, and the earnings card — pushed first — sat ahead of
    // nearer macro dates. The "TBD" placeholder has no date and stays first.
    const cutoff = new Date(`${todayStr}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() + CATALYST_WINDOW_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    // The look-back adds the last CATALYST_MAX_PAST events that already
    // happened (oldest first) ahead of the usual six upcoming ones. "TBD" has no
    // date and sorts at today's edge: after what happened, before what is next.
    const inWindow = items.filter((it) => !it.iso || (it.iso >= majorLookbackIso && it.iso <= cutoffIso));
    const ordered = [...inWindow].sort((a, b) => (a.iso ?? todayStr).localeCompare(b.iso ?? todayStr));
    // Of everything that already happened, keep the biggest few (then the most recent),
    // and show them oldest to newest like the rest of the timeline.
    const impRank = (i: string) => (i === "HIGH" ? 2 : i === "MED" ? 1 : 0);
    const recent = ordered
      .filter((it) => it.past)
      .sort((a, b) => impRank(b.imp) - impRank(a.imp) || (b.iso ?? "").localeCompare(a.iso ?? ""))
      .slice(0, CATALYST_MAX_PAST)
      .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""));
    return [...recent, ...ordered.filter((it) => !it.past).slice(0, 6)];
  }, [stock, liveCompany?.nextEarningsDate, liveEarningsList, majorEvents, sixMonthBars]);

  // 5 Major Catalysts derived dynamically from FMP data (bars, quarters, news, and stock metrics)
  // "+ Watch" is the Market Catalyst watchlist (the shell's shared watchlist state).
  const wl = useWatchlistsContext();
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const isWatched = !!stock && wl.watchlists.some((w) => w.tickers.includes(stock.t.toUpperCase()));
  /** Watch → the first watchlist (one is created if there is none); Watching → removed from every list. */
  const toggleWatch = async () => {
    if (!stock || watchBusy) return;
    const sym = stock.t.toUpperCase();
    setWatchBusy(true);
    setWatchMsg(null);
    try {
      if (isWatched) {
        for (const w of wl.watchlists) if (w.tickers.includes(sym)) await wl.removeTicker(w.id, sym);
      } else {
        if (!wl.uid) { setWatchMsg("Sign in to add stocks to your watchlist."); return; }
        const list = wl.watchlists[0] ?? (await wl.createList("My Watchlist"));
        if (!list) { setWatchMsg(`Couldn't add ${sym}. Please try again.`); return; }
        const res = await wl.addTicker(list.id, sym);
        if (!res.ok) setWatchMsg(res.message);
      }
    } finally {
      setWatchBusy(false);
    }
  };

  // Real peers from Polygon/FMP (liveCompany.peers) and MC company universe (matches stock function)
  const isBumble = stock?.t?.toUpperCase() === "BMBL" || stock?.name?.toLowerCase().includes("bumble") || currentTicker?.toUpperCase() === "BMBL";

  const rawPeerTickers = useMemo(() => {
    if (!stock) return [];
    return (liveCompany?.peers ?? []).filter((t) => {
      if (!t) return false;
      const ut = t.toUpperCase().trim();
      if (ut === stock.t.toUpperCase()) return false;
      if (isBumble && (ut === "BMBL" || ut === "BUMBLE")) return false;
      return true;
    });
  }, [liveCompany?.peers, stock, isBumble]);

  const inUniverse = useMemo(() => new Set((companiesList || []).map((c) => c.ticker)), [companiesList]);
  const missingPeers = useMemo(() => rawPeerTickers.filter((t) => !inUniverse.has(t)), [rawPeerTickers, inUniverse]);
  const peerQuotesMap = useLiveQuotes(missingPeers);

  const [enrichedPeers, setEnrichedPeers] = useState<Map<string, {
    name?: string | null;
    marketCap?: number | null;
    peRatio?: number | null;
    rsRating?: number | null;
  }>>(new Map());

  const missingPeersKey = missingPeers.join(",");
  // Key of the peer set whose summary request has settled (success or failure).
  const [peersSettledKey, setPeersSettledKey] = useState("");
  useEffect(() => {
    if (!missingPeersKey) return;
    let active = true;
    apiGet<Array<{
      ticker: string;
      name: string | null;
      marketCap: number | null;
      peRatio: number | null;
      rsRating: number | null;
    }>>(`/live/peers-summary?tickers=${encodeURIComponent(missingPeersKey)}`)
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setEnrichedPeers((prev) => {
          const next = new Map(prev);
          for (const r of rows) {
            next.set(r.ticker, {
              name: r.name,
              marketCap: r.marketCap != null ? (r.marketCap > 1e6 ? r.marketCap / 1e9 : r.marketCap) : null,
              peRatio: r.peRatio,
              rsRating: r.rsRating,
            });
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => { if (active) setPeersSettledKey(missingPeersKey); });
    return () => { active = false; };
  }, [missingPeersKey]);

  // Hold the table back until company, universe and peer summaries have landed,
  // so rows don't render as dashes (or sector-fallback tickers) and then fill in.
  const peersPending =
    liveCompanyLoading ||
    companiesLoading ||
    (missingPeersKey !== "" && peersSettledKey !== missingPeersKey);

  type PeerRowItem = {
    t: string;
    name: string;
    price: number | null;
    c: number | null;
    marketCap: number | null;
    peRatio: number | null;
    rsRating: number | null;
  };

  const peersAll: PeerRowItem[] = useMemo(() => {
    if (!stock) return [];
    const related: PeerRowItem[] = rawPeerTickers.map((t) => {
      const c = (companiesList || []).find((x) => x.ticker === t);
      const extra = enrichedPeers.get(t);
      if (c && c.pctChange != null) {
        return {
          t: c.ticker,
          name: c.name || extra?.name || t,
          price: c.price ?? null,
          c: c.pctChange as number,
          marketCap: c.marketCap != null ? c.marketCap / 1e9 : (extra?.marketCap ?? null),
          peRatio: c.peRatio ?? extra?.peRatio ?? null,
          rsRating: c.rsRating ?? extra?.rsRating ?? null,
        };
      }
      const q = peerQuotesMap.get(t);
      if (q && q.pctChange != null) {
        return {
          t,
          name: extra?.name || t,
          price: q.price ?? null,
          c: q.pctChange,
          marketCap: extra?.marketCap ?? null,
          peRatio: extra?.peRatio ?? null,
          rsRating: extra?.rsRating ?? null,
        };
      }
      // No live quote yet: list the peer without a price rather than a stale one.
      return {
        t,
        name: extra?.name || POPULAR[t] || t,
        price: null,
        c: null,
        marketCap: extra?.marketCap ?? null,
        peRatio: extra?.peRatio ?? null,
        rsRating: extra?.rsRating ?? null,
      };
    }).filter((p) => {
      if (!p || !p.t) return false;
      if (p.t.toUpperCase() === stock.t.toUpperCase()) return false;
      if (isBumble && (p.t.toUpperCase() === "BMBL" || p.t.toUpperCase() === "BUMBLE")) return false;
      return true;
    });

    if (related.length >= 3) {
      return related.slice(0, 6);
    }

    // Fallback to same-sector peers from companiesList
    const sectorFallback = (companiesList || [])
      .filter((c) => {
        if (!c.ticker) return false;
        if (c.ticker.toUpperCase() === stock.t.toUpperCase()) return false;
        if (isBumble && (c.ticker.toUpperCase() === "BMBL" || c.ticker.toUpperCase() === "BUMBLE")) return false;
        return c.sector === stock.sector || c.sector === liveCompany?.sector;
      })
      .sort((a, b) => (b.rsRating ?? 0) - (a.rsRating ?? 0))
      .slice(0, 6)
      .map((c) => ({
        t: c.ticker,
        name: c.name || c.ticker,
        price: c.price ?? null,
        c: c.pctChange ?? null,
        marketCap: c.marketCap != null ? c.marketCap / 1e9 : null,
        peRatio: c.peRatio ?? null,
        rsRating: c.rsRating ?? null,
      }));

    const combined = [...related];
    for (const sf of sectorFallback) {
      if (combined.length >= 6) break;
      if (!combined.some((x) => x.t.toUpperCase() === sf.t.toUpperCase())) {
        combined.push(sf);
      }
    }
    return combined;
  }, [rawPeerTickers, companiesList, peerQuotesMap, enrichedPeers, stock, liveCompany?.sector, isBumble]);

  // YTD for the peer table. The backend returns each peer's prior-year-end close
  // and the % is measured here against the price the row shows, so the two agree.
  // Fetched for every peer on screen (universe peers included — the enrichment
  // request above only covers peers missing from the universe).
  const peerTickersKey = peersAll.map((p) => p.t).join(",");
  // `since` is set only for a stock listed this year (no prior-year close): the base is then its first close.
  const [peerYtdBase, setPeerYtdBase] = useState<Map<string, { base: number | null; since: string | null }>>(new Map());
  useEffect(() => {
    if (!peerTickersKey) return;
    let active = true;
    apiGet<Array<{ ticker: string; ytdBaseClose?: number | null; ytdSince?: string | null }>>(
      `/live/peers-summary?tickers=${encodeURIComponent(peerTickersKey)}`,
    )
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setPeerYtdBase((prev) => {
          const next = new Map(prev);
          for (const r of rows) next.set(r.ticker, { base: r.ytdBaseClose ?? null, since: r.ytdSince ?? null });
          return next;
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [peerTickersKey]);

  // Expandable sections state
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [showSigHow, setShowSigHow] = useState(false);
  const [showAssessEv, setShowAssessEv] = useState(false);
  const [showAttHow, setShowAttHow] = useState(false);
  const [showReadme, setShowReadme] = useState(false);

  // Thesis Lab interactive state
  const [labDir, setLabDir] = useState<"Bull" | "Bear">("Bull");
  const [labHz, setLabHz] = useState<string>("6M");
  const [labMode, setLabMode] = useState<"NORMAL" | "ADVANCED">("NORMAL");
  const [labWeightsState, setLabWeightsState] = useState<Record<string, number> | null>(null);
  const [targetOverride, setTargetOverride] = useState<number | null>(null);
  const [stopOverride, setStopOverride] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedLabDrivers, setExpandedLabDrivers] = useState<Record<string, boolean>>({});
  const [labEditTargets, setLabEditTargets] = useState(false);
  // Trade Builder: three set-up steps first (direction, horizon, mode), then Run shows the trade.
  const [labStarted, setLabStarted] = useState(false);
  const [pickDir, setPickDir] = useState<"Bull" | "Bear" | null>(null);
  const [pickHz, setPickHz] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<"NORMAL" | "ADVANCED" | null>(null);
  const [labSaveOpen, setLabSaveOpen] = useState(false);
  const [labSavedNote, setLabSavedNote] = useState<string | null>(null);
  const [labExplainerOpen, setLabExplainerOpen] = useState(false);
  const [labWeightsDialog, setLabWeightsDialog] = useState(false);
  const [labBreakdownOpen, setLabBreakdownOpen] = useState<Record<string, boolean>>({});
  // A new stock starts from an empty set-up.
  useEffect(() => {
    queueMicrotask(() => {
      setLabStarted(false);
      setPickDir(null);
      setPickHz(null);
      setPickMode(null);
      setLabSavedNote(null);
    });
  }, [siTicker]);
  // The set-up page opens at the top, whatever the last tab's scroll position was.
  useEffect(() => {
    if (activeTab !== "lab" || labStarted || typeof window === "undefined") return;
    const toTop = () => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      document.querySelectorAll("main.main, .main").forEach((el) => {
        if (el.scrollTop > 0) el.scrollTop = 0;
      });
    };
    toTop();
    const raf = requestAnimationFrame(toTop);
    const timer = setTimeout(toTop, 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [activeTab, labStarted]);
  /** Back to the empty three-step set-up (after a save). */
  const resetBuilder = () => {
    setLabStarted(false);
    setPickDir(null);
    setPickHz(null);
    setPickMode(null);
    setLabWeightsState(null);
    setTargetOverride(null);
    setStopOverride(null);
    setLabEditTargets(false);
    setLabBreakdownOpen({});
  };

  // Thesis Monitor state
  const [monScenario, setMonScenario] = useState<"live" | "cut" | "break" | "surge">("live");
  const [confirmDeleteThesis, setConfirmDeleteThesis] = useState(false);
  // Every trade saved for the open stock (newest first) and the one shown on the right.
  // A stock can hold several: a bullish and a bearish set-up, or different horizons.
  const [savedTrades, setSavedTrades] = useState<SavedTrade[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  // Only this stock's trades: right after switching stocks the list still holds the previous stock's until it reloads.
  const stockTrades = savedTrades.filter((t) => t.ticker === currentTicker);
  const savedThesis: SavedTrade | null = stockTrades.find((t) => t.id === selectedTradeId) ?? stockTrades[0] ?? null;

  // Watchlist state

  // AI interactive prompt state
  const [aiQuery, setAiQuery] = useState("");
  const [aiChat, setAiChat] = useState<Array<{ role: "user" | "assistant"; text: string; note?: string }>>([]);
  const [aiBusy, setAiBusy] = useState(false);

  // Fundamentals tab: the bar picked in each metric card, keyed `${ticker}:${cardIndex}`.
  const [fundSel, setFundSel] = useState<Record<string, number>>({});

  // Load the open stock's saved trades from localStorage (see saved-trades.ts).
  useEffect(() => {
    if (!currentTicker) return;
    try {
      const found = readTrades(localStorage, currentTicker);
      // Keep the SAME array when nothing changed. `stock` is rebuilt whenever any
      // data input re-renders, and storing a fresh array here every time re-rendered
      // again — a loop (React's "Maximum update depth exceeded") that starved the
      // router, so nothing else could be clicked.
      setSavedTrades(prev => (JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
    } catch { }
  }, [currentTicker, stock]);

  // Every trade saved in this browser, for the Trade Tracker's list. Re-read when
  // the tab opens, the open stock changes, or a trade is saved or removed.
  const [trackedTrades, setTrackedTrades] = useState<TrackedTrade[]>([]);
  useEffect(() => {
    try {
      const found: TrackedTrade[] = listAllTrades(localStorage).map((t) => ({
        id: t.id, ticker: t.ticker, dir: t.dir, hz: t.hz, target: t.target, stop: t.stop, entryPx: t.entryPx, savedAt: t.savedAt,
      }));
      // Same array when nothing changed, so this can never feed a render loop.
      setTrackedTrades(prev => (JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
    } catch { }
  }, [activeTab, currentTicker, savedTrades]);

  // Handle stock selection
  const handleSelectStock = (ticker: string) => {
    const clean = ticker.toUpperCase().trim();
    if (typeof window !== "undefined") {
      localStorage.setItem("iq-stock", clean);
    }
    setSiTicker(clean);
    setSearchQuery("");
    setSearchFocused(false);
    router.push(`/si?sym=${clean}`);
  };

  // Trade Tracker list: open that stock's trade. The simulation and the
  // "Remove this trade?" prompt belong to the trade that was open, so they reset
  // rather than carry over to the next one.
  const selectTrackedTrade = (trade: TrackedTrade) => {
    setMonScenario("live");
    setConfirmDeleteThesis(false);
    setSelectedTradeId(trade.id);
    if (trade.ticker !== currentTicker) handleSelectStock(trade.ticker);
  };

  /** Delete one saved trade (any stock's, from the list or the open trade's Remove button). */
  const removeSavedTrade = (trade: { id: string; ticker: string }) => {
    try {
      const next = removeTrade(readTrades(localStorage, trade.ticker), trade.id);
      writeTrades(localStorage, trade.ticker, next);
      if (trade.ticker === currentTicker) setSavedTrades(next);
      else setTrackedTrades(prev => prev.filter(t => t.id !== trade.id));
    } catch { }
    if (selectedTradeId === trade.id) setSelectedTradeId(null);
    setConfirmDeleteThesis(false);
    setMonScenario("live");
  };

  // Format assistant replies: render bold markdown cleanly and strip stray **
  const formatAiChatReply = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, lIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={lIdx} style={{ height: 8 }} />;
      }
      const isBullet = trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ");
      const cleanLine = isBullet ? trimmed.replace(/^[•\-\*]\s*/, "") : line;
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
      const content = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={pIdx} style={{ color: "var(--si-text-hi, #ffffff)", fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        // A lone *word* is italics (models add one to the closing disclaimer).
        return part
          .replace(/\*\*/g, "")
          .split(/(\*[^*\s][^*]*\*)/g)
          .map((seg, sIdx) =>
            seg.length > 2 && seg.startsWith("*") && seg.endsWith("*") ? <em key={`${pIdx}-${sIdx}`}>{seg.slice(1, -1)}</em> : seg,
          );
      });

      if (isBullet) {
        return (
          <div key={lIdx} style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 4, alignItems: "flex-start" }}>
            <span style={{ color: "var(--si-accent, #5980a6)", flex: "none" }}>•</span>
            <div style={{ flex: 1 }}>{content}</div>
          </div>
        );
      }

      return (
        <div key={lIdx} style={{ marginTop: 2, marginBottom: 4 }}>
          {content}
        </div>
      );
    });
  };

  // Ask AI copilot function
  const handleAskAI = (promptText?: string) => {
    const q = (promptText || aiQuery).trim();
    // One question at a time: a second click used to start another model call
    // while the first was still running, and the replies could land out of order.
    if (!q || !stock || !stockDetail || aiBusy) return;

    // Earlier turns, so a follow-up ("why?") has its subject. `aiChat` is the
    // state before this question was added.
    const history = aiChat.slice(-6).map((m) => ({ role: m.role, text: m.text }));

    setAiChat((prev) => [...prev, { role: "user", text: q }]);
    if (!promptText) setAiQuery("");
    setAiBusy(true);

    // The data the model may use. Missing values are left out, so the model sees
    // "not provided" rather than a null it might read as zero.
    const compact = (o: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(
        Object.entries(o).filter(([, v]) => {
          if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) return false;
          return !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
        }),
      );
    const r = (v: number | null, digits = 2) => (v == null ? null : +v.toFixed(digits));
    const f = siFacts;
    const context = compact({
      name: stock.name,
      price: stock.p,
      changePct: r(stock.c),
      marketCap: realMcap,
      sector: stock.sector,
      setup: stock.setup,
      signalCategoriesConfirming: `${stock.cf} of 7`,
      thesisScore: stock.conf,
      trailingPE: stock.pe,
      forwardPE: stock.fpe,
      movingAverages: compact({ dma9: f.sma9, dma21: f.sma21, dma50: f.sma50, dma200: f.sma200 }),
      momentum: compact({
        rsi14: r(f.rsi14, 0),
        relativeVolume: r(f.rvol),
        rsRating: f.rsRating,
        pctFromHigh52: r(f.pctFromHigh52, 1),
        beta: r(f.beta),
        realizedVol30: r(f.realizedVol30, 0),
      }),
      levels: compact({ support1: f.pivotS1, support2: f.pivotS2, resistance1: f.pivotR1, resistance2: f.pivotR2 }),
      analysts: compact({
        consensus: f.consensus,
        buy: f.buyCount,
        hold: f.holdCount,
        sell: f.sellCount,
        meanTarget: f.targetMean,
        upgrades90d: f.upgrades90,
        downgrades90d: f.downgrades90,
      }),
      fundamentals: compact({
        revenueGrowthYoYPct: r(f.revGrowthYoY, 1),
        grossMarginPct: r(f.grossMargin, 1),
        operatingMarginPct: r(f.opMargin, 1),
        epsBeatsOfLastReports: f.epsBeats != null && f.epsReports != null ? `${f.epsBeats} of ${f.epsReports}` : null,
        epsThisFY: f.fwdEps,
        epsNextFY: f.nextFyEps,
      }),
      positioning: compact({
        institutionalOwnershipPct: r(f.instOwnershipPct, 1),
        filers13FChangeQoQ: f.instHoldersChange,
        shares13FChange: f.instSharesChange,
        insiderNetUsd90d: r(f.insiderNet90, 0),
        putCall13F: r(f.instPutCallRatio),
      }),
      signals: stock.sig,
      invalidation: stockDetail.invalid.map(([title, cond]) => `${title}: ${cond}`),
      alreadyBroken: stockDetail.broken.map(([title, cond]) => `${title}: ${cond}`),
      upcoming: upcomingCatalysts.filter((c) => !c.past).slice(0, 4).map((c) => `${c.date} (${c.days}): ${c.n}. ${c.txt}`),
      today: stockDetail.movedTxt,
      peers: peersAll.slice(0, 5).map((p) => `${p.t}: P/E ${p.peRatio != null ? p.peRatio.toFixed(1) : "n/a"}, ${p.c != null ? pct(p.c) : "n/a"} today`),
      newsSummary: aiAnalysisDoc?.analysis?.newsSummary,
      technicalSummary: aiAnalysisDoc?.analysis?.technicalSummary,
      // The names the server's no-model summary reads.
      change: r(stock.c),
      mcap: realMcap,
      pe: stock.pe,
      fpe: stock.fpe,
    });

    // The reply when no live model answered: tied to what was asked, from the
    // data on this page (it used to be one generic summary for every question).
    const answerLocally = (why: string) =>
      setAiChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: localCopilotAnswer(q, {
            sym: stock.t,
            price: stock.p,
            changePct: stock.c,
            setup: stock.setup,
            confluence: stock.cf,
            facts: siFacts,
            signals: stock.sig,
            invalid: stockDetail.invalid,
            broken: stockDetail.broken,
            catalysts: upcomingCatalysts.filter((c) => !c.past).map((c) => ({ date: c.date, days: c.days, n: c.n, txt: c.txt })),
            peers: peersAll.map((p) => ({ t: p.t, pe: p.peRatio, changePct: p.c })),
            movedTxt: stockDetail.movedTxt,
          }),
          note: why,
        },
      ]);

    apiPost<{ reply?: string; provider?: string }>("/live/copilot", {
      ticker: stock.t,
      question: q,
      query: q,
      history,
      context,
    })
      .then((res) => {
        // "deterministic-synthesis" is the server saying no model replied.
        if (res?.reply?.trim() && res.provider !== "deterministic-synthesis") {
          setAiChat((prev) => [...prev, { role: "assistant", text: res.reply as string }]);
        } else {
          answerLocally("The live AI model did not reply, so this read is built from the data on this page.");
        }
      })
      .catch(() => {
        answerLocally("The live AI model did not reply in time, so this read is built from the data on this page.");
      })
      .finally(() => {
        setAiBusy(false);
      });
  };

  // These two memos must stay ABOVE the empty-state return below: a hook placed
  // after it runs only when a stock is open, so going from the home view to a
  // stock changed the hook count and React threw "Rendered more hooks than
  // during the previous render".

  // Check if we have real revenue and EPS growth from financialsDoc (FMP)
  const realFundGrowth = useMemo(() => {
    if (!financialsDoc?.quarters || financialsDoc.quarters.length < 5) return null;
    // Revenue and GAAP diluted EPS growth vs the same fiscal period a year earlier.
    return quarterYoY(financialsDoc.quarters);
  }, [financialsDoc]);

  // Real market cap format
  const stockMcap = stock?.mcap ?? "";
  const realMcap = useMemo(() => {
    if (liveCompany?.marketCap) {
      const mc = liveCompany.marketCap;
      if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
      if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
      if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
    }
    return stockMcap;
  }, [liveCompany, stockMcap]);

  // Overview Price History chart calculations. Kept above the early return
  // below so the hook order is the same with or without a loaded stock.
  const priceSeries = useMemo(() => {
    if (overviewBars && overviewBars.length >= 2) {
      const closes = overviewBars.map((b) => b.c);
      if (stock?.p != null && stock.p > 0 && closes.length > 0) {
        closes[closes.length - 1] = stock.p;
      }
      return closes;
    }
    return [];
  }, [overviewBars, stock?.p]);

  // ----------------------------------------------------
  // EMPTY STATE (NO STOCK SELECTED YET)
  // ----------------------------------------------------
  if (!stock || !stockDetail) {
    return (
      <div
        className="si-screen"
        data-theme={theme}
        style={{
          minHeight: "100vh",
          background: "var(--si-bg, #080b10)",
          color: "var(--si-text-hi, #e8eef4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          paddingBottom: 120,
          position: "relative",
        }}
      >

        <style>{`
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: rgba(12, 17, 24, 0.9);
          --si-card-solid: #0c1118;
          --si-card-sec: #0e151d;
          --si-card-tert: #111822;
          --si-card-tint: rgba(12, 17, 24, 0.8);
          --si-border: #1c2733;
          --si-border-sec: #2a3a4a;
          --si-border-dashed: #2a3a4a;
          --si-text-hi: #e8eef4;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-input-bg: #0c1118;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: rgba(12, 17, 24, 0.9);
          --si-card-solid: #0c1118;
          --si-card-sec: #0e151d;
          --si-card-tert: #111822;
          --si-card-tint: rgba(12, 17, 24, 0.8);
          --si-border: #1c2733;
          --si-border-sec: #2a3a4a;
          --si-border-dashed: #2a3a4a;
          --si-text-hi: #e8eef4;
          --si-text-body: #d5dfe9;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-evidence-bg: rgba(89, 128, 166, 0.08);
          --si-evidence-title: #a9c6e3;
          --si-input-bg: #0c1118;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen[data-theme="light"],
        .iq-root[data-theme="light"] .si-screen {
          --si-bg: #f4f6fa;
          --si-topbar: rgba(255,255,255,0.96);
          --si-card: #ffffff;
          --si-card-solid: #ffffff;
          --si-card-sec: #f8fafc;
          --si-card-tert: #f1f5f9;
          --si-card-tint: rgba(255, 255, 255, 0.95);
          --si-border: #e2e8f0;
          --si-border-sec: #cbd5e1;
          --si-border-dashed: #94a3b8;
          --si-text-hi: #07080a;
          --si-text-body: #0f172a;
          --si-text-mid: #1e293b;
          --si-text-dim: #334155;
          --si-text-sub: #475569;
          --si-accent: #1d4ed8;
          --si-accent-soft: #2563eb;
          --si-accent-light: #07080a;
          --si-accent-bg: rgba(37, 99, 235, 0.08);
          --si-accent-btn: #1d4ed8;
          --si-evidence-bg: #f1f5f9;
          --si-evidence-title: #07080a;
          --si-input-bg: #ffffff;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .si-screen[data-theme="light"] input,
        .iq-root[data-theme="light"] .si-screen input {
          color: #0f172a !important;
        }
        .si-screen[data-theme="light"] input::placeholder,
        .iq-root[data-theme="light"] .si-screen input::placeholder {
          color: #94a3b8 !important;
        }
      `}</style>

        <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10, padding: "0 24px" }}>
          <ModuleSwitcher />
          <div style={{ position: "absolute", right: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={toggleTheme}
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            style={{
              height: 34,
              width: 34,
              padding: 0,
              border: "1px solid var(--si-border-sec, #2a3a4a)",
              background: "var(--si-card-solid, #0c1118)",
              color: "var(--si-text-hi, #e8eef4)",
              fontFamily: "'Manrope', sans-serif",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              transition: "all 150ms ease",
            }}
          >
            {isLight ? (
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
          <ProfileMenu />
          </div>
        </div>
        <div style={{ maxWidth: 640, width: "100%", textAlign: "center", marginTop: 40 }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "var(--si-text-hi, #e8eef4)",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            STOCK INTELLIGENCE
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.22em",
              color: "var(--si-accent, #5980a6)",
              marginBottom: 28,
            }}
          >
            DEEP-DIVE RESEARCH & THESIS ENGINE
          </div>

          <p
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 15,
              color: "var(--si-text-mid, #93a1af)",
              lineHeight: 1.6,
              marginBottom: 36,
            }}
          >
            Search any ticker to generate an institutional-grade breakdown covering factor attribution, forward scenario modeling, thesis stress-testing, and live technicals.
          </p>

          {/* Large Global Search Field */}
          <div style={{ position: "relative", marginBottom: 36, textAlign: "left" }}>
            <div
              style={{
                height: 52,
                border: "1px solid var(--si-border-sec, #2a3a4a)",
                background: "var(--si-card-solid, #0c1118)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0 18px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--si-accent, #5980a6)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    e.preventDefault();
                    handleSelectStock(searchQuery.trim());
                  }
                }}
                placeholder="Search tickers (e.g. NVDA, AAPL, MSFT, META, TSLA, STRL)…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--si-text-hi, #e8eef4)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 15,
                }}
              />
            </div>

            {/* Autocomplete Dropdown */}
            {searchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
              <div
                style={{
                  position: "absolute",
                  top: 58,
                  left: 0,
                  right: 0,
                  background: "var(--si-card-solid, #0c1118)",
                  border: "1px solid #5980a6",
                  borderRadius: 8,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                  zIndex: 50,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {searchResults.slice(0, 8).map((r) => (
                  <div
                    key={r.ticker}
                    onMouseDown={() => handleSelectStock(r.ticker)}
                    style={{
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--si-border, #1c2733)",
                    }}
                  >
                    <StockLogo sym={r.ticker} size={24} />
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--si-text-hi, #e8eef4)",
                        width: 60,
                      }}
                    >
                      {r.ticker}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "'Manrope', sans-serif",
                        fontSize: 13,
                        color: "var(--si-text-mid, #93a1af)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.name || r.ticker}
                    </span>
                    {r.price != null && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-hi, #e8eef4)" }}>
                        {usd(r.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick-Access Stock Chips */}
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--si-accent, #5980a6)",
                marginBottom: 12,
              }}
            >
              POPULAR STOCKS WITH FULL COVERAGE
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {ORDER.map((sym) => {
                const chg = popularQuotes.get(sym)?.pctChange ?? null;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectStock(sym);
                    }}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                      border: "1px solid var(--si-border-sec, #2a3a4a)",
                      borderRadius: 6,
                      color: "var(--si-text-hi, #e8eef4)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <StockLogo sym={sym} size={18} />
                    <span>{sym}</span>
                    {chg != null && <span style={{ fontSize: 11, color: chg >= 0 ? UP : DN }}>{pct(chg)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // LOADED STOCK INTELLIGENCE DASHBOARD
  // ----------------------------------------------------
  const color = stock.c >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)";

  const hasRealBars = priceSeries.length >= 2;
  const curFallbackPrice = stock.p || 1;
  const minP = hasRealBars ? Math.min(...priceSeries) : curFallbackPrice * 0.98;
  const maxP = hasRealBars ? Math.max(...priceSeries) : curFallbackPrice * 1.02;
  const rangeDiff = maxP - minP || 1;
  const pStart = hasRealBars ? priceSeries[0] : curFallbackPrice;
  const pEnd = hasRealBars ? priceSeries[priceSeries.length - 1] : curFallbackPrice;
  const chartCol = pEnd >= pStart ? "var(--up, #16a34a)" : "var(--down, #dc2626)";

  // SVG path coordinates
  const svgW = 1000;
  const svgH = 320;
  const pathD = hasRealBars
    ? priceSeries
      .map((val, idx) => {
        const x = (idx / (priceSeries.length - 1)) * svgW;
        const y = svgH - ((val - minP) / rangeDiff) * (svgH - 28) - 14;
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ")
    : "";
  const areaD = pathD ? `${pathD} L ${svgW} ${svgH} L 0 ${svgH} Z` : "";

  // Y-axis price ticks (matching Technicals CandleChart price scale).
  // Plain computation, NOT a hook: this runs after the empty-state early
  // return above, so a hook here would crash the SI home <-> stock switch
  // (React error #310). Five ticks — nothing worth memoizing.
  const yTicks = !hasRealBars || rangeDiff <= 0
    ? []
    : [1.0, 0.75, 0.50, 0.25, 0.0].map((frac) => {
      const val = minP + frac * rangeDiff;
      const y = svgH - ((val - minP) / rangeDiff) * (svgH - 28) - 14;
      return { y, val };
    });

  // Dynamic X-axis & Tooltip generation based exclusively on authentic bar timestamps
  const getLabelAtFrac = (f: number, isHover = false) => {
    if (overviewBars && overviewBars.length >= 2) {
      const idx = Math.max(0, Math.min(overviewBars.length - 1, Math.round(f * (overviewBars.length - 1))));
      const bar = overviewBars[idx];
      const d = new Date(bar.t);
      if (range === "1D") {
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      }
      if (range === "5D") {
        if (isHover) {
          return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
        }
        return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
      }
      if (range === "1M" || range === "3M" || range === "6M") {
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
      }
      if (range === "1Y") {
        return d.toLocaleDateString("en-US", { month: "short", year: isHover ? "numeric" : "2-digit", timeZone: "America/New_York" });
      }
      return d.toLocaleDateString("en-US", { month: isHover ? "short" : undefined, year: "numeric", timeZone: "America/New_York" });
    }
    return "";
  };

  const axisLabels = hasRealBars ? [0, 0.25, 0.5, 0.75, 1].map((f) => getLabelAtFrac(f, false)) : [];

  // Crosshair calculations
  let hoverInfo: { leftPct: number; topPct: number; priceVal: number; label: string } | null = null;
  if (hoverFrac !== null && hasRealBars) {
    const idx = Math.max(0, Math.min(priceSeries.length - 1, Math.round(hoverFrac * (priceSeries.length - 1))));
    const pVal = priceSeries[idx];
    const leftPct = (idx / (priceSeries.length - 1)) * 100;
    const yPx = svgH - ((pVal - minP) / rangeDiff) * (svgH - 28) - 14;
    const topPct = (yPx / svgH) * 100;
    hoverInfo = {
      leftPct,
      topPct,
      priceVal: pVal,
      label: getLabelAtFrac(hoverFrac, true),
    };
  }

  // Stats definition for Overview header
  const peVal = liveCompany?.peRatio ?? stock.pe;
  const fpeVal = liveCompany?.forwardPe ?? stock.fpe;
  const r52 = range52(
    { high: liveCompany?.high52 ?? stock.hi, low: liveCompany?.low52 ?? stock.lo },
    { high: sharedQuote?.dayHigh, low: sharedQuote?.dayLow },
  );
  const hi52 = r52.high;
  const lo52 = r52.low;
  const MCAP_BLUE = "#4fb3ff";
  const growthColor = (v: number | null | undefined) => (v == null ? undefined : v >= 0 ? UP : DN);

  // Overview signal scores, confidence and confluence come from the same
  // 6-month bullish forward run as the "Why it could move" tab, so the two
  // never disagree (the old fallback showed fixed 88/87/80/… for every stock).
  const overviewRun = thesisRun(stock.t, "Bull", "6M", undefined, undefined, siFacts);
  const movedWeek = weekMove(stock.t, sixMonthBars, tickerNews as unknown as Parameters<typeof weekMove>[2]);
  const mcConfidence = overviewRun.conf != null ? Math.round(overviewRun.conf) : null;
  const mcConfidenceColor = overviewRun.conf == null ? STEEL : sc(Math.round(overviewRun.conf));
  /** How many of the 7 signal categories score 75 or more. */
  const confluenceCount = overviewRun.cats.filter((c) => Math.round(c.score) >= 75).length;
  const confluenceColor = confluenceCount >= 5 ? UP : confluenceCount >= 3 ? STEEL : confluenceCount === 2 ? "#f5b031" : DN;

  type HeroStat = { k: string; v: string; col?: string; node?: React.ReactNode; link?: boolean };
  const statsRow: HeroStat[] = [
    { k: "MARKET CAP", v: realMcap || "—", col: MCAP_BLUE },
    { k: "P/E", v: peVal != null ? `${peVal.toFixed(1)}×` : "—", col: MCAP_BLUE },
    { k: "REVENUE GROWTH", v: realFundGrowth?.revYoy != null ? pct1(realFundGrowth.revYoy) : (stock.rev != null ? pct1(stock.rev) : "—"), col: growthColor(realFundGrowth?.revYoy ?? stock.rev) },
    { k: "EPS GROWTH", v: realFundGrowth?.epsYoy != null ? pct1(realFundGrowth.epsYoy) : (stock.eps != null ? pct1(stock.eps) : "—"), col: growthColor(realFundGrowth?.epsYoy ?? stock.eps) },
    {
      k: "52W LOW / HIGH",
      v: `${lo52 != null ? usd(lo52) : "—"} / ${hi52 != null ? usd(hi52) : "—"}`,
      node: (
        <>
          <span style={{ color: DN }}>{lo52 != null ? usd(lo52) : "—"}</span>
          {" / "}
          <span style={{ color: UP }}>{hi52 != null ? usd(hi52) : "—"}</span>
        </>
      ),
    },
    {
      k: "MC CONFIDENCE",
      v: mcConfidence != null ? `${mcConfidence} / 100` : "—",
      col: mcConfidenceColor,
      link: true,
      node:
        mcConfidence != null ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 84,
                height: 84,
                borderRadius: "50%",
                border: `4px solid ${mcConfidenceColor}`,
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {mcConfidence}
            </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--si-text-sub, #5d6b79)" }}>/ 100</span>
          </span>
        ) : undefined,
    },
  ];
  const scrollToSignals = () => document.getElementById("si-signals")?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Technical Read card: shown on Overview and on the Technicals tab.
  const technicalReadCard = (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--si-border, #1c2733)",
        background: "var(--si-card, #0c1118)",
        boxShadow: "var(--si-shadow, none)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >

      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
        ✦ TECHNICAL READ
        <InfoTip lines={TECHNICAL_READ_INFO} />
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {stockDetail.read.map((rd, i) => (
          <div key={i} style={{ border: `1px solid ${rd.col}`, background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.14em", color: "var(--si-text-hi, #ffffff)", opacity: 0.7 }}>
              {rd.k}
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800, color: rd.col }}>
              {rd.v}
            </div>
          </div>
        ))}
      </div>
      {(() => {
        const rows = trendRows(siFacts.price, siFacts.sma50, siFacts.sma200, siFacts.rsi14);
        // No moving-average data at all: keep the plain sentence ("not available yet").
        if (rows.length === 0) {
          return (
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.55 }}>
              {trendRead(siFacts.price, siFacts.sma50, siFacts.sma200)}
            </div>
          );
        }
        const col = (t: TrendRow["tone"]) => (t === "good" ? "var(--up, #16a34a)" : t === "bad" ? "var(--down, #dc2626)" : t === "warn" ? "#f5b031" : "var(--si-text-mid, #93a1af)");
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((r) => (
              <div key={r.title} style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 10, alignItems: "baseline", padding: "9px 0", borderTop: "1px solid var(--si-border, #1c2733)" }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{r.title}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: col(r.tone), whiteSpace: "pre" }}>{r.value}</span>
                {r.note && (
                  <span style={{ gridColumn: "1 / 3", fontFamily: "'Manrope', sans-serif", fontSize: 14, lineHeight: 1.45, color: "var(--si-text-mid, #93a1af)", marginTop: 2 }}>{r.note}</span>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  type SignalScoreItem = { name: string; val: number; color: string; widthPct: string };
  const signalScores: SignalScoreItem[] = overviewRun.cats.map((cat) => {
    const val = Math.round(cat.score);
    return {
      name: String(SHORT[cat.k] || cat.label).toUpperCase(),
      val,
      color: sc(val),
      widthPct: `${val}%`,
    };
  });

  if (isUnsubscribed) {
    return (
      <div
        className="si-screen"
        data-theme={theme}
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--si-bg, #080b10)",
          color: "var(--si-text-hi, #e8eef4)",
          padding: "80px 20px",
        }}
      >
        <LockedFeature entitlement="stockIntelligence" requiredPlan="starter" />
      </div>
    );
  }

  return (
    <div
      className="si-screen"
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: "var(--si-bg, #080b10)",
        color: "var(--si-text-hi, #e8eef4)",
        paddingBottom: 120, // Issue 8 fix: generous padding at bottom
      }}
    >

      <style>{`
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: rgba(12, 17, 24, 0.9);
          --si-card-solid: #0c1118;
          --si-card-sec: #0e151d;
          --si-card-tert: #111822;
          --si-card-tint: rgba(12, 17, 24, 0.8);
          --si-border: #1c2733;
          --si-border-sec: #2a3a4a;
          --si-border-dashed: #2a3a4a;
          --si-text-hi: #e8eef4;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-input-bg: #0c1118;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: rgba(12, 17, 24, 0.9);
          --si-card-solid: #0c1118;
          --si-card-sec: #0e151d;
          --si-card-tert: #111822;
          --si-card-tint: rgba(12, 17, 24, 0.8);
          --si-border: #1c2733;
          --si-border-sec: #2a3a4a;
          --si-border-dashed: #2a3a4a;
          --si-text-hi: #e8eef4;
          --si-text-body: #d5dfe9;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-evidence-bg: rgba(89, 128, 166, 0.08);
          --si-evidence-title: #a9c6e3;
          --si-input-bg: #0c1118;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen[data-theme="light"],
        .iq-root[data-theme="light"] .si-screen {
          --si-bg: #f4f6fa;
          --si-topbar: rgba(255,255,255,0.96);
          --si-card: #ffffff;
          --si-card-solid: #ffffff;
          --si-card-sec: #f8fafc;
          --si-card-tert: #f1f5f9;
          --si-card-tint: rgba(255, 255, 255, 0.95);
          --si-border: #e2e8f0;
          --si-border-sec: #cbd5e1;
          --si-border-dashed: #94a3b8;
          --si-text-hi: #07080a;
          --si-text-body: #0f172a;
          --si-text-mid: #1e293b;
          --si-text-dim: #334155;
          --si-text-sub: #475569;
          --si-accent: #1d4ed8;
          --si-accent-soft: #2563eb;
          --si-accent-light: #07080a;
          --si-accent-bg: rgba(37, 99, 235, 0.08);
          --si-accent-btn: #1d4ed8;
          --si-evidence-bg: #f1f5f9;
          --si-evidence-title: #07080a;
          --si-input-bg: #ffffff;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .si-screen[data-theme="light"] input,
        .iq-root[data-theme="light"] .si-screen input {
          color: #0f172a !important;
        }
        .si-screen[data-theme="light"] input::placeholder,
        .iq-root[data-theme="light"] .si-screen input::placeholder {
          color: #94a3b8 !important;
        }
        /* ── Phone (≤760px): the stat columns stack under the name instead of crushing to one character a line ── */
        @media (max-width: 1300px) { .si-hero-stat > div:last-child { white-space: normal !important; overflow-wrap: anywhere; } }
        @media (max-width: 760px) {
          .si-main { padding: 14px 12px 100px !important; }
          .si-hero { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .si-hero-id { grid-column: 1 / -1; min-width: 0 !important; border-right: none !important; border-bottom: 1px solid var(--si-border, #1c2733); }
          .si-hero-stat { border-right: none !important; border-bottom: 1px solid var(--si-border, #1c2733); padding: 12px 14px !important; }
          .si-hero-stat:last-child { grid-column: 1 / -1; border-bottom: none; }
          .si-ph-head { height: auto !important; flex-wrap: wrap; padding: 10px 12px !important; row-gap: 8px; }
          .si-ph-head > div { margin-left: 0 !important; flex-wrap: wrap; }
        }
      `}</style>

      {/* ====================================================
          STICKY TOP NAVIGATION BAR (Integrated SISwitcher)
          ==================================================== */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--si-topbar, rgba(8,11,16,0.96))",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--si-border, #1c2733)",
        }}
      >
        <div
          style={{
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "8px 24px",
            flexWrap: "wrap",
          }}
        >
          {/* Logo & Subtitle: unclickable brand text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "none",
              borderRight: "1px solid var(--si-border, #1c2733)",
              paddingRight: 16,
              userSelect: "none",
            }}
          >
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--si-text-hi, #e8eef4)",
                lineHeight: 1,
              }}
            >
              STOCK INTELLIGENCE
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.2em",
                color: "var(--si-accent, #5980a6)",
                marginTop: 3,
              }}
            >
              BY MARKETCATALYST
            </span>
          </div>

          {/* Home Button -> returns to search bar page (/si) */}
          <button
            type="button"
            onClick={goToSearch}
            title="Return to Stock Intelligence Search (/si)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 11px",
              border: "1px solid var(--si-border-sec, #2a3a4a)",
              borderRadius: 6,
              background: "var(--si-card-tint, rgba(12, 17, 24, 0.8))",
              color: "var(--si-accent-light, #a9c6e3)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(89, 128, 166, 0.22)";
              e.currentTarget.style.borderColor = "#7fa8d0";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(12, 17, 24, 0.8)";
              e.currentTarget.style.borderColor = "#2a3a4a";
              e.currentTarget.style.color = "#a9c6e3";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            HOME
          </button>

          {/* Search Bar */}
          <div className="si-nav-search" style={{ position: "relative", width: 220, flex: "none" }}>
            <div
              style={{
                height: 34,
                border: "1px solid var(--si-border, #1c2733)",
                background: "var(--si-card-solid, #0c1118)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 10px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--si-accent, #5980a6)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    e.preventDefault();
                    handleSelectStock(searchQuery.trim());
                  }
                }}
                placeholder="Search tickers…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--si-text-hi, #e8eef4)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                }}
              />
            </div>
            {searchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
              <div
                style={{
                  position: "absolute",
                  top: 38,
                  left: 0,
                  right: 0,
                  background: "var(--si-card-solid, #0c1118)",
                  border: "1px solid #5980a6",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                  zIndex: 50,
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {searchResults.slice(0, 6).map((r) => (
                  <div
                    key={r.ticker}
                    onMouseDown={() => handleSelectStock(r.ticker)}
                    style={{
                      height: 42,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "0 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--si-border, #1c2733)",
                    }}
                  >
                    <StockLogo sym={r.ticker} size={20} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: "var(--si-text-hi, #e8eef4)", width: 50 }}>
                      {r.ticker}
                    </span>
                    <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </span>
                    {r.price != null && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-hi, #e8eef4)" }}>
                        {usd(r.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Issue 5 Fix: Centered SISwitcher inside the header bar */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 290 }}>
            <ModuleSwitcher />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <button
              onClick={() => setActiveTab("ai")}
              style={{
                height: 34,
                padding: "0 12px",
                border: "none",
                background: "var(--si-accent-btn, #5980a6)",
                color: "#ffffff",
                fontFamily: "'Manrope', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 4,
              }}
            >
              ✦ AI Research
            </button>
            {/* Theme Toggle Button right beside AI Research */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isLight ? "Switch to dark mode" : "Switch to light mode"}
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              style={{
                height: 34,
                width: 34,
                padding: 0,
                border: "1px solid var(--si-border-sec, #2a3a4a)",
                background: "var(--si-card-solid, #0c1118)",
                color: "var(--si-text-hi, #e8eef4)",
                fontFamily: "'Manrope', sans-serif",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                transition: "all 150ms ease",
              }}
            >
              {isLight ? (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleWatch}
              disabled={watchBusy}
              title={watchMsg ?? (isWatched ? "In your Market Catalyst watchlist — click to remove" : "Add to your Market Catalyst watchlist")}
              style={{
                height: 34,
                padding: "0 12px",
                border: isWatched ? "1px solid #5980a6" : "1px solid #2a3a4a",
                background: isWatched ? "rgba(89,128,166,0.18)" : "transparent",
                color: "var(--si-text-hi, #e8eef4)",
                fontFamily: "'Manrope', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isWatched ? "✓ Watching" : "+ Watch"}
            </button>
            {watchMsg && (
              <span role="status" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--down, #dc2626)", maxWidth: 320 }}>{watchMsg}</span>
            )}
            <button
              onClick={() => setActiveTab("mon")}
              style={{
                height: 34,
                padding: "0 12px",
                border: "1px solid var(--si-border, #1c2733)",
                background: "transparent",
                color: "var(--si-text-hi, #e8eef4)",
                fontFamily: "'Manrope', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Track Trade
            </button>
            <ProfileMenu />
          </div>
        </div>

        {/* 9 Tab Navigation Rail */}
        <div style={{ display: "flex", gap: 0, padding: "0 24px", overflowX: "auto", borderTop: "1px solid var(--si-border, #1c2733)" }}>
          {TABS.map(([k, label]) => {
            const isActive = activeTab === k;
            return (
              <button
                key={k}
                onClick={() => setActiveTab(k as SITab)}
                style={{
                  position: "relative",
                  height: 44,
                  padding: "0 16px",
                  border: "none",
                  background: "transparent",
                  color: isActive ? "#6db3ff" : "var(--si-text-hi, #e8eef4)",
                  textShadow: isActive ? "0 0 10px rgba(79,163,255,0.75), 0 0 22px rgba(79,163,255,0.35)" : "none",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: isActive ? "inset 0 -2px 0 #4fa3ff, 0 6px 14px -6px rgba(79,163,255,0.6)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="si-main" style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 24px 120px 24px" }}>
        {/* ====================================================
            TAB 1: OVERVIEW (Issue 1 & 7 Complete Implementation)
            ==================================================== */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Header identity and key stats */}
            <div
              className="si-hero"
              style={{
                position: "relative",
                border: "1px solid var(--si-border, #1c2733)",
                background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                display: "grid",
                gridTemplateColumns: "auto repeat(2, minmax(0, 1fr)) minmax(max-content, 1.3fr) minmax(max-content, 1.5fr)",
              }}
            >
              {/* Identity: logo, ticker, name and price, with market cap and P/E underneath */}
              <div
                className="si-hero-id"
                style={{ padding: "14px 20px", borderRight: "1px solid var(--si-border, #1c2733)", minWidth: 260, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <StockLogo sym={stock.t} size={52} />
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: "0.06em", color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>
                        {stock.t}
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", marginTop: 4, whiteSpace: "nowrap" }}>
                        {stock.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                      {usd(stock.p)}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color }}>
                      {pct(stock.c)}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 28, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 10 }}>
                  {statsRow.slice(0, 2).map((st) => (
                    <div key={st.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", whiteSpace: "nowrap" }}>
                        {st.k}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 600, color: st.col ?? "var(--si-text-hi, #e8eef4)", whiteSpace: "nowrap" }}>
                        {st.node ?? st.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats: revenue growth, EPS growth, 52-week range, MC confidence */}
              {statsRow.slice(2).map((st, i, arr) => (
                <div
                  key={st.k}
                  className="si-hero-stat"
                  role={st.link ? "button" : undefined}
                  tabIndex={st.link ? 0 : undefined}
                  onClick={st.link ? scrollToSignals : undefined}
                  onKeyDown={st.link ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scrollToSignals(); } } : undefined}
                  style={{
                    cursor: st.link ? "pointer" : undefined,
                    padding: "14px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    borderRight: i !== arr.length - 1 ? "1px solid var(--si-border, #1c2733)" : "none",
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", whiteSpace: "nowrap" }}>
                    {st.k}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 600, color: st.col ?? "var(--si-text-hi, #e8eef4)", marginTop: 8, whiteSpace: "nowrap", lineHeight: 1.4 }}>
                    {st.node ?? st.v}
                  </div>
                  {st.link && (
                    <div style={{ marginTop: 6, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-accent-light, #a9c6e3)", whiteSpace: "nowrap" }}>
                      Click here to know more ↓
                    </div>
                  )}
                </div>
              ))}
            </div>

            <style>{`.si-ov{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(320px,1fr);gap:18px;align-items:start}@media (max-width:1050px){.si-ov{grid-template-columns:minmax(0,1fr)}}`}</style>
            <div className="si-ov">
              <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            {/* Price History Chart Card with Interactive Crosshair & Detailed X-Axis */}
            <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))" }}>
              <div className="si-ph-head" style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                  PRICE HISTORY
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                  {range} ·
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: chartCol }}>
                  {hasRealBars && pStart > 0 ? pct(((pEnd / pStart) - 1) * 100) : "—"}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {(["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        border: `1px solid ${range === r ? STEEL : "#1c2733"}`,
                        background: range === r ? "rgba(89,128,166,0.2)" : "transparent",
                        color: "var(--si-text-hi, #e8eef4)",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Canvas Area */}
              <div
                onMouseMove={(e) => {
                  if (!hasRealBars) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  setHoverFrac(f);
                }}
                onMouseLeave={() => setHoverFrac(null)}
                style={{ position: "relative", height: 320, margin: "14px 16px 10px", cursor: hasRealBars ? "crosshair" : "default" }}
              >
                {overviewBarsLoading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(12, 17, 24, 0.7)", zIndex: 10, backdropFilter: "blur(2px)" }}>
                    <div style={{ width: 24, height: 24, border: "2px solid #5980a6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-mid, #93a1af)", marginTop: 10 }}>
                      Loading {range} price bars…
                    </div>
                  </div>
                )}

                {!overviewBarsLoading && !hasRealBars && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>
                      Historical price bars unavailable for {range}
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--si-text-sub, #5d6b79)", marginTop: 4 }}>
                      Exchange vendor returned no bars for {stock.t} ({range})
                    </div>
                  </div>
                )}

                <svg width="100%" height="320" viewBox="0 0 1000 320" preserveAspectRatio="none" style={{ display: "block" }}>
                  {hasRealBars && yTicks.map((t, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      x2="1000"
                      y1={t.y}
                      y2={t.y}
                      stroke="var(--si-border-soft, #152029)"
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {!hasRealBars && (
                    <>
                      <line x1="0" x2="1000" y1="80" y2="80" stroke="#152029" vectorEffect="non-scaling-stroke" />
                      <line x1="0" x2="1000" y1="160" y2="160" stroke="#152029" vectorEffect="non-scaling-stroke" />
                      <line x1="0" x2="1000" y1="240" y2="240" stroke="#152029" vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                  {hasRealBars && (
                    <>
                      <path d={areaD} fill={chartCol} opacity="0.1" />
                      <path d={pathD} fill="none" stroke={chartCol} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                </svg>

                {/* Right Y-Axis Price Scale Labels (Matches Technicals Y-axis display) */}
                {hasRealBars && yTicks.length > 0 && (
                  <div style={{ position: "absolute", right: 8, top: 0, bottom: 0, width: 70, pointerEvents: "none", zIndex: 6 }}>
                    {yTicks.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: t.y,
                          transform: "translateY(-50%)",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--si-text-sub, #5d6b79)",
                          letterSpacing: "0.02em",
                          background: "var(--si-card, #0c1118)",
                          padding: "1px 6px",
                          borderRadius: 2,
                          border: "1px solid var(--si-border, #1c2733)",
                          lineHeight: 1.2,
                        }}
                      >
                        {usd(t.val)}
                      </div>
                    ))}
                    {/* Current Price Marker Badge on Y-Axis */}
                    {pEnd > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: Math.max(14, Math.min(306, svgH - ((pEnd - minP) / rangeDiff) * (svgH - 28) - 14)),
                          transform: "translateY(-50%)",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#ffffff",
                          background: chartCol,
                          padding: "2px 7px",
                          borderRadius: 2,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                          zIndex: 8,
                          lineHeight: 1.2,
                        }}
                      >
                        {usd(pEnd)}
                      </div>
                    )}
                  </div>
                )}

                {/* Vertical Crosshair Line, Horizontal Line, Glowing Dot, and Floating Tooltip */}
                {hoverInfo && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${hoverInfo.leftPct}%`,
                        width: 1,
                        background: "rgba(127,168,208,0.45)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: `${hoverInfo.topPct}%`,
                        height: 1,
                        background: "rgba(127,168,208,0.35)",
                        pointerEvents: "none",
                      }}
                    />
                    {/* Hover Price Pill on Y-Axis */}
                    <div
                      style={{
                        position: "absolute",
                        right: 8,
                        top: `${hoverInfo.topPct}%`,
                        transform: "translateY(-50%)",
                        background: "#3b82f6",
                        color: "#ffffff",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 2,
                        pointerEvents: "none",
                        zIndex: 25,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                      }}
                    >
                      {usd(hoverInfo.priceVal)}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${hoverInfo.leftPct}%`,
                        top: `${hoverInfo.topPct}%`,
                        width: 10,
                        height: 10,
                        margin: "-5px 0 0 -5px",
                        borderRadius: 99,
                        background: "#e8eef4",
                        boxShadow: "0 0 0 4px rgba(127,168,208,0.35)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${hoverInfo.leftPct}%`,
                        top: 8,
                        transform: hoverInfo.leftPct > 70 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
                        background: "var(--si-card-solid, #0c1118)",
                        border: "1px solid #5980a6",
                        padding: "8px 12px",
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                        zIndex: 20,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                      }}
                    >
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-mid, #93a1af)" }}>
                        {hoverInfo.label}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", marginTop: 2 }}>
                        {usd(hoverInfo.priceVal)}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Dynamic Bottom Date/Time Axis (Issue 7 Fix) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0 16px 14px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: "var(--si-text-sub, #5d6b79)",
                }}
              >
                {axisLabels.map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>
            </div>

              {/* Signal scores */}
              <div
                id="si-signals"
                style={{
                  scrollMarginTop: 90,
                  border: "1px solid var(--si-border, #1c2733)",
                  background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-text-hi, #e8eef4)" }}>
                    SIGNAL SCORES
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                      Click a score for evidence
                    </span>
                    <button
                      onClick={() => setShowSigHow(!showSigHow)}
                      style={{
                        height: 24,
                        padding: "0 9px",
                        border: "1px solid var(--si-border-sec, #2a3a4a)",
                        background: "transparent",
                        color: "var(--si-accent-light, #a9c6e3)",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        cursor: "pointer",
                      }}
                    >
                      {showSigHow ? "HIDE HOW" : "HOW IT WORKS"}
                    </button>
                  </div>
                </div>

                {/* How It Works Explanatory Modal */}
                {showSigHow && (
                  <div style={{ border: "1px solid var(--si-border-sec, #2a3a4a)", background: "var(--si-card-sec, #0b1016)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                      HOW EACH SCORE IS CALCULATED
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.5, margin: "4px 0" }}>
                      Every signal score runs 0–100, where 50 is neutral. Scores of 75 or more (green) indicate strong alignment with the forward trade and count toward Confluence; 60–74 (blue) is moderate, 45–59 (amber) is middling, and under 45 (red) is weak. The overall MC Confidence uses the same scale: 75+ high conviction, 60–74 constructive, 45–59 mixed, under 45 weak.
                    </div>
                    {[
                      ["Business", "Revenue growth in key segments, gross and operating margin trend, and forward guidance."],
                      ["Earnings", "EPS and revenue estimate revisions over 30 and 90 days, beat rate, and surprise magnitude."],
                      ["Technicals", "Trend vs. 50- and 200-day moving averages, relative strength vs. S&P 500, and volume confirmation."],
                      ["Catalysts", "Upcoming dated events (earnings, product launches, conferences) weighted by historical volatility impact."],
                      ["Valuation", "Forward P/E and EV/EBITDA vs. 5-year history and peers, adjusted for growth (PEG ratio)."],
                      ["Flows", "Call/put skew, short interest, days to cover, plus institutional ownership change from latest 13F filings."],
                      ["Macro", "Market trend, VIX level, interest rate volatility, and sector sensitivity to broader liquidity."],
                    ].map(([sName, sDesc], idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{sName}</span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #c9d4de)" }}>{sDesc}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 7 interactive score buttons, then the Confluence box */}
                <style>{`.si-sig{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.si-sig-cb{grid-column:span 5;display:grid;grid-template-columns:minmax(180px,260px) auto;gap:8px}@media (max-width:760px){.si-sig{grid-template-columns:repeat(3,minmax(0,1fr))}.si-sig-cb{grid-column:span 2;grid-template-columns:1fr}.si-sig-cb>button{grid-column:1/-1;height:32px}}`}</style>
                <div className="si-sig">
                  {signalScores.map((scItem: SignalScoreItem) => {
                    const isSelected = selectedSignal === scItem.name;
                    return (
                      <button
                        key={scItem.name}
                        onClick={() => setSelectedSignal(isSelected ? null : scItem.name)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${isSelected ? "var(--si-accent, #5980a6)" : "var(--si-border, #1c2733)"}`,
                          background: isSelected ? "var(--si-accent-bg, rgba(89,128,166,0.18))" : "var(--si-card-sec, transparent)",
                          padding: 12,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          transition: "border 150ms, background 150ms",
                        }}
                      >
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--si-text-mid, #93a1af)" }}>
                          {scItem.name}
                        </span>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: scItem.color, lineHeight: 1 }}>
                          {scItem.val}
                        </span>
                        <span style={{ height: 3, background: "var(--si-card-tert, #1c2733)", display: "block" }}>
                          <span style={{ display: "block", height: 3, width: scItem.widthPct, background: scItem.color }} />
                        </span>
                      </button>
                    );
                  })}
                  <div className="si-sig-cb">
                    <div style={{ border: "1px solid var(--si-accent, #5980a6)", background: "var(--si-accent-bg, rgba(89,128,166,0.12))", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "var(--si-text-mid, #93a1af)" }}>CONFLUENCE</span>
                      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, lineHeight: 1 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 700, color: confluenceColor }}>{confluenceCount}</span>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 600, color: "var(--si-text-mid, #93a1af)" }}>/ 7</span>
                      </span>
                      <span style={{ display: "flex", gap: 3, alignSelf: "stretch" }}>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <span key={n} style={{ flex: 1, height: 3, background: n < confluenceCount ? confluenceColor : "var(--si-card-tert, #1c2733)" }} />
                        ))}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowAssessEv(!showAssessEv)}
                      style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card-sec, transparent)", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 14px" }}
                    >
                      {showAssessEv ? "Hide evidence" : "Evidence ▸"}
                    </button>
                  </div>
                </div>

                {showAssessEv && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12 }}>
                    {(stockDetail.assessEv || []).map((ev, i) => (
                      <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-body, #c4d0dc)", display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded Signal Evidence Card */}
                {selectedSignal && (
                  <div
                    className="si-evidence-card"
                    style={{
                      border: "1px solid var(--si-border-sec, #2a3a4a)",
                      background: "var(--si-evidence-bg, rgba(89,128,166,0.08))",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        className="si-evidence-title"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          color: "var(--si-evidence-title, var(--si-text-hi, #07080a))",
                        }}
                      >
                        EVIDENCE · {selectedSignal.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setSelectedSignal(null)}
                        aria-label="Close evidence"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--si-text-hi, #07080a)",
                          cursor: "pointer",
                          fontSize: 16,
                          fontWeight: 700,
                          padding: "2px 6px",
                          lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {((stockDetail.ev && selectedSignal ? (stockDetail.ev[selectedSignal] || stockDetail.ev[selectedSignal.toUpperCase()]) : null) || [
                      "No live data for this signal yet.",
                    ]).map((evItem, i) => (
                      <div
                        key={i}
                        className="si-evidence-text"
                        style={{
                          fontFamily: "'Manrope', sans-serif",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--si-text-body, #0f172a)",
                          display: "flex",
                          gap: 9,
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
                        <span style={{ color: "var(--si-text-body, #0f172a)" }}>{evItem}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
              {/* Right column: the take, then the two reads */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
                <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, #0c1118)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "var(--si-shadow, none)" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                    MARKETCATALYST TAKE
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.55 }}>
                    {stockDetail.assessSegs
                      ? stockDetail.assessSegs.map((seg, i) =>
                          seg.tone ? (
                            <span key={i} style={{ color: seg.tone === "up" ? "var(--up, #16a34a)" : "var(--down, #dc2626)", fontWeight: 700 }}>{seg.t}</span>
                          ) : (
                            seg.t
                          ),
                        )
                      : stockDetail.assess}
                  </div>
                </div>
                <ReadCard title="FUNDAMENTAL READ" text={fundamentalReadText(stock.t, siFacts, stock.fpe)} onOpen={() => setActiveTab("fund")} />
                <ReadCard title="TECHNICAL READ" text={technicalReadText(siFacts)} info={TECHNICAL_READ_INFO} onOpen={() => setActiveTab("tech")} />
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 2: WHY IT MOVED
            ==================================================== */}
        {activeTab === "moved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Chart beside the MarketCatalyst read (last week when the daily bars are there, else today) */}
            <style>{`.si-ov-m{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);gap:18px;align-items:stretch}@media (max-width:1050px){.si-ov-m{grid-template-columns:minmax(0,1fr)}}`}</style>
            <div className="si-ov-m">
              <SixMonthAreaChart ticker={stock.t} stock={stock} bars={sixMonthBars} events={majorEvents} />
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--si-border-sec, #5980a6)",
                  background: "var(--si-card, rgba(12,17,24,0.92))",
                  padding: "24px 26px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                  MARKETCATALYST READ
                </span>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.55 }}>
                  {highlightSignedPercents(movedWeek ? movedWeek.text : stockDetail.movedTxt)}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 14 }}>
                  SUPPORTING EVIDENCE
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(movedWeek ? [...movedWeek.ev, stockDetail.movedEv[0]] : stockDetail.movedEv).map((me: React.ReactNode, i: number) => (
                    <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, color: "var(--si-text-hi, #e8eef4)", display: "flex", gap: 10, lineHeight: 1.5 }}>
                      <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
                      <span>{typeof me === "string" ? highlightNumbers(me) : me}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimated factor attribution: stacked bar plus one tile per factor */}
            <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)" }}>
                  ESTIMATED FACTOR ATTRIBUTION
                  <InfoTip lines={FACTOR_INFO} />
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>
                  of <b style={{ color: movedWeek ? (movedWeek.pct >= 0 ? "var(--up, #4ade80)" : "var(--down, #f87171)") : color }}>{movedWeek ? pct(movedWeek.pct) : pct(stock.c)}</b> {movedWeek ? "last week" : "today"}
                </span>
                <button
                  onClick={() => setShowAttHow(!showAttHow)}
                  style={{ marginLeft: "auto", height: 26, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer" }}
                >
                  HOW IT WORKS
                </button>
              </div>
              {showAttHow && (
                <div style={{ padding: "10px 12px", background: "var(--si-evidence-bg, rgba(89,128,166,0.08))", border: "1px solid var(--si-border-sec, #2a3a4a)", borderRadius: 4, fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.5 }}>
                  Estimated Factor Attribution: Percentages are modeled estimates derived from sector beta and market regime heuristics, not empirically measured or causal contributions.
                </div>
              )}
              {(() => {
                const factors = [
                  { k: "Sector Momentum", p: stockDetail.att[0], c: "var(--si-accent-soft, #7fa8d0)" },
                  { k: "Company News", p: stockDetail.att[1], c: "var(--up, #16a34a)" },
                  { k: "Market Regime", p: stockDetail.att[2], c: "#8b5cf6" },
                  { k: "Technical Factors", p: stockDetail.att[3], c: "#f59e0b" },
                ];
                return (
                  <>
                    <div style={{ display: "flex", height: 16, width: "100%", borderRadius: 2, overflow: "hidden" }}>
                      {factors.map((at, idx) => (
                        <span key={idx} style={{ height: 16, width: `${at.p}%`, background: at.c, borderRight: "2px solid var(--si-card-solid, #080b10)" }} />
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                      {factors.map((at, idx) => (
                        <div key={idx} style={{ border: "1px solid var(--si-border, #1c2733)", borderLeft: `3px solid ${at.c}`, background: "var(--si-card-sec, rgba(12,17,24,0.6))", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{at.k}</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>{at.p}%</span>
                          <div style={{ height: 6, background: "var(--si-card-tert, #1c2733)" }}>
                            <div style={{ height: 6, width: `${at.p}%`, background: at.c }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 3: WHY IT COULD MOVE (Complete Implementation)
            ==================================================== */}
        {activeTab === "could" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <BullBearChecks bullish={stockDetail.valid} bearish={stockDetail.invalid} broken={stockDetail.broken} />

            {/* Catalysts timeline */}
            <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 24px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 22 }}>
                CATALYSTS · RECENT &amp; UPCOMING
              </div>
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
                {upcomingCatalysts.map((up, i) => (
                  <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, opacity: up.past ? 0.6 : 1 }}>
                    {/* The timeline line is drawn per event, from this marker across the gap to the next one,
                        so every row of the grid (not just the first) is joined up. */}
                    {i < upcomingCatalysts.length - 1 && (
                      <span aria-hidden style={{ position: "absolute", left: 13, right: -18, top: 12, height: 2, background: "rgba(89,128,166,0.55)", zIndex: 0 }} />
                    )}
                    {/* Events that have passed are a filled grey dot and fade back; events still ahead keep the open ring. */}
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        width: 26,
                        height: 26,
                        borderRadius: 99,
                        background: up.past ? "#2a3a4a" : "var(--si-bg, #080b10)",
                        border: `2px solid ${up.past ? "#5d6b79" : "#7fa8d0"}`,
                        boxShadow: up.past ? "0 0 0 6px rgba(93,107,121,0.12)" : "0 0 0 6px rgba(127,168,208,0.12)",
                      }}
                    />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
                      {up.date} · {up.days}
                    </span>
                    {up.cat && (
                      <span style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#ffffff" }}>
                        {up.cat.toUpperCase()}
                      </span>
                    )}
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>
                      {up.n}
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, color: "#ffffff", lineHeight: 1.5 }}>
                      {up.txt}
                    </span>
                    <span style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.1em", color: up.col, border: `1px solid ${up.col}`, padding: "3px 9px", marginTop: 4 }}>
                      {up.imp} IMPACT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 4: FUNDAMENTALS (Complete Implementation)
            ==================================================== */}
        {activeTab === "fund" && (() => {
          const hasFmp = Boolean(financialsDoc?.quarters && financialsDoc.quarters.length >= 2);
          // Banks: gross margin, EBITDA and free cash flow are not meaningful.
          const isBank = /bank|savings|thrift|financial/i.test(liveCompany?.industry ?? "") || /bank|financial/i.test(liveCompany?.sector ?? "");
          const fmpQ = hasFmp && financialsDoc?.quarters ? [...financialsDoc.quarters].slice(0, 8).reverse() : null;

          let fsr: number[][];
          let QL: [string, string];

          if (fmpQ && fmpQ.length >= 2) {
            // Real FMP fundamental data series
            const revSeries = fmpQ.map((q) => (q.revenue || 0) / 1e9);
            // GAAP diluted (gaapQuarterEps) — the same basis as EPS (TTM) and P/E.
            const epsSeries = fmpQ.map((q) => gaapQuarterEps(q) ?? 0);
            // Gross margin means nothing for a bank (no cost of goods; JPM read
            // 62.3%), and a statement whose gross profit IS operating income
            // (NEE: 32.4% / 32.4%) has no real gross line — show no data then.
            const noGross = isBank || fmpQ.every((q) => q.grossProfit != null && q.operatingIncome != null && q.grossProfit === q.operatingIncome);
            const gmSeries = noGross ? [] : fmpQ.map((q) => q.grossMarginPct != null ? q.grossMarginPct : (q.revenue ? ((q.grossProfit || 0) / q.revenue) * 100 : 0));
            // Same definition as the TTM FCF yield (computeQuarterFcf) — never
            // operating cash flow or net income standing in for it.
            const fcfSeries = fmpQ.map((q) => (computeQuarterFcf(q) ?? 0) / 1e9);
            // Never fall back to net income; return [] to render "—" when missing or for banks.
            const opSeries = computeOperatingIncomeSeries(fmpQ, isBank);
            // Total debt (short + long term + leases), as quote pages report it — not long-term only.
            const debtSeries = fmpQ.map((q) => (q.totalDebt ?? q.longTermDebt ?? 0) / 1e9);
            fsr = [revSeries, epsSeries, gmSeries, fcfSeries, opSeries, debtSeries];
            QL = [
              `${fmpQ[0].fiscalPeriod || "Q"} '${(fmpQ[0].fiscalYear || "").slice(-2)}`,
              `${fmpQ[fmpQ.length - 1].fiscalPeriod || "Q"} '${(fmpQ[fmpQ.length - 1].fiscalYear || "").slice(-2)}`
            ];
          } else {
            fsr = fundSeries(stock.t);
            QL = ["", ""];
          }

          if (!hasFmp && (!fsr[0] || fsr[0].length === 0)) {
            // Financials still in flight (data is null until the fetch resolves):
            // show a quiet placeholder instead of flashing "Not Available".
            if (financialsLoading || (!financialsDoc && !financialsError)) {
              return <div style={{ minHeight: 240 }} aria-busy="true" />;
            }
            return (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--si-text-dim, #5a6876)" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #f0f4f8)", marginBottom: 8 }}>
                  Quarterly Statements Not Available
                </div>
                <div style={{ fontSize: 13, maxWidth: 420, margin: "0 auto" }}>
                  Quarterly financial statements for {stock.t} are not reported or synced yet.
                </div>
              </div>
            );
          }

          // Dollar amounts in billions: the sign goes before the "$" ("-$5.4B",
          // not "$-5.4B", which reads as 5.4), and under $1B shows in millions
          // ("$167M", not "$0.0B").
          const usdB = (v: number) => {
            const a = Math.abs(v);
            const sign = v < 0 && a >= 0.0005 ? "-" : "";
            return a >= 1 ? `${sign}$${a.toFixed(1)}B` : `${sign}$${(a * 1000).toFixed(0)}M`;
          };
          const FM: [string, (v: number) => string][] = [
            ["REVENUE", usdB],
            ["EPS (GAAP)", (v) => (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(2)],
            ["GROSS MARGIN", (v) => v.toFixed(1) + "%"],
            ["FREE CASH FLOW", usdB],
            [hasFmp ? "OPERATING INCOME" : "ROIC", (v) => (hasFmp ? usdB(v) : v.toFixed(0) + "%")],
            ["TOTAL DEBT", usdB],
          ];
          // What a click on one bar shows: that quarter's label, value, change
          // vs the prior quarter and the same quarter a year earlier, plus one
          // line of the figures behind it (estimate, margin, cash flow, cash).
          type FundBar = { h: string; c: string; label: string; end: string; value: string; qoq: number | null; yoy: number | null; note: string | null };
          // Quarter figures are raw dollars; usdB above takes billions.
          const usdRaw = (v: number) => usdB(v / 1e9);
          const chgPct = (cur: number, prev: number | undefined): number | null =>
            prev == null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
          const barNote = (card: number, q: QuarterFinancials | undefined): string | null => {
            if (!q) return null;
            switch (card) {
              case 0: {
                if (q.revenueEstimateReported == null) return null;
                const s = surprisePct(q.revenue, q.revenueEstimateReported);
                return `Estimate ${usdRaw(q.revenueEstimateReported)}${s != null ? ` · ${pct1(s)} vs estimate` : ""}`;
              }
              case 1: {
                // The bar is GAAP diluted EPS; estimates and surprises are on the
                // adjusted basis, so say so rather than mix the two figures.
                if (q.epsEstimateReported == null) return null;
                const s = quarterEpsSurprisePct(q);
                return `Adjusted EPS ${q.epsActualReported != null ? `$${q.epsActualReported.toFixed(2)} ` : ""}vs $${q.epsEstimateReported.toFixed(2)} estimate${s != null ? ` · ${pct1(s)}` : ""}`;
              }
              case 2:
                return q.grossProfit != null && q.revenue ? `Gross profit ${usdRaw(q.grossProfit)} on ${usdRaw(q.revenue)} revenue` : null;
              case 3:
                return q.operatingCashFlow != null && q.capitalExpenditures != null
                  ? `Operating cash flow ${usdRaw(q.operatingCashFlow)} less ${usdRaw(Math.abs(q.capitalExpenditures))} capex`
                  : null;
              case 4:
                return q.operatingIncome != null && q.revenue ? `Operating margin ${((q.operatingIncome / q.revenue) * 100).toFixed(1)}% of ${usdRaw(q.revenue)} revenue` : null;
              case 5: {
                const debt = q.totalDebt ?? q.longTermDebt;
                return debt != null && q.cashAndCashEquivalents != null
                  ? `Cash ${usdRaw(q.cashAndCashEquivalents)} · net debt ${usdRaw(debt - q.cashAndCashEquivalents)}`
                  : null;
              }
              default:
                return null;
            }
          };
          const fundMetrics = FM.map(([k, f], i) => {
            const a = fsr[i] ?? [];
            // No FMP quarters for this metric: show a dash, never a stand-in series.
            if (a.length === 0) {
              return { k, last: "—", yoy: "no data", col: STEEL, q0: QL[0], q1: QL[1], bars: [] as FundBar[] };
            }
            const lastIdx = a.length - 1;
            const yoyBaseIdx = Math.max(0, lastIdx - 4);
            const mxv = Math.max(...a) || 1;
            const yoy = yoyBaseIdx < lastIdx && a[yoyBaseIdx] !== 0
              ? ((a[lastIdx] / (a[yoyBaseIdx] || 1)) - 1) * 100
              : 0;
            const good = i === 5 ? yoy <= 0 : yoy >= 0;
            return {
              k,
              last: f(a[lastIdx]),
              yoy: pct1(yoy) + " y/y",
              col: good ? UP : DN,
              q0: QL[0],
              q1: QL[1],
              bars: a.map((v, j): FundBar => {
                const q = fmpQ?.[j];
                return {
                  h: Math.max(6, Math.round((Math.abs(v) / (mxv || 1)) * 100)) + "%",
                  c: j === lastIdx ? STEEL : "rgba(89,128,166,0.38)",
                  label: q ? `${q.fiscalPeriod || "Q"} '${(q.fiscalYear || "").slice(-2)}` : `Quarter ${j + 1}`,
                  end: q?.endDate ? fmtMarketDate(q.endDate, { month: "short", day: "numeric", year: "numeric" }) : "",
                  value: f(v),
                  qoq: j > 0 ? chgPct(v, a[j - 1]) : null,
                  yoy: j >= 4 ? chgPct(v, a[j - 4]) : null,
                  note: barNote(i, q),
                };
              }),
            };
          });

          const semi = stock.sector === "Semiconductor" || stock.sector === "Semiconductors";
          const livePe = liveCompany?.peRatio ?? stock.pe;

          const mcapNum = liveCompany?.marketCap ?? null;
          const ttmEbitda = fmpQ && fmpQ.length >= 4
            ? fmpQ.slice(-4).reduce((sum, q) => sum + (q.ebitda ?? q.operatingIncome ?? 0), 0)
            : null;
          const latestQ = fmpQ && fmpQ.length > 0 ? fmpQ[fmpQ.length - 1] : null;
          const latestDebt = latestQ ? (latestQ.totalDebt ?? latestQ.longTermDebt ?? null) : null;
          const hasTotalDebt = latestQ?.totalDebt != null;
          const latestCash = latestQ ? (latestQ.cashAndCashEquivalents ?? null) : null;

          // Enterprise Value = Market Capitalization + Debt - Cash and Cash Equivalents
          // If required inputs (mcap, debt, or cash) are unavailable, do not assume zero.
          const enterpriseVal = (mcapNum != null && latestDebt != null && latestCash != null)
            ? mcapNum + latestDebt - latestCash
            : null;
          const realEvEbitda = (!isBank && enterpriseVal != null && ttmEbitda != null && Number.isFinite(ttmEbitda) && ttmEbitda > 0)
            ? enterpriseVal / ttmEbitda
            : null;

          const ttmFcf = computeTtmFcf(fmpQ);
          const realFcfYield = (!isBank && ttmFcf != null && mcapNum != null && Number.isFinite(mcapNum) && mcapNum > 0)
            ? (ttmFcf / mcapNum) * 100
            : null;

          // ── Financial health (latest quarter) and earnings quality (trailing 12 months) ──
          // From the quarterly statements already synced; a figure whose inputs are
          // missing is left out, never filled with zero. Banks are skipped: debt,
          // current ratio and free cash flow do not mean the same for them.
          type HealthRow = { k: string; v: string; note: string; tone: "good" | "warn" | "bad" | "neutral" };
          const ttm4 = !isBank && fmpQ && fmpQ.length >= 4 ? fmpQ.slice(-4) : null;
          const sum4 = (pick: (q: QuarterFinancials) => number | null | undefined): number | null => {
            if (!ttm4) return null;
            let s = 0;
            for (const q of ttm4) {
              const v = pick(q);
              if (v == null || !Number.isFinite(v)) return null;
              s += v;
            }
            return s;
          };
          const healthRows: HealthRow[] = [];
          if (!isBank && latestQ) {
            const equity = latestQ.equity;
            if (latestCash != null) healthRows.push({ k: "Cash", v: usdRaw(latestCash), note: "Cash and equivalents", tone: "neutral" });
            if (latestDebt != null) healthRows.push({ k: hasTotalDebt ? "Total debt" : "LT debt", v: usdRaw(latestDebt), note: hasTotalDebt ? "Short and long term, incl. leases" : "Long-term debt only", tone: "neutral" });
            if (latestCash != null && latestDebt != null) {
              const net = latestCash - latestDebt;
              const heavy = net < 0 && ttmEbitda != null && ttmEbitda > 0 && -net / ttmEbitda > 3;
              healthRows.push({
                k: net >= 0 ? "Net cash" : "Net debt",
                v: usdRaw(Math.abs(net)),
                note: net >= 0 ? "Cash is more than all its debt" : heavy ? "More than 3 years of EBITDA" : "Debt is more than its cash",
                tone: net >= 0 ? "good" : heavy ? "bad" : "warn",
              });
            }
            const cr = latestQ.currentRatio ?? (latestQ.currentAssets != null && latestQ.currentLiabilities ? latestQ.currentAssets / latestQ.currentLiabilities : null);
            if (cr != null && Number.isFinite(cr)) {
              healthRows.push({ k: "Current ratio", v: `${cr.toFixed(2)}×`, note: cr >= 1.5 ? "Covers short-term bills comfortably" : cr >= 1 ? "Covers short-term bills" : "Short-term bills exceed liquid assets", tone: cr >= 1.5 ? "good" : cr >= 1 ? "neutral" : "warn" });
            }
            if (latestDebt != null && equity != null) {
              healthRows.push(equity > 0
                ? { k: "Debt / equity", v: `${(latestDebt / equity).toFixed(2)}×`, note: latestDebt / equity < 0.5 ? "Lightly borrowed" : latestDebt / equity < 1.5 ? "Moderately borrowed" : "Heavily borrowed", tone: latestDebt / equity < 0.5 ? "good" : latestDebt / equity < 1.5 ? "neutral" : "warn" }
                : { k: "Debt / equity", v: "n/m", note: "Shareholder equity is negative", tone: "warn" });
            }
            if (latestDebt != null && ttmEbitda != null && ttmEbitda > 0) {
              const x = latestDebt / ttmEbitda;
              healthRows.push({ k: "Debt / EBITDA", v: `${x.toFixed(1)}×`, note: x < 1 ? "Repaid in under a year of earnings" : x < 3 ? "Manageable" : "Slow to repay", tone: x < 1 ? "good" : x < 3 ? "neutral" : "bad" });
            }
          }

          const qualityRows: HealthRow[] = [];
          const ttmRev = sum4((q) => q.revenue);
          const ttmNi = sum4((q) => q.netIncome);
          const ttmFcf4 = sum4((q) => computeQuarterFcf(q));
          const ttmCapex = sum4((q) => (q.capitalExpenditures != null ? Math.abs(q.capitalExpenditures) : null));
          if (ttmRev != null && ttmRev > 0) {
            if (ttmFcf4 != null) {
              const m = (ttmFcf4 / ttmRev) * 100;
              qualityRows.push({ k: "FCF margin", v: `${m.toFixed(1)}%`, note: "Free cash flow per $ of sales", tone: m >= 15 ? "good" : m >= 0 ? "neutral" : "bad" });
            }
            if (ttmNi != null) {
              const m = (ttmNi / ttmRev) * 100;
              qualityRows.push({ k: "Net margin", v: `${m.toFixed(1)}%`, note: "Profit per $ of sales", tone: m >= 15 ? "good" : m >= 0 ? "neutral" : "bad" });
            }
            if (ttmCapex != null) {
              qualityRows.push({ k: "Capex / sales", v: `${((ttmCapex / ttmRev) * 100).toFixed(1)}%`, note: "Spent on equipment and buildings", tone: "neutral" });
            }
          }
          if (ttmFcf4 != null && ttmNi != null) {
            qualityRows.push(ttmNi > 0
              ? { k: "Cash conversion", v: `${(ttmFcf4 / ttmNi).toFixed(2)}×`, note: `$${(ttmFcf4 / ttmNi).toFixed(2)} of free cash per $1 of profit`, tone: ttmFcf4 / ttmNi >= 1 ? "good" : ttmFcf4 / ttmNi >= 0.7 ? "neutral" : "warn" }
              : { k: "Cash conversion", v: "n/m", note: "No profit over the last 12 months", tone: "warn" });
          }
          const healthSub = latestQ ? `${latestQ.fiscalPeriod || "Latest quarter"} '${(latestQ.fiscalYear || "").slice(-2)}` : "";
          const toneCol = (t: HealthRow["tone"]) => (t === "good" ? UP : t === "bad" ? DN : t === "warn" ? "#f5b031" : "#93a1af");

          // PEG = trailing P/E ÷ expected EPS growth (next fiscal year's estimate
          // vs the year in progress) — not one quarter's volatile y/y change.
          const expGrowth = siFacts.fwdEps != null && siFacts.nextFyEps != null && siFacts.fwdEps > 0
            ? (siFacts.nextFyEps / siFacts.fwdEps - 1) * 100
            : null;
          const realPeg = (livePe != null && livePe > 0 && expGrowth != null && expGrowth > 0)
            ? livePe / expGrowth
            : null;

          const evLabel = latestQ && !hasTotalDebt && latestQ.longTermDebt != null ? "EV/EBITDA (LT Debt)" : "EV/EBITDA";

          // Reference benchmark medians by sector (semiconductor vs general market)
          // Outlier multiples (e.g. >100x P/E) are rendered dynamically with log-scale / proportional upper bounds.
          const basePe = semi ? 38.0 : 22.0;
          const baseFpe = semi ? 31.2 : 16.8;
          const baseEv = semi ? 29.4 : 14.2;

          const VV: [string, string, number, string, number][] = [
            ["P/E", livePe != null ? livePe.toFixed(1) : "—", basePe, "×", livePe ?? 0],
            ["Forward P/E", stock.fpe != null ? stock.fpe.toFixed(1) : "—", baseFpe, "×", stock.fpe ?? 0],
            [evLabel, realEvEbitda != null && Number.isFinite(realEvEbitda) && realEvEbitda > 0 ? realEvEbitda.toFixed(1) : "—", baseEv, "×", realEvEbitda && realEvEbitda > 0 ? realEvEbitda : 0],
            ["PEG", realPeg != null && Number.isFinite(realPeg) && realPeg > 0 ? realPeg.toFixed(2) : "—", 1.45, "", realPeg && realPeg > 0 ? realPeg : 0],
            ["FCF Yield", realFcfYield != null && Number.isFinite(realFcfYield) ? realFcfYield.toFixed(1) : "—", 2.6, "%", realFcfYield && realFcfYield > 0 ? realFcfYield : 0],
          ];
          const valRows = VV.map(([k, vStr, med, u, numVal]) => {
            // Generic outlier scaling: if metric is > 4x benchmark, use dynamic scaling
            const top = Math.max(numVal, med) * 1.25 || 1;
            return {
              k,
              v: vStr !== "—" ? vStr + u : "—",
              med: med + u,
              w: vStr !== "—" ? Math.min(100, (numVal / top) * 100).toFixed(1) + "%" : "0%",
              m: Math.min(100, (med / top) * 100).toFixed(1) + "%",
            };
          });

          // ── Margin trend: gross, operating and net margin over the quarters shown ──
          const marginPct = (stated: number | null | undefined, part: number | null | undefined, rev: number | null | undefined) =>
            stated != null && Number.isFinite(stated) ? stated : part != null && rev ? (part / rev) * 100 : null;
          const noGrossLine = isBank || (fmpQ ?? []).every((q) => q.grossProfit != null && q.operatingIncome != null && q.grossProfit === q.operatingIncome);
          const marginLines = isBank || !fmpQ || fmpQ.length < 3 ? [] : ([
            { k: "Gross", col: STEEL, on: !noGrossLine, vals: fmpQ.map((q) => marginPct(q.grossMarginPct, q.grossProfit, q.revenue)) },
            { k: "Operating", col: UP, on: true, vals: fmpQ.map((q) => marginPct(q.operatingMarginPct, q.operatingIncome, q.revenue)) },
            { k: "Net", col: "#f5b031", on: true, vals: fmpQ.map((q) => marginPct(q.netMarginPct, q.netIncome, q.revenue)) },
          ] as Array<{ k: string; col: string; on: boolean; vals: Array<number | null> }>).filter((l) => l.on && l.vals.filter((v) => v != null).length >= 3);
          const marginAll = marginLines.flatMap((l) => l.vals.filter((v): v is number => v != null));
          const mMax = Math.max(0, ...marginAll), mMin = Math.min(0, ...marginAll);
          const mSpan = mMax - mMin || 1;
          const MW = 440, MH = 150, MPAD = 10;
          const mx = (i: number) => MPAD + (i / Math.max(1, (fmpQ?.length ?? 1) - 1)) * (MW - 2 * MPAD);
          const my = (v: number) => MPAD + ((mMax - v) / mSpan) * (MH - 2 * MPAD);

          // ── Scorecard: four plain grades, each from one visible number ──
          type Grade = { k: string; grade: string; tone: HealthRow["tone"]; note: string };
          const growthV = siFacts.revGrowthYoY;
          const opM = siFacts.opMargin, opM0 = siFacts.opMarginYearAgo;
          const pe = livePe != null && livePe > 0 ? livePe : null;
          const fpe = stock.fpe != null && stock.fpe > 0 ? stock.fpe : null;
          const vRatios = [pe != null ? pe / basePe : null, fpe != null ? fpe / baseFpe : null].filter((v): v is number => v != null);
          const vRatio = vRatios.length ? vRatios.reduce((a, b) => a + b, 0) / vRatios.length : null;
          const hasBad = healthRows.some((r) => r.tone === "bad"), hasWarn = healthRows.some((r) => r.tone === "warn");
          const netRow = healthRows.find((r) => r.k === "Net cash" || r.k === "Net debt");
          const scoreCards: Grade[] = [
            growthV != null && Number.isFinite(growthV)
              ? { k: "GROWTH", grade: growthV >= 20 ? "Strong" : growthV >= 8 ? "Solid" : growthV >= 0 ? "Slow" : "Shrinking", tone: growthV >= 20 ? "good" : growthV >= 8 ? "neutral" : growthV >= 0 ? "warn" : "bad", note: `Revenue ${pct1(growthV)} y/y` }
              : { k: "GROWTH", grade: "—", tone: "neutral", note: "No revenue history yet" },
            !isBank && opM != null && Number.isFinite(opM)
              ? { k: "PROFITABILITY", grade: opM >= 25 ? "Strong" : opM >= 12 ? "Solid" : opM >= 0 ? "Thin" : "Losing money", tone: opM >= 25 ? "good" : opM >= 12 ? "neutral" : opM >= 0 ? "warn" : "bad", note: `Operating margin ${opM.toFixed(1)}%${opM0 != null ? ` (${opM - opM0 >= 0 ? "+" : "−"}${Math.abs(opM - opM0).toFixed(1)} pts y/y)` : ""}` }
              : { k: "PROFITABILITY", grade: "—", tone: "neutral", note: isBank ? "Not graded for banks" : "No margin data yet" },
            healthRows.length
              ? { k: "FINANCIAL HEALTH", grade: hasBad ? "Stretched" : hasWarn ? "Mixed" : healthRows.filter((r) => r.tone === "good").length >= 2 ? "Strong" : "Solid", tone: hasBad ? "bad" : hasWarn ? "warn" : healthRows.filter((r) => r.tone === "good").length >= 2 ? "good" : "neutral", note: netRow ? `${netRow.k} ${netRow.v}` : healthRows[0].note }
              : { k: "FINANCIAL HEALTH", grade: "—", tone: "neutral", note: isBank ? "Not graded for banks" : "No balance-sheet data yet" },
            vRatio != null
              ? { k: "VALUATION", grade: vRatio < 0.8 ? "Attractive" : vRatio < 1.2 ? "Fair" : vRatio < 1.8 ? "Rich" : "Expensive", tone: vRatio < 0.8 ? "good" : vRatio < 1.2 ? "neutral" : vRatio < 1.8 ? "warn" : "bad", note: `${pe != null ? `P/E ${pe.toFixed(1)}×` : `Fwd P/E ${fpe!.toFixed(1)}×`} vs ${pe != null ? basePe : baseFpe}× sector reference` }
              : { k: "VALUATION", grade: "—", tone: "neutral", note: "No earnings multiple (no profit)" },
          ];

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Scorecard: one grade per question, each from the number shown under it */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                {scoreCards.map((s) => {
                  const gradeCol = s.grade === "—" ? "var(--si-text-sub, #5d6b79)" : toneCol(s.tone);
                  return (
                    <div key={s.k} style={{ border: `1px solid ${s.grade === "—" ? "var(--si-border, #1c2733)" : gradeCol}`, background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.14em", color: "var(--si-text-hi, #ffffff)", opacity: 0.7 }}>{s.k}</span>
                        <InfoTip lines={SCORECARD_INFO[s.k] ?? []} />
                      </span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800, color: gradeCol }}>{s.grade}</span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, color: "var(--si-text-hi, #ffffff)", lineHeight: 1.5 }}>{highlightScoreNote(s.note, gradeCol)}</span>
                    </div>
                  );
                })}
              </div>

              {/* 6 Financial Metric Cards with 8-Quarter Mini-Bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
                {fundMetrics.map((fm, idx) => {
                  const selKey = `${stock.t}:${idx}`;
                  const selIdx = fundSel[selKey];
                  const selBar = selIdx != null ? fm.bars[selIdx] : undefined;
                  // Revenue, EPS, margins and cash flow are better when higher; debt when lower.
                  const chgCol = (v: number) => ((idx === 5 ? -v : v) >= 0 ? UP : DN);
                  return (
                  <div key={idx} style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", columnGap: 8 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "var(--si-accent-light, #a9c6e3)", whiteSpace: "nowrap" }}>
                        {fm.k}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: fm.col, whiteSpace: "nowrap" }}>
                        {fm.yoy}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                      {fm.last}
                    </div>
                    <div style={{ height: 80, display: "flex", alignItems: "flex-end", gap: 5, padding: "4px 0" }}>
                      {fm.bars.map((br, bIdx) => {
                        const picked = bIdx === selIdx;
                        return (
                          <button
                            key={bIdx}
                            type="button"
                            aria-pressed={picked}
                            aria-label={`${fm.k} ${br.label}: ${br.value}`}
                            title={`${br.label} · ${br.value}`}
                            onClick={() =>
                              setFundSel((prev) => {
                                const next = { ...prev };
                                if (next[selKey] === bIdx) delete next[selKey];
                                else next[selKey] = bIdx;
                                return next;
                              })
                            }
                            onMouseEnter={(e) => {
                              if (!picked) e.currentTarget.style.background = "rgba(127,168,208,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = picked ? "rgba(127,168,208,0.14)" : "transparent";
                            }}
                            style={{
                              flex: 1,
                              height: "100%",
                              display: "flex",
                              alignItems: "flex-end",
                              padding: 0,
                              border: "none",
                              cursor: "pointer",
                              background: picked ? "rgba(127,168,208,0.14)" : "transparent",
                            }}
                          >
                            <span style={{ display: "block", width: "100%", height: br.h, background: picked ? "var(--si-accent-light, #a9c6e3)" : br.c, transition: "height 300ms ease" }} />
                          </button>
                        );
                      })}
                    </div>
                    {selBar && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: "var(--si-accent-light, #a9c6e3)" }}>{selBar.label}</span>
                          {selBar.end && <span style={{ color: "var(--si-text-sub, #5d6b79)" }}>ended {selBar.end}</span>}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{selBar.value}</div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                          {selBar.qoq != null && <span style={{ color: chgCol(selBar.qoq) }}>{pct1(selBar.qoq)} q/q</span>}
                          {selBar.yoy != null && <span style={{ color: chgCol(selBar.yoy) }}>{pct1(selBar.yoy)} y/y</span>}
                          {selBar.qoq == null && selBar.yoy == null && <span style={{ color: "var(--si-text-sub, #5d6b79)" }}>earliest quarter shown</span>}
                        </div>
                        {selBar.note && (
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-dim, #93a1af)", lineHeight: 1.4 }}>{selBar.note}</div>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-sub, #5d6b79)" }}>
                      <span>{fm.q0}</span>
                      {fm.bars.length > 0 && !selBar && <span style={{ opacity: 0.7 }}>click a bar</span>}
                      <span>{fm.q1}</span>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Financial health (balance sheet) and earnings quality (cash vs profit) */}
              {(healthRows.length > 0 || qualityRows.length > 0 || marginLines.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 18, alignItems: "stretch" }}>
                  {([
                    { title: "FINANCIAL HEALTH", sub: healthSub ? `${healthSub} balance sheet` : "Latest balance sheet", rows: healthRows },
                    { title: "EARNINGS QUALITY", sub: "Last 12 months", rows: qualityRows },
                  ]).filter((p) => p.rows.length > 0).map((p) => (
                    <div key={p.title} style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                          {p.title}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>{p.sub}</span>
                      </div>
                      {p.rows.map((r) => (
                        <div key={r.k} style={{ display: "grid", gridTemplateColumns: "10px 128px 92px 1fr", alignItems: "center", columnGap: 12, minHeight: 50, borderTop: "1px solid var(--si-border, #1c2733)" }}>
                          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: toneCol(r.tone) }} />
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 400, color: "var(--si-text-hi, #e8eef4)" }}>{r.k}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, textAlign: "right", color: r.tone === "neutral" ? "var(--si-text-hi, #e8eef4)" : toneCol(r.tone) }}>{r.v}</span>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-mid, #93a1af)" }}>{r.note}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {marginLines.length > 0 && fmpQ && (
                    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>MARGIN TREND</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>{QL[0]} to {QL[1]}</span>
                      </div>
                      <svg viewBox={`0 0 ${MW} ${MH}`} width="100%" role="img" aria-label={`${stock.t} gross, operating and net margin by quarter`} style={{ display: "block" }}>
                        <line x1={MPAD} x2={MW - MPAD} y1={my(0)} y2={my(0)} stroke="#2a3a4a" strokeWidth={1} strokeDasharray="3 3" />
                        {marginLines.map((l) => {
                          const pts = l.vals.map((v, i) => (v == null ? null : [mx(i), my(v)] as const));
                          const last = [...pts].reverse().find((p) => p != null);
                          return (
                            <g key={l.k}>
                              <polyline fill="none" stroke={l.col} strokeWidth={2} strokeLinejoin="round" points={pts.filter((p) => p != null).map((p) => `${p![0]},${p![1]}`).join(" ")} />
                              {last && <circle cx={last[0]} cy={last[1]} r={3.5} fill={l.col} />}
                            </g>
                          );
                        })}
                      </svg>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
                        {marginLines.map((l) => {
                          const lastIdx = l.vals.length - 1;
                          const now = l.vals[lastIdx];
                          const then = l.vals[lastIdx - 4] ?? null;
                          return (
                            <span key={l.k} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--si-text-hi, #e8eef4)" }}>
                              <i style={{ display: "inline-block", width: 10, height: 3, background: l.col, marginRight: 6, verticalAlign: "middle" }} />
                              {l.k} {now != null ? `${now.toFixed(1)}%` : "—"}
                              {now != null && then != null && (
                                <span style={{ color: now - then >= 0 ? UP : DN }}> {now - then >= 0 ? "+" : "−"}{Math.abs(now - then).toFixed(1)} pts y/y</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Valuation & Peer Comparison Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 18, alignItems: "start" }}>
                {/* Valuation Multiples vs Reference Benchmark */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      VALUATION MULTIPLES
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--si-text-mid, #93a1af)" }}>
                      ▮ {stock.t} &nbsp; ┃ Reference Benchmark
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.4 }}>
                    Reference benchmarks (indicated by ┃ and right column) are static sector reference values, not live peer-company medians.
                  </div>
                  {valRows.map((vl, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, height: 42 }}>
                      <span style={{ width: 110, fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                        {vl.k}
                      </span>
                      <div style={{ position: "relative", flex: 1, height: 10, background: "#1c2733" }}>
                        <div style={{ height: 10, width: vl.w, background: "#5980a6" }} />
                        <div style={{ position: "absolute", top: -4, left: vl.m, width: 2, height: 18, background: "#e8eef4", boxShadow: "0 0 6px rgba(255,255,255,0.4)" }} />
                      </div>
                      <span style={{ width: 70, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                        {vl.v}
                      </span>
                      <span style={{ width: 70, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--si-text-mid, #93a1af)" }}>
                        {vl.med}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Peer Comparison Table */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      PEER COMPARISON
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-mid, #93a1af)" }}>
                      Click any peer to open in SI
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.4fr) repeat(6, minmax(75px, 1fr))", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-accent, #5980a6)", padding: "6px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <span>COMPANY</span>
                    <span style={{ textAlign: "right" }}>PRICE</span>
                    <span style={{ textAlign: "right" }}>CHANGE</span>
                    <span style={{ textAlign: "right" }} title="Year to date: price vs the last close of the prior year. A * means it was listed this year, so it is measured from its first close.">YTD</span>
                    <span style={{ textAlign: "right" }}>MKT CAP</span>
                    <span style={{ textAlign: "right" }}>P/E</span>
                    <span style={{ textAlign: "right" }}>RS RANK</span>
                  </div>
                  {peersPending ? (
                    <div aria-busy="true" style={{ padding: "8px 0" }}>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} style={{ height: 38, margin: "8px 0", borderRadius: 6, background: "rgba(147,161,175,0.08)" }} />
                      ))}
                    </div>
                  ) : peersAll.length === 0 ? (
                    <div style={{ padding: "18px 0", textAlign: "center", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 13 }}>
                      No peer companies reported for {stock.t}.
                    </div>
                  ) : (
                    peersAll.map((peer) => {
                      const chgCol = (peer.c ?? 0) >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)";
                      const chgStr = peer.c != null ? `${peer.c >= 0 ? "+" : ""}${peer.c.toFixed(2)}%` : "—";
                      const ytdInfo = peerYtdBase.get(peer.t);
                      const ytdBase = ytdInfo?.base ?? null;
                      const ytd = peer.price != null && peer.price > 0 && ytdBase != null && ytdBase > 0
                        ? (peer.price / ytdBase - 1) * 100
                        : null;
                      const ytdCol = (ytd ?? 0) >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)";
                      // Listed this year: measured from its first close, marked with * and explained on hover.
                      const ytdSince = ytd != null ? ytdInfo?.since ?? null : null;
                      const ytdStr = ytd != null ? `${ytd >= 0 ? "+" : ""}${ytd.toFixed(2)}%${ytdSince ? "*" : ""}` : "—";
                      const ytdTitle = ytdSince ? `Since it began trading (first close ${fmtMarketDate(ytdSince, { month: "short", day: "numeric", year: "numeric" })}): it was listed this year` : undefined;
                      const pStr = peer.price != null ? `$${peer.price >= 10 ? peer.price.toFixed(2) : peer.price.toFixed(3)}` : "—";
                      const mcapStr = peer.marketCap != null ? `$${peer.marketCap >= 1000 ? (peer.marketCap / 1000).toFixed(2) + "T" : peer.marketCap.toFixed(1) + "B"}` : "—";
                      const peStr = peer.peRatio != null && Number.isFinite(peer.peRatio) && peer.peRatio > 0 ? `${peer.peRatio.toFixed(1)}×` : "—";
                      const rsStr = peer.rsRating != null ? String(peer.rsRating) : "—";

                      return (
                        <div
                          key={peer.t}
                          onClick={() => setPendingPeerOpen({ ticker: peer.t, name: peer.name })}
                          role="button"
                          tabIndex={0}
                          title={`Click to open ${peer.t} in Stock Intelligence`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setPendingPeerOpen({ ticker: peer.t, name: peer.name });
                            }
                          }}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(140px, 1.4fr) repeat(6, minmax(75px, 1fr))",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            color: "var(--si-text-hi, #e8eef4)",
                            padding: "11px 8px",
                            borderBottom: "1px solid var(--si-border, #1c2733)",
                            cursor: "pointer",
                            borderRadius: 4,
                            transition: "background 150ms ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(89, 128, 166, 0.12)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, minWidth: 0 }}>
                            <StockLogo sym={peer.t} size={18} />
                            <span style={{ color: "var(--si-accent-light, #a9c6e3)" }}>{peer.t}</span>
                            <span style={{ fontSize: 11, color: "var(--si-text-dim, #64748b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {peer.name !== peer.t ? peer.name : ""}
                            </span>
                          </span>
                          <span style={{ textAlign: "right" }}>{pStr}</span>
                          <span style={{ textAlign: "right", color: chgCol, fontWeight: 600 }}>{chgStr}</span>
                          <span title={ytdTitle} style={{ textAlign: "right", color: ytd == null ? "var(--si-text-mid, #93a1af)" : ytdCol, fontWeight: 600, cursor: ytdTitle ? "help" : undefined }}>{ytdStr}</span>
                          <span style={{ textAlign: "right" }}>{mcapStr}</span>
                          <span style={{ textAlign: "right" }}>{peStr}</span>
                          <span style={{ textAlign: "right", color: "var(--si-text-mid, #93a1af)" }}>{rsStr}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ====================================================
            TAB 5: TECHNICALS (Issue 2: Full Live Technical Chart)
            ==================================================== */}
        {activeTab === "tech" && (
          <div className="si-ov" style={{ alignItems: "stretch" }}>
            <style>{`.si-ov{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);gap:18px;align-items:start}@media (max-width:1050px){.si-ov{grid-template-columns:minmax(0,1fr)}}`}</style>
            {/* Live technical chart with the full MC stock-function toolbar */}
            <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--si-border, #1c2733)", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StockLogo sym={stock.t} size={34} />
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "0.08em", color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>{stock.t}</div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#ffffff", opacity: 0.7, marginTop: 3 }}>{stock.name || liveCompany?.name}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{usd(stock.p)}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: stock.c >= 0 ? UP : DN }}>{pct(stock.c)}</span>
                </div>
              </div>
              <div className="si-tech-chart" style={{ minHeight: 540, width: "100%" }}>
                <style>{`.si-tech-chart .cc-tvbtn.icon{display:none}.si-tech-chart .cc-tvbtn{display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:12.96px;font-weight:500;line-height:1.2;padding:6px 8px;background:none;border:0;color:var(--si-text-hi,#e8eef4);cursor:pointer;white-space:nowrap}.si-tech-chart .cc-tvbtn svg{opacity:.75}.si-tech-chart .cc-tvbtn b{font-weight:600}.si-tech-chart .cc-tvbtn b{font-size:inherit}${isLight ? "" : ".si-tech-chart .rng.indbtn{padding:4px 9px;border-radius:6px;font-weight:600;color:#6c747c;background:transparent}.si-tech-chart .rng.indbtn.on{background:#14181b;color:#f4f6f5}.si-tech-chart .cc-ma.on .cc-ma-all,.si-tech-chart .cc-ma.on .cc-ma-all *{color:#f4f6f5}.si-tech-chart .cc-ma:not(.on) .cc-ma-all,.si-tech-chart .cc-ma:not(.on) .cc-ma-all *{color:#6c747c}"}`}</style>
                <StockChart
                  sym={stock.t}
                  name={stock.name || liveCompany?.name}
                  interval={barInterval}
                  onIntervalChange={setBarInterval}
                  expandable
                  height={540}
                  data={{
                    live,
                    bars: { bars: realBars, loading: barsLoading },
                    yearBars: yearBars ?? null,
                    news: tickerNews,
                    earnings: chartEarnings,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
              {technicalReadCard}

              {/* Key levels */}
              <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 8 }}>
                  KEY SUPPORT & RESISTANCE LEVELS
                </span>
                {stockDetail.levels.map((lv, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, color: "#ffffff" }}>{lv.k}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 600, color: lv.col }}>{lv.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 7: AI RESEARCH
            ==================================================== */}
        {activeTab === "ai" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18, alignItems: "start" }}>
            <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", display: "flex", flexDirection: "column", minHeight: 560 }}>
              <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                  ✦ AI RESEARCH COPILOT
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-mid, #93a1af)", border: "1px solid var(--si-border-sec, #2a3a4a)", padding: "2px 8px" }}>
                  CONTEXT · {stock.t} · {stock.setup}
                </span>
              </div>
              <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {aiAnalysisDoc?.analysis && (
                  <div style={{ border: "1px solid rgba(127,168,208,0.25)", background: "var(--si-card-tint, rgba(12, 17, 24, 0.6))", padding: "14px 16px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4ade80", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.1)", padding: "1px 6px" }}>
                        MC AI SYNTHESIS · {aiAnalysisDoc.model || "GEMINI"}
                      </span>
                      {aiAnalysisDoc.analysis.headline && (
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                          {aiAnalysisDoc.analysis.headline}
                        </span>
                      )}
                    </div>
                    {aiAnalysisDoc.analysis.newsSummary && (
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.5, marginBottom: 6 }}>
                        {aiAnalysisDoc.analysis.newsSummary}
                      </div>
                    )}
                    {aiAnalysisDoc.analysis.technicalSummary && (
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-accent-soft, #7fa8d0)", lineHeight: 1.4 }}>
                        {aiAnalysisDoc.analysis.technicalSummary}
                      </div>
                    )}
                  </div>
                )}
                {aiChat.length === 0 && !aiAnalysisDoc?.analysis && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.6 }}>
                    Ask anything about {stock.t}. The assistant already has full knowledge of current signals, catalysts, valuation metrics, and intraday factor attribution.
                  </div>
                )}
                {aiChat.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      // Theme tokens, not fixed dark values: the reply bubble was a
                      // hard-coded near-black, so in day mode the (dark) text sat
                      // on a dark box and could not be read.
                      border: m.role === "user" ? "1px solid #5980a6" : "1px solid var(--si-border, #1c2733)",
                      background: m.role === "user" ? "rgba(89,128,166,0.18)" : "var(--si-card, rgba(12,17,24,0.95))",
                      padding: "12px 16px",
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: 14.5,
                      color: "var(--si-text-hi, #e8eef4)",
                      lineHeight: 1.55,
                      whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                    }}
                  >
                    {m.role === "user" ? m.text : formatAiChatReply(m.text)}
                    {m.note && (
                      <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-sub, #5d6b79)", lineHeight: 1.4 }}>
                        {m.note}
                      </div>
                    )}
                  </div>
                ))}
                {aiBusy && (
                  <div style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-accent-soft, #7fa8d0)" }}>
                    Synthesizing research on {stock.t}…
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", padding: 12, display: "flex", gap: 8 }}>
                <input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                  placeholder={`Ask about ${stock.t}…`}
                  style={{
                    flex: 1,
                    height: 42,
                    background: "var(--si-bg, #080b10)",
                    border: "1px solid var(--si-border-sec, #2a3a4a)",
                    color: "var(--si-text-hi, #e8eef4)",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 14,
                    padding: "0 14px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => handleAskAI()}
                  style={{
                    height: 42,
                    padding: "0 18px",
                    border: "none",
                    background: "#5980a6",
                    color: "#ffffff",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ask
                </button>
              </div>
            </div>

            {/* Suggested Prompts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                SUGGESTED RESEARCH QUESTIONS
              </div>
              {[
                `What is the institutional bull case for ${stock.t}?`,
                `What is the biggest downside risk or bear trade?`,
                `What exact price and metric levels invalidate this setup?`,
                `How does ${stock.t}'s valuation compare against peers?`,
              ].map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleAskAI(sq)}
                  style={{
                    textAlign: "left",
                    border: "1px solid var(--si-border, #1c2733)",
                    background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                    padding: 14,
                    color: "var(--si-text-hi, #e8eef4)",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 13.5,
                    lineHeight: 1.4,
                    cursor: "pointer",
                  }}
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 8: THESIS LAB (Issue 6 & 7: Full Scenario Engine)
            ==================================================== */}
        {activeTab === "lab" && (() => {
          if (!labStarted) {
            const ready = pickDir != null && pickHz != null && pickMode != null;
            const stepLabel: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 8 };
            const choice = (active: boolean, accent: string, disabled: boolean): React.CSSProperties => ({
              height: 44,
              minWidth: 120,
              padding: "0 18px",
              border: `1px solid ${active ? accent : "#1c2733"}`,
              background: active ? "rgba(89,128,166,0.2)" : "transparent",
              color: "#ffffff",
              opacity: disabled ? 0.35 : 1,
              fontFamily: "'Manrope', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "background 160ms, border-color 160ms",
            });
            return (
              <>
                {labSavedNote && (
                  <div style={{ maxWidth: 780, width: "100%", margin: "14px auto -6px", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.07)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--up, #4ade80)", fontSize: 16 }}>✓</span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "#ffffff" }}>{labSavedNote}</span>
                    <button
                      onClick={() => {
                        setLabSavedNote(null);
                        setActiveTab("mon");
                      }}
                      style={{ marginLeft: "auto", height: 30, padding: "0 12px", border: "1px solid var(--si-accent, #5980a6)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}
                    >
                      VIEW IN TRADE TRACKER ▸
                    </button>
                    <button onClick={() => setLabSavedNote(null)} aria-label="Dismiss" style={{ width: 26, height: 26, border: "none", background: "transparent", color: "#ffffff", fontSize: 16, cursor: "pointer" }}>
                      ×
                    </button>
                  </div>
                )}
                <div
                  id="si-trade-builder-top"
                  style={{ scrollMarginTop: 110, maxWidth: 780, width: "100%", margin: "14px auto 20px", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 30px", display: "flex", flexDirection: "column", gap: 20 }}
                >
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)", textShadow: "0 0 6px rgba(127, 168, 208, 0.75), 0 0 14px rgba(89, 128, 166, 0.55)" }}>TRADE BUILDER</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, color: "#ffffff", marginTop: 4, lineHeight: 1.05 }}>BUILD YOUR TRADE STRATEGY FOR {stock.t}</div>
                  </div>
                  <div>
                    <div style={stepLabel}>STEP 1 · DIRECTION</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(["Bull", "Bear"] as const).map((d) => (
                        <button key={d} onClick={() => setPickDir(d)} style={choice(pickDir === d, d === "Bull" ? UP : DN, false)}>
                          {d === "Bull" ? "▲ Bullish" : "▼ Bearish"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={stepLabel}>STEP 2 · HORIZON</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["1M", "3M", "6M", "9M"].map((hz) => (
                        <button key={hz} disabled={pickDir == null} onClick={() => setPickHz(hz)} style={{ ...choice(pickHz === hz, STEEL, pickDir == null), minWidth: 80, fontFamily: "'JetBrains Mono', monospace" }}>
                          {hz}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={stepLabel}>STEP 3 · MODE</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {([
                        ["NORMAL", "Normal", "Engine weights, fixed"],
                        ["ADVANCED", "Advanced", "Edit the engine weights yourself"],
                      ] as const).map(([m, title, sub]) => (
                        <button
                          key={m}
                          disabled={pickHz == null}
                          onClick={() => setPickMode(m)}
                          style={{ ...choice(pickMode === m, STEEL, pickHz == null), height: 62, minWidth: 230, textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}
                        >
                          <span>{title}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <button
                      disabled={!ready}
                      onClick={() => {
                        if (!pickDir || !pickHz || !pickMode) return;
                        setLabDir(pickDir);
                        setLabHz(pickHz);
                        setLabMode(pickMode);
                        setLabWeightsState(null);
                        setTargetOverride(null);
                        setStopOverride(null);
                        setLabEditTargets(false);
                        setLabBreakdownOpen({});
                        setLabSavedNote(null);
                        setLabStarted(true);
                      }}
                      style={{ height: 50, padding: "0 30px", border: "none", background: ready ? "#5980a6" : "#1c2733", color: "#ffffff", opacity: ready ? 1 : 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", cursor: ready ? "pointer" : "not-allowed" }}
                    >
                      RUN STRATEGY →
                    </button>
                  </div>
                </div>
                <TradeBuilderGuide done={[pickDir != null, pickHz != null, pickMode != null]} />
              </>
            );
          }
          const thBull = labDir === "Bull";
          // Custom weights only count in Advanced mode.
          const thCustomW = labMode === "ADVANCED" ? labWeightsState : null;
          const thRun = thesisRun(stock.t, labDir, labHz, null, thCustomW || undefined, siFacts);
          const thPrev = thesisRun(stock.t, labDir, labHz, (c: any, n: any, f: any, dd: number) => -dd, thCustomW || undefined, siFacts);
          const TT = thesisTargets(stock.t, labDir, labHz, thRun, stock.p, siFacts);
          const TPt = getTP(stock.t, siFacts);

          const tgtV = targetOverride != null ? targetOverride : TT.target;
          const stopV = stopOverride != null ? stopOverride : TT.stop;
          const thUp = ((tgtV / stock.p) - 1) * 100;
          const thDn = ((stopV / stock.p) - 1) * 100;
          const thRR = Math.abs(thUp / (thDn || 1));
          const thConf = thRun.conf != null ? Math.round(thRun.conf) : null;
          const dConf = (thRun.conf != null && thPrev.conf != null) ? Math.round(thRun.conf - thPrev.conf) : 0;
          const thBand: [string, string] = thConf == null
            ? ["UNAVAILABLE", "#93a1af"]
            : thConf >= 75
                ? ["HIGH CONVICTION", UP]
                : thConf >= 60
                  ? ["CONSTRUCTIVE", STEEL]
                  : thConf >= 45
                    ? ["MIXED", "#f5b031"]
                    : ["WEAK", DN];

          const thStrong = thRun.drv.slice().sort((a: any, b: any) => b.pts - a.pts).slice(0, 3);

          const thLo = Math.min(TT.dn, stopV, stock.p) * 0.97;
          const thHi = Math.max(TT.up, tgtV, stock.p) * 1.03;
          const thPos = (v: number) => (((v - thLo) / (thHi - thLo || 1)) * 100).toFixed(2) + "%";

          // Historical price series based on real market bars (replaces PRNG synthetic series)
          // Sliced to the selected horizon (1M/3M/6M/12M) so Return, High, Low,
          // Max Drawdown and Volatility change with the buttons.
          const histBars = barsForHorizon(labHz, yearBars, sixMonthBars);
          const hs = histBars && histBars.length >= 5
            ? histBars.map((b) => b.c)
            : [stock.p * 0.95, stock.p * 0.98, stock.p];
          const hExt = hs.concat([tgtV, stopV]);
          const hsLo = Math.min(...hExt) * 0.97;
          const hsHi = Math.max(...hExt) * 1.03;
          const hsDiff = hsHi - hsLo || 1;
          const hsPath = hs
            .map((val, idx) => {
              const x = (idx / (hs.length - 1)) * 1000;
              const y = 260 - ((val - hsLo) / hsDiff) * 236 - 12;
              return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          const hsArea = `${hsPath} L 1000 260 L 0 260 Z`;
          const hsRet = ((hs[hs.length - 1] / hs[0]) - 1) * 100;
          let hsPk = hs[0], hsDD = 0;
          hs.forEach((v) => {
            hsPk = Math.max(hsPk, v);
            hsDD = Math.min(hsDD, (v / hsPk) - 1);
          });
          const hsRr = hs.slice(1).map((v, i) => Math.log(v / hs[i]));
          const hsMu = hsRr.reduce((a, b) => a + b, 0) / (hsRr.length || 1);
          const hsVolA = Math.sqrt(hsRr.reduce((a, b) => a + (b - hsMu) * (b - hsMu), 0) / (hsRr.length || 1)) * Math.sqrt(252) * 100;

          const yOf = (v: number) => 260 - ((v - hsLo) / hsDiff) * 236 - 12;
          const tgtYPct = `${(yOf(tgtV) / 260) * 100}%`;
          const stopYPct = `${(yOf(stopV) / 260) * 100}%`;
          const nowYPct = `${(yOf(stock.p) / 260) * 100}%`;


          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Thesis Controls Header */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--si-border, #1c2733)",
                  background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 230 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                    TRADE BUILDER · {stock.t}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", marginTop: 4 }}>
                    {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} STRATEGY
                  </div>
                  <button
                    onClick={() => {
                      setPickDir(labDir);
                      setPickHz(labHz);
                      setPickMode(labMode);
                      setLabStarted(false);
                    }}
                    style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer" }}
                  >
                    ← EDIT SETUP
                  </button>
                </div>

                {/* Mode Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    MODE
                  </div>
                  <div style={{ display: "flex", border: "1px solid var(--si-border-sec, #2a3a4a)", padding: 3, gap: 3 }}>
                    {(["NORMAL", "ADVANCED"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setLabMode(m);
                          if (m === "NORMAL") {
                            setTargetOverride(null);
                            setStopOverride(null);
                            setLabEditTargets(false);
                          }
                        }}
                        style={{
                          height: 30,
                          padding: "0 14px",
                          border: "none",
                          background: labMode === m ? "#5980a6" : "transparent",
                          color: labMode === m ? "#ffffff" : "#93a1af",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          cursor: "pointer",
                          transition: "background 160ms, color 160ms",
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direction Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    DIRECTION
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["Bull", "Bear"] as const).map((d) => {
                      const isActive = labDir === d;
                      const col = d === "Bull" ? UP : DN;
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            setLabDir(d);
                            setTargetOverride(null);
                            setStopOverride(null);
                            setLabWeightsState(null);
                          }}
                          style={{
                            width: 110,
                            height: 38,
                            border: `1px solid ${isActive ? col : "#1c2733"}`,
                            background: isActive ? (d === "Bull" ? "rgba(74,222,128,0.12)" : "rgba(240,86,86,0.12)") : "transparent",
                            color: "var(--si-text-hi, #e8eef4)",
                            fontFamily: "'Manrope', sans-serif",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "background 160ms, border-color 160ms",
                          }}
                        >
                          {d === "Bull" ? "▲ Bullish" : "▼ Bearish"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Horizon Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    HORIZON
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["1M", "3M", "6M", "9M"].map((hz) => {
                      const isActive = labHz === hz;
                      return (
                        <button
                          key={hz}
                          onClick={() => {
                            setLabHz(hz);
                            setTargetOverride(null);
                            setStopOverride(null);
                            setLabWeightsState(null);
                          }}
                          style={{
                            width: 60,
                            height: 38,
                            border: `1px solid ${isActive ? STEEL : "#1c2733"}`,
                            background: isActive ? "rgba(89,128,166,0.2)" : "transparent",
                            color: "var(--si-text-hi, #e8eef4)",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background 160ms, border-color 160ms",
                          }}
                        >
                          {hz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Driver Weights Strip */}
                <div style={{ marginLeft: "auto", minWidth: 300, flex: 1, maxWidth: 520, paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    <span>{thCustomW ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}</span>
                    <span style={{ color: "var(--si-text-mid, #93a1af)", letterSpacing: "0.04em" }}>
                      {labHz === "1M" ? "1M tactical" : labHz === "9M" || labHz === "12M" ? `${labHz} fundamental` : labHz === "3M" ? "3M momentum" : "6M balanced"} · {thBull ? "bullish" : "bearish"}
                    </span>
                  </div>
                  <div style={{ display: "flex", minHeight: 30, gap: 2 }}>
                    {thRun.cats.map((c: any) => (
                      <div
                        key={c.k}
                        style={{
                          flexGrow: c.w,
                          flexBasis: 0,
                          minWidth: 38,
                          borderTop: `2px solid ${sc(c.score)}`,
                          background: "rgba(89,128,166,0.12)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1.1,
                          padding: "3px 0",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--si-text-body, #d5dfe9)",
                          transition: "flex-grow 300ms ease",
                        }}
                      >
                        <span style={{ color: "var(--si-text-mid, #93a1af)" }}>{c.k}</span>
                        <span>{Math.round(c.w)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Engine weights: sliders are live in Advanced mode and greyed out (tap for an explanation) in Normal mode */}
              <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 28 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: thCustomW ? "#f5b031" : "var(--si-text-hi, #e8eef4)" }}>
                    {thCustomW ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}
                  </span>
                  <button
                    type="button"
                    aria-label="How the trade confidence is calculated"
                    aria-expanded={labExplainerOpen}
                    title="How this is calculated"
                    onClick={() => setLabExplainerOpen((v) => !v)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1px solid var(--si-accent-light, #a9c6e3)",
                      background: labExplainerOpen ? "var(--si-accent-light, #a9c6e3)" : "transparent",
                      color: labExplainerOpen ? "#0c1118" : "var(--si-accent-light, #a9c6e3)",
                      fontFamily: "Georgia, serif",
                      fontSize: 12,
                      fontStyle: "italic",
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: 0,
                      cursor: "pointer",
                      alignSelf: "center",
                      flex: "none",
                    }}
                  >
                    i
                  </button>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                    {labMode === "ADVANCED" ? "Drag to set relative importance — automatically normalized to 100%." : "Fixed in Normal mode."}
                  </span>
                  {labMode === "ADVANCED" && (
                    <button
                      onClick={() => setLabWeightsState(null)}
                      style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Reset to engine weights
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 22px" }}>
                  {CATS_T.map(([k, label]) => {
                    const raw = thCustomW ? thCustomW[k] : thesisWeights(labDir, labHz)[k];
                    const shown = Math.round(thRun.W[k]);
                    return (
                      <div key={k} style={{ position: "relative", opacity: labMode === "ADVANCED" ? 1 : 0.42, filter: labMode === "ADVANCED" ? "none" : "grayscale(1)", transition: "opacity 200ms ease" }}>
                        {labMode !== "ADVANCED" && (
                          <div
                            role="button"
                            aria-label={`${label} weight is fixed in Normal mode`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setLabWeightsDialog(true);
                            }}
                            style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "pointer" }}
                          />
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--si-text-body, #d5dfe9)", marginBottom: 4 }}>
                          <span>{label}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{shown}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          step="1"
                          value={raw || 0}
                          tabIndex={labMode === "ADVANCED" ? 0 : -1}
                          onChange={(e) => {
                            if (labMode !== "ADVANCED") {
                              setLabWeightsDialog(true);
                              return;
                            }
                            const base = labWeightsState || thesisWeights(labDir, labHz);
                            setLabWeightsState({ ...base, [k]: +e.target.value });
                          }}
                          style={{ width: "100%", accentColor: "#5980a6", cursor: "pointer" }}
                        />
                      </div>
                    );
                  })}
                </div>
                {labExplainerOpen && (
                  <ConfidenceExplainer cats={thRun.cats} conf={thConf} hz={labHz} bull={thBull} custom={!!thCustomW} onClose={() => setLabExplainerOpen(false)} />
                )}
                {labWeightsDialog && labMode !== "ADVANCED" && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Engine weights"
                    onClick={() => setLabWeightsDialog(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 7, 11, 0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: "min(420px, 100%)", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "var(--si-card, #0c1118)", boxShadow: "0 18px 48px rgba(0,0,0,0.6)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}
                    >
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-text-hi, #e8eef4)" }}>ENGINE WEIGHTS</div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "#ffffff", lineHeight: 1.55 }}>Switch to Advanced mode to edit the weights.</div>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                        <button
                          onClick={() => setLabWeightsDialog(false)}
                          style={{ height: 34, padding: "0 14px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          OK
                        </button>
                        <button
                          autoFocus
                          onClick={() => {
                            setLabWeightsDialog(false);
                            setLabMode("ADVANCED");
                          }}
                          style={{ height: 34, padding: "0 14px", border: "none", background: "var(--si-accent-btn, #5980a6)", color: "#ffffff", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                        >
                          Switch to Advanced
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))", gap: 18, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
                  {/* Market history */}
                  <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>MARKET HISTORY</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", color: "#ffffff" }}>LAST {labHz === "12M" ? "9M" : labHz}</span>
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.45 }}>
                      Historical Underlying Asset Benchmark Performance — buy-and-hold returns, drawdown and volatility; not an active strategy backtest.
                    </div>
                    <div style={{ position: "relative", height: 260 }}>
                      <svg width="100%" height="260" viewBox="0 0 1000 260" preserveAspectRatio="none" style={{ display: "block" }}>
                        <line x1="0" x2="1000" y1="65" y2="65" stroke="#152029" vectorEffect="non-scaling-stroke" />
                        <line x1="0" x2="1000" y1="130" y2="130" stroke="#152029" vectorEffect="non-scaling-stroke" />
                        <line x1="0" x2="1000" y1="195" y2="195" stroke="#152029" vectorEffect="non-scaling-stroke" />
                        <path d={hsArea} fill={hsRet >= 0 ? UP : DN} opacity="0.1" />
                        <path d={hsPath} fill="none" stroke={hsRet >= 0 ? UP : DN} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <div style={{ position: "absolute", left: 0, right: 0, top: tgtYPct, borderTop: "1px dashed #4ade80" }}>
                        <span style={{ position: "absolute", right: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#4ade80", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>TARGET {usd(tgtV)}</span>
                      </div>
                      <div style={{ position: "absolute", left: 0, right: 0, top: stopYPct, borderTop: "1px dashed #f05656" }}>
                        <span style={{ position: "absolute", left: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#f05656", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>INVALIDATION {usd(stopV)}</span>
                      </div>
                      <div style={{ position: "absolute", left: 0, right: 0, top: nowYPct, borderTop: "1px dashed rgba(255,255,255,0.55)" }}>
                        <span style={{ position: "absolute", right: 12, top: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#ffffff", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>PRESENT {usd(stock.p)}</span>
                      </div>
                      <div style={{ position: "absolute", right: -4, top: nowYPct, width: 8, height: 8, marginTop: -4, borderRadius: 99, background: "#e8eef4", boxShadow: "0 0 10px rgba(232,238,244,0.6)" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                      {[
                        ["RETURN", pct1(hsRet), hsRet >= 0 ? UP : DN],
                        ["HIGH", usd(Math.max(...hs)), "var(--si-text-hi, #e8eef4)"],
                        ["LOW", usd(Math.min(...hs)), "var(--si-text-hi, #e8eef4)"],
                        ["MAX DRAWDOWN", pct1(hsDD * 100), "var(--down, #dc2626)"],
                        ["VOLATILITY", Math.round(hsVolA) + "% ann.", "var(--si-text-hi, #e8eef4)"],
                      ].map(([k, v, c], idx) => (
                        <div key={idx} style={{ padding: "10px 12px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>{k}</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: c as string, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trade card */}
                  <div style={{ position: "relative", border: "1px solid #5980a6", background: "var(--si-card, rgba(12, 17, 24, 0.95))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>TRADE CARD</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                        {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} TRADE
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                      {[
                        ["PRESENT PRICE", usd(stock.p), "#ffffff"],
                        ["TARGET", usd(tgtV), thBull ? UP : DN],
                        ["INVALIDATION", usd(stopV), DN],
                        ["UPSIDE", pct1(thUp), UP],
                        ["DOWNSIDE", pct1(thDn), DN],
                        ["REWARD / RISK", thRR.toFixed(1) + "×", thRR >= 2 ? UP : thRR >= 1.2 ? "#f5b031" : DN],
                        ["TRADE CONFIDENCE", thConf != null ? `${thConf} / 100` : "Unavailable", thBand[1]],
                      ].map(([k, v, c], idx) => (
                        <div key={idx} style={{ padding: "12px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#ffffff" }}>{k}</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: c as string, marginTop: 4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                      <div style={{ border: "1px solid var(--si-border, #1c2733)", padding: "12px 14px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>KEY CATALYST</div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", marginTop: 6 }}>{TPt.cat}</div>
                      </div>
                      <div style={{ border: "1px solid var(--si-border, #1c2733)", padding: "12px 14px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#f5b031" }}>BIGGEST RISK</div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", marginTop: 6 }}>{TPt.risk}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setLabSaveOpen(true)}
                      style={{ height: 48, border: "none", background: "#5980a6", color: "#ffffff", fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "background 160ms" }}
                    >
                      Save and monitor trade setup →
                    </button>
                  </div>

                  {/* Price target: only in Advanced mode, where the target and stop can be overridden */}
                  {labMode === "ADVANCED" && (
                    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>PRICE TARGET</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: targetOverride != null ? "#f5b031" : STEEL, border: `1px solid ${targetOverride != null ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {targetOverride != null ? "OVERRIDDEN" : "SUGGESTED"}
                        </span>
                        <button
                          onClick={() => setLabEditTargets(!labEditTargets)}
                          style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {labEditTargets ? "Done" : "Edit / Override"}
                        </button>
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>{usd(tgtV)}</div>
                      <div style={{ position: "relative", height: 56, margin: "4px 6px 0" }}>
                        <div style={{ position: "absolute", left: 0, right: 0, top: 26, height: 2, background: "#1c2733" }} />
                        <div style={{ position: "absolute", top: 18, left: thPos(stopV), width: 2, height: 18, background: "#f05656" }} />
                        <div style={{ position: "absolute", top: 16, left: thPos(tgtV), width: 12, height: 12, marginLeft: -5, border: "2px solid #e8eef4", background: "var(--si-bg, #080b10)", transform: "rotate(45deg)", transition: "left 300ms ease" }} />
                        {([
                          ["BEAR", TT.dn, DN],
                          ["NOW", stock.p, "var(--si-text-hi, #e8eef4)"],
                          ["BASE", TT.base, STEEL],
                          ["BULL", TT.up, UP],
                        ] as [string, number, string][]).map(([k, v, c], idx) => (
                          <div key={idx} style={{ position: "absolute", top: 0, left: thPos(v), transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: c }}>{k}</span>
                            <span style={{ width: 1, height: 14, background: c, marginTop: 2 }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "var(--si-text-mid, #93a1af)", marginTop: 16 }}>{usd(v)}</span>
                          </div>
                        ))}
                      </div>
                      {labEditTargets && (
                        <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                              <span>OVERRIDE TARGET · SUGGESTED {usd(TT.target)}</span>
                              <span style={{ color: "var(--si-text-hi, #e8eef4)" }}>{usd(tgtV)}</span>
                            </div>
                            <input type="range" min={Math.round(stock.p * 0.5)} max={Math.round(stock.p * 1.8)} step="1" value={Math.round(tgtV)} onChange={(e) => setTargetOverride(+e.target.value)} style={{ width: "100%", accentColor: UP }} />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                              <span>OVERRIDE INVALIDATION · SUGGESTED {usd(TT.stop)}</span>
                              <span style={{ color: "#f05656" }}>{usd(stopV)}</span>
                            </div>
                            <input type="range" min={Math.round(stock.p * 0.5)} max={Math.round(stock.p * 1.4)} step="1" value={Math.round(stopV)} onChange={(e) => setStopOverride(+e.target.value)} style={{ width: "100%", accentColor: DN }} />
                          </div>
                          <button
                            onClick={() => {
                              setTargetOverride(null);
                              setStopOverride(null);
                            }}
                            style={{ alignSelf: "flex-start", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Reset to suggested
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right column: the trade confidence and where it comes from */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, #0c1118)", boxShadow: "var(--si-shadow, none)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>TRADE CONFIDENCE</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: thConf != null ? 56 : 32, fontWeight: 700, lineHeight: 0.9, color: thConf != null ? thBand[1] : "var(--si-text-hi, #e8eef4)" }}>{thConf ?? "Unavailable"}</span>
                          {thConf != null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: "var(--si-text-sub, #5d6b79)" }}>/ 100</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: thBand[1] }}>{thBand[0]}</div>
                      </div>
                    </div>
                    <div style={{ height: 8, background: "var(--si-border, #1c2733)" }}>
                      <div style={{ height: 8, width: `${thConf ?? 0}%`, background: thBand[1], transition: "width 400ms ease" }} />
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.55 }}>
                      {thBull ? "Bullish" : "Bearish"} because {thStrong.map((d: any) => `${d.name} (${d.val})`).join(", ")} carry the most weight in the {labHz} profile.
                    </div>
                    <ConfidenceBreakdown cats={thRun.cats} colorFor={sc} open={labBreakdownOpen} onToggle={(k) => setLabBreakdownOpen((o) => ({ ...o, [k]: !o[k] }))} />
                  </div>
                </div>
              </div>

              {labSaveOpen && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Save this trade"
                  onClick={() => setLabSaveOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 7, 11, 0.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: "min(440px, 100%)", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "var(--si-card, #0c1118)", boxShadow: "0 18px 48px rgba(0,0,0,0.6)", padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14 }}
                  >
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", color: "#ffffff" }}>SAVE THIS TRADE?</div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, color: "#ffffff", lineHeight: 1.55 }}>
                      <b style={{ color: thBull ? "var(--up, #4ade80)" : "var(--down, #f87171)" }}>{thBull ? "Long" : "Short"}</b> {stock.t}, target <b style={{ color: "var(--up, #4ade80)" }}>{usd(tgtV)}</b>, invalidation <b style={{ color: "var(--down, #f87171)" }}>{usd(stopV)}</b> over <b style={{ color: "#4fb3ff" }}>{labHz}</b>. It will be saved in your Trade Tracker, and you will be taken back to the Trade Builder setup.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                      <button
                        onClick={() => setLabSaveOpen(false)}
                        style={{ height: 40, padding: "0 18px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        autoFocus
                        onClick={() => {
                          // Added to this stock's saved trades; nothing already saved is replaced.
                          const nowMs = Date.now();
                          let saved: SavedTrade | null = null;
                          try {
                            const { trades, trade } = addTrade(
                              readTrades(localStorage, stock.t),
                              {
                                ticker: stock.t,
                                dir: labDir,
                                hz: labHz,
                                title: `${thBull ? "LONG" : "SHORT"} ${stock.t} → ${usd(tgtV)} · ${labHz}`,
                                target: tgtV,
                                stop: stopV,
                                confAtSave: thConf,
                                savedDate: "Just now · Active",
                                entryPx: Number.isFinite(stock.p) ? stock.p : null,
                                savedAt: new Date(nowMs).toISOString(),
                                wO: thCustomW,
                              },
                              nowMs,
                            );
                            writeTrades(localStorage, stock.t, trades);
                            setSavedTrades(trades);
                            saved = trade;
                          } catch { }
                          if (saved) setSelectedTradeId(saved.id);
                          setLabSaveOpen(false);
                          setLabSavedNote(`${stock.t} trade saved to your Trade Tracker`);
                          resetBuilder();
                          setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
                        }}
                        style={{ height: 40, padding: "0 20px", border: "none", background: "#5980a6", color: "#ffffff", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                      >
                        Save to Trade Tracker
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ====================================================
            TAB 9: TRADE TRACKER (was "Strategy Monitor"; Issue 7: Full Monitored View)
            ==================================================== */}
        {activeTab === "mon" && (() => {
          // With a saved trade the tab is a list on the left and the open stock's
          // trade on the right; with none it stays full width.
          const monLayout = (body: React.ReactNode) =>
            trackedTrades.length > 0 ? (
              <div className="si-trk">
                <TrackedTradesList trades={trackedTrades} activeId={savedThesis?.id ?? null} onSelect={selectTrackedTrade} onRemove={removeSavedTrade} />
                <div className="si-trk-detail">{body}</div>
              </div>
            ) : body;

          if (!savedThesis) {
            return monLayout(
              <div
                style={{
                  border: "1px dashed var(--si-border-dashed, #2a3a4a)",
                  borderRadius: 8,
                  padding: "64px 24px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                  maxWidth: 680,
                  margin: "40px auto",
                  boxShadow: "var(--si-shadow, 0 4px 16px rgba(0,0,0,0.5))",
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "var(--si-accent-bg, rgba(89, 128, 166, 0.18))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--si-accent-soft, #7fa8d0)",
                    marginBottom: 4,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "var(--si-text-hi, #e8eef4)",
                  }}
                >
                  PAPER TRADE TRACKER — CLIENT-SIDE ONLY
                </span>
                <span
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 15,
                    color: "var(--si-text-mid, #93a1af)",
                    maxWidth: 520,
                    lineHeight: 1.55,
                  }}
                >
                  No trade is being tracked for {stock.t}. Save a trade setup in Trade Builder to track it. This trade is stored in the current browser and is not broker-connected or guaranteed to synchronize across devices.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("lab")}
                  style={{
                    height: 44,
                    padding: "0 24px",
                    border: "none",
                    background: "var(--si-accent-btn, #5980a6)",
                    color: "#ffffff",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    borderRadius: 4,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                    transition: "all 150ms ease",
                  }}
                >
                  Save a Trade Setup in Trade Builder →
                </button>
              </div>
            );
          }

          const b2 = savedThesis.dir === "Bull";
          const TPt = getTP(stock.t, siFacts);
          const monAdj = (cat: string, name: string, fl: string) => {
            let a = 0;
            if (monScenario === "cut" && cat === "EARN") a += fl.indexOf("K") >= 0 ? -60 : -28;
            if (monScenario === "cut" && cat === "BUS" && fl.indexOf("K") >= 0) a -= 10;
            if (monScenario === "surge" && (cat === "TECH" || cat === "POS")) a += 12;
            if (monScenario === "break" && cat === "TECH") a -= 30;
            return a;
          };

          const monRun = thesisRun(stock.t, savedThesis.dir, savedThesis.hz, monAdj, savedThesis.wO || undefined, siFacts);
          const monPx = monScenario === "break" ? (b2 ? savedThesis.stop * 0.985 : savedThesis.stop * 1.015) : stock.p;
          const monPriceBroken = b2 ? monPx <= savedThesis.stop : monPx >= savedThesis.stop;
          // The weakest of the seven categories that have data.
          const monWeakest = monRun.cats.filter((c: any) => c.ds.length > 0).sort((a: any, b: any) => a.score - b.score)[0];
          const monConfInvalid = monRun.conf != null && monRun.conf < 30;
          const monDelta = (monRun.conf != null && savedThesis.confAtSave != null) ? monRun.conf - savedThesis.confAtSave : 0;
          const monEntry = typeof savedThesis.entryPx === "number" && savedThesis.entryPx > 0 ? savedThesis.entryPx : null;
          // Against the live price (the PRICE NOW at the top), not a simulated one.
          const monSinceEntry = monEntry != null && Number.isFinite(stock.p) ? ((stock.p - monEntry) / monEntry) * 100 : null;

          let monStatus = "ON TRACK";
          let monCol = UP;
          let monCause = monRun.conf != null ? `Trade confidence ${Math.round(monRun.conf)} / 100, within tolerance.` : "Trade confidence unavailable.";
          let monBy = "Trade confidence";

          if (monPriceBroken) {
            monStatus = "INVALIDATED";
            monCol = DN;
            monBy = "Price invalidation";
            monCause = `Price closed ${b2 ? "below" : "above"} the ${usd(savedThesis.stop)} invalidation level (${usd(monPx)}).`;
          } else if (monConfInvalid) {
            monStatus = "INVALIDATED";
            monCol = DN;
            monBy = "Trade confidence";
            monCause = `Trade confidence fell to ${Math.round(monRun.conf ?? 0)}, below the 30 invalidation line.`;
          } else if (monRun.conf != null && monRun.conf < 45) {
            monStatus = "AT RISK";
            monCol = "#f2763a";
            monBy = "Trade confidence";
            monCause = "Trade confidence fell below 45.";
          } else if (monDelta >= 3) {
            monStatus = "STRENGTHENING";
            monCol = UP;
            monBy = "Score momentum";
            monCause = `Trade evidence improved (+${Math.round(monDelta)} pts).`;
          } else if (monDelta <= -3) {
            monStatus = "WEAKENING";
            monCol = "#f5b031";
            monBy = "Factor pressure";
            monCause = `Trade evidence slipped (${Math.round(monDelta)} pts).`;
          }

          const L5 = ["ON TRACK", "STRENGTHENING", "WEAKENING", "AT RISK", "INVALIDATED"];
          const lo2 = Math.min(savedThesis.stop, savedThesis.target);
          const hi2 = Math.max(savedThesis.stop, savedThesis.target);
          const monNowF = Math.max(0, Math.min(1, (monPx - lo2) / (hi2 - lo2 || 1)));

          return monLayout(
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Monitored Summary Box */}
              <div style={{ position: "relative", border: `1px solid ${monCol}`, background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, transition: "border-color 300ms" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 22, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                      <span style={{ color: savedThesis.dir === "Bull" ? UP : DN }}>{savedThesis.dir === "Bull" ? "LONG" : "SHORT"}</span> {stock.t} · TARGET{" "}
                      <span style={{ color: UP }}>{usd(savedThesis.target).replace(/\.00$/, "")}</span> IN <span style={{ color: "#4fb3ff" }}>{savedThesis.hz}</span> TIMEFRAME
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span title="This trade is stored in your current browser. It is not broker-connected and may not sync across devices." style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", background: "rgba(89, 128, 166, 0.2)", padding: "2px 6px", borderRadius: 3, color: "var(--si-accent-light, #a9c6e3)" }}>
                        SAVED IN THIS BROWSER · NOT BROKER-CONNECTED
                      </span>
                    </div>
                    {formatSavedAt(savedThesis.savedAt) && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "var(--si-text-mid, #93a1af)", marginTop: 4 }}>
                        Saved on {formatSavedAt(savedThesis.savedAt)}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          setLabDir(savedThesis.dir);
                          setLabHz(savedThesis.hz);
                          // Advanced mode, so the saved weights, target and invalidation are visible and editable.
                          setLabMode("ADVANCED");
                          setLabWeightsState(savedThesis.wO || null);
                          setTargetOverride(savedThesis.target);
                          setStopOverride(savedThesis.stop);
                          setLabBreakdownOpen({});
                          setLabSavedNote(null);
                          setLabStarted(true);
                          setActiveTab("lab");
                        }}
                        style={{ height: 30, padding: "0 12px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit in Trade Builder
                      </button>

                      {confirmDeleteThesis ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2" }}>
                            Remove this trade?
                          </span>
                          <button
                            onClick={() => removeSavedTrade(savedThesis)}
                            style={{ height: 30, padding: "0 12px", border: "none", background: "#f05656", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmDeleteThesis(false)}
                            style={{ height: 30, padding: "0 12px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteThesis(true)}
                          style={{ height: 30, padding: "0 12px", border: "1px solid rgba(240,86,86,0.45)", background: "transparent", color: "#f08a8a", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Remove trade
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 36, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end", textAlign: "right" }}>
                    {/* The stock's live price, whatever scenario is simulated below. */}
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>PRICE NOW</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "0.02em", color: "var(--si-text-hi, #e8eef4)" }}>
                        {usd(stock.p)}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: stock.c >= 0 ? UP : DN }}>
                        {pct(stock.c)} today
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>STATUS</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "0.04em", color: monCol, transition: "color 300ms" }}>
                        {monStatus}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-Step Status Ladder */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4 }}>
                  {L5.map((k) => {
                    const isCurrent = k === monStatus;
                    return (
                      <div
                        key={k}
                        style={{
                          height: 30,
                          border: `1px solid ${isCurrent ? monCol : "#1c2733"}`,
                          background: isCurrent ? `${monCol}1f` : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: isCurrent ? 700 : 600,
                          letterSpacing: "0.08em",
                          color: isCurrent ? monCol : "var(--si-text-hi, #e8eef4)",
                          transition: "all 250ms",
                        }}
                      >
                        {k}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)" }}>CHANGED BY</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{monBy}</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-body, #c5d0db)" }}>{monCause}</span>
                </div>

                {/* Progress bar between stop and target */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#f05656" }}>
                    INVALIDATION {usd(savedThesis.stop)}
                  </span>
                  <div style={{ position: "relative", flex: 1, height: 10, background: "#1c2733" }}>
                    <div style={{ height: 10, width: `${monNowF * 100}%`, background: "#5980a6", transition: "width 300ms" }} />
                    <div style={{ position: "absolute", top: -6, left: `${monNowF * 100}%`, width: 2, height: 22, background: "#e8eef4", transition: "left 300ms" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#4ade80" }}>
                    TARGET {usd(savedThesis.target)}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>CONFIDENCE AT SAVE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{savedThesis.confAtSave != null ? savedThesis.confAtSave : "Unavailable"}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>CONFIDENCE NOW</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                      {monRun.conf != null ? (
                        <>
                          {Math.round(monRun.conf)}{" "}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: monDelta > 0 ? UP : monDelta < 0 ? "#f5b031" : "#93a1af" }}>
                            ({monDelta >= 0 ? "+" : ""}{Math.round(monDelta)})
                          </span>
                        </>
                      ) : (
                        "Unavailable"
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>WEAKEST DRIVER</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: monWeakest ? sc(Math.round(monWeakest.score)) : "var(--si-text-hi, #e8eef4)" }}>{monWeakest ? `${monWeakest.k} ${Math.round(monWeakest.score)}` : "—"}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>ENTRY PRICE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{monEntry != null ? usd(monEntry) : "Unavailable"}</div>
                    {monEntry != null && savedThesis.savedAt && !Number.isNaN(Date.parse(savedThesis.savedAt)) && (
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--si-text-mid, #93a1af)" }}>
                        Started {new Date(savedThesis.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    {monSinceEntry != null && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: (b2 ? monSinceEntry >= 0 : monSinceEntry <= 0) ? UP : DN }}>
                        {pct(monSinceEntry)} since entry
                      </div>
                    )}
                  </div>
                </div>

                {/* Simulate Scenarios Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginRight: 4 }}>
                    SIMULATE
                  </span>
                  {[
                    ["live", "Live data"],
                    ["cut", "EPS estimates cut −12%"],
                    ["break", "Price breaks support"],
                    ["surge", "Momentum surge"],
                  ].map(([k, l]) => {
                    const isCur = monScenario === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setMonScenario(k as typeof monScenario)}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          border: `1px solid ${isCur ? STEEL : "#1c2733"}`,
                          background: isCur ? "rgba(89,128,166,0.22)" : "transparent",
                          color: "var(--si-text-hi, #e8eef4)",
                          fontFamily: "'Manrope', sans-serif",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 160ms, border-color 160ms",
                        }}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Driver Tracking Table & Invalidation Checks */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, alignItems: "start" }}>
                {/* Driver Tracking Table */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", flex: 1 }}>
                      DRIVER TRACKING
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-text-sub, #5d6b79)", width: 46, textAlign: "right" }}>SAVED</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-text-sub, #5d6b79)", width: 46, textAlign: "right" }}>NOW</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-text-sub, #5d6b79)", width: 42, textAlign: "right" }}>Δ</span>
                    <span style={{ width: 92 }} />
                  </div>

                  {monRun.drv.slice(0, 8).map((d: any, idx: number) => {
                    const was = Math.round(d.ev - (d.dd || 0));
                    const now = Math.round(d.ev);
                    const dv = now - was;
                    const stt = now < 40
                      ? ["AGAINST", DN]
                      : dv <= -3
                        ? ["SLIPPING", "#f5b031"]
                        : dv >= 3
                          ? ["IMPROVING", UP]
                          : ["HOLDING", STEEL];

                    return (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {d.name}
                        </span>
                        <span style={{ width: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>
                          {was}
                        </span>
                        <span style={{ width: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                          {now}
                        </span>
                        <span style={{ width: 34, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: dv > 0 ? UP : dv < 0 ? "#f5b031" : "#93a1af" }}>
                          {dv >= 0 ? "+" : ""}{dv}
                        </span>
                        <span style={{ width: 92, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: stt[1] as string }}>
                          {stt[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Right Side: Invalidation Checks & Alert Log */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Invalidation Checks */}
                  <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 12 }}>
                      INVALIDATION CHECKS
                    </div>
                    {[
                      {
                        k: `Daily close ${b2 ? "below" : "above"} ${usd(savedThesis.stop)}`,
                        st: monPriceBroken ? "TRIGGERED" : "CLEAR",
                        c: monPriceBroken ? DN : UP,
                      },
                      {
                        k: "Trade confidence under 30 (at risk under 45)",
                        st: monConfInvalid ? "TRIGGERED" : monRun.conf != null && monRun.conf < 45 ? "WATCH" : "CLEAR",
                        c: monConfInvalid ? DN : monRun.conf != null && monRun.conf < 45 ? "#f5b031" : UP,
                      },
                    ].map((fc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: fc.c, boxShadow: `0 0 8px ${fc.c}` }} />
                        <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)" }}>
                          {fc.k}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: fc.c }}>
                          {fc.st}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Alert Log */}
                  <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 12 }}>
                      ALERT LOG
                    </div>
                    {[
                      ["Now", `Status → ${monStatus}. ${monCause}`],
                      [formatSavedAt(savedThesis.savedAt).split(" · ")[0] || savedThesis.savedDate, `Trade saved${monEntry != null ? ` at ${usd(monEntry)}` : ""} · confidence ${savedThesis.confAtSave != null ? savedThesis.confAtSave : "Unavailable"} · target ${usd(savedThesis.target)} · invalidation ${usd(savedThesis.stop)}.`],
                    ].map(([tt, m], i) => (
                      <div key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-accent, #5980a6)", width: 88, flex: "none" }}>
                          {tt}
                        </span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.45 }}>
                          {m}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Peer Switch Confirmation Modal */}
      {pendingPeerOpen && stock && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setPendingPeerOpen(null)}
        >
          <div
            style={{
              background: "var(--si-card-solid, #0c1118)",
              border: "1px solid var(--si-border-sec, #2a3a4a)",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
              borderRadius: 8,
              maxWidth: 440,
              width: "100%",
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <StockLogo sym={pendingPeerOpen.ticker} size={40} />
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", letterSpacing: "0.04em" }}>
                  Open {pendingPeerOpen.ticker} in Stock Intelligence?
                </div>
                {pendingPeerOpen.name && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", marginTop: 2 }}>
                    {pendingPeerOpen.name}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.55 }}>
              Switch from <b>{stock.t}</b> to <b>{pendingPeerOpen.ticker}</b> to analyze its 6-month trajectory, factor attribution, fundamentals, catalysts, and valuation in Stock Intelligence.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setPendingPeerOpen(null)}
                style={{
                  padding: "9px 18px",
                  border: "1px solid var(--si-border-sec, #2a3a4a)",
                  background: "transparent",
                  color: "var(--si-text-mid, #93a1af)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: 4,
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const symToOpen = pendingPeerOpen.ticker;
                  setPendingPeerOpen(null);
                  handleSelectStock(symToOpen);
                }}
                style={{
                  padding: "9px 20px",
                  border: "none",
                  background: "var(--si-accent, #5980a6)",
                  color: "#ffffff",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  borderRadius: 4,
                  boxShadow: "0 2px 10px rgba(89, 128, 166, 0.4)",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Open in SI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
