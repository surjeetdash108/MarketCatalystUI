"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";
import { CandleChart, Spark } from "./utils";

/* ── Shared dynamic embed — one definition for all screens ── */
export const StockScreenEmbed = dynamic<{ initialSym?: string; hideHeader?: boolean; hideChart?: boolean }>(
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

/* ── StockRow: one pf-li row ── */
export function StockRow({
  sym, name, seed, sparkUp,
  isSelected, onClick, onDelete,
  valueTop, valueBottom, valueBottomClass = "",
}: {
  sym: string;
  name: string;
  seed: number;
  sparkUp: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
  valueTop: string;
  valueBottom: string;
  valueBottomClass?: string;
}) {
  return (
    <div
      className={`pf-li${isSelected ? " active" : ""}`}
      style={{ gridTemplateColumns: onDelete ? "1fr 60px auto auto" : "1fr 60px auto" }}
      onClick={onClick}
    >
      <div>
        <span className="s">{sym}</span>
        <span className="n">{name}</span>
      </div>
      <div className="pf-spark">
        <Spark seed={seed} up={sparkUp} />
      </div>
      <div>
        <span className="px">{valueTop}</span>
        <span className={`ch${valueBottomClass ? ` ${valueBottomClass}` : ""}`}>{valueBottom}</span>
      </div>
      {onDelete && (
        <button className="wl-del-btn" title="Remove" onClick={e => { e.stopPropagation(); onDelete(); }}>
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

/* ── StockListCard: 340px card with scrollable list ── */
export function StockListCard({
  title, headerRight, isEmpty, emptyMessage = "No items.", maxListHeight, children,
}: {
  title: string;
  headerRight?: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  maxListHeight?: number;
  children?: ReactNode;
}) {
  return (
    <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="card-h">
          <h3>{title}</h3>
          {headerRight}
        </div>
        <div className="pf-list" style={{ flex: 1, maxHeight: maxListHeight ?? "none", overflowY: "auto" }}>
          {isEmpty ? (
            <div style={{ padding: 16, fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
              {emptyMessage}
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );
}

/* ── ChartCard: right-side chart with timeframe toolbar ── */
export function ChartCard({
  sym, px, tf, onTfChange,
  emptyText = "Select a stock to see chart",
}: {
  sym: string;
  px: number;
  tf: string;
  onTfChange: (tf: string) => void;
  emptyText?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {sym ? (
        <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div className="chart-toolbar">
            {["1D","1W","1M","3M","6M","1Y","5Y"].map(r => (
              <button key={r} className={`rng tfbtn${tf === r ? " on" : ""}`} onClick={() => onTfChange(r)}>{r}</button>
            ))}
          </div>
          <div style={{ padding: "0 14px 14px", flex: 1 }}>
            <CandleChart sym={sym} tf={tf} px={px} maStep={0} emaStep={0} showVol chartType="candles" />
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
  listCard, selectedSym, chartPx, tf, onTfChange,
  chartEmptyText,
  detailEmptyText = "Select a stock to see its full analysis.",
}: {
  listCard: ReactNode;
  selectedSym: string;
  chartPx: number;
  tf: string;
  onTfChange: (tf: string) => void;
  chartEmptyText?: string;
  detailEmptyText?: string;
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "stretch", marginBottom: 14 }}>
        {listCard}
        <ChartCard sym={selectedSym} px={chartPx} tf={tf} onTfChange={onTfChange} emptyText={chartEmptyText} />
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
