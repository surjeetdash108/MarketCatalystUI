"use client";

import { useState, type ReactNode } from "react";
import { fmtDate, etTodayIso } from "./calendar-range";
import dynamic from "next/dynamic";
import { CandleChart, ChartSelect, TF_OPTIONS, CHART_TYPE_OPTIONS, DataState, Spark, VendorTag, type EarnQ } from "./utils";
import { ExpandBtn } from "./shell";
import { useApiList } from "./hooks/useApiList";
import { useApiResource } from "./hooks/useApiResource";
import { useBackendBars } from "./hooks/useBackendBars";
import { useChartEarnings } from "./hooks/useChartEarnings";
import type { LiveEarningsDoc, CompanyDoc } from "./types";
import { surprisePct } from "./types";

/* ── Shared dynamic embed — one definition for all screens ── */
export const StockScreenEmbed = dynamic<{
  initialSym?: string;
  hideHeader?: boolean;
  hideChart?: boolean;
  headerActions?: React.ReactNode;
  visibleTabs?: ("chart" | "overview" | "analysis" | "earnings" | "financials" | "holdings" | "news" | "peers")[];
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

/* ── Expanded chart rendered inside the modal opened by ExpandBtn ── */
function ChartCardExpanded({
  sym, px, initialTf, initialChartType, initialShowEarnings, hist, earningsLoading, erDate,
}: {
  sym: string; px: number; initialTf: string;
  initialChartType: "Candles" | "Hollow" | "Bars" | "Line" | "Area";
  initialShowEarnings: boolean;
  hist: EarnQ[]; earningsLoading: boolean; erDate: string;
}) {
  const [tf, setTf] = useState(initialTf);
  const [chartType, setChartType] = useState(initialChartType);
  const [showEarnings, setShowEarnings] = useState(initialShowEarnings);
  const { bars: realBars, loading } = useBackendBars(sym, tf);
  // Same derivation as stock details, so a report lands on the same bar with
  // the same numbers here as it does there.
  const chartEarnings = useChartEarnings(sym, showEarnings);
  return (
    <div>
      <CandleChart sym={sym} tf={tf} px={px} chartType={chartType.toLowerCase()} realBars={realBars} loading={loading}
        earnings={showEarnings ? chartEarnings : []} height={520}
        toolbarStart={<>
          <ChartSelect value={tf} options={TF_OPTIONS} onChange={setTf} title="Timeframe" />
          <ChartSelect value={chartType} options={CHART_TYPE_OPTIONS} onChange={v => setChartType(v as typeof chartType)} title="Chart type" />
          <button className={`rng indbtn${showEarnings ? " on" : ""}`} onClick={() => setShowEarnings(v => !v)}>Earnings</button>
        </>} />
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
}: {
  sym: string;
  px: number;
  emptyText?: string;
}) {
  const [tf, setTf] = useState("3M");
  const [chartType, setChartType] = useState<"Candles" | "Hollow" | "Bars" | "Line" | "Area">("Candles");
  const [showEarnings, setShowEarnings] = useState(false);

  const { bars: realBars, loading: barsLoading } = useBackendBars(sym, tf);
  const { data: liveCompany } = useApiResource<CompanyDoc>(sym ? `/live/company?ticker=${encodeURIComponent(sym)}` : null);
  const { hist, erDate, loading: earningsLoading } = useLiveEarningsForSym(sym, liveCompany?.nextEarningsDate);
  // Same derivation as stock details — see chart-earnings.ts. Fetched only while
  // the Earnings overlay is on; before this the toggle below flipped state that
  // nothing read, so this chart never drew a dot.
  const chartEarnings = useChartEarnings(sym, showEarnings);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {sym ? (
        <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0 14px" }}>
            <CandleChart sym={sym} tf={tf} px={px} chartType={chartType.toLowerCase()} realBars={realBars} loading={barsLoading}
              earnings={showEarnings ? chartEarnings : []} height={320}
              toolbarStart={<>
                <ChartSelect value={tf} options={TF_OPTIONS} onChange={setTf} title="Timeframe" />
                <ChartSelect value={chartType} options={CHART_TYPE_OPTIONS} onChange={v => setChartType(v as typeof chartType)} title="Chart type" />
                <button className={`rng indbtn${showEarnings ? " on" : ""}`} onClick={() => setShowEarnings(v => !v)}>Earnings</button>
              </>}
              toolbarEnd={<>
                <VendorTag v="polygon" />
                <ExpandBtn
                  title={`${sym} · Price Chart`}
                  node={
                    <ChartCardExpanded
                      sym={sym} px={px}
                      initialTf={tf} initialChartType={chartType}
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
  return (
    <>
      <div className="sp-row" style={{ display: "flex", gap: 14, alignItems: "stretch", marginBottom: 14 }}>
        {listCard}
        <ChartCard sym={selectedSym} px={chartPx} emptyText={chartEmptyText} />
      </div>
      {selectedSym ? (
        <StockScreenEmbed initialSym={selectedSym} hideHeader hideChart />
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
