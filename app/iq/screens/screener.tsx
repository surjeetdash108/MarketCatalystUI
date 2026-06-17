"use client";

import { useState, useRef, useEffect } from "react";
import { useIQActions } from "../shell";
import { screenerStocks, screenerPresets } from "../data";
import { cls, sign } from "../utils";

const RATING_COLOR: Record<string, string> = {
  "Strong Buy":  "var(--up)",
  "Buy":         "#7bdcae",
  "Neutral":     "var(--text-dim-solid)",
  "Sell":        "#ff9aab",
  "Strong Sell": "var(--down)",
};

function mcLabel(mc: number) {
  return mc >= 1000 ? `$${(mc / 1000).toFixed(2)}T` : `$${mc}B`;
}

function CheckOpt({
  label, on, onToggle,
}: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className={`fopt${on ? " on" : ""}`} onClick={onToggle}>
      <span className="cb">
        {on && (
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 10, height: 10 }}>
            <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </div>
  );
}

export function ScreenerScreen() {
  const { openStock } = useIQActions();

  // ---- preset state ----
  const [activePreset, setActivePreset] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const browseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (browseRef.current && !browseRef.current.contains(e.target as Node)) {
        setShowAll(false);
      }
    }
    if (showAll) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAll]);

  // ---- checkbox filter state ----
  const [rs90,      setRs90]      = useState(false);
  const [rs7090,    setRs7090]    = useState(false);
  const [rsLt40,    setRsLt40]    = useState(false);
  const [salesGt20, setSalesGt20] = useState(false);
  const [epsGt25,   setEpsGt25]   = useState(false);
  const [marginPos, setMarginPos] = useState(false);
  const [ratingBuy, setRatingBuy] = useState(false);
  const [mcGt10,    setMcGt10]    = useState(true);
  const [rvolGt15,  setRvolGt15]  = useState(false);

  function applyPreset(idx: number) {
    const f = screenerPresets[idx].f;
    setActivePreset(idx);
    setShowAll(false);
    // reset all checkboxes then apply preset's intended checkboxes
    setRs90(false); setRs7090(false); setRsLt40(false);
    setSalesGt20(false); setEpsGt25(false); setMarginPos(false);
    setRatingBuy(false); setMcGt10(true); setRvolGt15(false);
    if (f.rs_min !== undefined && f.rs_min >= 90) setRs90(true);
    else if (f.rs_min !== undefined && f.rs_min >= 70) setRs7090(true);
    if (f.salesG_min !== undefined && f.salesG_min >= 20) setSalesGt20(true);
    if (f.epsG_min !== undefined && f.epsG_min >= 25) setEpsGt25(true);
    if (f.rvol_min !== undefined && f.rvol_min >= 1.5) setRvolGt15(true);
  }

  function resetAll() {
    setActivePreset(-1);
    setRs90(false); setRs7090(false); setRsLt40(false);
    setSalesGt20(false); setEpsGt25(false); setMarginPos(false);
    setRatingBuy(false); setMcGt10(false); setRvolGt15(false);
  }

  // ---- apply preset filter + checkbox filters ----
  const pf = activePreset >= 0 ? screenerPresets[activePreset].f : {};

  const filtered = screenerStocks.filter(s => {
    // preset rules
    if (pf.rs_min    !== undefined && s.rs     < pf.rs_min)    return false;
    if (pf.salesG_min!== undefined && s.salesG < pf.salesG_min)return false;
    if (pf.epsG_min  !== undefined && s.epsG   < pf.epsG_min)  return false;
    if (pf.rvol_min  !== undefined && s.rvol   < pf.rvol_min)  return false;
    if (pf.mc_min    !== undefined && s.mc     < pf.mc_min)    return false;
    if (pf.rating    !== undefined && !pf.rating.includes(s.rating)) return false;
    // checkbox rules
    if (rs90      && s.rs < 90)                          return false;
    if (rs7090    && (s.rs < 70 || s.rs >= 90))          return false;
    if (rsLt40    && s.rs >= 40)                          return false;
    if (salesGt20 && s.salesG < 20)                      return false;
    if (epsGt25   && s.epsG   < 25)                      return false;
    if (marginPos && s.mgn    <= 10)                      return false;
    if (ratingBuy && !["Strong Buy","Buy"].includes(s.rating)) return false;
    if (mcGt10    && s.mc < 10)                           return false;
    if (rvolGt15  && s.rvol < 1.5)                        return false;
    return true;
  });

  const firstFour = screenerPresets.slice(0, 4);
  const allPresets = screenerPresets;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Stock Screener</div>
          <div className="page-title">Find your next idea</div>
          <div className="page-sub">
            Fundamental + technical filters · {filtered.length} of {screenerStocks.length} stocks match
          </div>
        </div>
        <button className="btn primary">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M5 5h14v14l-7-4-7 4z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Save screen
        </button>
      </div>

      <div className="scr-grid" style={{ padding: "14px 18px" }}>

        {/* ---- Left filter panel ---- */}
        <div className="filt">
          <div className="filt-hdr">
            Filters
            <span className="link" onClick={resetAll}>Reset</span>
          </div>

          {/* Preset buttons */}
          <div className="preset-list">
            <div className="fgroup-lbl" style={{ padding: 0 }}>Saved &amp; preset screens</div>
            {firstFour.map((p, i) => (
              <button key={p.name}
                className={`preset-btn${activePreset === i ? " on" : ""}`}
                onClick={() => applyPreset(i)}>
                {p.name}
                <small>{p.desc}</small>
              </button>
            ))}

            {/* Browse all 20 presets dropdown */}
            <div style={{ position: "relative" }} ref={browseRef}>
              <button className="browse-btn" onClick={() => setShowAll(o => !o)}>
                <span>Browse all {allPresets.length} presets</span>
                <span style={{ fontSize: ".7rem" }}>{showAll ? "▲" : "▾"}</span>
              </button>
              {showAll && (
                <div className="browse-dropdown" style={{ position: "absolute", zIndex: 20, left: 0, right: 0 }}>
                  {allPresets.map((p, i) => (
                    <button key={p.name}
                      className={`browse-item${activePreset === i ? " on" : ""}`}
                      onClick={() => applyPreset(i)}>
                      {p.name}
                      <small>{p.desc}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Relative Strength */}
          <div className="fgroup">
            <div className="fgroup-lbl">Relative strength (6-mo)</div>
            <CheckOpt label="RS ≥ 90 (leaders)"  on={rs90}   onToggle={() => { setRs90(o => !o); setRs7090(false); setRsLt40(false); }} />
            <CheckOpt label="RS 70–90"            on={rs7090} onToggle={() => { setRs7090(o => !o); setRs90(false); setRsLt40(false); }} />
            <CheckOpt label="RS < 40 (laggards)"  on={rsLt40} onToggle={() => { setRsLt40(o => !o); setRs90(false); setRs7090(false); }} />
          </div>

          {/* Growth */}
          <div className="fgroup">
            <div className="fgroup-lbl">Growth</div>
            <CheckOpt label="Sales growth > 20%"  on={salesGt20} onToggle={() => setSalesGt20(o => !o)} />
            <CheckOpt label="EPS growth > 25%"    on={epsGt25}   onToggle={() => setEpsGt25(o => !o)} />
            <CheckOpt label="Expanding margins"   on={marginPos} onToggle={() => setMarginPos(o => !o)} />
          </div>

          {/* Technical rating */}
          <div className="fgroup">
            <div className="fgroup-lbl">Technical rating</div>
            <CheckOpt label="Strong Buy / Buy"      on={ratingBuy} onToggle={() => setRatingBuy(o => !o)} />
            <CheckOpt label="Above 50 & 200-DMA"    on={false}     onToggle={() => {}} />
            <CheckOpt label="RSI 40–70"             on={false}     onToggle={() => {}} />
          </div>

          {/* Liquidity & cap */}
          <div className="fgroup">
            <div className="fgroup-lbl">Liquidity &amp; cap</div>
            <CheckOpt label="Market cap > $10B"   on={mcGt10}   onToggle={() => setMcGt10(o => !o)} />
            <CheckOpt label="RVOL > 1.5×"         on={rvolGt15} onToggle={() => setRvolGt15(o => !o)} />
            <CheckOpt label="Price > $5"           on={false}    onToggle={() => {}} />
          </div>
        </div>

        {/* ---- Right results table ---- */}
        <div className="card">
          <div className="card-h">
            <h3>Results · {filtered.length} matches</h3>
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
              Sorted by 6-mo RS ▾ · click a row to open the chart
            </span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Sector</th>
                  <th className="num">Mkt Cap</th>
                  <th className="num">P/E</th>
                  <th className="num">RS</th>
                  <th className="num">Sales Gr</th>
                  <th className="num">EPS Gr</th>
                  <th className="num">Margin</th>
                  <th className="num">RVOL</th>
                  <th className="num">Tech Rating</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => b.rs - a.rs)
                  .map(s => (
                    <tr key={s.s} style={{ cursor: "pointer" }} onClick={() => openStock(s.s)}>
                      <td>
                        <div className="co">
                          <span className="s">{s.s}</span>
                          <span className="n">{s.n}</span>
                        </div>
                      </td>
                      <td>{s.sec}</td>
                      <td className="num">{mcLabel(s.mc)}</td>
                      <td className="num">{s.pe.toFixed(1)}</td>
                      <td className="num">
                        <b style={{ color: s.rs >= 80 ? "var(--up)" : s.rs < 40 ? "var(--down)" : "var(--text)" }}>
                          {s.rs}
                        </b>
                      </td>
                      <td className={`num ${cls(s.salesG)}`}>{sign(s.salesG)}</td>
                      <td className={`num ${cls(s.epsG)}`}>{sign(s.epsG)}</td>
                      <td className="num">{s.mgn}%</td>
                      <td className="num">{s.rvol.toFixed(1)}×</td>
                      <td className="num">
                        <span className="tr-badge"
                          style={{ background: RATING_COLOR[s.rating] + "22", color: RATING_COLOR[s.rating] }}>
                          {s.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", padding: "10px 14px 14px" }}>
            The &ldquo;Briefing growth screen&rdquo; preset mirrors a relative-strength + sales/EPS-growth + margin-expansion
            filter. Technical Rating is computed from 11 oscillators and 15 moving averages — informational,
            not investment advice.
          </p>
        </div>
      </div>
    </>
  );
}
