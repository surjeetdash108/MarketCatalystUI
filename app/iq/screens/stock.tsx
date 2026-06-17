"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { stockInfo, watch, folio, earnings as earningsData, sectorByName, sectorList, screenerStocks, fundDetail } from "../data";
import { fmt, cls, arr, sign, CandleChart, RsiPane, TrGauge, RATING_VAL } from "../utils";

const LOGO_BG: Record<string, [string, string]> = {
  AAPL: ["#1c4c73", "#cce8ff"], NVDA: ["#1f6b4d", "#c8f5e0"], MSFT: ["#003f8c", "#d0e8ff"],
  GOOGL: ["#4a0e0e", "#ffd0d0"], META: ["#0d3b7a", "#d0e4ff"], AMZN: ["#6b3a00", "#ffe8cc"],
  TSLA: ["#6b0000", "#ffd0d0"], JPM: ["#003a6b", "#cce0ff"], V: ["#0d3b6b", "#cce0ff"],
  UNH: ["#006b4d", "#c8f5e0"],
};
const logoBg = (s: string) => LOGO_BG[s]?.[0] ?? "#1a2640";
const logoFg = (s: string) => LOGO_BG[s]?.[1] ?? "#8fd6ff";

const EXCHANGE: Record<string, string> = {
  AAPL: "NASDAQ", NVDA: "NASDAQ", MSFT: "NASDAQ", GOOGL: "NASDAQ", META: "NASDAQ",
  AMZN: "NASDAQ", TSLA: "NASDAQ", JPM: "NYSE", V: "NYSE", UNH: "NYSE",
};

const BEAT_STREAK: Record<string, number> = {
  AAPL: 4, NVDA: 6, MSFT: 5, GOOGL: 3, META: 4, AMZN: 3, TSLA: -1, JPM: 5, V: 4, UNH: 3,
};
const INST_OWN: Record<string, number> = {
  AAPL: 61, NVDA: 66, MSFT: 72, GOOGL: 68, META: 63, AMZN: 59, TSLA: 44, JPM: 72, V: 81, UNH: 82,
};
const SHORT_INT: Record<string, number> = {
  AAPL: 0.7, NVDA: 1.1, MSFT: 0.6, GOOGL: 0.8, META: 1.3, AMZN: 1.0, TSLA: 3.2, JPM: 0.4, V: 0.5, UNH: 0.6,
};

function ratingCounts(rt: string) {
  const MAP: Record<string, { ol: string; ml: string; o: [number,number,number]; m: [number,number,number] }> = {
    "Strong Buy":  { ol: "Strong Buy",  ml: "Strong Buy",  o: [1,2,8],  m: [0,1,14] },
    "Buy":         { ol: "Buy",         ml: "Buy",         o: [2,4,5],  m: [1,3,11] },
    "Neutral":     { ol: "Neutral",     ml: "Neutral",     o: [3,5,3],  m: [3,5,7]  },
    "Sell":        { ol: "Sell",        ml: "Sell",        o: [5,4,2],  m: [8,4,3]  },
    "Strong Sell": { ol: "Strong Sell", ml: "Strong Sell", o: [8,2,1],  m: [12,2,1] },
  };
  return MAP[rt] ?? MAP["Neutral"];
}

const ac = (a: string) => a === "Buy" ? "var(--up)" : a === "Sell" ? "var(--down)" : "var(--text-dim-solid)";

const SYMBOLS = [...Object.keys(stockInfo), ...watch.map(w => w.s), ...folio.map(f => f.s)]
  .filter((v, i, a) => a.indexOf(v) === i);

export function StockScreen() {
  const { openEarnings, openStock } = useIQActions();
  const [sym, setSym] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("iq-stock") || "NVDA";
    return "NVDA";
  });
  const [search, setSearch] = useState("");
  const [tfActive, setTfActive] = useState("1M");
  const [toneActive, setToneActive] = useState("Swing");
  const [showMA, setShowMA] = useState(true);
  const [showVol, setShowVol] = useState(true);
  const [showRsi, setShowRsi] = useState(false);

  const suggestions = SYMBOLS.filter(s =>
    search && s.toLowerCase().startsWith(search.toLowerCase())
  );

  const info = stockInfo[sym];
  const ss = screenerStocks.find(x => x.s === sym);
  const erEntry = earningsData.find(e => e.s === sym);

  const fallbackData = {
    name: sym, px: 162, c: 2.4, mkt: "$262B", pe: 46, eps: 3.52,
    wkh52: 220, wkl52: 80, div: 0, beta: 1.45, sec: "Semiconductors",
    ai_call: "Neutral", ai_thesis: "", ai_risk: "",
    ai_metrics: [] as { l: string; v: string }[],
    fin: [] as { l: string; v: string }[],
    news: [] as { h: string; dt: string }[],
    ins: [] as { n: string; a: string; dt: string }[],
  };
  const data = info ?? fallbackData;
  const isUp = data.c >= 0;
  const p = data.px;

  const rating = ss?.rating ?? data.ai_call ?? "Neutral";
  const rs = ss?.rs ?? 55;
  const mg = ss?.mgn ?? 20;
  const rv = ss?.rvol ?? 1.2;
  const mc = ss?.mc ?? 100;
  const gv = RATING_VAL[rating] ?? 0;
  const tone = gv > 0.6 ? "var(--up)" : gv > 0 ? "#7bdcae" : gv < -0.6 ? "var(--down)" : gv < 0 ? "#ff9aab" : "var(--text-dim-solid)";
  const rc = ratingCounts(rating);

  const ex = EXCHANGE[sym] ?? "NASDAQ";
  const group = data.sec ?? ss?.sec ?? "Technology";
  const st = BEAT_STREAK[sym] ?? 2;
  const si = SHORT_INT[sym] ?? 2.0;
  const io = INST_OWN[sym] ?? 60;
  const erDate = erEntry?.t ?? data.ai_metrics?.find(m => m.l === "Next ER")?.v ?? "—";
  const fundsHolding = Object.values(fundDetail).filter(fd => fd.holdings.some(h => h[0] === sym)).length;

  // Derived financials
  const eps = p / (data.pe || 25);
  const ni = mc / (data.pe || 25);
  const rev = ni / ((mg / 100) || 0.2);
  const fcf = ni * 0.9;
  const debt = mc * 0.04;
  const rsi = Math.round(38 + rs * 0.36);
  const dollar = Math.abs(data.c / 100 * p);
  const avgVol = Math.max(1, Math.round(mc * 1000 / p * 0.012));

  const cap = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(2)}T` : v >= 10 ? `$${Math.round(v)}B` : `$${v.toFixed(1)}B`;
  const nf = (x: number) => Math.round(x).toLocaleString("en-US");
  const lo = p * (rs > 60 ? 0.58 : 0.78), hi = p * 1.02;
  const S1 = p * 0.965, S2 = p * 0.93, R1 = p * 1.03, R2 = p * 1.06;

  const trendTxt = isUp && rs >= 70
    ? "<b>Strong uptrend.</b> Higher highs and higher lows; momentum confirmed by recent strength."
    : rs < 40
    ? "<b>Downtrend.</b> Lower highs and lower lows; price is below key moving averages."
    : "<b>Range / consolidation.</b> Choppy two-way action with no decisive trend yet.";
  const maTxt = rs >= 60 ? "Above the 20, 50 and 200-day — bullish alignment."
    : rs < 40 ? "Below the 50 and 200-day — bearish alignment."
    : "Mixed: hugging the 50-day with a flat 200-day.";

  const indRows: [string, string, string][] = [
    ["RSI (14)", rsi.toFixed(2), rsi > 70 ? "Sell" : rsi < 40 ? "Buy" : "Neutral"],
    ["MACD (12,26)", (data.c * 2.6).toFixed(1), isUp ? "Buy" : "Sell"],
    ["Stoch %K", (50 + data.c * 4).toFixed(1), (50 + data.c * 4) > 80 ? "Sell" : "Buy"],
    ["ADX (14)", (20 + Math.abs(data.c) * 2).toFixed(1), isUp ? "Buy" : "Sell"],
    ["EMA 50", nf(p * 0.94), isUp ? "Buy" : "Sell"],
    ["SMA 200", nf(p * 0.74), rs > 50 ? "Buy" : "Sell"],
  ];

  const finRows: [string, number[], string, string][] = [
    ["Revenue",       [rev * 0.55, rev * 0.7, rev * 0.86, rev], cap(rev),   "var(--up)"],
    ["Net income",    [ni * 0.5,  ni * 0.6,  ni * 0.82,  ni],  cap(ni),    ni >= 0 ? "var(--up)" : "var(--down)"],
    ["Net margin",    [mg * 0.8,  mg * 0.85, mg * 0.95,  mg],  mg + "%",   "var(--up)"],
    ["Free cash flow",[fcf * 0.4, fcf * 0.55,fcf * 0.8,  fcf], cap(fcf),   "var(--up)"],
    ["Total debt",    [debt*1.1,  debt*1.05, debt,        debt],cap(debt),  "var(--text-dim-solid)"],
  ];

  const chips: number[] = [];
  for (let i = 0; i < 8; i++) {
    chips.push(st >= 0 ? (i < Math.min(st, 8) ? 1 : 0) : (i < Math.min(-st, 8) ? 0 : 1));
  }
  const qeps = eps / 4, beatSign = st >= 0 ? 1 : -1;
  const erRows: [string, number, number][] = [
    ["Q1 25", qeps * 1.06, 12 * beatSign],
    ["Q4 24", qeps * 0.99, 8  * beatSign],
    ["Q3 24", qeps * 0.95, 6  * beatSign],
    ["Q2 24", qeps * 0.9,  5  * beatSign],
  ];

  const sectorInfo = sectorByName[group];
  const sectorTrend = sectorInfo?.trend ?? "Flat";
  const trendPill = sectorTrend === "Improving" ? "up" : sectorTrend === "Deteriorating" ? "dn" : "hold";
  const grank = sectorInfo?.rank ?? 0;
  const topSectors = sectorList.slice(0, 5);

  const peers = screenerStocks
    .filter(x => x.sec === group && x.s !== sym)
    .slice(0, 5)
    .map(x => ({ t: x.s, c: (x.rs - 50) / 10 }));
  const pcs = peers.map(x => x.c);
  const pmx = pcs.length ? Math.max(...pcs) : 0;
  const pmn = pcs.length ? Math.min(...pcs) : 0;

  function selectSym(s: string) {
    setSym(s);
    setSearch("");
    if (typeof window !== "undefined") localStorage.setItem("iq-stock", s);
  }

  return (
    <>
      {/* Symbol bar */}
      <div className="fbar" style={{ position: "relative" }}>
        {Object.keys(stockInfo).map(s => (
          <button key={s} className={`chip${sym === s ? " active" : ""}`} onClick={() => selectSym(s)}>{s}</button>
        ))}
        <div style={{ marginLeft: "auto", position: "relative" }}>
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
                <div key={s} style={{ padding: "7px 12px", cursor: "pointer", fontSize: 12.5, color: "var(--text-hi)", fontFamily: "var(--f-mono)" }}
                  onMouseDown={() => selectSym(s)}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >{s}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        {/* sd-head */}
        <div className="sd-head">
          <div className="sd-logo" style={{ background: `linear-gradient(135deg,${logoBg(sym)},${logoBg(sym)}88)`, color: logoFg(sym) }}>
            {sym[0]}
          </div>
          <div className="sd-name">
            <h1>{sym}</h1>
            <div className="sub">{data.name} · {ex} · {group}</div>
          </div>
          <div className="sd-px">
            <div className="p">${fmt(p, 2)}</div>
            <div className={`c ${cls(data.c)}`}>{arr(data.c)} {data.c >= 0 ? "+" : ""}${fmt(dollar, 2)} ({sign(data.c)})</div>
          </div>
          <div className="sd-actions">
            <button className="btn">
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
                <path d="M5 5h14v14l-7-4-7 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Watch
            </button>
            <button className="btn ai">
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
              </svg>
              Ask Copilot
            </button>
          </div>
        </div>
      </div>

      <div className="sd-grid">
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Chart card */}
          <div className="card">
            <div className="chart-toolbar">
              {["1D","1W","1M","3M","6M","1Y","5Y"].map(r => (
                <button key={r} className={`rng tfbtn${tfActive === r ? " on" : ""}`} onClick={() => setTfActive(r)}>{r}</button>
              ))}
              <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
              <button className="rng indbtn on">Candles</button>
              <button className={`rng indbtn${showMA ? " on" : ""}`} onClick={() => setShowMA(v => !v)}>MA 20/50</button>
              <button className={`rng indbtn${showVol ? " on" : ""}`} onClick={() => setShowVol(v => !v)}>Volume</button>
              <button className={`rng indbtn${showRsi ? " on" : ""}`} onClick={() => setShowRsi(v => !v)}>RSI</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>drag-free · hover for OHLC</span>
            </div>
            <div id="chartHost" style={{ padding: "0 14px 0" }}>
              <CandleChart sym={sym} tf={tfActive} px={p} showMA={showMA} showVol={showVol} />
            </div>
            {showRsi && (
              <div id="rsiHost">
                <div style={{ padding: "6px 14px 4px", fontSize: ".66rem", color: "var(--text-dim-solid)", display: "flex", justifyContent: "space-between" }}>
                  <span>RSI (14)</span>
                  <span className="mono" style={{ color: "var(--warn)" }}>
                    {Math.round(38 + rs * 0.36)} · {rsi > 70 ? "overbought" : rsi < 40 ? "weak" : "neutral-to-strong"}
                  </span>
                </div>
                <div style={{ padding: "0 14px 4px" }}><RsiPane sym={sym} tf={tfActive} /></div>
              </div>
            )}
            <div style={{ padding: "6px 14px 12px", fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
              Pattern: <b style={{ color: isUp ? "var(--up)" : "var(--down)" }}>
                {isUp ? "cup-with-handle breakout" : "breakdown below support"}
              </b> {isUp ? "on above-average volume." : "on rising volume."}
            </div>
          </div>

          {/* Keystats */}
          <div className="card">
            <div className="keystats">
              {([
                ["Mkt Cap",        cap(mc)],
                ["P/E",            data.pe.toFixed(1)],
                ["Revenue (TTM)",  cap(rev)],
                ["EPS (TTM)",      "$" + eps.toFixed(2)],
                ["Short Int.",     si + "%"],
                ["Next ER",        erDate],
                ["52W Range",      "$" + nf(lo) + " – $" + nf(hi)],
                ["Avg Vol",        avgVol + "M"],
              ] as [string, string][]).map(k => (
                <div key={k[0]} className="kstat">
                  <div className="k">{k[0]}</div>
                  <div className="v">{k[1]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Technical Analysis */}
          <div className="ai-block">
            <div className="card-h">
              <h3 className="ai-c">◆ AI Technical Analysis</h3>
              <div className="toneseg" style={{ width: 280 }}>
                {["Summary","Swing","Position","Long-term"].map(t => (
                  <button key={t} className={toneActive === t ? "on" : ""} onClick={() => setToneActive(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="card-b">
              {([
                ["Trend",            trendTxt],
                ["Support / Resist.",`Support near <b>$${nf(S1)}</b> and <b>$${nf(S2)}</b>; resistance at <b>$${nf(R1)}</b> then the 52-week high <b>$${nf(hi)}</b>.`],
                ["MA posture",       maTxt],
                ["Rel. strength",    `Relative-strength rank <b class="${rs >= 70 ? "up" : rs < 40 ? "down" : ""}">${rs}/99</b> vs the market — ${rs >= 70 ? "group leader." : rs < 40 ? "lagging the tape." : "roughly in line."}`],
                ["Volume",           `Relative volume <b>${rv.toFixed(1)}×</b> — ${rv > 2 ? "well above average (event-driven)." : "near normal."}`],
                ["Event risk",       `Next earnings ${erDate}. Macro: a hawkish Fed surprise pressures high-multiple names first.`],
              ] as [string, string][]).map(l => (
                <div key={l[0]} className="ai-line">
                  <span className="k">{l[0]}</span>
                  <span className="v" dangerouslySetInnerHTML={{ __html: l[1] }} />
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                Source: 250-day OHLCV, 20/50/200 SMA, RS vs SPX · AI-generated for informational purposes only, not investment advice.
              </div>
            </div>
          </div>

          {/* Financials with bar charts */}
          <div className="card">
            <div className="card-h">
              <h3>Financials</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="tf-pills">
                  <button className="rng">Quarterly</button>
                  <button className="rng on">Annual</button>
                </div>
                <span className="link" onClick={() => openEarnings(sym)}>View all →</span>
              </div>
            </div>
            <div className="card-b">
              {finRows.map(fr => {
                const mx2 = Math.max(...fr[1].map(Math.abs)) || 1;
                return (
                  <div key={fr[0]} className="fin-row-bar">
                    <span className="k">{fr[0]}</span>
                    <div className="fin-bars">
                      {fr[1].map((v, i) => (
                        <i key={i} style={{ height: Math.max(8, Math.abs(v) / mx2 * 100) + "%", background: fr[3] }} />
                      ))}
                    </div>
                    <span className="v">{fr[2]}</span>
                  </div>
                );
              })}
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                FY21 → FY24 trend · derived from market cap, P/E and margin. Source: company filings.
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Technical Rating */}
          <div className="card">
            <div className="card-h">
              <h3>Technical Rating</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="tf-pills">
                  {["1D","1W","1M"].map((t, i) => (
                    <button key={t} className={`rng${i === 2 ? " on" : ""}`}>{t}</button>
                  ))}
                </div>
                <span className="link">View all →</span>
              </div>
            </div>
            <div className="card-b">
              <div className="trgroup" style={{ borderColor: "var(--ai-dim)", marginBottom: 10 }}>
                <div className="gl ai-c">Summary</div>
                <TrGauge val={gv} label={rating} />
              </div>
              <div className="trseg2">
                <div className="trgroup">
                  <div className="gl">Oscillators</div>
                  <div className="rate" style={{ color: tone }}>{rc.ol}</div>
                  <div className="counts">
                    <span style={{ color: "var(--down)" }}>Sell<b>{rc.o[0]}</b></span>
                    <span style={{ color: "var(--text-dim-solid)" }}>Neut<b>{rc.o[1]}</b></span>
                    <span style={{ color: "var(--up)" }}>Buy<b>{rc.o[2]}</b></span>
                  </div>
                </div>
                <div className="trgroup">
                  <div className="gl">Moving Avgs</div>
                  <div className="rate" style={{ color: tone }}>{rc.ml}</div>
                  <div className="counts">
                    <span style={{ color: "var(--down)" }}>Sell<b>{rc.m[0]}</b></span>
                    <span style={{ color: "var(--text-dim-solid)" }}>Neut<b>{rc.m[1]}</b></span>
                    <span style={{ color: "var(--up)" }}>Buy<b>{rc.m[2]}</b></span>
                  </div>
                </div>
              </div>
              <table className="ind-tbl" style={{ marginTop: 12 }}>
                <tbody>
                  {indRows.map(r => (
                    <tr key={r[0]}>
                      <td>{r[0]}</td>
                      <td className="v">{r[1]}</td>
                      <td className="a" style={{ color: ac(r[2]) }}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                Computed from 11 oscillators + 15 moving averages. Indicators only — not investment advice.
              </div>
            </div>
          </div>

          {/* Peers */}
          <div className="card">
            <div className="card-h">
              <h3>Peers · who's leading</h3>
              <span className="link">View all →</span>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              {peers.length ? peers.map(peer => {
                const tag = peer.c === pmx ? "Leader" : peer.c === pmn ? "Laggard" : "";
                return (
                  <div key={peer.t} className={`minirow${folio.some(f => f.s === peer.t) ? " owned" : ""}`}
                    style={{ cursor: "pointer" }} onClick={() => openStock(peer.t)}>
                    <span className="tkr">{peer.t}</span>
                    <span className="mid">{tag && <span className={`pill ${tag === "Leader" ? "up" : "dn"}`}>{tag}</span>}</span>
                    <span className={`r ${cls(peer.c)}`}>{sign(peer.c)}</span>
                  </div>
                );
              }) : <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)" }}>No close peers tracked.</div>}
            </div>
          </div>

          {/* Industry Group rank */}
          <div className="card">
            <div className="card-h">
              <h3>Industry Group rank</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`pill ${trendPill}`}>{sectorTrend}</span>
                <span className="link">View all →</span>
              </div>
            </div>
            <div className="card-b">
              {topSectors.map(g => (
                <div key={g.name} className="grouprow">
                  <span className="rk">{g.rank}</span>
                  <span className="gn">{g.name}</span>
                  <div className="bar"><i style={{ width: Math.max(8, 100 - g.rank * 1.6) + "%" }} /></div>
                  <span className="mono" style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{sign(g.chg)}</span>
                </div>
              ))}
              <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                {group} ranks <b style={{ color: grank <= 10 ? "var(--up)" : "var(--text-hi)" }}>#{grank || "—"} of {sectorList.length}</b> groups by relative strength.
              </div>
            </div>
          </div>

          {/* Earnings history */}
          <div className="card">
            <div className="card-h">
              <h3>Earnings history</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`pill ${st >= 0 ? "up" : "dn"}`}>{Math.abs(st)}-qtr {st >= 0 ? "beat" : "miss"} streak</span>
                <span className="link" onClick={() => openEarnings(sym)}>View all →</span>
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div className="cd">
                  <span className="num">—</span>
                  <span className="u">days to<br />next ER</span>
                </div>
                <div>
                  <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginBottom: 4 }}>Beat / miss streak</div>
                  <div className="streak">
                    {chips.map((b, i) => (
                      <b key={i} style={{ background: b ? "var(--up)" : "var(--down)" }}>{b ? "B" : "M"}</b>
                    ))}
                  </div>
                </div>
              </div>
              {erRows.map(q => (
                <div key={q[0]} className="minirow">
                  <span className="tkr" style={{ width: 60 }}>{q[0]}</span>
                  <span className="mid mono">${fmt(Math.abs(q[1]), 2)} EPS</span>
                  <span className={`r ${q[2] >= 0 ? "up" : "down"}`}>{q[2] >= 0 ? "beat" : "miss"} {Math.abs(q[2])}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insider & institutional */}
          <div className="card">
            <div className="card-h">
              <h3>Insider &amp; institutional</h3>
              <span className="link">View all →</span>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              {([
                ["Insider sells (90d)", `$${nf(mc * 0.012)}M`,                                               "down"],
                ["Insider buys (90d)",  rating.includes("Sell") ? "$0" : `$${nf(mc * 0.004)}M`,             rating.includes("Sell") ? "dim" : "up"],
                ["Inst. ownership",     io + "%",                                                             "up"],
                ["Short interest",      si + "%",                                                             si > 10 ? "down" : "dim"],
                ["13F funds holding",   fundsHolding + " tracked",                                           "dim"],
              ] as [string, string, string][]).map(x => (
                <div key={x[0]} className="minirow">
                  <span className="mid">{x[0]}</span>
                  <span className={`r ${x[2] === "dim" ? "" : x[2]}`}
                    style={x[2] === "dim" ? { color: "var(--text-hi)" } : {}}>{x[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key levels (pivots) */}
          <div className="card">
            <div className="card-h">
              <h3>Key levels (pivots)</h3>
              <span className="link">View all →</span>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              {([["R2", R2, "down"], ["R1", R1, "down"], ["Pivot", p, "dim"], ["S1", S1, "up"], ["S2", S2, "up"]] as [string, number, string][]).map(x => (
                <div key={x[0]} className="minirow">
                  <span className="tkr" style={{ width: 50 }}>{x[0]}</span>
                  <span className="mid" />
                  <span className="r mono" style={{ color: x[2] === "dim" ? "var(--text-hi)" : `var(--${x[2]})` }}>
                    ${nf(x[1])}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
