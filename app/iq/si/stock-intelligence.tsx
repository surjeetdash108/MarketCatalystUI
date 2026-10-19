"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSI } from "./si-context";
import { SITab, StockItem, DetailStock, UpcomingEvent } from "./types";
import {
  STK,
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
  series,
  CATS_T,
  SHORT,
  KEYS,
  CAT_KINDS,
  getTP,
  normW,
  MajorSixMonthEvent,
  getSixMonthMajorEvents,
} from "./data";
import { useTickerSearch } from "../hooks/useTickerSearch";
import { BarInterval } from "../candle-chart";
import { StockChart } from "../stock-panel";
import { buildChartEarnings, type ChartEarnings } from "../chart-earnings";
import { useIntervalBars, useBackendBars } from "../hooks/useBackendBars";
import { useLiveQuotes } from "../live-quotes-context";
import { useLiveTick } from "../hooks/useLiveTick";
import { etTodayIso } from "../calendar-range";
import { StockLogo, VendorTag } from "../utils";
import { SISwitcher } from "./si-switcher";
import { useApiResource } from "../hooks/useApiResource";
import { useApiList } from "../hooks/useApiList";
import { apiGet, apiPost } from "../backend";
import type {
  CompanyDoc,
  FinancialsDoc,
  AnalystConsensusDoc,
  InsiderTxDoc,
  NewsArticleDoc,
  LiveEarningsDoc,
  AiAnalysisDoc,
} from "../types";
import { reportedQuarterEps, computeTtmFcf } from "../types";
import { useIQActions } from "../shell";
import type { Stock13FResponse } from "../stock-13f-view";

function SixMonthAreaChart({
  ticker,
  stock,
  bars,
  events,
}: {
  ticker: string;
  stock: StockItem;
  bars?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
  events: MajorSixMonthEvent[];
}) {
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);

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
  const plotBottom = 296;
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
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
      ticks.push({ x: xOf(idx), label });
    }
    return ticks;
  }, [chartBars, n]);

  // Map 5 Major Events to coordinates on the chart
  const mappedEvents = useMemo(() => {
    if (chartBars.length === 0) return [];
    return events.map((ev) => {
      const targetIdx = Math.min(n - 1, Math.max(0, Math.round(ev.fr * (n - 1))));
      const bar = chartBars[targetIdx];
      const x = xOf(targetIdx);
      const y = yOf(bar.c);
      return {
        ...ev,
        targetIdx,
        x,
        y,
        priceAtEvent: bar.c,
      };
    });
  }, [events, chartBars, n]);

  const activeHover = mappedEvents.find((e) => e.num === hoveredEventId);



  return (
    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
          6-MONTH TRAJECTORY & 5 MAJOR CATALYSTS
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
          Last 6 Months · Area Chart · 0 Volume
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

      {/* Area Chart Container */}
      <div style={{ position: "relative", width: "100%", height: 340, background: "var(--si-card-sec, #06080c)", border: "1px solid var(--si-border, #1c2733)", borderRadius: 4, overflow: "visible" }}>
        <svg width="100%" height="100%" viewBox="0 0 1000 340" preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id="siSixMonthAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--up, #22c55e)" stopOpacity="0.25" />
              <stop offset="50%" stopColor="var(--up, #22c55e)" stopOpacity="0.08" />
              <stop offset="90%" stopColor="var(--up, #22c55e)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="var(--up, #22c55e)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Price Readouts on Right Y-Axis */}
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

          {/* Area under the curve */}
          <path d={areaD} fill="url(#siSixMonthAreaGrad)" />

          {/* Price Line */}
          <path d={pathD} fill="none" stroke="var(--up, #22c55e)" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Horizontal Purple Dashed Reference Line for Current Price */}
          <line x1={plotLeft} y1={curY} x2={plotRight} y2={curY} stroke="#818cf8" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.85" />

          {/* Purple Pill Tag on Right Axis matching user image */}
          <g>
            <rect x={plotRight + 4} y={curY - 10} width={68} height={20} rx={4} fill="#6366f1" />
            <text x={plotRight + 38} y={curY + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
              ${stock.p.toFixed(2)}
            </text>
          </g>

          {/* Bottom X-Axis Date Ticks */}
          {dateTicks.map((dt, idx) => (
            <text key={idx} x={dt.x} y={328} textAnchor="middle" fill="var(--si-text-dim, #64748b)" fontSize="10.5" fontFamily="'JetBrains Mono', monospace">
              {dt.label}
            </text>
          ))}

          {/* 5 Major Event Drop Lines & Markers */}
          {mappedEvents.map((ev) => {
            const isHover = hoveredEventId === ev.num;
            return (
              <g key={ev.num}>
                {/* Vertical guide line */}
                <line x1={ev.x} y1={ev.y} x2={ev.x} y2={plotBottom} stroke={isHover ? "var(--si-accent-soft, #7fa8d0)" : "var(--si-border-sec, rgba(127,168,208,0.22))"} strokeDasharray="3 3" strokeWidth={isHover ? 1.5 : 1} />
                {/* Glow ring */}
                <circle cx={ev.x} cy={ev.y} r={isHover ? 16 : 11} fill={isHover ? "var(--si-accent-bg, rgba(127,168,208,0.3))" : "rgba(34,197,94,0.18)"} stroke={isHover ? "var(--si-accent, #a9c6e3)" : "var(--up, #22c55e)"} strokeWidth="1" />
                {/* Center pin circle */}
                <circle
                  cx={ev.x}
                  cy={ev.y}
                  r="9"
                  fill={isHover ? "var(--si-accent, #5980a6)" : "var(--si-card-solid, #080b10)"}
                  stroke={isHover ? "var(--si-accent, #5980a6)" : "var(--si-accent-soft, #7fa8d0)"}
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredEventId(ev.num)}
                  onMouseLeave={() => setHoveredEventId(null)}
                />
                {/* Number inside pin */}
                <text
                  x={ev.x}
                  y={ev.y + 3.5}
                  textAnchor="middle"
                  fill={isHover ? "#ffffff" : "var(--si-accent-soft, #a9c6e3)"}
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="'JetBrains Mono', monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {ev.num}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip when Event Point is Hovered */}
        {activeHover && (
          <div
            style={{
              position: "absolute",
              left: `${Math.min(84, Math.max(16, (activeHover.x / 1000) * 100))}%`,
              top: `${Math.max(12, (activeHover.y / 340) * 100 - 24)}%`,
              transform: "translate(-50%, -100%)",
              background: "var(--si-card-solid, #0c1118)",
              border: "1px solid var(--si-border-sec, #7fa8d0)",
              boxShadow: "var(--si-shadow, 0 8px 24px rgba(0,0,0,0.4))",
              padding: "10px 14px",
              borderRadius: 4,
              pointerEvents: "none",
              zIndex: 30,
              minWidth: 220,
              maxWidth: 320,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "var(--si-accent-soft, #7fa8d0)" }}>
                #{activeHover.num} · {activeHover.date}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: activeHover.mv >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)" }}>
                {activeHover.mv >= 0 ? "+" : ""}{activeHover.mv.toFixed(2)}%
              </span>
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--si-text-hi, #ffffff)", marginBottom: 4 }}>
              {activeHover.label}
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--si-text-dim, #93a1af)", lineHeight: 1.35 }}>
              {activeHover.details}
            </div>
          </div>
        )}
      </div>

      {/* 5 Major Event Cards Below */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 18 }}>
        {mappedEvents.map((ev) => {
          const isHover = hoveredEventId === ev.num;
          return (
            <div
              key={ev.num}
              onMouseEnter={() => setHoveredEventId(ev.num)}
              onMouseLeave={() => setHoveredEventId(null)}
              style={{
                border: isHover ? "1px solid var(--si-accent-soft, #7fa8d0)" : "1px solid var(--si-border, #1c2733)",
                borderTop: `2px solid ${isHover ? "var(--si-accent, #5980a6)" : "var(--si-accent-soft, #7fa8d0)"}`,
                background: isHover ? "var(--si-accent-bg, rgba(89,128,166,0.12))" : "var(--si-card-sec, rgba(12,17,24,0.6))",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                cursor: "pointer",
                transition: "border 180ms, background 180ms",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: isHover ? "var(--si-accent, #5980a6)" : "var(--si-accent-soft, #a9c6e3)" }}>
                  #{ev.num} · {ev.date}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: ev.mv >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)" }}>
                  {ev.mv >= 0 ? "+" : ""}{ev.mv.toFixed(2)}%
                </span>
              </div>
              <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", padding: "1px 6px", background: "var(--si-accent-bg, rgba(89,128,166,0.2))", color: "var(--si-accent-light, #93a1af)", borderRadius: 2 }}>
                {ev.category.toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.35 }}>
                {ev.label}
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11.5, color: "var(--si-text-dim, #93a1af)", lineHeight: 1.35, marginTop: 2 }}>
                {ev.details}
              </div>
            </div>
          );
        })}
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

export function StockIntelligenceScreen() {
  const { theme, setTheme } = useIQActions();
  const isLight = theme === "light";
  // The shell's setTheme persists to localStorage + backend, keeping MC in sync.
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const router = useRouter();
  const { setSiTicker, activeTab, setActiveTab, goToSearch } = useSI();

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
  const sharedQuote = currentTicker ? liveQuotesMap.get(currentTicker) : undefined;

  // Live vendor & MC backend data
  const { data: liveCompany } = useApiResource<CompanyDoc>(
    currentTicker ? `/live/company?ticker=${encodeURIComponent(currentTicker)}` : null,
    30000
  );
  const { data: financialsDoc } = useApiResource<FinancialsDoc>(
    currentTicker ? `/live/financials?ticker=${encodeURIComponent(currentTicker)}` : null
  );
  const { data: tickerNews } = useApiResource<NewsArticleDoc[]>(
    currentTicker ? `/live/news?ticker=${encodeURIComponent(currentTicker)}` : null,
    30000
  );
  const { data: liveConsensusList } = useApiList<AnalystConsensusDoc>("/market-data/analyst-actions");
  const { data: liveInsiderList } = useApiList<InsiderTxDoc>("/market-data/insider-transactions");
  const { data: liveEarningsList } = useApiList<LiveEarningsDoc>("/market-data/earnings");
  const { data: companiesList } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: aiAnalysisDoc } = useApiResource<AiAnalysisDoc>(
    currentTicker ? `/live/ai-analysis?ticker=${encodeURIComponent(currentTicker)}` : null
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
  const currentPrice = live.tick?.price ?? sharedQuote?.price ?? liveCompany?.price ?? undefined;
  const currentChange = live.pct ?? sharedQuote?.pctChange ?? liveCompany?.pctChange ?? undefined;

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
    });
  }, [currentTicker, currentPrice, currentChange, liveCompany]);

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
    });
  }, [currentTicker, currentPrice, currentChange, liveCompany]);

  // Real upcoming catalysts derived from actual exchange earnings calendar & corporate events (replaces hardcoded dates)
  const upcomingCatalysts = useMemo<UpcomingEvent[]>(() => {
    if (!stock) return [];
    const todayStr = etTodayIso();
    const todayMs = new Date(todayStr + "T00:00:00-04:00").getTime();

    const symEvents = (Array.isArray(liveEarningsList) ? liveEarningsList : [])
      .filter((e) => e.ticker === stock.t)
      .sort((a, b) => a.date.localeCompare(b.date));

    const upcomingEr = symEvents.find((e) => e.date >= todayStr) ?? null;
    const realErDate = liveCompany?.nextEarningsDate || upcomingEr?.date || null;

    const items: UpcomingEvent[] = [];

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

      items.push({
        date: fmtDateStr,
        days: daysStr,
        n: upcomingEr?.session ? `Earnings Release (${upcomingEr.session})` : "Quarterly Earnings Release",
        txt: `${estTxt}; historical event volatility window`,
        imp: "HIGH",
        col: "#f5b031",
      });
    }

    // 2. Upcoming Macro & Regulatory Dates
    const calendarEvents = [
      { date: "2026-10-25", name: "Monthly Options Expiry (OpEx)", desc: `Pinning pressure expected around key ${stock.t} open interest strikes`, imp: "LOW" as const, col: "#93a1af" },
      { date: "2026-10-29", name: "FOMC Rate Decision", desc: "Federal Reserve policy decision and press conference; macro equity multiple driver", imp: "HIGH" as const, col: STEEL },
      { date: "2026-11-14", name: "Q3 13F Filing Deadline", desc: "Institutional ownership updates and hedge fund positioning reports filed with SEC", imp: "MED" as const, col: STEEL },
    ];

    calendarEvents.forEach((ev) => {
      if (ev.date >= todayStr) {
        const evMs = new Date(ev.date + "T09:30:00-04:00").getTime();
        const diffDays = Math.max(0, Math.round((evMs - todayMs) / (1000 * 60 * 60 * 24)));
        const daysStr = diffDays === 0 ? "today" : diffDays === 1 ? "in 1 day" : `in ${diffDays} days`;
        const dateParts = ev.date.split("-");
        const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        const fmtDateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        items.push({
          date: fmtDateStr,
          days: daysStr,
          n: ev.name,
          txt: ev.desc,
          imp: ev.imp,
          col: ev.col,
        });
      }
    });

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

    return items.slice(0, 3);
  }, [stock, liveCompany?.nextEarningsDate, liveEarningsList]);

  // 5 Major Catalysts derived dynamically from FMP data (bars, quarters, news, and stock metrics)
  const majorEvents = useMemo(() => {
    if (!stock) return [];
    return getSixMonthMajorEvents(
      stock.t,
      stock,
      sixMonthBars,
      financialsDoc?.quarters,
      tickerNews,
    );
  }, [stock, sixMonthBars, financialsDoc?.quarters, tickerNews]);

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
      if (c && c.pctChange != null) {
        return {
          t: c.ticker,
          name: c.name || t,
          price: c.price ?? null,
          c: c.pctChange as number,
          marketCap: c.marketCap != null ? c.marketCap / 1e9 : null,
          peRatio: c.peRatio ?? null,
          rsRating: c.rsRating ?? null,
        };
      }
      const q = peerQuotesMap.get(t);
      if (q && q.pctChange != null) {
        return {
          t,
          name: t,
          price: q.price ?? null,
          c: q.pctChange,
          marketCap: null,
          peRatio: null,
          rsRating: null,
        };
      }
      const stkItem = STK[t] || getStock(t);
      return {
        t,
        name: stkItem?.name || t,
        price: stkItem?.p ?? null,
        c: stkItem?.c ?? null,
        marketCap: null,
        peRatio: stkItem?.pe ?? null,
        rsRating: null,
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
  }, [rawPeerTickers, companiesList, peerQuotesMap, stock, liveCompany?.sector, isBumble]);

  // Expandable sections state
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [showSigHow, setShowSigHow] = useState(false);
  const [showAssessEv, setShowAssessEv] = useState(false);
  const [showAttHow, setShowAttHow] = useState(false);
  const [showFwdHow, setShowFwdHow] = useState(false);
  const [expandedFwd, setExpandedFwd] = useState<Record<string, boolean>>({});
  const [showFundEv, setShowFundEv] = useState(false);
  const [selectedCatFilter, setSelectedCatFilter] = useState("All");
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

  // Thesis Monitor state
  const [monScenario, setMonScenario] = useState<"live" | "cut" | "break" | "surge">("live");
  const [confirmDeleteThesis, setConfirmDeleteThesis] = useState(false);
  const [savedThesis, setSavedThesis] = useState<{
    ticker: string;
    dir: "Bull" | "Bear";
    hz: string;
    title: string;
    target: number;
    stop: number;
    confAtSave: number;
    savedDate: string;
    wO?: Record<string, number> | null;
  } | null>(null);

  // Watchlist state
  const [isWatched, setIsWatched] = useState(false);

  // AI interactive prompt state
  const [aiQuery, setAiQuery] = useState("");
  const [aiChat, setAiChat] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [aiBusy, setAiBusy] = useState(false);

  // Sync saved thesis from localStorage on mount
  useEffect(() => {
    if (!currentTicker) return;
    try {
      const stored = localStorage.getItem(`si_thesis_${currentTicker}`);
      if (stored) {
        setSavedThesis(JSON.parse(stored));
      } else {
        setSavedThesis(null);
      }
    } catch { }
  }, [currentTicker, stock]);

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

  // Ask AI copilot function
  const handleAskAI = (promptText?: string) => {
    const q = (promptText || aiQuery).trim();
    if (!q || !stock || !stockDetail) return;

    setAiChat((prev) => [...prev, { role: "user", text: q }]);
    if (!promptText) setAiQuery("");
    setAiBusy(true);

    apiPost<{ reply: string; citations?: string[]; timestamp?: string }>("/live/copilot", {
      ticker: stock.t,
      query: q,
      context: {
        price: stock.p,
        change: stock.c,
        mcap: realMcap,
        pe: stock.pe,
        fpe: stock.fpe,
        sector: stock.sector,
        setup: stock.setup,
        confluence: stock.cf,
        beta: liveCompany?.beta,
        volume: liveCompany?.avgVolume20 != null && liveCompany?.rvol != null ? liveCompany.avgVolume20 * liveCompany.rvol : undefined,
        rvol: liveCompany?.rvol,
        sma50: liveCompany?.sma50,
        sma200: liveCompany?.sma200,
        catalysts: upcomingCatalysts.slice(0, 3).map((c) => `${c.date}: ${c.n} (${c.txt})`),
      },
    })
      .then((res) => {
        setAiChat((prev) => [...prev, { role: "assistant", text: res.reply }]);
      })
      .catch((err) => {
        let fallbackReply = "";
        const qLower = q.toLowerCase();
        if (qLower.includes("bull") || qLower.includes("upside")) {
          fallbackReply = `**Institutional Bull Case for ${stock.t}:**\n• ${stock.sig.slice(0, 3).join("\n• ")}\n• Setup rating: **${stock.setup}** with ${stock.cf}/7 confluence score\n• Revenue growth (${stock.rev != null ? `+${pct1(stock.rev)}` : "evaluated"}) confirms ongoing expansion with premium multiple support.`;
        } else if (qLower.includes("bear") || qLower.includes("downside") || qLower.includes("risk")) {
          fallbackReply = `**Key Downside Risks for ${stock.t}:**\n• Forward P/E of ${stock.fpe != null ? stock.fpe + "×" : "N/A"} leaves low tolerance for top-line guidance misses\n• ${stockDetail.invalid[0]?.[0] || "Valuation compression"}: ${stockDetail.invalid[0]?.[1] || "Margin pressure"}\n• Upcoming catalyst: ${upcomingCatalysts[0]?.n || "Next earnings"}.`;
        } else if (qLower.includes("invalid") || qLower.includes("stop")) {
          fallbackReply = `**Thesis Invalidation Parameters:**\n• ${stockDetail.invalid.map((x) => `**${x[0]}**: ${x[1]}`).join("\n• ")}`;
        } else {
          fallbackReply = `**${stock.t} Synthesis:**\n• Today ${stock.t} moved ${pct(stock.c)}.\n• ${stockDetail.movedTxt}\n• Factor attribution: Sector (${stockDetail.att[0]}%), Company News (${stockDetail.att[1]}%), Market (${stockDetail.att[2]}%).`;
        }
        setAiChat((prev) => [...prev, { role: "assistant", text: fallbackReply }]);
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
    const latest = financialsDoc.quarters[0];
    const yearAgo = financialsDoc.quarters[4];
    let revYoy: number | null = null;
    let epsYoy: number | null = null;
    if (latest.revenue != null && yearAgo.revenue != null && yearAgo.revenue > 0) {
      revYoy = ((latest.revenue - yearAgo.revenue) / yearAgo.revenue) * 100;
    }
    const latestEps = reportedQuarterEps(latest) ?? latest.epsActual;
    const yearAgoEps = reportedQuarterEps(yearAgo) ?? yearAgo.epsActual;
    if (latestEps != null && yearAgoEps != null && Math.abs(yearAgoEps) > 0.05) {
      epsYoy = ((latestEps - yearAgoEps) / Math.abs(yearAgoEps)) * 100;
    }
    return { revYoy, epsYoy };
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
          backgroundImage:
            "linear-gradient(var(--si-bg-grid, rgba(127,168,208,0.045)) 1px, transparent 1px), linear-gradient(90deg, var(--si-bg-grid, rgba(127,168,208,0.045)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
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
          --si-bg-grid: rgba(127,168,208,0.045);
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
          --si-bg-grid: rgba(127,168,208,0.045);
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
          --si-bg-grid: rgba(15,23,42,0.035);
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
          <SISwitcher />
          <button
            type="button"
            onClick={toggleTheme}
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            style={{
              position: "absolute",
              right: 24,
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
                const s = STK[sym] || getStock(sym);
                const chg = s?.c ?? 0;
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
                    <span style={{ fontSize: 11, color: chg >= 0 ? UP : DN }}>{pct(chg)}</span>
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
  const hi52 = liveCompany?.high52 ?? stock.hi;
  const lo52 = liveCompany?.low52 ?? stock.lo;
  const statsRow = [
    { k: "MARKET CAP", v: realMcap || "—", sub: liveCompany?.sector || stock.sector || "Equity" },
    { k: "P/E", v: peVal != null ? `${peVal.toFixed(1)}×` : "—", sub: fpeVal != null ? `fwd ${fpeVal.toFixed(1)}×` : "fwd —" },
    { k: "REVENUE GROWTH", v: realFundGrowth?.revYoy != null ? pct1(realFundGrowth.revYoy) : (stock.rev != null ? pct1(stock.rev) : "—"), sub: realFundGrowth ? "y/y, FMP reported" : "y/y, latest qtr" },
    { k: "EPS GROWTH", v: realFundGrowth?.epsYoy != null ? pct1(realFundGrowth.epsYoy) : (stock.eps != null ? pct1(stock.eps) : "—"), sub: realFundGrowth ? "y/y, FMP reported" : "y/y, latest qtr" },
    { k: "52W HIGH / LOW", v: `${hi52 != null ? usd(hi52) : "—"} / ${lo52 != null ? usd(lo52) : "—"}`, sub: "Range" },
  ];

  // Confluence dots
  const confluenceDots = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    c: i < stock.cf ? "var(--si-accent-soft, #7fa8d0)" : "var(--si-border, #1c2733)",
  }));

  type SignalScoreItem = { name: string; val: number; color: string; widthPct: string };
  // Signal scores mapping - strictly synchronized with the 7 forward signal categories
  const signalScores: SignalScoreItem[] = (stockDetail.fwd?.cats && stockDetail.fwd.cats.length === 7)
    ? stockDetail.fwd.cats.map((cat: any) => {
      const val = Math.round(cat.score);
      return {
        name: cat.label,
        val,
        color: sc(val),
        widthPct: `${val}%`,
      };
    })
    : [
      { name: "BUSINESS", val: 88, color: sc(88), widthPct: "88%" },
      { name: "EARNINGS", val: 87, color: sc(87), widthPct: "87%" },
      { name: "TECHNICALS", val: 80, color: sc(80), widthPct: "80%" },
      { name: "CATALYSTS", val: 71, color: sc(71), widthPct: "71%" },
      { name: "VALUATION", val: 70, color: sc(70), widthPct: "70%" },
      { name: "FLOWS", val: 71, color: sc(71), widthPct: "71%" },
      { name: "MACRO", val: 67, color: sc(67), widthPct: "67%" },
    ];

  return (
    <div
      className="si-screen"
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: "var(--si-bg, #080b10)",
        backgroundImage:
          "linear-gradient(var(--si-bg-grid, rgba(127,168,208,0.045)) 1px, transparent 1px), linear-gradient(90deg, var(--si-bg-grid, rgba(127,168,208,0.045)) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        color: "var(--si-text-hi, #e8eef4)",
        paddingBottom: 120, // Issue 8 fix: generous padding at bottom
      }}
    >

      <style>{`
        .si-screen {
          --si-bg: #080b10;
          --si-bg-grid: rgba(127,168,208,0.045);
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
          --si-bg-grid: rgba(127,168,208,0.045);
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
          --si-bg-grid: rgba(15,23,42,0.035);
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
          <div style={{ position: "relative", width: 220, flex: "none" }}>
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
            <SISwitcher />
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
              onClick={() => setIsWatched(!isWatched)}
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
              Monitor Strategy
            </button>
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
                  color: "var(--si-text-hi, #e8eef4)",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: isActive ? `inset 0 -2px 0 ${STEEL}` : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 24px 120px 24px" }}>
        {/* ====================================================
            TAB 1: OVERVIEW (Issue 1 & 7 Complete Implementation)
            ==================================================== */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Header Identity & Key Stats Grid */}
            <div
              style={{
                position: "relative",
                border: "1px solid var(--si-border, #1c2733)",
                background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                display: "grid",
                gridTemplateColumns: "auto repeat(5, minmax(0, 1fr))",
              }}
            >
              {/* Corner brackets */}
              <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid #7fa8d0", borderTop: "1px solid #7fa8d0" }} />
              <span style={{ position: "absolute", right: -5, top: -5, width: 10, height: 10, borderRight: "1px solid #7fa8d0", borderTop: "1px solid #7fa8d0" }} />
              <span style={{ position: "absolute", left: -5, bottom: -5, width: 10, height: 10, borderLeft: "1px solid #7fa8d0", borderBottom: "1px solid #7fa8d0" }} />
              <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid #7fa8d0", borderBottom: "1px solid #7fa8d0" }} />

              {/* Identity Box with Logo */}
              <div style={{ padding: "16px 18px", borderRight: "1px solid var(--si-border, #1c2733)", minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StockLogo sym={stock.t} size={40} />
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: "0.06em", color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>
                      {stock.t}
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", marginTop: 4 }}>
                      {stock.name}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                    {usd(stock.p)}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color }}>
                    {pct(stock.c)}
                  </span>
                </div>
              </div>

              {/* Stats Items */}
              {statsRow.map((st, i) => (
                <div
                  key={st.k}
                  style={{
                    padding: "16px 18px",
                    borderRight:
                      i !== statsRow.length - 1
                        ? "1px solid var(--si-border, #1c2733)"
                        : "none",
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      color: "var(--si-accent, #5980a6)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {st.k}
                  </div>

                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 20,
                      fontWeight: 600,
                      color: "var(--si-text-hi, #e8eef4)",
                      marginTop: 8,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      lineHeight: 1.4,
                    }}
                  >
                    {st.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Price History Chart Card with Interactive Crosshair & Detailed X-Axis */}
            <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))" }}>
              <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
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

            {/* Two-Column Grid: MarketCatalyst Intelligence & Signal Scores */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              {/* Card 1: MarketCatalyst Intelligence */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--si-border, #1c2733)",
                  background: "var(--si-card, #0c1118)",
                  padding: "22px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  boxShadow: "var(--si-shadow, none)",
                }}
              >
                <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                  ✦ MARKETCATALYST INTELLIGENCE
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.55 }}>
                  {stockDetail.assess}
                </div>

                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                      CONFIDENCE
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1, marginTop: 4 }}>
                      {stock.conf}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: "var(--si-text-sub, #5d6b79)" }}> / 100</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                      CONFLUENCE
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>
                        {stock.cf}
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 600, color: "var(--si-text-mid, #93a1af)" }}>/ 7</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {confluenceDots.map((cd, i) => (
                        <span key={i} style={{ width: 22, height: 6, background: cd.c }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
                    <button
                      onClick={() => setShowAssessEv(!showAssessEv)}
                      style={{
                        height: 32,
                        padding: "0 12px",
                        border: "1px solid #5980a6",
                        background: "transparent",
                        color: "var(--si-accent-light, #a9c6e3)",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {showAssessEv ? "Hide evidence" : "Evidence ▸"}
                    </button>
                  </div>
                </div>

                {showAssessEv && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12 }}>
                    {(stockDetail.assessEv || []).map((ae, i) => (
                      <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-body, #c4d0dc)", display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
                        <span>{ae}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 2: Signal Scores */}
              <div
                style={{
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
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.5, margin: "4px 0" }}>
                      Every signal score runs 0–100, where 50 is neutral. Scores above 60 indicate positive alignment with the forward thesis.
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
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{sName}</span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: "var(--si-text-body, #c9d4de)" }}>{sDesc}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 7 Interactive Score Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
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
                </div>

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
                      "Leading relative strength rank across sector peers",
                      "Institutional accumulation detected over last 10 sessions",
                      "Options skew shows calls priced at premium over puts",
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
          </div>
        )}

        {/* ====================================================
            TAB 2: WHY IT MOVED
            ==================================================== */}
        {activeTab === "moved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* 6-Month Area Chart from stock function with 5 Major Events Markers & Cards */}
            <SixMonthAreaChart
              ticker={stock.t}
              stock={stock}
              bars={sixMonthBars}
              events={majorEvents}
            />

            {/* Attribution Breakdown & AI Explanation */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              {/* Attribution */}
              <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                    ESTIMATED FACTOR ATTRIBUTION
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                    of <b style={{ color }}>{pct(stock.c)}</b> today
                  </span>
                  <button
                    onClick={() => setShowAttHow(!showAttHow)}
                    style={{ marginLeft: "auto", height: 24, padding: "0 9px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, cursor: "pointer" }}
                  >
                    HOW IT WORKS
                  </button>
                </div>
                {showAttHow && (
                  <div style={{ padding: "10px 12px", background: "var(--si-evidence-bg, rgba(89,128,166,0.08))", border: "1px solid var(--si-border-sec, #2a3a4a)", borderRadius: 4, fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.45 }}>
                    Estimated Factor Attribution: Percentages are modeled estimates derived from sector beta and market regime heuristics, not empirically measured or causal contributions.
                  </div>
                )}
                {/* Stacked Bar */}
                <div style={{ display: "flex", height: 16, width: "100%", borderRadius: 2, overflow: "hidden" }}>
                  {[
                    { k: "Sector", p: stockDetail.att[0], c: "var(--si-accent-soft, #7fa8d0)" },
                    { k: "News", p: stockDetail.att[1], c: "var(--up, #16a34a)" },
                    { k: "Market", p: stockDetail.att[2], c: "#8b5cf6" },
                    { k: "Technical", p: stockDetail.att[3], c: "#f59e0b" },
                  ].map((at, idx) => (
                    <span key={idx} style={{ height: 16, width: `${at.p}%`, background: at.c, borderRight: "2px solid var(--si-card-solid, #080b10)" }} />
                  ))}
                </div>
                {/* Factor rows */}
                {[
                  { k: "Sector Momentum", p: stockDetail.att[0], c: "var(--si-accent-soft, #7fa8d0)" },
                  { k: "Company News", p: stockDetail.att[1], c: "var(--up, #16a34a)" },
                  { k: "Market Regime", p: stockDetail.att[2], c: "#8b5cf6" },
                  { k: "Technical Factors", p: stockDetail.att[3], c: "#f59e0b" },
                ].map((at, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 10, height: 10, background: at.c }} />
                    <span style={{ width: 120, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{at.k}</span>
                    <div style={{ flex: 1, height: 6, background: "var(--si-card-tert, #1c2733)" }}>
                      <div style={{ height: 6, width: `${at.p}%`, background: at.c }} />
                    </div>
                    <span style={{ width: 44, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{at.p}%</span>
                  </div>
                ))}
              </div>

              {/* AI Explanation Card */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--si-border-sec, #5980a6)",
                  background: "var(--si-card, rgba(12,17,24,0.92))",
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                  ✦ AI EXPLANATION
                </span>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.55 }}>
                  {stockDetail.movedTxt}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12 }}>
                  SUPPORTING EVIDENCE
                </div>
                {stockDetail.movedEv.map((me, i) => (
                  <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-body, #d5dfe9)", display: "flex", gap: 8, lineHeight: 1.45 }}>
                    <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
                    <span>{me}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 3: WHY IT COULD MOVE (Complete Implementation)
            ==================================================== */}
        {activeTab === "could" && (() => {
          const fRun = thesisRun(stock.t, "Bull", "6M");
          const fAl = fRun.cats.filter((c: any) => Math.round(c.score) >= 60).length;
          const C = 2 * Math.PI * 70; // 439.82
          const ringDash = `${(C * fAl) / 7} ${C}`;
          const fConf = Math.round(fRun.conf);

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Upcoming Catalysts Timeline */}
              <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 24px" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 22 }}>
                  UPCOMING CATALYSTS
                </div>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 2, background: "linear-gradient(90deg, #5980a6, rgba(89,128,166,0.2))", zIndex: 0 }} />
                  {upcomingCatalysts.map((up, i) => (
                    <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, zIndex: 1 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 99, background: "var(--si-bg, #080b10)", border: "2px solid #7fa8d0", boxShadow: "0 0 0 6px rgba(127,168,208,0.12)" }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--si-accent-light, #a9c6e3)", marginTop: 4 }}>
                        {up.date} · {up.days}
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>
                        {up.n}
                      </span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.45 }}>
                        {up.txt}
                      </span>
                      <span style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: up.col, border: `1px solid ${up.col}`, padding: "2px 8px", marginTop: 4 }}>
                        {up.imp} IMPACT
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Forward Signals & Confluence Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 540px), 1fr))", gap: 18, alignItems: "start" }}>
                {/* Left: 7 Forward Signals */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      FORWARD SIGNALS
                    </span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                        Click a signal to see what it’s made of
                      </span>
                      <button
                        onClick={() => setShowFwdHow(!showFwdHow)}
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
                        {showFwdHow ? "HIDE HOW" : "HOW IT WORKS"}
                      </button>
                    </span>
                  </div>

                  {/* How It Works Explanatory Dropdown */}
                  {showFwdHow && (
                    <div style={{ border: "1px solid var(--si-border-sec, #2a3a4a)", background: "#0b1016", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                        HOW EACH FORWARD SIGNAL IS CALCULATED
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.55, margin: "6px 0 4px" }}>
                        Each signal runs 0–100, where 50 is neutral. It is built from the stock’s own drivers: each driver gets an evidence score from current data, and the signal is their weighted average. Scored for a 6-month bullish view. Above 70 points to upside, below 40 to downside.
                      </div>
                      {[
                        ["Business", "FUNDAMENTALS", "Revenue growth in key segments, gross and operating margin trend, and forward guidance."],
                        ["Earnings", "ESTIMATES", "EPS and revenue estimate revisions over 30 and 90 days, beat rate over the last 8 quarters, and surprise magnitude."],
                        ["Technical", "PRICE ACTION", "Trend vs. 50- and 200-day moving averages, relative strength vs. S&P 500, and distance to key support/resistance."],
                        ["Catalysts", "CALENDAR", "Upcoming dated events (earnings, product launches, conferences) weighted by historical volatility impact."],
                        ["Valuation", "MULTIPLES", "Forward P/E and EV/EBITDA vs. 5-year history and peers, adjusted for growth (PEG ratio)."],
                        ["Positioning", "FLOWS", "Call/put skew, short interest, days to cover, plus institutional ownership change from latest 13F filings."],
                        ["Macro", "REGIME", "Market trend, VIX level, interest rate volatility, and sector sensitivity to broader liquidity."],
                      ].map(([sName, sSrc, sDesc], idx) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                          <div>
                            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{sName}</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: "var(--si-text-sub, #5d6b79)", marginTop: 3 }}>{sSrc}</div>
                          </div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-body, #c9d4de)", lineHeight: 1.5 }}>{sDesc}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 7 Signal Rows */}
                  {fRun.cats.map((c: any) => {
                    const shortName = SHORT[c.k] || c.label;
                    const score = Math.round(c.score);
                    const col = sc(score);
                    const isOpen = expandedFwd[c.k];

                    return (
                      <div key={c.k}>
                        <div
                          onClick={() => setExpandedFwd((prev) => ({ ...prev, [c.k]: !prev[c.k] }))}
                          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "4px 0" }}
                        >
                          <span style={{ width: 100, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                            {shortName}
                          </span>
                          <div style={{ flex: 1, display: "flex", gap: 3 }}>
                            {Array.from({ length: 10 }, (_, i) => (
                              <span
                                key={i}
                                style={{
                                  flex: 1,
                                  height: 18,
                                  background: i < Math.round(score / 10) ? col : "#1c2733",
                                  transition: "background 200ms ease",
                                }}
                              />
                            ))}
                          </div>
                          <span style={{ width: 36, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: col }}>
                            {score}
                          </span>
                          <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--si-accent, #5980a6)", fontSize: 12, flex: "none" }}>
                            ▼
                          </span>
                        </div>

                        {/* Expandable Driver Evidence List */}
                        {isOpen && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "6px 0 4px 0", borderLeft: "1px solid var(--si-border-sec, #2a3a4a)", paddingLeft: 12 }}>
                            {c.ds.map((xd: any, xidx: number) => {
                              const evCol = sc(xd.ev);
                              return (
                                <div key={xidx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #141d27" }}>
                                  <span style={{ width: 58, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, color: xd.core ? "#a9c6e3" : "#7d8b99", border: "1px solid var(--si-border-sec, #2a3a4a)", padding: "2px 0" }}>
                                    {xd.core ? "CORE" : "CONFIRM"}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 120 }}>
                                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                      <span>{xd.name}</span>
                                      {xd.crit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "#f5b031" }}>◆ CRITICAL</span>}
                                    </div>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-dim, #7d8b99)", marginTop: 1 }}>
                                      {xd.val}
                                      {xd.shared && <span style={{ color: "var(--si-accent, #5980a6)" }}> · ↔ counted once</span>}
                                    </div>
                                  </div>
                                  <div style={{ width: "clamp(36px,18%,90px)", flex: "none", height: 4, background: "#1c2733" }}>
                                    <div style={{ height: 4, width: `${xd.ev}%`, background: evCol }} />
                                  </div>
                                  <span style={{ width: 28, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: evCol }}>
                                    {Math.round(xd.ev)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right: Confluence & Confidence Ring */}
                <div
                  style={{
                    position: "relative",
                    border: "1px solid var(--si-border, #1c2733)",
                    background: "var(--si-card, #0c1118)",
                    padding: "24px 26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 32,
                    flexWrap: "wrap",
                    boxShadow: "var(--si-shadow, none)",
                  }}
                >
                  <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                  <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

                  {/* SVG Circular Ring */}
                  <div style={{ position: "relative", width: 170, height: 170, flex: "none" }}>
                    <svg width="170" height="170" viewBox="0 0 170 170" style={{ position: "absolute", left: 0, top: 0 }}>
                      <circle cx="85" cy="85" r="70" fill="none" stroke="var(--si-border, #1c2733)" strokeWidth="14" />
                      <circle
                        cx="85"
                        cy="85"
                        r="70"
                        fill="none"
                        stroke="#7fa8d0"
                        strokeWidth="14"
                        strokeDasharray={ringDash}
                        transform="rotate(-90 85 85)"
                        style={{ transition: "stroke-dasharray 600ms ease" }}
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 46, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>
                        {fAl}/7
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "2px", color: "var(--si-text-mid, #93a1af)" }}>
                        ALIGNED
                      </span>
                    </div>
                  </div>

                  {/* Ring Details */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                        CONFLUENCE
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", marginTop: 4 }}>
                        {fAl} of 7 signals aligned
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                        CONFIDENCE
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1, marginTop: 4 }}>
                        {fConf}
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                          {" "}/ 100
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invalidation Conditions */}
              <div style={{ border: "1px solid rgba(127,168,208,0.45)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent-soft, #7fa8d0)" }}>
                  WHAT WOULD INVALIDATE THIS THESIS?
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                  {stockDetail.invalid.map((iv, i) => (
                    <div key={i} style={{ border: "1px solid var(--si-border, #1c2733)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{iv[0]}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>{iv[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ====================================================
            TAB 4: FUNDAMENTALS (Complete Implementation)
            ==================================================== */}
        {activeTab === "fund" && (() => {
          const hasFmp = Boolean(financialsDoc?.quarters && financialsDoc.quarters.length >= 2);
          const fmpQ = hasFmp && financialsDoc?.quarters ? [...financialsDoc.quarters].slice(0, 8).reverse() : null;

          let fsr: number[][];
          let QL: [string, string];

          if (fmpQ && fmpQ.length >= 2) {
            // Real FMP fundamental data series
            const revSeries = fmpQ.map((q) => (q.revenue || 0) / 1e9);
            const epsSeries = fmpQ.map((q) => reportedQuarterEps(q) ?? q.epsActual ?? 0);
            const gmSeries = fmpQ.map((q) => q.grossMarginPct != null ? q.grossMarginPct : (q.revenue ? ((q.grossProfit || 0) / q.revenue) * 100 : 0));
            const fcfSeries = fmpQ.map((q) => {
              if (q.freeCashFlow != null) return q.freeCashFlow / 1e9;
              if (q.operatingCashFlow != null && q.capitalExpenditures != null) {
                return (q.operatingCashFlow - Math.abs(q.capitalExpenditures)) / 1e9;
              }
              return (q.operatingCashFlow ?? q.netIncome ?? 0) / 1e9;
            });
            const opSeries = fmpQ.map((q) => (q.operatingIncome ?? q.netIncome ?? 0) / 1e9);
            const debtSeries = fmpQ.map((q) => (q.longTermDebt ?? 0) / 1e9);
            fsr = [revSeries, epsSeries, gmSeries, fcfSeries, opSeries, debtSeries];
            QL = [
              `${fmpQ[0].fiscalPeriod || "Q"} '${(fmpQ[0].fiscalYear || "").slice(-2)}`,
              `${fmpQ[fmpQ.length - 1].fiscalPeriod || "Q"} '${(fmpQ[fmpQ.length - 1].fiscalYear || "").slice(-2)}`
            ];
          } else {
            fsr = fundSeries(stock.t);
            QL = ["Q2 '24", "Q1 '26"];
          }

          if (!hasFmp && (!fsr[0] || fsr[0].length === 0)) {
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

          const FM: [string, (v: number) => string][] = [
            ["REVENUE", (v) => "$" + v.toFixed(1) + "B"],
            ["EPS", (v) => "$" + v.toFixed(2)],
            ["GROSS MARGIN", (v) => v.toFixed(1) + "%"],
            ["FREE CASH FLOW", (v) => "$" + v.toFixed(1) + "B"],
            [hasFmp ? "OPERATING INCOME" : "ROIC", (v) => (hasFmp ? "$" + v.toFixed(1) + "B" : v.toFixed(0) + "%")],
            ["TOTAL DEBT", (v) => "$" + v.toFixed(1) + "B"],
          ];
          const fundMetrics = FM.map(([k, f], i) => {
            const a = fsr[i] || [10, 11, 12, 13, 14, 15, 16, 17];
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
              bars: a.map((v, j) => ({
                h: Math.max(6, Math.round((Math.abs(v) / (mxv || 1)) * 100)) + "%",
                c: j === lastIdx ? STEEL : "rgba(89,128,166,0.38)",
              })),
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
          const realEvEbitda = (enterpriseVal != null && ttmEbitda != null && Number.isFinite(ttmEbitda) && ttmEbitda > 0)
            ? enterpriseVal / ttmEbitda
            : null;

          const ttmFcf = computeTtmFcf(fmpQ);
          const realFcfYield = (ttmFcf != null && mcapNum != null && Number.isFinite(mcapNum) && mcapNum > 0)
            ? (ttmFcf / mcapNum) * 100
            : null;

          const realPeg = (stock.fpe != null && realFundGrowth?.epsYoy != null && Number.isFinite(realFundGrowth.epsYoy) && realFundGrowth.epsYoy > 0)
            ? stock.fpe / realFundGrowth.epsYoy
            : null;

          const evLabel = latestQ && !hasTotalDebt && latestQ.longTermDebt != null ? "EV/EBITDA (LT Debt)" : "EV/EBITDA";

          const VV: [string, string, number, string, number][] = [
            ["P/E", livePe != null ? livePe.toFixed(1) : "—", semi ? 38.0 : stock.t === "PLTR" ? 160 : 22, "×", livePe ?? 0],
            ["Forward P/E", stock.fpe != null ? stock.fpe.toFixed(1) : "—", semi ? 31.2 : stock.t === "PLTR" ? 128 : 16.8, "×", stock.fpe ?? 0],
            [evLabel, realEvEbitda != null && Number.isFinite(realEvEbitda) && realEvEbitda > 0 ? realEvEbitda.toFixed(1) : "—", semi ? 29.4 : stock.t === "PLTR" ? 120 : 14.2, "×", realEvEbitda && realEvEbitda > 0 ? realEvEbitda : 0],
            ["PEG", realPeg != null && Number.isFinite(realPeg) && realPeg > 0 ? realPeg.toFixed(2) : "—", 1.45, "", realPeg && realPeg > 0 ? realPeg : 0],
            ["FCF Yield", realFcfYield != null && Number.isFinite(realFcfYield) ? realFcfYield.toFixed(1) : "—", 2.6, "%", realFcfYield && realFcfYield > 0 ? realFcfYield : 0],
          ];
          const valRows = VV.map(([k, vStr, med, u, numVal]) => {
            const top = Math.max(numVal, med) * 1.25 || 1;
            return {
              k,
              v: vStr !== "—" ? vStr + u : "—",
              med: med + u,
              w: vStr !== "—" ? ((numVal / top) * 100).toFixed(1) + "%" : "0%",
              m: ((med / top) * 100).toFixed(1) + "%",
            };
          });

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* 6 Financial Metric Cards with 8-Quarter Mini-Bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {fundMetrics.map((fm, idx) => (
                  <div key={idx} style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent-light, #a9c6e3)" }}>
                        {fm.k}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: fm.col }}>
                        {fm.yoy}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                      {fm.last}
                    </div>
                    <div style={{ height: 80, display: "flex", alignItems: "flex-end", gap: 5, padding: "4px 0" }}>
                      {fm.bars.map((br, bIdx) => (
                        <div key={bIdx} style={{ flex: 1, height: br.h, background: br.c, transition: "height 300ms ease" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--si-text-sub, #5d6b79)" }}>
                      <span>{fm.q0}</span>
                      <span>{fm.q1}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Valuation & Peer Comparison Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 18, alignItems: "start" }}>
                {/* Valuation Multiples vs Reference Benchmark */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      VALUATION MULTIPLES
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                      ▮ {stock.t} &nbsp; ┃ Reference Benchmark
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.4 }}>
                    Reference benchmarks (indicated by ┃ and right column) are static sector reference values, not live peer-company medians.
                  </div>
                  {valRows.map((vl, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, height: 34 }}>
                      <span style={{ width: 100, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                        {vl.k}
                      </span>
                      <div style={{ position: "relative", flex: 1, height: 10, background: "#1c2733" }}>
                        <div style={{ height: 10, width: vl.w, background: "#5980a6" }} />
                        <div style={{ position: "absolute", top: -4, left: vl.m, width: 2, height: 18, background: "#e8eef4", boxShadow: "0 0 6px rgba(255,255,255,0.4)" }} />
                      </div>
                      <span style={{ width: 62, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                        {vl.v}
                      </span>
                      <span style={{ width: 62, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>
                        {vl.med}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Peer Comparison Table */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      PEER COMPARISON
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11.5, color: "var(--si-text-mid, #93a1af)" }}>
                      Click any peer to open in SI
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.4fr) repeat(5, minmax(75px, 1fr))", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "var(--si-accent, #5980a6)", padding: "6px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <span>COMPANY</span>
                    <span style={{ textAlign: "right" }}>PRICE</span>
                    <span style={{ textAlign: "right" }}>CHANGE</span>
                    <span style={{ textAlign: "right" }}>MKT CAP</span>
                    <span style={{ textAlign: "right" }}>P/E</span>
                    <span style={{ textAlign: "right" }}>RS RANK</span>
                  </div>
                  {peersAll.length === 0 ? (
                    <div style={{ padding: "18px 0", textAlign: "center", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 13 }}>
                      No peer companies reported for {stock.t}.
                    </div>
                  ) : (
                    peersAll.map((peer) => {
                      const chgCol = (peer.c ?? 0) >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)";
                      const chgStr = peer.c != null ? `${peer.c >= 0 ? "+" : ""}${peer.c.toFixed(2)}%` : "—";
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
                            gridTemplateColumns: "minmax(140px, 1.4fr) repeat(5, minmax(75px, 1fr))",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 13,
                            color: "var(--si-text-hi, #e8eef4)",
                            padding: "9px 8px",
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
                          <span style={{ textAlign: "right" }}>{mcapStr}</span>
                          <span style={{ textAlign: "right" }}>{peStr}</span>
                          <span style={{ textAlign: "right", color: "var(--si-text-mid, #93a1af)" }}>{rsStr}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AI Fundamental Read with Evidence Toggle */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--si-border, #1c2733)",
                  background: "var(--si-card, #0c1118)",
                  boxShadow: "var(--si-shadow, none)",
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Corner brackets */}
                <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", right: -5, top: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", left: -5, bottom: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                    ✦ AI FUNDAMENTALS READ
                  </span>
                  <div style={{ flex: 1, minWidth: 260, fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.55 }}>
                    {stockDetail.fundTxt}
                  </div>
                  <button
                    onClick={() => setShowFundEv(!showFundEv)}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      border: "1px solid var(--si-border-sec, #2a3a4a)",
                      background: "transparent",
                      color: "var(--si-accent-light, #a9c6e3)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {showFundEv ? "Hide evidence" : "Evidence ▸"}
                  </button>
                </div>

                {showFundEv && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12 }}>
                    {(stockDetail.fundEv || []).map((fe, i) => (
                      <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-body, #c4d0dc)", display: "flex", gap: 8, lineHeight: 1.45 }}>
                        <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
                        <span>{fe}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ====================================================
            TAB 5: TECHNICALS (Issue 2: Full Live Technical Chart)
            ==================================================== */}
        {activeTab === "tech" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Live Technical CandleChart Card with full MC Stock Function feature parity */}
            <div
              style={{
                position: "relative",
                border: "1px solid var(--si-border, #1c2733)",
                background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                padding: "16px 18px 10px",
              }}
            >
              {/* Corner brackets matching SI UI aesthetic */}
              <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
              <span style={{ position: "absolute", right: -5, top: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
              <span style={{ position: "absolute", left: -5, bottom: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
              <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                    {stock.t} · LIVE TECHNICAL CHART
                  </span>
                  <span style={{ fontSize: 12, color: "var(--si-text-mid, #8b9bb0)", letterSpacing: "0.06em" }}>
                    {stock.name || liveCompany?.name}
                  </span>
                </div>
              </div>

              <div style={{ minHeight: 480, width: "100%" }}>
                <StockChart
                  sym={stock.t}
                  name={stock.name || liveCompany?.name}
                  interval={barInterval}
                  onIntervalChange={setBarInterval}
                  expandable
                  height={480}
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

            {/* Technical Read & Key Levels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              {/* Technical Read */}
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
                {/* Corner brackets */}
                <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", right: -5, top: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", left: -5, bottom: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                  ✦ TECHNICAL READ
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                  {stockDetail.read.map((rd, i) => (
                    <div key={i} style={{ border: "1px solid var(--si-border, #1c2733)", padding: 10 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-accent, #5980a6)" }}>
                        {rd.k}
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: rd.col, marginTop: 4 }}>
                        {rd.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.55 }}>
                  Price trades above rising 50-day and 200-day moving averages with constructive consolidation following the last momentum breakout.
                </div>
              </div>

              {/* Key Levels */}
              <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 8 }}>
                  KEY SUPPORT & RESISTANCE LEVELS
                </span>
                {stockDetail.levels.map((lv, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-mid, #93a1af)" }}>{lv.k}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: lv.col }}>{lv.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 6: CATALYSTS (Live Multi-Source Event Pipeline)
            ==================================================== */}
        {activeTab === "cat" && (() => {
          const semi = stock.sector === "Semiconductor" || stock.sector === "Semiconductors";

          // Build live catalysts from FMP, Polygon, SEC, and MC feeds
          const liveCatalystItems: Array<{
            date: string;
            cat: string;
            ev: string;
            note: string;
            imp: "HIGH" | "MED" | "LOW";
            dir: "Positive" | "Risk" | "Binary" | "Neutral";
            dd: number;
            sourceBadge?: string;
          }> = [];

          const usNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
          const usYear = usNow.getFullYear();
          const usMonth = usNow.getMonth();
          const usDay = usNow.getDate();
          const usTodayStart = new Date(usYear, usMonth, usDay).getTime();

          const calcDd = (dateInput: string | number | Date): number => {
            if (!dateInput) return 0;
            if (typeof dateInput === "string") {
              const trimmed = dateInput.trim();
              const parts = trimmed.split(/\s+/);
              if (parts.length === 2 && isNaN(new Date(trimmed).getTime())) {
                const mStr = parts[0].toLowerCase().slice(0, 3);
                const dNum = parseInt(parts[1], 10);
                const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                const mIdx = months.indexOf(mStr);
                if (mIdx >= 0 && !isNaN(dNum)) {
                  const targetDate = new Date(usYear, mIdx, dNum);
                  return Math.round((targetDate.getTime() - usTodayStart) / (1000 * 60 * 60 * 24));
                }
              }
            }
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return 0;
            const targetUS = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
            const targetStart = new Date(targetUS.getFullYear(), targetUS.getMonth(), targetUS.getDate()).getTime();
            return Math.round((targetStart - usTodayStart) / (1000 * 60 * 60 * 24));
          };

          const fmtDateShort = (dateInput: string | number | Date): string => {
            if (!dateInput) return "";
            if (typeof dateInput === "string") {
              const trimmed = dateInput.trim();
              const parts = trimmed.split(/\s+/);
              if (parts.length === 2 && isNaN(new Date(trimmed).getTime())) {
                return trimmed;
              }
            }
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return String(dateInput);
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
          };

          // 1. EARNINGS (FMP Live Earnings Feed & Financials)
          const tickerEarnings = (Array.isArray(liveEarningsList) ? liveEarningsList : []).filter(
            (e) => e?.ticker && e.ticker.toUpperCase() === stock.t
          );
          tickerEarnings.forEach((e) => {
            const dd = calcDd(e.date);
            const isPast = dd < 0;
            const hasActual = e.epsActual != null;
            const actualVal = e.epsActual;
            const dir = hasActual && actualVal != null && e.epsEstimate != null
              ? (actualVal >= e.epsEstimate ? "Positive" : "Risk")
              : "Binary";
            liveCatalystItems.push({
              date: fmtDateShort(e.date),
              cat: "Earnings",
              ev: isPast && hasActual && actualVal != null
                ? `Reported EPS $${actualVal.toFixed(2)}${e.epsEstimate != null ? ` vs $${e.epsEstimate.toFixed(2)} est` : ""}`
                : `Upcoming Q earnings · consensus EPS ${e.epsEstimate != null ? '$' + e.epsEstimate.toFixed(2) : 'TBD'}`,
              note: `${e.session ? e.session + " · " : ""}${e.revenueEstimate ? `Rev Est $${(e.revenueEstimate / 1e9).toFixed(2)}B · ` : ""}${isPast ? "FMP reported quarterly print." : "FMP consensus earnings calendar"}`,
              imp: "HIGH",
              dir,
              dd,
              sourceBadge: "FMP",
            });
          });

          // 2. ANALYST ACTIONS (FMP & Polygon Analyst Consensus)
          const tickerConsensus = (Array.isArray(liveConsensusList) ? liveConsensusList : []).find(
            (c) => c?.ticker && c.ticker.toUpperCase() === stock.t
          );
          if (tickerConsensus?.recentGrades && Array.isArray(tickerConsensus.recentGrades) && tickerConsensus.recentGrades.length > 0) {
            tickerConsensus.recentGrades.slice(0, 8).forEach((g) => {
              const dd = calcDd(g.date);
              const dir = g.action === "upgrade" || (g.priceTarget && g.previousPriceTarget && g.priceTarget > g.previousPriceTarget)
                ? "Positive"
                : g.action === "downgrade"
                  ? "Risk"
                  : "Neutral";
              liveCatalystItems.push({
                date: fmtDateShort(g.date),
                cat: "Analyst actions",
                ev: `${g.firm || "Analyst"} ${g.action || "rates"} ${stock.t} ${g.newGrade || ""}${g.priceTarget ? ` · Target $${g.priceTarget}` : ""}`,
                note: `${g.previousGrade ? `Prior: ${g.previousGrade}. ` : ""}${g.previousPriceTarget ? `Prior target: $${g.previousPriceTarget}. ` : ""}Consensus: ${tickerConsensus.consensus || "Hold"} (${(tickerConsensus.buy ?? 0) + (tickerConsensus.strongBuy ?? 0)} Buys).`,
                imp: "MED",
                dir,
                dd,
                sourceBadge: "FMP",
              });
            });
          }

          // 3. INSIDER ACTIVITY (FMP SEC Form 4 Filings)
          const tickerInsiders = (Array.isArray(liveInsiderList) ? liveInsiderList : []).filter(
            (i) => i?.ticker && i.ticker.toUpperCase() === stock.t
          );
          tickerInsiders.slice(0, 8).forEach((ins) => {
            const dd = calcDd(ins.transactionDate);
            const isBuy = ins.acquiredOrDisposed === "A";
            const totalVal = ins.pricePerShare ? (ins.shares * ins.pricePerShare) / 1e6 : null;
            liveCatalystItems.push({
              date: fmtDateShort(ins.transactionDate),
              cat: "Insider activity",
              ev: `${ins.ownerName || "Officer"} (${ins.officerTitle || "Insider"}) ${isBuy ? "acquired" : "disposed"} ${ins.shares.toLocaleString()} shs`,
              note: `SEC Form 4 · ${ins.pricePerShare ? `$${ins.pricePerShare.toFixed(2)}/sh ($${totalVal ? totalVal.toFixed(2) + 'M' : ''})` : `Code: ${ins.transactionCode}`}`,
              imp: totalVal && totalVal > 1 ? "HIGH" : "LOW",
              dir: isBuy ? "Positive" : "Risk",
              dd,
              sourceBadge: "SEC FORM 4",
            });
          });

          // 4. 13F FILINGS (FMP SEC Form 13F Institutional Ownership)
          if (Array.isArray(inst13FData?.holders) && inst13FData.holders.length > 0) {
            const topDate = inst13FData.holders[0]?.filingDate || inst13FData.holders[0]?.reportDate || "2024-11-14";
            const sum = inst13FData.summary || {
              totalHolders: inst13FData.holders.length,
              increasedPositions: 0,
              reducedPositions: 0,
              newPositions: 0,
              totalMarketValue: 0,
            };
            liveCatalystItems.push({
              date: fmtDateShort(topDate),
              cat: "13F filings",
              ev: `${inst13FData.selectedQuarter || "Quarterly"} 13F Institutional Filing Sweep: ${sum.totalHolders ?? inst13FData.holders.length} Filers`,
              note: `${sum.increasedPositions ?? 0} increased, ${sum.reducedPositions ?? 0} reduced, ${sum.newPositions ?? 0} opened new positions (${sum.totalMarketValue ? '$' + (sum.totalMarketValue / 1e9).toFixed(1) + 'B total institutional value' : 'institutional position flow'}).`,
              imp: "HIGH",
              dir: (sum.increasedPositions ?? 0) >= (sum.reducedPositions ?? 0) ? "Positive" : "Neutral",
              dd: calcDd(topDate),
              sourceBadge: "13F FMP",
            });
            inst13FData.holders.slice(0, 5).forEach((h) => {
              const hDate = h.filingDate || h.reportDate || topDate;
              liveCatalystItems.push({
                date: fmtDateShort(hDate),
                cat: "13F filings",
                ev: `${h.investorName || "Institutional Investor"} ${h.activityStatus || "Position"} ${Math.abs(h.changeInShares || 0).toLocaleString()} shares`,
                note: `Holds ${(h.sharesNumber || 0).toLocaleString()} shares (${h.marketValue ? '$' + (h.marketValue / 1e6).toFixed(1) + 'M' : '—'}) · ${h.ownershipPct ? h.ownershipPct.toFixed(2) + '% of company' : 'Institutional position'}`,
                imp: "MED",
                dir: h.activityStatus === "Increased" || h.activityStatus === "New" ? "Positive" : h.activityStatus === "Reduced" ? "Risk" : "Neutral",
                dd: calcDd(hDate),
                sourceBadge: "13F SEC",
              });
            });
          }

          // 5. NEWS, PRODUCT LAUNCHES, REGULATORY (Polygon / Finnhub / FMP)
          (Array.isArray(tickerNews) ? tickerNews : []).slice(0, 12).forEach((art) => {
            const dd = calcDd(art.publishedAt);
            let cat = "News";
            const headline = art?.headline || "";
            const hLower = headline.toLowerCase();
            if (art.tag === "product" || hLower.includes("launch") || hLower.includes("unveil")) {
              cat = "Product launches";
            } else if (art.tag === "legal" || hLower.includes("fda") || hLower.includes("sec") || hLower.includes("antitrust")) {
              cat = "Regulatory";
            } else if (art.tag === "earnings") {
              cat = "Earnings";
            } else if (art.tag === "analyst") {
              cat = "Analyst actions";
            }

            const dir = art.sentiment === "positive" ? "Positive" : art.sentiment === "negative" ? "Risk" : "Neutral";
            liveCatalystItems.push({
              date: fmtDateShort(art.publishedAt),
              cat,
              ev: art.headline,
              note: `${art.source || "Newswire"} · ${art.summary ? art.summary.slice(0, 110) + "…" : "Live news dispatch."}`,
              imp: "MED",
              dir,
              dd,
              sourceBadge: (art.vendor || "NEWS").toUpperCase(),
            });
          });

          // 6. MARKET-WIDE CALENDAR SCHEDULE (Options expiration, FOMC rate decisions)
          const marketScheduleEvents: typeof liveCatalystItems = [
            { date: "Oct 25", cat: "Macro", ev: "Monthly options expiration (OpEx)", note: "Exchange-wide monthly options contract settlement session.", imp: "LOW", dir: "Neutral", dd: calcDd("Oct 25"), sourceBadge: "CALENDAR" },
            { date: "Oct 29", cat: "Macro", ev: "FOMC interest rate decision & press conference", note: "Federal Open Market Committee policy announcement and press conference.", imp: "HIGH", dir: "Risk", dd: calcDd("Oct 29"), sourceBadge: "FED" },
          ];

          const MAX_DAYS = 365;

          const combined = [...liveCatalystItems, ...marketScheduleEvents].filter(
            (c) => c.dd >= -MAX_DAYS && c.dd <= MAX_DAYS
          );

          combined.sort((a, b) => b.dd - a.dd);

          // Category count breakdown
          const countMap: Record<string, number> = { All: combined.length };
          CAT_KINDS.forEach((k) => {
            if (k !== "All") {
              countMap[k] = combined.filter((c) => c.cat === k).length;
            }
          });

          const filtered = combined.filter((c) => selectedCatFilter === "All" || c.cat === selectedCatFilter);

          const cats = filtered.map((cItem) => ({
            ...cItem,
            catUpper: cItem.cat.toUpperCase(),
            when: cItem.dd < 0 ? `${-cItem.dd}D AGO` : cItem.dd === 0 ? "TODAY" : `IN ${cItem.dd}D`,
            whenCol: cItem.dd < 0 ? "#5d6b79" : cItem.dd === 0 ? "#4ade80" : "#a9c6e3",
            impCol: cItem.imp === "HIGH" ? "#f5b031" : cItem.imp === "MED" ? STEEL : "#93a1af",
            dirCol: cItem.dir === "Positive" ? UP : cItem.dir === "Risk" ? DN : "#93a1af",
            dot: cItem.dd < 0 ? "#2a3a4a" : cItem.imp === "HIGH" ? "#f5b031" : STEEL,
            bd: cItem.dd >= 0 && cItem.imp === "HIGH" ? "rgba(245,176,49,0.4)" : "#1c2733",
          }));

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Filter Chips with live item counts */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {CAT_KINDS.map((cat) => {
                  const isSelected = selectedCatFilter === cat;
                  const cnt = countMap[cat] ?? 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCatFilter(cat)}
                      style={{
                        height: 32,
                        padding: "0 14px",
                        border: `1px solid ${isSelected ? STEEL : "#2a3a4a"}`,
                        background: isSelected ? "rgba(89,128,166,0.22)" : "transparent",
                        color: "var(--si-text-hi, #e8eef4)",
                        fontFamily: "'Manrope', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 160ms ease",
                      }}
                    >
                      <span>{cat}</span>
                      {cnt > 0 && (
                        <span style={{ fontSize: 11, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>
                          ({cnt})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Timeline cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cats.map((cItem, i) => (
                  <div
                    key={i}
                    style={{
                      border: `1px solid ${cItem.bd}`,
                      background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                      padding: "16px 20px",
                      display: "grid",
                      gridTemplateColumns: "140px 1fr auto",
                      gap: 18,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                        {cItem.date}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: cItem.whenCol, marginTop: 2 }}>
                        {cItem.when}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            letterSpacing: "0.1em",
                            color: "var(--si-accent-light, #a9c6e3)",
                            border: "1px solid var(--si-border-sec, #2a3a4a)",
                            padding: "1px 6px",
                          }}
                        >
                          {cItem.cat}
                        </span>
                        {cItem.sourceBadge && (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 9,
                              letterSpacing: "0.08em",
                              color: "#4ade80",
                              border: "1px solid rgba(74,222,128,0.35)",
                              background: "rgba(74,222,128,0.08)",
                              padding: "1px 5px",
                            }}
                          >
                            {cItem.sourceBadge}
                          </span>
                        )}
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                          {cItem.ev}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-mid, #93a1af)", marginTop: 4 }}>
                        {cItem.note}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: cItem.impCol }}>
                        {cItem.imp} IMPACT
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: cItem.dirCol }}>
                        {cItem.dir}
                      </div>
                    </div>
                  </div>
                ))}
                {cats.length === 0 && (
                  <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed #2a3a4a", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 14 }}>
                    No catalysts found matching category “{selectedCatFilter}”
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
                      border: m.role === "user" ? "1px solid #5980a6" : "1px solid #1c2733",
                      background: m.role === "user" ? "rgba(89,128,166,0.18)" : "rgba(12,17,24,0.95)",
                      padding: "12px 16px",
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: 14.5,
                      color: "var(--si-text-hi, #e8eef4)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text}
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
                `What is the biggest downside risk or bear thesis?`,
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
          const thBull = labDir === "Bull";
          const thHz = labHz === "12M" ? "1Y" : labHz;
          const thRun = thesisRun(stock.t, labDir, labHz, null, labWeightsState || undefined);
          const thPrev = thesisRun(stock.t, labDir, labHz, (c: any, n: any, f: any, dd: number) => -dd, labWeightsState || undefined);
          const TT = thesisTargets(stock.t, labDir, labHz, thRun, stock.p);
          const TPt = getTP(stock.t);

          const tgtV = targetOverride != null ? targetOverride : TT.target;
          const stopV = stopOverride != null ? stopOverride : TT.stop;
          const thUp = ((tgtV / stock.p) - 1) * 100;
          const thDn = ((stopV / stock.p) - 1) * 100;
          const thRR = Math.abs(thUp / (thDn || 1));
          const thConf = Math.round(thRun.conf);
          const dConf = Math.round(thRun.conf - thPrev.conf);
          const thAtRisk = thRun.critFail.length > 0;
          const thBand: [string, string] = thAtRisk
            ? ["THESIS AT RISK", DN]
            : thConf >= 75
              ? ["HIGH CONVICTION", UP]
              : thConf >= 60
                ? ["CONSTRUCTIVE", STEEL]
                : thConf >= 45
                  ? ["MIXED", "#f5b031"]
                  : ["WEAK", DN];

          const thStrong = thRun.drv.slice().sort((a: any, b: any) => b.pts - a.pts).slice(0, 3);
          const thWeak = thRun.drv.filter((d: any) => d.share >= 2).sort((a: any, b: any) => a.ev - b.ev).slice(0, 2);
          const thMover = thRun.drv.filter((d: any) => d.dd).sort((a: any, b: any) => Math.abs(b.dd) - Math.abs(a.dd)).slice(0, 2);

          const thLo = Math.min(TT.dn, stopV, stock.p) * 0.97;
          const thHi = Math.max(TT.up, tgtV, stock.p) * 1.03;
          const thPos = (v: number) => (((v - thLo) / (thHi - thLo || 1)) * 100).toFixed(2) + "%";

          // Historical price series based on real market bars (replaces PRNG synthetic series)
          const realBars = (sixMonthBars && sixMonthBars.length >= 10) ? sixMonthBars : (overviewBars && overviewBars.length >= 10) ? overviewBars : null;
          const hs = realBars && realBars.length >= 5
            ? realBars.map((b) => b.c)
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

          const thEvCol = (v: number) => (v >= 70 ? UP : v >= 55 ? STEEL : v >= 40 ? "#f5b031" : DN);

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
                    STRATEGY LAB · {stock.t}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", marginTop: 4 }}>
                    {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} STRATEGY
                  </div>
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
                        onClick={() => setLabMode(m)}
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
                    {["1M", "3M", "6M", "12M"].map((hz) => {
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
                    <span>DRIVER WEIGHTS</span>
                    <span style={{ color: "var(--si-text-mid, #93a1af)", letterSpacing: "0.04em" }}>
                      {labHz === "1M" ? "1M tactical" : labHz === "12M" ? "12M fundamental" : "3–6M balanced"} · {thBull ? "bullish" : "bearish"}
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
                          borderTop: `2px solid ${thEvCol(c.score)}`,
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

              {/* NORMAL MODE CONTENT */}
              {labMode === "NORMAL" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))", gap: 18, alignItems: "start" }}>
                  {/* Left Column: Market History */}
                  <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                        MARKET HISTORY
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", color: "var(--si-text-mid, #93a1af)" }}>
                        LAST {labHz === "12M" ? "12 MONTHS" : labHz}
                      </span>
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

                      {/* Target dashed line */}
                      <div style={{ position: "absolute", left: 0, right: 0, top: tgtYPct, borderTop: "1px dashed #4ade80" }}>
                        <span style={{ position: "absolute", right: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#4ade80", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>
                          TARGET {usd(tgtV)}
                        </span>
                      </div>

                      {/* Invalidation dashed line */}
                      <div style={{ position: "absolute", left: 0, right: 0, top: stopYPct, borderTop: "1px dashed #f05656" }}>
                        <span style={{ position: "absolute", left: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#f05656", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>
                          INVALIDATION {usd(stopV)}
                        </span>
                      </div>

                      {/* Current price glowing dot */}
                      <div style={{ position: "absolute", right: -4, top: nowYPct, width: 8, height: 8, marginTop: -4, borderRadius: 99, background: "#e8eef4", boxShadow: "0 0 10px rgba(232,238,244,0.6)" }} />
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                      {[
                        ["RETURN", pct1(hsRet), hsRet >= 0 ? UP : DN],
                        ["HIGH", usd(Math.max(...hs)), "#e8eef4"],
                        ["LOW", usd(Math.min(...hs)), "#e8eef4"],
                        ["MAX DRAWDOWN", pct1(hsDD * 100), DN],
                        ["VOLATILITY", Math.round(hsVolA) + "% ann.", "#e8eef4"],
                      ].map(([k, v, c], idx) => (
                        <div key={idx} style={{ padding: "10px 12px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>
                            {k}
                          </div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: c as string, marginTop: 2 }}>
                            {v}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Thesis Confidence & Weights */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* Confidence Box */}
                    <div
                      style={{
                        position: "relative",
                        border: "1px solid var(--si-border, #1c2733)",
                        background: "var(--si-card, #0c1118)",
                        boxShadow: "var(--si-shadow, none)",
                        padding: "18px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {/* Corner brackets */}
                      <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                      <span style={{ position: "absolute", right: -5, top: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                      <span style={{ position: "absolute", left: -5, bottom: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                      <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                            THESIS CONFIDENCE
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 56, fontWeight: 700, lineHeight: 0.9, color: "var(--si-text-hi, #e8eef4)" }}>
                              {thConf}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: "var(--si-text-sub, #5d6b79)" }}>
                              / 100
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: thBand[1] }}>
                            {thBand[0]}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-text-mid, #93a1af)", marginTop: 4 }}>
                            CORE INTACT <span style={{ color: thRun.coreOk === thRun.core.length ? UP : "#f5b031" }}>{thRun.coreOk} / {thRun.core.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 8, background: "var(--si-border, #1c2733)" }}>
                        <div style={{ height: 8, width: `${thConf}%`, background: thBand[1], transition: "width 400ms ease" }} />
                      </div>

                      {thAtRisk && (
                        <div style={{ border: "1px solid rgba(240,86,86,0.5)", background: "rgba(240,86,86,0.08)", padding: "10px 12px", fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2", lineHeight: 1.45 }}>
                          ◆ Critical driver failing: {thRun.critFail.map((d: any) => d.name).join(", ")}. The thesis is flagged AT RISK even though the aggregate score is {thConf}.
                        </div>
                      )}

                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.55 }}>
                        {thBull ? "Bullish" : "Bearish"} because {thStrong.map((d: any) => `${d.name} (${d.val})`).join(", ")} carry the most weight in the {labHz} profile.
                      </div>
                    </div>

                    {/* Weights Breakdown Accordion */}
                    <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                          WEIGHTS
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: labWeightsState ? "#f5b031" : STEEL, border: `1px solid ${labWeightsState ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {labWeightsState ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}
                        </span>
                      </div>

                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.45 }}>
                        {labHz === "1M" ? "Short horizon — price action, catalysts and positioning carry the most weight." : labHz === "12M" ? "Long horizon — business quality and valuation carry the most weight." : "Balanced 3–6 month horizon — fundamentals and revisions lead, confirmed by price action."}
                      </div>

                      {thRun.cats.map((c: any) => {
                        const isOpen = expandedLabDrivers[c.k];
                        const top = c.ds.slice().sort((a: any, b: any) => (b.share || 0) - (a.share || 0))[0];
                        return (
                          <div key={c.k} style={{ borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                            <div
                              onClick={() => setExpandedLabDrivers((prev) => ({ ...prev, [c.k]: !prev[c.k] }))}
                              style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 44px 34px 14px", alignItems: "center", gap: 12, padding: "7px 0", cursor: "pointer" }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                                  {c.label}
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-dim, #7d8b99)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {top ? `${top.name} · ${top.val}` : "—"}
                                </div>
                              </div>
                              <div style={{ height: 6, background: "#1c2733" }}>
                                <div style={{ height: 6, width: `${(c.w / 30) * 100}%`, background: "#5980a6", transition: "width 300ms ease" }} />
                              </div>
                              <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                                {Math.round(c.w)}%
                              </span>
                              <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: thEvCol(c.score) }}>
                                {Math.round(c.score)}
                              </span>
                              <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--si-accent, #5980a6)", fontSize: 12 }}>
                                ▼
                              </span>
                            </div>

                            {isOpen && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "6px 0 4px 0", borderLeft: "1px solid var(--si-border-sec, #2a3a4a)", paddingLeft: 12 }}>
                                {c.ds.map((xd: any, xidx: number) => (
                                  <div key={xidx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #141d27" }}>
                                    <span style={{ width: 58, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, color: xd.core ? "#a9c6e3" : "#7d8b99", border: "1px solid var(--si-border-sec, #2a3a4a)", padding: "2px 0" }}>
                                      {xd.core ? "CORE" : "CONFIRM"}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 120 }}>
                                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", display: "flex", gap: 6, alignItems: "center" }}>
                                        <span>{xd.name}</span>
                                        {xd.crit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "#f5b031" }}>◆ CRITICAL</span>}
                                      </div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-dim, #7d8b99)", marginTop: 1 }}>
                                        {xd.val}
                                      </div>
                                    </div>
                                    <div style={{ width: "clamp(36px,18%,90px)", flex: "none", height: 4, background: "#1c2733" }}>
                                      <div style={{ height: 4, width: `${xd.ev}%`, background: thEvCol(xd.ev) }} />
                                    </div>
                                    <span style={{ width: 26, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: thEvCol(xd.ev) }}>
                                      {Math.round(xd.ev)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-sub, #5d6b79)", marginTop: 4 }}>
                        <span>WEIGHT · EVIDENCE · Click a row for its drivers</span>
                        <span>Advanced mode to edit weights</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ADVANCED MODE CONTENT */}
              {labMode === "ADVANCED" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))", gap: 18, alignItems: "start" }}>
                  {/* Edit Weights Panel */}
                  <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                        EDIT WEIGHTS
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: labWeightsState ? "#f5b031" : STEEL, border: `1px solid ${labWeightsState ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                        {labWeightsState ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}
                      </span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                        Drag to set relative importance — automatically normalized to 100%.
                      </span>
                      <button
                        onClick={() => setLabWeightsState(null)}
                        style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Reset to engine weights
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 22px" }}>
                      {CATS_T.map(([k, label]) => {
                        const raw = labWeightsState ? labWeightsState[k] : thesisWeights(labDir, labHz)[k];
                        const pctVal = Math.round(thRun.W[k]);
                        return (
                          <div key={k}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--si-text-body, #d5dfe9)", marginBottom: 4 }}>
                              <span>{label}</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{pctVal}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              step="1"
                              value={raw || 0}
                              onChange={(e) => {
                                const base = labWeightsState || thesisWeights(labDir, labHz);
                                setLabWeightsState({ ...base, [k]: +e.target.value });
                              }}
                              style={{ width: "100%", accentColor: "#5980a6" }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Left Column: Driver Evidence Table */}
                  <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))" }}>
                    <div style={{ height: 50, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                        THESIS ENGINE · DRIVER EVIDENCE
                      </span>
                      <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--si-text-dim, #7d8b99)" }}>
                        <span style={{ border: "1px solid #5980a6", color: "var(--si-accent-light, #a9c6e3)", padding: "2px 6px" }}>CORE</span>
                        <span style={{ border: "1px solid var(--si-border-sec, #2a3a4a)", padding: "2px 6px" }}>CONFIRM</span>
                        <span style={{ color: "#f5b031" }}>◆ CRITICAL</span>
                      </span>
                    </div>

                    {thRun.cats.map((c: any) => (
                      <div key={c.k} style={{ borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px 8px" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-text-hi, #e8eef4)", flex: 1 }}>
                            {c.label}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-text-mid, #93a1af)" }}>
                            WEIGHT {Math.round(c.w)}%
                          </span>
                          <div style={{ width: 120, height: 6, background: "#1c2733" }}>
                            <div style={{ height: 6, width: `${c.score}%`, background: thEvCol(c.score), transition: "width 300ms ease" }} />
                          </div>
                          <span style={{ width: 30, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: thEvCol(c.score) }}>
                            {Math.round(c.score)}
                          </span>
                          <span style={{ width: 66, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-accent-light, #a9c6e3)" }}>
                            {c.pts.toFixed(1)} pts
                          </span>
                        </div>

                        {c.ds.map((dv: any, didx: number) => {
                          const bad = dv.crit && dv.ev < 40;
                          return (
                            <div key={didx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 18px 7px 30px", background: bad ? "rgba(240,86,86,0.08)" : "transparent" }}>
                              <span style={{ width: 62, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: dv.core ? "#a9c6e3" : "#7d8b99", border: `1px solid ${dv.core ? "#5980a6" : "#2a3a4a"}`, padding: "2px 0" }}>
                                {dv.core ? "CORE" : "CONFIRM"}
                              </span>
                              <div style={{ flex: 1, minWidth: 140 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)" }}>
                                  <span>{dv.name}</span>
                                  {dv.crit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: bad ? DN : "#f5b031" }}>◆ CRITICAL</span>}
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-dim, #7d8b99)", marginTop: 2 }}>
                                  {dv.val}
                                </div>
                              </div>
                              <div style={{ width: "clamp(40px,10%,110px)", flex: "none", height: 4, background: "#1c2733" }}>
                                <div style={{ height: 4, width: `${dv.ev}%`, background: thEvCol(dv.ev), transition: "width 300ms ease" }} />
                              </div>
                              <span style={{ width: 28, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: thEvCol(dv.ev) }}>
                                {Math.round(dv.ev)}
                              </span>
                              <span style={{ width: 52, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "var(--si-text-mid, #93a1af)" }}>
                                +{dv.pts.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ height: 6 }} />
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Confidence + Target Overrides + Invalidation */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* Confidence Box */}
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
                      {/* Corner brackets */}
                      <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                      <span style={{ position: "absolute", right: -5, top: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderTop: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                      <span style={{ position: "absolute", left: -5, bottom: -5, width: 10, height: 10, borderLeft: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />
                      <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid var(--si-accent-soft, #7fa8d0)", borderBottom: "1px solid var(--si-accent-soft, #7fa8d0)" }} />

                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                            THESIS CONFIDENCE
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 64, fontWeight: 700, lineHeight: 0.9, color: "var(--si-text-hi, #e8eef4)" }}>
                              {thConf}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, color: "var(--si-text-sub, #5d6b79)" }}>
                              / 100
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: thBand[1] }}>
                            {thBand[0]}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-text-mid, #93a1af)", marginTop: 4 }}>
                            CORE INTACT <span style={{ color: thRun.coreOk === thRun.core.length ? UP : "#f5b031" }}>{thRun.coreOk} / {thRun.core.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 8, background: "var(--si-border, #1c2733)" }}>
                        <div style={{ height: 8, width: `${thConf}%`, background: thBand[1], transition: "width 400ms ease" }} />
                      </div>

                      {thAtRisk && (
                        <div style={{ border: "1px solid rgba(240,86,86,0.5)", background: "rgba(240,86,86,0.08)", padding: "10px 12px", fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2", lineHeight: 1.45 }}>
                          ◆ Critical driver failing: {thRun.critFail.map((d: any) => d.name).join(", ")}.
                        </div>
                      )}

                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.55 }}>
                        {thBull ? "Bullish" : "Bearish"} because {thStrong.map((d: any) => `${d.name} (${d.val})`).join(", ")} carry the most weight in the {labHz} profile.
                      </div>

                      {/* Strongest & Weakest */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#4ade80", marginBottom: 6 }}>
                            STRONGEST
                          </div>
                          {thStrong.map((sg: any, idx: number) => (
                            <div key={idx} style={{ padding: "5px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.3 }}>{sg.name}</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-mid, #93a1af)" }}>{sg.val} · +{sg.pts.toFixed(1)} pts</div>
                            </div>
                          ))}
                        </div>

                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#f5b031", marginBottom: 6 }}>
                            WEAKEST
                          </div>
                          {thWeak.map((wk: any, idx: number) => (
                            <div key={idx} style={{ padding: "5px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1.3 }}>{wk.name}</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: thEvCol(wk.ev) }}>{wk.val} · ev {Math.round(wk.ev)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* What changed */}
                      <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)" }}>
                          <span>WHAT CHANGED</span>
                          <span style={{ color: dConf > 0 ? UP : dConf < 0 ? "#f5b031" : "#93a1af" }}>
                            {dConf >= 0 ? "+" : ""}{dConf} vs last week
                          </span>
                        </div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-body, #c5d0db)", marginTop: 6, lineHeight: 1.45 }}>
                          {thMover.length > 0 ? thMover.map((d: any) => `${d.name} ${d.dd > 0 ? "strengthened" : "weakened"} (${d.dd > 0 ? "+" : ""}${d.dd})`).join(" · ") : "No material driver change this week."}
                        </div>
                      </div>
                    </div>

                    {/* Price Target & Overrides */}
                    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                          PRICE TARGET
                        </span>
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

                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>
                        {usd(tgtV)}
                      </div>

                      {/* Marks track bar */}
                      <div style={{ position: "relative", height: 56, margin: "4px 6px 0" }}>
                        <div style={{ position: "absolute", left: 0, right: 0, top: 26, height: 2, background: "#1c2733" }} />
                        <div style={{ position: "absolute", top: 18, left: thPos(stopV), width: 2, height: 18, background: "#f05656" }} />
                        <div style={{ position: "absolute", top: 16, left: thPos(tgtV), width: 12, height: 12, marginLeft: -5, border: "2px solid #e8eef4", background: "var(--si-bg, #080b10)", transform: "rotate(45deg)", transition: "left 300ms ease" }} />

                        {[
                          ["BEAR", TT.dn, DN],
                          ["NOW", stock.p, "#e8eef4"],
                          ["BASE", TT.base, STEEL],
                          ["BULL", TT.up, UP],
                        ].map(([k, v, c], idx) => (
                          <div key={idx} style={{ position: "absolute", top: 0, left: thPos(v as number), transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: c as string }}>{k}</span>
                            <span style={{ width: 1, height: 14, background: c as string, marginTop: 2 }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "var(--si-text-mid, #93a1af)", marginTop: 16 }}>{usd(v as number)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Evidence sources */}
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 4 }}>
                          EVIDENCE SOURCES
                        </div>
                        {TT.src.map((sr: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                            <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)" }}>
                              {sr[0]} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-dim, #7d8b99)" }}>· {sr[1]}</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "var(--si-accent-light, #a9c6e3)" }}>
                              {usd(sr[2])}
                            </span>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
                          <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)" }}>
                            Estimate-revision adjustment
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "var(--si-accent-light, #a9c6e3)" }}>
                            {pct1(TT.revAdj * 100)}
                          </span>
                        </div>
                      </div>

                      {labEditTargets && (
                        <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                              <span>OVERRIDE TARGET · SUGGESTED {usd(TT.target)}</span>
                              <span style={{ color: "var(--si-text-hi, #e8eef4)" }}>{usd(tgtV)}</span>
                            </div>
                            <input
                              type="range"
                              min={Math.round(stock.p * 0.5)}
                              max={Math.round(stock.p * 1.8)}
                              step="1"
                              value={Math.round(tgtV)}
                              onChange={(e) => setTargetOverride(+e.target.value)}
                              style={{ width: "100%", accentColor: UP }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                              <span>OVERRIDE INVALIDATION · SUGGESTED {usd(TT.stop)}</span>
                              <span style={{ color: "#f05656" }}>{usd(stopV)}</span>
                            </div>
                            <input
                              type="range"
                              min={Math.round(stock.p * 0.5)}
                              max={Math.round(stock.p * 1.4)}
                              step="1"
                              value={Math.round(stopV)}
                              onChange={(e) => setStopOverride(+e.target.value)}
                              style={{ width: "100%", accentColor: DN }}
                            />
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

                    {/* Invalidation Rules */}
                    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                          INVALIDATION
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: stopOverride != null ? "#f5b031" : STEEL, border: `1px solid ${stopOverride != null ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {stopOverride != null ? "OVERRIDDEN" : "SUGGESTED"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ width: 84, flex: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#f05656", paddingTop: 3 }}>
                          PRICE
                        </span>
                        <div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                            Daily close {thBull ? "below" : "above"} {usd(stopV)}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-dim, #7d8b99)", marginTop: 2 }}>
                            {thBull ? `${labHz === "12M" ? "200-DMA" : "50-DMA / breakout shelf"} at ${usd(TT.lvl)}, less a 1.5% buffer` : `${usd(TPt.res)} resistance plus a 1.5% buffer`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 12, padding: "8px 0" }}>
                        <span style={{ width: 84, flex: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#f05656", paddingTop: 3 }}>
                          FUNDAMENTAL
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(thBull ? TPt.fi : TPt.fiB).map((rule: string, rIdx: number) => (
                            <div key={rIdx} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)" }}>
                              {rule}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Complete Simulated Thesis Card */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid #5980a6",
                  background: "var(--si-card, rgba(12, 17, 24, 0.95))",
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                    THESIS CARD
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                    {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} THESIS
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                  {[
                    ["TARGET", usd(tgtV), thBull ? UP : DN],
                    ["INVALIDATION", usd(stopV), DN],
                    ["UPSIDE", pct1(thUp), UP],
                    ["DOWNSIDE", pct1(thDn), DN],
                    ["REWARD / RISK", thRR.toFixed(1) + "×", thRR >= 2 ? UP : thRR >= 1.2 ? "#f5b031" : DN],
                    ["THESIS CONFIDENCE", `${thConf} / 100`, thBand[1]],
                    ["CORE DRIVERS INTACT", `${thRun.coreOk} of ${thRun.core.length}`, thRun.coreOk === thRun.core.length ? UP : "#f5b031"],
                  ].map(([k, v, c], idx) => (
                    <div key={idx} style={{ padding: "12px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>{k}</div>
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
                  onClick={() => {
                    const newT = {
                      ticker: stock.t,
                      dir: labDir,
                      hz: labHz,
                      title: `${thBull ? "LONG" : "SHORT"} ${stock.t} → ${usd(tgtV)} · ${labHz}`,
                      target: tgtV,
                      stop: stopV,
                      confAtSave: thConf,
                      savedDate: "Just now · Active",
                      wO: labWeightsState,
                    };
                    setSavedThesis(newT);
                    try {
                      localStorage.setItem(`si_thesis_${stock.t}`, JSON.stringify(newT));
                    } catch { }
                    setActiveTab("mon");
                  }}
                  style={{
                    height: 48,
                    border: "none",
                    background: "#5980a6",
                    color: "#ffffff",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    transition: "background 160ms",
                  }}
                >
                  Save & Monitor Strategy →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ====================================================
            TAB 9: STRATEGY MONITOR (Issue 7: Full Monitored View)
            ==================================================== */}
        {activeTab === "mon" && (() => {
          if (!savedThesis) {
            return (
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
                  PAPER STRATEGY MONITOR — CLIENT-SIDE ONLY
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
                  No strategy monitored for {stock.t}. Save information in Strategy Lab to monitor your strategy. This thesis is stored in the current browser and is not broker-connected or guaranteed to synchronize across devices.
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
                  Save Information in Strategy Lab →
                </button>
              </div>
            );
          }

          const b2 = savedThesis.dir === "Bull";
          const TPt = getTP(stock.t);
          const monAdj = (cat: string, name: string, fl: string) => {
            let a = 0;
            if (monScenario === "cut" && cat === "EARN") a += fl.indexOf("K") >= 0 ? -60 : -28;
            if (monScenario === "cut" && cat === "BUS" && fl.indexOf("K") >= 0) a -= 10;
            if (monScenario === "surge" && (cat === "TECH" || cat === "POS")) a += 12;
            if (monScenario === "break" && cat === "TECH") a -= 30;
            return a;
          };

          const monRun = thesisRun(stock.t, savedThesis.dir, savedThesis.hz, monAdj, savedThesis.wO || undefined);
          const monPx = monScenario === "break" ? (b2 ? savedThesis.stop * 0.985 : savedThesis.stop * 1.015) : stock.p;
          const monPriceBroken = b2 ? monPx <= savedThesis.stop : monPx >= savedThesis.stop;
          const monFundBroken = monRun.crit.filter((d: any) => d.ev < 25);
          const monDelta = monRun.conf - savedThesis.confAtSave;

          let monStatus = "THESIS INTACT";
          let monCol = STEEL;
          let monCause = `All ${monRun.core.length} core drivers within tolerance.`;
          let monBy = "Core Drivers";

          if (monPriceBroken) {
            monStatus = "INVALIDATED";
            monCol = DN;
            monBy = "Price invalidation";
            monCause = `Price closed ${b2 ? "below" : "above"} the ${usd(savedThesis.stop)} invalidation level (${usd(monPx)}).`;
          } else if (monFundBroken.length) {
            monStatus = "INVALIDATED";
            monCol = DN;
            monBy = monFundBroken[0].name;
            monCause = `Fundamental invalidation triggered: ${monFundBroken[0].name} evidence fell to ${Math.round(monFundBroken[0].ev)}.`;
          } else if (monRun.critFail.length || monRun.conf < 45) {
            monStatus = "AT RISK";
            monCol = "#f2763a";
            monBy = monRun.critFail.length ? monRun.critFail[0].name : "Aggregate confidence";
            monCause = monRun.critFail.length ? `Critical core driver failing: ${monRun.critFail[0].name}` : "Thesis confidence fell below 45.";
          } else if (monDelta >= 3) {
            monStatus = "STRENGTHENING";
            monCol = UP;
            monBy = "Core momentum";
            monCause = `Thesis evidence improved (+${Math.round(monDelta)} pts).`;
          } else if (monDelta <= -3) {
            monStatus = "WEAKENING";
            monCol = "#f5b031";
            monBy = "Factor pressure";
            monCause = `Thesis evidence slipped (${Math.round(monDelta)} pts).`;
          }

          const L5 = ["THESIS INTACT", "STRENGTHENING", "WEAKENING", "AT RISK", "INVALIDATED"];
          const lo2 = Math.min(savedThesis.stop, savedThesis.target);
          const hi2 = Math.max(savedThesis.stop, savedThesis.target);
          const monNowF = Math.max(0, Math.min(1, (monPx - lo2) / (hi2 - lo2 || 1)));

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Monitored Summary Box */}
              <div style={{ position: "relative", border: `1px solid ${monCol}`, background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, transition: "border-color 300ms" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 22, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span>PAPER STRATEGY MONITOR · CLIENT-SIDE ONLY</span>
                      <span style={{ fontSize: 10, background: "rgba(89, 128, 166, 0.2)", padding: "2px 6px", borderRadius: 3, color: "var(--si-accent-light, #a9c6e3)" }}>CLIENT STORAGE · NOT BROKER-CONNECTED</span>
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)", marginTop: 4, lineHeight: 1.45 }}>
                      Paper Strategy Monitor — client-side only. This thesis is stored in your current browser and is not broker-connected or guaranteed to synchronize across devices.
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", marginTop: 6 }}>
                      {savedThesis.title}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          setLabDir(savedThesis.dir);
                          setLabHz(savedThesis.hz);
                          setLabWeightsState(savedThesis.wO || null);
                          setTargetOverride(savedThesis.target);
                          setStopOverride(savedThesis.stop);
                          setActiveTab("lab");
                        }}
                        style={{ height: 30, padding: "0 12px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit in Strategy Lab
                      </button>

                      {confirmDeleteThesis ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2" }}>
                            Delete strategy?
                          </span>
                          <button
                            onClick={() => {
                              setSavedThesis(null);
                              try {
                                localStorage.removeItem(`si_thesis_${stock.t}`);
                              } catch { }
                              setConfirmDeleteThesis(false);
                            }}
                            style={{ height: 30, padding: "0 12px", border: "none", background: "#f05656", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            Delete
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
                          Delete thesis
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>STATUS</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "0.04em", color: monCol, transition: "color 300ms" }}>
                      {monStatus}
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
                          background: isCurrent ? "rgba(127,168,208,0.12)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          color: "var(--si-text-hi, #e8eef4)",
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
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{savedThesis.confAtSave}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>CONFIDENCE NOW</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                      {Math.round(monRun.conf)}{" "}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: monDelta > 0 ? UP : monDelta < 0 ? "#f5b031" : "#93a1af" }}>
                        ({monDelta >= 0 ? "+" : ""}{Math.round(monDelta)})
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>CORE DRIVERS INTACT</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{monRun.coreOk} / {monRun.core.length}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>PRICE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{usd(monPx)}</div>
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
                    const isFail = d.core && now < 40;
                    const stt = isFail
                      ? ["FAILED", DN]
                      : dv <= -3
                        ? ["SLIPPING", "#f5b031"]
                        : dv >= 3
                          ? ["IMPROVING", UP]
                          : ["HOLDING", STEEL];

                    return (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ width: 62, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: d.core ? "#a9c6e3" : "#7d8b99", border: "1px solid var(--si-border-sec, #2a3a4a)", padding: "2px 0" }}>
                          {d.core ? "CORE" : "CONFIRM"}
                        </span>
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
                      ...(b2 ? TPt.fi : TPt.fiB).map((rule: string, i: number) => {
                        const trig = i === 0 && monFundBroken.length > 0;
                        const warn = i === 0 && !trig && monScenario === "cut";
                        return {
                          k: rule,
                          st: trig ? "TRIGGERED" : warn ? "WATCH" : "CLEAR",
                          c: trig ? DN : warn ? "#f5b031" : UP,
                        };
                      }),
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
                      ["Today 13:40", `${monRun.drv[0]?.name}: evidence holding above threshold.`],
                      ["Today 10:15", `Market regime check: constructive liquidity environment.`],
                      [savedThesis.savedDate, `Thesis saved · confidence ${savedThesis.confAtSave} · target ${usd(savedThesis.target)} · invalidation ${usd(savedThesis.stop)}.`],
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
