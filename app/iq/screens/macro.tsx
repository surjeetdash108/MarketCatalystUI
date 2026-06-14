"use client";

import { useState } from "react";
import { macro } from "../data";

const TYPES = ["All", "data", "fed", "holiday", "speech", "survey"];

export function MacroScreen() {
  const [filter, setFilter] = useState("All");
  const filtered = macro.filter(m => filter === "All" || m.type === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Macro & VIX</div>
          <div className="page-sub">Economic releases, Fed events, and market indicators</div>
        </div>
      </div>

      {/* VIX and rate snapshot */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, padding: "14px 18px 0" }}>
        {[
          { l: "VIX", v: "14.18", sub: "▼ −2.51%", c: "var(--up)" },
          { l: "10Y Yield", v: "4.32%", sub: "▼ −4bps", c: "var(--up)" },
          { l: "2Y Yield", v: "4.87%", sub: "▼ −3bps", c: "var(--up)" },
          { l: "Fed Funds Rate", v: "5.25–5.50%", sub: "On Hold", c: "var(--warn)" },
        ].map(card => (
          <div key={card.l} className="card">
            <div className="card-b">
              <div style={{ fontSize: 10.5, color: "var(--text-dim-solid)", marginBottom: 4 }}>{card.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--f-mono)", color: card.c }}>{card.v}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim-solid)", marginTop: 2 }}>{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fbar" style={{ marginTop: 10 }}>
        {TYPES.map(t => (
          <button key={t} className={`chip${filter === t ? " active" : ""}`} onClick={() => setFilter(t)}>
            {t === "All" ? "All Events" : t === "data" ? "Economic Data" : t === "fed" ? "Fed" : t === "holiday" ? "Holidays" : t === "speech" ? "Speeches" : "Surveys"}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 18px 18px" }}>
        <div className="card">
          <div className="card-h"><h3>Calendar — Week of May 27, 2025</h3></div>
          {filtered.map((ev, i) => (
            <div key={i} className="macro-row">
              <div className="macro-dt">{ev.dt}</div>
              <div style={{ flex: 1 }}>
                <div className="macro-ev">{ev.ev}</div>
                {ev.sub && <div className="macro-sub">{ev.sub}</div>}
              </div>
              <span className={`macro-badge ${ev.type}`}>
                {ev.type === "holiday" ? "Holiday" : ev.type === "data" ? "Data" : ev.type === "fed" ? "Fed" : ev.type === "speech" ? "Speech" : "Survey"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
