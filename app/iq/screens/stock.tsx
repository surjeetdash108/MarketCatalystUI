"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { stockInfo, watch, folio } from "../data";
import { fmt, cls, arr, sign, Spark, Gauge } from "../utils";

const DEFAULT_SYM = "NVDA";
const SYMBOLS = [...Object.keys(stockInfo), ...watch.map(w => w.s), ...folio.map(f => f.s)]
  .filter((v, i, a) => a.indexOf(v) === i);

export function StockScreen() {
  const { openEarnings } = useIQActions();
  const [sym, setSym] = useState(DEFAULT_SYM);
  const [search, setSearch] = useState("");

  const suggestions = SYMBOLS.filter(s =>
    search && s.toLowerCase().startsWith(search.toLowerCase())
  );

  const info = stockInfo[sym];
  const fallback = { name: sym, px: 162, c: 2.4, mkt: "$262B", pe: 46, eps: 3.52, wkh52: 220, wkl52: 80, div: 0, beta: 1.45, sec: "Semiconductors", ai_call: "Buy", ai_thesis: "Strong competitive position in AI acceleration with new product cycle ramping.", ai_risk: "Competition from NVDA intensifying; potential margin compression.", ai_metrics: [{ l: "AI Confidence", v: "72 / 100" }, { l: "Moat", v: "Narrow" }, { l: "Insider Activity", v: "Neutral" }, { l: "Short Interest", v: "2.1%" }], fin: [{ l: "Revenue", v: "$22.7B" }, { l: "EPS", v: "$3.52" }, { l: "Gross Margin", v: "47.1%" }, { l: "P/E", v: "46×" }, { l: "P/S", v: "11×" }, { l: "Debt/Equity", v: "0.04" }], news: [{ h: "AMD launches MI300X AI chip, targets NVDA", dt: "May 22" }], ins: [{ n: "Lisa Su (CEO)", a: "No recent activity", dt: "—" }] };
  const data = info ?? fallback;
  const isUp = data.c >= 0;
  const owned = folio.some(f => f.s === sym);

  function selectSym(s: string) {
    setSym(s);
    setSearch("");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Stock Detail</div>
          <div className="page-sub">Deep analysis, AI thesis, financials, news</div>
        </div>
        <div className="actions" style={{ position: "relative" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && search) selectSym(search.toUpperCase()); }}
            placeholder="Search symbol…"
            style={{
              background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              padding: "5px 10px", fontSize: 12.5, color: "var(--text-hi)", outline: "none", width: 140,
              fontFamily: "var(--f-mono)",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", right: 0, background: "var(--surface-1)",
              border: "1px solid var(--border)", borderRadius: "var(--r-sm)", zIndex: 20,
              minWidth: 140, marginTop: 2,
            }}>
              {suggestions.slice(0, 6).map(s => (
                <div key={s} style={{
                  padding: "7px 12px", cursor: "pointer", fontSize: 12.5,
                  color: "var(--text-hi)", fontFamily: "var(--f-mono)",
                }}
                  onMouseDown={() => selectSym(s)}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >{s}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick symbol bar */}
      <div className="fbar">
        {Object.keys(stockInfo).map(s => (
          <button key={s} className={`chip${sym === s ? " active" : ""}`} onClick={() => selectSym(s)}>{s}</button>
        ))}
      </div>

      <div className="sd-grid">
        {/* Left column */}
        <div>
          {/* Hero */}
          <div className="sd-hero">
            <div className="sd-sym">{sym}</div>
            <div className="sd-name">{data.name}</div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span className="sd-px">${fmt(data.px)}</span>
              <span className={`sd-chg ${cls(data.c)}`}>{arr(data.c)} {sign(data.c)}</span>
              {owned && <span className="tag-chip owned" style={{ marginLeft: 10 }}>Owned</span>}
            </div>
            <div className="sd-meta">
              <div className="sd-meta-item">Mkt Cap <b>{data.mkt}</b></div>
              <div className="sd-meta-item">P/E <b>{data.pe}×</b></div>
              <div className="sd-meta-item">EPS <b>${data.eps}</b></div>
              <div className="sd-meta-item">52W Range <b>${data.wkl52}–${data.wkh52}</b></div>
              <div className="sd-meta-item">Dividend <b>{data.div > 0 ? `${data.div}%` : "None"}</b></div>
              <div className="sd-meta-item">Beta <b>{data.beta}</b></div>
              <div className="sd-meta-item">Sector <b>{data.sec}</b></div>
            </div>
          </div>

          {/* AI Block */}
          <div className="ai-block">
            <div className="ai-icon">✦</div>
            <div className="ai-rating">AI Verdict: {data.ai_call}</div>
            <div className="ai-thesis">{data.ai_thesis}</div>
            <div className="ai-line" style={{ marginTop: 8 }}>
              <span className="ai-line-lbl">Key Risk</span>
              <span className="ai-line-val" style={{ fontSize: 11.5, color: "var(--warn)", textAlign: "right", maxWidth: 260 }}>
                {data.ai_risk}
              </span>
            </div>
            {data.ai_metrics.map(m => (
              <div key={m.l} className="ai-line">
                <span className="ai-line-lbl">{m.l}</span>
                <span className="ai-line-val">{m.v}</span>
              </div>
            ))}
          </div>

          {/* News */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-h">
              <h3>Recent News</h3>
              <button className="more" onClick={() => openEarnings(sym)}>Earnings detail →</button>
            </div>
            <div className="card-b">
              {data.news.map((n, i) => (
                <div key={i} style={{
                  padding: "9px 0",
                  borderBottom: i < data.news.length - 1 ? "1px solid var(--border-soft)" : "none",
                }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-hi)" }}>{n.h}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim-solid)", marginTop: 2 }}>{n.dt}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Insider Activity */}
          <div className="card">
            <div className="card-h"><h3>Insider Activity</h3></div>
            <div className="card-b">
              {data.ins.map((ins, i) => (
                <div key={i} className="fin-row">
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--text-hi)", fontWeight: 600 }}>{ins.n}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text)", marginTop: 2 }}>{ins.a}</div>
                  </div>
                  <span className="fin-val">{ins.dt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Financials */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-h"><h3>Key Financials</h3></div>
            <div className="card-b">
              {data.fin.map(f => (
                <div key={f.l} className="fin-row">
                  <span className="fin-lbl">{f.l}</span>
                  <span className="fin-val">{f.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Confidence gauge */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-h"><h3>AI Confidence Score</h3></div>
            <div className="card-b" style={{ textAlign: "center" }}>
              <Gauge
                v={parseInt(data.ai_metrics[0]?.v ?? "50")}
                label={data.ai_metrics[0]?.v?.split(" ")[0] ?? "50"}
                color={parseInt(data.ai_metrics[0]?.v ?? "50") > 60 ? "var(--up)" : parseInt(data.ai_metrics[0]?.v ?? "50") > 40 ? "var(--warn)" : "var(--down)"}
                sublabel={data.ai_call}
              />
            </div>
          </div>

          {/* Sparkline */}
          <div className="card">
            <div className="card-h"><h3>Price Trend (simulated)</h3></div>
            <div className="card-b">
              <div style={{ height: 80, width: "100%" }}>
                <Spark seed={sym.charCodeAt(0)} up={isUp} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
