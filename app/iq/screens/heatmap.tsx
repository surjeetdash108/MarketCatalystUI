"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { sectorList } from "../data";
import { cls, arr } from "../utils";

function heatColor(chg: number): string {
  if (chg > 2) return "#1a5c38";
  if (chg > 1) return "#1f7245";
  if (chg > 0) return "#245c38";
  if (chg === 0) return "#1B2433";
  if (chg > -1) return "#5c2424";
  if (chg > -2) return "#7a1e1e";
  return "#8f1212";
}

function stockHeatColor(chg: number): string {
  if (chg > 1.5) return "#175c35";
  if (chg > 0.5) return "#1d6b40";
  if (chg > 0) return "#1c4530";
  if (chg === 0) return "#1B2433";
  if (chg > -0.5) return "#4a1c1c";
  if (chg > -1.5) return "#6b1d1d";
  return "#821a1a";
}

export function HeatmapScreen() {
  const { openSector, openStock } = useIQActions();
  const [view, setView] = useState<"sector" | "stock">("sector");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Market Heatmap</div>
          <div className="page-sub">Today's sector and stock performance by weight</div>
        </div>
        <div className="actions">
          <button className={`chip${view === "sector" ? " active" : ""}`} onClick={() => setView("sector")}>By Sector</button>
          <button className={`chip${view === "stock" ? " active" : ""}`} onClick={() => setView("stock")}>By Stock</button>
        </div>
      </div>

      {view === "sector" ? (
        <div className="heat-grid">
          {sectorList.map(s => (
            <div
              key={s.name}
              className="heat-cell"
              style={{
                background: heatColor(s.chg),
                minHeight: 80,
                flexBasis: `${Math.max(8, Math.min(20, 100 / sectorList.length * 2.5))}%`,
              }}
              onClick={() => openSector(s.name)}
            >
              <div className="ht" style={{ fontSize: 11 }}>{s.name}</div>
              <div className="hc">{s.chg > 0 ? "+" : ""}{s.chg.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="heat-grid">
          {sectorList.flatMap(s =>
            s.items.map(([sym, mc, chg]) => (
              <div
                key={sym}
                className="heat-cell"
                style={{
                  background: stockHeatColor(chg),
                  minHeight: Math.max(50, Math.min(100, mc / 100)),
                  flexBasis: `${Math.max(5, Math.min(15, mc / 200))}%`,
                }}
                onClick={() => openStock(sym)}
              >
                <div className="ht" style={{ fontSize: 10.5 }}>{sym}</div>
                <div className="hc" style={{ fontSize: 9.5 }}>{chg > 0 ? "+" : ""}{chg.toFixed(1)}%</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sector table */}
      <div style={{ padding: "0 18px 18px" }}>
        <div className="card">
          <div className="card-h"><h3>Sector Summary</h3></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>#</th><th>Sector</th><th>Change</th><th>Trend</th><th>Top Holdings</th></tr>
              </thead>
              <tbody>
                {sectorList.map(s => (
                  <tr key={s.name} onClick={() => openSector(s.name)}>
                    <td style={{ color: "var(--text-dim-solid)" }}>{s.rank}</td>
                    <td style={{ color: "var(--text-hi)", fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <span className={cls(s.chg)} style={{ fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                        {arr(s.chg)} {Math.abs(s.chg).toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                        background: s.trend === "Improving" ? "var(--up-dim)" : s.trend === "Deteriorating" ? "var(--down-dim)" : "var(--surface-3)",
                        color: s.trend === "Improving" ? "var(--up)" : s.trend === "Deteriorating" ? "var(--down)" : "var(--text-dim-solid)",
                      }}>{s.trend}</span>
                    </td>
                    <td style={{ color: "var(--text-dim-solid)", fontSize: 11 }}>
                      {s.items.slice(0, 4).map(([t]) => t).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
