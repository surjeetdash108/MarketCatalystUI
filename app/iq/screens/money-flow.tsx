"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  boardCandles,
  computeSquarifiedTiles,
  etTimeLabel,
  formatCompactDollars,
  formatCurrency,
  formatLevel,
  formatMarketCap,
  formatPct,
  indexCard,
  sectorNotOnBoardText,
  sectorView,
  sessionCandles,
  sessionDateLabel,
  type BoardStock,
  type MoneyFlowBoard,
  type TileLayout,
} from "../money-flow/engine";
import {
  SparklineSvg,
  MiniProfileSvg,
  FullChartSvg,
} from "../money-flow/chart-svg";
import { useIQActions } from "../shell";
import { ModuleSwitcher } from "../module-switcher";
import { useSI } from "../si/si-context";
import { useBackendMarketStatus } from "../hooks/useBackendMarketStatus";
import { useApiResource } from "../hooks/useApiResource";
import { useTapeStream } from "../hooks/useTapeStream";
import { tapeItemsToIndexDocs } from "../live-market-indices";
import { useLiveQuotes } from "../live-quotes-context";

/** Board refresh: the backend rebuilds every 30s from 15-minute-delayed bars. */
const BOARD_POLL_MS = 30_000;

interface BarsResponse {
  bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number; vw: number | null }>;
}

export function MoneyFlowScreen() {
  const { openStock, openIndex } = useIQActions();
  const { exitToMC, enterSI } = useSI();

  // The whole board — flows, movers, levels, scores — from GET /live/money-flow.
  const { data: board, loading: boardLoading, error: boardError } =
    useApiResource<MoneyFlowBoard>("/live/money-flow", BOARD_POLL_MS);

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
    stock: BoardStock;
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

  // Popover chart: the hovered stock's real 1-minute bars, grouped to the
  // chosen timeframe for the board's session.
  const popSym = hoveredStock?.stock.t ?? null;
  const { data: popBars, loading: popBarsLoading } = useApiResource<BarsResponse>(
    popSym ? `/live/bars?ticker=${encodeURIComponent(popSym)}&interval=1m` : null,
  );
  const popCandles = useMemo(
    () => (popBars?.bars && board ? sessionCandles(popBars.bars, board.sessionDate, popTf) : []),
    [popBars, board, popTf],
  );

  const gainers = useMemo(() => board?.gainers ?? [], [board]);
  const losers = useMemo(() => board?.losers ?? [], [board]);
  const onBoard = useMemo(() => [...gainers, ...losers], [gainers, losers]);

  // Sector calculations (inflow / outflow boxes, remaining list)
  const sectorData = useMemo(() => sectorView(board?.sectors ?? []), [board]);
  const remainingSectors = sectorData.remaining;

  // Active sector to highlight: either hovered or selected
  const activeSector = hoveredSector || selectedSector;

  // #1–#3 are cards, #4–#15 tiles, on each side
  const top3Bull = gainers.slice(0, 3);
  const next12Bull = gainers.slice(3, 15);
  const top3Bear = losers.slice(0, 3);
  const next12Bear = losers.slice(3, 15);

  // Notice when the highlighted sector has no stock on either board
  const noneInTop15Txt = useMemo(
    () => sectorNotOnBoardText(activeSector, board?.sectors ?? [], onBoard),
    [activeSector, board, onBoard],
  );

  const bullTiles: TileLayout[] = useMemo(() => computeSquarifiedTiles(next12Bull, true), [next12Bull]);
  const bearTiles: TileLayout[] = useMemo(() => computeSquarifiedTiles(next12Bear, false), [next12Bear]);
  const stockByT = useMemo(() => new Map(onBoard.map((s) => [s.t, s])), [onBoard]);

  // Index cards from the FMP tape stream (identical to Dashboard Market Pulse)
  const { frame: tapeFrame } = useTapeStream();
  const liveIndices = useMemo(
    () => (tapeFrame ? tapeItemsToIndexDocs(tapeFrame.items) : []),
    [tapeFrame]
  );
  const find = (ids: string[]) => liveIndices.find((i) => ids.includes(i.id));
  const num = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const spx = indexCard(find(["SPX"]), num);
  const ndx = indexCard(find(["NDX"]), num);
  const wti = indexCard(find(["WTI"]), (v) => `$${v.toFixed(2)}`);
  const gold = indexCard(find(["GOLD"]), (v) => `$${num(v)}`);

  // S&P 500 breadth: constituents up / down vs the previous close
  const breadth = board?.breadth ?? { advancers: 0, decliners: 0, unchanged: 0, total: 0 };
  const advCount = breadth.advancers;
  const decCount = breadth.decliners;
  const advPct = breadth.total > 0 ? Math.round((advCount / breadth.total) * 100) : null;

  // What the board covers and how fresh its bars are
  const sessionLine = board
    ? `${sessionDateLabel(board.sessionDate)} session · ${
        board.barsThrough != null
          ? `flows through ${etTimeLabel(board.barsThrough)} ET (${board.delayMinutes}-min delayed)`
          : `flows start at 9:${30 + board.delayMinutes} AM ET (${board.delayMinutes}-min delayed)`
      } · ${board.universe.priced} of ${board.universe.total} S&P 500 / Nasdaq-100 stocks`
    : boardError
      ? "Money Flow is unavailable right now."
      : "Building the board…";

  const boardWrapRef = useRef<HTMLDivElement>(null);

  // Subscribe all stocks on board to live quotes for after-hours pricing
  const allBoardTickers = useMemo(() => onBoard.map((s) => s.t), [onBoard]);
  const liveQuotes = useLiveQuotes(allBoardTickers);
  const isAfterHours = mkt.phase === "after";

  const getDisplayQuote = (stock: BoardStock) => {
    if (!isAfterHours) {
      return {
        priceStr: formatCurrency(stock.price),
        pctStr: formatPct(stock.pctChange),
        isUp: stock.pctChange >= 0,
        isAH: false,
      };
    }
    const q = liveQuotes.get(stock.t);
    const ahPrice = q?.price ?? stock.price;
    const regPrice = q?.regularClose ?? stock.price;
    let ahPct = q?.latePct ?? null;
    if (ahPct == null && ahPrice != null && regPrice > 0 && Math.abs(ahPrice - regPrice) > 0.001) {
      ahPct = ((ahPrice - regPrice) / regPrice) * 100;
    }
    const pctVal = ahPct ?? 0;
    return {
      priceStr: `AH ${formatCurrency(ahPrice)}`,
      pctStr: formatPct(pctVal),
      isUp: pctVal >= 0,
      isAH: true,
    };
  };

  const handleTileEnter = (stock: BoardStock, e: React.MouseEvent) => {
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
          font-size: 15px;
          font-weight: 600;
          line-height: 1.4;
          color: #ffffff;
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
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mf-mid-card {
          flex: 1 1 0;
          min-height: 0;
          overflow: hidden;
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
              {mkt.label}
            </span>
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
        <div className="mf-board-wrap" ref={boardWrapRef}>
          {/* ── Left Column: Indices & Sectors ── */}
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
                { n: "S&P 500", ...spx, action: () => openIndex?.("S&P 500") },
                { n: "NASDAQ", ...ndx, action: () => openIndex?.("NASDAQ") },
                { n: "WTI CRUDE", ...wti, action: () => openIndex?.("WTI Crude") },
                { n: "GOLD", ...gold, action: () => openIndex?.("Gold") },
              ].map((ix) => {
                const col = ix.isUp == null ? "#7a8481" : ix.isUp ? "#3ddc84" : "#f0565a";
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
                      minWidth: 0,
                      overflow: "hidden",
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
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ix.n}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        columnGap: 6,
                        rowGap: 0,
                        minWidth: 0,
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
                        {ix.isUp == null ? "" : ix.isUp ? "▲ " : "▼ "}{ix.chg}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Sectors Split: remaining sectors + Top 2 In/Out + Breadth */}
            <div
              className="mf-sectors-split"
              style={{
                position: "relative",
                flex: 1,
                minHeight: 0,
                display: "flex",
              }}
            >
              {/* Remaining sectors (excludes the Top 2 In/Out boxes) */}
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
                  position: "relative",
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
                    position: "relative",
                  }}
                >
                  {noneInTop15Txt && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        pointerEvents: "none",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: "#f0d68c",
                        background: "rgba(11,13,14,0.96)",
                        border: "1px solid #5a4a22",
                        borderRadius: 6,
                        padding: "5px 7px",
                        lineHeight: 1.3,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
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
                      height: 400,
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
                      color: advPct == null ? "#7a8481" : advPct >= 50 ? "#3ddc84" : "#f0565a",
                    }}
                  >
                    {advPct == null ? "—" : `${advPct}%`}
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
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 6,
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
                  {board ? "No bullish stocks this session" : sessionLine}
                </div>
              ) : (
                top3Bull.map((fc, i) => {
                  const candles = boardCandles(fc);
                  const confScore = fc.confidence?.score ?? null;
                  const isSecMatch = Boolean(activeSector && fc.sector === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  const cardQuote = getDisplayQuote(fc);
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
                        padding: "5px 8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
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
                            src={`https://financialmodelingprep.com/image-stock/${fc.t.replace(".", "-")}.png`}
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
                            {cardQuote.priceStr}
                          </span>
                          <span style={{ fontSize: 10.5, color: cardQuote.isUp ? "#3ddc84" : "#f0565a" }}>
                            {cardQuote.pctStr}
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
                            background: `conic-gradient(#3ddc84 ${(confScore ?? 0) * 3.6}deg, #1a2328 0)`,
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
                            {confScore ?? "—"}
                          </span>
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div
                        style={{
                          position: "relative",
                          flex: "1 1 0",
                          minHeight: 18,
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
                          {(fc.rvol ?? 0) >= 1.4 ? "ACCUMULATION" : "MOMENTUM UP"}
                        </span>
                      </div>

                      {/* Key Levels Table */}
                      <div
                        style={{
                          flex: "none",
                          display: "grid",
                          gridTemplateColumns:
                            "1.7fr 1fr 1fr 1fr 1fr 1fr",
                          gap: 3,
                          borderTop: "1px solid rgba(61,220,132,.25)",
                          paddingTop: 3,
                          marginTop: 1,
                        }}
                      >
                        {[
                          {
                            k: "ZONE",
                            v: fc.zone ? `${fc.zone.lo.toFixed(1)}–${fc.zone.hi.toFixed(1)}` : "—",
                            c: "#e0bb5e",
                          },
                          { k: "R2", v: formatLevel(fc.pivots?.r2, 1), c: "#e0bb5e" },
                          { k: "R1", v: formatLevel(fc.pivots?.r1, 1), c: "#e0bb5e" },
                          { k: "S1", v: formatLevel(fc.pivots?.s1, 1), c: "#e6ebe8" },
                          { k: "S2", v: formatLevel(fc.pivots?.s2, 1), c: "#f0565a" },
                          { k: "R:R", v: fc.rr == null ? "—" : `1:${fc.rr.toFixed(1)}`, c: "#e6ebe8" },
                        ].map((l) => (
                          <span
                            key={l.k}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: ".06em",
                                color: "#7a8481",
                                lineHeight: 1,
                              }}
                            >
                              {l.k}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: l.c,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                lineHeight: 1.2,
                              }}
                              title={String(l.v)}
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
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 6,
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
                  {board ? "No bearish stocks this session" : sessionLine}
                </div>
              ) : (
                top3Bear.map((fc, i) => {
                  const candles = boardCandles(fc);
                  const confScore = fc.confidence?.score ?? null;
                  const isSecMatch = Boolean(activeSector && fc.sector === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  const cardQuote = getDisplayQuote(fc);
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
                        padding: "5px 8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
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
                            src={`https://financialmodelingprep.com/image-stock/${fc.t.replace(".", "-")}.png`}
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
                            {cardQuote.priceStr}
                          </span>
                          <span style={{ fontSize: 10.5, color: cardQuote.isUp ? "#3ddc84" : "#f0565a" }}>
                            {cardQuote.pctStr}
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
                            background: `conic-gradient(#f0565a ${(confScore ?? 0) * 3.6}deg, #1a2328 0)`,
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
                            {confScore ?? "—"}
                          </span>
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div
                        style={{
                          position: "relative",
                          flex: "1 1 0",
                          minHeight: 18,
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
                          {(fc.rvol ?? 0) >= 1.4 ? "DISTRIBUTION" : "MOMENTUM DOWN"}
                        </span>
                      </div>

                      {/* Key Levels Table */}
                      <div
                        style={{
                          flex: "none",
                          display: "grid",
                          gridTemplateColumns:
                            "1.7fr 1fr 1fr 1fr 1fr 1fr",
                          gap: 3,
                          borderTop: "1px solid rgba(240,86,90,.25)",
                          paddingTop: 3,
                          marginTop: 1,
                        }}
                      >
                        {[
                          {
                            k: "ZONE",
                            v: fc.zone ? `${fc.zone.lo.toFixed(1)}–${fc.zone.hi.toFixed(1)}` : "—",
                            c: "#e0bb5e",
                          },
                          { k: "R2", v: formatLevel(fc.pivots?.r2, 1), c: "#e0bb5e" },
                          { k: "R1", v: formatLevel(fc.pivots?.r1, 1), c: "#e0bb5e" },
                          { k: "S1", v: formatLevel(fc.pivots?.s1, 1), c: "#e6ebe8" },
                          { k: "S2", v: formatLevel(fc.pivots?.s2, 1), c: "#f0565a" },
                          { k: "R:R", v: fc.rr == null ? "—" : `1:${fc.rr.toFixed(1)}`, c: "#e6ebe8" },
                        ].map((l) => (
                          <span
                            key={l.k}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: ".06em",
                                color: "#7a8481",
                                lineHeight: 1,
                              }}
                            >
                              {l.k}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: l.c,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                lineHeight: 1.2,
                              }}
                              title={String(l.v)}
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
                  {board ? "No more bullish stocks" : ""}
                </div>
              ) : (
                bullTiles.map((x) => {
                  const fullStock = stockByT.get(x.t)!;
                  const candles = boardCandles(fullStock);
                  const isSecMatch = Boolean(activeSector && fullStock?.sector === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  const tileQuote = fullStock ? getDisplayQuote(fullStock) : null;
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
                          {x.conf ?? "—"}
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
                                src={`https://financialmodelingprep.com/image-stock/${x.t.replace(".", "-")}.png`}
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
                              color: tileQuote ? (tileQuote.isUp ? "#3ddc84" : "#f0565a") : "#3ddc84",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: 9, color: "#7a8481" }}>
                              #{x.rank}{" "}
                            </span>
                            {tileQuote?.isAH ? `AH ${tileQuote.pctStr}` : x.chg}
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
                  {board ? "No more bearish stocks" : ""}
                </div>
              ) : (
                bearTiles.map((x) => {
                  const fullStock = stockByT.get(x.t)!;
                  const candles = boardCandles(fullStock);
                  const isSecMatch = Boolean(activeSector && fullStock?.sector === activeSector);
                  const isDimmed = Boolean(activeSector && !isSecMatch);
                  const tileQuote = fullStock ? getDisplayQuote(fullStock) : null;
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
                          {x.conf ?? "—"}
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
                                src={`https://financialmodelingprep.com/image-stock/${x.t.replace(".", "-")}.png`}
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
                              color: tileQuote ? (tileQuote.isUp ? "#3ddc84" : "#f0565a") : "#f0565a",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: 9, color: "#7a8481" }}>
                              #{x.rank}{" "}
                            </span>
                            {tileQuote?.isAH ? `AH ${tileQuote.pctStr}` : x.chg}
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
            const boardRect = boardWrapRef.current?.getBoundingClientRect();
            const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;
            let popLeft: number | string = 12;
            let popTop: number | string = 16;
            let popWidth: number | string = "50vw";
            let popHeight: number | string = "auto";
            let popTransform = "none";

            if (isMobileScreen) {
              popLeft = 12;
              popTop = "50%";
              popTransform = "translateY(-50%)";
              popWidth = "calc(100vw - 24px)";
              popHeight = "calc(100vh - 40px)";
            } else if (typeof window !== "undefined") {
              // Popover width: half the screen size
              const calculatedPopW = Math.round(window.innerWidth * 0.5);
              popWidth = calculatedPopW;

              // Height: starts 20px below borderline above Top 3 Bullish Stocks (boardRect.top + 20)
              // and ends 20px above borderline at bottom (boardRect.bottom - 20)
              const topAnchor = boardRect ? boardRect.top + 20 : 100;
              const bottomAnchor = boardRect ? boardRect.bottom - 20 : window.innerHeight - 20;
              popTop = Math.max(10, topAnchor);
              popHeight = Math.max(340, bottomAnchor - popTop);

              // Horizontal positioning: beside the stock tile, NEVER on top of it
              const rect = hoveredStock.rect;
              const isTileInRightHalf = (rect.left + rect.width / 2) > (window.innerWidth / 2);

              if (isTileInRightHalf) {
                // Place to the left of the hovered stock
                popLeft = rect.left - calculatedPopW - 16;
                if (boardRect && popLeft < boardRect.left + 8) {
                  popLeft = Math.max(12, boardRect.left + 8);
                }
                // If it overlaps the stock, push further left
                if (popLeft + calculatedPopW > rect.left) {
                  popLeft = Math.max(12, rect.left - calculatedPopW - 8);
                }
              } else {
                // Place to the right of the hovered stock
                popLeft = rect.right + 16;
                const rightBoundary = (boardRect ? boardRect.right - 8 : window.innerWidth - 12) - calculatedPopW;
                if (popLeft > rightBoundary) {
                  popLeft = Math.min(window.innerWidth - calculatedPopW - 12, rightBoundary);
                }
                // If it overlaps the stock, push further right
                if (popLeft < rect.right) {
                  popLeft = Math.min(window.innerWidth - calculatedPopW - 12, rect.right + 8);
                }
              }
            }

            return {
              position: "fixed" as const,
              zIndex: 9999,
              left: popLeft,
              top: popTop,
              transform: popTransform,
              width: popWidth,
              height: popHeight,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto" as const,
              pointerEvents: "auto" as const,
              background: "#0b0d0e",
              border: `1px solid ${(hoveredStock.stock.pctChange >= 0)
                ? "rgba(61,220,132,.45)"
                : "rgba(240,86,90,.45)"
                }`,
              borderBottom: `2px solid ${(hoveredStock.stock.pctChange >= 0) ? "#3ddc84" : "#f0565a"
                }`,
              borderRadius: 12,
              boxShadow: "0 24px 60px rgba(0,0,0,.75)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column" as const,
              gap: 8,
              boxSizing: "border-box" as const,
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
                boxShadow: `0 0 0 1px ${(hoveredStock.stock.pctChange >= 0) ? "#3ddc84" : "#f0565a"
                  }`,
              }}
            >
              <img
                src={`https://financialmodelingprep.com/image-stock/${hoveredStock.stock.t.replace(".", "-")}.png`}
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
                {hoveredStock.stock.name ?? hoveredStock.stock.t} · {hoveredStock.stock.sector ?? "—"}
              </span>
            </div>
            {(() => {
              const q = getDisplayQuote(hoveredStock.stock);
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#eef2f4" }}>
                    {q.priceStr}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: q.isUp ? "#3ddc84" : "#f0565a",
                    }}
                  >
                    {q.pctStr}
                  </span>
                </div>
              );
            })()}
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
                v: hoveredStock.stock.confidence ? String(hoveredStock.stock.confidence.score) : "—",
                c: (hoveredStock.stock.pctChange >= 0) ? "#3ddc84" : "#f0565a",
                b: true,
              },
              {
                k: "Setup",
                v: hoveredStock.stock.chop
                  ? "Choppy"
                  : (hoveredStock.stock.pctChange >= 0)
                    ? "Bullish"
                    : "Bearish",
                c: hoveredStock.stock.chop
                  ? "#7a8481"
                  : (hoveredStock.stock.pctChange >= 0)
                    ? "#3ddc84"
                    : "#f0565a",
                b: false,
              },
              {
                k: "Mkt Cap",
                v: formatMarketCap(hoveredStock.stock.marketCap),
                c: "#eef2f4",
                b: false,
              },
              {
                k: "Net Flow",
                v: `${formatCompactDollars(hoveredStock.stock.netFlow)} ${hoveredStock.stock.netFlow >= 0 ? "in" : "out"}`,
                c: hoveredStock.stock.netFlow >= 0 ? "#3ddc84" : "#f0565a",
                b: false,
              },
              {
                k: "Support (S1)",
                v: formatLevel(hoveredStock.stock.pivots?.s1),
                c: "#3ddc84",
                b: false,
              },
              {
                k: "Resistance (R1)",
                v: formatLevel(hoveredStock.stock.pivots?.r1),
                c: "#f0565a",
                b: false,
              },
              {
                k: "Order Zone",
                v: hoveredStock.stock.zone
                  ? `${formatCurrency(hoveredStock.stock.zone.lo)}–${formatCurrency(hoveredStock.stock.zone.hi)}`
                  : "—",
                c: "#e0bb5e",
                b: false,
              },
              {
                k: "Vol & R:R",
                v: `${hoveredStock.stock.rvol == null ? "—" : `${hoveredStock.stock.rvol.toFixed(1)}×`} · ${hoveredStock.stock.rr == null ? "—" : `1:${hoveredStock.stock.rr.toFixed(1)}`}`,
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
              flex: "1 1 auto",
              minHeight: 280,
              borderRadius: 8,
              border: "1px solid #171c1e",
              background: "#08090a",
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "thin",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {popBarsLoading && popCandles.length === 0 ? (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#7a8481", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                Loading {hoveredStock.stock.t} 1-minute bars…
              </div>
            ) : (
            <FullChartSvg
              stock={hoveredStock.stock}
              candles={popCandles}
              layers={popLayers}
              tf={popTf}
              width={typeof window !== "undefined" && window.innerWidth >= 768 ? Math.max(560, Math.round(window.innerWidth * 0.5) - 36) : 440}
              height={typeof window !== "undefined" && boardWrapRef.current ? Math.max(280, Math.round(boardWrapRef.current.getBoundingClientRect().height - 40 - 200)) : 320}
            />
            )}
          </div>

          {/* Action buttons — single line, half width each */}
          <div style={{ display: "flex", flexDirection: "row", gap: 8, marginTop: 6, flex: "none" }}>
            <button
              type="button"
              onClick={() => {
                const sym = hoveredStock.stock.t;
                setHoveredStock(null);
                exitToMC(sym);
              }}
              style={{
                flex: "1 1 0",
                width: "50%",
                padding: "9px 8px",
                borderRadius: 6,
                background: "#4ade80",
                border: "1px solid #22c55e",
                color: "#05210f",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
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
                flex: "1 1 0",
                width: "50%",
                padding: "9px 8px",
                borderRadius: 6,
                background: "#161b1d",
                border: "1px solid #233038",
                color: "#7fa8d0",
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
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

            {/* Glossary Sections — each entry states the basis the backend uses (board.basis) */}
            {[
              {
                title: "Data",
                rows: [
                  {
                    term: "Universe",
                    desc: "S&P 500 and Nasdaq-100 constituents (FMP); a stock in both counts once.",
                  },
                  {
                    term: "Price · % move",
                    desc: "FMP quote: last price and % change from the previous official close — the same quote the rest of the app shows.",
                  },
                  {
                    term: "Candles",
                    desc: "Polygon 5-minute bars, regular session 9:30–4:00 ET, 15 minutes delayed. Before the open the board shows the last completed session.",
                  },
                ],
              },
              {
                title: "Sector Money Flow",
                rows: [
                  {
                    term: "Money flow ($)",
                    desc: "Money Flow Index method on every 5-minute bar: typical price (high + low + close) ÷ 3 × volume counts as inflow when the typical price rose from the bar before and as outflow when it fell (the first bar compares with the previous close). Net flow = inflow − outflow. A sector’s flow is the sum of its stocks.",
                  },
                  {
                    term: "Sector % (grey)",
                    desc: "Equal-weighted average % move of the sector’s stocks.",
                  },
                  {
                    term: "Sector",
                    desc: "The app’s sector for the stock (as on Stock Detail).",
                  },
                  {
                    term: "Bar length",
                    desc: "Sector flow relative to the biggest sector flow on the board.",
                  },
                  {
                    term: "Sectors column",
                    desc: "Every sector with at least one stock in the universe, inflows first (biggest at top), then outflows, minus the ones pulled into the Top 2 boxes.",
                  },
                  {
                    term: "Top 2 boxes",
                    desc: "The two sectors with the largest positive net flow (green) and the two with the largest negative net flow (red). On a one-sided day there can be fewer.",
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
                    desc: "S&P 500 (^GSPC), Nasdaq Composite (^IXIC), WTI crude and gold futures from the FMP tape: level and % change. A dash means the tape has no value yet.",
                  },
                  {
                    term: "Breadth bar",
                    desc: "S&P 500 constituents up vs down from the previous close (e.g. 387 ▲ / 116 ▼); the % is advancers ÷ all constituents priced.",
                  },
                ],
              },
              {
                title: "Gainer & loser boxes",
                rows: [
                  {
                    term: "Ranking",
                    desc: "Top 15 each side by % move. #1–#3 are the Top 3 Bullish / Bearish Stocks cards; #4–#15 are tiles, #15 (smallest move) at top-left.",
                  },
                  {
                    term: "Box size",
                    desc: "Proportional to the size of the % move. Very small moves are grouped into the neighbouring column so every tile stays readable.",
                  },
                  {
                    term: "Ring number",
                    desc: "Confidence score 1–99 (see below). A dash means no regular-session bars yet.",
                  },
                  {
                    term: "Volume profile",
                    desc: "Horizontal bars inside a tile: volume traded at each price today (each 5-minute bar’s volume at its mid price). Green = up bars, red = down bars.",
                  },
                  {
                    term: "POC",
                    desc: "Point of control — the price band with the most volume today.",
                  },
                  {
                    term: "Purple dashed line",
                    desc: "VWAP — regular-session volume-weighted average price.",
                  },
                  {
                    term: "White line + arrow",
                    desc: "Last 5-minute close.",
                  },
                  {
                    term: "vs sector",
                    desc: "Stock’s % move minus its sector’s average move. Positive = leading its group.",
                  },
                  {
                    term: "30m",
                    desc: "Change over the last 30 minutes (six 5-minute bars), in % of the previous close.",
                  },
                  {
                    term: "Tag",
                    desc: "ACCUMULATION / DISTRIBUTION = relative volume ≥ 1.4×. MOMENTUM UP / DOWN = below that.",
                  },
                  {
                    term: "Relative volume",
                    desc: "Day volume ÷ (20-session average daily volume × share of the regular session elapsed).",
                  },
                ],
              },
              {
                title: "Confidence score (1–99)",
                rows: [
                  {
                    term: "Trend · 30",
                    desc: "Where the move ranks among the universe’s stocks moving the same way today (biggest mover = full marks).",
                  },
                  {
                    term: "Rel. volume · 15",
                    desc: "0 at 0.8× normal pace, full marks at 2.2×.",
                  },
                  {
                    term: "VWAP · 15",
                    desc: "Last close on the right side of VWAP for its direction = 9+, more the further it holds (full at 0.6%). Wrong side = 0–3.",
                  },
                  {
                    term: "30m momentum · 10",
                    desc: "Last 30 minutes still moving in the trend direction (5 = flat, full at 0.2%).",
                  },
                  {
                    term: "Structure · 10",
                    desc: "Share of the last three swing highs and lows stepping in the trend direction (0 with no swings yet).",
                  },
                  {
                    term: "Sector flow · 10",
                    desc: "Its sector’s net flow in the same direction, relative to the largest sector flow.",
                  },
                  {
                    term: "Big money · 10",
                    desc: "The stock’s inflow share of money flow (5 at 50%, full at 70% for longs / 30% for shorts).",
                  },
                  {
                    term: "Order block · +5",
                    desc: "Bonus for an unmitigated order block on its side: 5 with price at the block, easing to 1.5 at 1.5% away or more; 0 with none.",
                  },
                  {
                    term: "Adjustment",
                    desc: "×0.88 if the stock is choppy: relative volume under 1.05×, or a move smaller than 0.6% × min(1, 0.35 + share of session elapsed).",
                  },
                ],
              },
              {
                title: "Hover box & levels",
                rows: [
                  {
                    term: "Setup",
                    desc: "Choppy (see Adjustment above), otherwise Bullish or Bearish by the direction of the move.",
                  },
                  {
                    term: "Mkt Cap",
                    desc: "Polygon weighted shares outstanding × price, as on Stock Detail.",
                  },
                  {
                    term: "Net Flow",
                    desc: "The stock’s money flow today (see Money flow above).",
                  },
                  {
                    term: "R1 · R2 · S1 · S2",
                    desc: "Classic pivot levels from the previous session’s high and low and its official close.",
                  },
                  {
                    term: "Zone",
                    desc: "The most recent unmitigated order block on the side of the move (5-minute bars): the last opposite candle before a move of more than 0.18%. A dash means none today.",
                  },
                  {
                    term: "R:R",
                    desc: "Entry at the zone edge nearest price, stop at its far edge, target at the first pivot level beyond both: |target − entry| ÷ |entry − stop|. A dash means no zone, or price is already past every pivot level.",
                  },
                  {
                    term: "Timeframe",
                    desc: "1m · 3m · 5m · 15m candles for the chart, grouped from Polygon 1-minute bars.",
                  },
                ],
              },
              {
                title: "Chart layers",
                rows: [
                  {
                    term: "Order blocks",
                    desc: "Green (bull) / red (bear) boxes from the last opposite candle before a strong move, on the chart’s timeframe. Faded once price trades back through. The gold box is the board’s zone.",
                  },
                  {
                    term: "VWAP",
                    desc: "Purple dashed line: regular-session VWAP.",
                  },
                  {
                    term: "FVG",
                    desc: "Fair value gap — a 3-candle price gap. Fades once filled.",
                  },
                  {
                    term: "Liquidity",
                    desc: "BSL (above swing highs) and SSL (below swing lows) — where stop orders cluster. “✕ swept” once price has taken them.",
                  },
                  {
                    term: "Structure",
                    desc: (
                      <>
                        <b style={{ color: "#eef2f4" }}>HH / HL / LH / LL</b>{" "}
                        swing labels · <b style={{ color: "#eef2f4" }}>BOS</b>{" "}
                        (a close beyond a prior swing) ·{" "}
                        <b style={{ color: "#eef2f4" }}>Trendlines</b> through the
                        last two swing highs and lows, with the pattern they form
                        (ascending / descending / symmetrical triangle, rising /
                        falling wedge, channel or range) ·{" "}
                        <b style={{ color: "#eef2f4" }}>HOD / LOD</b> high and
                        low of day ·{" "}
                        <b style={{ color: "#eef2f4" }}>ORH / ORL</b> opening-range
                        high/low (first 30 min) ·{" "}
                        <b style={{ color: "#eef2f4" }}>PDH / PDL</b> previous
                        session high/low ·{" "}
                        <b style={{ color: "#eef2f4" }}>Premium / Discount</b>{" "}
                        halves of today’s range split at{" "}
                        <b style={{ color: "#eef2f4" }}>EQ 50%</b>.
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
