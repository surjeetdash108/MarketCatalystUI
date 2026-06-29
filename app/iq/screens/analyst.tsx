"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { analyst } from "../data";
import { sign, cls, StockLogo } from "../utils";

const TABS = ["All", "Upgrades", "Downgrades", "Initiations", "PT changes"];

function dirPill(dir: string) {
  if (dir === "up")   return <span className="pill up">▲ Upgrade</span>;
  if (dir === "down") return <span className="pill dn">▼ Downgrade</span>;
  if (dir === "init") return <span className="pill ai">◆ Initiate</span>;
  return <span className="pill hold">Reiterate</span>;
}

function computeClusters() {
  const byS: Record<string, { name: string; up: number; down: number; init: number; n: number; n30: number }> = {};
  analyst.forEach(a => {
    const o = byS[a.s] = byS[a.s] || { name: a.n, up: 0, down: 0, init: 0, n: 0, n30: 0 };
    o.n++;
    o.n30 = Math.max(o.n30, a.n30);
    if (a.dir === "up")        o.up++;
    else if (a.dir === "down") o.down++;
    else if (a.dir === "init") o.init++;
  });
  const clusters = Object.entries(byS)
    .filter(([, o]) => o.n30 >= 5)
    .map(([s, o]) => ({ s, ...o }))
    .sort((a, b) => b.n30 - a.n30);
  const upgrades = Object.entries(byS)
    .filter(([, o]) => o.up >= 2)
    .map(([s, o]) => ({ s, ...o }));
  return { byS, clusters, upgrades };
}

export function AnalystScreen() {
  const { openStock } = useIQActions();
  const [tab, setTab]               = useState(0);
  const [clustersOnly, setClustersOnly] = useState(false);

  const { byS, clusters, upgrades } = computeClusters();

  const filtered = analyst.filter(a => {
    if (clustersOnly && (byS[a.s]?.n30 ?? 0) < 5) return false;
    if (tab === 1) return a.dir === "up";
    if (tab === 2) return a.dir === "down";
    if (tab === 3) return a.dir === "init";
    if (tab === 4) return a.ptT !== a.ptF;
    return true;
  });

  return (
    <>
      <div className="tabs" style={{ alignSelf: "flex-start" }}>
        {TABS.map((t, i) => (
          <button key={t} className={`tab${i === tab ? " on" : ""}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── Signal cards ── */}
      <div className="dash" style={{ marginBottom: 14 }}>

        {/* Cluster alert — 5+ actions / 30d */}
        <div className="col-6">
          <div className="card" style={{ borderColor: "var(--warn)" }}>
            <div className="card-h">
              <h3>🔥 Cluster alert · 5+ actions / 30d</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--warn)" }}>high conviction</span>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {clusters.length === 0
                ? <div className="ec-none">No 5+ clusters in view.</div>
                : clusters.map(c => (
                  <div key={c.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(c.s)}>
                    <StockLogo sym={c.s} size={20} />
                    <span className="tkr">{c.s}</span>
                    <span className="mid">{c.name} · {c.up} up / {c.down} down</span>
                    <span className="r" style={{ color: "var(--warn)", fontWeight: 700 }}>{c.n30} /30d</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Multiple upgrades (2–3) */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>▲ Multiple upgrades (2–3)</h3>
              <span className="pill up">trend turning</span>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {upgrades.length === 0
                ? <div className="ec-none">No multi-upgrade names today.</div>
                : upgrades.map(c => (
                  <div key={c.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(c.s)}>
                    <StockLogo sym={c.s} size={20} />
                    <span className="tkr">{c.s}</span>
                    <span className="mid">{c.up} upgrades recently</span>
                    <span className="r up" style={{ fontWeight: 700 }}>▲ {c.up}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="fbar">
        <button className="chip on">My names</button>
        <button className="chip">PT &gt;15% move</button>
        <button className={`chip${clustersOnly ? " on" : ""}`} onClick={() => setClustersOnly(o => !o)}>
          Clusters only
        </button>
        <div className="spacer" />
      </div>

      {/* ── Main layout ── */}
      <div className="dash">

        {/* col-8: actions table */}
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
                  {filtered.map(a => {
                    const clusterBadge = (byS[a.s]?.n30 ?? 0) >= 5;
                    return (
                      <tr key={a.s + a.firm} className={a.owned ? "owned" : ""}
                        onClick={() => openStock(a.s)} style={{ cursor: "pointer" }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <StockLogo sym={a.s} size={26} />
                            <div className="co">
                            <span className="s">
                              {a.owned && <span className="own-dot" />}
                              {a.s}
                              {clusterBadge && (
                                <span className="pill" style={{ background: "rgba(245,170,60,.18)", color: "var(--warn)", marginLeft: 4, fontSize: ".62rem" }}>
                                  {byS[a.s].n30}+ /30d
                                </span>
                              )}
                            </span>
                            <span className="n">{a.n}</span>
                          </div>
                          </div>
                        </td>
                        <td style={{ fontSize: ".8rem" }}>{a.firm}</td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* col-4: AI take */}
        <div className="col-4">
          <div className="ai-block">
            <div className="card-h">
              <h3 className="ai-c">◆ AI take · CRM cluster</h3>
            </div>
            <div className="card-b">
              <p style={{ fontSize: ".85rem", lineHeight: 1.6, color: "var(--text)" }}>
                CRM has drawn <b style={{ color: "var(--text-hi)" }}>two upgrades</b> this week (Morgan Stanley, Citigroup) with PTs to $330–340. NVDA shows a{" "}
                <b style={{ color: "var(--text-hi)" }}>6-action cluster</b> in 30 days — dense coverage that often precedes continued momentum. Clusters matter more than any single call.
              </p>
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="src-chip">CRM: 2 upgrades</span>
                <span className="src-chip">NVDA: 6 / 30d</span>
                <span className="src-chip">Crowding: low</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
