"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { movers } from "../data";
import { cls, arr } from "../utils";

const SECTORS = ["All", "Semis", "Software", "Retail", "Social", "Fintech", "Auto", "Hardware"];

export function MoversScreen() {
  const { openStock } = useIQActions();
  const [sector, setSector] = useState("All");
  const [tab, setTab] = useState<"all" | "up" | "down">("all");

  const filtered = movers.filter(m => {
    const secMatch = sector === "All" || m.sec === sector;
    const tabMatch = tab === "all" || (tab === "up" && m.c > 0) || (tab === "down" && m.c < 0);
    return secMatch && tabMatch;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Market Movers</div>
          <div className="page-sub">Notable price action — May 24, 2025</div>
        </div>
      </div>

      <div className="fbar">
        {(["all", "up", "down"] as const).map(t => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "all" ? "All Movers" : t === "up" ? "▲ Gainers" : "▼ Losers"}
          </button>
        ))}
        <div style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
        {SECTORS.map(s => (
          <button key={s} className={`chip${sector === s ? " active" : ""}`} onClick={() => setSector(s)}>{s}</button>
        ))}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Change</th>
              <th>Volume</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.s} onClick={() => openStock(m.s)}>
                <td><span className={`sym ${cls(m.c)}`}>{m.s}</span></td>
                <td style={{ color: "var(--text-hi)" }}>{m.n}</td>
                <td><span className="pill flat">{m.sec}</span></td>
                <td>
                  <span className={cls(m.c)} style={{ fontWeight: 700, fontFamily: "var(--f-mono)", fontSize: 13 }}>
                    {arr(m.c)} {Math.abs(m.c).toFixed(1)}%
                  </span>
                </td>
                <td className="mono" style={{ color: "var(--text-dim-solid)" }}>{m.v}</td>
                <td style={{ color: "var(--text)", fontSize: 12 }}>{m.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
