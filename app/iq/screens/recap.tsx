"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIQActions } from "../shell";
import { recap, sectorList } from "../data";
import { cls, arr, sign, StockLogo } from "../utils";

const TABS = ["Today (EOD)", "This Week"];

const WEEKLY = {
  range: "Jun 17 – Jun 21, 2026",
  subtitle: "auto-generated · Fri 5:02 ET",
  headline: "Tech leads a strong week; Fed hold priced in, rate-cut odds firming",
  indices: [
    { l: "S&P 500",    v:  2.14 },
    { l: "Nasdaq",     v:  3.42 },
    { l: "Dow",        v:  1.08 },
    { l: "Russell 2K", v: -0.71 },
  ],
  topStories: [
    "NVDA earnings beat powered semiconductors +6.1% for the week — the biggest sector move.",
    "FOMC held rates at 5.50%; dot plot shifted: 2 cuts now expected in 2024 vs 3 previously.",
    "Core CPI +0.2% m/m — first downside surprise in 4 months, lifted rate-cut probability to 58%.",
    "Defensives (Utilities, Staples) underperformed as risk appetite dominated all week.",
  ],
  sectorLeaders: [
    { name: "Semiconductors", chg:  6.1 },
    { name: "Technology",     chg:  4.8 },
    { name: "Consumer Disc.", chg:  2.3 },
  ],
  sectorLaggards: [
    { name: "Utilities",      chg: -1.4 },
    { name: "Staples",        chg: -0.9 },
    { name: "Healthcare",     chg:  0.2 },
  ],
  biggestMoves: [
    { s: "NVDA", reason: "Earnings beat-and-raise", c:  14.2 },
    { s: "PLTR", reason: "Guidance raise",          c:   9.1 },
    { s: "ZIM",  reason: "Earnings + dividend",     c:   9.0 },
    { s: "WBA",  reason: "Guidance cut",            c:  -9.4 },
    { s: "DELL", reason: "Margin miss",             c:  -5.2 },
  ],
  nextWeek: [
    { time: "Mon", ev: "No major macro" },
    { time: "Tue", ev: "Consumer Confidence (10:00a)" },
    { time: "Wed", ev: "Durable Goods (8:30a)" },
    { time: "Thu", ev: "GDP Q1 final (8:30a) · Jobless Claims" },
    { time: "Fri", ev: "PCE Deflator (8:30a) — key Fed inflation gauge" },
  ],
};

function heatColor(v: number): string {
  const abs = Math.min(Math.abs(v) / 4, 1);
  if (v > 0) return `rgba(47,230,166,${0.2 + abs * 0.7})`;
  return `rgba(255,90,90,${0.2 + abs * 0.7})`;
}

export function RecapScreen() {
  const router = useRouter();
  const { openStock, openSector } = useIQActions();
  const [activeTab, setActiveTab] = useState(0);

  function downloadRecap(which: string) {
    const blob = new Blob([`InvestIQ ${which} Recap — ${recap.date}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `InvestIQ-Recap-${which}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Recaps</div>
          <div className="page-title">{activeTab === 1 ? "Weekly Recap" : "End-of-Day Recap"}</div>
          <div className="page-sub">{activeTab === 1 ? `${WEEKLY.range} · ${WEEKLY.subtitle}` : `${recap.date} · ${recap.subtitle}`}</div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " on" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* ── This Week tab ── */}
        {activeTab === 1 && (
          <>
            <div className="recap-hero">
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>
                  {WEEKLY.headline}
                </div>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
                {WEEKLY.indices.map(idx => (
                  <div key={idx.l}>
                    <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{idx.l}</div>
                    <div className={`mono ${cls(idx.v)}`} style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                      {arr(idx.v)}{sign(idx.v)}
                    </div>
                  </div>
                ))}
                <div style={{ marginLeft: "auto" }}>
                  <button className="btn ai">
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                    60-sec audio recap
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>DOWNLOAD PDF:</span>
                <button className="btn" onClick={() => downloadRecap("this-week")}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  This Week
                </button>
                <button className="btn" onClick={() => downloadRecap("last-week")}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Last Week
                </button>
              </div>
            </div>

            <div className="dash" style={{ marginTop: 14 }}>
              {/* Top stories */}
              <div className="col-6">
                <div className="card">
                  <div className="card-h">
                    <h3>Top stories this week</h3>
                  </div>
                  <div className="card-b" style={{ paddingTop: 6 }}>
                    {WEEKLY.topStories.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: ".84rem" }}>
                        <span className="bullet" style={{ marginTop: 6, flexShrink: 0 }} />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Next week */}
              <div className="col-6">
                <div className="card">
                  <div className="card-h">
                    <h3>What to watch next week</h3>
                  </div>
                  <div className="card-b" style={{ paddingTop: 6 }}>
                    {WEEKLY.nextWeek.map((t, i) => (
                      <div key={i} className="minirow">
                        <span className="mono" style={{ width: 36, color: "var(--warn)" }}>{t.time}</span>
                        <span className="mid">{t.ev}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="dash" style={{ marginTop: 14 }}>
              {/* Sector leaders / laggards */}
              <div className="col-4">
                <div className="card">
                  <div className="card-h"><h3>Sector leaders</h3><span className="pill up">Week</span></div>
                  <div className="card-b" style={{ paddingTop: 6 }}>
                    {WEEKLY.sectorLeaders.map(s => (
                      <div key={s.name} className="minirow" style={{ cursor: "pointer" }} onClick={() => openSector(s.name)}>
                        <span className="mid">{s.name}</span>
                        <span className={`r ${cls(s.chg)}`}>{sign(s.chg)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-4">
                <div className="card">
                  <div className="card-h"><h3>Sector laggards</h3><span className="pill dn">Week</span></div>
                  <div className="card-b" style={{ paddingTop: 6 }}>
                    {WEEKLY.sectorLaggards.map(s => (
                      <div key={s.name} className="minirow" style={{ cursor: "pointer" }} onClick={() => openSector(s.name)}>
                        <span className="mid">{s.name}</span>
                        <span className={`r ${cls(s.chg)}`}>{sign(s.chg)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Biggest movers */}
              <div className="col-4">
                <div className="card">
                  <div className="card-h"><h3>Biggest movers</h3><span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>5-day</span></div>
                  <div className="card-b" style={{ paddingTop: 6 }}>
                    {WEEKLY.biggestMoves.map(m => (
                      <div key={m.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(m.s)}>
                        <StockLogo sym={m.s} size={20} />
                        <span className="tkr">{m.s}</span>
                        <span className="mid" style={{ fontSize: ".75rem" }}>{m.reason}</span>
                        <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sector heatmap — weekly */}
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-h">
                <h3>Sector heatmap · weekly performance</h3>
                <span className="link" onClick={() => router.push("/menu/heatmap")}>View all →</span>
              </div>
              <div className="card-b">
                <div className="heat">
                  {sectorList.slice(0, 10).map(s => (
                    <div key={s.name} className="s" style={{ background: heatColor(s.chg * 5), cursor: "pointer" }} onClick={() => openSector(s.name)}>
                      <div className="nm">{s.name}</div>
                      <div className="v">{arr(s.chg)}{sign(s.chg)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Today (EOD) tab ── */}
        {activeTab === 0 && <>

        {/* Hero */}
        <div className="recap-hero">
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
            <div className="wmn-orb">
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
              </svg>
            </div>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>
              {recap.headline}
            </div>
          </div>

          {/* Index returns */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            {recap.indices.map(idx => (
              <div key={idx.l}>
                <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{idx.l}</div>
                <div className={`mono ${cls(idx.v)}`} style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  {arr(idx.v)}{sign(idx.v)}
                </div>
              </div>
            ))}
            <div style={{ marginLeft: "auto" }}>
              <button className="btn ai">
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
                60-sec audio recap
              </button>
            </div>
          </div>

          {/* PDF downloads */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>DOWNLOAD PDF:</span>
            {(["Today (EOD)", "Yesterday", "Last week"] as const).map(w => (
              <button key={w} className="btn" onClick={() => downloadRecap(w)}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {w}
              </button>
            ))}
          </div>

          {/* Key stories + Up next */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="eyebrow">Key stories</div>
                <span className="link">View all →</span>
              </div>
              {recap.stories.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: ".84rem" }}>
                  <span className="bullet" style={{ marginTop: 6, flexShrink: 0 }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="eyebrow">Up next · tomorrow</div>
                <span className="link">View all →</span>
              </div>
              {recap.tomorrow.map((t, i) => (
                <div key={i} className="minirow">
                  <span className="mono" style={{ width: 54, color: "var(--warn)" }}>{t.time}</span>
                  <span className="mid">{t.ev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Schedule & share */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <h3>Schedule &amp; share this recap</h3>
            <span className="pill ai">Auto-delivery</span>
          </div>
          <div className="card-b" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>
                Recipient email
              </label>
              <input
                type="email"
                placeholder="colleague@firm.com"
                className="inp"
                style={{
                  width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)",
                  borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".84rem",
                }}
              />
            </div>
            <div style={{ flex: "1 1 130px" }}>
              <label style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", display: "block", marginBottom: 5 }}>
                Delivery time
              </label>
              <select
                className="inp"
                style={{
                  width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)",
                  borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".84rem",
                }}
              >
                <option>Daily EOD (4:30 PM ET)</option>
                <option>Weekly (Fri 5 PM ET)</option>
                <option>Send now</option>
              </select>
            </div>
            <button className="btn primary" style={{ flexShrink: 0, alignSelf: "flex-end", marginBottom: 1 }}>
              Schedule delivery
            </button>
          </div>
        </div>

        {/* Sector heatmap */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <h3>Sector heatmap</h3>
            <span className="link" onClick={() => router.push("/menu/heatmap")}>View all →</span>
          </div>
          <div className="card-b">
            <div className="heat">
              {sectorList.slice(0, 10).map(s => (
                <div key={s.name} className="s" style={{ background: heatColor(s.chg), cursor: "pointer" }} onClick={() => openSector(s.name)}>
                  <div className="nm">{s.name}</div>
                  <div className="v">{arr(s.chg)}{sign(s.chg)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9, fontSize: ".74rem" }}>
              <span style={{ color: "var(--text-dim-solid)" }}>Sectors 1–10 of 50 · click one to open it in the heatmap</span>
              <span className="link">Show next 10 →</span>
            </div>
          </div>
        </div>

        {/* Movers + Internals */}
        <div className="dash" style={{ marginTop: 14 }}>
          <div className="col-6">
            <div className="card">
              <div className="card-h">
                <h3>Biggest earnings movers</h3>
                <span className="link">View all →</span>
              </div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {recap.movers.map(m => (
                  <div key={m.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(m.s)}>
                    <StockLogo sym={m.s} size={20} />
                    <span className="tkr">{m.s}</span>
                    <span className="mid">{m.reason}</span>
                    <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="card">
              <div className="card-h">
                <h3>Market internals</h3>
                <span className="link">View all →</span>
              </div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {recap.internals.map(r => (
                  <div key={r.l} className="minirow">
                    <span className="mid">{r.l}</span>
                    <span className={`r ${r.c > 0 ? "up" : r.c < 0 ? "down" : ""}`}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        </>}
      </div>
    </>
  );
}
