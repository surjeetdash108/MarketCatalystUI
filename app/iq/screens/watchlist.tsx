"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { watch, analyst } from "../data";
import { cls, arr, fmt, Spark } from "../utils";

const FILTER_TABS = ["All", "Reporting this week", "Options active", "Movers today"];

export function WatchlistScreen() {
  const { openStock } = useIQActions();
  const [activeTab, setActiveTab] = useState("All");
  // AI parse toggle: sym → enabled (default all on)
  const [aiOn, setAiOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(watch.map(w => [w.s, true]))
  );

  const toggleAi = (sym: string) =>
    setAiOn(prev => ({ ...prev, [sym]: !prev[sym] }));

  // Alerts: price alert (|c| >= 2%) or analyst upgrade
  function alerts(sym: string) {
    const w = watch.find(x => x.s === sym);
    const hasMove = w && Math.abs(w.c) >= 2;
    const hasUpgrade = analyst.some(a => a.s === sym && (a.dir === "up" || a.dir === "init"));
    return { hasMove, hasUpgrade };
  }

  const filtered = watch.filter(w => {
    if (activeTab === "Options active") return w.opt;
    if (activeTab === "Movers today") return Math.abs(w.c) >= 2;
    return true;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">My Watchlist</div>
          <div className="page-title">Names I'm tracking</div>
          <div className="page-sub">
            {watch.length} names · not held · price, next earnings, last analyst action, options flag &amp; latest headline at a glance
          </div>
        </div>
        <button className="btn primary">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add to watchlist
        </button>
      </div>

      {/* ── AI EOD/EOW summary ── */}
      <div className="ai-block" style={{ marginBottom: 14 }}>
        <div className="card-h">
          <h3 className="ai-c">◆ AI End-of-Day Summary · Your Watchlist</h3>
          <span className="pill ai">Auto-generated</span>
        </div>
        <div className="card-b">
          <p style={{ fontSize: ".84rem", lineHeight: 1.6, color: "var(--text)" }}>
            <b style={{ color: "var(--text-hi)" }}>3 of your {watch.length} names</b> moved more than 2% today.{" "}
            <b style={{ color: "var(--up)" }}>NVDA +4.1%</b> led after strong data-center commentary;{" "}
            <b style={{ color: "var(--down)" }}>TSLA −2.8%</b> fell on volume concerns. Two names report earnings this week:{" "}
            <b style={{ color: "var(--text-hi)" }}>AMZN (Thu BMO)</b> and{" "}
            <b style={{ color: "var(--text-hi)" }}>GOOGL (Fri AMC)</b>. Options activity is elevated across 4 names.
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <span className="src-chip">EOD: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span className="src-chip">Movers: 3</span>
            <span className="src-chip">Earnings this week: 2</span>
            <span className="src-chip">Options active: 4</span>
          </div>
        </div>
      </div>

      <div className="fbar" style={{ padding: "0 18px", marginBottom: 12 }}>
        {FILTER_TABS.map(t => (
          <button key={t} className={`chip${activeTab === t ? " on" : ""}`}
            onClick={() => setActiveTab(t)}>{t}</button>
        ))}
        <div className="spacer" />
        <button className="chip" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Sort: Day change
        </button>
      </div>

      <div className="card" style={{ margin: "0 18px 18px" }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Price</th>
                <th className="num">Day</th>
                <th>Alerts</th>
                <th>Next ER</th>
                <th>Last analyst action</th>
                <th style={{ textAlign: "center" }}>Options</th>
                <th>Headline</th>
                <th className="num">Intraday</th>
                <th style={{ textAlign: "center" }}>AI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const al = alerts(w.s);
                const aiEnabled = aiOn[w.s] !== false;
                return (
                  <tr key={w.s} style={{ cursor: "pointer" }} onClick={() => openStock(w.s)}>
                    <td>
                      <div className="co">
                        <span className="s">{w.s}</span>
                        <span className="n">{w.n}</span>
                      </div>
                    </td>
                    <td className="num">${fmt(w.px)}</td>
                    <td className={`num ${cls(w.c)}`}>
                      {arr(w.c)} {Math.abs(w.c).toFixed(2)}%
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {al.hasMove && (
                          <span className={`pill ${w.c >= 0 ? "up" : "dn"}`} style={{ fontSize: ".62rem" }}>
                            {w.c >= 0 ? "▲" : "▼"} Move
                          </span>
                        )}
                        {al.hasUpgrade && (
                          <span className="pill ai" style={{ fontSize: ".62rem" }}>▲ Upg</span>
                        )}
                        {!al.hasMove && !al.hasUpgrade && (
                          <span style={{ color: "var(--text-dim-solid)" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-dim-solid)", fontSize: ".82rem" }}>{w.er}</td>
                    <td style={{ fontSize: ".82rem" }}>
                      {w.analyst
                        ? w.analyst
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {w.opt
                        ? <span className="pill opt">⚡ Active</span>
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td style={{
                      fontSize: ".8rem",
                      color: w.headline === "—" ? "var(--text-dim-solid)" : "var(--text)",
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {aiEnabled
                        ? w.headline
                        : <span style={{ color: "var(--text-dim-solid)" }}>AI parsing off</span>}
                    </td>
                    <td className="num">
                      <Spark seed={i + 20} up={w.c >= 0} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className={`pill${aiEnabled ? " ai" : ""}`}
                        style={{ cursor: "pointer", fontSize: ".62rem", background: aiEnabled ? undefined : "var(--surface-3)", color: aiEnabled ? undefined : "var(--text-dim-solid)" }}
                        onClick={e => { e.stopPropagation(); toggleAi(w.s); }}
                        title={aiEnabled ? "Disable AI parsing" : "Enable AI parsing"}
                      >
                        {aiEnabled ? "✦ On" : "○ Off"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", padding: "0 18px 14px" }}>
        Click any name to open its stock page. Watchlist names are highlighted across the product (movers, earnings, analyst actions) just like portfolio holdings.
      </p>
    </>
  );
}
