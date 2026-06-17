"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { sectorList } from "../data";
import { sign, cls, heatCol } from "../utils";

const SEC_PAGE = 10;
const SEC_PAGES = Math.ceil(sectorList.length / SEC_PAGE);

const TABS = ["Stocks", "S&P 500", "ETFs", "Crypto"];


const k = 2.0;

export function HeatmapScreen() {
  const { openSector, openStock } = useIQActions();
  const [tab, setTab] = useState(0);
  const [heatPage, setHeatPage] = useState(0);

  const start = heatPage * SEC_PAGE;
  const page = sectorList.slice(start, start + SEC_PAGE);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Market Heatmap</div>
          <h1 className="page-title">Where the day is leaning</h1>
          <div className="page-sub">
            {sectorList.length} industry groups · size = market cap, color = % change · tap &quot;View all&quot; for constituents &amp; news, or a tile to open the stock
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
        <button className="chip">Size: Market cap</button>
        <div className="spacer" />
        <div className="legend">
          -3%{" "}
          <i style={{ width: 18, height: 10, display: "inline-block", background: "rgba(208,52,76,.85)" }} />
          <i style={{ width: 18, height: 10, display: "inline-block", background: "rgba(208,52,76,.4)" }} />
          <i style={{ width: 18, height: 10, display: "inline-block", background: "#3a4658" }} />
          <i style={{ width: 18, height: 10, display: "inline-block", background: "rgba(28,170,112,.4)" }} />
          <i style={{ width: 18, height: 10, display: "inline-block", background: "rgba(28,170,112,.85)" }} />
          {" "}+3%
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <div className="treemap">
            {page.map(g => {
              const tot = g.items.reduce((s, i) => s + i[1], 0);
              return (
                <div
                  key={g.name}
                  className="tm-sector"
                  style={{ flex: `${Math.max(1, tot / 800)} 1 240px` }}
                >
                  <div
                    className="sl"
                    onClick={() => openSector(g.name)}
                    style={{ cursor: "pointer" }}
                  >
                    <span>
                      {g.name}{" "}
                      <span className={cls(g.chg)} style={{ fontFamily: "var(--f-mono)", fontWeight: 600 }}>
                        {sign(g.chg)}
                      </span>
                    </span>
                    <span style={{ color: "var(--brand-2)", fontWeight: 600 }}>View all →</span>
                  </div>
                  <div className="tm-cells">
                    {g.items.map(([sym, mc, chg]) => {
                      const w = Math.max(56, Math.sqrt(mc) * k);
                      const h = Math.max(42, Math.sqrt(mc) * k * 0.62);
                      const fs = Math.max(0.62, Math.min(1, Math.sqrt(mc) / 40));
                      const hc = heatCol(chg);
                      return (
                        <div
                          key={sym}
                          className="tm-cell"
                          onClick={e => { e.stopPropagation(); openStock(sym); }}
                          style={{ width: w, height: h, background: hc.bg }}
                        >
                          <span className="tt" style={{ fontSize: `${fs}rem`, color: hc.fg }}>{sym}</span>
                          <span className="tc" style={{ fontSize: `${fs * 0.8}rem`, color: hc.fg, opacity: 0.85 }}>{sign(chg)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, fontSize: ".82rem" }}>
        <span style={{ color: "var(--text-dim-solid)" }}>
          Sectors <b style={{ color: "var(--text-hi)" }}>{start + 1}–{Math.min(start + SEC_PAGE, sectorList.length)}</b> of {sectorList.length}
        </span>
        <span style={{ display: "flex", gap: 16 }}>
          {heatPage > 0 && (
            <span className="link" onClick={() => setHeatPage(p => p - 1)}>← Previous 10</span>
          )}
          <span className="link" onClick={() => setHeatPage(p => heatPage < SEC_PAGES - 1 ? p + 1 : 0)}>
            {heatPage < SEC_PAGES - 1 ? "Show next 10 →" : "Back to first 10 ↺"}
          </span>
        </span>
      </div>
    </>
  );
}
