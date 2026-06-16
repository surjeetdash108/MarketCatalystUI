"use client";

import { useState } from "react";

const TABS = ["Last week", "This week", "Next week"];

const CAL: [string, string, string, string | number, string | number, string | number, string][] = [
  ['CPI (May)',      'May 14', 'High',  3.4, 3.3, 3.3, 'up'],
  ['Retail Sales',  'May 16', 'Med',   0.4, 0.2, 0.1, 'down'],
  ['FOMC Minutes',  'May 22', 'High',  '—', '—', '—', ''],
  ['Jobless Claims','May 23', 'Med',   220, 215,  '—', ''],
  ['GDP (Q1, rev)', 'May 30', 'High',  1.6, 1.5,  '—', ''],
];

const IPO_DATA = [
  ['Reddit',       'RDDT', 'Priced', '$31–34', '$748M'],
  ['Astera Labs',  'ALAB', 'Priced', '$32–36', '$534M'],
  ['Rubrik',       'RBRK', 'May 23', '$28–31', '$713M'],
  ['ServiceTitan', 'TTAN', 'TBD',    '—',      '—'    ],
];

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

      <div className="dash">
        {/* col-4: Market regime + VIX */}
        <div className="col-4">
          <div className="card">
            <div className="card-h"><h3>Market regime</h3></div>
            <div className="card-b" style={{ textAlign: "center", padding: "22px 15px" }}>
              <div className="gauge-lbl up" style={{ fontSize: "1.3rem" }}>Risk-On Rally</div>
              <p style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", marginTop: 10, lineHeight: 1.5 }}>
                Breadth strong, yields easing, cyclicals leading defensives. Updated daily from internals, yield behaviour and sector rotation.
              </p>
            </div>
          </div>

          <div className="card vix" style={{ marginTop: 14 }}>
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
        <div className="col-8">
          <div className="card">
            <div className="card-h"><h3>Economic calendar</h3></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Tier</th>
                    <th className="num">Prev</th>
                    <th className="num">Est.</th>
                    <th className="num">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {CAL.map(([ev, date, tier, prev, est, actual, actCls]) => (
                    <tr key={ev}>
                      <td><b style={{ color: "var(--text-hi)" }}>{ev}</b></td>
                      <td>{date}</td>
                      <td>
                        <span className={`pill ${tier === "High" ? "dn" : "amc"}`}>{tier}</span>
                      </td>
                      <td className="num">{prev}</td>
                      <td className="num">{est}</td>
                      <td className={`num ${actCls}`}>{actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* IPO + Dividend calendars */}
      <div className="dash" style={{ marginTop: 14 }}>
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>IPO &amp; spin-off calendar</h3>
              <span className="link">All →</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Symbol</th>
                    <th>Date</th>
                    <th className="num">Price range</th>
                    <th className="num">Raise</th>
                  </tr>
                </thead>
                <tbody>
                  {IPO_DATA.map(([co, sym, date, range, raise]) => (
                    <tr key={sym} style={{ cursor: "pointer" }}>
                      <td><b style={{ color: "var(--text-hi)" }}>{co}</b></td>
                      <td className="mono" style={{ fontWeight: 700 }}>{sym}</td>
                      <td>{date}</td>
                      <td className="num">{range}</td>
                      <td className="num">{raise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-6">
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
