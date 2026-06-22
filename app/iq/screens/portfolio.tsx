"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { folio as folioData, FolioItem } from "../data";
import { cls, arr, sign } from "../utils";

const ALERTS = [
  { title: "Earnings posted",       subs: "NVDA, AAPL" },
  { title: "Move > 5% post-ER",     subs: "All holdings" },
  { title: "Analyst up/downgrade",  subs: "All holdings" },
  { title: "Unusual options",       subs: "NVDA, TSLA" },
  { title: "13F change",            subs: "Tracked funds" },
];

const PULSE = [
  "NVDA is your standout, up +8.2% after a beat-and-raise. It's now your largest position by weight — consider whether you want to trim into strength.",
  "AAPL reports after close. Options imply a ±4.8% move. You hold a large position with high conviction — set a post-earnings alert.",
  "TSLA caught a UBS upgrade (Sell → Neutral). The stock is your only red year-to-date holding at -8.1%.",
  "HD lowered guidance — down -1.1%. Low conviction, small size; not a portfolio risk today.",
];

function convPill(conv: string) {
  const c = conv === "High" ? "up" : conv === "Low" ? "dn" : "amc";
  return <span className={`pill ${c}`}>{conv}</span>;
}

export function PortfolioScreen() {
  const { openStock } = useIQActions();
  const [holdings, setHoldings] = useState<FolioItem[]>(folioData);
  const [addOpen, setAddOpen] = useState(false);
  const [sellSym, setSellSym] = useState<string | null>(null);
  const [newSym, setNewSym] = useState("");
  const [newSize, setNewSize] = useState<"Small"|"Medium"|"Large">("Small");
  const [newConv, setNewConv] = useState<"High"|"Medium"|"Low">("Medium");

  const drivers  = [...holdings].sort((a, b) => b.gl - a.gl).slice(0, 2);
  const laggards = [...holdings].sort((a, b) => a.gl - b.gl).slice(0, 2);
  const leaders  = [...holdings].sort((a, b) => b.c - a.c).slice(0, 2);

  function addHolding() {
    if (!newSym.trim()) return;
    const s = newSym.trim().toUpperCase();
    if (holdings.find(h => h.s === s)) { setAddOpen(false); return; }
    setHoldings(prev => [...prev, {
      s, n: s, p: 100, c: 0, gl: 0,
      size: newSize, conv: newConv, evt: "—",
    }]);
    setNewSym(""); setAddOpen(false);
  }

  function removeHolding(sym: string) {
    setHoldings(prev => prev.filter(h => h.s !== sym));
    setSellSym(null);
  }

  function partialSell(sym: string) {
    setHoldings(prev => prev.map(h =>
      h.s === sym ? { ...h, size: h.size === "Large" ? "Medium" : h.size === "Medium" ? "Small" : "Small", gl: h.gl * 0.5 } : h
    ));
    setSellSym(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">My Portfolio</div>
          <div className="page-title">Portfolio Pulse</div>
          <div className="page-sub">
            {holdings.length} holdings · $128,430 ·{" "}
            <span className="up">+1.42% today (+$1,798)</span>
          </div>
        </div>
        <button className="btn primary" onClick={() => setAddOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add holding
        </button>
      </div>

      <div className="dash" style={{ padding: "0 18px 18px" }}>
        {/* col-8: WMN + holdings */}
        <div className="col-8" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* AI Portfolio Summary — drivers, laggards, leaders */}
          <div className="wmn">
            <div className="wmn-h">
              <div className="t">
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2>AI Portfolio Summary · Today</h2>
                  <div className="meta">
                    <span className="live"><span className="dot" />Live</span>
                    · {holdings.length} holdings tracked
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: "14px 18px 4px" }}>
              <div>
                <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--up)", marginBottom: 6 }}>▲ Drivers</div>
                {drivers.map(d => (
                  <div key={d.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(d.s)}>
                    <span className="tkr">{d.s}</span>
                    <span className={`r ${cls(d.gl)}`}>{sign(d.gl)} G/L</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--down)", marginBottom: 6 }}>▼ Laggards</div>
                {laggards.map(l => (
                  <div key={l.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(l.s)}>
                    <span className="tkr">{l.s}</span>
                    <span className={`r ${cls(l.gl)}`}>{sign(l.gl)} G/L</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--brand-2)", marginBottom: 6 }}>◆ Leaders today</div>
                {leaders.map(l => (
                  <div key={l.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(l.s)}>
                    <span className="tkr">{l.s}</span>
                    <span className={`r ${cls(l.c)}`}>{sign(l.c)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="wmn-foot">
              <span style={{ color: "var(--ai)" }}>AI-generated · not investment advice</span>
            </div>
          </div>

          {/* Holdings table */}
          <div className="card">
            <div className="card-h">
              <h3>Holdings · {holdings.length}</h3>
              <span className="link">Manage alerts →</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th className="num">Price</th>
                    <th className="num">Day</th>
                    <th className="num">G/L</th>
                    <th>Size</th>
                    <th>Conviction</th>
                    <th>Today's event</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(f => (
                    <tr key={f.s} style={{ cursor: "pointer" }} onClick={() => openStock(f.s)}>
                      <td>
                        <div className="co">
                          <span className="s">{f.s}</span>
                          <span className="n">{f.n}</span>
                        </div>
                      </td>
                      <td className="num">${f.p.toFixed(2)}</td>
                      <td className={`num ${cls(f.c)}`}>{sign(f.c)}</td>
                      <td className={`num ${cls(f.gl)}`}>{sign(f.gl)}</td>
                      <td><span className="pill hold">{f.size}</span></td>
                      <td>{convPill(f.conv)}</td>
                      <td style={{ color: f.evt === "—" ? "var(--text-dim-solid)" : "var(--text)", fontSize: ".8rem" }}>{f.evt}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="pill amc" style={{ cursor: "pointer", fontSize: ".62rem" }}
                            onClick={() => setSellSym(f.s)}>Sell</button>
                          <button className="pill dn" style={{ cursor: "pointer", fontSize: ".62rem" }}
                            onClick={() => removeHolding(f.s)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* col-4: Active alerts */}
        <div className="col-4">
          <div className="card">
            <div className="card-h">
              <h3>Active alerts</h3>
              <span className="link">Edit →</span>
            </div>
            <div className="card-b">
              {ALERTS.map(a => (
                <div key={a.title} className="minirow">
                  <span className="mid">
                    <b style={{ color: "var(--text-hi)" }}>{a.title}</b>
                    <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{a.subs}</div>
                  </span>
                  <span className="r"><span className="pill up">On</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Holding modal ── */}
      {addOpen && (
        <>
          <div className="scrim" onClick={() => setAddOpen(false)} />
          <div className="drawer" style={{ maxHeight: "min(360px,85vh)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Add Holding</div>
              </div>
              <button className="closebtn" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <div className="drawer-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>Ticker</label>
                <input className="inp" placeholder="e.g. NVDA"
                  style={{ width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".9rem" }}
                  value={newSym} onChange={e => setNewSym(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>Position size</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["Small","Medium","Large"] as const).map(s => (
                    <button key={s} className={`chip${newSize === s ? " on" : ""}`} onClick={() => setNewSize(s)}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>Conviction</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["High","Medium","Low"] as const).map(c => (
                    <button key={c} className={`chip${newConv === c ? " on" : ""}`} onClick={() => setNewConv(c)}>{c}</button>
                  ))}
                </div>
              </div>
              <button className="btn primary" style={{ width: "100%" }} onClick={addHolding}>Add to portfolio</button>
            </div>
          </div>
        </>
      )}

      {/* ── Sell dialog ── */}
      {sellSym && (
        <>
          <div className="scrim" onClick={() => setSellSym(null)} />
          <div className="drawer" style={{ maxHeight: "min(280px,80vh)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Sell {sellSym}</div>
              </div>
              <button className="closebtn" onClick={() => setSellSym(null)}>✕</button>
            </div>
            <div className="drawer-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: ".84rem", color: "var(--text-dim-solid)" }}>
                Choose how much of your {sellSym} position to close.
              </p>
              <button className="btn primary" style={{ width: "100%" }} onClick={() => partialSell(sellSym)}>
                Partial sell (reduce size by half)
              </button>
              <button className="btn" style={{ width: "100%", color: "var(--down)" }} onClick={() => removeHolding(sellSym)}>
                Full exit (remove from portfolio)
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
