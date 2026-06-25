"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoginForm } from "./auth/login/login-form";
import { pulse, wmn, movers, earnings, analyst, folio, sectorList, recap } from "./iq/data";
import { fmt, sign, cls, heatCol, StockLogo } from "./iq/utils";

// ---- Workspace thumbnail components ----
// Renders at 340×444 px inside .mq-shot; uses iq.css classes + actual data.

function TH({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--surface-0)", color: "var(--text)", fontSize: 12, fontFamily: "var(--f-body,'Inter',sans-serif)" }}>
      {children}
    </div>
  );
}

function THHead({ label, right, col }: { label: string; right: string; col?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", background: "rgba(12,16,23,.96)", flexShrink: 0 }}>
      <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 11, color: "var(--text-hi)", letterSpacing: ".03em" }}>{label}</span>
      <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 600, color: col ?? "var(--text-dim-solid)" }}>{right}</span>
    </div>
  );
}

function DashThumb() {
  return (
    <TH>
      <div style={{ padding: "9px 12px 6px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 9, color: "var(--text-dim-solid)", marginBottom: 3 }}>Tuesday · May 21 · 10:24 ET</div>
        <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 15, color: "var(--text-hi)" }}>Good morning</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, padding: "7px 10px" }}>
        {pulse.slice(0, 6).map(p => (
          <div key={p.l} className="p" style={{ padding: "5px 7px" }}>
            <div className="lbl" style={{ fontSize: 8 }}>{p.l}</div>
            <div className="val" style={{ fontSize: "0.85rem" }}>{p.v >= 100 ? fmt(p.v, 0) : fmt(p.v, 2)}</div>
            <div className={cls(p.c)} style={{ fontFamily: "var(--f-mono)", fontSize: 8, fontWeight: 600 }}>{sign(p.c)}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: "0 10px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}>
        <div style={{ padding: "5px 10px 4px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 10, color: "var(--text-hi)" }}>What Matters Now</span>
        </div>
        <div style={{ padding: "4px 10px 6px" }}>
          {wmn.slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 5, padding: "3px 0", borderBottom: i < 2 ? "1px solid var(--border-soft,#1a2535)" : "none", fontSize: 9 }}>
              <span style={{ color: "var(--brand)", flexShrink: 0 }}>·</span>
              <span style={{ color: "var(--text-hi)", fontWeight: 600 }}>{b.h}.</span>
            </div>
          ))}
        </div>
      </div>
    </TH>
  );
}

function MoversThumb() {
  return (
    <TH>
      <THHead label="Market Movers" right="LIVE" col="var(--up)" />
      <div style={{ display: "flex", gap: 4, padding: "6px 10px 4px" }}>
        {["All", "Large Cap", "Tech"].map((f, i) => (
          <span key={f} style={{ padding: "2px 7px", borderRadius: 999, border: `1px solid ${i === 0 ? "var(--brand)" : "var(--border)"}`, background: i === 0 ? "rgba(124,108,245,.15)" : "transparent", color: i === 0 ? "var(--brand)" : "var(--text-dim-solid)", fontSize: 8, fontFamily: "var(--f-mono)", fontWeight: 600 }}>{f}</span>
        ))}
      </div>
      <div style={{ padding: "0 10px" }}>
        {movers.map(m => (
          <div key={m.s} className="minirow">
            <StockLogo sym={m.s} size={20} />
            <span className="tkr" style={{ width: 38, fontSize: 10 }}>{m.s}</span>
            <span className="mid" style={{ fontSize: 9 }}>{m.cat}</span>
            <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
          </div>
        ))}
      </div>
    </TH>
  );
}

function StockThumb() {
  const pts = [38,42,40,45,43,48,46,50,49,54,51,56,54,59,57,62,60,64,62,66];
  const max = 66, min = 38, SH = 72, SW = 290;
  const path = pts.map((v,i) => `${i===0?"M":"L"}${(i/(pts.length-1))*SW},${SH-((v-min)/(max-min))*SH}`).join(" ");
  return (
    <TH>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StockLogo sym="NVDA" size={28} />
          <div>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 14, color: "var(--text-hi)" }}>NVDA</div>
            <div style={{ fontSize: 9, color: "var(--text-dim-solid)" }}>NVIDIA · NASDAQ</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 14, color: "var(--text-hi)" }}>$1,025</div>
            <div className="up" style={{ fontSize: 9, fontFamily: "var(--f-mono)", fontWeight: 600 }}>+8.23% today</div>
          </div>
        </div>
      </div>
      <div style={{ margin: "8px 12px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" height={SH} preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id="tsg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity=".32"/>
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={`${path} L${SW},${SH} L0,${SH} Z`} fill="url(#tsg)"/>
          <path d={path} fill="none" stroke="#22c55e" strokeWidth="1.8"/>
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, padding: "0 12px" }}>
        {[["Mkt Cap","$2.91T"],["P/E","78×"],["EPS","$13.14"],["52W H","$1,250"],["52W L","$350"],["Beta","1.72"]].map(([k,v]) => (
          <div key={k} className="p" style={{ padding: "4px 6px" }}>
            <div className="lbl" style={{ fontSize: 7 }}>{k}</div>
            <div className="val" style={{ fontSize: "0.75rem" }}>{v}</div>
          </div>
        ))}
      </div>
    </TH>
  );
}

function HeatmapThumb() {
  return (
    <TH>
      <THHead label="Market Heatmap" right="S&P 500" col="var(--ai)" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "8px 10px", alignContent: "flex-start" }}>
        {sectorList.slice(0, 14).map(s => {
          const { bg, fg } = heatCol(s.chg);
          const w = Math.abs(s.chg) > 1.5 ? 3 : Math.abs(s.chg) > 0.5 ? 2 : 1.5;
          return (
            <div key={s.name} style={{ background: bg, color: fg, borderRadius: 5, padding: "4px 5px", fontSize: 8, fontWeight: 700, flexGrow: w, flexBasis: `${w * 20}%`, minWidth: 40, fontFamily: "var(--f-mono)" }}>
              <div style={{ fontSize: 7, marginBottom: 1, opacity: .85 }}>{s.name.replace("Mega-Cap ","").replace("Cloud ","")}</div>
              <div style={{ fontSize: 9 }}>{sign(s.chg)}</div>
            </div>
          );
        })}
      </div>
    </TH>
  );
}

function EarningsThumb() {
  return (
    <TH>
      <THHead label="Earnings" right="Q2 2024 · 4 today" col="#f59e0b" />
      <div style={{ padding: "0 10px" }}>
        {earnings.map(e => (
          <div key={e.s} className="minirow">
            <StockLogo sym={e.s} size={20} />
            <span className="tkr" style={{ width: 40, fontSize: 10 }}>{e.s}</span>
            <span className="mid" style={{ fontSize: 9 }}>{e.epsA !== null ? `EPS $${e.epsA}` : `Est $${e.epsE}`}</span>
            {e.epsA !== null ? (
              <span className={`pill ${e.tags.includes("Beat") ? "beat" : "miss"}`}>{e.tags.includes("Beat") ? "Beat" : "Miss"}</span>
            ) : (
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-dim-solid)" }}>pending</span>
            )}
          </div>
        ))}
      </div>
    </TH>
  );
}

function AnalystThumb() {
  const dirIcon = (d: string) => d === "up" ? "↑" : d === "down" ? "↓" : d === "init" ? "+" : "→";
  return (
    <TH>
      <THHead label="Analyst Actions" right="★ cluster" col="var(--ai)" />
      <div style={{ padding: "0 10px" }}>
        {analyst.slice(0, 7).map((a, i) => (
          <div key={i} className="minirow">
            <span className="tkr" style={{ width: 40, fontSize: 10 }}>{a.s}</span>
            <span className="mid" style={{ fontSize: 9 }}>{a.firm}</span>
            <span className={`r ${a.dir === "down" ? "down" : "up"}`} style={{ fontSize: 9 }}>
              {dirIcon(a.dir)} {a.to}
            </span>
          </div>
        ))}
      </div>
    </TH>
  );
}

function PortfolioThumb() {
  const totalGL = folio.reduce((s, f) => s + f.c, 0) / folio.length;
  return (
    <TH>
      <THHead label="Portfolio Pulse" right={sign(totalGL) + " today"} col={totalGL >= 0 ? "var(--up)" : "var(--down)"} />
      <div style={{ padding: "8px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 18, color: "var(--text-hi)" }}>$142,843</span>
        <span className="up" style={{ fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 700 }}>+$4,218 today</span>
      </div>
      <div style={{ padding: "0 10px" }}>
        {folio.slice(0, 5).map(f => (
          <div key={f.s} className="minirow">
            <StockLogo sym={f.s} size={20} />
            <span className="tkr" style={{ width: 40, fontSize: 10 }}>{f.s}</span>
            <span className="mid" style={{ fontSize: 9 }}>{f.evt}</span>
            <span className={`r ${cls(f.c)}`}>{sign(f.c)}</span>
          </div>
        ))}
      </div>
      <div style={{ margin: "5px 10px", background: "rgba(124,108,245,.1)", border: "1px solid rgba(124,108,245,.22)", borderRadius: 7, padding: "6px 9px", fontSize: 9, color: "var(--text)", lineHeight: 1.5 }}>
        <span style={{ color: "var(--brand)", fontWeight: 700 }}>AI · </span>NVDA and META led gains. Watch TSLA drag on margin concerns.
      </div>
    </TH>
  );
}

function RecapsThumb() {
  const sections = ["What Happened","Why It Moved","Technicals","Macro View","AI Verdict"];
  return (
    <TH>
      <THHead label="Recaps" right="NVDA · May 21" col="#f59e0b" />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative", height: 158 }}>
          {sections.map((label, i) => (
            <div key={label} style={{
              position: "absolute", left: `${i * 9}px`, right: 0, top: `${i * 8}px`,
              background: i === 0 ? "var(--surface-1)" : "var(--surface-0)",
              border: `1px solid ${i === 0 ? "var(--brand)" : "var(--border)"}`,
              borderRadius: 10, padding: "9px 11px",
              opacity: 1 - i * 0.16, zIndex: sections.length - i,
            }}>
              <div style={{ fontFamily: "var(--f-mono)", color: i === 0 ? "var(--brand)" : "var(--text-dim-solid)", fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: i === 0 ? 5 : 0 }}>{label}</div>
              {i === 0 && <div style={{ fontSize: 9, color: "var(--text)", lineHeight: 1.55 }}>{recap.stories[0]}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {sections.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === 0 ? "var(--brand)" : "var(--border)" }}/>
          ))}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-dim-solid)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {recap.indices.map(idx => (
            <span key={idx.l}><span className={cls(idx.v)}>{sign(idx.v)}</span>{" "}<span style={{ fontSize: 8 }}>{idx.l}</span></span>
          ))}
        </div>
      </div>
    </TH>
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

  function openAuth(mode: "signup" | "login") {
    setGlanceIdx(null);
    setAuthMode(mode);
    setAuthOpen(true);
  }

  const glanceWs = glanceIdx !== null ? WS_LIST[glanceIdx] : null;

  return (
    <div className="lp-root mq-root">
      <div className="sp-grid" />
      <div className="sp-aurora">
        <i className="a1" /><i className="a2" /><i className="a3" />
      </div>

      <div className="hw">

        {/* ---- NAV ---- */}
        <nav className="hw-nav">
          <Link href="/" className="hw-brand">
            <span className="hw-logo"><LogoMark /></span>
            Stock<b>Wise</b>
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
                  <div className="mq-more-plus">14+</div>
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
                Stock<b>Wise</b>
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
                  <button className="au-google"><GoogleIcon />Continue with Google</button>
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
  );
}
