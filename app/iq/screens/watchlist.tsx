"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { watch as watchData } from "../data";
import { cls, arr, sign, Spark } from "../utils";

const StockScreenEmbed = dynamic<{ initialSym?: string; hideHeader?: boolean }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

export function WatchlistScreen() {
  const [items, setItems]               = useState<string[]>(() => watchData.map(w => w.s));
  const [sel, setSel]                   = useState<string | null>(() => watchData[0]?.s ?? null);
  const [addOpen, setAddOpen]           = useState(false);
  const [newSym, setNewSym]             = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

        {/* Two-panel master-detail */}
        <div className="pf-master">

          {/* LEFT: watchlist */}
          <div className="pf-side">
            <div className="card">
              <div className="card-h">
                <h3>Watchlist</h3>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{items.length} stocks</span>
              </div>
              <div className="pf-list">
                {items.length === 0 ? (
                  <div style={{ padding: 16, fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
                    No stocks — click &ldquo;Add stock&rdquo;.
                  </div>
                ) : items.map((sym, i) => {
                  const w  = watchData.find(x => x.s === sym);
                  const px = w?.px ?? 0;
                  const c  = w?.c  ?? 0;
                  return (
                    <div
                      key={sym}
                      className={`pf-li${sel === sym ? " active" : ""}`}
                      style={{ gridTemplateColumns: "1fr 60px auto auto" }}
                      onClick={() => setSel(sym)}
                    >
                      <div>
                        <span className="s">{sym}</span>
                        <span className="n">{w?.n ?? sym}</span>
                      </div>
                      <div className="pf-spark">
                        <Spark seed={i + 3} up={c >= 0} />
                      </div>
                      <div>
                        <span className="px">{px >= 1000 ? `$${(px / 1000).toFixed(2)}K` : `$${px.toFixed(2)}`}</span>
                        <span className={`ch ${cls(c)}`}>{arr(c)} {sign(c)}</span>
                      </div>
                      <button
                        className="wl-del-btn"
                        title="Remove from watchlist"
                        onClick={e => { e.stopPropagation(); setConfirmDelete(sym); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: stock detail */}
          <div className="pf-detail">
            {sel ? (
              <>
                {selData && (
                  <div className="pf-ctx" style={{ marginBottom: 14 }}>
                    <div className="m" style={{ borderRight: "1px solid var(--border-soft)", paddingRight: 16, marginRight: 4 }}>
                      <span style={{ fontFamily: "var(--f-mono)", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".04em", color: "var(--brand-2)", lineHeight: 1 }}>{sel}</span>
                      <span className="k">Current price</span>
                      <span className="v" style={{ fontFamily: "var(--f-mono)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)" }}>
                        ${selData.px >= 1000 ? (selData.px / 1000).toFixed(2) + "K" : selData.px.toFixed(2)}
                      </span>
                    </div>
                    <div className="m">
                      <span className="k">Day</span>
                      <span className={`v ${cls(selData.c)}`}>{sign(selData.c)}</span>
                    </div>
                    {selData.er && (
                      <div className="m">
                        <span className="k">Next ER</span>
                        <span className="v" style={{ fontSize: ".8rem" }}>{selData.er}</span>
                      </div>
                    )}
                    {selData.analyst && (
                      <div className="m" style={{ flex: 1 }}>
                        <span className="k">Analyst</span>
                        <span className="v" style={{ fontSize: ".72rem" }}>{selData.analyst}</span>
                      </div>
                    )}
                  </div>
                )}
                <StockScreenEmbed initialSym={sel} hideHeader />
              </>
            ) : (
              <div className="card">
                <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>
                  Add a stock to see its detail here.
                </div>
              </div>
            )}
          </div>
        </div>
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
