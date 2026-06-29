"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { watch as watchData, WatchItem, screenerStocks, movers as moversData } from "../data";
import { cls, arr, sign, fmt, StockLogo } from "../utils";

const StockScreenEmbed = dynamic<{ initialSym?: string }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

type WlRange = "eod" | "eow";
type Filter = "All" | "Has alert" | "Options active";

function wlAlerts(w: WatchItem): Array<[string, string, string]> {
  const a: Array<[string, string, string]> = [];
  if (Math.abs(w.c) >= 3) a.push(["Price", w.c >= 0 ? "up" : "down", (w.c >= 0 ? "+" : "") + w.c.toFixed(1) + "%"]);
  if (w.analyst && /upgrade|→ (Buy|Overweight|Outperform)/i.test(w.analyst)) a.push(["Analyst", "up", "upgrade"]);
  if (w.analyst && /downgrade|→ (Sell|Underweight|Neutral)/i.test(w.analyst)) a.push(["Analyst", "down", "downgrade"]);
  if (w.opt) a.push(["Options", "warn", "unusual"]);
  return a;
}

export function WatchlistScreen() {
  const [wlRange,       setWlRange]       = useState<WlRange>("eod");
  const [aiOn,          setAiOn]          = useState<Set<string>>(() => new Set(watchData.map(w => w.s)));
  const [watching,      setWatching]      = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("iq-watchlist");
      if (saved) { try { return new Set(JSON.parse(saved) as string[]); } catch { /* ignore */ } }
    }
    return new Set(watchData.map(w => w.s));
  });
  const [filter,        setFilter]        = useState<Filter>("All");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedSym,   setSelectedSym]   = useState<string | null>(null);

  function toggleAI(sym: string) {
    setAiOn(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  }

  function toggleWatch(sym: string) {
    setWatching(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      if (typeof window !== "undefined") {
        localStorage.setItem("iq-watchlist", JSON.stringify([...next]));
      }
      return next;
    });
  }

  function deleteFromWatchlist(sym: string) {
    setWatching(prev => {
      const next = new Set(prev);
      next.delete(sym);
      if (typeof window !== "undefined") {
        localStorage.setItem("iq-watchlist", JSON.stringify([...next]));
      }
      return next;
    });
    setConfirmDelete(null);
  }

  const list = watchData.filter(w => {
    if (filter === "Has alert") return wlAlerts(w).length > 0;
    if (filter === "Options active") return w.opt;
    return true;
  });

  const up      = list.filter(w => w.c > 0).length;
  const dn      = list.filter(w => w.c < 0).length;
  const best    = [...list].sort((a, b) => b.c - a.c)[0];
  const worst   = [...list].sort((a, b) => a.c - b.c)[0];
  const aiCount = aiOn.size;

  const eodText =
    `Your ${list.length} watched names finished <b class="up">${up} up</b> / <b class="down">${dn} down</b> today.` +
    (best ? ` <b>${best.s}</b> led (${sign(best.c)})` : "") +
    (worst && worst.s !== best?.s ? `, <b>${worst.s}</b> lagged (${sign(worst.c)})` : "") +
    `. Broad market: Nasdaq <b class="up">+1.02%</b>, S&P 500 <b class="up">+0.73%</b> — a risk-on tape favoring your tech-heavy list.`;

  const eowText =
    `On the week the list tracked the broad market — Nasdaq <b class="up">+2.6%</b>, S&P 500 <b class="up">+1.8%</b>. Momentum names (${list.slice(0, 2).map(w => w.s).join(", ")}) carried; watch for mean-reversion into next week's data.`;

  const sumTxt = wlRange === "eod" ? eodText : eowText;

  return (
    <>
      <div className="page-head">
  
        <div className="tabs">
          <button className={`tab${wlRange === "eod" ? " on" : ""}`} onClick={() => setWlRange("eod")}>EOD summary</button>
          <button className={`tab${wlRange === "eow" ? " on" : ""}`} onClick={() => setWlRange("eow")}>EOW summary</button>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* AI Watchlist Summary */}
        <div className="ai-block" style={{ marginBottom: 14 }}>
          <div className="card-h">
            <h3 className="ai-c">◆ Watchlist {wlRange === "eod" ? "end-of-day" : "end-of-week"} summary</h3>
            <span className="pill ai">AI</span>
          </div>
          <div className="card-b">
            <p dangerouslySetInnerHTML={{ __html: sumTxt }}
              style={{ marginBottom: 10, fontSize: ".88rem", lineHeight: 1.55 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="src-chip">Up {up}/{list.length}</span>
              <span className="src-chip">AI parsing: {aiCount}</span>
              <span className="src-chip">Nasdaq +1.02%</span>
              <span className="src-chip">S&amp;P +0.73%</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="fbar" style={{ marginBottom: 12 }}>
          {(["All", "Has alert", "Options active"] as Filter[]).map(f => (
            <button key={f} className={`chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Add names with the ⭐ in search (⌘K)</span>
        </div>

        {/* Watchlist table */}
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Price</th>
                  <th>Day</th>
                  <th>Next ER</th>
                  <th>Alerts</th>
                  <th>AI parse</th>
                  <th>Watch</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map(w => {
                  const al = wlAlerts(w);
                  const ai = aiOn.has(w.s);
                  return (
                    <tr key={w.s}>
                      <td onClick={() => setSelectedSym(w.s)} style={{ cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StockLogo sym={w.s} size={26} />
                          <div className="co">
                            <span className="s">{w.s}</span>
                            <span className="n">{w.n}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num">{fmt(w.px)}</td>
                      <td className={`num ${cls(w.c)}`}>{arr(w.c)} {sign(w.c)}</td>
                      <td style={{ fontSize: ".8rem" }}>{w.er}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {al.length > 0
                          ? al.map((a, i) => (
                              <span key={i} className={`pill ${a[1]}`} style={{ fontSize: ".66rem", marginRight: 3 }}>
                                {a[0]}: {a[2]}
                              </span>
                            ))
                          : <span style={{ color: "var(--text-dim-solid)", fontSize: ".8rem" }}>—</span>
                        }
                      </td>
                      <td>
                        <button className={`ai-toggle${ai ? " on" : ""}`} onClick={() => toggleAI(w.s)}>
                          {ai ? "AI ✓" : "AI"}
                        </button>
                      </td>
                      <td>
                        <button className={`wl-star${watching.has(w.s) ? " on" : ""}`} onClick={() => toggleWatch(w.s)}>★</button>
                      </td>
                      <td>
                        <button
                          onClick={() => setConfirmDelete(w.s)}
                          title="Remove from watchlist"
                          style={{
                            background: "none", border: "1px solid var(--border)", borderRadius: 6,
                            padding: "4px 8px", cursor: "pointer", color: "var(--down)",
                            lineHeight: 1, transition: ".15s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--down-dim)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, display: "block" }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete confirmation popup */}
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
              Are you sure want to delete{" "}
              <b style={{ color: "var(--text-hi)" }}>{confirmDelete}</b>{" "}
              from your watchlist?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn primary" onClick={() => deleteFromWatchlist(confirmDelete)}>OK</button>
            </div>
          </div>
        </>
      )}

      {/* Sliding stock detail drawer */}
      {selectedSym && (() => {
        const w  = watchData.find(x => x.s === selectedSym);
        const ss = screenerStocks.find(x => x.s === selectedSym);
        const mv = moversData.find(x => x.s === selectedSym);
        const px = mv?.p ?? w?.px ?? 0;
        const c  = mv?.c ?? w?.c ?? 0;
        const sector = mv?.sector ?? ss?.sec ?? "—";
        const rs = ss?.rs ?? "—";
        return (
          <>
            <div className="scrim" onClick={() => setSelectedSym(null)} />
            <div className="stock-side-drawer">
              <div className="drawer-h" style={{ paddingTop: 14, paddingBottom: 14 }}>
                <StockLogo sym={selectedSym} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
                    {selectedSym} · {w?.n ?? selectedSym}
                  </div>
                  <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                    {sector}
                  </div>
                </div>
                <button className="closebtn" onClick={() => setSelectedSym(null)}>✕</button>
              </div>
              <div className="drawer-b" style={{ padding: "14px 14px 0" }}>
                {/* Watchlist context bar — mirrors portfolio's pf-ctx */}
                <div className="pf-ctx" style={{ marginBottom: 14 }}>
                  <div className="m">
                    <span className="k">Price</span>
                    <span className="v">${fmt(px)}</span>
                  </div>
                  <div className="m">
                    <span className="k">Day</span>
                    <span className={`v ${cls(c)}`}>{sign(c)}</span>
                  </div>
                  {w?.er && (
                    <div className="m">
                      <span className="k">Next ER</span>
                      <span className="v" style={{ fontSize: ".8rem" }}>{w.er}</span>
                    </div>
                  )}
                  <div className="m">
                    <span className="k">RS Rank</span>
                    <span className="v">{rs}</span>
                  </div>
                  {w?.analyst && (
                    <div className="m" style={{ flex: 1 }}>
                      <span className="k">Analyst</span>
                      <span className="v" style={{ fontSize: ".72rem" }}>{w.analyst}</span>
                    </div>
                  )}
                </div>
                <StockScreenEmbed initialSym={selectedSym} />
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
}
