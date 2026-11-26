"use client";

import { useEffect } from "react";
import type { Dir, Read, VerdictBreakdown } from "./si-reads";
import { sentenceCase } from "./si-reads";

/**
 * "How the verdict is decided": the overall verdict taken apart (technicals, fundamentals and the MC score, each with its
 * weight, its score and what it adds), then the reads inside the technicals and the fundamentals. Opens from the (i) next
 * to the verdict on the Overview.
 */

const UP = "#4ade80";
const DN = "#f05656";
const STEEL = "#7fa8d0";
const CAUTION = "#f5b031";
const MONO = "'JetBrains Mono', monospace";
const MANROPE = "'Manrope', sans-serif";
const BARLOW = "'Barlow Condensed', sans-serif";

const dirColor = (d: Dir) => (d === "up" ? UP : d === "down" ? DN : STEEL);
const glyph = (d: Dir) => (d === "up" ? "▲" : d === "down" ? "▼" : "▬");
const signed100 = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}`;

const BANDS: Array<{ from: number; to: number; label: string; dir: Dir; faint: boolean }> = [
  { from: -1, to: -0.5, label: "Bearish", dir: "down", faint: false },
  { from: -0.5, to: -0.2, label: "Lean bearish", dir: "down", faint: true },
  { from: -0.2, to: 0.2, label: "Neutral", dir: "flat", faint: false },
  { from: 0.2, to: 0.5, label: "Lean bullish", dir: "up", faint: true },
  { from: 0.5, to: 1, label: "Bullish", dir: "up", faint: false },
];

/** A -1..+1 bias as a bar growing from the middle. */
function BiasBar({ score, caution }: { score: number; caution?: boolean }) {
  const s = Math.max(-1, Math.min(1, score));
  const color = caution ? CAUTION : s >= 0.2 ? UP : s <= -0.2 ? DN : STEEL;
  const width = Math.max(Math.abs(s) * 50, s === 0 ? 0 : 3);
  return (
    <span role="img" aria-label={`bias ${s >= 0 ? "+" : ""}${Math.round(s * 100)} on a scale of -100 to +100`} style={{ position: "relative", display: "block", height: 6, background: "var(--si-card-tert, #232830)", minWidth: 60 }}>
      <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--si-border-sec, #3a4b5c)" }} />
      <span style={{ position: "absolute", top: 0, bottom: 0, background: color, width: `${width}%`, ...(s >= 0 ? { left: "50%" } : { right: "50%" }) }} />
    </span>
  );
}

/** One read as a row: its name, its bias bar, its headline, and the figure behind it. */
function ReadBiasRow({ read }: { read: Read }) {
  const color = read.caution ? CAUTION : dirColor(read.dir);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="si-readrow" style={{ display: "grid", gridTemplateColumns: "112px minmax(40px, 1fr) minmax(128px, auto)", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 600, color: "var(--si-text-mid, #93a1af)" }}>{read.k}</span>
        <BiasBar score={read.score} caution={read.caution} />
        <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 800, color, textAlign: "right", whiteSpace: "nowrap" }}>
          <span aria-hidden="true" style={{ fontSize: 10, marginRight: 6 }}>{read.caution ? "◆" : glyph(read.dir)}</span>
          {read.headline}
        </span>
      </div>
      <div className="si-readdetail" style={{ fontFamily: MANROPE, fontSize: 15, color: "var(--si-text-sub, #7d8b99)", lineHeight: 1.4, paddingLeft: 124 }}>
        {read.detail}
      </div>
    </div>
  );
}

export function VerdictDialog({ breakdown: b, techReads, fundReads, onClose }: { breakdown: VerdictBreakdown; techReads: Read[]; fundReads: Read[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const at = Math.max(0, Math.min(1, (b.total + 1) / 2)) * 100;
  const head = { fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-accent-light, #a9c6e3)" } as const;
  const num = { fontFamily: MONO, fontSize: 16, fontWeight: 700, textAlign: "right" } as const;
  const columns = "minmax(0,1.3fr) minmax(0,1.3fr) 70px 70px 90px";
  const labelNow = b.label.toLowerCase();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(4, 7, 11, 0.66)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How the verdict is decided"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(960px, 100%)", border: "1px solid var(--si-border-sec, #2e343d)", background: "var(--si-card-solid, #14171c)", boxShadow: "0 22px 56px rgba(0,0,0,0.65)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: BARLOW, fontSize: 24, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-text-hi, #e8eef4)" }}>
            Why <span data-caps style={{ color: dirColor(b.dir) }}>{sentenceCase(b.label)}</span>
          </span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 28, height: 28, border: "1px solid var(--si-border-sec, #2e343d)", background: "transparent", color: "var(--si-text-hi, #e8eef4)", fontSize: 17, lineHeight: 1, cursor: "pointer" }}>
            {"×"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ position: "relative", height: 26 }}>
            <span style={{ position: "absolute", left: `${at}%`, bottom: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: dirColor(b.dir) }}>
              {signed100(b.total * 100)}
              <span aria-hidden="true" style={{ fontSize: 9, lineHeight: 1 }}>{"▼"}</span>
            </span>
          </div>
          <div style={{ display: "flex", height: 14 }}>
            {BANDS.map((o) => (
              <span key={o.label} style={{ width: `${((o.to - o.from) / 2) * 100}%`, background: dirColor(o.dir), opacity: o.faint ? 0.45 : 0.85, borderRight: "2px solid var(--si-card-solid, #14171c)" }} />
            ))}
          </div>
          <div style={{ display: "flex" }}>
            {BANDS.map((o) => (
              <span key={o.label} style={{ width: `${((o.to - o.from) / 2) * 100}%`, fontFamily: MANROPE, fontSize: 13, color: labelNow === o.label.toLowerCase() ? "var(--si-text-hi, #e8eef4)" : "var(--si-text-mid, #93a1af)", fontWeight: labelNow === o.label.toLowerCase() ? 800 : 500, textAlign: "center" }}>
                {o.label}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, color: "var(--si-text-sub, #5d6b79)" }}>
            <span>{"−100"}</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10, padding: "0 0 6px" }}>
            <span style={head}>INPUT</span>
            <span style={head}>READING</span>
            <span style={{ ...head, textAlign: "right" }}>WEIGHT</span>
            <span style={{ ...head, textAlign: "right" }}>SCORE</span>
            <span style={{ ...head, textAlign: "right" }}>ADDS</span>
          </div>
          {b.parts.map((p) => (
            <div key={p.key} style={{ display: "grid", gridTemplateColumns: columns, gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--si-border, #232830)" }}>
              <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{p.name}</span>
              <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 800, color: dirColor(p.dir) }}>
                <span aria-hidden="true" style={{ fontSize: 10, marginRight: 6 }}>{glyph(p.dir)}</span>
                {p.label}
              </span>
              <span style={{ ...num, color: "var(--si-text-mid, #93a1af)" }}>{Math.round(p.weight * 100)}%</span>
              <span style={{ ...num, color: dirColor(p.dir) }}>{signed100(p.score * 100)}</span>
              <span style={{ ...num, color: dirColor(p.dir) }}>
                {p.contrib >= 0 ? "+" : "−"}
                {Math.abs(p.contrib * 100).toFixed(1)}
              </span>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10, alignItems: "center", padding: "12px 0 0", borderTop: "2px solid var(--si-border-sec, #2e343d)" }}>
            <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>Total</span>
            <span style={{ fontFamily: MANROPE, fontSize: 17, fontWeight: 800, color: dirColor(b.dir) }}>
              <span aria-hidden="true" style={{ fontSize: 10, marginRight: 6 }}>{glyph(b.dir)}</span>
              {sentenceCase(b.label)}
            </span>
            <span />
            <span />
            <span style={{ ...num, color: dirColor(b.dir) }}>{signed100(b.total * 100)}</span>
          </div>
          <span style={{ fontFamily: MANROPE, fontSize: 14.5, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.5, marginTop: 10 }}>
            Each input is scored from {"−"}100 (bearish) to +100 (bullish). The weight is its share of the call; &quot;adds&quot; is weight {"×"} score, and the three add up to the total. An input with no data is left out and the others are re-weighted. The MC score is turned into the same scale as (score {"−"} 50) {"÷"} 40.
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 22 }}>
          {(
            [
              ["Inside The Technicals", techReads],
              ["Inside The Fundamentals", fundReads],
            ] as const
          ).map(([title, reads]) => (
            <div key={title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span data-caps style={head}>{title}</span>
              {reads.length ? reads.map((r) => <ReadBiasRow key={r.k} read={r} />) : <span style={{ fontFamily: MANROPE, fontSize: 16, color: "var(--si-text-mid, #93a1af)" }}>No data yet.</span>}
            </div>
          ))}
        </div>

        <span style={{ fontFamily: MANROPE, fontSize: 13, color: "var(--si-text-sub, #5d6b79)" }}>
          Bands: +50 or more bullish {"·"} +20 to +50 lean bullish {"·"} {"−"}20 to +20 neutral {"·"} {"−"}50 to {"−"}20 lean bearish {"·"} below {"−"}50 bearish. A read of the data on this page, not investment advice.
        </span>
      </div>
    </div>
  );
}
