"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  computeStockSession,
  computeSectorFlows,
  computeCandles,
  computeTfCandles,
  computeConfidence,
  computeDollarFlow,
  computeSquarifiedTiles,
  formatCurrency,
  formatPct,
  formatCompactDollars,
  type StockSession,
  type SectorFlowItem,
  type TileLayout,
} from "../money-flow/engine";
import {
  SparklineSvg,
  MiniProfileSvg,
  FullChartSvg,
} from "../money-flow/chart-svg";
import { SP500_TICKERS } from "../money-flow/data";
import { useLiveQuotes } from "../live-quotes-context";
import { useIQActions } from "../shell";
import { ModuleSwitcher } from "../module-switcher";
import { useSI } from "../si/si-context";
import { useBackendMarketStatus } from "../hooks/useBackendMarketStatus";
import { useAppSelector } from "../../store/hooks";
import { useApiList } from "../hooks/useApiList";
import { useTapeStream } from "../hooks/useTapeStream";
import { tapeItemsToIndexDocs } from "../live-market-indices";
import type { CompanyDoc } from "../types/companies";
import { VendorTag, type VendorKey } from "../utils";
import type { CompanyMarketData } from "../money-flow/engine";

export function MoneyFlowScreen() {
  const { openStock, openIndex } = useIQActions();
  const { exitToMC, enterSI } = useSI();
  const liveQuotesMap = useLiveQuotes(SP500_TICKERS);

  // Live FMP company data for accurate Support, Resistance and Market Cap
  const { data: companies } = useApiList<CompanyDoc>("/market-data/companies", 15_000);
  const companyMap = useMemo(() => {
    const m = new Map<string, CompanyMarketData>();
    for (const c of companies) {
      if (c.ticker) {
        m.set(c.ticker.toUpperCase(), {
          marketCap: c.marketCap,
          price: c.price,
          pctChange: c.pctChange,
          rvol: c.rvol ?? null,
          dayVolume: c.dayVolume ?? null,
          keyLevels: c.keyLevels,
        });
      }
    }
    return m;
  }, [companies]);

  // User info for topbar avatar
  const user = useAppSelector((s) => s.auth.user);
  const initials = user?.displayName
    ? user.displayName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "D";

  // Real-time market status and ET clock
  const mkt = useBackendMarketStatus();
  const [navTime, setNavTime] = useState(() => {
    const d = new Date();
    const day = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
    return { day, time };
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNavTime({
        day: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "America/New_York",
        }),
        time: d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        }),
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Selected sector filter (click to isolate)
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  // Hovered sector state (for darkening / highlighting other sectors like HTML)
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  // Glossary drawer open/close
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  // Hover state for detail popover
  const [hoveredStock, setHoveredStock] = useState<{
    stock: StockSession;
    rect: DOMRect;
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Chart options in popover
  const [popTf, setPopTf] = useState<number>(5);
  const [popLayers, setPopLayers] = useState({
    ob: true,
    vwap: true,
    fvg: false,
    liq: false,
    str: false,
  });

  // Current session progress (0 to 1 across 390 trading minutes)
  const [progress, setProgress] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const now = new Date();
      // Estimate ET time
      const utcHours = now.getUTCHours();
      const utcMins = now.getUTCMinutes();
      const etTotalMins = (utcHours - 4) * 60 + utcMins;
      const marketOpenMins = 9 * 60 + 30; // 9:30 AM ET
      const marketCloseMins = 16 * 60; // 4:00 PM ET
      if (etTotalMins <= marketOpenMins) return 0.15;
      if (etTotalMins >= marketCloseMins) return 1.0;
      return Math.max(0.05, Math.min(1.0, (etTotalMins - marketOpenMins) / 390));
    }
    return 0.85;
  });

  // Re-run session calculation whenever progress, live quotes, or company data change
  const allStocks = useMemo(() => {
    const raw = computeStockSession(progress, companyMap);
    // Enrich with live quotes when available
    return raw.map((s) => {
      const q = liveQuotesMap.get(s.t);
      if (q && q.price != null && q.pctChange != null) {
        return {
          ...s,
          px: q.price,
          mv: q.pctChange,
          bull: q.pctChange > 0,
        };
      }
      return s;
    });
  }, [progress, liveQuotesMap, companyMap]);

  // Sector calculations
  const sectorData = useMemo(() => {
    return computeSectorFlows(allStocks);
  }, [allStocks]);

  // Sector averages for Relative Strength
  const secAverages = useMemo(() => {
    const m: Record<string, number> = {};
    sectorData.sectors.forEach((s) => {
      m[s.name] = s.avgPct;
    });
    return m;
  }, [sectorData]);

  // Active sector to highlight: either hovered or selected
  const activeSector = hoveredSector || selectedSector;

  // Rank 15 Bullish and 15 Bearish (overall market top 15 gainers & losers)
  const { top3Bull, next12Bull, top3Bear, next12Bear, marketTop15Set } = useMemo(() => {
    const sortedBull = [...allStocks]
      .filter((s) => s.mv > 0)
      .sort((a, b) => b.mv - a.mv)
      .slice(0, 15);

    const sortedBear = [...allStocks]
      .filter((s) => s.mv < 0)
      .sort((a, b) => a.mv - b.mv)
      .slice(0, 15);

    const set = new Set([...sortedBull, ...sortedBear].map((s) => s.t));

    return {
      top3Bull: sortedBull.slice(0, 3),
      next12Bull: sortedBull.slice(3, 15),
      top3Bear: sortedBear.slice(0, 3),
      next12Bear: sortedBear.slice(3, 15),
      marketTop15Set: set,
    };
  }, [allStocks]);

  // Notice when active (hovered or selected) sector has no stocks in overall top 15 gainers or losers
  const noneInTop15Txt = useMemo(() => {
    if (!activeSector) return "";
    const secStocks = allStocks.filter((s) => s.sec === activeSector);
    if (secStocks.length === 0) return "";
    const hasAnyInTop15 = secStocks.some((s) => marketTop15Set.has(s.t));
    if (!hasAnyInTop15) {
      const len = secStocks.length;
      return `No ${activeSector} stock is in today’s top 15 gainers or losers — its ${len} stock${len > 1 ? "s are" : " is"} shown in the flow only.`;
    }
    return "";
  }, [activeSector, allStocks, marketTop15Set]);

  // Compute squarified tiles for the 12 tiles
  const bullTiles: TileLayout[] = useMemo(() => {
    return computeSquarifiedTiles(next12Bull, true, secAverages, allStocks);
  }, [next12Bull, secAverages, allStocks]);

  const bearTiles: TileLayout[] = useMemo(() => {
    return computeSquarifiedTiles(next12Bear, false, secAverages, allStocks);
  }, [next12Bear, secAverages, allStocks]);

  // Live S&P 500 from FMP tape stream (identical to Dashboard Market Pulse)
  const { frame: tapeFrame } = useTapeStream();
  const liveIndices = useMemo(
    () => (tapeFrame ? tapeItemsToIndexDocs(tapeFrame.items) : []),
    [tapeFrame]
  );
  // 4 Live Market Summary Cards from FMP tape stream
  const spxIndex = useMemo(
    () => liveIndices.find((i) => i.id === "SPX" || i.label === "S&P 500"),
    [liveIndices]
  );
  const spxQuote = liveQuotesMap.get("SPY");
  const rawSpxPrice =
    spxIndex?.value ??
    (spxQuote?.price != null ? spxQuote.price * 10 : 5864.67);
  const rawSpxChange =
    spxIndex?.pctChange ??
    (spxQuote?.pctChange != null ? spxQuote.pctChange : 0.45);
  const spxDisplayPrice = rawSpxPrice.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const spxIsUp = rawSpxChange >= 0;
  const spxDisplayChange = `${spxIsUp ? "+" : ""}${rawSpxChange.toFixed(2)}%`;

  const ndxIndex = useMemo(
    () => liveIndices.find((i) => i.id === "NDX" || i.id === "COMP" || i.label === "NASDAQ"),
    [liveIndices]
  );
  const qqqQuote = liveQuotesMap.get("QQQ");
  const rawNdxPrice =
    ndxIndex?.value ??
    (qqqQuote?.price != null ? qqqQuote.price * 40 : 20245.80);
  const rawNdxChange =
    ndxIndex?.pctChange ??
    (qqqQuote?.pctChange != null ? qqqQuote.pctChange : 0.62);
  const ndxDisplayPrice = rawNdxPrice.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const ndxIsUp = rawNdxChange >= 0;
  const ndxDisplayChange = `${ndxIsUp ? "+" : ""}${rawNdxChange.toFixed(2)}%`;

  const wtiIndex = useMemo(
    () => liveIndices.find((i) => i.id === "CL" || i.id === "WTI" || i.label === "WTI Crude"),
    [liveIndices]
  );
  const rawWtiPrice = wtiIndex?.value ?? 71.85;
  const rawWtiChange = wtiIndex?.pctChange ?? 1.24;
  const wtiDisplayPrice = `$${rawWtiPrice.toFixed(2)}`;
  const wtiIsUp = rawWtiChange >= 0;
  const wtiDisplayChange = `${wtiIsUp ? "+" : ""}${rawWtiChange.toFixed(2)}%`;

  const goldIndex = useMemo(
    () => liveIndices.find((i) => i.id === "GC" || i.id === "GOLD" || i.label === "Gold"),
    [liveIndices]
  );
  const rawGoldPrice = goldIndex?.value ?? 2748.10;
  const rawGoldChange = goldIndex?.pctChange ?? -0.38;
  const goldDisplayPrice = `$${rawGoldPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const goldIsUp = rawGoldChange >= 0;
  const goldDisplayChange = `${goldIsUp ? "+" : ""}${rawGoldChange.toFixed(2)}%`;

  // Dynamic 16 Sectors: Exclude top 2 inflow and top 2 outflow sectors
  const excludedSectorNames = useMemo(() => {
    const set = new Set<string>();
    sectorData.top2Inflow.forEach((s) => set.add(s.name));
    sectorData.top2Outflow.forEach((s) => set.add(s.name));
    return set;
  }, [sectorData]);

  const remainingSectors = useMemo(() => {
    return sectorData.sectors.filter((s) => !excludedSectorNames.has(s.name));
  }, [sectorData, excludedSectorNames]);

  // S&P 500 breadth scaled to the full 500 constituent universe
  const total500 = 500;
  const rawAdv = allStocks.filter((s) => s.mv > 0).length;
  const rawDec = allStocks.filter((s) => s.mv < 0).length;
  const rawTotal = rawAdv + rawDec || 1;
  const advCount = Math.round((rawAdv / rawTotal) * total500);
  const decCount = total500 - advCount;
  const advPct = Math.round((advCount / total500) * 100);

  const handleTileEnter = (stock: StockSession, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimeoutRef.current = setTimeout(() => {
      setPopTf(5);
      setHoveredStock({ stock, rect });
    }, 150);
  };

  const handleTileLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredStock(null);
    }, 250);
  };

  return (
    <div className="mf-page-wrap">
      <style>{`
        /* ── Base Money Flow Styles ── */
        .mf-page-wrap {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 100vw;
          min-height: 100vh;
          overflow-x: hidden;
          box-sizing: border-box;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--si-text-hi, #eef2f4);
          background: #08090a;
        }
        .mf-topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          background: #08090a;
          border-bottom: 1px solid #171c1e;
          width: 100%;
        }
        .mf-nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 8px 20px;
          min-height: 48px;
        }
        .mf-nav-brand {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: none;
        }
        .mf-nav-switcher {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 280px;
        }
        .mf-nav-status {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: none;
        }
        .mf-content-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 10px 18px 24px;
          box-sizing: border-box;
        }
        .mf-desc-row {
          display: flex;
          flex-wrap: nowrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
        }
        .mf-desc-text {
          flex: 1;
          min-width: 0;
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--si-text-dim, #aab3b0);
        }
        .mf-glossary-btn {
          flex: none;
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #5a4a22;
          background: rgba(201,162,74,.08);
          color: #f0d68c;
          border-radius: 8px;
          padding: 7px 12px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .mf-board-wrap {
          background: radial-gradient(ellipse at 30% 25%,rgba(61,220,132,.07),transparent 55%),radial-gradient(ellipse at 30% 80%,rgba(240,86,90,.07),transparent 55%),#08090a;
          border: 1px solid var(--si-border-sec, #1e2427);
          border-radius: 14px;
          padding: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }
        .mf-col-left {
          flex: 1.3 1 440px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mf-col-mid {
          order: 1;
          position: relative;
          z-index: 3;
          flex: 0.75 1 290px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mf-col-right {
          order: 2;
          flex: 1.7 1 360px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mf-indices-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          min-width: 0;
        }
        .mf-sectors-split {
          position: relative;
          flex: 1;
          min-height: 0;
          display: flex;
        }
        .mf-sectors-list {
          width: 330px;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          gap: 2px;
          padding: 4px 6px 10px 0;
          overflow-y: auto;
          background: #08090a;
          border-right: 1px solid #1a2328;
          scrollbar-width: thin;
        }
        .mf-top2-breadth-pane {
          flex: 1;
          padding: 6px 8px;
          display: flex;
          gap: 10px;
          align-items: stretch;
          min-width: 0;
        }
        .mf-mid-cards-col {
          flex: 1 1 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mf-mid-card {
          flex: 1 1 0;
          min-height: 0;
        }
        .mf-treemap-box {
          flex: 1 1 0;
          min-height: 0;
          position: relative;
        }

        /* ── Fit to Screen on Desktop (>= 1200px) ── */
        @media (min-width: 1200px) {
          .mf-content-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8px 16px 12px !important;
          }
          .mf-board-wrap {
            width: 100% !important;
            max-width: 100% !important;
          }
          .mf-col-left {
            flex: 1.3 1 0 !important;
            min-width: 440px !important;
          }
          .mf-col-mid {
            flex: 0.85 1 0 !important;
            min-width: 270px !important;
          }
          .mf-col-right {
            flex: 1.6 1 0 !important;
            min-width: 360px !important;
          }
        }

        @media (min-width: 1200px) and (min-height: 700px) {
          .mf-page-wrap {
            height: 100vh;
            max-height: 100vh;
            overflow: hidden;
          }
          .mf-content-container {
            flex: 1 1 0;
            min-height: 0;
            padding: 8px 16px 12px !important;
            gap: 8px !important;
            overflow: hidden;
          }
          .mf-desc-row {
            flex: none !important;
          }
          .mf-desc-text {
            font-size: 13px !important;
            line-height: 1.4 !important;
          }
          .mf-board-wrap {
            flex: 1 1 0 !important;
            min-height: 0 !important;
            height: 100% !important;
            flex-wrap: nowrap !important;
            overflow: hidden !important;
            padding: 10px 12px !important;
            gap: 10px !important;
          }
          .mf-col-left, .mf-col-mid, .mf-col-right {
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
        }

        /* ── Tablet Mode (768px - 1199px) ── */
        @media (min-width: 768px) and (max-width: 1199px) {
          .mf-board-wrap {
            flex-direction: column !important;
            height: auto !important;
          }
          .mf-col-left, .mf-col-mid, .mf-col-right {
            height: auto !important;
            flex: none !important;
            width: 100% !important;
          }
          .mf-col-left {
            height: 540px !important;
          }
          .mf-treemap-box {
            height: 400px !important;
            flex: none !important;
          }
        }

        /* ── Mobile Mode (< 768px) ── */
        @media (max-width: 767px) {
          .mf-page-wrap {
            overflow-x: hidden;
          }
          .mf-nav-inner {
            flex-wrap: wrap !important;
            padding: 8px 12px !important;
            gap: 8px !important;
            min-height: auto !important;
          }
          .mf-nav-brand {
            order: 1 !important;
          }
          .mf-nav-status {
            order: 2 !important;
            gap: 8px !important;
          }
          .mf-nav-switcher {
            order: 3 !important;
            width: 100% !important;
            min-width: 0 !important;
            margin-top: 4px !important;
          }
          .mf-content-container {
            padding: 10px 12px 36px !important;
            gap: 10px !important;
          }
          .mf-desc-row {
            flex-direction: column !important;
            gap: 8px !important;
            align-items: stretch !important;
          }
          .mf-desc-text {
            font-size: 13px !important;
            line-height: 1.45 !important;
          }
          .mf-board-wrap {
            flex-direction: column !important;
            padding: 10px !important;
            gap: 14px !important;
            height: auto !important;
          }
          .mf-col-left, .mf-col-mid, .mf-col-right {
            height: auto !important;
            flex: none !important;
            width: 100% !important;
          }
          .mf-indices-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .mf-sectors-split {
            flex-direction: column !important;
          }
          .mf-sectors-list {
            width: 100% !important;
            max-height: 250px !important;
            border-right: none !important;
            border-bottom: 1px solid #1a2328 !important;
            padding-right: 0 !important;
            padding-bottom: 6px !important;
          }
          .mf-top2-breadth-pane {
            padding: 8px 0 !important;
          }
          .mf-mid-cards-col {
            gap: 10px !important;
          }
          .mf-mid-card {
            min-height: 130px !important;
            flex: none !important;
          }
          .mf-treemap-box {
            height: 380px !important;
            flex: none !important;
          }
        }
      `}</style>

      {/* ── TOP BAR (Exact layout from HTML) ── */}
      <div className="mf-topbar">
        <div className="mf-nav-inner">
          {/* Left: Heading */}
          <div className="mf-nav-brand">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                lineHeight: 1,
                fontFamily: "'Manrope', -apple-system, sans-serif",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "#eef2f4",
                }}
              >
                Money Flow
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".22em",
                  color: "#e0bb5e",
                }}
              >
                BY MARKETCATALYST
              </div>
            </div>
          </div>

          {/* Center: ModuleSwitcher */}
          <div className="mf-nav-switcher">
            <ModuleSwitcher />
          </div>

          {/* Right: Time · Session · User */}
          <div className="mf-nav-status">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12.5,
                color: "#cfd6d3",
              }}
            >
              {navTime.day} · {navTime.time} ET
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid #6b5216",
                color: "#f2b33d",
                borderRadius: 999,
                padding: "4px 10px",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#f2b33d",
                }}
              />
              {mkt.label || "Pre-Market"}
            </span>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#3b5bdb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "#fff",
                fontSize: 13,
              }}
            >
              {initials}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Container ── */}
      <div className="mf-content-container">
        {/* Subtitle & Glossary Button */}
        <div className="mf-desc-row">
          <div className="mf-desc-text">
            Follow today&apos;s money: hot and cold sectors, the top 15 movers each way, and the key price levels to watch.
          </div>
          <button
            type="button"
            className="mf-glossary-btn"
            onClick={() => setGlossaryOpen(true)}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "1.5px solid currentColor",
                display: "grid",
                placeItems: "center",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              i
            </span>
            Glossary — what everything means
          </button>
        </div>

        {/* ── Main Dashboard Container ── */}
        <div className="mf-board-wrap">
          {/* ── Left Column: Indices & Sectors (19 Sectors) ── */}
          <div
            className="mf-col-left"
            style={{
              flex: "1.3 1 440px",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >


            {/* 4 Index Cards: S&P 500, NASDAQ, WTI CRUDE, GOLD */}
            <div
              className="mf-indices-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 6,
                minWidth: 0,
              }}
            >
              {[
                { n: "S&P 500", px: spxDisplayPrice, chg: spxDisplayChange, isUp: spxIsUp, action: () => openIndex?.("S&P 500") },
                { n: "NASDAQ", px: ndxDisplayPrice, chg: ndxDisplayChange, isUp: ndxIsUp, action: () => openIndex?.("NASDAQ") },
                { n: "WTI CRUDE", px: wtiDisplayPrice, chg: wtiDisplayChange, isUp: wtiIsUp, action: () => openIndex?.("WTI Crude") },
                { n: "GOLD", px: goldDisplayPrice, chg: goldDisplayChange, isUp: goldIsUp, action: () => openIndex?.("Gold") },
              ].map((ix) => {
                const col = ix.isUp ? "#3ddc84" : "#f0565a";
                return (
                  <div
                    key={ix.n}
                    role="button"
                    tabIndex={0}
                    onClick={ix.action}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") ix.action?.();
                    }}
                    title={`Click to view ${ix.n} index details`}
                    style={{
                      cursor: "pointer",
                      border: "1px solid #1e2427",
                      background: "#0c0f10",
                      borderRadius: 7,
                      padding: "6px 8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#c9a24a";
                      (e.currentTarget as HTMLElement).style.background = "#121618";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#1e2427";
                      (e.currentTarget as HTMLElement).style.background = "#0c0f10";
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "#7a8481",
                      }}
                    >
                      {ix.n}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#eef2f4",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ix.px}
                      </span>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: col,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ix.isUp ? "▲ " : "▼ "}{ix.chg}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Sectors Split: Sectors (Remaining 16) + Top 2 In/Out + Breadth */}
            <div
              className="mf-sectors-split"
              style={{
                position: "relative",
                flex: 1,
                minHeight: 0,
                display: "flex",
              }}
            >
              {/* Remaining 16 Sectors Vertical List (Dynamically excludes Top 2 In/Out) */}
              <div
                className="mf-sectors-list"
                style={{
                  width: 220,
                  flex: "0 0 220px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 2,
                  padding: "4px 6px 10px 0",
                  overflowY: "auto",
                  background: "#08090a",
                  borderRight: "1px solid #1a2328",
                  scrollbarWidth: "thin",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "2px 4px",
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: "#c9a24a",
                    }}
                  >
                    Sectors ({remainingSectors.length})
                  </span>
                  {selectedSector && (
                    <button
                      type="button"
                      onClick={() => setSelectedSector(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#f0d68c",
                        fontSize: 10,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>

                {remainingSectors.map((sc) => {
                  const isSelected = selectedSector === sc.name;
                  const isMatch = activeSector === sc.name;
                  const isDimmed = Boolean(activeSector && !isMatch);
                  return (
                    <button
                      key={sc.name}
                      type="button"
                      onClick={() =>
                        setSelectedSector(isSelected ? null : sc.name)
                      }
                      onMouseEnter={() => setHoveredSector(sc.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10.5,
                        background: isMatch
                          ? "rgba(201,162,74,0.22)"
                          : "transparent",
                        borderLeft: `2px solid ${sc.color}`,
                        outline: isMatch ? "1px solid #e0bb5e" : "none",
                        padding: "2px 5px",
                        borderRadius: "0 4px 4px 0",
                        opacity: isDimmed ? 0.35 : 1,
                        transition: "opacity 0.2s, background 0.15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "Manrope, sans-serif",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#e6ebe8",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 130,
                          }}
                        >
                          {sc.name}
                        </span>
                        <span
                          style={{
                            color: sc.color,
                            fontWeight: 700,
                            fontSize: 10.5,
                            whiteSpace: "nowrap",
                            flex: "none",
                          }}
                        >
                          {sc.flowFormatted}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 3,
                            background: "#1a2328",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              height: "100%",
                              width: sc.barWidthPct,
                              background: sc.color,
                            }}
                          />
                        </div>
                        <span style={{ color: "#7a8481", fontSize: 9.5 }}>
                          {sc.avgPctFormatted}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Top 2 In / Top 2 Out Cards + Breadth Bar */}
              <div
                className="mf-top2-breadth-pane"
                style={{
                  flex: 1,
                  minWidth: 190,
                  padding: "4px 6px",
                  display: "flex",
                  gap: 8,
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    justifyContent: "center",
                    minWidth: 0,
                  }}
                >
                  {noneInTop15Txt && (
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: "#f0d68c",
                        background: "rgba(8,9,10,0.92)",
                        border: "1px solid #5a4a22",
                        borderRadius: 6,
                        padding: "5px 7px",
                        lineHeight: 1.3,
                      }}
                    >
                      {noneInTop15Txt}
                    </div>
                  )}

                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: "#3ddc84",
                    }}
                  >
                    Top 2 Sectors · Inflow
                  </span>
                  {sectorData.top2Inflow.map((sc) => {
                    const isSelected = selectedSector === sc.name;
                    const isMatch = activeSector === sc.name;
                    const isDimmed = Boolean(activeSector && !isMatch);
                    return (
                      <button
                        key={sc.name}
                        type="button"
                        onClick={() =>
                          setSelectedSector(selectedSector === sc.name ? null : sc.name)
                        }
                        onMouseEnter={() => setHoveredSector(sc.name)}
                        onMouseLeave={() => setHoveredSector(null)}
                        style={{
                          all: "unset",
                          boxSizing: "border-box",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          padding: "7px 10px",
                          minHeight: 70,
                          justifyContent: "space-between",
                          borderRadius: 8,
                          border: `1px solid ${isMatch
                            ? "#c9a24a"
                            : "rgba(61,220,132,0.35)"
                            }`,
                          background: isMatch
                            ? "rgba(201,162,74,0.18)"
                            : "rgba(61,220,132,0.06)",
                          boxShadow: isMatch
                            ? "0 0 14px rgba(201,162,74,0.3)"
                            : "none",
                          opacity: isDimmed ? 0.35 : 1,
                          transition: "opacity 0.2s, border-color 0.15s, background 0.15s",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#3ddc84",
                              letterSpacing: ".08em",
                            }}
                          >
                            INFLOW
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: "#aab3b0",
                            }}
                          >
                            {sc.avgPctFormatted}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "#eef2f4",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {sc.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#3ddc84",
                          }}
                        >
                          {sc.flowFormatted}
                        </span>
                      </button>
                    );
                  })}

                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: "#f0565a",
                      marginTop: 2,
                    }}
                  >
                    Top 2 Sectors · Outflow
                  </span>
                  {sectorData.top2Outflow.map((sc) => {
                    const isSelected = selectedSector === sc.name;
                    const isMatch = activeSector === sc.name;
                    const isDimmed = Boolean(activeSector && !isMatch);
                    return (
                      <button
                        key={sc.name}
                        type="button"
                        onClick={() =>
                          setSelectedSector(selectedSector === sc.name ? null : sc.name)
                        }
                        onMouseEnter={() => setHoveredSector(sc.name)}
                        onMouseLeave={() => setHoveredSector(null)}
                        style={{
                          all: "unset",
                          boxSizing: "border-box",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          padding: "7px 10px",
                          minHeight: 70,
                          justifyContent: "space-between",
                          borderRadius: 8,
                          border: `1px solid ${isMatch
                            ? "#c9a24a"
                            : "rgba(240,86,90,0.35)"
                            }`,
                          background: isMatch
                            ? "rgba(201,162,74,0.18)"
                            : "rgba(240,86,90,0.06)",
                          boxShadow: isMatch
                            ? "0 0 14px rgba(201,162,74,0.3)"
                            : "none",
                          opacity: isDimmed ? 0.35 : 1,
                          transition: "opacity 0.2s, border-color 0.15s, background 0.15s",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#f0565a",
                              letterSpacing: ".08em",
                            }}
                          >
                            OUTFLOW
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: "#aab3b0",
                            }}
                          >
                            {sc.avgPctFormatted}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "#eef2f4",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {sc.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#f0565a",
                          }}
                        >
                          {sc.flowFormatted}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Breadth Vertical Bar */}
                <div
                  title="S&P 500 Market Breadth"
                  style={{
                    width: 36,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: "'JetBrains Mono', monospace",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: "#aab3b0",
                      textAlign: "center",
                      lineHeight: 1.15,
                    }}
                  >
                    S&P<br />500
                  </span>
                  <span
                    style={{ fontSize: 10, fontWeight: 700, color: "#3ddc84" }}
                  >
                    {advCount} ▲
                  </span>
                  <div
                    style={{
                      width: 8,
                      height: 340,
                      borderRadius: 4,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      background: "#1a2328",
                    }}
                  >
                    <span
                      style={{
                        flex: advCount,
                        background: "#3ddc84",
                        boxShadow: "0 0 10px rgba(61,220,132,.5)",
                      }}
                    />
                    <span
                      style={{
                        flex: decCount,
                        background: "#f0565a",
                      }}
                    />
                  </div>
                  <span
                    style={{ fontSize: 10, fontWeight: 700, color: "#f0565a" }}
                  >
                    {decCount} ▼
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: advPct >= 50 ? "#3ddc84" : "#f0565a",
                    }}
                  >
                    {advPct}%
                    <span
                      style={{
                        display: "block",
                        fontSize: 8,
                        color: "#7a8481",
                        fontWeight: 600,
                      }}
                    >
                      adv
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Middle Column: Top 3 Bullish & Top 3 Bearish Cards ── */}
          <div
            className="mf-col-mid"
            style={{
              order: 1,
              position: "relative",
              zIndex: 3,
              flex: "0.75 1 290px",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {/* Top 3 Bullish Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                  fontWeight: 600,
                  fontSize: 17,
                  color: "#3ddc84",
                }}
              >
                Top 3 Bullish Stocks
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "#7a8481",
                }}
              >
                Strongest Setups
              </span>
            </div>

            {/* Top 3 Bullish Cards */}
            <div
              className="mf-mid-cards-col"
              style={{
                flex: "1 1 0",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {top3Bull.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7a8481",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    border: "1px dashed #1e2427",
                    borderRadius: 10,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  No bullish stocks today
                </div>
              ) : (
                top3Bull.map((fc, i) => {
                  const candles = computeCandles(fc);
                  const conf = computeConfidence(fc, allStocks);
                  const isSecMatch = Boolean(activeSector && fc.sec === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  return (
                    <button
                      key={fc.t}
                      type="button"
                      className="mf-mid-card"
                      onClick={() => openStock(fc.t)}
                      onMouseEnter={(e) => handleTileEnter(fc, e)}
                      onMouseLeave={handleTileLeave}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        flex: "1 1 0",
                        minHeight: 0,
                        borderRadius: 10,
                        border: isSecMatch
                          ? "1px solid #f0d68c"
                          : "1px solid rgba(61,220,132,.32)",
                        boxShadow: isSecMatch
                          ? "0 0 0 1px rgba(240,214,140,.6), 0 0 24px rgba(201,162,74,.3)"
                          : "none",
                        opacity: isDimmed ? 0.25 : 1,
                        background:
                          "linear-gradient(150deg,rgba(61,220,132,.18),rgba(61,220,132,.04) 60%,rgba(8,9,10,.6))",
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        overflow: "hidden",
                        transition: "border-color 0.15s, opacity 0.2s, box-shadow 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                          flex: "none",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#e6ebe8",
                            border: "1px solid #3a4448",
                            borderRadius: 4,
                            padding: "1px 4px",
                            flex: "none",
                          }}
                        >
                          #{i + 1}
                        </span>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: "#fff",
                            display: "grid",
                            placeItems: "center",
                            overflow: "hidden",
                            flex: "none",
                          }}
                        >
                          <img
                            src={`https://financialmodelingprep.com/image-stock/${fc.t}.png`}
                            alt=""
                            style={{ width: 19, height: 19, objectFit: "contain" }}
                          />
                        </span>
                        <span
                          style={{
                            fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                            fontWeight: 600,
                            fontSize: 18,
                            lineHeight: 1,
                            color: "#eef2f4",
                          }}
                        >
                          {fc.t}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            lineHeight: 1.15,
                            fontFamily: "'JetBrains Mono', monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#eef2f4",
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(fc.px)}
                          </span>
                          <span style={{ fontSize: 10.5, color: "#3ddc84" }}>
                            {formatPct(fc.mv)}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: ".1em",
                            color: "#08090a",
                            background: "#3ddc84",
                            borderRadius: 4,
                            padding: "2px 6px",
                            whiteSpace: "nowrap",
                            marginLeft: "auto",
                          }}
                        >
                          BULLISH
                        </span>
                        <span
                          style={{
                            flex: "none",
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: `conic-gradient(#3ddc84 ${conf.sc * 3.6}deg, #1a2328 0)`,
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              background: "#0d0f10",
                              display: "grid",
                              placeItems: "center",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#3ddc84",
                            }}
                          >
                            {conf.sc}
                          </span>
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div
                        style={{
                          position: "relative",
                          flex: "1 1 0",
                          minHeight: 24,
                          borderRadius: 6,
                          background: "rgba(8,9,10,.55)",
                          border: "1px solid rgba(61,220,132,.18)",
                          overflow: "hidden",
                        }}
                      >
                        <SparklineSvg stock={fc} candles={candles} />
                        <span
                          style={{
                            position: "absolute",
                            left: 5,
                            top: 4,
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: ".08em",
                            color: "#3ddc84",
                            background: "rgba(8,9,10,.75)",
                            border: "1px solid rgba(61,220,132,.4)",
                            borderRadius: 3,
                            padding: "0 4px",
                          }}
                        >
                          {fc.vol >= 1.4 ? "ACCUMULATION" : "MOMENTUM UP"}
                        </span>
                      </div>

                      {/* Key Levels Table */}
                      <div
                        style={{
                          flex: "none",
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0,1.5fr) repeat(5,minmax(0,1fr))",
                          gap: 4,
                          borderTop: "1px solid rgba(61,220,132,.2)",
                          paddingTop: 5,
                        }}
                      >
                        {[
                          {
                            k: "ZONE",
                            v: `${fc.zLo.toFixed(1)}–${fc.zHi.toFixed(1)}`,
                            c: "#e0bb5e",
                          },
                          { k: "R2", v: fc.R2.toFixed(1), c: "#e0bb5e" },
                          { k: "R1", v: fc.R1.toFixed(1), c: "#e0bb5e" },
                          { k: "S1", v: fc.S1.toFixed(1), c: "#e6ebe8" },
                          { k: "S2", v: fc.S2.toFixed(1), c: "#f0565a" },
                          { k: "R:R", v: `1:${fc.rr.toFixed(1)}`, c: "#e6ebe8" },
                        ].map((l) => (
                          <span
                            key={l.k}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: ".08em",
                                color: "#7a8481",
                              }}
                            >
                              {l.k}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                fontWeight: 700,
                                color: l.c,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {l.v}
                            </span>
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background:
                  "linear-gradient(90deg,transparent,#e6ebe8,transparent)",
                opacity: 0.35,
                flex: "none",
              }}
            />

            {/* Top 3 Bearish Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                  fontWeight: 600,
                  fontSize: 17,
                  color: "#f0565a",
                }}
              >
                Top 3 Bearish Stocks
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "#7a8481",
                }}
              >
                Heavy Selling
              </span>
            </div>

            {/* Top 3 Bearish Cards */}
            <div
              className="mf-mid-cards-col"
              style={{
                flex: "1 1 0",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {top3Bear.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7a8481",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    border: "1px dashed #1e2427",
                    borderRadius: 10,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  No bearish stocks today
                </div>
              ) : (
                top3Bear.map((fc, i) => {
                  const candles = computeCandles(fc);
                  const conf = computeConfidence(fc, allStocks);
                  const isSecMatch = Boolean(activeSector && fc.sec === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  return (
                    <button
                      key={fc.t}
                      type="button"
                      className="mf-mid-card"
                      onClick={() => openStock(fc.t)}
                      onMouseEnter={(e) => handleTileEnter(fc, e)}
                      onMouseLeave={handleTileLeave}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        flex: "1 1 0",
                        minHeight: 0,
                        borderRadius: 10,
                        border: isSecMatch
                          ? "1px solid #f0d68c"
                          : "1px solid rgba(240,86,90,.32)",
                        boxShadow: isSecMatch
                          ? "0 0 0 1px rgba(240,214,140,.6), 0 0 24px rgba(201,162,74,.3)"
                          : "none",
                        opacity: isDimmed ? 0.25 : 1,
                        background:
                          "linear-gradient(150deg,rgba(240,86,90,.18),rgba(240,86,90,.04) 60%,rgba(8,9,10,.6))",
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        overflow: "hidden",
                        transition: "border-color 0.15s, opacity 0.2s, box-shadow 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                          flex: "none",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#e6ebe8",
                            border: "1px solid #3a4448",
                            borderRadius: 4,
                            padding: "1px 4px",
                            flex: "none",
                          }}
                        >
                          #{i + 1}
                        </span>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: "#fff",
                            display: "grid",
                            placeItems: "center",
                            overflow: "hidden",
                            flex: "none",
                          }}
                        >
                          <img
                            src={`https://financialmodelingprep.com/image-stock/${fc.t}.png`}
                            alt=""
                            style={{ width: 19, height: 19, objectFit: "contain" }}
                          />
                        </span>
                        <span
                          style={{
                            fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                            fontWeight: 600,
                            fontSize: 18,
                            lineHeight: 1,
                            color: "#eef2f4",
                          }}
                        >
                          {fc.t}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            lineHeight: 1.15,
                            fontFamily: "'JetBrains Mono', monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#eef2f4",
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(fc.px)}
                          </span>
                          <span style={{ fontSize: 10.5, color: "#f0565a" }}>
                            {formatPct(fc.mv)}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: ".1em",
                            color: "#08090a",
                            background: "#f0565a",
                            borderRadius: 4,
                            padding: "2px 6px",
                            whiteSpace: "nowrap",
                            marginLeft: "auto",
                          }}
                        >
                          BEARISH
                        </span>
                        <span
                          style={{
                            flex: "none",
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: `conic-gradient(#f0565a ${conf.sc * 3.6}deg, #1a2328 0)`,
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              background: "#0d0f10",
                              display: "grid",
                              placeItems: "center",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#f0565a",
                            }}
                          >
                            {conf.sc}
                          </span>
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div
                        style={{
                          position: "relative",
                          flex: "1 1 0",
                          minHeight: 24,
                          borderRadius: 6,
                          background: "rgba(8,9,10,.55)",
                          border: "1px solid rgba(240,86,90,.18)",
                          overflow: "hidden",
                        }}
                      >
                        <SparklineSvg stock={fc} candles={candles} />
                        <span
                          style={{
                            position: "absolute",
                            left: 5,
                            top: 4,
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: ".08em",
                            color: "#f0565a",
                            background: "rgba(8,9,10,.75)",
                            border: "1px solid rgba(240,86,90,.4)",
                            borderRadius: 3,
                            padding: "0 4px",
                          }}
                        >
                          {fc.vol >= 1.4 ? "DISTRIBUTION" : "MOMENTUM DOWN"}
                        </span>
                      </div>

                      {/* Key Levels Table */}
                      <div
                        style={{
                          flex: "none",
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0,1.5fr) repeat(5,minmax(0,1fr))",
                          gap: 4,
                          borderTop: "1px solid rgba(240,86,90,.2)",
                          paddingTop: 5,
                        }}
                      >
                        {[
                          {
                            k: "ZONE",
                            v: `${fc.zLo.toFixed(1)}–${fc.zHi.toFixed(1)}`,
                            c: "#e0bb5e",
                          },
                          { k: "R2", v: fc.R2.toFixed(1), c: "#e0bb5e" },
                          { k: "R1", v: fc.R1.toFixed(1), c: "#e0bb5e" },
                          { k: "S1", v: fc.S1.toFixed(1), c: "#e6ebe8" },
                          { k: "S2", v: fc.S2.toFixed(1), c: "#f0565a" },
                          { k: "R:R", v: `1:${fc.rr.toFixed(1)}`, c: "#e6ebe8" },
                        ].map((l) => (
                          <span
                            key={l.k}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: ".08em",
                                color: "#7a8481",
                              }}
                            >
                              {l.k}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                fontWeight: 700,
                                color: l.c,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {l.v}
                            </span>
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right Column: Next 12 Tiles (Bullish & Bearish) ── */}
          <div
            className="mf-col-right"
            style={{
              order: 2,
              flex: "1.7 1 360px",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {/* Bullish 12 Tiles Treemap */}
            <div
              className="mf-treemap-box"
              style={{
                flex: "1 1 0",
                minHeight: 0,
                position: "relative",
              }}
            >
              {bullTiles.length === 0 ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7a8481",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    border: "1px dashed #1e2427",
                    borderRadius: 6,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  No bullish stocks
                </div>
              ) : (
                bullTiles.map((x) => {
                  const fullStock = allStocks.find((s) => s.t === x.t)!;
                  const candles = computeCandles(fullStock);
                  const isSecMatch = Boolean(activeSector && fullStock?.sec === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  return (
                    <button
                      key={x.t}
                      type="button"
                      onClick={() => openStock(x.t)}
                      onMouseEnter={(e) => handleTileEnter(fullStock, e)}
                      onMouseLeave={handleTileLeave}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        position: "absolute",
                        left: `calc(${x.L} + 2px)`,
                        top: `calc(${x.T} + 2px)`,
                        width: `calc(${x.W} - 4px)`,
                        height: `calc(${x.H} - 4px)`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "stretch",
                        borderRadius: 5,
                        border: isSecMatch ? "1px solid #f0d68c" : `1px solid ${x.bd}`,
                        boxShadow: isSecMatch
                          ? "0 0 0 1px rgba(240,214,140,.6), 0 0 16px rgba(201,162,74,.3)"
                          : "none",
                        opacity: isDimmed ? 0.2 : 1,
                        background: x.bg,
                        padding: "5px 7px",
                        overflow: "hidden",
                        transition: "border-color 0.15s, opacity 0.2s, box-shadow 0.2s",
                      }}
                    >
                      {/* Top-right Confidence Ring */}
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 3,
                          zIndex: 2,
                          width: x.ringS,
                          height: x.ringS,
                          borderRadius: "50%",
                          background: `conic-gradient(${x.confC} ${x.confDeg}, #1a2328 0)`,
                          display: "grid",
                          placeItems: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <span
                          style={{
                            width: x.ringI,
                            height: x.ringI,
                            borderRadius: "50%",
                            background: "#0d0f10",
                            display: "grid",
                            placeItems: "center",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: x.ringF,
                            fontWeight: 700,
                            color: x.confC,
                          }}
                        >
                          {x.conf}
                        </span>
                      </span>

                      {/* Volume Profile Mini-Graphic */}
                      <div
                        style={{
                          position: "absolute",
                          left: 5,
                          right: 5,
                          top: 34,
                          bottom: x.miniB,
                          pointerEvents: "none",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <MiniProfileSvg stock={fullStock} candles={candles} />
                      </div>

                      {/* Bottom Stats: Sector RS & 30m Momentum */}
                      <div
                        style={{
                          position: "absolute",
                          left: 5,
                          right: 5,
                          bottom: 5,
                          display: x.rowD as "none" | "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 1,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          color: "#aab3b0",
                          pointerEvents: "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        <span style={{ color: "#7a8481" }}>
                          sec <b style={{ color: x.rsC }}>{x.rsTxt}</b>
                        </span>
                        <span style={{ color: "#7a8481" }}>
                          30m <b style={{ color: x.m30C }}>{x.m30}</b>
                        </span>
                      </div>

                      {/* Header: Logo, Ticker & Move */}
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              minWidth: 0,
                              paddingRight: x.padR,
                            }}
                          >
                            <span
                              style={{
                                width: 16,
                                height: 16,
                                flex: "none",
                                borderRadius: 4,
                                background: "#fff",
                                display: x.logoD as "none" | "grid",
                                placeItems: "center",
                                overflow: "hidden",
                              }}
                            >
                              <img
                                src={`https://financialmodelingprep.com/image-stock/${x.t}.png`}
                                alt=""
                                style={{ width: 13, height: 13, objectFit: "contain" }}
                              />
                            </span>
                            <span
                              style={{
                                fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                                fontWeight: 600,
                                fontSize: x.fs,
                                lineHeight: 1,
                                color: "#eef2f4",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {x.t}
                            </span>
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10.5,
                              color: "#3ddc84",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: 9, color: "#7a8481" }}>
                              #{x.rank}{" "}
                            </span>
                            {x.chg}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background:
                  "linear-gradient(90deg,transparent,#e6ebe8,transparent)",
                opacity: 0.5,
                flex: "none",
              }}
            />

            {/* Bearish 12 Tiles Treemap */}
            <div
              className="mf-treemap-box"
              style={{
                flex: "1 1 0",
                minHeight: 0,
                position: "relative",
              }}
            >
              {bearTiles.length === 0 ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7a8481",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    border: "1px dashed #1e2427",
                    borderRadius: 6,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  No bearish stocks
                </div>
              ) : (
                bearTiles.map((x) => {
                  const fullStock = allStocks.find((s) => s.t === x.t)!;
                  const candles = computeCandles(fullStock);
                  const isSecMatch = Boolean(activeSector && fullStock?.sec === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  return (
                    <button
                      key={x.t}
                      type="button"
                      onClick={() => openStock(x.t)}
                      onMouseEnter={(e) => handleTileEnter(fullStock, e)}
                      onMouseLeave={handleTileLeave}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        position: "absolute",
                        left: `calc(${x.L} + 2px)`,
                        top: `calc(${x.T} + 2px)`,
                        width: `calc(${x.W} - 4px)`,
                        height: `calc(${x.H} - 4px)`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "stretch",
                        borderRadius: 5,
                        border: isSecMatch ? "1px solid #f0d68c" : `1px solid ${x.bd}`,
                        boxShadow: isSecMatch
                          ? "0 0 0 1px rgba(240,214,140,.6), 0 0 16px rgba(201,162,74,.3)"
                          : "none",
                        opacity: isDimmed ? 0.2 : 1,
                        background: x.bg,
                        padding: "5px 7px",
                        overflow: "hidden",
                        transition: "border-color 0.15s, opacity 0.2s, box-shadow 0.2s",
                      }}
                    >
                      {/* Top-right Confidence Ring */}
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 3,
                          zIndex: 2,
                          width: x.ringS,
                          height: x.ringS,
                          borderRadius: "50%",
                          background: `conic-gradient(${x.confC} ${x.confDeg}, #1a2328 0)`,
                          display: "grid",
                          placeItems: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <span
                          style={{
                            width: x.ringI,
                            height: x.ringI,
                            borderRadius: "50%",
                            background: "#0d0f10",
                            display: "grid",
                            placeItems: "center",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: x.ringF,
                            fontWeight: 700,
                            color: x.confC,
                          }}
                        >
                          {x.conf}
                        </span>
                      </span>

                      {/* Volume Profile Mini-Graphic */}
                      <div
                        style={{
                          position: "absolute",
                          left: 5,
                          right: 5,
                          top: 34,
                          bottom: x.miniB,
                          pointerEvents: "none",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <MiniProfileSvg stock={fullStock} candles={candles} />
                      </div>

                      {/* Bottom Stats: Sector RS & 30m Momentum */}
                      <div
                        style={{
                          position: "absolute",
                          left: 5,
                          right: 5,
                          bottom: 5,
                          display: x.rowD as "none" | "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 1,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          color: "#aab3b0",
                          pointerEvents: "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        <span style={{ color: "#7a8481" }}>
                          sec <b style={{ color: x.rsC }}>{x.rsTxt}</b>
                        </span>
                        <span style={{ color: "#7a8481" }}>
                          30m <b style={{ color: x.m30C }}>{x.m30}</b>
                        </span>
                      </div>

                      {/* Header: Logo, Ticker & Move */}
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              minWidth: 0,
                              paddingRight: x.padR,
                            }}
                          >
                            <span
                              style={{
                                width: 16,
                                height: 16,
                                flex: "none",
                                borderRadius: 4,
                                background: "#fff",
                                display: x.logoD as "none" | "grid",
                                placeItems: "center",
                                overflow: "hidden",
                              }}
                            >
                              <img
                                src={`https://financialmodelingprep.com/image-stock/${x.t}.png`}
                                alt=""
                                style={{ width: 13, height: 13, objectFit: "contain" }}
                              />
                            </span>
                            <span
                              style={{
                                fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                                fontWeight: 600,
                                fontSize: x.fs,
                                lineHeight: 1,
                                color: "#eef2f4",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {x.t}
                            </span>
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10.5,
                              color: "#f0565a",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: 9, color: "#7a8481" }}>
                              #{x.rank}{" "}
                            </span>
                            {x.chg}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Hover Popover ── */}
      {hoveredStock && (
        <div
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          }}
          onMouseLeave={handleTileLeave}
          style={(() => {
            const POPOVER_W = 460;
            const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 640;
            let popLeft: number | string = 12;
            let popTop: number | string = 16;
            let popTransform = "none";

            if (isMobileScreen) {
              popLeft = 12;
              popTop = "50%";
              popTransform = "translateY(-50%)";
            } else if (typeof window !== "undefined") {
              const rect = hoveredStock.rect;
              const spaceRight = window.innerWidth - rect.right;
              const spaceLeft = rect.left;

              // If enough space on right and not in the right half of the screen, place to the right of tile:
              if (spaceRight >= POPOVER_W + 20 && rect.left < window.innerWidth / 2) {
                popLeft = rect.right + 14;
              } else if (spaceLeft >= POPOVER_W + 20) {
                // Otherwise place strictly to the left of the hovered stock tile
                popLeft = rect.left - POPOVER_W - 14;
              } else if (spaceRight >= POPOVER_W + 20) {
                popLeft = rect.right + 14;
              } else {
                // If neither side has 480px, place on whichever side has more space
                if (spaceLeft > spaceRight) {
                  popLeft = Math.max(12, rect.left - POPOVER_W - 14);
                } else {
                  popLeft = Math.min(window.innerWidth - POPOVER_W - 12, rect.right + 14);
                }
              }

              // Vertical positioning: align near tile's top, clamped within window bounds
              popTop = Math.max(
                16,
                Math.min(window.innerHeight - 540, rect.top - 20)
              );
            }

            return {
              position: "fixed" as const,
              zIndex: 9999,
              left: popLeft,
              top: popTop,
              transform: popTransform,
              width: isMobileScreen ? "calc(100vw - 24px)" : POPOVER_W,
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto" as const,
              pointerEvents: "auto" as const,
              background: "#0b0d0e",
              border: `1px solid ${hoveredStock.stock.bull
                ? "rgba(61,220,132,.45)"
                : "rgba(240,86,90,.45)"
                }`,
              borderBottom: `2px solid ${hoveredStock.stock.bull ? "#3ddc84" : "#f0565a"
                }`,
              borderRadius: 12,
              boxShadow: "0 24px 60px rgba(0,0,0,.75)",
              padding: 14,
              display: "flex",
              flexDirection: "column" as const,
              gap: 10,
            };
          })()}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 38,
                height: 38,
                flex: "none",
                borderRadius: 8,
                background: "#fff",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                boxShadow: `0 0 0 1px ${hoveredStock.stock.bull ? "#3ddc84" : "#f0565a"
                  }`,
              }}
            >
              <img
                src={`https://financialmodelingprep.com/image-stock/${hoveredStock.stock.t}.png`}
                alt=""
                style={{ width: 30, height: 30, objectFit: "contain" }}
              />
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                flex: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                  fontWeight: 600,
                  fontSize: 24,
                  lineHeight: 1,
                  color: "#eef2f4",
                }}
              >
                {hoveredStock.stock.t}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#7a8481",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                }}
              >
                {hoveredStock.stock.name} · {hoveredStock.stock.sec}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: "#eef2f4" }}>
                {formatCurrency(hoveredStock.stock.px)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: hoveredStock.stock.bull ? "#3ddc84" : "#f0565a",
                }}
              >
                {formatPct(hoveredStock.stock.mv)}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setHoveredStock(null);
              }}
              style={{
                marginLeft: 4,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid #2a3439",
                borderRadius: 6,
                color: "#cfd6d3",
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                flex: "none",
              }}
              aria-label="Close details"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ height: 1, background: "#1a2328" }} />

          {/* Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 12px",
            }}
          >
            {[
              {
                k: "Confidence",
                v: String(
                  computeConfidence(hoveredStock.stock, allStocks).sc
                ),
                c: hoveredStock.stock.bull ? "#3ddc84" : "#f0565a",
                b: true,
              },
              {
                k: "Setup",
                v: hoveredStock.stock.chop
                  ? "Choppy"
                  : hoveredStock.stock.bull
                    ? "Bullish"
                    : "Bearish",
                c: hoveredStock.stock.chop
                  ? "#7a8481"
                  : hoveredStock.stock.bull
                    ? "#3ddc84"
                    : "#f0565a",
                b: false,
              },
              {
                k: "Mkt Cap",
                v: (hoveredStock.stock.marketCap
                  ? formatCompactDollars(hoveredStock.stock.marketCap)
                  : formatCompactDollars(hoveredStock.stock.px * hoveredStock.stock.sh)
                ).replace(/^\+/, ""),
                c: "#eef2f4",
                b: false,
              },
              {
                k: "Net Flow",
                v: computeDollarFlow(hoveredStock.stock).netTxt,
                c: hoveredStock.stock.bull ? "#3ddc84" : "#f0565a",
                b: false,
              },
              {
                k: "Support (S1)",
                v: formatCurrency(hoveredStock.stock.S1),
                c: "#3ddc84",
                b: false,
              },
              {
                k: "Resistance (R1)",
                v: formatCurrency(hoveredStock.stock.R1),
                c: "#f0565a",
                b: false,
              },
              {
                k: "Order Zone",
                v: `${formatCurrency(hoveredStock.stock.zLo)}–${formatCurrency(
                  hoveredStock.stock.zHi
                )}`,
                c: "#e0bb5e",
                b: false,
              },
              {
                k: "Vol & R:R",
                v: `${hoveredStock.stock.vol.toFixed(1)}× · 1:${hoveredStock.stock.rr.toFixed(1)}`,
                c: "#e6ebe8",
                b: false,
              },
            ].map((stat) => (
              <div
                key={stat.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  padding: "2px 0",
                  borderBottom: "1px solid #141a1d",
                }}
              >
                <span
                  style={{
                    color: "#7a8481",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: 9.5,
                  }}
                >
                  {stat.k}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: stat.b ? 800 : 600,
                    color: stat.c,
                  }}
                >
                  {stat.v}
                </span>
              </div>
            ))}
          </div>

          {/* Timeframe Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "#7a8481",
              }}
            >
              Timeframe
            </span>
            <div
              style={{
                display: "flex",
                background: "#0f1213",
                border: "1px solid #1e2427",
                borderRadius: 7,
                padding: 2,
                gap: 2,
              }}
            >
              {[1, 3, 5, 15].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setPopTf(tf)}
                  style={{
                    border: 0,
                    borderRadius: 5,
                    padding: "3px 10px",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: popTf === tf ? "#c9a24a" : "transparent",
                    color: popTf === tf ? "#08090a" : "#aab3b0",
                  }}
                >
                  {tf}m
                </button>
              ))}
            </div>
          </div>

          {/* Layer Toggles */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              { k: "ob", l: "Order blocks", c: "#e0bb5e" },
              { k: "vwap", l: "VWAP", c: "#8b7cf6" },
              { k: "fvg", l: "FVG", c: "#5aa9e6" },
              { k: "liq", l: "Liquidity", c: "#f0a24a" },
              { k: "str", l: "Structure", c: "#3ddc84" },
            ].map((ly) => {
              const active = popLayers[ly.k as keyof typeof popLayers];
              return (
                <button
                  key={ly.k}
                  type="button"
                  onClick={() =>
                    setPopLayers((prev) => ({
                      ...prev,
                      [ly.k]: !prev[ly.k as keyof typeof popLayers],
                    }))
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    border: `1px solid ${active ? ly.c : "#233038"}`,
                    background: active ? "rgba(255,255,255,.04)" : "transparent",
                    color: active ? ly.c : "#7a8481",
                    borderRadius: 5,
                    padding: "3px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 2,
                      background: active ? ly.c : "#3a4448",
                    }}
                  />
                  {ly.l}
                </button>
              );
            })}
          </div>

          {/* Full Interactive Chart */}
          <div
            style={{
              height: 240,
              borderRadius: 8,
              border: "1px solid #171c1e",
              background: "#08090a",
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "thin",
            }}
          >
            <FullChartSvg
              stock={hoveredStock.stock}
              candles={computeTfCandles(
                hoveredStock.stock,
                computeCandles(hoveredStock.stock),
                popTf
              )}
              layers={popLayers}
              tf={popTf}
              width={460}
              height={238}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => {
                const sym = hoveredStock.stock.t;
                setHoveredStock(null);
                exitToMC(sym);
              }}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 6,
                background: "#4ade80",
                border: "1px solid #22c55e",
                color: "#05210f",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open {hoveredStock.stock.t} in Market Catalyst →
            </button>
            <button
              type="button"
              onClick={() => {
                const sym = hoveredStock.stock.t;
                setHoveredStock(null);
                enterSI(sym);
              }}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 6,
                background: "#161b1d",
                border: "1px solid #233038",
                color: "#7fa8d0",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open {hoveredStock.stock.t} in Stock Intelligence →
            </button>
          </div>
        </div>
      )}

      {/* ── Glossary Drawer Modal (Exact match to HTML) ── */}
      {glossaryOpen && (
        <div
          onClick={() => setGlossaryOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(4,5,6,.72)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1000px, 92vw)",
              height: "100%",
              overflowY: "auto",
              background: "#0b0d0e",
              borderLeft: "1px solid #1e2427",
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              boxShadow: "-20px 0 60px rgba(0,0,0,.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                  fontWeight: 600,
                  fontSize: 28,
                  color: "#eef2f4",
                }}
              >
                Money Flow — Glossary
              </span>
              <button
                type="button"
                onClick={() => setGlossaryOpen(false)}
                style={{
                  border: "1px solid #233038",
                  background: "transparent",
                  color: "#cfd6d3",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Glossary Sections */}
            {[
              {
                title: "Sector Money Flow",
                rows: [
                  {
                    term: "Money flow ($)",
                    desc: "For every 5-minute candle of every stock: dollar volume (price × shares traded) × candle direction. A strong green candle counts as buying, a strong red candle as selling, small candles count partially. Sum across the day = the stock’s net flow. A sector’s flow is the sum of its stocks.",
                  },
                  {
                    term: "Sector % (grey)",
                    desc: "Average % move of the stocks in that sector today.",
                  },
                  {
                    term: "Bar length",
                    desc: "Sector flow relative to the biggest sector flow on the board.",
                  },
                  {
                    term: "Sectors column",
                    desc: "All 19 sectors, inflows first (biggest at top), then outflows. Every stock belongs to exactly one sector.",
                  },
                  {
                    term: "Top 2 boxes",
                    desc: "The two sectors with the most money flowing in (green) and the two with the most flowing out (red), pulled out of the column into large boxes.",
                  },
                  {
                    term: "Click / hover",
                    desc: "Highlights that sector’s stocks on the gainer and loser boards; everything else fades. Click again to clear.",
                  },
                ],
              },
              {
                title: "Market strip",
                rows: [
                  {
                    term: "S&P · Nasdaq · Oil · Gold",
                    desc: "Index level and % change for the session. Green = up, red = down.",
                  },
                  {
                    term: "Universe",
                    desc: "The board scans S&P 500 and Nasdaq-100 stocks together; a stock in both is counted once.",
                  },
                  {
                    term: "Breadth bar",
                    desc: "S&P 500 stocks up vs down for the session (e.g. 135 ▲ / 365 ▼ = 27% advancing). Green share = advancers, red = decliners.",
                  },
                ],
              },
              {
                title: "Gainer & loser boxes",
                rows: [
                  {
                    term: "Ranking",
                    desc: "Top 15 each side by size of the % move. #1–#3 are the Top 3 Bullish / Bearish Stocks cards; #4–#15 are tiles, #15 (smallest move) at top-left.",
                  },
                  {
                    term: "Box size",
                    desc: "Proportional to the size of the % move. Very small moves are grouped into the neighbouring column so every tile stays readable.",
                  },
                  {
                    term: "Ring number",
                    desc: "Confidence score 0–100 (see below).",
                  },
                  {
                    term: "Volume profile",
                    desc: "Horizontal bars inside a tile: how much volume traded at each price today. Green = buying volume, red = selling volume.",
                  },
                  {
                    term: "POC",
                    desc: "Point of control — the price where the most volume traded today. Acts as a magnet / pivot.",
                  },
                  {
                    term: "Purple dashed line",
                    desc: "VWAP — volume-weighted average price. Above it buyers are in control for the day, below it sellers.",
                  },
                  {
                    term: "White line + arrow",
                    desc: "Current price.",
                  },
                  {
                    term: "vs sector",
                    desc: "Stock’s % move minus its sector’s average move. Positive = leading its group.",
                  },
                  {
                    term: "30m",
                    desc: "Price change over the last 30 minutes — is it still pushing or fading?",
                  },
                  {
                    term: "Tag",
                    desc: "ACCUMULATION / DISTRIBUTION = strong move on heavy volume (≥1.4× normal). MOMENTUM UP / DOWN = moving on normal volume.",
                  },
                ],
              },
              {
                title: "Confidence score (0–100)",
                rows: [
                  {
                    term: "Trend · 30",
                    desc: "Where the move ranks among stocks moving the same way today (biggest mover ≈ full marks).",
                  },
                  {
                    term: "Rel. volume · 15",
                    desc: "Volume vs normal pace. Full marks at ~2.2×.",
                  },
                  {
                    term: "VWAP · 15",
                    desc: "On the right side of VWAP for its direction = 9+, more the further it holds. Wrong side = 0–3.",
                  },
                  {
                    term: "30m momentum · 10",
                    desc: "Is the last 30 minutes still moving in the trend direction?",
                  },
                  {
                    term: "Structure · 10",
                    desc: "Recent swings making higher highs/lows (bull) or lower highs/lows (bear).",
                  },
                  {
                    term: "Sector flow · 10",
                    desc: "Its sector’s money flowing the same way.",
                  },
                  {
                    term: "Big money · 10",
                    desc: "Share of buying vs selling flow in the stock.",
                  },
                  {
                    term: "Order block · +5",
                    desc: "Bonus for an unfilled order block close to price.",
                  },
                  {
                    term: "Adjustment",
                    desc: "×0.88 if the stock is choppy (light volume or tiny move).",
                  },
                ],
              },
              {
                title: "Hover box & levels",
                rows: [
                  {
                    term: "Rank",
                    desc: "Position among the 15 gainers or losers by % move.",
                  },
                  {
                    term: "Vol · % buy",
                    desc: "Volume vs normal, and share of up-volume.",
                  },
                  {
                    term: "Δ",
                    desc: "Net shares bought minus sold today.",
                  },
                  {
                    term: "OB / Zone",
                    desc: "Order block: the last opposite candle before a strong move — where big orders sat. The zone is the one price would most likely react at.",
                  },
                  {
                    term: "R1 · R2",
                    desc: "Resistance levels above price (first and second target for longs).",
                  },
                  {
                    term: "S1 · S2",
                    desc: "Support levels below price (first and second target for shorts).",
                  },
                  {
                    term: "Z/S1 · Z/R1",
                    desc: "Entry at the zone and the stop level.",
                  },
                  {
                    term: "R:R",
                    desc: "Reward-to-risk: distance to target ÷ distance to stop.",
                  },
                  {
                    term: "Rule (3 types)",
                    desc: (
                      <>
                        Every stock gets one of three.{" "}
                        <b style={{ color: "#e6ebe8" }}>PICK</b> — trending with
                        real volume and price within 1.2% of its order zone:
                        actionable now. <b style={{ color: "#eef2f4" }}>WATCH</b>{" "}
                        — trending, but price is more than 1.2% from the zone:
                        wait for a pullback.{" "}
                        <b style={{ color: "#eef2f4" }}>NO SETUP</b> — choppy
                        (move too small for the time of day, or volume under
                        1.05× normal): stay out. The #number after PICK/WATCH is
                        its rank among the 15 on its side.
                      </>
                    ),
                  },
                  {
                    term: "Timeframe",
                    desc: "1m · 3m · 5m · 15m candles for the chart.",
                  },
                ],
              },
              {
                title: "Chart layers",
                rows: [
                  {
                    term: "Order blocks",
                    desc: "Green (bull) / red (bear) boxes from the last opposite candle before a strong move. Faded once price closes back through.",
                  },
                  {
                    term: "VWAP",
                    desc: "Purple dashed line.",
                  },
                  {
                    term: "FVG",
                    desc: "Fair value gap — a 3-candle price gap the market often comes back to fill. Fades once filled.",
                  },
                  {
                    term: "Liquidity",
                    desc: 'BSL (above swing highs) and SSL (below swing lows) — where stop orders cluster. “✕ swept” once price has taken them.',
                  },
                  {
                    term: "Structure",
                    desc: (
                      <>
                        Everything market-structure in one toggle:{" "}
                        <b style={{ color: "#eef2f4" }}>HH / HL / LH / LL</b>{" "}
                        swing labels · <b style={{ color: "#eef2f4" }}>BOS</b>{" "}
                        (break of structure, trend continues) and{" "}
                        <b style={{ color: "#eef2f4" }}>CHoCH</b> (change of
                        character, trend flips) ·{" "}
                        <b style={{ color: "#eef2f4" }}>EQH / EQL</b> equal
                        highs/lows (liquidity pools) ·{" "}
                        <b style={{ color: "#eef2f4" }}>Double top / bottom</b>{" "}
                        once the neckline breaks ·{" "}
                        <b style={{ color: "#eef2f4" }}>Trendlines</b> through the
                        last two swing highs and lows, with the pattern they form
                        (ascending / descending / symmetrical triangle, rising /
                        falling wedge, channel or range) ·{" "}
                        <b style={{ color: "#eef2f4" }}>HOD / LOD</b> high and
                        low of day ·{" "}
                        <b style={{ color: "#eef2f4" }}>ORH / ORL</b> opening-range
                        high/low (first 30 min) ·{" "}
                        <b style={{ color: "#eef2f4" }}>PDH / PDL</b> previous day
                        high/low ·{" "}
                        <b style={{ color: "#eef2f4" }}>Premium / Discount</b>{" "}
                        halves of today’s range split at{" "}
                        <b style={{ color: "#eef2f4" }}>EQ 50%</b> — longs are
                        better taken in discount, shorts in premium.
                      </>
                    ),
                  },
                ],
              },
            ].map((sec) => (
              <div
                key={sec.title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  breakInside: "avoid",
                  marginBottom: 18,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', Manrope, sans-serif",
                    fontWeight: 600,
                    fontSize: 18,
                    color: "#f0d68c",
                  }}
                >
                  {sec.title}
                </span>
                {sec.rows.map((r) => (
                  <div
                    key={r.term}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "190px minmax(0,1fr)",
                      gap: 12,
                      borderBottom: "1px solid #161b1d",
                      paddingBottom: 7,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#ffffffff",
                      }}
                    >
                      {r.term}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "#ffffffff",
                      }}
                    >
                      {r.desc}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
