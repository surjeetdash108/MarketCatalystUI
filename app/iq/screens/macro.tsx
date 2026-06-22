"use client";

import { useState } from "react";

const TABS = ["Last week", "This week", "Next week"];

interface MacroEvent {
  ev: string; date: string; day: string; tier: "High" | "Med" | "Low";
  prev: string; est: string; actual: string; surprise: "up" | "down" | "";
  note: string;
}

const CAL_LAST: MacroEvent[] = [
  { ev: "Jobless Claims",      date: "Jun 12", day: "Thu", tier: "Med",  prev: "222K", est: "218K", actual: "215K", surprise: "up",   note: "Labour market still resilient" },
  { ev: "PPI (May)",           date: "Jun 11", day: "Wed", tier: "Med",  prev: "0.5%", est: "0.3%", actual: "0.2%", surprise: "up",   note: "Wholesale prices cooling" },
  { ev: "CPI (May)",           date: "Jun 12", day: "Thu", tier: "High", prev: "3.4%", est: "3.3%", actual: "3.3%", surprise: "up",   note: "In-line; September cut odds up" },
  { ev: "Retail Sales (May)",  date: "Jun 14", day: "Fri", tier: "High", prev: "0.4%", est: "0.2%", actual: "0.1%", surprise: "down", note: "Consumer spending softening" },
  { ev: "UMich Sentiment",     date: "Jun 14", day: "Fri", tier: "Med",  prev: "69.1", est: "72",   actual: "65.6", surprise: "down", note: "Inflation expectations ticked up" },
];

const CAL_THIS: MacroEvent[] = [
  { ev: "FOMC Decision",       date: "Jun 18", day: "Wed", tier: "High", prev: "5.50%", est: "5.50%", actual: "5.50%",  surprise: "",     note: "Hold expected; dot-plot key" },
  { ev: "FOMC Press Conf.",    date: "Jun 18", day: "Wed", tier: "High", prev: "—",     est: "—",      actual: "—",      surprise: "",     note: "Powell tone drives reaction" },
  { ev: "Jobless Claims",      date: "Jun 20", day: "Thu", tier: "Med",  prev: "215K",  est: "220K",   actual: "—",      surprise: "",     note: "" },
  { ev: "Philadelphia Fed",    date: "Jun 20", day: "Thu", tier: "Med",  prev: "4.5",   est: "5.0",    actual: "—",      surprise: "",     note: "" },
  { ev: "Existing Home Sales", date: "Jun 21", day: "Fri", tier: "Low",  prev: "4.14M", est: "4.10M",  actual: "—",      surprise: "",     note: "" },
];

const CAL_NEXT: MacroEvent[] = [
  { ev: "GDP Q1 (3rd est.)",   date: "Jun 27", day: "Thu", tier: "High", prev: "1.6%",  est: "1.5%",  actual: "—", surprise: "", note: "Final revision rarely moves markets" },
  { ev: "PCE Deflator (May)",  date: "Jun 28", day: "Fri", tier: "High", prev: "2.7%",  est: "2.6%",  actual: "—", surprise: "", note: "Fed's preferred inflation gauge" },
  { ev: "Consumer Confidence", date: "Jun 25", day: "Tue", tier: "Med",  prev: "102.0", est: "100.5", actual: "—", surprise: "", note: "" },
  { ev: "Durable Goods",       date: "Jun 26", day: "Wed", tier: "Med",  prev: "-0.8%", est: "0.5%",  actual: "—", surprise: "", note: "" },
  { ev: "Jobless Claims",      date: "Jun 27", day: "Thu", tier: "Med",  prev: "220K",  est: "218K",  actual: "—", surprise: "", note: "" },
  { ev: "Chicago PMI",         date: "Jun 28", day: "Fri", tier: "Low",  prev: "35.4",  est: "40.0",  actual: "—", surprise: "", note: "" },
];

const CALS = [CAL_LAST, CAL_THIS, CAL_NEXT];

const DIV_DATA = [
  ['AAPL', 'May 13', 'May 16', '$0.25', '0.53%'],
  ['MSFT', 'May 16', 'Jun 13', '$0.75', '0.72%'],
  ['HD',   'Jun 06', 'Jun 20', '$2.25', '2.63%'],
  ['AVGO', 'Jun 21', 'Jun 28', '$5.25', '1.50%'],
];

export function MacroScreen() {
  const [tab, setTab] = useState(1);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Macro &amp; Rates</div>
          <h1 className="page-title">Macro Dashboard</h1>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === tab ? " on" : ""}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="dash" style={{ alignItems: "stretch" }}>
        {/* col-4: Market regime + VIX */}
        <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div className="card-h"><h3>Market regime</h3></div>
            <div className="card-b" style={{ textAlign: "center", padding: "22px 15px" }}>
              <div className="gauge-lbl up" style={{ fontSize: "1.3rem" }}>Risk-On Rally</div>
              <p style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", marginTop: 10, lineHeight: 1.5 }}>
                Breadth strong, yields easing, cyclicals leading defensives. Updated daily from internals, yield behaviour and sector rotation.
              </p>
            </div>
          </div>

          <div className="card vix" style={{ flex: 1 }}>
            <div className="card-h"><h3>VIX</h3></div>
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span className="big">14.18</span>
                <span className="mono down" style={{ fontWeight: 600 }}>▼ -2.51%</span>
              </div>
              <div className="pctl" style={{ marginTop: 10 }}><i style={{ width: "22%" }} /></div>
              <div className="note" style={{ marginTop: 8 }}>
                VIX at 14 is low — calm, risk-on conditions and cheap hedging.
              </div>
            </div>
          </div>
        </div>

        {/* col-8: Economic calendar */}
        <div className="col-8" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Economic calendar</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                {CALS[tab].length} events
              </span>
            </div>
            <div className="tbl-wrap" style={{ flex: 1 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Impact</th>
                    <th className="num">Prior</th>
                    <th className="num">Est.</th>
                    <th className="num">Actual</th>
                    <th className="num">Surprise</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {CALS[tab].map(e => (
                    <tr key={e.ev + e.date}>
                      <td>
                        <b style={{ color: "var(--text-hi)" }}>{e.ev}</b>
                        {e.tier === "High" && <span style={{ color: "var(--warn)", fontSize: ".6rem", marginLeft: 5 }}>●</span>}
                      </td>
                      <td>
                        <div>{e.date}</div>
                        <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)" }}>{e.day}</div>
                      </td>
                      <td>
                        <span className={`pill ${e.tier === "High" ? "dn" : e.tier === "Med" ? "amc" : ""}`}
                          style={e.tier === "Low" ? { background: "var(--surface-3)", color: "var(--text-dim-solid)" } : undefined}>
                          {e.tier}
                        </span>
                      </td>
                      <td className="num">{e.prev}</td>
                      <td className="num">{e.est}</td>
                      <td className={`num ${e.actual !== "—" ? (e.surprise === "up" ? "up" : e.surprise === "down" ? "down" : "") : ""}`}>
                        <b>{e.actual}</b>
                      </td>
                      <td className="num">
                        {e.surprise === "up" && <span className="up">▲ Beat</span>}
                        {e.surprise === "down" && <span className="down">▼ Miss</span>}
                        {e.surprise === "" && e.actual === "—" && <span style={{ color: "var(--text-dim-solid)" }}>Pending</span>}
                      </td>
                      <td style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", maxWidth: 140 }}>{e.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Dividend calendar — full width */}
      <div className="dash" style={{ marginTop: 14 }}>
        <div className="col-12">
          <div className="card">
            <div className="card-h">
              <h3>Dividend &amp; ex-div dates</h3>
              <span className="link">My holdings →</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Ex-date</th>
                    <th>Pay date</th>
                    <th className="num">Amount</th>
                    <th className="num">Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {DIV_DATA.map(([sym, exDate, payDate, amt, yld]) => (
                    <tr key={sym}>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--text-hi)" }}>{sym}</td>
                      <td>{exDate}</td>
                      <td>{payDate}</td>
                      <td className="num">{amt}</td>
                      <td className="num up">{yld}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
