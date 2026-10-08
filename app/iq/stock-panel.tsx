"use client";

import { useState, type ReactNode } from "react";
import { fmtDate, etTodayIso } from "./calendar-range";
import dynamic from "next/dynamic";
import { CandleChart, ChartSelect, IntervalMenu, CHART_TYPE_OPTIONS, DataState, Spark, StockLogo, VendorTag, type EarnQ, type BarInterval } from "./utils";
import { ExpandBtn } from "./shell";
import { useApiList } from "./hooks/useApiList";
import { useApiResource } from "./hooks/useApiResource";
import { useIntervalBars } from "./hooks/useBackendBars";
import { useLiveTick } from "./hooks/useLiveTick";
import { useHeadlineQuote, QuoteHeadline } from "./quote-headline";
import { useChartEarnings } from "./hooks/useChartEarnings";
import type { LiveEarningsDoc, CompanyDoc } from "./types";
import { surprisePct } from "./types";

/* ── Shared dynamic embed — one definition for all screens ── */
export const StockScreenEmbed = dynamic<{
  initialSym?: string;
  hideHeader?: boolean;
  hideIdentity?: boolean;
  hideChart?: boolean;
  headerActions?: React.ReactNode;
  visibleTabs?: ("overview" | "analysis" | "earnings" | "financials" | "holdings" | "news")[];
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

/* ── EPS surprise bars — real surprise % from the live earnings feed ── */
function EarnPane({ hist, loading }: { hist: EarnQ[]; loading: boolean }) {
  if (hist.length === 0) {
    return <DataState loading={loading} label="No live earnings-surprise history synced for this ticker yet." height={80} />;
  }
  const W = 720, H = 80, PADL = 40, PADR = 20, PADT = 10, PADB = 18;
  const iw = W - PADL - PADR;
  const ih = H - PADT - PADB;
  const mid = PADT + ih / 2;
  const gw = iw / hist.length;
  // Bar width matches the EPS history / Earnings-Growth charts (gw * 0.28) so
  // the earnings histogram reads the same across every screen that shows it.
  const bw = gw * 0.28;
  const maxS = Math.max(8, ...hist.map(x => Math.abs(x.surp)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      <line x1={PADL} y1={mid} x2={W - PADR} y2={mid}
        stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
      {hist.map((q, i) => {
        const beat = q.surp >= 0;
        const cx = PADL + gw * i + gw / 2;
        const barH = Math.max(4, (Math.abs(q.surp) / maxS) * (ih / 2 - 4));
        const rx = (cx - bw / 2).toFixed(1);
        const ry = beat ? (mid - barH).toFixed(1) : mid.toFixed(1);
        const color = beat ? "var(--up)" : "var(--down)";
        const labelY = beat ? (mid - barH - 4).toFixed(1) : (mid + barH + 9).toFixed(1);
        return (
          <g key={q.q}>
            <rect x={rx} y={ry} width={bw.toFixed(1)} height={barH.toFixed(1)} rx="2" fill={color} opacity="0.88" />
            <text x={cx.toFixed(1)} y={labelY} textAnchor="middle" fill={color} fontSize="7.5" fontFamily="JetBrains Mono,monospace">
              {beat ? "+" : ""}{q.surp.toFixed(1)}%
            </text>
            <text x={cx.toFixed(1)} y={(H - 3).toFixed(1)} textAnchor="middle"
              fill="var(--text-dim-solid)" fontSize="7.5" fontFamily="JetBrains Mono,monospace">
              {q.q.replace(" ", "'")}
            </text>
          </g>
        );
      })}
      <text x={PADL - 4} y={(mid - 2).toFixed(1)} textAnchor="end" fill="var(--text-dim-solid)" fontSize="7" fontFamily="JetBrains Mono,monospace">BEAT</text>
      <text x={PADL - 4} y={(mid + 10).toFixed(1)} textAnchor="end" fill="var(--text-dim-solid)" fontSize="7" fontFamily="JetBrains Mono,monospace">MISS</text>
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

/**
 * Real 10-quarter-style EPS-surprise history + next earnings date, built from
 * the live earnings feed for one ticker — same pattern stock.tsx uses for its
 * own hist10, shared here so the two never drift onto different data.
 */
function useLiveEarningsForSym(sym: string, nextEarningsDate?: string | null): { hist: EarnQ[]; erDate: string; loading: boolean } {
  const { data: liveEarnings, loading } = useApiList<LiveEarningsDoc>("/market-data/earnings");
  const symEvents = liveEarnings.filter(e => e.ticker === sym).sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = etTodayIso();
  // Backend's /live/company nextEarningsDate wins; the feed is the fallback.
  const erDate = nextEarningsDate
    || symEvents.find(e => e.date >= todayStr)?.date
    || symEvents[symEvents.length - 1]?.date
    || "—";
  const hist: EarnQ[] = symEvents
    .filter(e => e.epsEstimate != null && e.epsActual != null)
    .slice(-8)
    .reverse()
    .map(e => {
      const est = e.epsEstimate as number, act = e.epsActual as number;
      const surp = surprisePct(act, est) ?? 0;
      return {
        q: fmtDate(e.date, { month: "short", year: "2-digit" }),
        e: est, a: act, surp: parseFloat(surp.toFixed(1)), mv: 0,
      };
    });
  return { hist, erDate, loading };
}

type ChartType = "Candles" | "Hollow" | "Bars" | "Line" | "Area";

/** Bars freshness stamp (backend createdAt) — same format as stock details. */
function fmtAsOf(asOf: string | null | undefined): string | null {
  if (!asOf) return null;
  const d = new Date(asOf);
  return isNaN(d.getTime())
    ? asOf
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Data + controls for a panel chart, driven exactly like the stock-details
 * chart: candle SIZE (not a date range), live delayed tick folded onto the
 * forming candle, earnings markers on by default.
 *
 * The candle size is controlled when `controlled` is passed (StockPanelLayout
 * shares it with the detail section's technical rating), else kept locally.
 */
function usePanelChart(
  sym: string,
  initial?: { interval: BarInterval; chartType: ChartType; showEarnings: boolean },
  controlled?: { interval: BarInterval; onIntervalChange: (iv: BarInterval) => void },
) {
  const [ownInterval, setOwnInterval] = useState<BarInterval>(initial?.interval ?? "1D");
  const interval = controlled?.interval ?? ownInterval;
  const setBarInterval = controlled?.onIntervalChange ?? setOwnInterval;
  const [chartType, setChartType] = useState<ChartType>(initial?.chartType ?? "Candles");
  const [showEarnings, setShowEarnings] = useState(initial?.showEarnings ?? true);
  const { bars: realBars, asOf, loading } = useIntervalBars(sym, interval);
  const live = useLiveTick(sym);
  const { tick } = live;
  // Same derivation as stock details, so a report lands on the same bar with
  // the same numbers here as it does there.
  const chartEarnings = useChartEarnings(sym, showEarnings);
  const asOfLabel = fmtAsOf(asOf);

  const chartProps = {
    sym, tf: interval, interval, chartType: chartType.toLowerCase(), realBars, loading,
    live: tick ? { price: tick.price, high: tick.high, low: tick.low, at: tick.at } : null,
    earnings: showEarnings ? chartEarnings : [],
    toolbarStart: <>
      <IntervalMenu value={interval} onChange={setBarInterval} />
      <ChartSelect value={chartType} options={CHART_TYPE_OPTIONS} onChange={v => setChartType(v as ChartType)} title="Chart type" />
      <button className={`rng indbtn${showEarnings ? " on" : ""}`} onClick={() => setShowEarnings(v => !v)}>Earnings</button>
    </>,
  };
  const freshness = <>
    <VendorTag v="polygon" />
    {realBars && <span className="cc-chip live">live</span>}
    {asOfLabel && <span className="cc-asof">as of {asOfLabel}</span>}
  </>;
  return { interval, chartType, showEarnings, live, chartProps, freshness };
}

/* ── Expanded chart rendered inside the modal opened by ExpandBtn ── */
function ChartCardExpanded({
  sym, initialInterval, initialChartType, initialShowEarnings, hist, earningsLoading, erDate,
}: {
  sym: string; initialInterval: BarInterval;
  initialChartType: ChartType;
  initialShowEarnings: boolean;
  hist: EarnQ[]; earningsLoading: boolean; erDate: string;
}) {
  const { showEarnings, chartProps, freshness } = usePanelChart(sym, {
    interval: initialInterval, chartType: initialChartType, showEarnings: initialShowEarnings,
  });
  return (
    <div>
      {/* Fill the full-screen expand modal (its header + toolbar take ~210px). */}
      <CandleChart {...chartProps} height="max(420px, calc(100vh - 210px))" toolbarEnd={freshness} />
      {showEarnings && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 4 }}>
          <div style={{ padding: "6px 0 4px", fontSize: ".66rem", color: "var(--text-dim-solid)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Earnings · EPS Surprise</span>
            <span className="mono" style={{ color: "var(--warn)", fontWeight: 600 }}>Next: {erDate}</span>
          </div>
          <EarnPane hist={hist} loading={earningsLoading} />
        </div>
      )}
    </div>
  );
}

/* ── ChartCard: full-featured self-contained chart (mirrors stock details) ── */
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
  const { interval, chartType, showEarnings, live, chartProps, freshness } = usePanelChart(
    sym, undefined,
    intervalProp && onIntervalChange ? { interval: intervalProp, onIntervalChange } : undefined,
  );
  const { data: liveCompany } = useApiResource<CompanyDoc>(sym ? `/live/company?ticker=${encodeURIComponent(sym)}` : null);
  const { hist, erDate, loading: earningsLoading } = useLiveEarningsForSym(sym, liveCompany?.nextEarningsDate);
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
            <CandleChart {...chartProps} px={px} height={320}
              toolbarEnd={<>
                {freshness}
                <ExpandBtn
                  title={`${sym} · Price Chart`}
                  node={
                    <ChartCardExpanded
                      sym={sym}
                      initialInterval={interval} initialChartType={chartType}
                      initialShowEarnings={showEarnings}
                      hist={hist} earningsLoading={earningsLoading} erDate={erDate}
                    />
                  }
                />
              </>} />
          </div>
          {showEarnings && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "0 14px 8px" }}>
              <div style={{ padding: "6px 0 4px", fontSize: ".66rem", color: "var(--text-dim-solid)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Earnings · EPS Surprise</span>
                <span className="mono" style={{ color: "var(--warn)", fontWeight: 600 }}>Next: {erDate}</span>
              </div>
              <EarnPane hist={hist} loading={earningsLoading} />
            </div>
          )}
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
