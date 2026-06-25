"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { sectorList } from "../data";
import { sign, heatCol } from "../utils";

const TABS = ["Stocks", "S&P 500"];
const HEADER_H = 24; // px height of each sector's label bar
const APPROX_W = 1100; // used only for font-size estimation
const APPROX_H = 620;

// ---- Recursive bisection treemap layout ----
interface LItem { key: string; weight: number; }
interface LRect { key: string; x: number; y: number; w: number; h: number; }

function bisect(items: LItem[], x: number, y: number, w: number, h: number): LRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ key: items[0].key, x, y, w, h }];
  if (items.length === 2) {
    const total = items[0].weight + items[1].weight;
    const f = items[0].weight / total;
    return w >= h
      ? [{ key: items[0].key, x, y, w: w * f, h }, { key: items[1].key, x: x + w * f, y, w: w * (1 - f), h }]
      : [{ key: items[0].key, x, y, w, h: h * f }, { key: items[1].key, x, y: y + h * f, w, h: h * (1 - f) }];
  }
  const total = items.reduce((s, i) => s + i.weight, 0);
  let cum = 0;
  let split = 0;
  const half = total / 2;
  for (let i = 0; i < items.length - 1; i++) {
    cum += items[i].weight;
    split = i;
    if (cum >= half) break;
  }
  const first = items.slice(0, split + 1);
  const rest = items.slice(split + 1);
  const frac = first.reduce((s, i) => s + i.weight, 0) / total;
  return w >= h
    ? [...bisect(first, x, y, w * frac, h), ...bisect(rest, x + w * frac, y, w * (1 - frac), h)]
    : [...bisect(first, x, y, w, h * frac), ...bisect(rest, x, y + h * frac, w, h * (1 - frac))];
}

export function HeatmapScreen() {
  const { openSector, openStock } = useIQActions();
  const [tab, setTab] = useState(0);

  // Sort sectors by weight descending for better layout
  const sorted = [...sectorList].sort(
    (a, b) => b.items.reduce((s, i) => s + i[1], 0) - a.items.reduce((s, i) => s + i[1], 0)
  );

  const sectorItems: LItem[] = sorted.map(g => ({
    key: g.name,
    weight: g.items.reduce((s, i) => s + i[1], 0),
  }));

  const sectorLayout = bisect(sectorItems, 0, 0, 100, 100);
  const sectorRectMap = Object.fromEntries(sectorLayout.map(r => [r.key, r]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Market Heatmap</div>
          <h1 className="page-title">Where the day is leaning</h1>
          <div className="page-sub">
            {sectorList.length} sectors · size = market cap · color = % change · click a tile to open the stock
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === tab ? " on" : ""}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="fbar">
        <button className="chip on">Color: % change</button>
        <div className="spacer" />
        <div className="legend" style={{ gap: 4 }}>
          <span style={{ fontSize: ".66rem", color: "var(--down)" }}>−3%</span>
          <i style={{ width: 22, height: 12, display: "inline-block", borderRadius: 2, background: "rgba(208,52,76,.85)" }} />
          <i style={{ width: 22, height: 12, display: "inline-block", borderRadius: 2, background: "rgba(208,52,76,.4)" }} />
          <i style={{ width: 22, height: 12, display: "inline-block", borderRadius: 2, background: "#3a4658" }} />
          <i style={{ width: 22, height: 12, display: "inline-block", borderRadius: 2, background: "rgba(28,170,112,.4)" }} />
          <i style={{ width: 22, height: 12, display: "inline-block", borderRadius: 2, background: "rgba(28,170,112,.85)" }} />
          <span style={{ fontSize: ".66rem", color: "var(--up)" }}>+3%</span>
        </div>
      </div>

      {/* ── Full-viewport treemap ── */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 220px)",
        minHeight: 520,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--bg)",
      }}>
        {sorted.map(g => {
          const lr = sectorRectMap[g.name];
          if (!lr) return null;

          // Sort stocks within sector largest first
          const stocksSorted = [...g.items].sort((a, b) => b[1] - a[1]);
          const stockItems: LItem[] = stocksSorted.map(([sym, mc]) => ({ key: sym, weight: mc }));
          const stockLayout = bisect(stockItems, 0, 0, 100, 100);
          const stockMap = Object.fromEntries(stockLayout.map(r => [r.key, r]));

          // Approx pixel size of this sector for font sizing
          const sectPxW = (lr.w / 100) * APPROX_W;
          const sectPxH = (lr.h / 100) * APPROX_H;

          return (
            <div
              key={g.name}
              style={{
                position: "absolute",
                left: `${lr.x}%`,
                top: `${lr.y}%`,
                width: `${lr.w}%`,
                height: `${lr.h}%`,
                padding: 2,
                boxSizing: "border-box",
              }}
            >
              <div style={{
                width: "100%",
                height: "100%",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,.07)",
                position: "relative",
                background: "var(--surface-0)",
                display: "flex",
                flexDirection: "column",
              }}>
                {/* Sector header */}
                <div
                  onClick={() => openSector(g.name)}
                  style={{
                    height: HEADER_H,
                    minHeight: HEADER_H,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 7px",
                    cursor: "pointer",
                    background: "rgba(0,0,0,.3)",
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    fontSize: ".6rem", fontWeight: 700,
                    letterSpacing: ".05em", textTransform: "uppercase",
                    color: "var(--text-dim-solid)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {g.name}
                  </span>
                  <span style={{
                    fontSize: ".62rem", fontFamily: "var(--f-mono)", fontWeight: 700,
                    color: g.chg >= 0 ? "var(--up)" : "var(--down)",
                    flexShrink: 0,
                  }}>
                    {sign(g.chg)}
                  </span>
                </div>

                {/* Stock cells — relative container */}
                <div style={{ position: "relative", flex: 1 }}>
                  {stocksSorted.map(([sym, , chg]) => {
                    const sr = stockMap[sym];
                    if (!sr) return null;
                    const hc = heatCol(chg);

                    // Approximate pixel size of this cell
                    const cellPxW = (sr.w / 100) * sectPxW;
                    const cellPxH = (sr.h / 100) * (sectPxH - HEADER_H);
                    const minDim = Math.min(cellPxW, cellPxH);
                    const showText = minDim > 18 && cellPxW > 24;
                    const showChange = minDim > 32 && cellPxW > 40;
                    const fs = Math.max(0.56, Math.min(1.05, Math.sqrt(cellPxW * cellPxH) / 72));

                    return (
                      <div
                        key={sym}
                        onClick={e => { e.stopPropagation(); openStock(sym); }}
                        title={`${sym}  ${sign(chg)}`}
                        style={{
                          position: "absolute",
                          left: `${sr.x}%`,
                          top: `${sr.y}%`,
                          width: `${sr.w}%`,
                          height: `${sr.h}%`,
                          background: hc.bg,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          cursor: "pointer",
                          boxSizing: "border-box",
                          border: "1px solid rgba(0,0,0,.18)",
                          overflow: "hidden",
                          padding: 2,
                          transition: "filter .1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.25)")}
                        onMouseLeave={e => (e.currentTarget.style.filter = "")}
                      >
                        {showText && (
                          <>
                            <span style={{
                              fontFamily: "var(--f-mono)", fontWeight: 700,
                              color: hc.fg, fontSize: `${fs}rem`,
                              lineHeight: 1, textAlign: "center",
                              whiteSpace: "nowrap",
                            }}>
                              {sym}
                            </span>
                            {showChange && (
                              <span style={{
                                fontFamily: "var(--f-mono)",
                                color: hc.fg, opacity: .82,
                                fontSize: `${fs * 0.82}rem`,
                                lineHeight: 1, marginTop: 3,
                              }}>
                                {sign(chg)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
