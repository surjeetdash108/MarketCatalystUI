"use client";

import { useEffect, useState } from "react";
import { DN, PEER_SPAN, STEEL, UP } from "./data";
import { DRIVER_CATEGORIES, DRIVER_DOCS } from "./scoring-docs";
import { ConfidenceBreakdown, ConfidenceExplainer, type BreakdownCategory } from "./trade-builder-parts";

/**
 * "How MC Confidence is calculated": opens from the Overview's ring and from any signal-score row. The header, then the
 * score breakdown (weight x score = points for each category, opening to its drivers), what the score means, and the
 * rules every driver is scored by. "Weights & method" opens the longer walk-through. All from the same engine run the
 * numbers on the Overview come from.
 */

const INTER = "var(--font-inter, 'Inter'), system-ui, sans-serif";
const AMBER = "#f5b031";

/** A score's colour on the same bands the ring uses. */
const scoreColor = (score: number) => (score >= 75 ? UP : score >= 60 ? STEEL : score >= 45 ? AMBER : DN);

const BANDS: Array<[range: string, label: string, color: string, text: string, holds: (c: number) => boolean]> = [
  ["75 – 100", "HIGH CONVICTION", UP, "Most categories line up behind the trade.", (c) => c >= 75],
  ["60 – 74", "CONSTRUCTIVE", STEEL, "The weight of evidence supports it, with a few weaker spots.", (c) => c >= 60 && c < 75],
  ["45 – 59", "MIXED", AMBER, "Evidence is split. No clear edge.", (c) => c >= 45 && c < 60],
  ["0 – 44", "WEAK", DN, "More evidence is against the trade than for it.", (c) => c < 45],
];

export function ConfidenceDialog({ cats, conf, peerTickers, onClose }: { cats: BreakdownCategory[]; conf: number | null; peerTickers?: ReadonlyArray<string> | null; onClose: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [weightsOpen, setWeightsOpen] = useState(false);

  useEffect(() => {
    if (weightsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, weightsOpen]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(4, 7, 11, 0.66)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How MC Confidence is calculated"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1040px, 100%)", border: "1px solid var(--si-border-sec, #2e343d)", borderRadius: 10, background: "var(--si-card-solid, #14171c)", boxShadow: "0 22px 56px rgba(0,0,0,0.65)", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", minWidth: 0 }}>
            <span data-caps style={{ fontFamily: INTER, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", textTransform: "none", color: "var(--si-text-hi, #e8eef4)" }}>How MC Confidence is calculated</span>
            <span style={{ fontFamily: INTER, fontSize: 14.5, color: "var(--si-text-mid, #93a1af)" }}>Bullish case {"·"} 6-month horizon {"·"} each driver scored 0{"–"}100, 50 is neutral</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              data-caps
              onClick={() => setWeightsOpen(true)}
              style={{ height: 36, padding: "0 16px", whiteSpace: "nowrap", border: "1px solid var(--si-border-sec, #2e343d)", borderRadius: 4, background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: INTER, fontSize: 14, fontWeight: 600, letterSpacing: 0, cursor: "pointer" }}
            >
              Weights &amp; Method
            </button>
            <button type="button" aria-label="Close" onClick={onClose} style={{ width: 36, height: 36, border: "1px solid var(--si-border-sec, #2e343d)", borderRadius: 4, background: "transparent", color: "var(--si-text-hi, #e8eef4)", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>
              {"×"}
            </button>
          </div>
        </div>

        <ConfidenceBreakdown cats={cats} colorFor={scoreColor} open={open} onToggle={(k) => setOpen((o) => ({ ...o, [k]: !o[k] }))} />

        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(140, 170, 210, 0.12)", paddingTop: 18 }}>
          <span data-caps style={{ fontFamily: INTER, fontSize: 18, fontWeight: 700, letterSpacing: "-0.005em", textTransform: "none", color: "var(--si-text-hi, #e8eef4)", marginBottom: 10 }}>What the score means</span>
          {BANDS.map(([range, label, color, text, holds]) => {
            const now = conf != null && holds(conf);
            return (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "90px 190px minmax(0,1fr)", gap: 14, alignItems: "baseline", padding: "12px 14px", borderTop: "1px solid var(--si-border, #232830)", background: now ? "rgba(79, 163, 255, 0.1)" : "transparent" }}>
                <span style={{ fontFamily: INTER, fontVariantNumeric: "tabular-nums", fontSize: 15, fontWeight: 650, color: "var(--si-text-hi, #e8eef4)" }}>{range}</span>
                <span data-caps style={{ fontFamily: INTER, fontSize: 16, fontWeight: 700, letterSpacing: 0, textTransform: "none", color }}>
                  {label.charAt(0) + label.slice(1).toLowerCase()}
                  {now ? "  ← now" : ""}
                </span>
                <span style={{ fontFamily: INTER, fontSize: 15, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.5 }}>{text}</span>
              </div>
            );
          })}
        </div>

        <details style={{ borderTop: "1px solid rgba(140, 170, 210, 0.12)", paddingTop: 18 }}>
          <summary data-caps style={{ cursor: "pointer", fontFamily: INTER, fontSize: 18, fontWeight: 700, letterSpacing: "-0.005em", textTransform: "none", color: "var(--si-text-hi, #e8eef4)" }}>
            Scoring rules {"·"} how every driver is scored
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            <div style={{ fontFamily: INTER, fontSize: 15.5, lineHeight: 1.65, color: "var(--si-text-hi, #e8eef4)" }}>
              Every driver is scored 0{"–"}100 from one input: 50 is neutral, 100 is full marks, 0 is the worst. There is no 95 ceiling, so a rule that is fully met scores 100. Where a comparison is possible, the stock is measured against the <b>average of its top five competitors over the last four quarters</b>
              {peerTickers?.length ? <> (here: {peerTickers.join(", ")})</> : null}: growth and margins are averaged over four quarters, each quarter&apos;s growth is capped at {"±"}100% so one hypergrowth quarter cannot dominate, and at least three competitors must have data. Revenue growth, EPS growth, gross margin and operating margin are each scored <b>twice</b>: on their own (absolute), and against the peer average (relative). Ahead of the peer average by {PEER_SPAN.revGrowth} points of revenue or EPS growth, or {PEER_SPAN.opMargin} points of margin, earns 100 on the relative row; behind by the same gap earns 0. The absolute row keeps a stock from scoring full marks just for being the least bad in a weak sector.
            </div>
            {DRIVER_CATEGORIES.map((cat) => (
              <div key={cat} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: INTER, fontSize: 17, fontWeight: 700, color: "var(--si-accent-light, #a9c6e3)", marginBottom: 4 }}>{cat}</span>
                {DRIVER_DOCS.filter((d) => d.cat === cat).map((d) => (
                  <div key={d.driver} style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.6fr) minmax(0, 1fr)", gap: 14, padding: "12px 0", borderTop: "1px solid rgba(140, 170, 210, 0.1)", alignItems: "start" }}>
                    <span style={{ fontFamily: INTER, fontSize: 15.5, fontWeight: 650, color: d.peers ? "var(--si-accent-light, #a9c6e3)" : "var(--si-text-hi, #e8eef4)" }}>
                      {d.driver}
                      {d.peers ? " · vs peers" : ""}
                    </span>
                    <span style={{ fontFamily: INTER, fontSize: 14.5, lineHeight: 1.55, color: "var(--si-text-mid, #93a1af)" }}>{d.rule}</span>
                    <span style={{ fontFamily: INTER, fontSize: 14.5, lineHeight: 1.55, color: "var(--si-text-hi, #e8eef4)" }}>
                      <b style={{ color: UP }}>100</b> {d.full}
                      <br />
                      <b style={{ color: DN }}>0</b> {d.zero}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      </div>
      {weightsOpen && <ConfidenceExplainer cats={cats} conf={conf} hz="6M" bull custom={false} onClose={() => setWeightsOpen(false)} />}
    </div>
  );
}
