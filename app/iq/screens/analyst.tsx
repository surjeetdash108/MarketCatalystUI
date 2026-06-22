"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { analyst } from "../data";
import { sign, cls } from "../utils";

const TABS = ["All", "Upgrades", "Downgrades", "Initiations", "PT changes"];
const GROUP_OPTS = [
  "All actions","Major banks (GS, MS, JPM…)","Boutique / independent firms",
  "Technology","Semiconductors","Software / SaaS","Internet & media",
  "AI & data centers","Cybersecurity","EV & autos","Financials & banks",
  "Healthcare","Biotech","Pharma","Energy & oil","Industrials & defense",
  "Consumer & retail","Most upgraded today","Most downgraded today","Biggest PT increases",
];

function dirPill(dir: string) {
  if (dir === "up")   return <span className="pill up">▲ Upgrade</span>;
  if (dir === "down") return <span className="pill dn">▼ Downgrade</span>;
  if (dir === "init") return <span className="pill ai">◆ Initiate</span>;
  return <span className="pill hold">Reiterate</span>;
}

// Front-end flag: stocks with 5+ analyst actions
function computeFlags() {
  const cnt: Record<string, { n: string; count: number; ups: string[]; downs: string[] }> = {};
  analyst.forEach(a => {
    if (!cnt[a.s]) cnt[a.s] = { n: a.n, count: 0, ups: [], downs: [] };
    cnt[a.s].count++;
    if (a.dir === "up" || a.dir === "init") cnt[a.s].ups.push(a.firm);
    if (a.dir === "down") cnt[a.s].downs.push(a.firm);
  });
  return Object.entries(cnt)
    .filter(([, v]) => v.count >= 5)
    .map(([s, v]) => ({ s, ...v }));
}

export function AnalystScreen() {
  const { openStock } = useIQActions();
  const [tab, setTab] = useState(0);
  const [group, setGroup] = useState("All actions");
  const [ddOpen, setDdOpen] = useState(false);

  const flags = computeFlags();
  const topUpgrades = analyst
    .filter(a => a.dir === "up")
    .sort((a, b) => b.n30 - a.n30 || b.react - a.react)
    .slice(0, 3);

  const filtered = analyst.filter(a => {
    if (tab === 1) return a.dir === "up";
    if (tab === 2) return a.dir === "down";
    if (tab === 3) return a.dir === "init";
    if (tab === 4) return a.ptT !== a.ptF;
    return true;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Analyst Actions</div>
          <h1 className="page-title">Upgrades &amp; Downgrades</h1>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === tab ? " on" : ""}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Signal cards ── */}
      <div className="dash" style={{ marginBottom: 14 }}>
        {/* Flagged stocks: 5+ actions */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>🚩 Consensus shift — 5+ actions</h3>
              <span className="pill ai">Flagged</span>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              {flags.length === 0 ? (
                <p style={{ fontSize: ".84rem", color: "var(--text-dim-solid)" }}>No stocks with 5+ actions today.</p>
              ) : flags.map(f => (
                <div key={f.s} className="minirow" style={{ cursor: "pointer", marginBottom: 8, alignItems: "flex-start" }}
                  onClick={() => openStock(f.s)}>
                  <span className="tkr" style={{ paddingTop: 2 }}>{f.s}<small>{f.n}</small></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: ".78rem", color: "var(--text)", marginBottom: 4 }}>
                      <b style={{ color: "var(--text-hi)" }}>{f.count} actions</b>
                      {f.ups.length > 0 && <span className="up"> · {f.ups.length} upgrade{f.ups.length > 1 ? "s" : ""}</span>}
                      {f.downs.length > 0 && <span className="down"> · {f.downs.length} downgrade{f.downs.length > 1 ? "s" : ""}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {f.ups.slice(0, 3).map(firm => (
                        <span key={firm} className="src-chip" style={{ color: "var(--up)" }}>{firm} ▲</span>
                      ))}
                      {f.downs.slice(0, 2).map(firm => (
                        <span key={firm} className="src-chip" style={{ color: "var(--down)" }}>{firm} ▼</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Top 2-3 upgrades surfaced */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>▲ Top upgrades today</h3>
              <span className="pill up">Surfaced</span>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              {topUpgrades.map(a => (
                <div key={a.s + a.firm} className="minirow" style={{ cursor: "pointer", marginBottom: 8 }}
                  onClick={() => openStock(a.s)}>
                  <span className="tkr">{a.s}<small>{a.n}</small></span>
                  <span className="mid" style={{ fontSize: ".78rem" }}>
                    {a.firm} · {a.from} → <b style={{ color: "var(--up)" }}>{a.to}</b>
                    {a.ptF > 0 && <span style={{ color: "var(--text-dim-solid)" }}> · PT ${a.ptF}→${a.ptT}</span>}
                  </span>
                  <span className="r up">{a.react > 0 ? "+" : ""}{a.react.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fbar">
        {/* Dropdown filter — matches HTML <details class="dd"> */}
        <div className="dd" style={{ position: "relative", display: "inline-block" }}>
          <button
            className="chip"
            onClick={() => setDdOpen(o => !o)}
            style={{ cursor: "pointer" }}
          >
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
              <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {" "}Group: <span className="ddcap" style={{ color: "var(--text-hi)", fontWeight: 600 }}>{group}</span> ▾
          </button>
          {ddOpen && (
            <div className="dd-menu">
              <div className="ddlbl">Most-searched filters</div>
              {GROUP_OPTS.map(o => (
                <button key={o} onClick={() => { setGroup(o); setDdOpen(false); }}>{o}</button>
              ))}
            </div>
          )}
        </div>
        <button className="chip on">My names</button>
        <button className="chip">PT &gt;15% move</button>
        <div className="spacer" />
      </div>

      <div className="dash">
        {/* col-8: table */}
        <div className="col-8">
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Firm</th>
                    <th>Action</th>
                    <th>Rating</th>
                    <th className="num">Price Target</th>
                    <th className="num">Reaction</th>
                    <th className="num">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.s + a.firm} className={a.owned ? "owned" : ""} onClick={() => openStock(a.s)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="co">
                          <span className="s">
                            {a.owned && <span className="own-dot" />}
                            {a.s}
                          </span>
                          <span className="n">{a.n}</span>
                        </div>
                      </td>
                      <td>{a.firm}</td>
                      <td>{dirPill(a.dir)}</td>
                      <td>
                        <span style={{ color: "var(--text-dim-solid)" }}>{a.from}</span>
                        {" → "}
                        <b style={{ color: "var(--text-hi)" }}>{a.to}</b>
                      </td>
                      <td className="num">
                        {a.ptF ? `$${a.ptF}` : "—"} → <b style={{ color: "var(--text-hi)" }}>${a.ptT}</b>
                      </td>
                      <td className={`num ${cls(a.react)}`}>{sign(a.react)}</td>
                      <td className="num">{a.n30}× /30d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* col-4: AI take */}
        <div className="col-4">
          <div className="ai-block">
            <div className="card-h">
              <h3 className="ai-c">◆ AI take · CRM upgrade</h3>
            </div>
            <div className="card-b">
              <p style={{ fontSize: ".85rem", lineHeight: 1.6, color: "var(--text)" }}>
                This is likely <b style={{ color: "var(--text-hi)" }}>meaningful</b>. Morgan Stanley is a tier-1 voice on software, the $40 PT bump (+13%) is sizable, and it&apos;s the{" "}
                <b style={{ color: "var(--text-hi)" }}>third upgrade this week</b> — the trend is turning, not crowded yet. The contrarian view is already absorbed; further upside depends on the margin story holding.
              </p>
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="src-chip">Firm tier: 1</span>
                <span className="src-chip">PT Δ: +13%</span>
                <span className="src-chip">Trend: turning</span>
                <span className="src-chip">Crowding: low</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
