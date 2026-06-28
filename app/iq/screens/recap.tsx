"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIQActions } from "../shell";
import { recap, sectorList, pulse, movers, earnings } from "../data";
import type { Mover } from "../data";
import { cls, arr, sign, fmt, Spark, StockLogo } from "../utils";

const SEC_PAGE = 10;
const SEC_PAGES = Math.ceil(sectorList.length / SEC_PAGE);
const N_SLIDES = 7;

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
  stories: [
    "NVDA earnings beat powered semiconductors +6.1% for the week — the biggest sector move.",
    "FOMC held rates at 5.50%; dot plot shifted: 2 cuts now expected in 2024 vs 3 previously.",
    "Core CPI +0.2% m/m — first downside surprise in 4 months, lifted rate-cut probability to 58%.",
    "Defensives (Utilities, Staples) underperformed as risk appetite dominated all week.",
  ],
  nextWeek: [
    { time: "Mon", ev: "No major macro" },
    { time: "Tue", ev: "Consumer Confidence (10:00a)" },
    { time: "Wed", ev: "Durable Goods (8:30a)" },
    { time: "Thu", ev: "GDP Q1 final (8:30a) · Jobless Claims" },
    { time: "Fri", ev: "PCE Deflator (8:30a) — key Fed inflation gauge" },
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
};

// ---- 7-slide story data per stock ----
type Slide = {
  kicker: string;
  accent: string;
  headline: string;
  verdict?: string;
  chips?: [string, string][];
  body?: string[];
};

function storySlides(m: Mover): Slide[] {
  const up = m.c >= 0;
  const rsi = Math.round(38 + m.rs * 0.36);
  const verdict = m.rs >= 65 && up ? "Bullish" : (m.rs < 40 || m.c < -3) ? "Cautious" : "Neutral";
  const vAcc = verdict === "Bullish" ? "#22d39a" : verdict === "Cautious" ? "#ff5d7a" : "#9fb0c3";
  const sup = fmt(m.p * 0.965, m.p > 100 ? 0 : 2);
  const res = fmt(m.p * 1.03, m.p > 100 ? 0 : 2);
  return [
    {
      kicker: "WHAT HAPPENED",
      accent: "#34E2F0",
      headline: `${m.n} ${up ? "climbed " : "fell "}${sign(m.c)} today`,
      chips: [["Move", sign(m.c)], ["Last price", `$${fmt(m.p, m.p > 100 ? 0 : 2)}`], ["Rel. volume", `${m.rvol}×`], ["5-day", sign(m.wk)]],
      body: [`${m.n} ${up ? "finished higher" : "closed lower"} on the session on ${m.cat.toLowerCase()}.`],
    },
    {
      kicker: "WHY IT HAPPENED",
      accent: "#7C6CF5",
      headline: m.cat,
      body: [m.news, `Volume ran ${m.rvol}× normal — ${m.rvol >= 2 ? "confirming real participation behind the move." : "roughly in line with the average day."}`],
    },
    {
      kicker: "TECHNICAL PICTURE",
      accent: "#22d39a",
      headline: m.rs >= 60 ? "Trend intact" : m.rs < 40 ? "Trend under pressure" : "Mixed signals",
      chips: [["RSI (14)", String(rsi)], ["RS rank", `${m.rs}/99`], ["vs 50/200 MA", m.ma], ["Rating", "—"]],
      body: [`${m.n} is ${m.ma} with an RSI near ${rsi}${rsi > 70 ? " (overbought)" : rsi < 35 ? " (oversold)" : " (neutral)"}. Relative strength ranks ${m.rs}/99 versus the market.`],
    },
    {
      kicker: "FUNDAMENTAL PICTURE",
      accent: "#f5b14c",
      headline: "Earnings power & valuation",
      chips: [["Mkt cap", m.cap], ["Sector", m.sector], ["5-day", sign(m.wk)], ["RS rank", `${m.rs}/99`]],
      body: [`${m.n} is a ${m.cap}-cap name in ${m.sector}. ${up ? "Positive" : "Negative"} price action reflects current market sentiment on the name.`],
    },
    {
      kicker: "MACRO / VUCA IMPACT",
      accent: "#ff79c6",
      headline: "Regime & sector context",
      chips: [["Sector", m.sector], ["Day chg", sign(m.c)], ["10Y yield", "4.32%"], ["VIX", "14.2"]],
      body: [`${m.sector} is ${up ? "leading" : "lagging"} today. With the VIX subdued and rate-cut odds firming, the tape favors ${m.rs >= 55 ? `risk-on leaders like ${m.s}` : "lower-beta defensives over high-flyers"}.`],
    },
    {
      kicker: "AI VERDICT",
      accent: vAcc,
      headline: verdict,
      verdict,
      body: [
        verdict === "Bullish" ? "Constructive — strong relative strength paired with a clean catalyst." : verdict === "Cautious" ? "Risk-managed — soft momentum or an outsized drop argues for patience." : "Wait-and-see — signals are mixed; let price confirm a direction.",
        `Conviction: ${m.rs >= 65 ? "High" : m.rs >= 45 ? "Medium" : "Low"} · position sizing should reflect it.`,
      ],
    },
    {
      kicker: "WHAT TO WATCH TOMORROW",
      accent: "#34E2F0",
      headline: "Key triggers & levels",
      body: [
        `Levels: support near $${sup}, resistance near $${res}.`,
        `Confirmation: watch volume to validate ${up ? "continuation" : "stabilization"} off these levels.`,
      ],
    },
  ];
}

// ---- News briefing carousel ----
function RcpCarousel({ picks, label, dateLabel }: { picks: Mover[]; label: string; dateLabel: string }) {
  const [rcSym, setRcSym] = useState(0);
  const [rcSlide, setRcSlide] = useState(0);
  const txRef = useRef(0);
  const swipedRef = useRef(false);

  if (!picks.length) return null;
  const cur = picks[Math.min(rcSym, picks.length - 1)]!;
  const slides = storySlides(cur);
  const sl = slides[Math.min(rcSlide, slides.length - 1)]!;

  function prev() { setRcSlide(s => (s - 1 + slides.length) % slides.length); }
  function next() { setRcSlide(s => (s + 1) % slides.length); }
  function goSym(i: number) { setRcSym(i); setRcSlide(0); }
  function handleTap() { if (swipedRef.current) { swipedRef.current = false; return; } next(); }
  function handleTouchStart(e: React.TouchEvent) { txRef.current = e.changedTouches[0]?.clientX ?? 0; swipedRef.current = false; }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - txRef.current;
    if (Math.abs(dx) > 40) { swipedRef.current = true; dx < 0 ? next() : prev(); }
  }

  return (
    <div className="rcp-carousel-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div className="eyebrow">{label} · news briefing</div>
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>Daily market news · {N_SLIDES} cards per stock · swipe or tap</span>
      </div>
      <div className="rcp-carousel">
        {/* Stock pills with company logos */}
        <div className="rc-syms">
          {picks.map((m, i) => (
            <button key={m.s} className={`rc-sym${i === rcSym ? " on" : ""}`} onClick={() => goSym(i)}>
              <StockLogo sym={m.s} size={18} />
              {m.s}
            </button>
          ))}
        </div>

        {/* Card stage */}
        <div className="rc-stage">
          <button className="rc-arrow" onClick={prev}>‹</button>
          <div
            className="rc-slide"
            style={{ "--acc": sl.accent } as React.CSSProperties}
            onClick={handleTap}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="rc-top">
              <span className="rc-kicker">{sl.kicker}</span>
              <span className="rc-num">{rcSlide + 1}/{N_SLIDES}</span>
            </div>
            <div className="rc-head">{sl.headline}</div>
            {sl.verdict && <div className="rc-verdict">{sl.verdict}</div>}
            {sl.chips && (
              <div className="rc-chips">
                {sl.chips.map(([k, v]) => (
                  <div key={k} className="rc-chip">
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            )}
            {sl.body && (
              <div className="rc-body">
                {sl.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
            <div className="rc-foot">
              <span className="rc-brand">◆ StockWise</span>
              <span>{cur.s} · {cur.n}</span>
              <span>{dateLabel}</span>
            </div>
          </div>
          <button className="rc-arrow" onClick={next}>›</button>
        </div>

        {/* Dot nav — one per slide, active dot expands + uses accent color */}
        <div className="rc-dots">
          {slides.map((s, i) => (
            <button
              key={i}
              className={`rc-dot${i === rcSlide ? " on" : ""}`}
              style={i === rcSlide ? { background: s.accent } : {}}
              onClick={() => setRcSlide(i)}
            />
          ))}
        </div>
        <div className="rc-hint">tap card or use ‹ › · swipe on mobile · {N_SLIDES} cards</div>
      </div>
    </div>
  );
}

// ---- Utilities ----
function heatColor(v: number): string {
  const a = Math.min(Math.abs(v) / 2.2, 1);
  if (v >= 0) return `rgba(47,230,166,${(0.15 + a * 0.6).toFixed(2)})`;
  return `rgba(255,84,112,${(0.15 + a * 0.6).toFixed(2)})`;
}

const DL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const STAR_SVG = (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
  </svg>
);

// ---- Main screen ----
export function RecapScreen() {
  const router = useRouter();
  const { openStock, openSector } = useIQActions();
  const [activeTab, setActiveTab] = useState(0);
  const [recapPage, setRecapPage] = useState(0);
  const [drawer, setDrawer] = useState<"earn-movers" | "internals" | null>(null);

  const rcPicks = movers.filter(m => m.c).slice(0, 6);
  const pageStart = recapPage * SEC_PAGE;
  const pageSectors = sectorList.slice(pageStart, pageStart + SEC_PAGE);

  function downloadRecap(which: string) {
    const blob = new Blob([`StockWise ${which} Recap — ${recap.date}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `StockWise-Recap-${which}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Reusable cards ----

  const SectorHeatCard = (paginated: boolean, weeklyScale: boolean) => (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-h">
        <h3>{weeklyScale ? "Sector heatmap · weekly performance" : "Sector heatmap"}</h3>
        <span className="link" onClick={() => router.push("/menu/heatmap")}>View all →</span>
      </div>
      <div className="card-b">
        <div className="heat">
          {pageSectors.map(s => (
            <div key={s.name} className="s"
              style={{ background: heatColor(weeklyScale ? s.chg * 5 : s.chg), cursor: "pointer" }}
              onClick={() => openSector(s.name)}>
              <div className="nm">{s.name}</div>
              <div className="v">{weeklyScale ? `${arr(s.chg)}${sign(s.chg)}` : sign(s.chg)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9, fontSize: ".74rem" }}>
          <span style={{ color: "var(--text-dim-solid)" }}>
            Sectors {pageStart + 1}–{Math.min(pageStart + SEC_PAGE, sectorList.length)} of {sectorList.length} · click one to open it in the heatmap
          </span>
          <span style={{ display: "flex", gap: 14 }}>
            {recapPage > 0 && (
              <span className="link" onClick={() => setRecapPage(p => p - 1)}>← Previous 10</span>
            )}
            <span className="link" onClick={() => setRecapPage(p => (p + 1) % SEC_PAGES)}>
              {recapPage < SEC_PAGES - 1 ? "Show next 10 →" : "Back to first 10 ↺"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );

  const BottomDash = (
    <div className="dash" style={{ marginTop: 14, padding: "0 0 14px" }}>
      <div className="col-6">
        <div className="card">
          <div className="card-h">
            <h3>Biggest earnings movers</h3>
            <button className="link" onClick={() => router.push("/menu/earnings")}>View all →</button>
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
            <button className="link" onClick={() => router.push("/menu/movers")}>View all →</button>
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
  );

  return (
    <>
      {/* ── Page head ── */}
      <div className="page-head">
        <div>
          <div className="eyebrow">Recaps</div>
          <h1 className="page-title">{activeTab === 1 ? "Weekly Recap" : "End-of-Day Recap"}</h1>
          <div className="page-sub">
            {activeTab === 1
              ? `${WEEKLY.range} · ${WEEKLY.subtitle}`
              : `${recap.date} · ${recap.subtitle}`}
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " active" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Today (EOD) ── */}
      {activeTab === 0 && (
        <div style={{ padding: "14px 18px 18px" }}>
          <div className="rcp-idx">
            {pulse.map((x, i) => (
              <div key={x.l} className="rcp-box">
                <div className="rcp-bl">{x.l}</div>
                <div className="rcp-bv">{fmt(x.v, x.v > 1000 ? 0 : 2)}</div>
                <div className={`rcp-bc ${cls(x.c)}`}>{arr(x.c)} {sign(x.c)}</div>
                <div className="rcp-bs"><Spark seed={i + 1} up={x.c >= 0} w={96} h={26} /></div>
              </div>
            ))}
          </div>

          <RcpCarousel picks={rcPicks} label="Today" dateLabel={recap.date} />

          <div className="recap-hero">
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <div className="wmn-orb">{STAR_SVG}</div>
              <div onClick={() => downloadRecap("today")}
                title="Open the full executive summary (PDF)"
                style={{ cursor: "pointer", fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>
                {recap.headline}{" "}
                <span style={{ fontSize: ".7rem", color: "var(--brand-2)", fontWeight: 600 }}>→ open PDF</span>
              </div>
            </div>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>
                DOWNLOAD PDF:
              </span>
              <button className="btn" onClick={() => downloadRecap("today")}>{DL_ICON} Today (EOD)</button>
              <button className="btn" onClick={() => downloadRecap("yesterday")}>{DL_ICON} Yesterday</button>
              <button className="btn" onClick={() => downloadRecap("week")}>{DL_ICON} Last week</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="eyebrow">Key stories</div>
                  <span className="link" onClick={() => router.push("/menu/commentary")}>View all →</span>
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
                  <span className="link" onClick={() => router.push("/menu/macro")}>View all →</span>
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


          {SectorHeatCard(true, false)}
          {BottomDash}
        </div>
      )}

      {/* ── This Week ── */}
      {activeTab === 1 && (
        <div style={{ padding: "14px 18px 18px" }}>
          <div className="rcp-idx">
            {pulse.map((x, i) => (
              <div key={x.l} className="rcp-box">
                <div className="rcp-bl">{x.l}</div>
                <div className="rcp-bv">{fmt(x.v, x.v > 1000 ? 0 : 2)}</div>
                <div className={`rcp-bc ${cls(x.c)}`}>{arr(x.c)} {sign(x.c)}</div>
                <div className="rcp-bs"><Spark seed={i + 1} up={x.c >= 0} w={96} h={26} /></div>
              </div>
            ))}
          </div>

          <RcpCarousel picks={rcPicks} label="This week" dateLabel={`Week of ${WEEKLY.range}`} />

          <div className="recap-hero">
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <div className="wmn-orb">{STAR_SVG}</div>
              <div onClick={() => downloadRecap("this-week")}
                title="Open the full executive summary (PDF)"
                style={{ cursor: "pointer", fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>
                {WEEKLY.headline}{" "}
                <span style={{ fontSize: ".7rem", color: "var(--brand-2)", fontWeight: 600 }}>→ open PDF</span>
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
              <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>
                DOWNLOAD PDF:
              </span>
              <button className="btn" onClick={() => downloadRecap("this-week")}>{DL_ICON} This Week</button>
              <button className="btn" onClick={() => downloadRecap("last-week")}>{DL_ICON} Last Week</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="eyebrow">Key stories</div>
                  <span className="link" onClick={() => router.push("/menu/commentary")}>View all →</span>
                </div>
                {WEEKLY.stories.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: ".84rem" }}>
                    <span className="bullet" style={{ marginTop: 6, flexShrink: 0 }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="eyebrow">Up next · next week</div>
                  <span className="link" onClick={() => router.push("/menu/macro")}>View all →</span>
                </div>
                {WEEKLY.nextWeek.map((t, i) => (
                  <div key={i} className="minirow">
                    <span className="mono" style={{ width: 36, color: "var(--warn)" }}>{t.time}</span>
                    <span className="mid">{t.ev}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dash" style={{ marginTop: 14, padding: 0 }}>
            <div className="col-6">
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
            <div className="col-6">
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
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>Biggest movers this week</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>5-day</span>
            </div>
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


          {SectorHeatCard(true, true)}
          {BottomDash}
        </div>
      )}

      {/* ── Sliding drawer ── */}
      {drawer && (
        <>
          <div className="scrim" onClick={() => setDrawer(null)} />
          <div className="side-drawer">
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div className="drawer-title">
                  {drawer === "earn-movers" ? "Biggest Earnings Movers" : "Market Internals"}
                </div>
                <div className="drawer-sub">
                  {drawer === "earn-movers"
                    ? "Post-earnings reactions ranked by magnitude"
                    : "Breadth, volume & sentiment indicators"}
                </div>
              </div>
              <button className="closebtn" onClick={() => setDrawer(null)}>✕</button>
            </div>
            <div className="drawer-b">
              {drawer === "earn-movers" && (
                <>
                  {recap.movers.map(m => (
                    <div key={m.s} className="minirow" style={{ cursor: "pointer", padding: "8px 0" }}
                      onClick={() => { openStock(m.s); setDrawer(null); }}>
                      <StockLogo sym={m.s} size={22} />
                      <span className="tkr">{m.s}</span>
                      <span className="mid">{m.reason}</span>
                      <span className={`r mono ${cls(m.c)}`} style={{ fontWeight: 700 }}>{sign(m.c)}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: "var(--border)", margin: "12px 0 10px" }} />
                  <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                    Full earnings calendar · reported reactions
                  </div>
                  {[...earnings]
                    .filter(e => e.react !== null)
                    .sort((a, b) => Math.abs(b.react!) - Math.abs(a.react!))
                    .map(e => (
                      <div key={e.s} className="minirow" style={{ cursor: "pointer", padding: "8px 0" }}
                        onClick={() => { openStock(e.s); setDrawer(null); }}>
                        <StockLogo sym={e.s} size={22} />
                        <span className="tkr">{e.s}<small>{e.n}</small></span>
                        <span className="mid">
                          <span className={`pill ${e.react! >= 0 ? "beat" : "miss"}`}>
                            {e.react! >= 0 ? "Beat" : "Miss"}
                          </span>
                          {e.guide && e.guide !== "In-line" && (
                            <span className={`pill ${e.guide === "Raised" ? "beat" : "miss"}`} style={{ marginLeft: 4 }}>
                              {e.guide}
                            </span>
                          )}
                          <span style={{ marginLeft: 6, fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                            EPS ${e.epsE} → ${e.epsA}
                          </span>
                        </span>
                        <span className={`r mono ${e.react! >= 0 ? "up" : "down"}`} style={{ fontWeight: 700 }}>
                          {e.react! >= 0 ? "+" : ""}{e.react}%
                        </span>
                      </div>
                    ))}
                </>
              )}
              {drawer === "internals" && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", marginBottom: 6 }}>
                      <span className="up mono" style={{ fontWeight: 700 }}>▲ 2,810 advancing</span>
                      <span className="down mono" style={{ fontWeight: 700 }}>▼ 1,140 declining</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "71%", background: "var(--up)", borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
                      A/D Ratio: 2.47 · NYSE + NASDAQ composite
                    </div>
                  </div>
                  {recap.internals.map(r => (
                    <div key={r.l} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", marginBottom: 6,
                      background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 10,
                    }}>
                      <span style={{ fontSize: ".82rem", color: "var(--text)" }}>{r.l}</span>
                      <span className={`mono ${r.c > 0 ? "up" : r.c < 0 ? "down" : ""}`}
                        style={{ fontWeight: 700, fontSize: ".9rem" }}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: "var(--border)", margin: "12px 0 10px" }} />
                  <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                    Extended breadth data
                  </div>
                  {[
                    { l: "NYSE TICK",      v: "+420",  c:  1 },
                    { l: "TRIN (Arms)",    v: "0.74",  c:  1 },
                    { l: "McClellan Osc",  v: "+38.5", c:  1 },
                    { l: "Put/Call Ratio", v: "0.82",  c:  0 },
                    { l: "New 52W Highs",  v: "184",   c:  1 },
                    { l: "New 52W Lows",   v: "39",    c: -1 },
                  ].map(r => (
                    <div key={r.l} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", marginBottom: 6,
                      background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 10,
                    }}>
                      <span style={{ fontSize: ".82rem", color: "var(--text)" }}>{r.l}</span>
                      <span className={`mono ${r.c > 0 ? "up" : r.c < 0 ? "down" : ""}`}
                        style={{ fontWeight: 700, fontSize: ".9rem" }}>{r.v}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
