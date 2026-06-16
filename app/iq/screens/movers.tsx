"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { movers } from "../data";
import { fmt, sign, cls, arr, Spark } from "../utils";

const TABS = ["Top Gainers", "Top Losers", "Unusual Vol", "Gap Ups", "Gap Downs", "Weekly Movers"];
const CHIPS = ["S&P 500", "Nasdaq 100", "Russell 2K", "RVOL > 2×", "Large cap"];

export function MoversScreen() {
  const { openStock } = useIQActions();
  const [tab, setTab] = useState(0);
  const [activeChip, setActiveChip] = useState(0);

  const filtered = movers.filter(m => {
    if (tab === 0) return m.c > 0;
    if (tab === 1) return m.c < 0;
    if (tab === 3) return m.rvol > 3 && m.c > 0;
    if (tab === 4) return m.rvol > 3 && m.c < 0;
    return true;
  }).sort((a, b) => {
    if (tab === 0) return b.c - a.c;
    if (tab === 1) return a.c - b.c;
    return b.rvol - a.rvol;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Market Movers</div>
          <h1 className="page-title">What&apos;s Moving &amp; Why</h1>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === tab ? " on" : ""}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="fbar">
        {CHIPS.map((c, i) => (
          <button key={c} className={`chip${i === activeChip ? " on" : ""}`} onClick={() => setActiveChip(i)}>{c}</button>
        ))}
        <div className="spacer" />
        <button className="chip">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Session: Regular
        </button>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Price</th>
                <th className="num">Change</th>
                <th className="num">RVOL</th>
                <th>Catalyst</th>
                <th>MA Posture</th>
                <th className="num">Intraday</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
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
                  <td className={`num ${cls(m.c)}`}>{arr(m.c)} {sign(m.c)}</td>
                  <td className="num">
                    <b style={{ color: m.rvol > 3 ? "var(--warn)" : "var(--text)" }}>{m.rvol.toFixed(1)}×</b>
                  </td>
                  <td>
                    {m.cat === "No known catalyst"
                      ? <span style={{ color: "var(--text-dim-solid)" }}>{m.cat}</span>
                      : <span className="pill" style={{ background: "var(--surface-3)", color: "var(--brand-2)" }}>{m.cat}</span>
                    }
                  </td>
                  <td>
                    <span style={{ fontSize: ".78rem", color: m.ma.includes("Below") ? "var(--down)" : "var(--up)" }}>
                      {m.ma}
                    </span>
                  </td>
                  <td className="num">
                    <Spark seed={m.s.charCodeAt(0)} up={m.c >= 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
