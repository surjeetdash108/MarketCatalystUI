"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIQActions } from "../shell";
import { commentary, watch, folio } from "../data";

const TABS = ["Live", "Premarket", "After Hours", "My names", "Macro"];

const PREMARKET = [
  { cat: "Futures",     accent: "var(--brand-2)", time: "6:14a", text: "S&P futures <b>+0.4%</b>, Nasdaq futures <b>+0.7%</b> pre-open", why: "Risk-on sentiment building ahead of the open; CPI catalyst overnight." },
  { cat: "Macro",       accent: "var(--warn)",    time: "5:55a", text: "10-year Treasury yield drops to <b>4.32%</b> from 4.41% close", why: "Bond market front-running a rate-cut repricing on the inflation miss." },
  { cat: "Earnings",    accent: "var(--up)",      time: "6:01a", text: "<b>NVDA</b> Q1 results: EPS $6.12 vs $5.18 est. (+18% beat)", why: "Revenue guidance of $28B vs $26.7B consensus — the number the market was watching most." },
  { cat: "Analyst",     accent: "var(--brand-2)", time: "5:30a", text: "Wedbush raises <b>AAPL</b> PT to $250, Outperform reiterated", why: "Services momentum is reaccelerating; AI device cycle could lift upgrade rates." },
  { cat: "Overnight",   accent: "var(--ai)",      time: "4:47a", text: "Asian markets: Nikkei <b>+1.2%</b>, Hang Seng <b>+0.8%</b>", why: "NVDA's AI print lifted semiconductor names globally; tech-led rally." },
  { cat: "Pre-open",    accent: "var(--up)",      time: "8:12a", text: "BMO reporters: <b>HD</b> (8:30a), <b>DELL</b> (8:30a) · Watch guidance language", why: "HD margins sensitive to housing slowdown; DELL AI server demand is the key read." },
];

const AFTERHOURS = [
  { cat: "Earnings",    accent: "var(--up)",   time: "4:01p", text: "<b>AAPL</b> Q2 results: EPS $1.53 vs $1.50 est; services rev +14% YoY", why: "Beat is narrow but services reacceleration is the real story — highest multiple business." },
  { cat: "Earnings",    accent: "var(--up)",   time: "4:05p", text: "<b>NVDA</b> extended hours <b>+7.1%</b> after the close", why: "Market still pricing in further data-center capex acceleration into H2." },
  { cat: "Analyst",     accent: "var(--brand-2)", time: "4:18p", text: "GS raises <b>NVDA</b> PT to $1,200 following blowout quarter", why: "Blackwell shipments ahead of schedule — raises confidence in FY26 estimates." },
  { cat: "Macro",       accent: "var(--warn)", time: "4:30p", text: "Markets close: S&P +0.73%, Nasdaq +1.02%, Dow +0.41%", why: "Broad advance on cool inflation + NVDA; defensive sectors lagged as risk appetite returned." },
  { cat: "AMC",         accent: "var(--ai)",   time: "4:45p", text: "Reporting after-close: <b>SNOW</b>, <b>WDAY</b>, <b>PANW</b>", why: "Enterprise software results will test whether AI spending trickles into SaaS growth." },
  { cat: "AH Move",     accent: "var(--down)", time: "5:10p", text: "<b>WDAY</b> AH −4.2% after subscription rev in-line but FY guidance light", why: "Growth stock held to a high bar post-CPI; anything not materially above estimates sold off." },
];

function FeedItem({ item, i, total }: { item: typeof commentary[0]; i: number; total: number }) {
  return (
    <div style={{
      display: "flex", gap: 12,
      padding: "12px 0",
      borderBottom: i < total - 1 ? "1px solid var(--border-soft)" : "none",
    }}>
      <div style={{ flexShrink: 0, width: 84 }}>
        <span className="pill" style={{ background: "var(--surface-3)", color: item.accent }}>{item.cat}</span>
        <div className="mono" style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 6 }}>{item.time}</div>
      </div>
      <div>
        <div style={{ fontSize: ".88rem", color: "var(--text)" }} dangerouslySetInnerHTML={{ __html: item.text }} />
        <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", borderLeft: `2px solid ${item.accent}55`, paddingLeft: 9, marginTop: 5 }}>
          <b style={{ color: "var(--ai)", fontWeight: 600 }}>Why it matters · </b>
          {item.why}
        </div>
      </div>
    </div>
  );
}

export function CommentaryScreen() {
  const router = useRouter();
  const { openStock } = useIQActions();
  const [activeTab, setActiveTab] = useState(0);

  const mySymbols = new Set([
    ...watch.map(w => w.s),
    ...folio.map(f => f.s),
  ]);

  const myFeed = commentary.filter(item =>
    [...mySymbols].some(sym => item.text.includes(`>${sym}<`) || item.text.includes(`<b>${sym}</b>`))
  );

  const macroFeed = commentary.filter(item =>
    ["Macro", "Fed/Rates"].includes(item.cat)
  );

  const tabFeed = (() => {
    if (activeTab === 0) return commentary;
    if (activeTab === 1) return PREMARKET;
    if (activeTab === 2) return AFTERHOURS;
    if (activeTab === 3) return myFeed.length > 0 ? myFeed : commentary;
    if (activeTab === 4) return macroFeed.length > 0 ? macroFeed : commentary;
    return commentary;
  })();

  const feedLabel = (() => {
    if (activeTab === 0) return { title: "Intraday commentary", badge: <span className="live"><span className="dot" />Live · streaming</span> };
    if (activeTab === 1) return { title: "Pre-market · before 9:30a ET", badge: <span className="pill" style={{ background: "var(--surface-3)", color: "var(--brand-2)" }}>Pre-market</span> };
    if (activeTab === 2) return { title: "After hours · post 4:00p ET", badge: <span className="pill amc">After hours</span> };
    if (activeTab === 3) return { title: `My names · ${mySymbols.size} tracked`, badge: <span className="pill ai">Portfolio + Watchlist</span> };
    if (activeTab === 4) return { title: "Macro & rates", badge: <span className="pill" style={{ background: "var(--surface-3)", color: "var(--warn)" }}>Macro</span> };
    return { title: "Commentary", badge: null };
  })();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Context</div>
          <div className="page-title">All-Market Commentary</div>
          <div className="page-sub">Live, plain-English coverage of stocks in play, news, ratings and the macro tape</div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " on" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="dash" style={{ padding: "0 18px 18px" }}>

        {/* col-8: Feed (content changes per tab) */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>{feedLabel.title}</h3>
              {feedLabel.badge}
            </div>
            <div className="card-b" style={{ paddingTop: 2 }}>
              {tabFeed.length === 0 ? (
                <div style={{ padding: "18px 0", color: "var(--text-dim-solid)", fontSize: ".84rem" }}>
                  {activeTab === 3
                    ? "No commentary items match your portfolio or watchlist names right now."
                    : "No items in this category right now."}
                </div>
              ) : tabFeed.map((item, i) => (
                <FeedItem key={i} item={item} i={i} total={tabFeed.length} />
              ))}
            </div>
          </div>

          {/* My names: show the stocks being tracked */}
          {activeTab === 3 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-h">
                <h3>Tracked names</h3>
                <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                  {mySymbols.size} stocks
                </span>
              </div>
              <div className="card-b" style={{ paddingTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[...mySymbols].map(sym => (
                  <button key={sym} className="chip" onClick={() => openStock(sym)}>{sym}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* col-4: sidecards (unchanged regardless of tab) */}
        <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div className="wmn">
            <div className="wmn-h">
              <div className="t">
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: ".92rem" }}>Before the Bell</h2>
                  <div className="meta">pushed 8:30a ET</div>
                </div>
              </div>
            </div>
            <ul className="wmn-body" style={{ columns: 1, padding: "6px 18px 14px" }}>
              <li><span className="bullet" /><span>Futures point higher after a <b>cooler CPI</b> print; rate-cut odds for September rose.</span></li>
              <li><span className="bullet" /><span>Overnight: Asian semis rallied on NVDA; European luxury slipped on China demand.</span></li>
              <li><span className="bullet" /><span>Before open: <b>HD</b>, <b>DELL</b> report; watch guidance commentary.</span></li>
            </ul>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>After the Close</h3>
              <span className="pill amc">within 30 min</span>
            </div>
            <div className="card-b">
              <p style={{ fontSize: ".82rem", lineHeight: 1.55, color: "var(--text-dim-solid)" }}>
                A pushed summary of final index performance, the day's top stories, and what's scheduled for tomorrow will appear here within 30 minutes of the close.
              </p>
              <button className="btn ai" style={{ marginTop: 10, width: "100%" }} onClick={() => router.push("/menu/recap")}>
                See today's EOD recap →
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>General perspective</h3></div>
            <div className="card-b">
              <div className="note">
                Regime reads <b style={{ color: "var(--text-hi)" }}>Risk-On Rally</b>: breadth strong, yields easing, cyclicals leading defensives. Cheap-hedging environment with VIX at 14.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
