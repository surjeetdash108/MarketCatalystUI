"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { CandleChart, ChartSelect, IntervalMenu, CHART_TYPE_OPTIONS, DataState, Spark, StockLogo, VendorTag, type BarInterval, type ChartEarnings } from "./utils";
import type { OHLCBar } from "./candle-chart";
import { ExpandBtn } from "./shell";
import { useApiResource } from "./hooks/useApiResource";
import { useBackendBars, useIntervalBars } from "./hooks/useBackendBars";
import { useLiveTick, type UseLiveTickResult } from "./hooks/useLiveTick";
import { useHeadlineQuote, QuoteHeadline } from "./quote-headline";
import { useChartEarnings } from "./hooks/useChartEarnings";
import { useKeyMoments } from "./key-moments";
import type { CompanyDoc, NewsArticleDoc } from "./types";

/* ── Shared dynamic embed — one definition for all screens ── */
export const StockScreenEmbed = dynamic<{
  initialSym?: string;
  hideHeader?: boolean;
  hideIdentity?: boolean;
  hideChart?: boolean;
  headerActions?: React.ReactNode;
  visibleTabs?: ("overview" | "analysis" | "peers" | "earnings" | "financials" | "holdings" | "13f" | "news")[];
  initialTab?: "overview" | "analysis" | "peers" | "earnings" | "financials" | "holdings" | "13f" | "news";
  barInterval?: BarInterval;
}>(
  () => import("./screens/stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

/* ── Trash SVG ── */
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

/** Clock with a counter-clockwise arrow — the conventional "history" glyph. */
function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/* ── StockRow: one pf-li row ── */
export function StockRow({
  sym, name, seed, sparkUp,
  isSelected, onClick, onDelete, onHistory, muted = false, tag, tagTitle,
  valueTop, valueBottom, valueBottomClass = "",
}: {
  sym: string;
  name: string;
  seed: number;
  sparkUp: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
  /** Shows a history button that opens this row's transaction history. */
  onHistory?: () => void;
  /** Dims the row, e.g. for a closed position. */
  muted?: boolean;
  /** Small label shown after the symbol, e.g. the share count. */
  tag?: string;
  /** Hover text explaining the tag. */
  tagTitle?: string;
  valueTop: string;
  valueBottom: string;
  valueBottomClass?: string;
}) {
  return (
    <div
      className={`pf-li${isSelected ? " active" : ""}${muted ? " muted" : ""}`}
      // A row with a tag gives the (currently empty) sparkline slot's width to
      // the symbol line, so the symbol and its tag stay on one line.
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${tag ? "0px" : "60px"} auto${onDelete || onHistory ? " auto" : ""}` }}
      onClick={onClick}
    >
      <div>
        {tag ? (
          <span className="pf-symline">
            <span className="s">{sym}</span>
            <span className="pf-tag" title={tagTitle}>{tag}</span>
          </span>
        ) : (
          <span className="s">{sym}</span>
        )}
        <span className="n">{name}</span>
      </div>
      <div className="pf-spark">
        <Spark seed={seed} up={sparkUp} />
      </div>
      <div>
        <span className="px">{valueTop}</span>
        <span className={`ch${valueBottomClass ? ` ${valueBottomClass}` : ""}`}>{valueBottom}</span>
      </div>
      {(onDelete || onHistory) && (
        <div className="pf-li-actions">
          {onHistory && (
            <button
              className="pf-hist-btn"
              title="Transaction history"
              aria-label={`${sym} transaction history`}
              onClick={e => { e.stopPropagation(); onHistory(); }}
            >
              <HistoryIcon />
            </button>
          )}
          {onDelete && (
            <button className="wl-del-btn" title="Remove" onClick={e => { e.stopPropagation(); onDelete(); }}>
              <TrashIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── StockListCard: 340px card with scrollable list ── */
export function StockListCard({
  title, titleCount, headerRight, isEmpty, emptyMessage = "No items.", loading, maxListHeight, showVendor = true, children,
}: {
  title: string;
  /** Optional count pill rendered right after the title (e.g. "Holdings 3"). */
  titleCount?: ReactNode;
  headerRight?: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** True while the underlying fetch is still in flight — shows a spinner instead of the empty message. */
  loading?: boolean;
  maxListHeight?: number;
  /** The Polygon source tag — off for lists that aren't vendor data (e.g. chart notes). */
  showVendor?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="sp-listcard" style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="card-h">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <h3>{title}</h3>
            {titleCount != null && (
              <span
                className="pill"
                style={{
                  background: "var(--surface-3)",
                  color: "var(--text-hi)",
                  border: "1px solid var(--border-strong)",
                  fontSize: ".7rem",
                  padding: "2px 8px",
                  lineHeight: 1.3,
                }}
              >{titleCount}</span>
            )}
            {showVendor && <VendorTag v="polygon" />}
          </span>
          {headerRight}
        </div>
        <div className="pf-list" style={{ flex: 1, maxHeight: maxListHeight ?? "none", overflowY: "auto" }}>
          {isEmpty ? <DataState loading={loading} label={emptyMessage} /> : children}
        </div>
      </div>
    </div>
  );
}

type ChartType = "Candles" | "Hollow" | "Bars" | "Line" | "Area";

/**
 * Data a caller already holds, handed to StockChart so it does not fetch it a
 * second time (the stock page has all of it for its other sections). Anything
 * left undefined StockChart fetches itself; `null` means "provided, not loaded
 * yet" and is never refetched.
 */
export interface StockChartData {
  live?: UseLiveTickResult;
  bars?: { bars: OHLCBar[] | undefined; loading: boolean };
  yearBars?: OHLCBar[] | null;
  news?: NewsArticleDoc[] | null;
  earnings?: ChartEarnings[];
}

/**
 * THE stock price chart — the one the stock page shows, reused as-is by every
 * panel (Earnings Hub, watchlist, portfolio, screener, themes, notes) so they
 * all get the same toolbar, markers and behaviour: candle SIZE (not a date
 * range), live delayed tick folded onto the forming candle, earnings and
 * key-moment markers on by default.
 *
 * The candle size is controlled when `interval` + `onIntervalChange` are both
 * passed (the stock page and StockPanelLayout share it with the technical
 * rating), else kept locally from `initial`.
 */
export function StockChart({
  sym, name, px, height, interval: intervalProp, onIntervalChange, initial, data = {}, expandable,
}: {
  sym: string;
  name?: string | null;
  px?: number;
  height?: number | string;
  interval?: BarInterval;
  onIntervalChange?: (iv: BarInterval) => void;
  initial?: { interval?: BarInterval; chartType?: ChartType; showEarnings?: boolean; showMoments?: boolean };
  data?: StockChartData;
  /** Adds the expand button, which opens this same chart in a full-size modal. */
  expandable?: boolean;
}) {
  const [ownInterval, setOwnInterval] = useState<BarInterval>(initial?.interval ?? "1D");
  const controlled = intervalProp != null && onIntervalChange != null;
  const interval = controlled ? intervalProp : ownInterval;
  const setBarInterval = controlled ? onIntervalChange : setOwnInterval;
  const [chartType, setChartType] = useState<ChartType>(initial?.chartType ?? "Candles");
  const [showEarnings, setShowEarnings] = useState(initial?.showEarnings ?? true);
  const [showMoments, setShowMoments] = useState(initial?.showMoments ?? true);

  const ownBars = useIntervalBars(sym, interval, data.bars === undefined);
  const { bars: realBars, loading } = data.bars ?? ownBars;
  // An empty symbol keeps useLiveTick from opening a second stream.
  const ownLive = useLiveTick(data.live ? "" : sym);
  const { tick } = data.live ?? ownLive;
  // Earnings dates also load while the earnings markers are hidden, so key
  // moments can still label a report-day move as one.
  const ownEarnings = useChartEarnings(sym, data.earnings === undefined && (showEarnings || showMoments));
  const chartEarnings = data.earnings ?? ownEarnings;
  // Key moments: the year's unusually large moves and the news behind them —
  // needs a year of daily bars and the ticker's news, fetched only while on.
  const { bars: ownYear } = useBackendBars(sym, "1Y", showMoments && data.yearBars === undefined && !!sym);
  const yearBars = data.yearBars !== undefined ? (data.yearBars ?? undefined) : ownYear;
  const { data: ownNews } = useApiResource<NewsArticleDoc[]>(
    showMoments && data.news === undefined && sym ? `/live/news?ticker=${encodeURIComponent(sym)}` : null,
  );
  const news = data.news !== undefined ? data.news : ownNews;
  const keyMoments = useKeyMoments(showMoments, {
    sym, name, bars: yearBars, news, earningsDates: chartEarnings.map(e => e.date),
  });

  return (
    <CandleChart
      sym={sym} tf={interval} interval={interval} chartType={chartType.toLowerCase()}
      realBars={realBars} loading={loading} px={px} height={height}
      live={tick ? { price: tick.price, high: tick.high, low: tick.low, at: tick.at } : null}
      earnings={showEarnings ? chartEarnings : []}
      moments={keyMoments}
      toolbarStart={<>
        <IntervalMenu value={interval} onChange={setBarInterval} />
        <ChartSelect value={chartType} options={CHART_TYPE_OPTIONS} onChange={v => setChartType(v as ChartType)} title="Chart type" />
        <button className={`rng indbtn${showEarnings ? " on" : ""}`} onClick={() => setShowEarnings(v => !v)}>Earnings</button>
        <button className={`rng indbtn${showMoments ? " on" : ""}`} onClick={() => setShowMoments(v => !v)}
          title="Mark unusually large moves and the news behind them">Key moments</button>
      </>}
      toolbarEnd={<>
        <VendorTag v="polygon" />
        {realBars && <span className="cc-chip live">live</span>}
        {expandable && (
          <ExpandBtn
            title={`${sym} · Price Chart`}
            node={
              <div>
                {/* Fill the full-screen expand modal (its header + toolbar take ~210px). */}
                <StockChart sym={sym} name={name} height="max(420px, calc(100vh - 210px))"
                  initial={{ interval, chartType, showEarnings, showMoments }} />
              </div>
            }
          />
        )}
      </>}
    />
  );
}

/* ── ChartCard: logo + quote header over the shared StockChart ── */
export function ChartCard({
  sym, px,
  emptyText = "Select a stock to see chart",
  interval: intervalProp, onIntervalChange,
}: {
  sym: string;
  px: number;
  emptyText?: string;
  /** Controlled candle size — pass both to share it with sibling panels. */
  interval?: BarInterval;
  onIntervalChange?: (iv: BarInterval) => void;
}) {
  const { data: liveCompany } = useApiResource<CompanyDoc>(sym ? `/live/company?ticker=${encodeURIComponent(sym)}` : null);
  // One live stream for the headline AND the chart.
  const live = useLiveTick(sym);
  // Same headline as the stock page header (shared quote, after-hours block).
  // `px` (the list row's price) stands in until /live/company answers.
  const hq = useHeadlineQuote(sym, live, {
    price: liveCompany?.price ?? (px > 0 ? px : null),
    pctChange: liveCompany?.pctChange ?? null,
  });

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {sym ? (
        <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 0", flexWrap: "wrap" }}>
            <StockLogo sym={sym} size={30} />
            <h1 style={{ margin: 0, flexShrink: 0, fontSize: "0.95rem", fontFamily: "var(--f-display)", color: "var(--text-hi)" }}>{sym}</h1>
            <QuoteHeadline q={hq} />
            {liveCompany?.name && (
              <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {liveCompany.name}
              </span>
            )}
          </div>
          <div style={{ padding: "0 14px" }}>
            <StockChart sym={sym} name={liveCompany?.name} px={px} height={320} expandable
              interval={intervalProp} onIntervalChange={onIntervalChange}
              data={{ live }} />
          </div>
        </div>
      ) : (
        <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--text-dim-solid)", fontSize: ".85rem" }}>{emptyText}</span>
        </div>
      )}
    </div>
  );
}

/* ── StockPanelLayout: top row (list + chart) + bottom stock detail ── */
export function StockPanelLayout({
  listCard, selectedSym, chartPx,
  chartEmptyText,
  detailEmptyText = "Select a stock to see its full analysis.",
}: {
  listCard: ReactNode;
  selectedSym: string;
  chartPx: number;
  chartEmptyText?: string;
  detailEmptyText?: string;
}) {
  // One candle size for the chart AND the detail section's technical rating,
  // so changing the chart's interval re-rates — same as the stock page.
  const [barInterval, setBarInterval] = useState<BarInterval>("1D");
  return (
    <>
      <div className="sp-row" style={{ display: "flex", gap: 14, alignItems: "stretch", marginBottom: 14 }}>
        {listCard}
        <ChartCard sym={selectedSym} px={chartPx} emptyText={chartEmptyText}
          interval={barInterval} onIntervalChange={setBarInterval} />
      </div>
      {selectedSym ? (
        // Same tabbed sections as the stock page (Overview / Analysis / …);
        // the chart card above already carries the ticker, quote and chart.
        <StockScreenEmbed initialSym={selectedSym} hideIdentity hideChart barInterval={barInterval} />
      ) : (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>
            {detailEmptyText}
          </div>
        </div>
      )}
    </>
  );
}
