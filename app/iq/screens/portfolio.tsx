"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { folio as folioData, FolioItem } from "../data";
import { cls, arr, sign, fmt, Spark } from "../utils";

const StockScreenEmbed = dynamic<{ initialSym?: string; hideHeader?: boolean }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

const DEFAULT_SHARES: Record<string, number> = {
  NVDA: 15, AAPL: 120, TSLA: 40, META: 30,
  HD: 15, MSFT: 60, AMZN: 80, PLTR: 1000,
};

function usd(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(2)}`;
}

function convPill(conv: string) {
  const c = conv === "High" ? "up" : conv === "Low" ? "dn" : "amc";
  return <span className={`pill ${c}`}>{conv}</span>;
}

/* ── Main portfolio screen ── */
export function PortfolioScreen() {
  const [holdings, setHoldings] = useState<FolioItem[]>(folioData);
  const [pfSel, setPfSel] = useState(folioData[0]?.s ?? "");
  const [shares, setShares] = useState<Record<string, number>>(() => {
    const base = { ...DEFAULT_SHARES };
    folioData.forEach(f => { if (!(f.s in base)) base[f.s] = 10; });
    return base;
  });
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [newSym, setNewSym] = useState("");
  const [newSize, setNewSize] = useState<"Small"|"Medium"|"Large">("Small");
  const [newConv, setNewConv] = useState<"High"|"Medium"|"Low">("Medium");

  const sel      = holdings.find(h => h.s === pfSel);
  const totalVal = holdings.reduce((s, h) => s + (shares[h.s] ?? 10) * h.p, 0);
  const dayPL    = holdings.reduce((s, h) => s + (shares[h.s] ?? 10) * h.p * h.c / 100, 0);
  const green    = holdings.filter(h => h.c > 0).length;
  const driver   = [...holdings].sort((a, b) => (shares[b.s] ?? 10) * b.p - (shares[a.s] ?? 10) * a.p)[0];
  const leader   = [...holdings].sort((a, b) => b.c - a.c)[0];
  const laggard  = [...holdings].sort((a, b) => a.c - b.c)[0];
  const driverWt = driver && totalVal > 0
    ? ((shares[driver.s] ?? 10) * driver.p / totalVal * 100).toFixed(0) : "0";

  function addHolding() {
    if (!newSym.trim()) return;
    const s = newSym.trim().toUpperCase();
    if (holdings.find(h => h.s === s)) { setAddOpen(false); return; }
    setHoldings(prev => [...prev, { s, n: s, p: 100, c: 0, gl: 0, size: newSize, conv: newConv, evt: "—" }]);
    setShares(prev => ({ ...prev, [s]: 10 }));
    setNewSym(""); setAddOpen(false);
  }

  function removeHolding(sym: string) {
    const next = holdings.find(h => h.s !== sym);
    setHoldings(prev => prev.filter(h => h.s !== sym));
    if (pfSel === sym) setPfSel(next?.s ?? "");
  }

  function trimHolding(sym: string) {
    setShares(prev => ({ ...prev, [sym]: Math.max(1, Math.floor((prev[sym] ?? 10) / 2)) }));
  }

  function startImport() {
    setImporting(true);
    setTimeout(() => { setImporting(false); setImportDone(true); }, 1400);
  }

  const PARSED = [{ s: "NVDA", sh: 15 }, { s: "AAPL", sh: 120 }, { s: "MSFT", sh: 60 }];

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-sub">
            {holdings.length} holdings · {usd(totalVal)} ·{" "}
            <span className={cls(dayPL)}>
              {dayPL >= 0 ? "+" : ""}{usd(Math.abs(dayPL))} today
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setImportOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M4 16l5-5 4 4 3-3 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            Import from photo
          </button>
          <button className="btn primary" onClick={() => setAddOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add holding
          </button>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* AI portfolio summary */}
        <div className="ai-block" style={{ marginBottom: 14 }}>
          <div className="card-h">
            <h3 className="ai-c">◆ AI portfolio summary</h3>
            <span className="pill ai">drivers · leaders · laggards</span>
          </div>
          <div className="card-b">
            <ul className="wmn-body" style={{ columns: 2 }}>
              <li>
                <span className="bullet" />
                <span>
                  <b>Biggest driver:</b>{" "}
                  <b style={{ color: "var(--text-hi)" }}>{driver?.s ?? "—"}</b> — {sign(driver?.c ?? 0)} at {driverWt}% weight.
                </span>
              </li>
              <li>
                <span className="bullet" />
                <span>
                  <b>Leader:</b> <b className="up">{leader?.s} {sign(leader?.c ?? 0)}</b>;{" "}
                  <b>laggard:</b> <b className="down">{laggard?.s} {sign(laggard?.c ?? 0)}</b>.
                </span>
              </li>
              <li>
                <span className="bullet" />
                <span>
                  <b>Net:</b> {green} of {holdings.length} green; day P/L{" "}
                  <b className={cls(dayPL)}>{dayPL >= 0 ? "+" : ""}{usd(Math.abs(dayPL))}</b>.
                </span>
              </li>
              <li>
                <span className="bullet" />
                <span>Click any holding on the left to see its full analysis →</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Two-panel master-detail */}
        <div className="pf-master">

          {/* LEFT: holdings list */}
          <div className="pf-side">
            <div className="card">
              <div className="card-h">
                <h3>Holdings</h3>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: ".8rem", fontWeight: 700, color: "var(--text-hi)" }}>{usd(totalVal)}</span>
                  <span style={{ fontSize: ".68rem", color: "var(--text-dim-solid)" }}>{holdings.length} names</span>
                </div>
              </div>
              <div className="pf-list">
                {holdings.length === 0 ? (
                  <div style={{ padding: 16, fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
                    No holdings — click &ldquo;Add holding&rdquo;.
                  </div>
                ) : holdings.map((f, i) => (
                  <div
                    key={f.s}
                    className={`pf-li${pfSel === f.s ? " active" : ""}`}
                    onClick={() => setPfSel(f.s)}
                  >
                    <div>
                      <span className="s">{f.s}</span>
                      <span className="n">{f.n}</span>
                    </div>
                    <div className="pf-spark">
                      <Spark seed={i + 3} up={f.c >= 0} />
                    </div>
                    <div>
                      <span className="px">{f.p >= 1000 ? `$${(f.p / 1000).toFixed(2)}K` : `$${f.p.toFixed(2)}`}</span>
                      <span className={`ch ${cls(f.c)}`}>{arr(f.c)} {sign(f.c)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: portfolio context bar + full stock detail */}
          <div className="pf-detail">
            {sel ? (
              <>
                {/* Portfolio-specific context metrics */}
                <div className="pf-ctx" style={{ marginBottom: 14 }}>
                  <div className="m" style={{ borderRight: "1px solid var(--border-soft)", paddingRight: 16, marginRight: 4 }}>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".04em", color: "var(--brand-2)", lineHeight: 1 }}>{sel.s}</span>
                    <span className="k">Current price</span>
                    <span className="v" style={{ fontFamily: "var(--f-mono)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)" }}>${sel.p >= 1000 ? (sel.p / 1000).toFixed(2) + "K" : sel.p.toFixed(2)}</span>
                  </div>
                  <div className="m">
                    <span className="k">Shares</span>
                    <span className="v">
                      <input
                        className="sh-edit"
                        type="number"
                        value={shares[sel.s] ?? 10}
                        onChange={e => setShares(prev => ({
                          ...prev,
                          [sel.s]: Math.max(1, parseInt(e.target.value) || 1),
                        }))}
                        style={{ width: 64 }}
                      />
                    </span>
                  </div>
                  <div className="m">
                    <span className="k">Market value</span>
                    <span className="v">{usd((shares[sel.s] ?? 10) * sel.p)}</span>
                  </div>
                  <div className="m">
                    <span className="k">Weight</span>
                    <span className="v">
                      {totalVal > 0 ? ((shares[sel.s] ?? 10) * sel.p / totalVal * 100).toFixed(1) : "0"}%
                    </span>
                  </div>
                  <div className="m">
                    <span className="k">Day</span>
                    <span className={`v ${cls(sel.c)}`}>{sign(sel.c)}</span>
                  </div>
                  <div className="m">
                    <span className="k">Unrealized G/L</span>
                    <span className={`v ${cls(sel.gl)}`}>{sign(sel.gl)}</span>
                  </div>
                  <div className="m">
                    <span className="k">Conviction</span>
                    <span className="v">{convPill(sel.conv)}</span>
                  </div>
                  <div className="sp" />
                  <button className="btn" onClick={() => trimHolding(sel.s)}>Trim ½</button>
                  <button className="btn" style={{ color: "var(--down)" }} onClick={() => removeHolding(sel.s)}>Sell all</button>
                </div>

                {/* Full stock detail — same as stock details page */}
                <StockScreenEmbed initialSym={pfSel} hideHeader />
              </>
            ) : (
              <div className="card">
                <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>
                  Add a holding to see its detail here.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Holding modal ── */}
      {addOpen && (
        <>
          <div className="scrim" onClick={() => setAddOpen(false)} />
          <div className="drawer" style={{ maxHeight: "min(360px,85vh)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1, fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Add Holding</div>
              <button className="closebtn" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <div className="drawer-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>Ticker</label>
                <input className="inp"
                  style={{ width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".9rem" }}
                  placeholder="e.g. NVDA"
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

      {/* ── Import from photo modal ── */}
      {importOpen && (
        <>
          <div className="scrim" onClick={() => { setImportOpen(false); setImportDone(false); setImporting(false); }} />
          <div className="drawer" style={{ maxHeight: "min(480px,88vh)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1, fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Import from photo</div>
              <button className="closebtn" onClick={() => { setImportOpen(false); setImportDone(false); setImporting(false); }}>✕</button>
            </div>
            <div className="drawer-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!importing && !importDone && (
                <div className="imp-drop" onClick={startImport}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 30, height: 30, color: "var(--brand-2)", flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M4 16l5-5 4 4 3-3 4 4" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-hi)" }}>Upload a screenshot</div>
                    <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Tap to pick a photo of your brokerage holdings</div>
                  </div>
                </div>
              )}
              {importing && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", color: "var(--text-dim-solid)" }}>
                  <span className="imp-spin" />
                  <span>Scanning image with AI…</span>
                </div>
              )}
              {importDone && (
                <>
                  <div style={{ fontSize: ".82rem", color: "var(--up)", fontWeight: 600 }}>✓ Found {PARSED.length} holdings</div>
                  {PARSED.map(row => (
                    <div key={row.s} className="imp-row">
                      <span className="s" style={{ flex: 1, fontWeight: 700 }}>{row.s}</span>
                      <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Shares:</span>
                      <input className="sh-edit" type="number" defaultValue={row.sh} />
                    </div>
                  ))}
                  <button className="btn primary" style={{ width: "100%" }}
                    onClick={() => { setImportOpen(false); setImportDone(false); }}>
                    Add to portfolio
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
