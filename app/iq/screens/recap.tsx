"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIQActions } from "../shell";
import { recap, sectorList, pulse, movers } from "../data";
import { cls, arr, sign, fmt, Spark, StockLogo } from "../utils";

const SEC_PAGE = 10;
const SEC_PAGES = Math.ceil(sectorList.length / SEC_PAGE);

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
  const a = Math.min(Math.abs(v) / 2.2, 1);
  if (v >= 0) return `rgba(47,230,166,${(0.15 + a * 0.6).toFixed(2)})`;
  return `rgba(255,84,112,${(0.15 + a * 0.6).toFixed(2)})`;
}

const DL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function RecapStoryCard({ s, n, c, cat, idx, period }: {
  s: string; n: string; c: number; cat: string; idx: number; period: string;
}) {
  const up = c >= 0;
  const col = up ? "#22d39a" : "#ff5d7a";
  const bg1 = up ? "#0d2c20" : "#2c0d18";
  const gid = `rcpg${idx}${period.replace(/\s/g, "")}`;
  const PTS = 18;
  const pts: [number, number][] = [];
  let v = 190;
  const seed = s.charCodeAt(0) * 7 + (s.charCodeAt(1) || 3);
  for (let k = 0; k < PTS; k++) {
    v += Math.sin(seed + k * 0.9) * 2.2 + (up ? k * 0.55 : -k * 0.55);
    v = Math.max(152, Math.min(238, v));
    pts.push([20 + k * (240 / (PTS - 1)), v]);
  }
  const dd = pts.map((p, k) => `${k === 0 ? "M" : "L"}${p[0].toFixed(0)} ${p[1].toFixed(0)}`).join(" ");
  return (
    <div className="rcp-card-wrap">
      <svg viewBox="0 0 280 380" width="200" height="272"
        style={{ display: "block", borderRadius: 20, boxShadow: "0 14px 40px rgba(0,0,0,.42)" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor={bg1} />
            <stop offset="1" stopColor="#0a0f1c" />
          </linearGradient>
        </defs>
        <rect width="280" height="380" rx="20" fill={`url(#${gid})`} />
        <rect x="1" y="1" width="278" height="378" rx="19" fill="none" stroke="rgba(255,255,255,.09)" />
        <text x="22" y="36" fill="#9fb0c3" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">StockWise · {period}</text>
        <text x="258" y="36" textAnchor="end" fill="#6b7a8d" fontSize="10" fontFamily="Inter,sans-serif">Jun 2026</text>
        <text x="20" y="116" fill="#fff" fontSize="50" fontWeight="800" fontFamily="Space Grotesk,sans-serif">{s}</text>
        <text x="22" y="140" fill="#9fe9c9" fontSize="13" fontFamily="Inter,sans-serif">{n}</text>
        <text x="20" y="214" fill={col} fontSize="52" fontWeight="800" fontFamily="Space Grotesk,sans-serif">{sign(c)}</text>
        <text x="22" y="240" fill="#d7e0ea" fontSize="13" fontWeight="600" fontFamily="Inter,sans-serif">{cat}</text>
        <path d={dd} fill="none" stroke={col} strokeWidth="2.4" strokeLinejoin="round" opacity="0.92" />
        <text x="22" y="362" fill="#6b7a8d" fontSize="10" fontFamily="Inter,sans-serif">Tap for news · illustrative</text>
      </svg>
    </div>
  );
}

export function RecapScreen() {
  const router = useRouter();
  const { openStock, openSector } = useIQActions();
  const [activeTab, setActiveTab] = useState(0);
  const [recapPage, setRecapPage] = useState(0);
  const storiesRef = useRef<HTMLDivElement>(null);

  const moversMap = Object.fromEntries(movers.map(m => [m.s, m]));
  const eodStories = [...movers].sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 6);
  const weekStories = WEEKLY.biggestMoves.map(m => ({
    s: m.s, n: moversMap[m.s]?.n ?? m.s, c: m.c, cat: m.reason,
  }));

  function scrollStories(dir: number) {
    storiesRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  function downloadRecap(which: string) {
    const blob = new Blob([`InvestIQ ${which} Recap — ${recap.date}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `InvestIQ-Recap-${which}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageStart = recapPage * SEC_PAGE;
  const pageSectors = sectorList.slice(pageStart, pageStart + SEC_PAGE);

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
          {/* Index boxes */}
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

          {/* Story slides */}
          <div className="rcp-stories-wrap">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="eyebrow">Today · story slides</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>click a slide for its news</span>
                <button className="rcp-arrow" onClick={() => scrollStories(-1)}>‹</button>
                <button className="rcp-arrow" onClick={() => scrollStories(1)}>›</button>
              </div>
            </div>
            <div className="rcp-stories" ref={storiesRef}>
              {eodStories.map((m, i) => (
                <RecapStoryCard key={m.s} s={m.s} n={m.n} c={m.c} cat={m.cat} idx={i} period="Today" />
              ))}
            </div>
          </div>

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

            {/* Index performance */}
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

            {/* Download PDF */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>
                DOWNLOAD PDF:
              </span>
              <button className="btn" onClick={() => downloadRecap("today")}>{DL_ICON} Today (EOD)</button>
              <button className="btn" onClick={() => downloadRecap("yesterday")}>{DL_ICON} Yesterday</button>
              <button className="btn" onClick={() => downloadRecap("week")}>{DL_ICON} Last week</button>
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

          {/* Sector heatmap with pagination */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>Sector heatmap</h3>
              <span className="link" onClick={() => router.push("/menu/heatmap")}>View all →</span>
            </div>
            <div className="card-b">
              <div className="heat">
                {pageSectors.map(s => (
                  <div key={s.name} className="s" style={{ background: heatColor(s.chg), cursor: "pointer" }}
                    onClick={() => openSector(s.name)}>
                    <div className="nm">{s.name}</div>
                    <div className="v">{sign(s.chg)}</div>
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

          {/* Schedule & share */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3>Schedule &amp; share this recap</h3>
                <span className="pill" style={{ background: "var(--brand-dim)", color: "var(--brand-2)" }}>Pro</span>
              </div>
            </div>
            <div className="card-b" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select className="iq-select" style={{ width: 140 }}>
                <option>Daily EOD</option>
                <option>Weekdays</option>
                <option>Weekly Fri</option>
              </select>
              <select className="iq-select" style={{ width: 130 }}>
                <option>4:30 PM ET</option>
                <option>5:00 PM ET</option>
                <option>6:00 PM ET</option>
              </select>
              <input className="iq-input" type="email" placeholder="Email address…" style={{ width: 200 }} />
              <button className="btn">Schedule email</button>
              <button className="btn">{DL_ICON} Download now</button>
            </div>
          </div>

          {/* Biggest earnings movers + Market internals */}
          <div className="dash" style={{ marginTop: 14, padding: "0 0 14px" }}>
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
        </div>
      )}

      {/* ── This Week ── */}
      {activeTab === 1 && (
        <div style={{ padding: "14px 18px 18px" }}>
          {/* Index boxes */}
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

          {/* Story slides */}
          <div className="rcp-stories-wrap">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="eyebrow">This week · story slides</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>click a slide for its news</span>
                <button className="rcp-arrow" onClick={() => scrollStories(-1)}>‹</button>
                <button className="rcp-arrow" onClick={() => scrollStories(1)}>›</button>
              </div>
            </div>
            <div className="rcp-stories" ref={storiesRef}>
              {weekStories.map((m, i) => (
                <RecapStoryCard key={m.s} s={m.s} n={m.n} c={m.c} cat={m.cat} idx={i + 10} period="This week" />
              ))}
            </div>
          </div>

          {/* Hero */}
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
              <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>
                DOWNLOAD PDF:
              </span>
              <button className="btn" onClick={() => downloadRecap("this-week")}>{DL_ICON} This Week</button>
              <button className="btn" onClick={() => downloadRecap("last-week")}>{DL_ICON} Last Week</button>
            </div>
          </div>

          <div className="dash" style={{ marginTop: 14, padding: "0 0 14px" }}>
            {/* Top stories */}
            <div className="col-6">
              <div className="card">
                <div className="card-h"><h3>Top stories this week</h3></div>
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
                <div className="card-h"><h3>What to watch next week</h3></div>
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

          <div className="dash" style={{ marginTop: 14, padding: "0 0 14px" }}>
            {/* Sector leaders */}
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
            {/* Sector laggards */}
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
            {/* Biggest weekly movers */}
            <div className="col-4">
              <div className="card">
                <div className="card-h">
                  <h3>Biggest movers</h3>
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
            </div>
          </div>

          {/* Weekly sector heatmap with pagination */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>Sector heatmap · weekly performance</h3>
              <span className="link" onClick={() => router.push("/menu/heatmap")}>View all →</span>
            </div>
            <div className="card-b">
              <div className="heat">
                {pageSectors.map(s => (
                  <div key={s.name} className="s" style={{ background: heatColor(s.chg * 5), cursor: "pointer" }}
                    onClick={() => openSector(s.name)}>
                    <div className="nm">{s.name}</div>
                    <div className="v">{arr(s.chg)}{sign(s.chg)}</div>
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
        </div>
      )}
    </>
  );
}
