"use client";

import { useState } from "react";
import { screenerStocks, screenerPresets, watch as watchData, movers as moversData } from "../data";
import { StockPanelLayout, StockListCard, StockRow } from "../stock-panel";

function CheckOpt({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
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
  /* ── Filter state ── */
  const [activePreset, setActivePreset] = useState(-1);
  const [rs90,       setRs90]       = useState(false);
  const [rs7090,     setRs7090]     = useState(false);
  const [rsLt40,     setRsLt40]     = useState(false);
  const [salesGt20,  setSalesGt20]  = useState(false);
  const [epsGt25,    setEpsGt25]    = useState(false);
  const [marginPos,  setMarginPos]  = useState(false);
  const [ratingBuy,  setRatingBuy]  = useState(false);
  const [mcGt10,     setMcGt10]     = useState(true);
  const [rvolGt15,   setRvolGt15]   = useState(false);

  /* ── Selection / chart state ── */
  const [scrSel, setScrSel] = useState("");

  function applyPreset(idx: number) {
    const f = screenerPresets[idx].f;
    setActivePreset(idx);
    setRs90(false); setRs7090(false); setRsLt40(false);
    setSalesGt20(false); setEpsGt25(false); setMarginPos(false);
    setRatingBuy(false); setMcGt10(true); setRvolGt15(false);
    if (f.relativeStrength_min !== undefined && f.relativeStrength_min >= 90)  setRs90(true);
    else if (f.relativeStrength_min !== undefined && f.relativeStrength_min >= 70) setRs7090(true);
    if (f.salesGrowth_min !== undefined && f.salesGrowth_min >= 20) setSalesGt20(true);
    if (f.epsGrowth_min   !== undefined && f.epsGrowth_min   >= 25) setEpsGt25(true);
    if (f.rvolRatio_min   !== undefined && f.rvolRatio_min   >= 1.5) setRvolGt15(true);
  }

  function resetAll() {
    setActivePreset(-1);
    setRs90(false); setRs7090(false); setRsLt40(false);
    setSalesGt20(false); setEpsGt25(false); setMarginPos(false);
    setRatingBuy(false); setMcGt10(false); setRvolGt15(false);
  }

  const pf = activePreset >= 0 ? screenerPresets[activePreset].f : {};

  /* ── Filtered results ── */
  const filtered = screenerStocks.filter(s => {
    if (pf.relativeStrength_min     !== undefined && s.relativeStrength     < pf.relativeStrength_min)     return false;
    if (pf.salesGrowth_min !== undefined && s.salesGrowth < pf.salesGrowth_min) return false;
    if (pf.epsGrowth_min   !== undefined && s.epsGrowth   < pf.epsGrowth_min)   return false;
    if (pf.rvolRatio_min   !== undefined && s.rvolRatio   < pf.rvolRatio_min)   return false;
    if (pf.marketCap_min     !== undefined && s.marketCap     < pf.marketCap_min)     return false;
    if (pf.techRating     !== undefined && !pf.techRating.includes(s.techRating)) return false;
    if (rs90      && s.relativeStrength < 90)                                   return false;
    if (rs7090    && (s.relativeStrength < 70 || s.relativeStrength >= 90))                   return false;
    if (rsLt40    && s.relativeStrength >= 40)                                   return false;
    if (salesGt20 && s.salesGrowth < 20)                               return false;
    if (epsGt25   && s.epsGrowth   < 25)                               return false;
    if (marginPos && s.grossMargin    <= 10)                               return false;
    if (ratingBuy && !["Strong Buy", "Buy"].includes(s.techRating))   return false;
    if (mcGt10    && s.marketCap < 10)                                    return false;
    if (rvolGt15  && s.rvolRatio < 1.5)                                return false;
    return true;
  });

  /* selected stock — fall back to first result if current sel drops out */
  const selStock = filtered.find(s => s.ticker === scrSel) ?? filtered[0] ?? null;
  const selSym   = selStock?.ticker ?? "";

  /* price for CandleChart */
  const selWatch = watchData.find(w => w.ticker === selSym);
  const selMover = moversData.find(m => m.ticker === selSym);
  const selPx    = selWatch?.price ?? selMover?.price ?? 0;

  return (
    <>
      <div className="page-head">
        <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
          {filtered.length} match{filtered.length !== 1 ? "es" : ""}
        </span>
        <button className="btn primary">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M5 5h14v14l-7-4-7 4z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Save screen
        </button>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* ── Filter card ── */}
        <div className="card" style={{ marginBottom: 14 }}>

          <div className="filt-hdr">
            Filters
            <span className="link" onClick={resetAll}>Reset</span>
          </div>

          {/* Presets row */}
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
            padding: "10px 14px", borderBottom: "1px solid var(--border-soft)",
          }}>
            <span style={{
              fontSize: ".66rem", letterSpacing: ".05em", textTransform: "uppercase",
              color: "var(--text-dim-solid)", fontWeight: 600, marginRight: 4,
            }}>Presets</span>
            {screenerPresets.slice(0, 4).map((p, i) => (
              <button key={p.name} onClick={() => applyPreset(i)} style={{
                fontSize: ".72rem", padding: "4px 11px", borderRadius: 6, cursor: "pointer",
                fontFamily: "var(--f-body)",
                border: `1px solid ${activePreset === i ? "var(--ai)" : "var(--border)"}`,
                background: activePreset === i ? "var(--ai-dim)" : "var(--surface-2)",
                color: activePreset === i ? "var(--text-hi)" : "var(--text-dim-solid)",
              }}>{p.name}</button>
            ))}
            <details className="dd">
              <summary style={{
                cursor: "pointer", fontSize: ".72rem", padding: "4px 11px",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--text-dim-solid)", listStyle: "none",
              }}>More ▾</summary>
              <div className="dd-menu">
                <div className="ddlbl">{screenerPresets.length} preset screens</div>
                {screenerPresets.map((p, i) => (
                  <button key={p.name} onClick={() => applyPreset(i)}>
                    {p.name}<small>{p.desc}</small>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Filter groups — horizontal */}
          <div style={{ display: "flex" }}>
            <div className="fgroup" style={{ flex: 1, borderBottom: "none", borderRight: "1px solid var(--border-soft)" }}>
              <div className="fl">Relative strength (6-mo)</div>
              <CheckOpt label="RS ≥ 90 (leaders)"  on={rs90}   onToggle={() => { setRs90(o => !o); setRs7090(false); setRsLt40(false); }} />
              <CheckOpt label="RS 70–90"            on={rs7090} onToggle={() => { setRs7090(o => !o); setRs90(false); setRsLt40(false); }} />
              <CheckOpt label="RS < 40 (laggards)"  on={rsLt40} onToggle={() => { setRsLt40(o => !o); setRs90(false); setRs7090(false); }} />
            </div>
            <div className="fgroup" style={{ flex: 1, borderBottom: "none", borderRight: "1px solid var(--border-soft)" }}>
              <div className="fl">Growth</div>
              <CheckOpt label="Sales growth > 20%"  on={salesGt20} onToggle={() => setSalesGt20(o => !o)} />
              <CheckOpt label="EPS growth > 25%"    on={epsGt25}   onToggle={() => setEpsGt25(o => !o)} />
              <CheckOpt label="Expanding margins"   on={marginPos} onToggle={() => setMarginPos(o => !o)} />
            </div>
            <div className="fgroup" style={{ flex: 1, borderBottom: "none", borderRight: "1px solid var(--border-soft)" }}>
              <div className="fl">Technical rating</div>
              <CheckOpt label="Strong Buy / Buy"   on={ratingBuy} onToggle={() => setRatingBuy(o => !o)} />
              <CheckOpt label="Above 50 & 200-DMA" on={false}     onToggle={() => {}} />
              <CheckOpt label="RSI 40–70"          on={false}     onToggle={() => {}} />
            </div>
            <div className="fgroup" style={{ flex: 1, borderBottom: "none" }}>
              <div className="fl">Liquidity &amp; cap</div>
              <CheckOpt label="Market cap > $10B"  on={mcGt10}   onToggle={() => setMcGt10(o => !o)} />
              <CheckOpt label="RVOL > 1.5×"        on={rvolGt15} onToggle={() => setRvolGt15(o => !o)} />
              <CheckOpt label="Price > $5"          on={false}    onToggle={() => {}} />
            </div>
          </div>

        </div>

        <StockPanelLayout
          selectedSym={selSym}
          chartPx={selPx}
          chartEmptyText="Select a stock from the results"
          detailEmptyText="Select a stock from the results to see its full analysis."
          listCard={
            <StockListCard
              title="Results"
              headerRight={<span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{filtered.length} matches</span>}
              isEmpty={filtered.length === 0}
              emptyMessage="No matches — try relaxing filters."
              maxListHeight={414}
            >
              {filtered.map((s, i) => (
                <StockRow
                  key={s.ticker}
                  sym={s.ticker}
                  name={s.name}
                  seed={i + 11}
                  sparkUp={s.relativeStrength >= 60}
                  isSelected={selSym === s.ticker}
                  onClick={() => setScrSel(s.ticker)}
                  valueTop={`RS ${s.relativeStrength}`}
                  valueBottom={s.techRating}
                  valueBottomClass={s.techRating.includes("Buy") ? "up" : s.techRating.includes("Sell") ? "down" : ""}
                />
              ))}
            </StockListCard>
          }
        />

      </div>
    </>
  );
}
