"use client";

import { useAppSelector } from "../../store/hooks";
import { useIQActions } from "../shell";
import { pulse, wmn, movers, earnings, folio, analyst, watch, sectorList } from "../data";
import { fmt, sign, cls, arr, Spark } from "../utils";

const LIVE_FEED = [
  {
    cat: "Earnings", col: "var(--up)", time: "9:31a",
    t: '<b style="color:var(--text-hi)">NVDA</b> beats EPS by 18%, raises FY25 guidance',
    why: "Confirms AI data-center demand is still accelerating — bullish read-through for the entire semis group.",
  },
  {
    cat: "Analyst", col: "var(--brand-2)", time: "9:18a",
    t: 'Morgan Stanley upgrades <b style="color:var(--text-hi)">CRM</b> to Overweight, PT $340',
    why: "Third upgrade this week; sell-side is turning constructive after the margin-expansion story.",
  },
  {
    cat: "Block Trade", col: "var(--ai)", time: "9:05a",
    t: '4.2M-share block in <b style="color:var(--text-hi)">XLF</b> crossed above VWAP',
    why: "Large institutional buyer in financials — aligns with the risk-on rotation today.",
  },
  {
    cat: "Macro", col: "var(--warn)", time: "8:30a",
    t: 'May core CPI <b style="color:var(--text-hi)">+0.2%</b> m/m, below 0.3% est.',
    why: "Softer inflation lifts September rate-cut odds; 10Y yield fell 4bps on the print.",
  },
];

const TABS = ["Today", "Premarket", "Live", "After Hours", "This Week", "My Portfolio"];

function analystDir(type: string) {
  if (type === "upgrade")    return <span className="up">▲ Upg</span>;
  if (type === "downgrade")  return <span className="down">▼ Dng</span>;
  if (type === "initiation") return <span style={{ color: "var(--ai)" }}>◆ Init</span>;
  return <span style={{ color: "var(--text-dim-solid)" }}>Reit</span>;
}

/** Circular progress gauge — number lives inside the ring */
function CircleGauge({ value, color = "var(--up)" }: { value: number; color?: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = circ * (value / 100);
  return (
    <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
      <svg viewBox="0 0 80 80" style={{ width: 80, height: 80 }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${filled.toFixed(2)} ${(circ - filled).toFixed(2)}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)" />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "var(--f-mono)", fontSize: 18, fontWeight: 700,
          color: "var(--text-hi)", lineHeight: 1,
        }}>{value}</span>
      </div>
    </div>
  );
}

export function DashboardScreen() {
  const { openStock, openEarnings, openSector, setCopilot } = useIQActions();
  const { user } = useAppSelector(s => s.auth);
  const { data: profile } = useAppSelector(s => s.profile);

  const displayName = profile?.name || user?.displayName || "Investor";
  const firstName = displayName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const now = new Date();
  const dayName  = now.toLocaleDateString("en-US", { weekday: "long" });
  const datePart = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr  = `${dayName} · ${datePart} · ${timePart} ET`;

  const totalVal     = folio.reduce((s, f) => s + f.qty * f.px,  0);
  const totalCost    = folio.reduce((s, f) => s + f.qty * f.avg, 0);
  const totalGain    = totalVal - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return (
    <>
      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <div className="eyebrow">{dateStr}</div>
          <h1 className="page-title">{greeting}, {firstName}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="tabs">
            {TABS.map((t, i) => (
              <button key={t} className={`tab${i === 0 ? " active" : ""}`}>{t}</button>
            ))}
          </div>
          <button className="chip ai-c" onClick={() => setCopilot(true)}>✦ AI Summary</button>
        </div>
      </div>

      <div className="dash">

        {/* ── 1. Pulse strip ── */}
        <div className="col-12">
          <div className="pulse">
            {pulse.slice(0, 6).map((x, i) => (
              <div key={x.l} className="p">
                <div className="lbl">{x.l}</div>
                <div className="val">{fmt(x.v, x.v > 1000 ? 0 : 2)}</div>
                <div className={`chg ${cls(x.c)}`}>{arr(x.c)} {sign(x.c)}</div>
                <Spark seed={i + 1} up={x.c >= 0} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. At-a-glance row — all three cards equal height ── */}
        <div className="col-12" style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, alignItems: "stretch",
        }}>

          {/* Portfolio mini */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>My Portfolio</h3>
              <a className="link" href="/menu/portfolio">View all →</a>
            </div>
            <div className="card-b" style={{ flex: 1, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-hi)" }}>
                  ${fmt(totalVal, 0)}
                </span>
                <span className={`mono ${cls(totalGainPct)}`} style={{ fontWeight: 600, fontSize: ".8rem" }}>
                  {arr(totalGainPct)} {Math.abs(totalGainPct).toFixed(1)}%
                </span>
              </div>
              {folio.slice(0, 4).map(f => {
                const dayC = movers.find(m => m.s === f.s)?.c ?? 0;
                return (
                  <div key={f.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(f.s)}>
                    <span className="tkr">{f.s}<small>{f.n}</small></span>
                    <span className="mid">{f.sec}</span>
                    <span className={`r ${cls(dayC)}`}>{sign(dayC)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Watchlist mini */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Watchlist</h3>
              <a className="link" href="/menu/watchlist">View all →</a>
            </div>
            <div className="card-b" style={{ flex: 1, paddingTop: 8 }}>
              {watch.slice(0, 5).map(w => (
                <div key={w.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(w.s)}>
                  <span className="tkr">{w.s}<small>{w.n}</small></span>
                  <span className="mid">{w.note}</span>
                  <span className={`r ${cls(w.c)}`}>{sign(w.c)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap mini — exactly 3 rows × 2 cols */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Market Heatmap</h3>
              <a className="link" href="/menu/heatmap">View all →</a>
            </div>
            <div className="card-b" style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 10 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr 1fr", gap: 4, flex: 1,
              }}>
                {sectorList.slice(0, 6).map(sd => {
                  const a = Math.min(Math.abs(sd.chg) / 2, 1);
                  const bg = sd.chg >= 0
                    ? `rgba(28,170,112,${(0.25 + a * 0.55).toFixed(2)})`
                    : `rgba(208,52,76,${(0.25 + a * 0.55).toFixed(2)})`;
                  return (
                    <div key={sd.name} onClick={() => openSector(sd.name)}
                      style={{
                        cursor: "pointer", background: bg, borderRadius: 7,
                        padding: "7px 9px", display: "flex", flexDirection: "column", justifyContent: "space-between",
                      }}>
                      <div style={{ fontSize: ".62rem", fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{sd.name}</div>
                      <div className="mono" style={{ fontSize: ".66rem", color: "#ffffffd0" }}>{sign(sd.chg)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                Tap a sector for stocks &amp; news.
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. WMN + VIX/F&G — paired so heights match ── */}
        <div className="col-12" style={{
          display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, alignItems: "stretch",
        }}>

          {/* WMN Signature block */}
          <div className="wmn" style={{ display: "flex", flexDirection: "column" }}>
            <div className="wmn-h">
              <div className="t">
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2>What Matters Now</h2>
                  <div className="meta">
                    <span className="live"><span className="dot" />Live</span>
                    · AI-curated · updates every 90s
                  </div>
                </div>
              </div>
              <button className="btn ai">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                30-sec audio
              </button>
            </div>
            <ul className="wmn-body" style={{ flex: 1 }}>
              {wmn.map((b, i) => (
                <li key={i}>
                  <span className="bullet" />
                  <span>
                    <b>{b.h}.</b>{" "}
                    <span dangerouslySetInnerHTML={{ __html: b.t }} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="wmn-foot">
              Sources used:
              <span className="src-chip">CPI release</span>
              <span className="src-chip">NVDA 10-Q</span>
              <span className="src-chip">Analyst feed</span>
              <span className="src-chip">Your portfolio</span>
              <span style={{ marginLeft: "auto", color: "var(--ai)" }}>
                AI-generated · informational, not investment advice
              </span>
            </div>
          </div>

          {/* VIX + Fear & Greed — stacked to match WMN height */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* VIX */}
            <div className="card vix" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="card-h">
                <h3>VIX · Volatility</h3>
                <span className="pill up">Calm</span>
              </div>
              <div className="card-b" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span className="big">14.18</span>
                    <span className="mono down" style={{ fontWeight: 600 }}>▼ -2.51%</span>
                  </div>
                  <div className="pctl" style={{ marginTop: 12 }}><i style={{ width: "22%" }} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".66rem", color: "var(--text-dim-solid)", marginBottom: 10 }}>
                    <span>12-mo percentile: 22nd</span>
                    <span>Trend: falling</span>
                  </div>
                </div>
                <div className="note">
                  VIX at 14 is low and historically corresponds to a calm, risk-on tape. Cheap hedging environment.
                </div>
              </div>
            </div>

            {/* Fear & Greed — circle with number, label to the right */}
            <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="card-h">
                <h3>Fear &amp; Greed</h3>
                <span className="link">History →</span>
              </div>
              <div className="card-b" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 18,
              }}>
                <CircleGauge value={62} color="var(--up)" />
                <div>
                  <div style={{
                    fontSize: "1.4rem", fontWeight: 700, color: "var(--up)",
                    fontFamily: "var(--f-display)", lineHeight: 1,
                  }}>Greed</div>
                  <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", marginTop: 6 }}>
                    Fear &amp; Greed Index
                  </div>
                  <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", marginTop: 3 }}>
                    Prev close: <b style={{ color: "var(--text)" }}>58</b>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── 4. Live Market Feed + bottom widget stack ── */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>📡 Live Market Feed</h3>
              <a className="link" href="/menu/commentary">All-market commentary →</a>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {LIVE_FEED.map((f, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "11px 0",
                  borderBottom: i < LIVE_FEED.length - 1 ? "1px solid var(--border-soft)" : undefined,
                }}>
                  <div style={{ flexShrink: 0, width: 84 }}>
                    <span className="pill" style={{ background: "var(--surface-3)", color: f.col }}>{f.cat}</span>
                    <div style={{ fontFamily: "var(--f-mono)", fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 6 }}>
                      {f.time}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".86rem", color: "var(--text)" }} dangerouslySetInnerHTML={{ __html: f.t }} />
                    <div style={{
                      fontSize: ".78rem", color: "var(--text-dim-solid)",
                      borderLeft: `2px solid ${f.col}88`, paddingLeft: 9, marginTop: 5,
                    }}>
                      <b style={{ color: "var(--ai)", fontWeight: 600 }}>Why it matters · </b>{f.why}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Earnings Today */}
          <div className="card">
            <div className="card-h">
              <h3>Earnings Today</h3>
              <a className="link" href="/menu/earnings">View all →</a>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {earnings.slice(0, 5).map(e => (
                <div key={e.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openEarnings(e.s)}>
                  <span className="tkr">{e.s}<small>{e.n}</small></span>
                  <span className="mid">
                    <span className={`pill ${e.t === "BMO" ? "bmo" : "amc"}`}>{e.t}</span>
                  </span>
                  <span className={`r ${e.react != null ? cls(e.react) : ""}`}>
                    {e.react != null
                      ? sign(e.react)
                      : <span style={{ color: "var(--text-dim-solid)" }}>pending</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Analyst Actions */}
          <div className="card">
            <div className="card-h">
              <h3>Analyst Actions</h3>
              <a className="link" href="/menu/analyst">View all →</a>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {analyst.slice(0, 5).map((a, i) => (
                <div key={i} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(a.s)}>
                  <span className="tkr">{a.s}</span>
                  <span className="mid">{a.firm} → <b style={{ color: "var(--text-hi)" }}>{a.to}</b></span>
                  <span className="r">{analystDir(a.type)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Movers */}
          <div className="card">
            <div className="card-h">
              <h3>Top Movers</h3>
              <a className="link" href="/menu/movers">View all →</a>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {movers.slice(0, 5).map(m => (
                <div key={m.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(m.s)}>
                  <span className="tkr">{m.s}</span>
                  <span className="mid">{m.reason}</span>
                  <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
