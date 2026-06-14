"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { analyst } from "../data";
import { cls, arr } from "../utils";

const TYPES = ["All", "upgrade", "downgrade", "target raise"];

export function AnalystScreen() {
  const { openStock } = useIQActions();
  const [filter, setFilter] = useState("All");

  const filtered = analyst.filter(a =>
    filter === "All" || a.type === filter
  );

  function actionStyle(type: string) {
    if (type === "upgrade") return { color: "var(--up)" };
    if (type === "downgrade") return { color: "var(--down)" };
    return { color: "var(--brand-2)" };
  }

  function actionLabel(type: string) {
    if (type === "upgrade") return "▲ Upgrade";
    if (type === "downgrade") return "▼ Downgrade";
    return "→ Target Raise";
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Analyst Actions</div>
          <div className="page-sub">Upgrades, downgrades, and price target changes — May 24, 2025</div>
        </div>
      </div>

      <div className="fbar">
        {TYPES.map(t => (
          <button key={t} className={`chip${filter === t ? " active" : ""}`} onClick={() => setFilter(t)}>
            {t === "All" ? "All Actions" : t === "upgrade" ? "▲ Upgrades" : t === "downgrade" ? "▼ Downgrades" : "→ Target Raises"}
          </button>
        ))}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th>Firm</th>
              <th>Action</th>
              <th>From</th>
              <th>To</th>
              <th>Prev Target</th>
              <th>New Target</th>
              <th>Upside</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => {
              const prevPx = analyst.find(x => x.s === a.s)?.prev ?? a.prev;
              const upside = ((a.tgt - a.prev) / a.prev * 100);
              return (
                <tr key={i} onClick={() => openStock(a.s)}>
                  <td><span className="sym">{a.s}</span></td>
                  <td style={{ color: "var(--text-hi)" }}>{a.n}</td>
                  <td style={{ color: "var(--text-dim-solid)", fontSize: 12 }}>{a.firm}</td>
                  <td>
                    <span style={{ ...actionStyle(a.type), fontWeight: 700, fontSize: 12 }}>
                      {actionLabel(a.type)}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-dim-solid)" }}>{a.from}</td>
                  <td style={{ color: "var(--text-hi)", fontWeight: 600 }}>{a.to}</td>
                  <td className="mono" style={{ color: "var(--text-dim-solid)" }}>${a.prev}</td>
                  <td className="mono" style={{ color: "var(--text-hi)", fontWeight: 700 }}>${a.tgt}</td>
                  <td>
                    <span className={cls(upside)} style={{ fontWeight: 600, fontFamily: "var(--f-mono)", fontSize: 12 }}>
                      {arr(upside)} {Math.abs(upside).toFixed(1)}%
                    </span>
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
