"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSI } from "./si-context";
import { SITab, StockItem, DetailStock } from "./types";
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
} from "./data";
import { useTickerSearch } from "../hooks/useTickerSearch";
import { CandleChart, BarInterval } from "../candle-chart";
import { useIntervalBars } from "../hooks/useBackendBars";
import { useLiveQuotes } from "../live-quotes-context";
import { StockLogo, IntervalMenu, ChartSelect, CHART_TYPE_OPTIONS, VendorTag } from "../utils";
import { SISwitcher } from "./si-switcher";
import { useApiResource } from "../hooks/useApiResource";
import { useApiList } from "../hooks/useApiList";
import { apiGet } from "../backend";
import type {
  CompanyDoc,
  FinancialsDoc,
  AnalystConsensusDoc,
  InsiderTxDoc,
  NewsArticleDoc,
  LiveEarningsDoc,
  AiAnalysisDoc,
} from "../types";
import { reportedQuarterEps } from "../types";
import type { Stock13FResponse } from "../stock-13f-view";

export function StockIntelligenceScreen() {
  const { siTicker, setSiTicker, activeTab, setActiveTab, enterSI, exitToMC } = useSI();

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchResults = useTickerSearch(searchQuery);

  // Timeframe and chart range for SI overview price chart
  const [range, setRange] = useState<"1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y">("6M");
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  // Technicals chart interval & type (matches MC Overview)
  const [barInterval, setBarInterval] = useState<BarInterval>("1D");
  const [chartType, setChartType] = useState<"Candles" | "Hollow" | "Bars" | "Line" | "Area">("Candles");
  const [showEarnings, setShowEarnings] = useState(true);

  // Active stock data
  const currentTicker = siTicker ? siTicker.toUpperCase().trim() : null;

  // Live quotes for accurate price sync
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
  const { data: aiAnalysisDoc } = useApiResource<AiAnalysisDoc>(
    currentTicker ? `/live/ai-analysis?ticker=${encodeURIComponent(currentTicker)}` : null
  );

  // Form 13F Institutional Holdings (FMP)
  const [inst13FData, setInst13FData] = useState<Stock13FResponse | null>(null);
  useEffect(() => {
    if (!currentTicker) return;
    let cancelled = false;
    apiGet<Stock13FResponse>(`/live/13f-filings?ticker=${encodeURIComponent(currentTicker)}`)
      .then((res) => {
        if (!cancelled) setInst13FData(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentTicker]);

  // Live technical bars for the Technicals tab (matches MC Overview)
  const { bars: realBars, asOf: barsAsOf, loading: barsLoading } = useIntervalBars(
    currentTicker || "NVDA",
    barInterval
  );

  const stock: StockItem | null = useMemo(() => {
    if (!currentTicker) return null;
    return getStock(currentTicker, {
      price: sharedQuote?.price ?? undefined,
      change: sharedQuote?.pctChange ?? undefined,
    });
  }, [currentTicker, sharedQuote]);

  const stockDetail: DetailStock | null = useMemo(() => {
    if (!currentTicker) return null;
    return detail(currentTicker, {
      price: sharedQuote?.price ?? undefined,
      change: sharedQuote?.pctChange ?? undefined,
    });
  }, [currentTicker, sharedQuote]);

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
        // Default sample thesis for immediate viewing if not saved yet
        setSavedThesis({
          ticker: currentTicker,
          dir: "Bull",
          hz: "6M",
          title: `${currentTicker} Institutional Expansion Thesis`,
          target: stock ? Math.round(stock.p * 1.25) : 225,
          stop: stock ? Math.round(stock.p * 0.88) : 158,
          confAtSave: stock ? stock.conf : 84,
          savedDate: "Today · Active",
        });
      }
    } catch {}
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
    enterSI(clean);
  };

  // Ask AI copilot function
  const handleAskAI = (promptText?: string) => {
    const q = (promptText || aiQuery).trim();
    if (!q || !stock || !stockDetail) return;

    setAiChat((prev) => [...prev, { role: "user", text: q }]);
    if (!promptText) setAiQuery("");
    setAiBusy(true);

    setTimeout(() => {
      let reply = "";
      const qLower = q.toLowerCase();
      if (qLower.includes("bull") || qLower.includes("upside")) {
        reply = `**Institutional Bull Case for ${stock.t}:**\n• ${stock.sig.slice(0, 3).join("\n• ")}\n• Setup rating: **${stock.setup}** with ${stock.cf}/7 confluence score\n• Revenue growth (+${pct1(stock.rev)}) confirms ongoing expansion with premium multiple support.`;
      } else if (qLower.includes("bear") || qLower.includes("downside") || qLower.includes("risk")) {
        reply = `**Key Downside Risks for ${stock.t}:**\n• Forward P/E of ${stock.fpe}× leaves low tolerance for top-line guidance misses\n• ${stockDetail.invalid[0]?.[0] || "Valuation compression"}: ${stockDetail.invalid[0]?.[1] || "Margin pressure"}\n• Upcoming binary catalyst: ${stockDetail.upcoming[0]?.n || "Next earnings"}.`;
      } else if (qLower.includes("invalid") || qLower.includes("stop")) {
        reply = `**Thesis Invalidation Parameters:**\n• ${stockDetail.invalid.map((x) => `**${x[0]}**: ${x[1]}`).join("\n• ")}`;
      } else {
        reply = `**${stock.t} Synthesis:**\n• Today ${stock.t} moved ${pct(stock.c)}.\n• ${stockDetail.movedTxt}\n• Factor attribution: Sector (${stockDetail.att[0]}%), Company News (${stockDetail.att[1]}%), Market (${stockDetail.att[2]}%).`;
      }
      setAiChat((prev) => [...prev, { role: "assistant", text: reply }]);
      setAiBusy(false);
    }, 600);
  };

  // ----------------------------------------------------
  // EMPTY STATE (NO STOCK SELECTED YET)
  // ----------------------------------------------------
  if (!stock || !stockDetail) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080b10",
          backgroundImage:
            "linear-gradient(rgba(127,168,208,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(127,168,208,0.045) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          color: "#e8eef4",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          paddingBottom: 120,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10 }}>
          <SISwitcher />
        </div>
        <div style={{ maxWidth: 640, width: "100%", textAlign: "center", marginTop: 40 }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "#e8eef4",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Stock Intelligence
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.22em",
              color: "#5980a6",
              marginBottom: 28,
            }}
          >
            DEEP-DIVE RESEARCH & THESIS ENGINE
          </div>

          <p
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 15,
              color: "#93a1af",
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
                border: "1px solid #2a3a4a",
                background: "#0c1118",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0 18px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5980a6" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search tickers (e.g. NVDA, AAPL, MSFT, META, TSLA, STRL)…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#e8eef4",
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
                  background: "#0c1118",
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
                      borderBottom: "1px solid #1c2733",
                    }}
                  >
                    <StockLogo sym={r.ticker} size={24} />
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#e8eef4",
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
                        color: "#93a1af",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.name || r.ticker}
                    </span>
                    {r.price != null && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#e8eef4" }}>
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
                color: "#5980a6",
                marginBottom: 12,
              }}
            >
              POPULAR STOCKS WITH FULL COVERAGE
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {ORDER.map((sym) => {
                const s = STK[sym];
                return (
                  <button
                    key={sym}
                    onClick={() => handleSelectStock(sym)}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      background: "rgba(12, 17, 24, 0.9)",
                      border: "1px solid #2a3a4a",
                      borderRadius: 6,
                      color: "#e8eef4",
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
                    <span style={{ fontSize: 11, color: s.c >= 0 ? UP : DN }}>{pct(s.c)}</span>
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
  const color = stock.c >= 0 ? UP : DN;

  // Overview Price History chart calculations
  const rangesDef: Record<string, [number, number, number]> = {
    "1D": [78, 0.003, stock.c / 100 / 78],
    "5D": [39, 0.008, 0.0004],
    "1M": [30, 0.015, 0.0008],
    "3M": [60, 0.018, 0.001],
    "6M": [120, 0.02, 0.0012],
    "1Y": [250, 0.022, 0.0015],
    "5Y": [350, 0.025, 0.0018],
  };
  const [numPts, volFactor, driftFactor] = rangesDef[range] || rangesDef["6M"];
  const priceSeries = series(stock.t + range, numPts, stock.p, volFactor, driftFactor);
  const minP = Math.min(...priceSeries);
  const maxP = Math.max(...priceSeries);
  const rangeDiff = maxP - minP || 1;
  const pStart = priceSeries[0];
  const pEnd = priceSeries[priceSeries.length - 1];
  const chartCol = pEnd >= pStart ? UP : DN;

  // SVG path coordinates
  const svgW = 1000;
  const svgH = 320;
  const pathD = priceSeries
    .map((val, idx) => {
      const x = (idx / (priceSeries.length - 1)) * svgW;
      const y = svgH - ((val - minP) / rangeDiff) * (svgH - 28) - 14;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const areaD = `${pathD} L ${svgW} ${svgH} L 0 ${svgH} Z`;

  // Dynamic X-axis & Tooltip generation (Issue 1 fix: Month + Year on 5Y hover)
  const getLabelAtFrac = (f: number, isHover = false) => {
    const now = new Date(2026, 9, 13); // Fixed reference date
    if (range === "1D") {
      const totalMinutes = Math.round(f * 390); // 9:30 AM to 4:00 PM = 390 mins
      const h = 9 + Math.floor((30 + totalMinutes) / 60);
      const m = (30 + totalMinutes) % 60;
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h;
      return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    if (range === "5D") {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.round((1 - f) * 5));
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    if (range === "1M") {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.round((1 - f) * 30));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (range === "3M") {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.round((1 - f) * 90));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (range === "6M") {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.round((1 - f) * 180));
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    if (range === "1Y") {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.round((1 - f) * 365));
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    const d = new Date(now);
    d.setDate(d.getDate() - Math.round((1 - f) * 1825));
    if (isHover) {
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    return d.toLocaleDateString("en-US", { year: "numeric" });
  };

  const axisLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => getLabelAtFrac(f, false));

  // Crosshair calculations
  let hoverInfo: { leftPct: number; topPct: number; priceVal: number; label: string } | null = null;
  if (hoverFrac !== null) {
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
  const realMcap = useMemo(() => {
    if (liveCompany?.marketCap) {
      const mc = liveCompany.marketCap;
      if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
      if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
      if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
    }
    return stock.mcap;
  }, [liveCompany, stock.mcap]);

  // Stats definition for Overview header
  const statsRow = [
    { k: "MARKET CAP", v: realMcap, sub: liveCompany?.sector || stock.sector },
    { k: "P/E", v: `${(liveCompany?.peRatio ?? stock.pe).toFixed(1)}×`, sub: `fwd ${stock.fpe}×` },
    { k: "REVENUE GROWTH", v: realFundGrowth?.revYoy != null ? pct1(realFundGrowth.revYoy) : pct1(stock.rev), sub: realFundGrowth ? "y/y, FMP reported" : "y/y, latest qtr" },
    { k: "EPS GROWTH", v: realFundGrowth?.epsYoy != null ? pct1(realFundGrowth.epsYoy) : pct1(stock.eps), sub: realFundGrowth ? "y/y, FMP reported" : "y/y, latest qtr" },
    { k: "52W HIGH / LOW", v: `${usd(liveCompany?.high52 ?? stock.hi)} / ${usd(liveCompany?.low52 ?? stock.lo)}`, sub: "Range" },
  ];

  // Confluence dots
  const confluenceDots = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    c: i < stock.cf ? "#7fa8d0" : "#1c2733",
  }));

  // Signal scores mapping
  const signalScores = KEYS.map((k, idx) => {
    const val = stockDetail.sv[idx] || 70;
    return {
      name: k,
      val,
      color: sc(val),
      widthPct: `${val}%`,
    };
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080b10",
        backgroundImage:
          "linear-gradient(rgba(127,168,208,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(127,168,208,0.045) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        color: "#e8eef4",
        paddingBottom: 120, // Issue 8 fix: generous padding at bottom
      }}
    >
      {/* ====================================================
          STICKY TOP NAVIGATION BAR (Integrated SISwitcher)
          ==================================================== */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(8,11,16,0.96)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #1c2733",
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
          {/* Logo & Subtitle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "none",
              borderRight: "1px solid #1c2733",
              paddingRight: 16,
            }}
          >
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "#e8eef4",
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
                color: "#5980a6",
                marginTop: 3,
              }}
            >
              BY MARKETCATALYST
            </span>
          </div>

          {/* Quick Readme Button */}
          <button
            onClick={() => setShowReadme(!showReadme)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 10px",
              border: "1px solid #2a3a4a",
              background: "transparent",
              color: "#a9c6e3",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              cursor: "pointer",
            }}
          >
            README
          </button>

          {/* Search Bar */}
          <div style={{ position: "relative", width: 220, flex: "none" }}>
            <div
              style={{
                height: 34,
                border: "1px solid #1c2733",
                background: "#0c1118",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 10px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5980a6" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search tickers…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#e8eef4",
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
                  background: "#0c1118",
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
                      borderBottom: "1px solid #1c2733",
                    }}
                  >
                    <StockLogo sym={r.ticker} size={20} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: "#e8eef4", width: 50 }}>
                      {r.ticker}
                    </span>
                    <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#93a1af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </span>
                    {r.price != null && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#e8eef4" }}>
                        {usd(r.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Issue 5 Fix: Centered SISwitcher inside the header bar */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 240 }}>
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
                background: "#5980a6",
                color: "#ffffff",
                fontFamily: "'Manrope', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ✦ AI Research
            </button>
            <button
              onClick={() => setIsWatched(!isWatched)}
              style={{
                height: 34,
                padding: "0 12px",
                border: isWatched ? "1px solid #5980a6" : "1px solid #2a3a4a",
                background: isWatched ? "rgba(89,128,166,0.18)" : "transparent",
                color: isWatched ? "#a9c6e3" : "#e8eef4",
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
                border: "1px solid #1c2733",
                background: "transparent",
                color: "#e8eef4",
                fontFamily: "'Manrope', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Monitor Thesis
            </button>
          </div>
        </div>

        {/* 9 Tab Navigation Rail */}
        <div style={{ display: "flex", gap: 0, padding: "0 24px", overflowX: "auto", borderTop: "1px solid #1c2733" }}>
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
                  color: isActive ? "#e8eef4" : "#7d8b99",
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
                border: "1px solid #1c2733",
                background: "rgba(12,17,24,0.9)",
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
              <div style={{ padding: "16px 18px", borderRight: "1px solid #1c2733", minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StockLogo sym={stock.t} size={40} />
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: "0.06em", color: "#e8eef4", lineHeight: 1 }}>
                      {stock.t}
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#93a1af", marginTop: 4 }}>
                      {stock.name}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, color: "#e8eef4" }}>
                    {usd(stock.p)}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color }}>
                    {pct(stock.c)}
                  </span>
                </div>
              </div>

              {/* Stats Items */}
              {statsRow.map((st) => (
                <div key={st.k} style={{ padding: "16px 18px", borderRight: "1px solid #1c2733", minWidth: 0 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "#5980a6", whiteSpace: "nowrap" }}>
                    {st.k}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 600, color: "#e8eef4", marginTop: 8, whiteSpace: "nowrap" }}>
                    {st.v}
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#93a1af", marginTop: 4 }}>
                    {st.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Price History Chart Card with Interactive Crosshair & Detailed X-Axis */}
            <div style={{ position: "relative", border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)" }}>
              <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid #1c2733" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                  PRICE HISTORY
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#93a1af" }}>
                  {range} ·
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: chartCol }}>
                  {pct(((pEnd / pStart) - 1) * 100)}
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
                        color: range === r ? "#e8eef4" : "#93a1af",
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
                  const rect = e.currentTarget.getBoundingClientRect();
                  const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  setHoverFrac(f);
                }}
                onMouseLeave={() => setHoverFrac(null)}
                style={{ position: "relative", height: 320, margin: "14px 16px 10px", cursor: "crosshair" }}
              >
                <svg width="100%" height="320" viewBox="0 0 1000 320" preserveAspectRatio="none" style={{ display: "block" }}>
                  <line x1="0" x2="1000" y1="80" y2="80" stroke="#152029" vectorEffect="non-scaling-stroke" />
                  <line x1="0" x2="1000" y1="160" y2="160" stroke="#152029" vectorEffect="non-scaling-stroke" />
                  <line x1="0" x2="1000" y1="240" y2="240" stroke="#152029" vectorEffect="non-scaling-stroke" />
                  <path d={areaD} fill={chartCol} opacity="0.1" />
                  <path d={pathD} fill="none" stroke={chartCol} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                </svg>

                {/* Vertical Crosshair Line, Glowing Dot, and Floating Tooltip */}
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
                        background: "#0c1118",
                        border: "1px solid #5980a6",
                        padding: "8px 12px",
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                        zIndex: 20,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                      }}
                    >
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#93a1af" }}>
                        {hoverInfo.label}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, color: "#e8eef4", marginTop: 2 }}>
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
                  color: "#5d6b79",
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
                  border: "1px solid #5980a6",
                  background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))",
                  padding: "22px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid #7fa8d0", borderTop: "1px solid #7fa8d0" }} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid #7fa8d0", borderBottom: "1px solid #7fa8d0" }} />

                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                  ✦ MARKETCATALYST INTELLIGENCE
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "#e8eef4", lineHeight: 1.55 }}>
                  {stockDetail.assess}
                </div>

                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", borderTop: "1px solid #1c2733", paddingTop: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "#5980a6" }}>
                      CONFIDENCE
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "#e8eef4", lineHeight: 1, marginTop: 4 }}>
                      {stock.conf}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: "#5d6b79" }}> / 100</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "#5980a6" }}>
                      CONFLUENCE
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "#e8eef4", lineHeight: 1 }}>
                        {stock.cf}
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 600, color: "#93a1af" }}>/ 7</span>
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
                        color: "#a9c6e3",
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #1c2733", paddingTop: 12 }}>
                    {(stockDetail.assessEv || []).map((ae, i) => (
                      <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#c4d0dc", display: "flex", gap: 8 }}>
                        <span style={{ color: "#7fa8d0" }}>▸</span>
                        <span>{ae}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 2: Signal Scores */}
              <div
                style={{
                  border: "1px solid #1c2733",
                  background: "rgba(12,17,24,0.9)",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "#e8eef4" }}>
                    SIGNAL SCORES
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#93a1af" }}>
                      Click a score for evidence
                    </span>
                    <button
                      onClick={() => setShowSigHow(!showSigHow)}
                      style={{
                        height: 24,
                        padding: "0 9px",
                        border: "1px solid #2a3a4a",
                        background: "transparent",
                        color: "#a9c6e3",
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
                  <div style={{ border: "1px solid #2a3a4a", background: "#0b1016", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "#5980a6" }}>
                      HOW EACH SCORE IS CALCULATED
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#93a1af", lineHeight: 1.5, margin: "4px 0" }}>
                      Every score runs 0–100, where 50 is neutral. Inputs are ranked against the stock’s history and sector peers, then blended.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid #1c2733" }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, color: "#e8eef4" }}>Momentum</span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: "#c9d4de" }}>1M, 3M, 6M returns + distance above 50 & 200 DMA.</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid #1c2733" }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, color: "#e8eef4" }}>Volume</span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: "#c9d4de" }}>Relative volume vs 20-day average and accumulation vs distribution days.</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "8px 0" }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, color: "#e8eef4" }}>Market Regime</span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: "#c9d4de" }}>S&P 500 trend, VIX level, market breadth, and rate volatility.</span>
                    </div>
                  </div>
                )}

                {/* 7 Interactive Score Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {signalScores.map((scItem) => {
                    const isSelected = selectedSignal === scItem.name;
                    return (
                      <button
                        key={scItem.name}
                        onClick={() => setSelectedSignal(isSelected ? null : scItem.name)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${isSelected ? STEEL : "#1c2733"}`,
                          background: isSelected ? "rgba(89,128,166,0.18)" : "transparent",
                          padding: 12,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "#93a1af" }}>
                          {scItem.name}
                        </span>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: scItem.color, lineHeight: 1 }}>
                          {scItem.val}
                        </span>
                        <span style={{ height: 3, background: "#1c2733", display: "block" }}>
                          <span style={{ display: "block", height: 3, width: scItem.widthPct, background: scItem.color }} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Expanded Signal Evidence Card */}
                {selectedSignal && (
                  <div style={{ border: "1px solid #5980a6", background: "rgba(89,128,166,0.08)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: "#a9c6e3" }}>
                        EVIDENCE · {selectedSignal.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setSelectedSignal(null)}
                        style={{ border: "none", background: "transparent", color: "#93a1af", cursor: "pointer", fontSize: 14 }}
                      >
                        ✕
                      </button>
                    </div>
                    {((stockDetail.ev && selectedSignal ? stockDetail.ev[selectedSignal] : null) || [
                      "Leading relative strength rank across sector peers",
                      "Institutional accumulation detected over last 10 sessions",
                      "Options skew shows calls priced at premium over puts",
                    ]).map((evItem, i) => (
                      <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#d5dfe9", display: "flex", gap: 8, lineHeight: 1.45 }}>
                        <span style={{ color: "#7fa8d0" }}>▸</span>
                        <span>{evItem}</span>
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
            {/* Intraday Timeline with Numbered Markers */}
            <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                  INTRADAY TIMELINE
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#93a1af" }}>Today · 5-min</span>
                <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color }}>
                  {pct(stock.c)}
                </span>
              </div>
              <div style={{ position: "relative", height: 220 }}>
                <svg width="100%" height="220" viewBox="0 0 1000 220" preserveAspectRatio="none" style={{ display: "block" }}>
                  <path d={areaD} fill={color} opacity="0.08" />
                  <path d={pathD} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                {(stockDetail.events || []).map((ev, i) => {
                  const xPct = (ev.fr * 100).toFixed(1);
                  return (
                    <div key={i} style={{ position: "absolute", left: `${xPct}%`, top: "35%", transform: "translateX(-50%)" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 99, background: "#080b10", border: "2px solid #7fa8d0" }} />
                      <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#a9c6e3", background: "#0c1118", border: "1px solid #1c2733", padding: "1px 5px" }}>
                        {i + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Event Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 16 }}>
                {(stockDetail.events || []).map((ev, i) => (
                  <div key={i} style={{ border: "1px solid #1c2733", borderTop: "2px solid #5980a6", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#a9c6e3" }}>
                        #{i + 1} · {ev.time}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: (typeof ev.mv === "number" ? ev.mv >= 0 : String(ev.mv).startsWith("+")) ? UP : DN }}>
                        {typeof ev.mv === "number" ? (ev.mv >= 0 ? "+" : "−") + Math.abs(ev.mv).toFixed(2) + "%" : ev.mv}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "#e8eef4", lineHeight: 1.35 }}>
                      {ev.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attribution Breakdown & AI Explanation */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              {/* Attribution */}
              <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                    MOVE ATTRIBUTION
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#93a1af" }}>
                    of <b style={{ color }}>{pct(stock.c)}</b> today
                  </span>
                  <button
                    onClick={() => setShowAttHow(!showAttHow)}
                    style={{ marginLeft: "auto", height: 24, padding: "0 9px", border: "1px solid #2a3a4a", background: "transparent", color: "#a9c6e3", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, cursor: "pointer" }}
                  >
                    HOW IT WORKS
                  </button>
                </div>
                {/* Stacked Bar */}
                <div style={{ display: "flex", height: 16, width: "100%" }}>
                  {[
                    { k: "Sector", p: stockDetail.att[0], c: "#7fa8d0" },
                    { k: "News", p: stockDetail.att[1], c: "#4ade80" },
                    { k: "Market", p: stockDetail.att[2], c: "#c4a6ff" },
                    { k: "Technical", p: stockDetail.att[3], c: "#f5b031" },
                  ].map((at, idx) => (
                    <span key={idx} style={{ height: 16, width: `${at.p}%`, background: at.c, borderRight: "2px solid #080b10" }} />
                  ))}
                </div>
                {/* Factor rows */}
                {[
                  { k: "Sector Momentum", p: stockDetail.att[0], c: "#7fa8d0" },
                  { k: "Company News", p: stockDetail.att[1], c: "#4ade80" },
                  { k: "Market Regime", p: stockDetail.att[2], c: "#c4a6ff" },
                  { k: "Technical Factors", p: stockDetail.att[3], c: "#f5b031" },
                ].map((at, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 10, height: 10, background: at.c }} />
                    <span style={{ width: 120, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "#e8eef4" }}>{at.k}</span>
                    <div style={{ flex: 1, height: 6, background: "#1c2733" }}>
                      <div style={{ height: 6, width: `${at.p}%`, background: at.c }} />
                    </div>
                    <span style={{ width: 44, textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#e8eef4" }}>{at.p}%</span>
                  </div>
                ))}
              </div>

              {/* AI Explanation Card */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid #5980a6",
                  background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))",
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid #7fa8d0", borderTop: "1px solid #7fa8d0" }} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid #7fa8d0", borderBottom: "1px solid #7fa8d0" }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                  ✦ AI EXPLANATION
                </span>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "#e8eef4", lineHeight: 1.55 }}>
                  {stockDetail.movedTxt}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#5980a6", borderTop: "1px solid #1c2733", paddingTop: 12 }}>
                  SUPPORTING EVIDENCE
                </div>
                {stockDetail.movedEv.map((me, i) => (
                  <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#d5dfe9", display: "flex", gap: 8, lineHeight: 1.45 }}>
                    <span style={{ color: "#7fa8d0" }}>▸</span>
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
              <div style={{ position: "relative", border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "22px 24px" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4", marginBottom: 22 }}>
                  UPCOMING CATALYSTS
                </div>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 2, background: "linear-gradient(90deg, #5980a6, rgba(89,128,166,0.2))", zIndex: 0 }} />
                  {stockDetail.upcoming.map((up, i) => (
                    <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, zIndex: 1 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 99, background: "#080b10", border: "2px solid #7fa8d0", boxShadow: "0 0 0 6px rgba(127,168,208,0.12)" }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#a9c6e3", marginTop: 4 }}>
                        {up.date} · {up.days}
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: "#e8eef4", lineHeight: 1 }}>
                        {up.n}
                      </span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#93a1af", lineHeight: 1.45 }}>
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
                <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                      FORWARD SIGNALS
                    </span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#93a1af" }}>
                        Click a signal to see what it’s made of
                      </span>
                      <button
                        onClick={() => setShowFwdHow(!showFwdHow)}
                        style={{
                          height: 24,
                          padding: "0 9px",
                          border: "1px solid #2a3a4a",
                          background: "transparent",
                          color: "#a9c6e3",
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
                    <div style={{ border: "1px solid #2a3a4a", background: "#0b1016", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "#5980a6" }}>
                        HOW EACH FORWARD SIGNAL IS CALCULATED
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#93a1af", lineHeight: 1.55, margin: "6px 0 4px" }}>
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
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 14, padding: "10px 0", borderBottom: "1px solid #1c2733" }}>
                          <div>
                            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "#e8eef4" }}>{sName}</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: "#5d6b79", marginTop: 3 }}>{sSrc}</div>
                          </div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#c9d4de", lineHeight: 1.5 }}>{sDesc}</div>
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
                          <span style={{ width: 100, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "#e8eef4" }}>
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
                          <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "#5980a6", fontSize: 12, flex: "none" }}>
                            ▼
                          </span>
                        </div>

                        {/* Expandable Driver Evidence List */}
                        {isOpen && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "6px 0 4px 0", borderLeft: "1px solid #2a3a4a", paddingLeft: 12 }}>
                            {c.ds.map((xd: any, xidx: number) => {
                              const evCol = sc(xd.ev);
                              return (
                                <div key={xidx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #141d27" }}>
                                  <span style={{ width: 58, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, color: xd.core ? "#a9c6e3" : "#7d8b99", border: "1px solid #2a3a4a", padding: "2px 0" }}>
                                    {xd.core ? "CORE" : "CONFIRM"}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 120 }}>
                                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "#e8eef4", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                      <span>{xd.name}</span>
                                      {xd.crit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "#f5b031" }}>◆ CRITICAL</span>}
                                    </div>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#7d8b99", marginTop: 1 }}>
                                      {xd.val}
                                      {xd.shared && <span style={{ color: "#5980a6" }}> · ↔ counted once</span>}
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
                    border: "1px solid #5980a6",
                    background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))",
                    padding: "24px 26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 32,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderLeft: "1px solid #7fa8d0", borderTop: "1px solid #7fa8d0" }} />
                  <span style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, borderRight: "1px solid #7fa8d0", borderBottom: "1px solid #7fa8d0" }} />

                  {/* SVG Circular Ring */}
                  <div style={{ position: "relative", width: 170, height: 170, flex: "none" }}>
                    <svg width="170" height="170" viewBox="0 0 170 170" style={{ position: "absolute", left: 0, top: 0 }}>
                      <circle cx="85" cy="85" r="70" fill="none" stroke="#1c2733" strokeWidth="14" />
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
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 46, fontWeight: 700, color: "#e8eef4", lineHeight: 1 }}>
                        {fAl}/7
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: "2px", color: "#93a1af" }}>
                        ALIGNED
                      </span>
                    </div>
                  </div>

                  {/* Ring Details */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "#5980a6" }}>
                        CONFLUENCE
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 600, color: "#e8eef4", marginTop: 4 }}>
                        {fAl} of 7 signals aligned
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "#5980a6" }}>
                        CONFIDENCE
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 700, color: "#e8eef4", lineHeight: 1, marginTop: 4 }}>
                        {fConf}
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: "#5d6b79" }}>
                          {" "}/ 100
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invalidation Conditions */}
              <div style={{ border: "1px solid rgba(127,168,208,0.45)", background: "rgba(12,17,24,0.9)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.14em", color: "#7fa8d0" }}>
                  WHAT WOULD INVALIDATE THIS THESIS?
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                  {stockDetail.invalid.map((iv, i) => (
                    <div key={i} style={{ border: "1px solid #1c2733", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 600, color: "#e8eef4" }}>{iv[0]}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#93a1af" }}>{iv[1]}</span>
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
            const fcfSeries = fmpQ.map((q) => (q.operatingCashFlow ?? q.netIncome ?? 0) / 1e9);
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
          const VV: [string, number, number, string][] = [
            ["P/E", +livePe.toFixed(1), semi ? 38.0 : stock.t === "PLTR" ? 160 : 22, "×"],
            ["Forward P/E", stock.fpe, semi ? 31.2 : stock.t === "PLTR" ? 128 : 16.8, "×"],
            ["EV/EBITDA", +(livePe * 0.85).toFixed(1), semi ? 29.4 : stock.t === "PLTR" ? 120 : 14.2, "×"],
            ["PEG", +(stock.fpe / Math.max(8, stock.eps)).toFixed(2), 1.45, ""],
            ["FCF Yield", +((100 / (livePe || 1)) * 0.95).toFixed(1), 2.6, "%"],
          ];
          const valRows = VV.map(([k, v, med, u]) => {
            const top = Math.max(v, med) * 1.25 || 1;
            return {
              k,
              v: v + u,
              med: med + u,
              w: ((v / top) * 100).toFixed(1) + "%",
              m: ((med / top) * 100).toFixed(1) + "%",
            };
          });

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* 6 Financial Metric Cards with 8-Quarter Mini-Bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {fundMetrics.map((fm, idx) => (
                  <div key={idx} style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", color: "#a9c6e3" }}>
                        {fm.k}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: fm.col }}>
                        {fm.yoy}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: "#e8eef4" }}>
                      {fm.last}
                    </div>
                    <div style={{ height: 80, display: "flex", alignItems: "flex-end", gap: 5, padding: "4px 0" }}>
                      {fm.bars.map((br, bIdx) => (
                        <div key={bIdx} style={{ flex: 1, height: br.h, background: br.c, transition: "height 300ms ease" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5d6b79" }}>
                      <span>{fm.q0}</span>
                      <span>{fm.q1}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Valuation & Peer Comparison Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 18, alignItems: "start" }}>
                {/* Valuation Multiples vs Peer Median */}
                <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                      VALUATION MULTIPLES
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#93a1af" }}>
                      ▮ {stock.t} &nbsp; ┃ Peer median
                    </span>
                  </div>
                  {valRows.map((vl, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, height: 34 }}>
                      <span style={{ width: 100, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "#e8eef4" }}>
                        {vl.k}
                      </span>
                      <div style={{ position: "relative", flex: 1, height: 10, background: "#1c2733" }}>
                        <div style={{ height: 10, width: vl.w, background: "#5980a6" }} />
                        <div style={{ position: "absolute", top: -4, left: vl.m, width: 2, height: 18, background: "#e8eef4", boxShadow: "0 0 6px rgba(255,255,255,0.4)" }} />
                      </div>
                      <span style={{ width: 62, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: "#e8eef4" }}>
                        {vl.v}
                      </span>
                      <span style={{ width: 62, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#93a1af" }}>
                        {vl.med}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Peer Comparison Table */}
                <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                    PEER COMPARISON
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "130px repeat(5, minmax(70px, 1fr))", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#5980a6", padding: "6px 0", borderBottom: "1px solid #1c2733" }}>
                    <span>TICKER</span>
                    <span style={{ textAlign: "right" }}>MKT CAP</span>
                    <span style={{ textAlign: "right" }}>FWD P/E</span>
                    <span style={{ textAlign: "right" }}>REV GR</span>
                    <span style={{ textAlign: "right" }}>GR MARGIN</span>
                    <span style={{ textAlign: "right" }}>EPS GR</span>
                  </div>
                  {ORDER.slice(0, 6).map((sym) => {
                    const sItem = STK[sym];
                    const isSelf = sym === stock.t;
                    return (
                      <div
                        key={sym}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "130px repeat(5, minmax(70px, 1fr))",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 13,
                          color: "#e8eef4",
                          padding: "9px 0",
                          borderBottom: "1px solid #1c2733",
                          background: isSelf ? "rgba(89,128,166,0.16)" : "transparent",
                          boxShadow: isSelf ? `inset 2px 0 0 ${STEEL}` : "none",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, paddingLeft: isSelf ? 6 : 0 }}>
                          <StockLogo sym={sym} size={18} />
                          {sym}
                        </span>
                        <span style={{ textAlign: "right" }}>{sItem.mcap}</span>
                        <span style={{ textAlign: "right" }}>{sItem.fpe}×</span>
                        <span style={{ textAlign: "right" }}>+{sItem.rev}%</span>
                        <span style={{ textAlign: "right" }}>72%</span>
                        <span style={{ textAlign: "right" }}>+{sItem.eps}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Fundamental Read with Evidence Toggle */}
              <div style={{ position: "relative", border: "1px solid #5980a6", background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                    ✦ AI FUNDAMENTALS READ
                  </span>
                  <div style={{ flex: 1, minWidth: 260, fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 500, color: "#e8eef4", lineHeight: 1.55 }}>
                    {stockDetail.fundTxt}
                  </div>
                  <button
                    onClick={() => setShowFundEv(!showFundEv)}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      border: "1px solid #5980a6",
                      background: "transparent",
                      color: "#a9c6e3",
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #1c2733", paddingTop: 12 }}>
                    {(stockDetail.fundEv || []).map((fe, i) => (
                      <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#c4d0dc", display: "flex", gap: 8, lineHeight: 1.45 }}>
                        <span style={{ color: "#7fa8d0" }}>▸</span>
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
            {/* Live Technical CandleChart Card (Matches MC Overview) */}
            <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "14px 16px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                  {stock.t} · LIVE TECHNICAL CHART
                </span>
                <VendorTag v="polygon" />
                <span className="cc-chip live" style={{ background: "rgba(74,222,128,0.15)", color: UP, padding: "2px 6px", fontSize: 11, borderRadius: 3, fontWeight: 600 }}>
                  LIVE
                </span>
              </div>

              <div style={{ minHeight: 480, width: "100%" }}>
                <CandleChart
                  sym={stock.t}
                  tf={barInterval}
                  interval={barInterval}
                  chartType={chartType.toLowerCase()}
                  realBars={realBars}
                  loading={barsLoading}
                  toolbarStart={
                    <>
                      <IntervalMenu value={barInterval} onChange={setBarInterval} />
                      <ChartSelect value={chartType} options={CHART_TYPE_OPTIONS} onChange={(v) => setChartType(v as typeof chartType)} title="Chart type" />
                      <button
                        className={`rng indbtn${showEarnings ? " on" : ""}`}
                        onClick={() => setShowEarnings((v) => !v)}
                        style={{ height: 28, padding: "0 10px", background: showEarnings ? "rgba(89,128,166,0.2)" : "transparent", border: "1px solid #2a3a4a", color: "#e8eef4", cursor: "pointer", fontSize: 12 }}
                      >
                        Earnings
                      </button>
                    </>
                  }
                  toolbarEnd={
                    <>
                      <VendorTag v="polygon" />
                      {realBars && <span className="cc-chip live" style={{ color: UP, fontSize: 11, marginLeft: 6 }}>live</span>}
                    </>
                  }
                  height={480}
                />
              </div>
            </div>

            {/* Technical Read & Key Levels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              {/* Technical Read */}
              <div style={{ position: "relative", border: "1px solid #5980a6", background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                  ✦ TECHNICAL READ
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                  {stockDetail.read.map((rd, i) => (
                    <div key={i} style={{ border: "1px solid #1c2733", padding: 10 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#5980a6" }}>
                        {rd.k}
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: rd.col, marginTop: 4 }}>
                        {rd.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "#d5dfe9", lineHeight: 1.55 }}>
                  Price trades above rising 50-day and 200-day moving averages with constructive consolidation following the last momentum breakout.
                </div>
              </div>

              {/* Key Levels */}
              <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4", marginBottom: 8 }}>
                  KEY SUPPORT & RESISTANCE LEVELS
                </span>
                {stockDetail.levels.map((lv, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #1c2733" }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "#93a1af" }}>{lv.k}</span>
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

          const now = Date.now();
          const calcDd = (dateStr: string) => {
            const t = new Date(dateStr).getTime();
            if (isNaN(t)) return 0;
            return Math.round((t - now) / (1000 * 60 * 60 * 24));
          };

          const fmtDateShort = (dateStr: string) => {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
          };

          // 1. EARNINGS (FMP Live Earnings Feed & Financials)
          const tickerEarnings = (liveEarningsList || []).filter(
            (e) => e.ticker.toUpperCase() === stock.t
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
          const tickerConsensus = (liveConsensusList || []).find(
            (c) => c.ticker.toUpperCase() === stock.t
          );
          if (tickerConsensus?.recentGrades && tickerConsensus.recentGrades.length > 0) {
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
                note: `${g.previousGrade ? `Prior: ${g.previousGrade}. ` : ""}${g.previousPriceTarget ? `Prior target: $${g.previousPriceTarget}. ` : ""}Consensus: ${tickerConsensus.consensus || "Hold"} (${tickerConsensus.buy + tickerConsensus.strongBuy} Buys).`,
                imp: "MED",
                dir,
                dd,
                sourceBadge: "FMP",
              });
            });
          }

          // 3. INSIDER ACTIVITY (FMP SEC Form 4 Filings)
          const tickerInsiders = (liveInsiderList || []).filter(
            (i) => i.ticker.toUpperCase() === stock.t
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
          if (inst13FData?.holders && inst13FData.holders.length > 0) {
            const topDate = inst13FData.holders[0]?.filingDate || inst13FData.holders[0]?.reportDate || "2024-11-14";
            liveCatalystItems.push({
              date: fmtDateShort(topDate),
              cat: "13F filings",
              ev: `${inst13FData.selectedQuarter || "Quarterly"} 13F Institutional Filing Sweep: ${inst13FData.summary.totalHolders} Filers`,
              note: `${inst13FData.summary.increasedPositions} increased, ${inst13FData.summary.reducedPositions} reduced, ${inst13FData.summary.newPositions} opened new positions ($${(inst13FData.summary.totalMarketValue / 1e9).toFixed(1)}B total institutional value).`,
              imp: "HIGH",
              dir: inst13FData.summary.increasedPositions >= inst13FData.summary.reducedPositions ? "Positive" : "Neutral",
              dd: calcDd(topDate),
              sourceBadge: "13F FMP",
            });
            inst13FData.holders.slice(0, 5).forEach((h) => {
              const hDate = h.filingDate || h.reportDate || topDate;
              liveCatalystItems.push({
                date: fmtDateShort(hDate),
                cat: "13F filings",
                ev: `${h.investorName} ${h.activityStatus} ${Math.abs(h.changeInShares).toLocaleString()} shares`,
                note: `Holds ${h.sharesNumber.toLocaleString()} shares (${h.marketValue ? '$' + (h.marketValue / 1e6).toFixed(1) + 'M' : '—'}) · ${h.ownershipPct ? h.ownershipPct.toFixed(2) + '% of company' : 'Institutional position'}`,
                imp: "MED",
                dir: h.activityStatus === "Increased" || h.activityStatus === "New" ? "Positive" : h.activityStatus === "Reduced" ? "Risk" : "Neutral",
                dd: calcDd(hDate),
                sourceBadge: "13F SEC",
              });
            });
          }

          // 5. NEWS, PRODUCT LAUNCHES, REGULATORY (Polygon / Finnhub / FMP)
          (tickerNews || []).slice(0, 12).forEach((art) => {
            const dd = calcDd(art.publishedAt);
            let cat = "News";
            if (art.tag === "product" || art.headline.toLowerCase().includes("launch") || art.headline.toLowerCase().includes("unveil")) {
              cat = "Product launches";
            } else if (art.tag === "legal" || art.headline.toLowerCase().includes("fda") || art.headline.toLowerCase().includes("sec") || art.headline.toLowerCase().includes("antitrust")) {
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

          // 6. MACRO & SCHEDULED CORPORATE EVENTS (Calendar baseline)
          const baseEvents: typeof liveCatalystItems = [
            { date: "Oct 2", cat: "Macro", ev: "Weak September payrolls ease rate-hike fears", note: "29K jobs vs 85K expected; growth stocks rallied.", imp: "MED", dir: "Positive", dd: -5, sourceBadge: "MACRO" },
            { date: "Oct 25", cat: "Macro", ev: "Monthly options expiration (OpEx)", note: `Open interest clustered near ${usd(Math.round(stock.p * 1.04))}.`, imp: "LOW", dir: "Neutral", dd: 18, sourceBadge: "CALENDAR" },
            { date: "Oct 29", cat: "Macro", ev: "FOMC interest rate decision & press conference", note: "Rate-sensitive growth names most exposed.", imp: "HIGH", dir: "Risk", dd: 22, sourceBadge: "FED" },
            { date: "Oct 12", cat: "Industry events", ev: semi || stock.t === "PLTR" ? "AI Infrastructure Global Keynote" : `${stock.t} Investor Day & Tech Showcase`, note: "Product roadmap and partner announcements expected.", imp: "MED", dir: "Positive", dd: 5, sourceBadge: "EVENTS" },
            { date: "Oct 14", cat: "Product launches", ev: `${stock.t} Next-Gen Platform Delivery & Ramp Update`, note: "Commercial shipping timeline and capacity availability.", imp: "MED", dir: "Positive", dd: 7, sourceBadge: "IR" },
            { date: "Oct 9", cat: "Regulatory", ev: semi ? "Commerce Dept. export control assessment update" : "Global regulatory compliance review milestone", note: "Regional trade rules and cross-border operational oversight.", imp: "HIGH", dir: "Risk", dd: 2, sourceBadge: "REGULATORY" },
          ];

          // Supplement with baseline items if no specific live rows are loaded
          if (!tickerEarnings.length) {
            baseEvents.push({
              date: "Oct 21",
              cat: "Earnings",
              ev: `Q3 earnings · consensus EPS $${(stock.p / stock.fpe / 4).toFixed(2)}`,
              note: `Implied move ±${(5 + stock.conf / 20).toFixed(1)}%; guidance matters more than the print.`,
              imp: "HIGH",
              dir: "Binary",
              dd: 14,
              sourceBadge: "CALENDAR",
            });
          }
          if (!tickerConsensus?.recentGrades?.length) {
            baseEvents.push({
              date: "Sep 24",
              cat: "Analyst actions",
              ev: `Wall Street raises ${stock.t} target to ${usd(Math.round(stock.p * 1.17))}`,
              note: "Overweight reiterated; cites demand visibility into 2027.",
              imp: "MED",
              dir: "Positive",
              dd: -13,
              sourceBadge: "CONSENSUS",
            });
          }
          if (!tickerInsiders.length) {
            baseEvents.push({
              date: "Sep 30",
              cat: "Insider activity",
              ev: "Director sells shares (10b5-1 pre-scheduled plan)",
              note: "Pre-scheduled sale; < 0.1% of holdings.",
              imp: "LOW",
              dir: "Neutral",
              dd: -7,
              sourceBadge: "SEC FORM 4",
            });
          }
          if (!inst13FData?.holders?.length) {
            baseEvents.push(
              { date: "Aug 14", cat: "13F filings", ev: `Q2 13F: institutions added ${stock.t} on net`, note: "Top filers increased stakes; ownership concentration rose.", imp: "MED", dir: "Positive", dd: -54, sourceBadge: "13F SEC" },
              { date: "Nov 14", cat: "13F filings", ev: "Q3 13F filing deadline", note: `First look at how funds positioned in ${stock.t} through September.`, imp: "MED", dir: "Neutral", dd: 38, sourceBadge: "SEC DEADLINE" }
            );
          }

          const combined = [...liveCatalystItems, ...baseEvents];
          combined.sort((a, b) => a.dd - b.dd);

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
                        color: isSelected ? "#e8eef4" : "#93a1af",
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
                      background: "rgba(12,17,24,0.9)",
                      padding: "16px 20px",
                      display: "grid",
                      gridTemplateColumns: "140px 1fr auto",
                      gap: 18,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#e8eef4" }}>
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
                            color: "#a9c6e3",
                            border: "1px solid #2a3a4a",
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
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "#e8eef4" }}>
                          {cItem.ev}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#93a1af", marginTop: 4 }}>
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
                  <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed #2a3a4a", color: "#93a1af", fontFamily: "'Manrope', sans-serif", fontSize: 14 }}>
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
            <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", display: "flex", flexDirection: "column", minHeight: 560 }}>
              <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: "1px solid #1c2733" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                  ✦ AI RESEARCH COPILOT
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#93a1af", border: "1px solid #2a3a4a", padding: "2px 8px" }}>
                  CONTEXT · {stock.t} · {stock.setup}
                </span>
              </div>
              <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {aiAnalysisDoc?.analysis && (
                  <div style={{ border: "1px solid rgba(127,168,208,0.25)", background: "rgba(12,17,24,0.6)", padding: "14px 16px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4ade80", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.1)", padding: "1px 6px" }}>
                        MC AI SYNTHESIS · {aiAnalysisDoc.model || "GEMINI"}
                      </span>
                      {aiAnalysisDoc.analysis.headline && (
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: "#e8eef4" }}>
                          {aiAnalysisDoc.analysis.headline}
                        </span>
                      )}
                    </div>
                    {aiAnalysisDoc.analysis.newsSummary && (
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "#93a1af", lineHeight: 1.5, marginBottom: 6 }}>
                        {aiAnalysisDoc.analysis.newsSummary}
                      </div>
                    )}
                    {aiAnalysisDoc.analysis.technicalSummary && (
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#7fa8d0", lineHeight: 1.4 }}>
                        {aiAnalysisDoc.analysis.technicalSummary}
                      </div>
                    )}
                  </div>
                )}
                {aiChat.length === 0 && !aiAnalysisDoc?.analysis && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "#93a1af", lineHeight: 1.6 }}>
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
                      color: "#e8eef4",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text}
                  </div>
                ))}
                {aiBusy && (
                  <div style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#7fa8d0" }}>
                    Synthesizing research on {stock.t}…
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid #1c2733", padding: 12, display: "flex", gap: 8 }}>
                <input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                  placeholder={`Ask about ${stock.t}…`}
                  style={{
                    flex: 1,
                    height: 42,
                    background: "#080b10",
                    border: "1px solid #2a3a4a",
                    color: "#e8eef4",
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
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: "#5980a6" }}>
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
                    border: "1px solid #1c2733",
                    background: "rgba(12,17,24,0.9)",
                    padding: 14,
                    color: "#e8eef4",
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

          // Market history chart for normal mode
          const [hN, hV0, hD0] = rangesDef[thHz] || rangesDef["6M"];
          const hs = series(stock.t + "hist" + thHz, hN, stock.p, hV0, hD0);
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
                  border: "1px solid #1c2733",
                  background: "rgba(12,17,24,0.9)",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 230 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "#5980a6" }}>
                    THESIS LAB · {stock.t}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: "#e8eef4", marginTop: 4 }}>
                    {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} THESIS
                  </div>
                </div>

                {/* Mode Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5980a6", marginBottom: 6 }}>
                    MODE
                  </div>
                  <div style={{ display: "flex", border: "1px solid #2a3a4a", padding: 3, gap: 3 }}>
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
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5980a6", marginBottom: 6 }}>
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
                            color: isActive ? "#e8eef4" : "#93a1af",
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
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5980a6", marginBottom: 6 }}>
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
                            color: isActive ? "#e8eef4" : "#93a1af",
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5980a6", marginBottom: 6 }}>
                    <span>DRIVER WEIGHTS</span>
                    <span style={{ color: "#93a1af", letterSpacing: "0.04em" }}>
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
                          color: "#d5dfe9",
                          transition: "flex-grow 300ms ease",
                        }}
                      >
                        <span style={{ color: "#93a1af" }}>{c.k}</span>
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
                  <div style={{ position: "relative", border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                        MARKET HISTORY
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", color: "#93a1af" }}>
                        LAST {labHz === "12M" ? "12 MONTHS" : labHz}
                      </span>
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
                        <span style={{ position: "absolute", right: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#4ade80", background: "#0c1118", padding: "1px 6px" }}>
                          TARGET {usd(tgtV)}
                        </span>
                      </div>

                      {/* Invalidation dashed line */}
                      <div style={{ position: "absolute", left: 0, right: 0, top: stopYPct, borderTop: "1px dashed #f05656" }}>
                        <span style={{ position: "absolute", left: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#f05656", background: "#0c1118", padding: "1px 6px" }}>
                          INVALIDATION {usd(stopV)}
                        </span>
                      </div>

                      {/* Current price glowing dot */}
                      <div style={{ position: "absolute", right: -4, top: nowYPct, width: 8, height: 8, marginTop: -4, borderRadius: 99, background: "#e8eef4", boxShadow: "0 0 10px rgba(232,238,244,0.6)" }} />
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", borderTop: "1px solid #1c2733", borderLeft: "1px solid #1c2733" }}>
                      {[
                        ["RETURN", pct1(hsRet), hsRet >= 0 ? UP : DN],
                        ["HIGH", usd(Math.max(...hs)), "#e8eef4"],
                        ["LOW", usd(Math.min(...hs)), "#e8eef4"],
                        ["MAX DRAWDOWN", pct1(hsDD * 100), DN],
                        ["VOLATILITY", Math.round(hsVolA) + "% ann.", "#e8eef4"],
                      ].map(([k, v, c], idx) => (
                        <div key={idx} style={{ padding: "10px 12px", borderRight: "1px solid #1c2733", borderBottom: "1px solid #1c2733" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>
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
                    <div style={{ position: "relative", border: "1px solid #5980a6", background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                            THESIS CONFIDENCE
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 56, fontWeight: 700, lineHeight: 0.9, color: "#e8eef4" }}>
                              {thConf}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: "#5d6b79" }}>
                              / 100
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: thBand[1] }}>
                            {thBand[0]}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#93a1af", marginTop: 4 }}>
                            CORE INTACT <span style={{ color: thRun.coreOk === thRun.core.length ? UP : "#f5b031" }}>{thRun.coreOk} / {thRun.core.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 8, background: "#1c2733" }}>
                        <div style={{ height: 8, width: `${thConf}%`, background: thBand[1], transition: "width 400ms ease" }} />
                      </div>

                      {thAtRisk && (
                        <div style={{ border: "1px solid rgba(240,86,86,0.5)", background: "rgba(240,86,86,0.08)", padding: "10px 12px", fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2", lineHeight: 1.45 }}>
                          ◆ Critical driver failing: {thRun.critFail.map((d: any) => d.name).join(", ")}. The thesis is flagged AT RISK even though the aggregate score is {thConf}.
                        </div>
                      )}

                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "#d5dfe9", lineHeight: 1.55 }}>
                        {thBull ? "Bullish" : "Bearish"} because {thStrong.map((d: any) => `${d.name} (${d.val})`).join(", ")} carry the most weight in the {labHz} profile.
                      </div>
                    </div>

                    {/* Weights Breakdown Accordion */}
                    <div style={{ position: "relative", border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                          WEIGHTS
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: labWeightsState ? "#f5b031" : STEEL, border: `1px solid ${labWeightsState ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {labWeightsState ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}
                        </span>
                      </div>

                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#93a1af", lineHeight: 1.45 }}>
                        {labHz === "1M" ? "Short horizon — price action, catalysts and positioning carry the most weight." : labHz === "12M" ? "Long horizon — business quality and valuation carry the most weight." : "Balanced 3–6 month horizon — fundamentals and revisions lead, confirmed by price action."}
                      </div>

                      {thRun.cats.map((c: any) => {
                        const isOpen = expandedLabDrivers[c.k];
                        const top = c.ds.slice().sort((a: any, b: any) => (b.share || 0) - (a.share || 0))[0];
                        return (
                          <div key={c.k} style={{ borderBottom: "1px solid #1c2733" }}>
                            <div
                              onClick={() => setExpandedLabDrivers((prev) => ({ ...prev, [c.k]: !prev[c.k] }))}
                              style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 44px 34px 14px", alignItems: "center", gap: 12, padding: "7px 0", cursor: "pointer" }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "#e8eef4" }}>
                                  {c.label}
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#7d8b99", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {top ? `${top.name} · ${top.val}` : "—"}
                                </div>
                              </div>
                              <div style={{ height: 6, background: "#1c2733" }}>
                                <div style={{ height: 6, width: `${(c.w / 30) * 100}%`, background: "#5980a6", transition: "width 300ms ease" }} />
                              </div>
                              <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: "#e8eef4" }}>
                                {Math.round(c.w)}%
                              </span>
                              <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: thEvCol(c.score) }}>
                                {Math.round(c.score)}
                              </span>
                              <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "#5980a6", fontSize: 12 }}>
                                ▼
                              </span>
                            </div>

                            {isOpen && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "6px 0 4px 0", borderLeft: "1px solid #2a3a4a", paddingLeft: 12 }}>
                                {c.ds.map((xd: any, xidx: number) => (
                                  <div key={xidx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #141d27" }}>
                                    <span style={{ width: 58, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, color: xd.core ? "#a9c6e3" : "#7d8b99", border: "1px solid #2a3a4a", padding: "2px 0" }}>
                                      {xd.core ? "CORE" : "CONFIRM"}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 120 }}>
                                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "#e8eef4", display: "flex", gap: 6, alignItems: "center" }}>
                                        <span>{xd.name}</span>
                                        {xd.crit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "#f5b031" }}>◆ CRITICAL</span>}
                                      </div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#7d8b99", marginTop: 1 }}>
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

                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5d6b79", marginTop: 4 }}>
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
                  <div style={{ position: "relative", border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                        EDIT WEIGHTS
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: labWeightsState ? "#f5b031" : STEEL, border: `1px solid ${labWeightsState ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                        {labWeightsState ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}
                      </span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "#93a1af" }}>
                        Drag to set relative importance — automatically normalized to 100%.
                      </span>
                      <button
                        onClick={() => setLabWeightsState(null)}
                        style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid #2a3a4a", background: "transparent", color: "#a9c6e3", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
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
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "#d5dfe9", marginBottom: 4 }}>
                              <span>{label}</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8eef4" }}>{pctVal}%</span>
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
                  <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)" }}>
                    <div style={{ height: 50, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", borderBottom: "1px solid #1c2733" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                        THESIS ENGINE · DRIVER EVIDENCE
                      </span>
                      <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7d8b99" }}>
                        <span style={{ border: "1px solid #5980a6", color: "#a9c6e3", padding: "2px 6px" }}>CORE</span>
                        <span style={{ border: "1px solid #2a3a4a", padding: "2px 6px" }}>CONFIRM</span>
                        <span style={{ color: "#f5b031" }}>◆ CRITICAL</span>
                      </span>
                    </div>

                    {thRun.cats.map((c: any) => (
                      <div key={c.k} style={{ borderBottom: "1px solid #1c2733" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px 8px" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", color: "#e8eef4", flex: 1 }}>
                            {c.label}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#93a1af" }}>
                            WEIGHT {Math.round(c.w)}%
                          </span>
                          <div style={{ width: 120, height: 6, background: "#1c2733" }}>
                            <div style={{ height: 6, width: `${c.score}%`, background: thEvCol(c.score), transition: "width 300ms ease" }} />
                          </div>
                          <span style={{ width: 30, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: thEvCol(c.score) }}>
                            {Math.round(c.score)}
                          </span>
                          <span style={{ width: 66, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#a9c6e3" }}>
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
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "#e8eef4" }}>
                                  <span>{dv.name}</span>
                                  {dv.crit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: bad ? DN : "#f5b031" }}>◆ CRITICAL</span>}
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#7d8b99", marginTop: 2 }}>
                                  {dv.val}
                                </div>
                              </div>
                              <div style={{ width: "clamp(40px,10%,110px)", flex: "none", height: 4, background: "#1c2733" }}>
                                <div style={{ height: 4, width: `${dv.ev}%`, background: thEvCol(dv.ev), transition: "width 300ms ease" }} />
                              </div>
                              <span style={{ width: 28, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: thEvCol(dv.ev) }}>
                                {Math.round(dv.ev)}
                              </span>
                              <span style={{ width: 52, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#93a1af" }}>
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
                    <div style={{ position: "relative", border: "1px solid #5980a6", background: "linear-gradient(180deg, rgba(89,128,166,0.14), rgba(12,17,24,0.92))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                            THESIS CONFIDENCE
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 64, fontWeight: 700, lineHeight: 0.9, color: "#e8eef4" }}>
                              {thConf}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, color: "#5d6b79" }}>
                              / 100
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: thBand[1] }}>
                            {thBand[0]}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#93a1af", marginTop: 4 }}>
                            CORE INTACT <span style={{ color: thRun.coreOk === thRun.core.length ? UP : "#f5b031" }}>{thRun.coreOk} / {thRun.core.length}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 8, background: "#1c2733" }}>
                        <div style={{ height: 8, width: `${thConf}%`, background: thBand[1], transition: "width 400ms ease" }} />
                      </div>

                      {thAtRisk && (
                        <div style={{ border: "1px solid rgba(240,86,86,0.5)", background: "rgba(240,86,86,0.08)", padding: "10px 12px", fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2", lineHeight: 1.45 }}>
                          ◆ Critical driver failing: {thRun.critFail.map((d: any) => d.name).join(", ")}.
                        </div>
                      )}

                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "#d5dfe9", lineHeight: 1.55 }}>
                        {thBull ? "Bullish" : "Bearish"} because {thStrong.map((d: any) => `${d.name} (${d.val})`).join(", ")} carry the most weight in the {labHz} profile.
                      </div>

                      {/* Strongest & Weakest */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#4ade80", marginBottom: 6 }}>
                            STRONGEST
                          </div>
                          {thStrong.map((sg: any, idx: number) => (
                            <div key={idx} style={{ padding: "5px 0", borderBottom: "1px solid #1c2733" }}>
                              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "#e8eef4", lineHeight: 1.3 }}>{sg.name}</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#93a1af" }}>{sg.val} · +{sg.pts.toFixed(1)} pts</div>
                            </div>
                          ))}
                        </div>

                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#f5b031", marginBottom: 6 }}>
                            WEAKEST
                          </div>
                          {thWeak.map((wk: any, idx: number) => (
                            <div key={idx} style={{ padding: "5px 0", borderBottom: "1px solid #1c2733" }}>
                              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "#e8eef4", lineHeight: 1.3 }}>{wk.name}</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: thEvCol(wk.ev) }}>{wk.val} · ev {Math.round(wk.ev)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* What changed */}
                      <div style={{ borderTop: "1px solid #1c2733", paddingTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#5980a6" }}>
                          <span>WHAT CHANGED</span>
                          <span style={{ color: dConf > 0 ? UP : dConf < 0 ? "#f5b031" : "#93a1af" }}>
                            {dConf >= 0 ? "+" : ""}{dConf} vs last week
                          </span>
                        </div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#c5d0db", marginTop: 6, lineHeight: 1.45 }}>
                          {thMover.length > 0 ? thMover.map((d: any) => `${d.name} ${d.dd > 0 ? "strengthened" : "weakened"} (${d.dd > 0 ? "+" : ""}${d.dd})`).join(" · ") : "No material driver change this week."}
                        </div>
                      </div>
                    </div>

                    {/* Price Target & Overrides */}
                    <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                          PRICE TARGET
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: targetOverride != null ? "#f5b031" : STEEL, border: `1px solid ${targetOverride != null ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {targetOverride != null ? "OVERRIDDEN" : "SUGGESTED"}
                        </span>
                        <button
                          onClick={() => setLabEditTargets(!labEditTargets)}
                          style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid #2a3a4a", background: "transparent", color: "#a9c6e3", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {labEditTargets ? "Done" : "Edit / Override"}
                        </button>
                      </div>

                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, color: "#e8eef4", lineHeight: 1 }}>
                        {usd(tgtV)}
                      </div>

                      {/* Marks track bar */}
                      <div style={{ position: "relative", height: 56, margin: "4px 6px 0" }}>
                        <div style={{ position: "absolute", left: 0, right: 0, top: 26, height: 2, background: "#1c2733" }} />
                        <div style={{ position: "absolute", top: 18, left: thPos(stopV), width: 2, height: 18, background: "#f05656" }} />
                        <div style={{ position: "absolute", top: 16, left: thPos(tgtV), width: 12, height: 12, marginLeft: -5, border: "2px solid #e8eef4", background: "#080b10", transform: "rotate(45deg)", transition: "left 300ms ease" }} />

                        {[
                          ["BEAR", TT.dn, DN],
                          ["NOW", stock.p, "#e8eef4"],
                          ["BASE", TT.base, STEEL],
                          ["BULL", TT.up, UP],
                        ].map(([k, v, c], idx) => (
                          <div key={idx} style={{ position: "absolute", top: 0, left: thPos(v as number), transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: c as string }}>{k}</span>
                            <span style={{ width: 1, height: 14, background: c as string, marginTop: 2 }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "#93a1af", marginTop: 16 }}>{usd(v as number)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Evidence sources */}
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#5980a6", marginBottom: 4 }}>
                          EVIDENCE SOURCES
                        </div>
                        {TT.src.map((sr: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #1c2733" }}>
                            <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "#e8eef4" }}>
                              {sr[0]} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#7d8b99" }}>· {sr[1]}</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "#a9c6e3" }}>
                              {usd(sr[2])}
                            </span>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
                          <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "#e8eef4" }}>
                            Estimate-revision adjustment
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "#a9c6e3" }}>
                            {pct1(TT.revAdj * 100)}
                          </span>
                        </div>
                      </div>

                      {labEditTargets && (
                        <div style={{ borderTop: "1px solid #1c2733", paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5980a6", marginBottom: 6 }}>
                              <span>OVERRIDE TARGET · SUGGESTED {usd(TT.target)}</span>
                              <span style={{ color: "#e8eef4" }}>{usd(tgtV)}</span>
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
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5980a6", marginBottom: 6 }}>
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
                            style={{ alignSelf: "flex-start", height: 28, padding: "0 10px", border: "1px solid #2a3a4a", background: "transparent", color: "#93a1af", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Reset to suggested
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Invalidation Rules */}
                    <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4" }}>
                          INVALIDATION
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: stopOverride != null ? "#f5b031" : STEEL, border: `1px solid ${stopOverride != null ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {stopOverride != null ? "OVERRIDDEN" : "SUGGESTED"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #1c2733" }}>
                        <span style={{ width: 84, flex: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#f05656", paddingTop: 3 }}>
                          PRICE
                        </span>
                        <div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "#e8eef4" }}>
                            Daily close {thBull ? "below" : "above"} {usd(stopV)}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#7d8b99", marginTop: 2 }}>
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
                            <div key={rIdx} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "#e8eef4" }}>
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
                  background: "rgba(12,17,24,0.95)",
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.16em", color: "#a9c6e3" }}>
                    THESIS CARD
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#e8eef4" }}>
                    {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} THESIS
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid #1c2733", borderLeft: "1px solid #1c2733" }}>
                  {[
                    ["TARGET", usd(tgtV), thBull ? UP : DN],
                    ["INVALIDATION", usd(stopV), DN],
                    ["UPSIDE", pct1(thUp), UP],
                    ["DOWNSIDE", pct1(thDn), DN],
                    ["REWARD / RISK", thRR.toFixed(1) + "×", thRR >= 2 ? UP : thRR >= 1.2 ? "#f5b031" : DN],
                    ["THESIS CONFIDENCE", `${thConf} / 100`, thBand[1]],
                    ["CORE DRIVERS INTACT", `${thRun.coreOk} of ${thRun.core.length}`, thRun.coreOk === thRun.core.length ? UP : "#f5b031"],
                  ].map(([k, v, c], idx) => (
                    <div key={idx} style={{ padding: "12px 14px", borderRight: "1px solid #1c2733", borderBottom: "1px solid #1c2733" }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>{k}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: c as string, marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                  <div style={{ border: "1px solid #1c2733", padding: "12px 14px" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>KEY CATALYST</div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "#e8eef4", marginTop: 6 }}>{TPt.cat}</div>
                  </div>
                  <div style={{ border: "1px solid #1c2733", padding: "12px 14px" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#f5b031" }}>BIGGEST RISK</div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "#e8eef4", marginTop: 6 }}>{TPt.risk}</div>
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
                    } catch {}
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
                  Save & Monitor Thesis →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ====================================================
            TAB 9: THESIS MONITOR (Issue 7: Full Monitored View)
            ==================================================== */}
        {activeTab === "mon" && (() => {
          if (!savedThesis) {
            return (
              <div style={{ border: "1px dashed #2a3a4a", padding: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: "0.08em", color: "#e8eef4" }}>
                  NO THESIS MONITORED FOR {stock.t}
                </span>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "#93a1af" }}>
                  Build one in Thesis Lab and SI will track every driver for you.
                </span>
                <button
                  onClick={() => setActiveTab("lab")}
                  style={{ height: 42, padding: "0 18px", border: "none", background: "#5980a6", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Open Thesis Lab
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
              <div style={{ position: "relative", border: `1px solid ${monCol}`, background: "rgba(12,17,24,0.9)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, transition: "border-color 300ms" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 22, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "#5980a6" }}>
                      MONITORED THESIS · SAVED {savedThesis.savedDate.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "#e8eef4", marginTop: 6 }}>
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
                        style={{ height: 30, padding: "0 12px", border: "1px solid #2a3a4a", background: "transparent", color: "#a9c6e3", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit in Thesis Lab
                      </button>

                      {confirmDeleteThesis ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2" }}>
                            Delete thesis?
                          </span>
                          <button
                            onClick={() => {
                              setSavedThesis(null);
                              try {
                                localStorage.removeItem(`si_thesis_${stock.t}`);
                              } catch {}
                              setConfirmDeleteThesis(false);
                            }}
                            style={{ height: 30, padding: "0 12px", border: "none", background: "#f05656", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteThesis(false)}
                            style={{ height: 30, padding: "0 12px", border: "1px solid #2a3a4a", background: "transparent", color: "#93a1af", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
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
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "#5980a6" }}>STATUS</div>
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
                          color: isCurrent ? "#e8eef4" : "#5d6b79",
                          transition: "all 250ms",
                        }}
                      >
                        {k}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5980a6" }}>CHANGED BY</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, color: "#e8eef4" }}>{monBy}</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "#c5d0db" }}>{monCause}</span>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid #1c2733", borderLeft: "1px solid #1c2733" }}>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #1c2733", borderBottom: "1px solid #1c2733" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>CONFIDENCE AT SAVE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eef4" }}>{savedThesis.confAtSave}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #1c2733", borderBottom: "1px solid #1c2733" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>CONFIDENCE NOW</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eef4" }}>
                      {Math.round(monRun.conf)}{" "}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: monDelta > 0 ? UP : monDelta < 0 ? "#f5b031" : "#93a1af" }}>
                        ({monDelta >= 0 ? "+" : ""}{Math.round(monDelta)})
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #1c2733", borderBottom: "1px solid #1c2733" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>CORE DRIVERS INTACT</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eef4" }}>{monRun.coreOk} / {monRun.core.length}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #1c2733", borderBottom: "1px solid #1c2733" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5980a6" }}>PRICE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eef4" }}>{usd(monPx)}</div>
                  </div>
                </div>

                {/* Simulate Scenarios Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5980a6", marginRight: 4 }}>
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
                          color: isCur ? "#e8eef4" : "#93a1af",
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
                <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4", flex: 1 }}>
                      DRIVER TRACKING
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#5d6b79", width: 46, textAlign: "right" }}>SAVED</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#5d6b79", width: 46, textAlign: "right" }}>NOW</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#5d6b79", width: 42, textAlign: "right" }}>Δ</span>
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
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #1c2733" }}>
                        <span style={{ width: 62, flex: "none", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: d.core ? "#a9c6e3" : "#7d8b99", border: "1px solid #2a3a4a", padding: "2px 0" }}>
                          {d.core ? "CORE" : "CONFIRM"}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "#e8eef4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {d.name}
                        </span>
                        <span style={{ width: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#93a1af" }}>
                          {was}
                        </span>
                        <span style={{ width: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "#e8eef4" }}>
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
                  <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4", marginBottom: 12 }}>
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
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #1c2733" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: fc.c, boxShadow: `0 0 8px ${fc.c}` }} />
                        <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "#e8eef4" }}>
                          {fc.k}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: fc.c }}>
                          {fc.st}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Alert Log */}
                  <div style={{ border: "1px solid #1c2733", background: "rgba(12,17,24,0.9)", padding: "18px 20px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "#e8eef4", marginBottom: 12 }}>
                      ALERT LOG
                    </div>
                    {[
                      ["Now", `Status → ${monStatus}. ${monCause}`],
                      ["Today 13:40", `${monRun.drv[0]?.name}: evidence holding above threshold.`],
                      ["Today 10:15", `Market regime check: constructive liquidity environment.`],
                      [savedThesis.savedDate, `Thesis saved · confidence ${savedThesis.confAtSave} · target ${usd(savedThesis.target)} · invalidation ${usd(savedThesis.stop)}.`],
                    ].map(([tt, m], i) => (
                      <div key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #1c2733" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#5980a6", width: 88, flex: "none" }}>
                          {tt}
                        </span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "#d5dfe9", lineHeight: 1.45 }}>
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
    </div>
  );
}
