"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginForm } from "./auth/login/login-form";

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const TABS = [
  {
    slug: "dashboard",
    label: "Dashboard",
    desc: "Your morning brief — indices, What Matters Now, and every workspace at a glance.",
    d: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  },
  {
    slug: "earnings",
    label: "Earnings",
    desc: "An Earnings-Hub-style calendar with logos, 10-quarter history and income statements.",
    d: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4",
  },
  {
    slug: "movers",
    label: "Market Movers",
    desc: "Top 15 winners & losers with catalysts, sector / market-cap filters and hover reasons.",
    d: "M3 17l5-5 4 3 7-9M16 6h6v6",
  },
  {
    slug: "heatmap",
    label: "Market Heatmap",
    desc: "The whole market by sector and size, colored by performance.",
    d: "M3 4h7v7H3zM13 4h8v4h-8zM13 10h8v11h-8zM3 13h7v8H3z",
  },
  {
    slug: "analyst",
    label: "Analyst Actions",
    desc: "Upgrades, downgrades and price targets — with 5+ action cluster detection.",
    d: "M12 3l2.5 6.5L21 10l-5 4.5L17.5 21 12 17l-5.5 4L8 14.5 3 10l6.5-.5z",
  },
  {
    slug: "screener",
    label: "Screener",
    desc: "Fundamental + technical filters with ready-made preset screens.",
    d: "M3 4h18l-7 8v6l-4 2v-8z",
  },
  {
    slug: "ipos",
    label: "IPOs",
    desc: "Recent IPO performance since the offer price, plus the upcoming pipeline.",
    d: "M4 18l6-6 4 3 6-9M16 6h6v5",
  },
  {
    slug: "portfolio",
    label: "Portfolio Pulse",
    desc: "An AI summary of your book — drivers, leaders, laggards and day P/L.",
    d: "M12 3v9h9a9 9 0 11-9-9z",
  },
  {
    slug: "watchlist",
    label: "Watchlist",
    desc: "AI-parsed names with price & analyst alerts and EOD / EOW summaries.",
    d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6",
  },
  {
    slug: "stock",
    label: "Stock Detail",
    desc: "Interactive chart, fundamentals, ratings and an AI read — all on one page.",
    d: "M6 4v16M18 4v16M10 9h4v6h-4z",
  },
  {
    slug: "insider",
    label: "Insider & Institutional",
    desc: "Form 4 insider flows and 13F fund positioning, side by side.",
    d: "M16 8a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0",
  },
  {
    slug: "commentary",
    label: "Commentary",
    desc: "A live, Briefing-style stream of market-moving headlines.",
    d: "M4 5h16v11H8l-4 4z",
  },
  {
    slug: "recap",
    label: "Recaps",
    desc: "Executive end-of-day recaps you can read, download or schedule by email.",
    d: "M6 3h9l4 4v14H6zM8 9h8M8 13h8M8 17h5",
  },
  {
    slug: "macro",
    label: "Macro & VIX",
    desc: "Rates, the economic calendar, the VIX regime and the dividend calendar.",
    d: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18",
  },
];

const s = (obj: Record<string, string | number>) => obj as React.CSSProperties;

const Row = ({ sym, chg, up }: { sym: string; chg: string; up: boolean }) => (
  <div style={s({ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid var(--border)" })}>
    <span style={s({ fontWeight:700, color:"var(--text-hi)", fontSize:".82rem" })}>{sym}</span>
    <span style={s({ color: up ? "var(--up)" : "var(--down)", fontWeight:700, fontSize:".82rem" })}>
      {up ? "▲" : "▼"} {chg}
    </span>
  </div>
);

const FrameChrome = () => (
  <div className="hw-chrome">
    <i /><i /><i />
    <span className="hw-url">app.stockwise.com</span>
  </div>
);

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

  // close modal on Escape key
  useEffect(() => {
    if (!showLogin) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowLogin(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showLogin]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="lp-root">
      <div className="sp-grid" />

      <div className="hw">
        {/* ── NAVBAR ── */}
        <nav className="hw-nav">
          <Link href="/" className="hw-brand">
            <span className="hw-logo">
              <svg viewBox="0 0 24 24" width={17} height={17} fill="none">
                <path d="M3 17l5-6 4 4 6-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="5.5" r="2.4" fill="#fff" />
              </svg>
            </span>
            Stock<b>Wise</b>
          </Link>

          <div className="hw-nav-links">
            <Link href="#steps">How it works</Link>
            <Link href="/menu/screener">Features</Link>
            <Link href="/menu/macro">Markets</Link>
            <Link href="/menu/recap">Recaps</Link>
          </div>

          <div className="hw-nav-cta">
            <button className="hw-ghost" onClick={() => setShowLogin(true)}>Log in</button>
            <Link href="/auth/signup" className="hw-solid">Sign up</Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <div className="hw-hero">
          <div className="reveal">
            <div className="hw-eyebrow">Your research journey</div>
            <h1 className="hw-h1">From <span className="g">ticker to thesis</span> in under 60 seconds</h1>
            <p className="hw-sub">
              This is what StockWise feels like. You spot what is moving, open the full picture, check the context, see the signals line up — and make an informed call. Here is the journey, step by step.
            </p>
            <div className="hw-cta">
              <button className="hw-btn-lg hw-btn-primary" onClick={() => setShowLogin(true)}>Open the research terminal →</button>
              <a href="#steps" className="hw-btn-lg hw-btn-ghost">See the journey ↓</a>
            </div>
          </div>

          <div className="reveal" style={{ transitionDelay: ".12s" }}>
            <div className="hw-frame">
              <FrameChrome />
              <div className="hw-body">
                <div style={s({ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" })}>
                  <span style={s({ width:"22px", height:"22px", borderRadius:"6px", background:"linear-gradient(135deg,var(--brand),var(--ai))", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:".72rem" })}>◆</span>
                  <b style={s({ color:"var(--text-hi)", fontSize:".9rem" })}>What Matters Now</b>
                  <span style={s({ marginLeft:"auto", fontSize:".6rem", color:"var(--ai)", fontWeight:700 })}>● LIVE</span>
                </div>
                <div style={s({ fontSize:".8rem", color:"var(--text)", lineHeight:"1.55", marginBottom:"12px" })}>
                  Cooler CPI lifted rate-cut hopes and semis led the tape. <b style={s({ color:"var(--text-hi)" })}>NVDA</b>&apos;s beat-and-raise powered a <b style={s({ color:"var(--up)" })}>+3%</b> rally across chips.
                </div>
                <Row sym="ZIM" chg="+9.97%" up />
                <Row sym="NVDA" chg="+8.23%" up />
                <Row sym="PLTR" chg="+6.18%" up />
                <Row sym="WBA" chg="-5.80%" up={false} />
                <div style={s({ marginTop:"10px", display:"flex", gap:"6px", flexWrap:"wrap" })}>
                  <span className="pill ai">AI parsed</span>
                  <span className="pill up">Breadth 78%</span>
                  <span className="pill" style={s({ background:"var(--surface-3)", color:"var(--text-dim-solid)" })}>VIX 14.2</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── COMMITMENT ── */}
        <div className="hw-commit reveal">
          <div className="hw-commit-badge">◆ The StockWise commitment</div>
          <h2 className="hw-commit-h">AI in every view · one terminal, everything under one roof</h2>
          <div className="hw-commit-grid">
            <div className="hw-commit-card">
              <div className="hw-ic">◆</div>
              <h3>AI context, everywhere</h3>
              <p>Every screen carries an AI read in the same voice — earnings, movers, analyst actions, your portfolio. Hover any ticker and StockWise explains <i>why it is there</i> in the context of that view. Not a black box: the reasoning sits next to the number, in plain language.</p>
            </div>
            <div className="hw-commit-card">
              <div className="hw-ic">▣</div>
              <h3>One unified experience, under one roof</h3>
              <p>Earnings, movers, screening, analyst calls, insider &amp; 13F flows, macro, your portfolio and watchlist all share one design system and one data layer. No switching between five tools — research a name from headline to thesis without ever leaving StockWise.</p>
            </div>
          </div>
        </div>

        {/* ── 5-STEP JOURNEY ── */}
        <div className="hw-steps" id="steps">

          {/* Step 1 */}
          <div className="hw-step reveal">
            <div className="hw-step-txt">
              <div className="hw-stepnum"><b>1</b><span>Step 1 · The Signal</span></div>
              <h2 className="hw-h2">You spot what is moving — and why</h2>
              <p className="hw-p">You open StockWise. Winners &amp; Losers is live: the top 15 gainers and losers, with relative volume and a one-line catalyst on every name.</p>
              <p className="hw-p">A name jumps out — heavy volume, a clean breakout. Hover the catalyst and a Technical vs News popover tells you the story before you even click.</p>
              <div className="hw-feat">{CHECK}<span><b>Sector &amp; market-cap filters</b> cut the list to exactly what you trade.</span></div>
              <div className="hw-feat">{CHECK}<span><b>Hover reasons</b> — technical posture and the news behind the move.</span></div>
              <Link href="/menu/movers" className="hw-link">Explore Market Movers →</Link>
            </div>
            <div className="hw-step-img">
              <div className="hw-frame">
                <FrameChrome />
                <div className="hw-body">
                  <div style={s({ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" })}>
                    <b style={s({ color:"var(--text-hi)", fontSize:".86rem" })}>Winners &amp; Losers · Top Gainers</b>
                    <span className="pill" style={s({ background:"var(--surface-3)", color:"var(--text-dim-solid)" })}>Semis 3</span>
                  </div>
                  <Row sym="ZIM"  chg="+9.97%" up />
                  <Row sym="NVDA" chg="+8.23%" up />
                  <Row sym="PLTR" chg="+6.18%" up />
                  <Row sym="SMCI" chg="+5.60%" up />
                  <Row sym="CRM"  chg="+4.21%" up />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 (reversed) */}
          <div className="hw-step rev reveal">
            <div className="hw-step-img">
              <div className="hw-frame">
                <FrameChrome />
                <div className="hw-body">
                  <div style={s({ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"8px" })}>
                    <b style={s({ color:"var(--text-hi)", fontSize:".95rem" })}>NVDA <span style={s({ color:"var(--text-dim-solid)", fontWeight:500, fontSize:".78rem" })}>NVIDIA Corp</span></b>
                    <span style={s({ color:"var(--up)", fontWeight:700, fontSize:".82rem" })}>▲ +8.23%</span>
                  </div>
                  <svg viewBox="0 0 320 90" style={{ width:"100%", height:"78px" }}>
                    <defs>
                      <linearGradient id="hwA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#34E2F0" stopOpacity=".34" />
                        <stop offset="1" stopColor="#34E2F0" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 70 L40 64 L80 66 L120 52 L160 46 L200 34 L240 30 L280 18 L320 12 L320 90 L0 90 Z" fill="url(#hwA)" />
                    <path d="M0 70 L40 64 L80 66 L120 52 L160 46 L200 34 L240 30 L280 18 L320 12" fill="none" stroke="#34E2F0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={s({ marginTop:"8px", fontSize:".78rem", color:"var(--text)", lineHeight:"1.5" })}>
                    <b style={s({ color:"var(--ai)" })}>◆ AI read:</b> Beat-and-raise; guidance raised. 6 analyst actions in 30d. Above 50/200-DMA, RS 88.
                  </div>
                  <div style={s({ marginTop:"9px", display:"flex", gap:"6px" })}>
                    <span className="pill up">Strong Buy 28</span>
                    <span className="pill hold">Hold 4</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hw-step-txt">
              <div className="hw-stepnum"><b>2</b><span>Step 2 · The Deep Dive</span></div>
              <h2 className="hw-h2">One click opens the full Stock Detail</h2>
              <p className="hw-p">Click any ticker — anywhere, or from search — and the full Stock Detail page opens in the workspace. No side pop-up, no tool-switching.</p>
              <p className="hw-p">Interactive candles, moving averages and RSI sit beside an AI read that ties together fundamentals, technicals and analyst posture.</p>
              <div className="hw-feat">{CHECK}<span><b>Right-click the chart</b> to log a purchase price or a trading decision.</span></div>
              <div className="hw-feat">{CHECK}<span><b>AI read</b> explains what is driving the stock and what to watch.</span></div>
              <Link href="/menu/stock" className="hw-link">Open a Stock Detail →</Link>
            </div>
          </div>

          {/* Step 3 */}
          <div className="hw-step reveal">
            <div className="hw-step-txt">
              <div className="hw-stepnum"><b>3</b><span>Step 3 · The Context</span></div>
              <h2 className="hw-h2">Earnings, 10-quarter history &amp; financials</h2>
              <p className="hw-p">Switch to the Earnings calendar — an Earnings-Hub-style week grid with company logos, split before-open and after-close across every range.</p>
              <p className="hw-p">Select a company and its history opens right below: 10 quarters of EPS and post-print moves, plus a Google-Finance-style income statement.</p>
              <div className="hw-feat">{CHECK}<span><b>Beat/miss track record</b> at a glance — surprises and stock reactions.</span></div>
              <div className="hw-feat">{CHECK}<span><b>Income statement</b> — revenue through diluted EPS, quarter by quarter.</span></div>
              <Link href="/menu/earnings" className="hw-link">Explore Earnings →</Link>
            </div>
            <div className="hw-step-img">
              <div className="hw-frame">
                <FrameChrome />
                <div className="hw-body">
                  <b style={s({ color:"var(--text-hi)", fontSize:".86rem" })}>NVDA · Income statement</b>
                  <div style={s({ marginTop:"8px" })}>
                    {[
                      { k:"Revenue",         v:"$58.2B", bold:true },
                      { k:"Gross profit",    v:"$26.2B", bold:false },
                      { k:"Operating income",v:"$13.4B", bold:true },
                      { k:"Diluted EPS",     v:"$4.46",  bold:false },
                    ].map(({ k, v, bold }, i) => (
                      <div key={i} style={s({ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none", fontSize:".8rem" })}>
                        <span style={s({ color: bold ? "var(--text-hi)" : "var(--text-dim-solid)", fontWeight: bold ? 700 : 400 })}>{k}</span>
                        <span className="num" style={s({ color: bold ? "var(--text-hi)" : "inherit", fontWeight: bold ? 700 : 400 })}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={s({ marginTop:"9px", display:"flex", gap:"6px", flexWrap:"wrap" })}>
                    <span className="pill up">7/10 beats</span>
                    <span className="pill ai">10-qtr history</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 (reversed) */}
          <div className="hw-step rev reveal">
            <div className="hw-step-img">
              <div className="hw-frame">
                <FrameChrome />
                <div className="hw-body">
                  <div style={s({ border:"1px solid var(--warn)", borderRadius:"9px", padding:"10px", marginBottom:"10px" })}>
                    <div style={s({ fontSize:".78rem", color:"var(--text-hi)", fontWeight:700, marginBottom:"6px" })}>🔥 Cluster alert · 5+ in 30d</div>
                    <div style={s({ display:"flex", justifyContent:"space-between", fontSize:".8rem" })}>
                      <span style={s({ fontWeight:700, color:"var(--text-hi)" })}>NVDA</span>
                      <span style={s({ color:"var(--warn)", fontWeight:700 })}>6 actions / 30d</span>
                    </div>
                  </div>
                  <div style={s({ fontSize:".74rem", color:"var(--text-dim-solid)", marginBottom:"6px" })}>Watchlist alerts</div>
                  <div style={s({ display:"flex", gap:"6px", flexWrap:"wrap" })}>
                    <span className="pill dn">AMD: downgrade</span>
                    <span className="pill up">SMCI: +5.6%</span>
                    <span className="pill amc">COIN: unusual options</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hw-step-txt">
              <div className="hw-stepnum"><b>4</b><span>Step 4 · The Confluence</span></div>
              <h2 className="hw-h2">Signals align across the tape</h2>
              <p className="hw-p">StockWise flags confluence for you. The back-end surfaces stocks drawing 5+ analyst actions in 30 days, and names catching 2–3 upgrades at once.</p>
              <p className="hw-p">Your AI watchlist fires alerts on price moves and analyst upgrades, with a per-name AI-parse toggle. When the layers agree, you see it forming.</p>
              <div className="hw-feat">{CHECK}<span><b>Cluster detection</b> — dense coverage that often precedes momentum.</span></div>
              <div className="hw-feat">{CHECK}<span><b>Watchlist alerts</b> on price moves &amp; rating changes, per name.</span></div>
              <Link href="/menu/analyst" className="hw-link">Explore Analyst Actions →</Link>
            </div>
          </div>

          {/* Step 5 */}
          <div className="hw-step reveal">
            <div className="hw-step-txt">
              <div className="hw-stepnum"><b>5</b><span>Step 5 · The Result</span></div>
              <h2 className="hw-h2">Your book, summarized — and your recap, scheduled</h2>
              <p className="hw-p">Portfolio Pulse reads your holdings back to you: the biggest driver, your leader and laggard, and net day P/L — recomputed as you add, trim or sell.</p>
              <p className="hw-p">Every session ends with an executive recap you can read, download as a PDF, or schedule to your inbox daily or weekly.</p>
              <div className="hw-feat">{CHECK}<span><b>AI portfolio summary</b> — drivers, leaders, laggards, in plain language.</span></div>
              <div className="hw-feat">{CHECK}<span><b>Executive recaps</b> — clickable, downloadable, email-schedulable.</span></div>
              <Link href="/menu/portfolio" className="hw-link">Explore Portfolio Pulse →</Link>
            </div>
            <div className="hw-step-img">
              <div className="hw-frame">
                <FrameChrome />
                <div className="hw-body">
                  <div style={s({ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" })}>
                    <b style={s({ color:"var(--text-hi)", fontSize:".86rem" })}>◆ AI portfolio summary</b>
                    <span style={s({ color:"var(--up)", fontWeight:700, fontSize:".82rem" })}>+$20,940</span>
                  </div>
                  <div style={s({ fontSize:".79rem", color:"var(--text)", lineHeight:"1.6" })}>
                    <div style={s({ margin:"4px 0" })}><b style={s({ color:"var(--text-hi)" })}>Driver:</b> NVDA +8.2% at 55% weight</div>
                    <div style={s({ margin:"4px 0" })}><b style={s({ color:"var(--up)" })}>Leader:</b> NVDA · <b style={s({ color:"var(--down)" })}>Laggard:</b> HD −1.1%</div>
                    <div style={s({ margin:"4px 0" })}><b style={s({ color:"var(--text-hi)" })}>Net:</b> 5 of 6 holdings green</div>
                  </div>
                  <div style={s({ marginTop:"9px", display:"flex", gap:"6px" })}>
                    <span className="pill ai">Auto EOD recap</span>
                    <span className="pill up">PDF ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>{/* end hw-steps */}

        {/* ── WORKSPACE CARDS ── */}
        <div className="hw-tabs-sec reveal">
          <div className="hw-eyebrow" style={{ textAlign:"center" }}>What is inside</div>
          <h2 className="hw-h1" style={{ fontSize:"2.1rem", textAlign:"center", marginBottom:"8px" }}>Every workspace, explained</h2>
          <p className="hw-sub" style={{ margin:"0 auto 22px", textAlign:"center" }}>
            Fourteen connected views — each one click from the next. Tap any card to jump straight in.
          </p>
          <div className="hw-tabs">
            {TABS.map(({ slug, label, desc, d }) => (
              <Link
                key={slug}
                href={slug === "dashboard" ? "/dashboard" : `/menu/${slug}`}
                className="hw-tab reveal"
              >
                <span className="hw-tab-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d={d} />
                  </svg>
                </span>
                <span className="hw-tab-tx">
                  <b>{label}</b>
                  <span>{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── FINAL CTA ── */}
        <div className="hw-final reveal">
          <div className="hw-badge">One terminal · everything under one roof</div>
          <h2 className="hw-h1" style={{ fontSize:"2.2rem" }}>Start your research in one place</h2>
          <p className="hw-sub" style={{ margin:"16px auto 0" }}>
            Every workspace is connected and one click from the next — open the terminal and start exploring.
          </p>
          <div className="hw-cta" style={{ justifyContent:"center" }}>
            <button className="hw-btn-lg hw-btn-primary" onClick={() => setShowLogin(true)}>Open the research terminal →</button>
            <Link href="/dashboard" className="hw-btn-lg hw-btn-ghost">Explore all features →</Link>
          </div>
          <p style={s({ fontSize:".74rem", color:"var(--text-dim-solid)", marginTop:"16px" })}>
            StockWise is a research terminal for informational purposes — not investment advice.
          </p>
        </div>

      </div>{/* end .hw */}

      {/* ── LOGIN MODAL ── */}
      {showLogin && (
        <div className="lp-modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="lp-modal-card" onClick={e => e.stopPropagation()}>
            <button className="lp-modal-close" onClick={() => setShowLogin(false)} aria-label="Close">✕</button>

            {/* Logo closes the modal — already on "/" so no navigation needed */}
            <button onClick={() => setShowLogin(false)} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"none" }}>
              <span className="hw-logo" style={{ width:26, height:26, borderRadius:7 }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
                  <path d="M3 17l5-6 4 4 6-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="20" cy="5.5" r="2.4" fill="#fff" />
                </svg>
              </span>
              <span style={{ fontFamily:"var(--f-display)", fontWeight:700, fontSize:".95rem", color:"#fff" }}>
                Stock<b style={{ color:"var(--ai)" }}>Wise</b>
              </span>
            </button>

            <LoginForm />
          </div>
        </div>
      )}
    </div>
  );
}
