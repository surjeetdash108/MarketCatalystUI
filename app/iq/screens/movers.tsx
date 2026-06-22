"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { movers, analyst, earnings } from "../data";
import { fmt, sign, cls, arr, Spark } from "../utils";

const TABS = [
  ["win",  "Top Gainers"],
  ["lose", "Top Losers"],
  ["vol",  "Unusual Volume"],
  ["week", "Weekly Movers"],
] as const;
type TabKey = "win" | "lose" | "vol" | "week";
const CAPS = ["All", "Mega", "Large", "Mid", "Small"];

function computeTrending() {
  const srcs: Record<string, Set<string>> = {};
  const add = (s: string, src: string) => {
    if (!srcs[s]) srcs[s] = new Set();
    srcs[s].add(src);
  };
  movers.forEach(m  => add(m.s, "Movers"));
  analyst.forEach(a => add(a.s, "Analyst"));
  earnings.forEach(e => add(e.s, "Earnings"));
  return Object.entries(srcs)
    .map(([s, set]) => ({ s, n: set.size, srcs: [...set], days: 2 + (s.charCodeAt(0) % 4) }))
    .filter(o => o.n >= 2)
    .sort((a, b) => b.n - a.n || b.days - a.days);
}

export function MoversScreen() {
  const { openStock } = useIQActions();
  const [tab,    setTab]    = useState<TabKey>("win");
  const [sector, setSector] = useState("All");
  const [cap,    setCap]    = useState("All");

  const pool    = movers;
  const sectors = ["All", ...Array.from(new Set(pool.map(m => m.sector))).sort()];

  const filtered = pool
    .filter(m => {
      if (sector !== "All" && m.sector !== sector) return false;
      if (cap    !== "All" && m.cap    !== cap)    return false;
      if (tab === "win")  return m.c > 0;
      if (tab === "lose") return m.c < 0;
      return true;
    })
    .sort((a, b) => {
      if (tab === "win")  return b.c    - a.c;
      if (tab === "lose") return a.c    - b.c;
      if (tab === "vol")  return b.rvol - a.rvol;
      return Math.abs(b.wk) - Math.abs(a.wk);
    })
    .slice(0, 15);

  const tally: Record<string, number> = {};
  filtered.forEach(m => { tally[m.sector] = (tally[m.sector] || 0) + 1; });
  const sectorTally = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  const trending = computeTrending();
  const val = (m: typeof pool[0]) => tab === "week" ? m.wk : m.c;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Market Movers</div>
          <h1 className="page-title">Winners &amp; Losers</h1>
          <div className="page-sub">
            {{ win: "Top 15 gainers today", lose: "Top 15 losers today", vol: "Top 15 by relative volume", week: "Biggest 5-day movers" }[tab]}
            {" · click a row for the full breakdown"}
          </div>
        </div>
        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={`tab${k === tab ? " on" : ""}`} onClick={() => setTab(k as TabKey)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Trending across reports */}
      {trending.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h">
            <h3>🔥 Trending across reports</h3>
            <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
              {trending.length} names · in 2+ of today&apos;s reports
            </span>
          </div>
          <div className="card-b" style={{ paddingTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            {trending.map(o => {
              const mv = movers.find(m  => m.s === o.s);
              const an = analyst.find(a  => a.s === o.s);
              const er = earnings.find(e => e.s === o.s);
              const name   = mv?.n ?? an?.n ?? er?.n ?? "—";
              const change = mv?.c ?? an?.react ?? er?.react ?? null;
              return (
                <div key={o.s} className="tr-card" onClick={() => openStock(o.s)}>
                  <div className="tr-card-top">
                    <span className="tr-tk">{o.s}</span>
                    {change !== null && (
                      <span className={`pill ${change >= 0 ? "up" : "dn"}`} style={{ fontSize: ".68rem" }}>{sign(change)}</span>
                    )}
                  </div>
                  <div className="tr-nm">{name}</div>
                  <Spark seed={o.s.charCodeAt(0)} up={change !== null ? change >= 0 : true} />
                  <div className="tr-mt" style={{ marginTop: 6 }}>{o.n} reports · {o.days}d</div>
                  <div className="tr-srcs">
                    {o.srcs.map(src => (
                      <span key={src} className={`tr-src tr-src-${src[0].toLowerCase()}`}>{src}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="fbar">
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center" }}>Sector</span>
        <select className="mv-sel" value={sector} onChange={e => setSector(e.target.value)}>
          {sectors.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center", marginLeft: 10 }}>Market cap</span>
        <select className="mv-sel" value={cap} onChange={e => setCap(e.target.value)}>
          {CAPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="spacer" />
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{filtered.length} stocks</span>
      </div>

      {/* Sector tally */}
      {sectorTally.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {sectorTally.map(([sec, count]) => (
            <span key={sec} className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
              {sec} <b style={{ color: "var(--text-hi)" }}>{count}</b>
            </span>
          ))}
        </div>
      )}

      <div className="card" style={{ overflow: "visible" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Company</th>
              <th className="num">Price</th>
              <th className="num">{tab === "week" ? "5-day" : "Change"}</th>
              <th className="num">RVOL</th>
              <th>Cap · Sector</th>
              <th>Catalyst</th>
              <th className="num">Intraday</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: "var(--text-dim-solid)" }}>No stocks match these filters.</td>
              </tr>
            ) : filtered.map(m => {
              const v = val(m);
              return (
                <tr key={m.s} className={m.owned ? "owned" : ""} onClick={() => openStock(m.s)} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="co">
                      <span className="s">
                        {m.owned && <span className="own-dot" />}
                        {m.s}
                      </span>
                      <span className="n">{m.n}</span>
                    </div>
                  </td>
                  <td className="num">${fmt(m.p)}</td>
                  <td className={`num ${cls(v)}`}>{arr(v)} {sign(v)}</td>
                  <td className="num">
                    <b style={{ color: m.rvol > 3 ? "var(--warn)" : "var(--text)" }}>{m.rvol.toFixed(1)}×</b>
                  </td>
                  <td>
                    <span style={{ fontSize: ".74rem" }}>
                      <b style={{ color: "var(--text-hi)" }}>{m.cap}</b>
                      {" · "}
                      <span style={{ color: "var(--text-dim-solid)" }}>{m.sector}</span>
                    </span>
                  </td>
                  <td className="mv-reason">
                    {m.cat === "No known catalyst"
                      ? <span style={{ color: "var(--text-dim-solid)" }}>{m.cat}</span>
                      : <span className="pill" style={{ background: "var(--surface-3)", color: "var(--brand-2)" }}>{m.cat}</span>
                    }
                    {" "}<span className="mv-i">ⓘ</span>
                    <div className="mvpop">
                      <div className="mvtabs">
                        <span className="mvt mvt-t">Technical</span>
                        <span className="mvt mvt-n">News</span>
                      </div>
                      <div className="mvp mvp-t">{m.tech}</div>
                      <div className="mvp mvp-n">{m.news}</div>
                    </div>
                  </td>
                  <td className="num">
                    <Spark seed={m.s.charCodeAt(0)} up={v >= 0} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
