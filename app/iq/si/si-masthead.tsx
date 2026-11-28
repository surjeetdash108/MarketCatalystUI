"use client";

import type { ReactNode } from "react";
import { OVX_MAST_CSS } from "./si-redesign-css";

/**
 * The strip under the Stock Intelligence top bar (identity and price, market cap, P/E, 52-week range)
 * and the tab rail under it, from the redesign. Both draw only what they are given.
 */

export type MastheadRange = { low: number; high: number; price: number; lowText: string; highText: string };

export type MastheadProps = {
  logo: ReactNode;
  ticker: string;
  name: string;
  /** Sits right after the ticker (the watchlist star). */
  afterTicker?: ReactNode;
  /** Shown under the name, e.g. why a star could not be saved. */
  note?: ReactNode;
  price: string;
  change: string;
  up: boolean;
  ext: { label: string; price: string; pct: string; up: boolean } | null;
  /** The sector the company belongs to (e.g. "Technology"); the Sector block is left out without one. */
  sector?: string | null;
  marketCap: ReactNode;
  pe: ReactNode;
  fpe: ReactNode;
  range: MastheadRange | null;
};

export function SiMasthead(p: MastheadProps) {
  const r = p.range;
  const position = r && r.high > r.low ? Math.max(0, Math.min(100, ((r.price - r.low) / (r.high - r.low)) * 100)) : null;
  return (
    <div className="ovx-mast si-idrow">
      <style>{OVX_MAST_CSS}</style>
      <div className="ovx-id">
        {p.logo}
        <div className="ovx-id-t">
          <p className="ovx-id-n">
            <strong data-caps>{p.ticker}</strong>
            {p.afterTicker}
            {" · "}
            {p.name}
          </p>
          <p className="ovx-id-p">
            <span className="ovx-price ovx-mono">{p.price}</span>
            <span className="ovx-chg" style={{ color: p.up ? "var(--ov-up)" : "var(--ov-dn)" }}>
              {p.up ? "▲" : "▼"} {p.change}
            </span>
            {p.ext && (
              <span className="ovx-ext">
                <span>{p.ext.label}</span>
                <b>{p.ext.price}</b>
                <span style={{ color: p.ext.up ? "var(--ov-up)" : "var(--ov-dn)" }}>{p.ext.pct}</span>
              </span>
            )}
          </p>
          {p.note}
        </div>
      </div>
      {p.sector && (
        <div className="ovx-stat">
          <span>Sector</span>
          <span className="ovx-sector">{p.sector}</span>
        </div>
      )}
      <div className="ovx-stat">
        <span>Market cap</span>
        <span>{p.marketCap}</span>
      </div>
      <div className="ovx-stat">
        <span>P/E trailing {"·"} forward</span>
        <span>
          {p.pe} <em>{"·"}</em> {p.fpe}
        </span>
      </div>
      <div className="ovx-range">
        <span>52-week range</span>
        {r && position != null ? (
          <>
            <div className="ovx-rtrack" role="img" aria-label={`Price ${p.price} in a 52-week range of ${r.lowText} to ${r.highText}`}>
              <i style={{ width: `${position}%` }} />
              <b aria-hidden style={{ left: `${position}%` }} />
            </div>
            <div className="ovx-rends ovx-mono">
              <span>{r.lowText}</span>
              <span>{r.highText}</span>
            </div>
          </>
        ) : (
          <span>{"—"}</span>
        )}
      </div>
    </div>
  );
}

export function SiTabRail<T extends string>({ tabs, active, onSelect }: { tabs: ReadonlyArray<readonly [T, string]>; active: T; onSelect: (tab: T) => void }) {
  return (
    <div
      className="si-tabrail"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--si-topbar, rgba(8,11,16,0.96))",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--ov-line)",
      }}
    >
      <div role="tablist" aria-label="Stock Intelligence sections" className="ovx-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} className="ovx-tab" onClick={() => onSelect(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
