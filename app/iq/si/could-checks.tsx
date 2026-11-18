"use client";

import type { ReactNode } from "react";

const BLUE = "#4fb3ff";
const GREEN = "var(--up, #4ade80)";
const RED = "var(--down, #f87171)";
const AMBER = "#f5b031";

/**
 * Colours the numbers in a check's condition: prices, percents and multiples blue; "down more than
 * 10%" red; "beat 4 of the last 4" green / amber / red by the beat rate; "now 96/99" by the RS rating.
 */
export function highlightChecks(text: string): ReactNode[] {
  const re =
    /(down more than \d[\d.]*%)|(beat (\d+) of the last (\d+))|(now (\d+)\/99)|(\$\d[\d,]*(?:\.\d+)?|\d[\d.]*%|\d+(?:\.\d+)?×|\d+ or (?:above|higher|lower))/g;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  const span = (s: string, color: string) => (
    <span key={key++} style={{ color, fontWeight: 700 }}>
      {s}
    </span>
  );
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const cut = m[1].indexOf("than") + 5;
      out.push(m[1].slice(0, cut), span(m[1].slice(cut), RED));
    } else if (m[2]) {
      const beats = +m[3];
      const total = +m[4];
      const color = total > 0 && beats / total >= 0.75 ? GREEN : total > 0 && beats / total < 0.5 ? RED : AMBER;
      out.push("beat ", span(String(beats), color), " of the last ", span(String(total), BLUE));
    } else if (m[5]) {
      const rs = +m[6];
      out.push("now ", span(`${rs}/99`, rs >= 70 ? GREEN : rs < 40 ? RED : BLUE));
    } else {
      out.push(span(m[7], BLUE));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Check = [string, string];

/**
 * Why It Could Move's top row: BULLISH (what would validate the setup) next to BEARISH (what would
 * break it). A bearish level the price is already through is listed first and tagged ALREADY BROKEN,
 * so a risk that has already happened is not shown as one still to come.
 */
export function BullBearChecks({ bullish, bearish, broken }: { bullish: Check[]; bearish: Check[]; broken: Check[] }) {
  const columns = [
    {
      title: "BULLISH",
      glyph: "▲",
      color: GREEN,
      rgb: "74,222,128",
      items: bullish.map(([a, b]) => ({ title: a, text: b, already: false })),
    },
    {
      title: "BEARISH",
      glyph: "▼",
      color: RED,
      rgb: "248,113,113",
      items: [
        ...broken.map(([a, b]) => ({ title: a, text: b, already: true })),
        ...bearish.map(([a, b]) => ({ title: a, text: b, already: false })),
      ],
    },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))", gap: 18, alignItems: "stretch" }}>
      <style>{".si-dir-tile{transition:border-color 160ms ease,background 160ms ease,transform 160ms ease}.si-dir-tile:hover{transform:translateY(-1px)}"}</style>
      {columns.map((col) => (
        <div
          key={col.title}
          style={{
            border: "1px solid var(--si-border, #1c2733)",
            background: `radial-gradient(120% 90% at 0% 0%, rgba(${col.rgb},0.10), transparent 60%), var(--si-card, rgba(12, 17, 24, 0.9))`,
            padding: "20px 22px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: col.color, fontSize: 15, textShadow: `0 0 12px rgba(${col.rgb},0.7)` }}>{col.glyph}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: "0.14em", color: col.color, lineHeight: 1 }}>
                  {col.title}
                </span>
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-hi, #ffffff)", opacity: 0.75, marginTop: 6 }}>
                {col.title === "BULLISH" ? "What would validate this setup" : "What would break this setup"}
              </div>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.1em", color: `rgba(${col.rgb},0.85)`, paddingBottom: 2 }}>
              {String(col.items.length).padStart(2, "0")} {col.items.length === 1 ? "CHECK" : "CHECKS"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridAutoRows: "1fr", gap: 12, flex: 1 }}>
            {col.items.map((it, i) => (
              <div
                key={`${it.title}-${i}`}
                className="si-dir-tile"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `rgba(${col.rgb},0.55)`;
                  e.currentTarget.style.background = `rgba(${col.rgb},0.07)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = it.already ? "rgba(248,113,113,0.5)" : "var(--si-border, rgba(255,255,255,0.07))";
                  e.currentTarget.style.background = it.already ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.025)";
                }}
                style={{
                  border: it.already ? "1px solid rgba(248,113,113,0.5)" : "1px solid var(--si-border, rgba(255,255,255,0.07))",
                  background: it.already ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.025)",
                  padding: "14px 16px 16px",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: col.color, opacity: 0.9 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1, height: 1, background: `rgba(${col.rgb},0.22)` }} />
                  {it.already && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: RED }}>ALREADY BROKEN</span>
                  )}
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 600, color: "var(--si-text-hi, #ffffff)", lineHeight: 1.3 }}>{it.title}</div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, color: "var(--si-text-hi, #ffffff)", lineHeight: 1.5 }}>{highlightChecks(it.text)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
