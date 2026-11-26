"use client";

import type { ReactNode } from "react";

/**
 * The panels that open beside the Overview's left menu (Fundamentals, Technicals, Why it moved,
 * Why it could move). Each is a short read; none links away to a full tab, as in the design.
 */

const MUTED = "var(--si-text-mid, #93a1af)";
const HI = "var(--si-text-hi, #e8eef4)";
const UP = "var(--ov-up, #5ee08a)";
const DN = "var(--ov-dn, #f07a7a)";

export function PanelCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--si-border, #232830)",
        borderRadius: 8,
        background: "var(--si-card, rgba(20, 23, 28, 0.9))",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>{children}</div>
    </div>
  );
}

const INTER = "var(--font-inter, 'Inter'), system-ui, sans-serif";
const BLUE_ACCENT = "var(--si-accent-light, #a9c6e3)";

/** One line of a rows card: a title, a sentence under it, and a tag at the right. */
export type PanelRow = { title: string; detail: ReactNode; tag?: string; col?: string; isNew?: boolean };

/** A card of rows under a heading with a glyph ("▲ Yesterday"), or a short note when there are none. */
function RowsCard({ glyph, heading, color, rows, empty }: { glyph: string; heading: string; color: string; rows: PanelRow[]; empty: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--si-border, #232830)", borderRadius: 6, background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "14px 20px 4px" }}>
      <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 650, letterSpacing: "0.01em", color, paddingBottom: 10 }}>
        {glyph} <span data-caps>{heading}</span>
      </span>
      {rows.length === 0 ? (
        <span style={{ fontFamily: INTER, fontSize: 15, color: MUTED, padding: "10px 0 14px" }}>{empty}</span>
      ) : (
        rows.map((r, i) => (
          <div key={`${r.title}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "12px 0", borderTop: "1px solid var(--si-border, #232830)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ fontFamily: INTER, fontSize: 16, fontWeight: 600, color: HI }}>
                {r.title}
                {r.isNew && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#fdba74", border: "1px solid #6b3a12", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" }}>NEW</span>
                )}
              </span>
              <span style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.5, color: MUTED }}>{r.detail}</span>
            </div>
            {r.tag && (
              <span style={{ fontFamily: INTER, fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 650, color: r.col ?? color, whiteSpace: "nowrap", textAlign: "right" }}>{r.tag}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const signed2 = (v: number) => `${v >= 0 ? "+" : "\u2212"}${Math.abs(v).toFixed(2)}%`;
const glyphFor = (pct: number | null) =>
  pct == null || Math.abs(pct) < 0.05
    ? { glyph: "\u25AC", col: BLUE_ACCENT }
    : pct > 0
      ? { glyph: "\u25B2", col: "#4ade80" }
      : { glyph: "\u25BC", col: "#f05656" };

/** The big move of a period, as a box above its reasons. */
function MoveStat({ label, pct }: { label: string; pct: number | null }) {
  const g = glyphFor(pct);
  return (
    <div style={{ border: "1px solid var(--si-border, #232830)", borderRadius: 6, background: "var(--si-card-sec, rgba(20, 23, 28,0.6))", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span data-caps style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: MUTED }}>{label}</span>
      <span style={{ fontFamily: INTER, fontVariantNumeric: "tabular-nums", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: pct == null ? MUTED : pct >= 0 ? "#4ade80" : "#f05656" }}>
        {pct == null ? (
          "\u2014"
        ) : (
          <>
            <span aria-hidden="true" style={{ fontSize: 16, marginRight: 5 }}>{g.glyph}</span>
            {signed2(pct)}
          </>
        )}
      </span>
    </div>
  );
}

export type MovedHalf = { label: string; pct: number | null; heading: string; rows: PanelRow[]; empty: string };

/** Why it moved: yesterday on the left, the last five sessions on the right, each as a move and its reasons. */
export function MovedPanel({ yesterday, week }: { yesterday: MovedHalf; week: MovedHalf }) {
  return (
    <PanelCard>
      <style>{".si-updown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}.si-updown>*{min-width:0}.si-updown>div>*:last-child{flex:1}@media (max-width:1000px){.si-updown{grid-template-columns:minmax(0,1fr)}}"}</style>
      <div className="si-updown">
        {[yesterday, week].map((h) => {
          const g = glyphFor(h.pct);
          return (
            <div key={h.heading} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <MoveStat label={h.label} pct={h.pct} />
              <RowsCard glyph={g.glyph} heading={h.heading} color={g.col} rows={h.rows} empty={h.empty} />
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

export type NextEvent = { date: string; days: string; n: string; txt?: string };

/** Why it could move: the next dated event, then what could push the stock up and what could pull it down. */
export function CouldPanel({ next, upTitle, downTitle, up, down, nextLabel }: { next: NextEvent | null; nextLabel: string; upTitle: string; downTitle: string; up: PanelRow[]; down: PanelRow[] }) {
  return (
    <PanelCard>
      {next ? (
        <div style={{ border: "1px solid var(--si-border, #232830)", background: "var(--si-card-sec, rgba(20, 23, 28,0.6))", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span data-caps style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, letterSpacing: "0.1em", color: MUTED }}>{nextLabel}</span>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 19, fontWeight: 700, color: HI }}>{next.n}</span>
          {next.txt && <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15.5, lineHeight: 1.45, color: MUTED }}>{next.txt}</span>}
        </div>
      ) : (
        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, color: MUTED }}>No dated event on the calendar yet.</div>
      )}
      <style>{".si-updown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}.si-updown>*{min-width:0}@media (max-width:1000px){.si-updown{grid-template-columns:minmax(0,1fr)}}"}</style>
      <div className="si-updown">
        <RowsCard glyph={"\u25B2"} heading={upTitle} color="#4ade80" rows={up} empty="Nothing stands out yet." />
        <RowsCard glyph={"\u25BC"} heading={downTitle} color="#f05656" rows={down} empty="Nothing stands out yet." />
      </div>
    </PanelCard>
  );
}
