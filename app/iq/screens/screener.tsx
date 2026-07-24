"use client";

import { useState, useEffect, useRef } from "react";
import { screenerPresets } from "../data";
import { useCollection } from "../hooks/useCollection";
import { StockPanelLayout, StockListCard, StockRow } from "../stock-panel";

interface CompanyDoc {
  id: string; ticker: string; name: string | null;
  marketCap: number | null; peRatio: number | null; price: number | null; pctChange: number | null;
  rsRating: number | null;
  // Computed by the backend score jobs (technical-indicators / tech-rating /
  // fundamentals-growth) from real ohlcv_bars + Polygon financials.
  techRating: number | null;      // 1-99 composite
  rvol: number | null;            // relative-volume ratio
  revenueGrowthYoY: number | null; // decimal (0.064 = 6.4%)
  epsGrowthYoY: number | null;     // decimal
  grossMargin: number | null;      // decimal (0.469 = 46.9%)
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
}

/** A screener row — built entirely from a live `companies` doc. Every metric is
 *  nullable: a company whose score job hasn't run yet reads "—" and is excluded
 *  from any filter that depends on that metric, never passed on a faked value. */
interface ScreenerRow {
  ticker: string;
  name: string;
  relativeStrength: number | null;
  salesGrowth: number | null;   // %
  epsGrowth: number | null;     // %
  grossMargin: number | null;   // %
  rvolRatio: number | null;
  marketCap: number | null;     // $B
  peRatio: number | null;
  techRating: string | null;    // label from the numeric composite
  price: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
}

// Maps the numeric 1-99 tech rating onto the string categories the rating
// filter uses (Strong Buy / Buy / Neutral / Sell / Strong Sell).
function ratingLabel(n: number): string {
  if (n >= 90) return "Strong Buy";
  if (n >= 70) return "Buy";
  if (n >= 40) return "Neutral";
  if (n >= 20) return "Sell";
  return "Strong Sell";
}

// The screener universe is the LIVE `companies` collection — no curated/mock
// base. Growth/margin are stored as decimals and scaled to percent here;
// techRating is mapped to its label. Anything not yet computed stays null.
function buildScreenerUniverse(companies: CompanyDoc[]): ScreenerRow[] {
  return companies.map(c => ({
    ticker: c.ticker,
    name: c.name ?? c.ticker,
    relativeStrength: c.rsRating,
    salesGrowth: c.revenueGrowthYoY != null ? c.revenueGrowthYoY * 100 : null,
    epsGrowth: c.epsGrowthYoY != null ? c.epsGrowthYoY * 100 : null,
    grossMargin: c.grossMargin != null ? c.grossMargin * 100 : null,
    rvolRatio: c.rvol,
    marketCap: c.marketCap != null ? c.marketCap / 1e9 : null,
    peRatio: c.peRatio,
    techRating: c.techRating != null ? ratingLabel(c.techRating) : null,
    price: c.price,
    sma50: c.sma50,
    sma200: c.sma200,
    rsi14: c.rsi14,
  }));
}

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
  const { data: companies, loading } = useCollection<CompanyDoc>("companies");
  const universe = buildScreenerUniverse(companies);

  /* ── Preset multi-select ── */
  const [activePresets, setActivePresets] = useState<Set<number>>(new Set());

  /* ── Manual filter state ── */
  const [rs90,       setRs90]       = useState(false);
  const [rs7090,     setRs7090]     = useState(false);
  const [rsLt40,     setRsLt40]     = useState(false);
  const [salesGt20,  setSalesGt20]  = useState(false);
  const [epsGt25,    setEpsGt25]    = useState(false);
  const [marginPos,  setMarginPos]  = useState(false);
  const [ratingBuy,  setRatingBuy]  = useState(false);
  const [mcGt10,     setMcGt10]     = useState(true);
  const [rvolGt15,   setRvolGt15]   = useState(false);
  const [aboveDma,   setAboveDma]   = useState(false); // price > SMA50 && SMA200
  const [rsi4070,    setRsi4070]    = useState(false); // RSI(14) in 40–70
  const [priceGt5,   setPriceGt5]   = useState(false); // price > $5

  /* ── Save / restore the current screen (filter set) to localStorage ── */
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("iq-screener-filters");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s.activePresets)) setActivePresets(new Set(s.activePresets));
      setRs90(!!s.rs90); setRs7090(!!s.rs7090); setRsLt40(!!s.rsLt40);
      setSalesGt20(!!s.salesGt20); setEpsGt25(!!s.epsGt25); setMarginPos(!!s.marginPos);
      setRatingBuy(!!s.ratingBuy); setMcGt10(s.mcGt10 ?? true); setRvolGt15(!!s.rvolGt15);
      setAboveDma(!!s.aboveDma); setRsi4070(!!s.rsi4070); setPriceGt5(!!s.priceGt5);
    } catch { /* ignore malformed saved filters */ }
  }, []);
  function saveScreen() {
    const state = { activePresets: [...activePresets], rs90, rs7090, rsLt40, salesGt20, epsGt25, marginPos, ratingBuy, mcGt10, rvolGt15, aboveDma, rsi4070, priceGt5 };
    try { localStorage.setItem("iq-screener-filters", JSON.stringify(state)); } catch { /* storage full/blocked */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  /* ── More dropdown ── */
  const [ddOpen, setDdOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ddOpen) return;
    function onOutside(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setDdOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [ddOpen]);

  /* ── Selection / chart state ── */
  const [scrSel, setScrSel] = useState("");

  function togglePreset(idx: number) {
    setActivePresets(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function resetAll() {
    setActivePresets(new Set());
    setRs90(false); setRs7090(false); setRsLt40(false);
    setSalesGt20(false); setEpsGt25(false); setMarginPos(false);
    setRatingBuy(false); setMcGt10(false); setRvolGt15(false);
    setAboveDma(false); setRsi4070(false); setPriceGt5(false);
  }

  /* ── Filtered results ── */
  // Every filter requires the underlying metric to be present — a row whose
  // score hasn't computed is excluded from that filter, never passed on a
  // fabricated value.
  const filtered = universe.filter(s => {
    // Preset filters — stock must pass at least one selected preset (OR logic)
    if (activePresets.size > 0) {
      const passesAny = [...activePresets].some(idx => {
        const pf = screenerPresets[idx].f;
        if (pf.relativeStrength_min !== undefined && !(s.relativeStrength != null && s.relativeStrength >= pf.relativeStrength_min)) return false;
        if (pf.salesGrowth_min      !== undefined && !(s.salesGrowth      != null && s.salesGrowth      >= pf.salesGrowth_min))      return false;
        if (pf.epsGrowth_min        !== undefined && !(s.epsGrowth        != null && s.epsGrowth        >= pf.epsGrowth_min))        return false;
        if (pf.rvolRatio_min        !== undefined && !(s.rvolRatio        != null && s.rvolRatio        >= pf.rvolRatio_min))        return false;
        if (pf.marketCap_min        !== undefined && !(s.marketCap        != null && s.marketCap        >= pf.marketCap_min))        return false;
        if (pf.techRating           !== undefined && !(s.techRating       != null && pf.techRating.includes(s.techRating)))          return false;
        return true;
      });
      if (!passesAny) return false;
    }
    // Manual filters — all must pass (AND logic)
    if (rs90      && !(s.relativeStrength != null && s.relativeStrength >= 90))                      return false;
    if (rs7090    && !(s.relativeStrength != null && s.relativeStrength >= 70 && s.relativeStrength < 90)) return false;
    if (rsLt40    && !(s.relativeStrength != null && s.relativeStrength < 40))                       return false;
    if (salesGt20 && !(s.salesGrowth != null && s.salesGrowth > 20))                                 return false;
    if (epsGt25   && !(s.epsGrowth   != null && s.epsGrowth   > 25))                                 return false;
    if (marginPos && !(s.grossMargin != null && s.grossMargin > 10))                                 return false;
    if (ratingBuy && !(s.techRating != null && ["Strong Buy", "Buy"].includes(s.techRating)))        return false;
    if (mcGt10    && !(s.marketCap != null && s.marketCap >= 10))                                    return false;
    if (rvolGt15  && !(s.rvolRatio != null && s.rvolRatio >= 1.5))                                   return false;
    if (aboveDma  && !(s.price != null && s.sma50 != null && s.sma200 != null && s.price > s.sma50 && s.price > s.sma200)) return false;
    if (rsi4070   && !(s.rsi14 != null && s.rsi14 >= 40 && s.rsi14 <= 70))                           return false;
    if (priceGt5  && !(s.price != null && s.price > 5))                                              return false;
    return true;
  });

  /* selected stock — fall back to first result if current sel drops out */
  const selStock = filtered.find(s => s.ticker === scrSel) ?? filtered[0] ?? null;
  const selSym   = selStock?.ticker ?? "";
  const selPx    = selStock?.price ?? 0;

  /* how many "More" presets (index >= 4) are active */
  const moreActiveCount = [...activePresets].filter(i => i >= 4).length;

  return (
    <>
      <div className="page-head">
        <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
          {filtered.length} match{filtered.length !== 1 ? "es" : ""}
          {universe.length > 0 && <> · <span style={{ color: "var(--text-dim-solid)" }}>{universe.length} companies scanned</span></>}
        </span>
        <button className="btn primary" onClick={saveScreen}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M5 5h14v14l-7-4-7 4z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {saved ? "Saved ✓" : "Save screen"}
        </button>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* ── Filter card ── */}
        <div className="card" style={{ marginBottom: 14, overflow: "visible" }}>

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
            {screenerPresets.slice(0, 4).map((p, i) => {
              const on = activePresets.has(i);
              return (
                <button key={p.name} onClick={() => togglePreset(i)} style={{
                  fontSize: ".72rem", padding: "4px 11px", borderRadius: 6, cursor: "pointer",
                  fontFamily: "var(--f-body)",
                  border: `1px solid ${on ? "var(--ai)" : "var(--border)"}`,
                  background: on ? "var(--ai-dim)" : "var(--surface-2)",
                  color: on ? "var(--text-hi)" : "var(--text-dim-solid)",
                }}>{p.name}</button>
              );
            })}

            {/* More dropdown — controlled, multi-select, close on outside click */}
            <div ref={ddRef} style={{ position: "relative" }}>
              <button
                onClick={() => setDdOpen(o => !o)}
                style={{
                  fontSize: ".72rem", padding: "4px 11px", borderRadius: 6, cursor: "pointer",
                  fontFamily: "var(--f-body)",
                  border: `1px solid ${moreActiveCount > 0 ? "var(--ai)" : ddOpen ? "var(--brand)" : "var(--border)"}`,
                  background: moreActiveCount > 0 ? "var(--ai-dim)" : ddOpen ? "var(--brand-dim)" : "var(--surface-2)",
                  color: moreActiveCount > 0 || ddOpen ? "var(--text-hi)" : "var(--text-dim-solid)",
                }}
              >
                More{moreActiveCount > 0 ? ` (${moreActiveCount})` : ""} {ddOpen ? "▴" : "▾"}
              </button>
              {ddOpen && (
                <div className="dd-menu" style={{ minWidth: 280 }}>
                  <div className="ddlbl">{screenerPresets.length} preset screens — select multiple</div>
                  {screenerPresets.map((p, i) => {
                    const on = activePresets.has(i);
                    return (
                      <button
                        key={p.name}
                        onClick={() => togglePreset(i)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 8, background: on ? "var(--ai-dim)" : undefined }}
                      >
                        <span style={{
                          flexShrink: 0, width: 14, height: 14, marginTop: 2,
                          border: `1.5px solid ${on ? "var(--ai)" : "var(--border-strong)"}`,
                          borderRadius: 4, background: on ? "var(--ai)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {on && (
                            <svg viewBox="0 0 24 24" fill="none" style={{ width: 9, height: 9 }}>
                              <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span>
                          {p.name}<small>{p.desc}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
              <CheckOpt label="Above 50 & 200-DMA" on={aboveDma}  onToggle={() => setAboveDma(o => !o)} />
              <CheckOpt label="RSI 40–70"          on={rsi4070}   onToggle={() => setRsi4070(o => !o)} />
            </div>
            <div className="fgroup" style={{ flex: 1, borderBottom: "none" }}>
              <div className="fl">Liquidity &amp; cap</div>
              <CheckOpt label="Market cap > $10B"  on={mcGt10}   onToggle={() => setMcGt10(o => !o)} />
              <CheckOpt label="RVOL > 1.5×"        on={rvolGt15} onToggle={() => setRvolGt15(o => !o)} />
              <CheckOpt label="Price > $5"          on={priceGt5} onToggle={() => setPriceGt5(o => !o)} />
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
              emptyMessage={
                universe.length === 0
                  ? (loading ? "Loading companies…" : "No company data has synced yet.")
                  : "No matches — try relaxing filters."
              }
              maxListHeight={414}
            >
              {filtered.map((s, i) => (
                <StockRow
                  key={s.ticker}
                  sym={s.ticker}
                  name={s.name}
                  seed={i + 11}
                  sparkUp={(s.relativeStrength ?? 0) >= 60}
                  isSelected={selSym === s.ticker}
                  onClick={() => setScrSel(s.ticker)}
                  valueTop={s.relativeStrength == null ? "RS —" : `RS ${s.relativeStrength}`}
                  valueBottom={s.techRating ?? "—"}
                  valueBottomClass={s.techRating == null ? "" : s.techRating.includes("Buy") ? "up" : s.techRating.includes("Sell") ? "down" : ""}
                />
              ))}
            </StockListCard>
          }
        />

      </div>
    </>
  );
}
