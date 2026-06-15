"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { watch } from "../data";
import { cls, arr, fmt, Spark } from "../utils";

const FILTER_TABS = ["All", "Reporting this week", "Options active", "Movers today"];

export function WatchlistScreen() {
  const { openStock } = useIQActions();
  const [activeTab, setActiveTab] = useState("All");

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
                <th>Next ER</th>
                <th>Last analyst action</th>
                <th style={{ textAlign: "center" }}>Options</th>
                <th>Latest headline</th>
                <th className="num">Intraday</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => (
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
                    maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {w.headline}
                  </td>
                  <td className="num">
                    <Spark seed={i + 20} up={w.c >= 0} />
                  </td>
                </tr>
              ))}
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
