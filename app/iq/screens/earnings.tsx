"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { earnings } from "../data";
import { cls, arr, sign } from "../utils";

const FILTERS = ["All", "Beat", "Miss", "Raised", "Lowered", "Owned"];

export function EarningsScreen() {
  const { openEarnings, openStock } = useIQActions();
  const [filter, setFilter] = useState("All");

  const filtered = earnings.filter(e => {
    if (filter === "All") return true;
    if (filter === "Owned") return e.owned;
    return e.tags.some(t => t.toLowerCase() === filter.toLowerCase());
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Earnings Hub</div>
          <div className="page-sub">Q1 2025 earnings season — {earnings.length} companies tracked</div>
        </div>
        <div className="actions">
          <span className="chip ai-c">✦ AI Powered</span>
        </div>
      </div>

      <div className="fbar">
        {FILTERS.map(f => (
          <button key={f} className={`chip${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th>Reports</th>
              <th>Mkt Cap</th>
              <th>EPS Est</th>
              <th>EPS Actual</th>
              <th>Rev Est</th>
              <th>Rev Actual</th>
              <th>Guide</th>
              <th>Reaction</th>
              <th>Implied ±</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.s} onClick={() => openEarnings(e.s)}>
                <td>
                  <span
                    className="sym"
                    style={{ cursor: "pointer", color: e.react != null && e.react > 0 ? "var(--up)" : e.react != null && e.react < 0 ? "var(--down)" : "var(--text-hi)" }}
                    onClick={ev => { ev.stopPropagation(); openStock(e.s); }}
                  >{e.s}</span>
                </td>
                <td>{e.n}</td>
                <td style={{ color: "var(--text-dim-solid)" }}>{e.t}</td>
                <td>{e.mc}</td>
                <td className="mono">${e.epsE}</td>
                <td className="mono">
                  {e.epsA != null ? (
                    <span className={cls(e.epsA - e.epsE)}>${e.epsA}</span>
                  ) : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                </td>
                <td className="mono">${e.revE}B</td>
                <td className="mono">
                  {e.revA != null ? (
                    <span className={cls(e.revA - e.revE)}>${e.revA}B</span>
                  ) : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                </td>
                <td>
                  {e.guide ? (
                    <span style={{ color: e.guide === "Raised" ? "var(--up)" : e.guide === "Lowered" ? "var(--down)" : "var(--text)" }}>
                      {e.guide}
                    </span>
                  ) : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                </td>
                <td>
                  {e.react != null ? (
                    <span className={cls(e.react)} style={{ fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                      {e.react > 0 ? "+" : ""}{e.react}%
                    </span>
                  ) : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                </td>
                <td className="mono" style={{ color: "var(--warn)" }}>±{e.implied}%</td>
                <td>
                  {e.tags.map(t => (
                    <span key={t} className={`tag-chip ${t.toLowerCase()}`}>{t}</span>
                  ))}
                  {e.owned && <span className="tag-chip owned">Owned</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
