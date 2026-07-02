"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { watch as watchData } from "../data";
import { arr, sign, Spark, CandleChart } from "../utils";

const StockScreenEmbed = dynamic<{ initialSym?: string; hideHeader?: boolean; hideChart?: boolean }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

export function WatchlistScreen() {
  const [items, setItems]               = useState<string[]>(() => watchData.map(w => w.s));
  const [sel, setSel]                   = useState<string | null>(() => watchData[0]?.s ?? null);
  const [addOpen, setAddOpen]           = useState(false);
  const [newSym, setNewSym]             = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [wlTf, setWlTf] = useState("3M");

  const list = watchData.filter(w => items.includes(w.s));
  const up   = list.filter(w => w.c > 0).length;
  const dn   = list.filter(w => w.c < 0).length;
  const best  = [...list].sort((a, b) => b.c - a.c)[0];
  const worst = [...list].sort((a, b) => a.c - b.c)[0];

  const sumTxt =
    `Your ${list.length} watched names finished <b class="up">${up} up</b> / <b class="down">${dn} down</b> today.` +
    (best  ? ` <b>${best.s}</b> led (${sign(best.c)})` : "") +
    (worst && worst.s !== best?.s ? `, <b>${worst.s}</b> lagged (${sign(worst.c)})` : "") +
    `. Broad market: Nasdaq <b class="up">+1.02%</b>, S&P 500 <b class="up">+0.73%</b>.`;

  function addStock() {
    const s = newSym.trim().toUpperCase();
    if (!s || items.includes(s)) { setNewSym(""); setAddOpen(false); return; }
    setItems(prev => [...prev, s]);
    setSel(s);
    setNewSym("");
    setAddOpen(false);
  }

  function deleteStock(sym: string) {
    setItems(prev => {
      const next = prev.filter(s => s !== sym);
      if (sel === sym) setSel(next[0] ?? null);
      return next;
    });
    setConfirmDelete(null);
  }

  const selData = list.find(w => w.s === sel);

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-sub">{items.length} stocks watching · {up} up / {dn} down today</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => setAddOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add stock
          </button>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* AI watchlist summary */}
        <div className="ai-block" style={{ marginBottom: 14 }}>
          <div className="card-h">
            <h3 className="ai-c">◆ AI watchlist summary</h3>
            <span className="pill ai">leaders · laggards · alerts</span>
          </div>
          <div className="card-b">
            <p dangerouslySetInnerHTML={{ __html: sumTxt }}
              style={{ marginBottom: 10, fontSize: ".88rem", lineHeight: 1.55 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="src-chip">Up {up}/{list.length}</span>
              <span className="src-chip">Nasdaq +1.02%</span>
              <span className="src-chip">S&amp;P +0.73%</span>
            </div>
          </div>
        </div>

        {/* TOP ROW: Watchlist list (left) + Chart (right) — same height */}
        <div style={{ display: "flex", gap: 14, alignItems: "stretch", marginBottom: 14 }}>

          {/* LEFT: vertical watchlist list */}
          <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="card-h">
                <h3>Watchlist</h3>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{items.length} stocks</span>
              </div>
              <div className="pf-list" style={{ flex: 1, maxHeight: "none", overflowY: "auto" }}>
                {items.length === 0 ? (
                  <div style={{ padding: 16, fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
                    No stocks — click &ldquo;Add stock&rdquo;.
                  </div>
                ) : items.map((sym, i) => {
                  const w  = watchData.find(x => x.s === sym);
                  const px = w?.px ?? 0;
                  const c  = w?.c  ?? 0;
                  return (
                    <div key={sym} className={`pf-li${sel === sym ? " active" : ""}`}
                      style={{ gridTemplateColumns: "1fr 60px auto auto" }}
                      onClick={() => setSel(sym)}>
                      <div>
                        <span className="s">{sym}</span>
                        <span className="n">{w?.n ?? sym}</span>
                      </div>
                      <div className="pf-spark"><Spark seed={i + 3} up={c >= 0} /></div>
                      <div>
                        <span className="px">{px >= 1000 ? `$${(px / 1000).toFixed(2)}K` : `$${px.toFixed(2)}`}</span>
                        <span className={`ch ${c >= 0 ? "up" : "down"}`}>{arr(c)} {sign(c)}</span>
                      </div>
                      <button className="wl-del-btn" title="Remove"
                        onClick={e => { e.stopPropagation(); setConfirmDelete(sym); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 10, height: 10 }}>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Chart card */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {sel ? (
              <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div className="chart-toolbar">
                  {["1D","1W","1M","3M","6M","1Y","5Y"].map(r => (
                    <button key={r} className={`rng tfbtn${wlTf === r ? " on" : ""}`} onClick={() => setWlTf(r)}>{r}</button>
                  ))}
                </div>
                <div style={{ padding: "0 14px 14px", flex: 1 }}>
                  <CandleChart sym={sel} tf={wlTf} px={selData?.px ?? 0}
                    maStep={0} emaStep={0} showVol chartType="candles" />
                </div>
              </div>
            ) : (
              <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "var(--text-dim-solid)", fontSize: ".85rem" }}>Select a stock to see chart</span>
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM: Stock detail without chart */}
        {sel ? (
          <StockScreenEmbed initialSym={sel} hideHeader hideChart />
        ) : (
          <div className="card">
            <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>
              Add a stock to see its detail here.
            </div>
          </div>
        )}
      </div>

      {/* Add stock modal */}
      {addOpen && (
        <>
          <div className="scrim" onClick={() => setAddOpen(false)} />
          <div className="drawer" style={{ maxHeight: "min(240px,85vh)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1, fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Add Stock</div>
              <button className="closebtn" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <div className="drawer-b" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>Ticker symbol</label>
                <input
                  autoFocus
                  style={{ width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".9rem" }}
                  placeholder="e.g. TSLA"
                  value={newSym}
                  onChange={e => setNewSym(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") addStock(); }}
                />
              </div>
              <button className="btn primary" style={{ width: "100%" }} onClick={addStock}>
                Add to watchlist
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <>
          <div className="scrim" style={{ zIndex: 60 }} onClick={() => setConfirmDelete(null)} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "var(--surface-1)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: 24, zIndex: 61,
            minWidth: 320, boxShadow: "0 16px 48px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)", marginBottom: 8 }}>
              Remove from watchlist
            </div>
            <div style={{ fontSize: ".88rem", color: "var(--text)", marginBottom: 20 }}>
              Remove <b style={{ color: "var(--text-hi)" }}>{confirmDelete}</b> from your watchlist?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn primary" onClick={() => deleteStock(confirmDelete)}>Remove</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
