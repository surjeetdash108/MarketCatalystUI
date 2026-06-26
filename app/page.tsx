"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signInWithPopup, signInWithRedirect } from "firebase/auth";
import { firebaseAuth, googleAuthProvider } from "./firebase";
import { completeGoogleLogin, getAuthErrorMessage } from "./auth/auth-utils";
import { LoginForm } from "./auth/login/login-form";
import { pulse, wmn, movers, earnings, analyst, folio, sectorList, recap } from "./iq/data";
import { fmt, sign, cls, heatCol, StockLogo } from "./iq/utils";

// ---- Workspace thumbnail components ----
// Content is authored at 1200px virtual width then CSS-scaled to fill whatever container it lives in
// (carousel card ~340px, glance modal ~572px, mobile stacked ~320px, etc.)

function ScaledScreen({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2834); // initial guess for 340px card

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setScale(e.contentRect.width / 1200);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--surface-0)" }}>
      <div style={{ width: 1200, minHeight: 1567, transformOrigin: "top left", transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function DashThumb() {
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Dashboard</div>
        <h1 className="page-title">Good morning</h1>
        <p className="page-sub">Tuesday &middot; May 21 &middot; 09:34 ET &mdash; Markets open</p>
      </div>
      <div className="dash" style={{ padding: "0 32px 20px" }}>
        <div className="col-12">
          <div style={{ display: "flex", gap: 6, paddingBottom: 16 }}>
            {pulse.slice(0, 8).map(p => (
              <div key={p.l} className="p" style={{ flex: 1 }}>
                <div className="lbl">{p.l}</div>
                <div className="val">{p.v >= 1000 ? fmt(p.v, 0) : fmt(p.v, 2)}</div>
                <div className={`chg ${cls(p.c)}`}>{sign(p.c)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-12" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-h">What Matters Now</div>
            <div className="card-b">
              {wmn.slice(0, 4).map((b, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 15, color: "var(--text-hi)", marginBottom: 3 }}>{b.h}</div>
                  <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: b.t }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="card-h">Top Movers</div>
            <div className="card-b">
              {movers.slice(0, 5).map(m => (
                <div key={m.s} className="minirow">
                  <StockLogo sym={m.s} size={26} />
                  <span className="tkr">{m.s}</span>
                  <span className="mid">{m.n}</span>
                  <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                </div>
              ))}
              <div className="more">View all movers</div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="card-h">Earnings Today</div>
            <div className="card-b">
              {earnings.slice(0, 5).map(e => (
                <div key={e.s} className="minirow">
                  <StockLogo sym={e.s} size={26} />
                  <span className="tkr">{e.s}</span>
                  <span className="mid">{e.epsA !== null ? `EPS $${e.epsA}` : `Est $${e.epsE}`}</span>
                  {e.epsA !== null && <span className={`pill ${e.tags.includes("Beat") ? "beat" : "miss"}`}>{e.tags.includes("Beat") ? "Beat" : "Miss"}</span>}
                </div>
              ))}
              <div className="more">Full calendar</div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="card-h">Analyst Actions</div>
            <div className="card-b">
              {analyst.slice(0, 5).map((a, i) => (
                <div key={i} className="minirow">
                  <StockLogo sym={a.s} size={26} />
                  <span className="tkr">{a.s}</span>
                  <span className="mid">{a.firm}</span>
                  <span className={`r ${a.dir === "down" ? "down" : "up"}`}>{a.to}</span>
                </div>
              ))}
              <div className="more">All actions</div>
            </div>
          </div>
        </div>
      </div>
    </ScaledScreen>
  );
}

function MoversThumb() {
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Market Movers</div>
        <h1 className="page-title">Top winners &amp; losers</h1>
        <p className="page-sub">Ranked by move &mdash; with the catalyst behind each one</p>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="tabs" style={{ marginBottom: 12 }}>
          {["Top Gainers","Top Losers","Volume","Weekly"].map((t, i) => (
            <button key={t} className={`tab${i === 0 ? " active" : ""}`}>{t}</button>
          ))}
        </div>
        <div className="fbar" style={{ marginBottom: 14 }}>
          {["All","Large Cap","Mid Cap","Small Cap"].map((c, i) => (
            <span key={c} className={`chip${i === 0 ? " on" : ""}`}>{c}</span>
          ))}
          <span style={{ flex: 1 }} />
          {["Tech","Finance","Health"].map(s => (
            <span key={s} className="chip">{s}</span>
          ))}
        </div>
        <div className="card">
          <div className="tbl">
            <div style={{ padding: "8px 16px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.6fr", gap: 8, fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-dim-solid)", borderBottom: "1px solid var(--border)" }}>
              <span>Company</span><span>Price</span><span>Change</span><span>RVOL</span><span>Cap</span><span>Catalyst</span>
            </div>
            {movers.map((m, i) => (
              <div key={m.s} style={{ padding: "11px 16px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.6fr", gap: 8, alignItems: "center", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StockLogo sym={m.s} size={28} />
                  <div>
                    <div className="co s" style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 14, color: "var(--text-hi)" }}>{m.s}</div>
                    <div className="co n" style={{ fontSize: 12, color: "var(--text-dim-solid)" }}>{m.n}</div>
                  </div>
                </div>
                <span className="num">{fmt(m.p, 2)}</span>
                <span className={`num ${cls(m.c)}`}>{sign(m.c)}</span>
                <span className="num">{m.rvol}x</span>
                <span style={{ fontSize: 12, color: "var(--text-dim-solid)" }}>{m.cap}</span>
                <span style={{ fontSize: 12, color: "var(--text)", background: "var(--surface-2)", borderRadius: 6, padding: "3px 9px", display: "inline-block" }}>{m.cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScaledScreen>
  );
}

function StockThumb() {
  const pts = [38,42,40,45,43,49,47,52,50,55,52,58,55,60,58,63,61,65,63,67,65,70];
  const SH = 240, SW = 740, vmin = 38, vmax = 70;
  const path = pts.map((v, i) =>
    `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * SW},${SH - ((v - vmin) / (vmax - vmin)) * SH}`
  ).join(" ");
  return (
    <ScaledScreen>
      <div style={{ padding: "20px 28px 0" }}>
        <div className="sd-head">
          <div className="sd-logo" style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg,#1f6b4d,#0e3a2a)", color: "#5ff0b3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 18 }}>N</div>
          <div className="sd-name">
            <h1 style={{ fontFamily: "var(--f-mono)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-hi)", letterSpacing: "-.01em", margin: 0 }}>NVDA</h1>
            <div className="sub" style={{ fontSize: ".8rem", color: "var(--text-dim-solid)" }}>NVIDIA Corporation &middot; NASDAQ &middot; Semiconductors</div>
          </div>
          <div className="sd-px" style={{ marginLeft: 8 }}>
            <div className="p" style={{ fontFamily: "var(--f-mono)", fontSize: "1.7rem", fontWeight: 700, color: "var(--text-hi)" }}>$1,025.60</div>
            <div className="c up" style={{ fontFamily: "var(--f-mono)", fontSize: ".86rem", fontWeight: 600 }}>&#9650; +$78.04 (+8.23%)</div>
          </div>
          <div className="sd-actions">
            <button className="btn">Watch</button>
            <button className="btn ai">Ask Copilot</button>
          </div>
        </div>
        <div className="sd-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="chart-toolbar">
                {["1D","1W","1M","3M","6M","1Y","5Y"].map((t, i) => (
                  <button key={t} className={`rng${i === 0 ? " on" : ""}`}>{t}</button>
                ))}
                <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
                {["Candles","Line","Area"].map((t, i) => (
                  <button key={t} className={`rng${i === 0 ? " on" : ""}`}>{t}</button>
                ))}
                <button className="rng">MA</button>
                <button className="rng">Volume</button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>hover for OHLC</span>
              </div>
              <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" height={SH} preserveAspectRatio="none" style={{ display: "block" }}>
                <defs>
                  <linearGradient id="sdg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity=".28" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${path} L${SW},${SH} L0,${SH} Z`} fill="url(#sdg2)" />
                <path d={path} fill="none" stroke="#22c55e" strokeWidth="2.2" />
              </svg>
              <div style={{ padding: "6px 14px 12px", fontSize: ".7rem", color: "var(--text-dim-solid)" }}>Pattern: <b style={{ color: "var(--up)" }}>cup-with-handle breakout</b> on above-average volume.</div>
            </div>
            <div className="card">
              <div className="keystats">
                {[["Mkt Cap","$2.91T"],["P/E","78.0"],["Revenue (TTM)","$60.9B"],["EPS (TTM)","$13.14"],["Short Int.","0.8%"],["Next ER","Aug 28"],["52W Range","$350 – $1,255"],["Avg Vol","42.8M"]].map(([k, v]) => (
                  <div key={k} className="kstat">
                    <div className="k">{k}</div>
                    <div className="v">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ai-block">
              <div className="card-h"><h3 className="ai-c">&#9670; AI Technical Analysis</h3></div>
              <div className="card-b">
                {[
                  ["Trend","Bull trend intact — price above all major SMAs with higher highs and higher lows since Q4."],
                  ["Support / Resist.","Support near $920 and $820; resistance at $1,100 then the 52-week high $1,255."],
                  ["MA posture","Price above 50 and 200 SMA. Both moving averages rising — textbook momentum posture."],
                  ["Rel. strength","Relative-strength rank 96/99 vs the market — group leader."],
                  ["Volume","Relative volume 5.8× — well above average (event-driven)."],
                  ["Event risk","Next earnings Aug 28 (~65 days). Hawkish Fed surprise pressures high-multiple names first."],
                ].map(([k, v]) => (
                  <div key={k} className="ai-line">
                    <span className="k">{k}</span>
                    <span className="v">{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: ".7rem", color: "var(--text-dim-solid)" }}>Source: 250-day OHLCV · AI-generated for informational purposes, not investment advice.</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="card-h">
                <h3>Technical Rating</h3>
                <div className="tf-pills">
                  {["1D","1W","1M"].map((t, i) => <button key={t} className={`rng${i === 2 ? " on" : ""}`}>{t}</button>)}
                </div>
              </div>
              <div className="card-b">
                <div className="trgroup" style={{ borderColor: "var(--ai-dim,rgba(52,226,240,.2))", marginBottom: 10 }}>
                  <div className="gl">Summary</div>
                  <div className="rate" style={{ color: "#22c55e" }}>Strong Buy</div>
                  <div className="counts">
                    <span style={{ color: "var(--down)" }}>Sell<b>2</b></span>
                    <span style={{ color: "var(--text-dim-solid)" }}>Neut<b>3</b></span>
                    <span style={{ color: "var(--up)" }}>Buy<b>12</b></span>
                  </div>
                </div>
                <div className="trseg2">
                  <div className="trgroup">
                    <div className="gl">Oscillators</div>
                    <div className="rate" style={{ color: "#22c55e" }}>Buy</div>
                    <div className="counts">
                      <span style={{ color: "var(--down)" }}>Sell<b>1</b></span>
                      <span style={{ color: "var(--text-dim-solid)" }}>Neut<b>2</b></span>
                      <span style={{ color: "var(--up)" }}>Buy<b>6</b></span>
                    </div>
                  </div>
                  <div className="trgroup">
                    <div className="gl">Moving Avgs</div>
                    <div className="rate" style={{ color: "#22c55e" }}>Strong Buy</div>
                    <div className="counts">
                      <span style={{ color: "var(--down)" }}>Sell<b>1</b></span>
                      <span style={{ color: "var(--text-dim-solid)" }}>Neut<b>1</b></span>
                      <span style={{ color: "var(--up)" }}>Buy<b>7</b></span>
                    </div>
                  </div>
                </div>
                <table className="ind-tbl" style={{ marginTop: 12 }}><tbody>
                  {[["RSI (14)","72.4","Buy"],["MACD","Bullish cross","Buy"],["Stoch %K","88.1","Buy"],["CCI (20)","164","Buy"],["ADX","34.2","Buy"],["50 SMA","$912","Buy"],["200 SMA","$748","Buy"]].map(([ind, val, act]) => (
                    <tr key={String(ind)}>
                      <td>{ind}</td>
                      <td className="v">{val}</td>
                      <td className="a" style={{ color: act === "Buy" ? "var(--up)" : act === "Sell" ? "var(--down)" : "var(--text-dim-solid)" }}>{act}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Peers &middot; who&apos;s leading</h3></div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {([["NVDA",8.23,"Leader"],["AMD",2.10,""],["AVGO",2.97,""],["INTC",-1.80,"Laggard"],["QCOM",1.30,""]] as [string,number,string][]).map(([t, c, tag]) => (
                  <div key={t} className={`minirow${t === "NVDA" ? " owned" : ""}`}>
                    <span className="tkr">{t}</span>
                    <span className="mid">{tag ? <span className={`pill ${tag === "Leader" ? "up" : "dn"}`}>{tag}</span> : ""}</span>
                    <span className={`r ${c >= 0 ? "up" : "down"}`}>{c >= 0 ? "+" : ""}{c.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Industry Group rank</h3><span className="pill up">Improving</span></div>
              <div className="card-b">
                {sectorList.slice(0, 5).map(g => (
                  <div key={g.name} className="grouprow">
                    <span className="rk">{g.rank}</span>
                    <span className="gn">{g.name}</span>
                    <span className="bar"><i style={{ width: `${Math.max(8, 100 - g.rank * 1.6)}%` }} /></span>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{sign(g.chg)}</span>
                  </div>
                ))}
                <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 8 }}>Semiconductors ranks <b style={{ color: "var(--up)" }}>#1 of 21</b> groups by relative strength.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScaledScreen>
  );
}

function HeatmapThumb() {
  const k = 2.0;
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Market Heatmap</div>
        <h1 className="page-title">Where the day is leaning</h1>
        <p className="page-sub">Market cap weighted by sector &mdash; colored by performance</p>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-dim-solid)" }}>
          <span>-3%</span>
          {([-3,-1.5,-0.5,0,0.5,1.5,3] as number[]).map(v => {
            const { bg } = heatCol(v);
            return <i key={v} style={{ display: "inline-block", width: 32, height: 14, background: bg, borderRadius: 3 }} />;
          })}
          <span>+3%</span>
          <span style={{ flex: 1 }} />
          {["All","S&P 500","NDX","Russell"].map((f, i) => (
            <span key={f} className={`chip${i === 0 ? " on" : ""}`}>{f}</span>
          ))}
        </div>
        <div className="treemap">
          {sectorList.slice(0, 9).map(g => {
            const tot = g.items.reduce((s, it) => s + it[1], 0);
            const flex = Math.min(5, Math.max(1.2, tot / 2500));
            return (
              <div key={g.name} className="tm-sector" style={{ flex: `${flex} 1 110px` }}>
                <div className="sl">
                  <span>
                    {g.name.replace("Mega-Cap ", "").replace("Cloud ", "")}{" "}
                    <span className={cls(g.chg)} style={{ fontFamily: "var(--f-mono)", fontWeight: 600 }}>{sign(g.chg)}</span>
                  </span>
                </div>
                <div className="tm-cells">
                  {g.items.map(it => {
                    const w = Math.max(56, Math.sqrt(it[1]) * k);
                    const h = Math.max(42, w * 0.62);
                    const fs = Math.max(.62, Math.min(1, Math.sqrt(it[1]) / 40));
                    const { bg, fg } = heatCol(it[2]);
                    return (
                      <div key={it[0]} className="tm-cell" style={{ width: w, height: h, background: bg }}>
                        <span className="tt" style={{ fontSize: `${fs}rem`, color: fg }}>{it[0]}</span>
                        <span className="tc" style={{ fontSize: `${fs * 0.82}rem`, color: fg }}>{sign(it[2])}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScaledScreen>
  );
}

function EarningsThumb() {
  const days = ["Mon","Tue","Wed","Thu","Fri"];
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Earnings</div>
        <h1 className="page-title">Who reports &mdash; and how</h1>
        <p className="page-sub">Calendar &middot; beat/miss history &middot; income statements</p>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="tabs" style={{ marginBottom: 14 }}>
          {["Yesterday","Today","Tomorrow","This Week","Next Week","Last Week","Month"].map((t, i) => (
            <button key={t} className={`tab${i === 1 ? " active" : ""}`}>{t}</button>
          ))}
        </div>
        <div className="ec-grid">
          {days.map((day, di) => (
            <div key={day} className={`ec-day${di === 1 ? " is-today" : ""}`}>
              <div className="ec-dh">{day}</div>
              <div className="ec-sess">
                <span className="ec-chip" style={{ background: "rgba(251,191,36,.14)", color: "#f59e0b", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, marginBottom: 8, display: "inline-block" }}>BMO</span>
                {earnings.slice(di, di + 1).map(e => (
                  <div key={e.s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 5, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <StockLogo sym={e.s} size={22} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 13, color: "var(--text-hi)" }}>{e.s}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim-solid)" }}>{e.n}</div>
                    </div>
                    {e.epsA !== null && <span className={`pill ${e.tags.includes("Beat") ? "beat" : "miss"}`} style={{ fontSize: 11 }}>{e.tags.includes("Beat") ? "Beat" : "Miss"}</span>}
                  </div>
                ))}
              </div>
              <div className="ec-sess" style={{ marginTop: 10 }}>
                <span className="ec-chip" style={{ background: "rgba(124,108,245,.14)", color: "var(--brand)", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, marginBottom: 8, display: "inline-block" }}>AMC</span>
                {earnings.slice(di + 3, di + 5).map(e => (
                  <div key={e.s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 5, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <StockLogo sym={e.s} size={22} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 13, color: "var(--text-hi)" }}>{e.s}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim-solid)" }}>{e.n}</div>
                    </div>
                    {e.epsA !== null && <span className={`pill ${e.tags.includes("Beat") ? "beat" : "miss"}`} style={{ fontSize: 11 }}>{e.tags.includes("Beat") ? "Beat" : "Miss"}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScaledScreen>
  );
}

function AnalystThumb() {
  const upCount = analyst.filter(a => a.dir === "up" || a.dir === "init").length;
  const dnCount = analyst.filter(a => a.dir === "down").length;
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Analyst Actions</div>
        <h1 className="page-title">Upgrades, downgrades, targets</h1>
        <p className="page-sub">Rating changes &middot; price target moves &middot; cluster detection</p>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="tabs" style={{ marginBottom: 14 }}>
          {["All Actions","Upgrades","Downgrades","Initiations","Clusters"].map((t, i) => (
            <button key={t} className={`tab${i === 0 ? " active" : ""}`}>{t}</button>
          ))}
        </div>
        <div className="dash" style={{ marginBottom: 16 }}>
          <div className="col-3">
            <div className="card">
              <div className="card-h">Today</div>
              <div className="card-b" style={{ padding: "14px 16px" }}>
                <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 34, color: "var(--text-hi)", marginBottom: 4 }}>{analyst.length}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
                  <span className="up">{upCount} upgrades</span>
                  <span className="down">{dnCount} downgrades</span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-3">
            <div className="card">
              <div className="card-h">Cluster Alert</div>
              <div className="card-b" style={{ padding: "14px 16px" }}>
                <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 22, color: "var(--ai)", marginBottom: 6 }}>NVDA</div>
                <div style={{ fontSize: 13, color: "var(--text-dim-solid)" }}>6 firms upgraded in 48h</div>
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="card ai-block" style={{ background: "rgba(52,226,240,.05)", borderColor: "rgba(52,226,240,.18)" }}>
              <div className="card-h" style={{ color: "var(--ai)" }}>AI Take &middot; NVDA Cluster</div>
              <div className="card-b" style={{ padding: "12px 16px", fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
                6 Wall Street firms upgraded NVDA in under 48 hours after the data-center beat. Target consensus moved from $850 to $1,150. Clusters of this size historically precede 30-day outperformance.
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="tbl">
            <div style={{ padding: "8px 16px", display: "grid", gridTemplateColumns: "2fr 1.6fr 1fr 1fr 1fr 1fr", gap: 8, fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-dim-solid)", borderBottom: "1px solid var(--border)" }}>
              <span>Stock</span><span>Firm</span><span>Action</span><span>From</span><span>To</span><span>PT</span>
            </div>
            {analyst.slice(0, 10).map((a, i) => (
              <div key={i} style={{ padding: "11px 16px", display: "grid", gridTemplateColumns: "2fr 1.6fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StockLogo sym={a.s} size={26} />
                  <div>
                    <div style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 14, color: "var(--text-hi)" }}>{a.s}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim-solid)" }}>{a.n}</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: "var(--text-dim-solid)" }}>{a.firm}</span>
                <span className={a.dir === "down" ? "down" : "up"} style={{ fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{a.dir}</span>
                <span style={{ fontSize: 13, color: "var(--text-dim-solid)" }}>{a.from}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-hi)" }}>{a.to}</span>
                <span className={a.ptT > a.ptF ? "up" : "down"} style={{ fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 600 }}>${a.ptT}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScaledScreen>
  );
}

function PortfolioThumb() {
  const totalPct = folio.reduce((s, f) => s + f.c, 0) / folio.length;
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Portfolio Pulse</div>
        <h1 className="page-title">Your book, explained</h1>
        <p className="page-sub">AI-narrated day P&amp;L &mdash; what moved, why, and what to watch</p>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="ai-block" style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--ai)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>AI Portfolio Summary</div>
          <div className="ai-line" style={{ marginBottom: 12 }}>
            <div className="k">Today</div>
            <div className="v">NVDA led gains (+8.2%) after the data-center beat. META added 2.3% on ad-revenue upgrades. HD dragged the book -1.1% on lowered guidance.</div>
          </div>
          <div className="ai-line">
            <div className="k">Watch</div>
            <div className="v">AAPL reports after close today &mdash; largest holding by weight. NVDA approaching 52-week high; consider trimming at $1,100.</div>
          </div>
        </div>
        <div className="pf-master" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 0, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="pf-side" style={{ borderRight: "1px solid var(--border)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 22, color: "var(--text-hi)" }}>$142,843</span>
              <span className={cls(totalPct)} style={{ fontFamily: "var(--f-mono)", fontSize: 14, fontWeight: 700 }}>{sign(totalPct)}</span>
            </div>
            <div className="pf-list">
              {folio.map(f => (
                <div key={f.s} className="pf-li" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border-soft,#1a2535)" }}>
                  <StockLogo sym={f.s} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 14, color: "var(--text-hi)" }}>{f.s}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim-solid)" }}>{f.n}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className={cls(f.c)} style={{ fontFamily: "var(--f-mono)", fontSize: 14, fontWeight: 600 }}>{sign(f.c)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim-solid)" }}>{f.evt}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 16, color: "var(--text-hi)", marginBottom: 12 }}>NVDA Detail</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Shares","48"],["Avg Cost","$687.40"],["Day P/L","+$4,582"],["Total G/L","+$23,188"],["Weight","28.4%"],["Conv","High"]].map(([k, v]) => (
                <div key={k} className="kstat">
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScaledScreen>
  );
}

function RecapsThumb() {
  return (
    <ScaledScreen>
      <div className="page-head" style={{ padding: "28px 40px 20px" }}>
        <div className="eyebrow">Recaps</div>
        <h1 className="page-title">The day, in seven cards</h1>
        <p className="page-sub">Executive briefings &mdash; swipe through or schedule by email</p>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="rcp-idx" style={{ marginBottom: 16 }}>
          {recap.indices.map(idx => (
            <div key={idx.l} className="rcp-box">
              <div className="rcp-bl">{idx.l}</div>
              <div className={`rcp-bv ${cls(idx.v)}`}>{sign(idx.v)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-dim-solid)", marginBottom: 8 }}>Today &middot; End of Day Brief</div>
          <h2 className="recap-title" style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 26, color: "var(--text-hi)", margin: "0 0 12px", lineHeight: 1.2 }}>{recap.headline}</h2>
          <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.65, marginBottom: 16 }}>
            {recap.stories[0]} {recap.stories[1]}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["What Happened","Why It Moved","Technicals","Macro","AI Verdict"].map((s, i) => (
              <span key={s} style={{ padding: "4px 12px", borderRadius: 999, background: i === 0 ? "rgba(124,108,245,.2)" : "var(--surface-2)", border: `1px solid ${i === 0 ? "rgba(124,108,245,.38)" : "var(--border)"}`, fontSize: 12, color: i === 0 ? "var(--brand)" : "var(--text-dim-solid)", fontFamily: "var(--f-mono)", fontWeight: 600 }}>{s}</span>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-h">Market Internals</div>
          <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {recap.internals.map(r => (
              <div key={r.l}>
                <div style={{ fontSize: 12, color: "var(--text-dim-solid)", marginBottom: 4 }}>{r.l}</div>
                <div className={r.c > 0 ? "up" : "down"} style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 16 }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h">Sector Heat</div>
          <div style={{ padding: "6px 16px 10px" }}>
            {sectorList.slice(0, 10).map(g => (
              <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--border-soft,#1a2535)" }}>
                <div style={{ flex: 1, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                <div className={cls(g.chg)} style={{ fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 600, width: 55, textAlign: "right", flexShrink: 0 }}>{sign(g.chg)}</div>
                <div style={{ width: 80, height: 5, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.abs(g.chg) * 28)}%`, background: g.chg >= 0 ? "var(--up)" : "var(--down)", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScaledScreen>
  );
}

// ---- Workspace list ----
type WS = { n: string; d: string; long: string; chips: string[]; feats: string[]; Thumb: React.FC };

const WS_LIST: WS[] = [
  {
    n: "Dashboard", d: "Your morning brief at a glance.",
    long: "The first thing you see each morning: live indices, a What-Matters-Now AI brief, and a launchpad into every other workspace — the whole market in one screen.",
    chips: ["Indices", "What Matters Now", "AI brief"],
    feats: ["Live index pulse with count-up tickers and sparklines","An AI 'what matters now' brief parsed from the tape","Quick cards into movers, earnings and analyst flow","Animated, glanceable, refreshed through the day"],
    Thumb: DashThumb,
  },
  {
    n: "Market Movers", d: "Top winners & losers, with the why.",
    long: "The day's biggest movers ranked, each with the catalyst behind the move — filter by sector or market cap and hover any name to see why it is running.",
    chips: ["Gainers", "Losers", "Catalysts"],
    feats: ["Top 15 winners and losers, ranked by move","Plain-English catalyst on every row","Sector and market-cap filters","Hover a ticker for the reason in context"],
    Thumb: MoversThumb,
  },
  {
    n: "Stock Detail", d: "One page, the whole story.",
    long: "Everything on one name in a single view: an interactive chart with overlays, fundamentals, ratings, key levels and an AI read that explains what actually moved it.",
    chips: ["Charting", "Fundamentals", "AI read"],
    feats: ["Interactive chart — candles, MA/EMA, 5 chart types","Fundamentals, ratings and analyst targets","Key levels, peers and earnings-history trays","An AI read explaining the move in plain English"],
    Thumb: StockThumb,
  },
  {
    n: "Market Heatmap", d: "The whole market in one glance.",
    long: "A treemap of the entire market by sector and size, colored by performance — spot leadership, rotation and breadth in a single look.",
    chips: ["By sector", "By size", "Performance"],
    feats: ["Every sector sized by market cap","Colored by performance, green to red","Instantly see leadership and rotation","Tap a tile to drill into the name"],
    Thumb: HeatmapThumb,
  },
  {
    n: "Earnings", d: "Who reports, and how they have done.",
    long: "An earnings hub with a logo calendar, ten quarters of beat/miss history and graphical income statements — see the setup before the print.",
    chips: ["Calendar", "10-qtr history", "Income"],
    feats: ["Calendar of upcoming reports with logos","10-quarter EPS beat/miss history","Graphical income statements","Surprise and reaction at a glance"],
    Thumb: EarningsThumb,
  },
  {
    n: "Analyst Actions", d: "Upgrades, downgrades, targets.",
    long: "Every rating change and price-target move in one feed, with detection of clusters where five or more analysts move on the same name in a window.",
    chips: ["Ratings", "Price targets", "Clusters"],
    feats: ["Upgrades, downgrades and initiations","From/to ratings and price-target deltas","5+ action cluster detection","Implied upside vs the current price"],
    Thumb: AnalystThumb,
  },
  {
    n: "Portfolio Pulse", d: "Your book, explained.",
    long: "An AI read of your holdings — what drove the day, who led and lagged, and your P/L — with one click into the detail on any position.",
    chips: ["Drivers", "Day P/L", "AI summary"],
    feats: ["AI summary of what moved your book","Day P/L with leaders and laggards","Drill into any holding's full detail","Concentration and driver breakdown"],
    Thumb: PortfolioThumb,
  },
  {
    n: "Recaps", d: "The day, in seven cards.",
    long: "Executive end-of-day recaps you swipe through — what happened, why, technicals, fundamentals, macro and the AI verdict — read, download or schedule by email.",
    chips: ["Swipeable", "7 sections", "Schedulable"],
    feats: ["Seven-card swipeable briefing per name","What happened → why → technical → verdict","Download or schedule by email","Day and week modes"],
    Thumb: RecapsThumb,
  },
];

// ---- Logo SVG ----
function LogoMark({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path d="M3 17l5-6 4 4 6-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="20" cy="5.5" r="2.4" fill="#fff"/>
    </svg>
  );
}

// ---- Google SVG ----
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="#fff" d="M21.35 11.1h-9.18v2.96h5.3c-.23 1.4-1.65 4.1-5.3 4.1-3.19 0-5.8-2.64-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.04.78 3.74 1.45l2.55-2.46C16.9 3.6 14.76 2.7 12.17 2.7 7.03 2.7 2.9 6.84 2.9 12s4.13 9.3 9.27 9.3c5.35 0 8.9-3.76 8.9-9.06 0-.61-.07-1.07-.16-1.54z"/>
    </svg>
  );
}

// ---- Main component ----
export default function LandingPage() {
  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const glbgRef = useRef<HTMLCanvasElement>(null);

  const [glanceIdx, setGlanceIdx] = useState<number | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authOpen, setAuthOpen] = useState(false);

  // Scroll-driven marquee animation
  useEffect(() => {
    function tick() {
      const track = trackRef.current;
      const row = rowRef.current;
      if (track && row) {
        const r = track.getBoundingClientRect();
        const range = track.offsetHeight - window.innerHeight;
        const p = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;

        const cards = Array.from(row.children) as HTMLElement[];
        const N = cards.length;
        if (N > 0) {
          const f = p * (N - 1);
          const cardW = cards[0].offsetWidth || 340;
          const step = cardW + 40;
          const stageW = window.innerWidth;
          row.style.transform = `translateX(${(stageW / 2 - (f * step + cardW / 2)).toFixed(1)}px)`;

          const fi = Math.round(f);
          cards.forEach((c, i) => {
            const dist = Math.abs(i - f);
            c.style.transform = `scale(${Math.max(0.62, 1.13 - dist * 0.26).toFixed(3)})`;
            c.style.opacity = Math.max(0.24, 1 - dist * 0.3).toFixed(2);
            (c.style as CSSStyleDeclaration & { zIndex: string }).zIndex = i === fi ? "5" : "1";
            if (i === fi) c.classList.add("front");
            else c.classList.remove("front");
          });

          if (capRef.current) {
            capRef.current.textContent = fi < WS_LIST.length ? WS_LIST[fi].n : "And many more";
          }
          if (barRef.current) {
            barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(e => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }),
      { threshold: 0.12 }
    );
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Body scroll lock when modal open
  useEffect(() => {
    document.body.style.overflow = glanceIdx !== null || authOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [glanceIdx, authOpen]);

  // WebGL wave background (three animated sine-noise lines)
  useEffect(() => {
    const cv = glbgRef.current;
    if (!cv) return;
    const gl = (cv.getContext("webgl") || cv.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}`;
    const fs = `precision highp float;
    uniform vec2 res; uniform float t; uniform vec3 cA; uniform vec3 cB;
    float hash(float n){return fract(sin(n)*43758.5453);}
    float n1(float x){float i=floor(x);float f=fract(x);float u=f*f*(3.0-2.0*f);return mix(hash(i),hash(i+1.0),u);}
    float fbm(float x){return 0.5*n1(x)+0.25*n1(x*2.0+3.1)+0.125*n1(x*4.0+7.7);}
    void main(){
      vec2 uv=gl_FragCoord.xy/res.xy;
      float vig=smoothstep(1.3,0.1,length(uv-0.5));
      vec3 col=mix(vec3(0.010,0.016,0.034),vec3(0.020,0.038,0.082),vig);
      vec2 cell=fract(uv*vec2(30.0,18.0));
      float gd=min(min(cell.x,1.0-cell.x),min(cell.y,1.0-cell.y));
      float grid=smoothstep(0.026,0.0,gd);
      col+=mix(cA,cB,0.5)*grid*0.05;
      float xA=uv.x*3.2+t*0.06;
      float yA=0.40+0.14*fbm(xA*2.0)+0.04*sin(uv.x*7.0+t*0.25)+uv.x*0.10;
      float lA=smoothstep(0.014,0.0,abs(uv.y-yA));
      float areaA=clamp(yA-uv.y,0.0,1.0)*step(uv.y,yA);
      col+=cB*lA;
      col+=cB*areaA*0.05;
      float xB=uv.x*3.2-t*0.045+13.0;
      float yB=0.58+0.12*fbm(xB*2.0+5.0)-uv.x*0.05;
      float lB=smoothstep(0.012,0.0,abs(uv.y-yB));
      col+=cA*lB*0.8;
      float xC=uv.x*2.4+t*0.03+27.0;
      float yC=0.26+0.08*fbm(xC*2.0+9.0);
      col+=mix(cA,cB,0.5)*smoothstep(0.008,0.0,abs(uv.y-yC))*0.4;
      for(int i=0;i<5;i++){float fi=float(i);vec2 c=vec2(fract(hash(fi*3.1)+t*0.01*(hash(fi*2.0)-0.5)),fract(hash(fi*5.3)+t*0.008));float d=length(uv-c);float g=smoothstep(0.34,0.0,d);col+=mix(cA,cB,hash(fi*7.0))*g*0.045;}
      col=col/(col+0.82);
      gl_FragColor=vec4(col,1.0);
    }`;

    function compileShader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const pr = gl.createProgram()!;
    gl.attachShader(pr, compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    gl.useProgram(pr);

    const bf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(lp);
    gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(pr, "res");
    const uT   = gl.getUniformLocation(pr, "t");
    const uA   = gl.getUniformLocation(pr, "cA");
    const uB   = gl.getUniformLocation(pr, "cB");
    gl.uniform3f(uA, 0.486, 0.424, 0.961);
    gl.uniform3f(uB, 0.204, 0.886, 0.941);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv!.width  = Math.floor(window.innerWidth * dpr);
      cv!.height = Math.floor(window.innerHeight * dpr);
      gl!.viewport(0, 0, cv!.width, cv!.height);
    }
    resize();
    window.addEventListener("resize", resize);

    const t0 = performance.now();
    let animId = 0;
    function frame(now: number) {
      gl!.uniform2f(uRes, cv!.width, cv!.height);
      gl!.uniform1f(uT, (now - t0) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      animId = requestAnimationFrame(frame);
    }
    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  function openAuth(mode: "signup" | "login") {
    setGlanceIdx(null);
    setAuthMode(mode);
    setAuthOpen(true);
  }

  async function handleLandingGoogle() {
    try {
      const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
      await completeGoogleLogin(result);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(firebaseAuth, googleAuthProvider);
      } else {
        window.alert(getAuthErrorMessage(err));
      }
    }
  }

  const glanceWs = glanceIdx !== null ? WS_LIST[glanceIdx] : null;

  return (
    <>
    <canvas ref={glbgRef} className="sp-glbg" />
    <div className="lp-root mq-root">
      <div className="sp-aurora">
        <i className="a1" /><i className="a2" /><i className="a3" />
      </div>

      <div className="hw">

        {/* ---- NAV ---- */}
        <nav className="hw-nav">
          <Link href="/" className="hw-brand">
            <span className="hw-logo"><LogoMark /></span>
            StockWise
          </Link>
          <div className="hw-nav-cta">
            <button className="hw-ghost" onClick={() => openAuth("login")}>Log in</button>
            <button className="hw-solid" onClick={() => openAuth("signup")}>Sign up</button>
          </div>
        </nav>

        {/* ---- HERO ---- */}
        <section className="mq-hero">
          <div className="mq-kicker">StockWise · Market Intelligence</div>
          <h1 className="mq-title">Every market view.<br />One scroll.</h1>
          <p className="mq-sub">
            The entire market, narrated. Scroll through every research view — movers, earnings, analysts, your book — each with an AI read that tells you <em>what</em> moved, and <em>why</em>. Ticker to thesis, without leaving the page.
          </p>
          <div className="mq-scrollcue">
            <span>Scroll</span>
            <i />
          </div>
        </section>

        {/* ---- MARQUEE TRACK ---- */}
        <section className="mq-track" ref={trackRef}>
          <div className="mq-stage">
            <div className="mq-progress"><i ref={barRef as React.RefObject<HTMLElement>} /></div>
            <div className="mq-row" ref={rowRef}>
              {WS_LIST.map((ws, i) => {
                const Thumb = ws.Thumb;
                return (
                  <div key={ws.n} className="mq-card" onClick={() => setGlanceIdx(i)}>
                    <div className="mq-shot"><Thumb /></div>
                    <div className="mq-label">
                      <h3>{ws.n}</h3>
                      <p>{ws.d}</p>
                      <div className="mq-chips">
                        {ws.chips.map(c => <span key={c} className="mq-chip">{c}</span>)}
                      </div>
                      <div className="mq-go">View at a glance →</div>
                    </div>
                  </div>
                );
              })}
              {/* "And many more" card */}
              <div className="mq-card mq-more" onClick={() => openAuth("signup")}>
                <div className="mq-more-inner">
                  <h3>And many more</h3>
                  <p>Screener, IPOs, Watchlist, Insider & 13F, Commentary, Macro & VIX — fourteen connected workspaces in all.</p>
                  <div className="mq-go">See everything →</div>
                </div>
                <div className="mq-more-hint">Keep scrolling ↓</div>
              </div>
            </div>
            <div className="mq-cap" ref={capRef}>Dashboard</div>
            <div className="mq-hint">scroll — or tap a card to open it</div>
          </div>
        </section>

        {/* ---- GLANCE MODAL ---- */}
        {glanceIdx !== null && glanceWs && (
          <div className="mq-glance open">
            <div className="mqg-scrim" onClick={() => setGlanceIdx(null)} />
            <div className="mqg-panel">
              <button className="mqg-x" onClick={() => setGlanceIdx(null)}>✕</button>
              <div className="mqg-body">
                <div className="mqg-shot">
                  <glanceWs.Thumb />
                </div>
                <div className="mqg-info">
                  <div className="mqg-kicker">
                    Workspace {String(glanceIdx + 1).padStart(2, "0")} / {String(WS_LIST.length).padStart(2, "0")}
                  </div>
                  <h2>{glanceWs.n}</h2>
                  <p>{glanceWs.long}</p>
                  <ul className="mqg-feat">
                    {glanceWs.feats.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <div className="mqg-cta">
                    <button className="mqp-btn solid" onClick={() => openAuth("signup")}>
                      Open {glanceWs.n} →
                    </button>
                    <button className="mqp-btn" onClick={() => setGlanceIdx(null)}>Back to tour</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- AUTH MODAL ---- */}
        {authOpen && (
          <div className="auth-modal open">
            <div className="auth-scrim" onClick={() => setAuthOpen(false)} />
            <div className="auth-panel">
              <button className="mqg-x" onClick={() => setAuthOpen(false)}>✕</button>
              <div className="au-head">
                <span className="hw-logo"><LogoMark size={15} /></span>
                StockWise
              </div>
              <div className="au-tabs">
                <button className={`au-tab${authMode === "signup" ? " on" : ""}`} onClick={() => setAuthMode("signup")}>Sign up</button>
                <button className={`au-tab${authMode === "login" ? " on" : ""}`} onClick={() => setAuthMode("login")}>Log in</button>
              </div>
              {authMode === "signup" ? (
                <>
                  <h3 className="au-title">Create your free account</h3>
                  <Link href="/auth/signup" className="au-cta">Create account →</Link>
                  <div className="au-or">or</div>
                  <button className="au-google" onClick={handleLandingGoogle}><GoogleIcon />Continue with Google</button>
                  <p className="au-fine">Free to start. No credit card required.</p>
                </>
              ) : (
                <LoginForm />
              )}
            </div>
          </div>
        )}

        {/* ---- PRICING ---- */}
        <section className="mq-pricing">
          <div className="mq-kicker" style={{ textAlign: "center" }}>Pricing</div>
          <h2 className="mqp-title">One terminal. Simple plans.</h2>
          <div className="mqp-grid">
            <div className="mqp-card">
              <div className="mqp-tier">Starter</div>
              <div className="mqp-price">$0<span>/mo</span></div>
              <p className="mqp-d">Explore the whole terminal with delayed data.</p>
              <ul className="mqp-feat">
                <li>All 14 workspaces</li>
                <li>Delayed market data</li>
                <li>Daily EOD recap</li>
              </ul>
              <button className="mqp-btn" onClick={() => openAuth("signup")}>Start free</button>
            </div>
            <div className="mqp-card hot">
              <div className="mqp-flag">Most popular</div>
              <div className="mqp-tier">Pro</div>
              <div className="mqp-price">$29<span>/mo</span></div>
              <p className="mqp-d">Real-time research for active investors.</p>
              <ul className="mqp-feat">
                <li>Real-time data &amp; alerts</li>
                <li>AI read in every view</li>
                <li>Portfolio &amp; watchlist AI</li>
                <li>Scheduled recaps</li>
              </ul>
              <button className="mqp-btn solid" onClick={() => openAuth("signup")}>Go Pro</button>
            </div>
            <div className="mqp-card">
              <div className="mqp-tier">Elite</div>
              <div className="mqp-price">$79<span>/mo</span></div>
              <p className="mqp-d">Maximum firepower for serious investors.</p>
              <ul className="mqp-feat">
                <li>Everything in Pro</li>
                <li>Multi-portfolio &amp; 13F tracking</li>
                <li>Custom alert rules</li>
                <li>API &amp; data export</li>
                <li>Priority support</li>
              </ul>
              <button className="mqp-btn" onClick={() => openAuth("signup")}>Go Elite</button>
            </div>
          </div>
        </section>

        {/* ---- FINAL CTA ---- */}
        <div className="hw-final" style={{ borderTop: "1px solid #1c1c1c" }}>
          <h2 className="mqp-title" style={{ fontSize: "2rem" }}>Start your research in one place</h2>
          <div className="hw-cta" style={{ justifyContent: "center", marginTop: "18px" }}>
            <button className="mqp-btn solid" style={{ minWidth: "230px" }} onClick={() => openAuth("signup")}>
              Open the terminal →
            </button>
          </div>
          <p style={{ fontSize: ".74rem", color: "#666", marginTop: "16px" }}>
            StockWise is a research terminal for informational purposes — not investment advice.
          </p>
        </div>

      </div>
    </div>
    </>
  );
}
