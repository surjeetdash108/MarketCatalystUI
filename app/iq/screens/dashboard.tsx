"use client";

import { useIQActions } from "../shell";
import { pulse, wmn, movers, earnings, folio, analyst } from "../data";
import { fmt, sign, cls, arr, Spark, Gauge } from "../utils";

export function DashboardScreen() {
  const { openStock, openEarnings, openSector, setCopilot } = useIQActions();

  const totalVal = folio.reduce((s, f) => s + f.qty * f.px, 0);
  const totalCost = folio.reduce((s, f) => s + f.qty * f.avg, 0);
  const totalGain = totalVal - totalCost;
  const totalGainPct = (totalGain / totalCost) * 100;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Market Intelligence — May 24, 2025</div>
        </div>
        <div className="actions">
          <button className="chip ai-c" onClick={() => setCopilot(true)}>✦ AI Summary</button>
        </div>
      </div>

      <div className="dash">
        {/* Market Pulse */}
        <div className="col-12">
          <div className="card">
            <div className="pulse">
              {pulse.slice(0, 6).map((x, i) => (
                <div key={x.l} className="p">
                  <div className="lbl">{x.l}</div>
                  <div className="val">{fmt(x.v, x.v > 1000 ? 0 : 2)}</div>
                  <div className={`chg ${cls(x.c)}`}>{arr(x.c)} {Math.abs(x.c).toFixed(2)}%</div>
                  <Spark seed={i + 1} up={x.c >= 0} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* What Matters Now */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>What Matters Now</h3>
              <span className="more">6 stories</span>
            </div>
            <div className="card-b">
              <div className="wmn-grid">
                {wmn.map((w, i) => (
                  <div key={i} className="wmn-card">
                    <div className={`wmn-tag ${w.tag}`}>{w.tag === "earn" ? "earnings" : w.tag}</div>
                    <div className="wmn-h">{w.h}</div>
                    <div className="wmn-t" dangerouslySetInnerHTML={{ __html: w.t }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Sentiment + VIX */}
        <div className="col-4">
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-h"><h3>AI Sentiment</h3></div>
            <Gauge v={62} label="62" color="var(--up)" sublabel="Fear & Greed — Greed" />
          </div>
          <div className="card">
            <div className="card-h"><h3>Volatility (VIX)</h3></div>
            <div className="vix-card">
              <div className="vix-lbl">VIX INDEX</div>
              <div className="vix-val">14.18</div>
              <div className="vix-sub">▼ 2.51% · Calm conditions</div>
            </div>
          </div>
        </div>

        {/* Today's Movers */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>Today&apos;s Movers</h3>
              <a className="more" href="/menu/movers">View all →</a>
            </div>
            <div className="card-b">
              {movers.slice(0, 6).map(m => (
                <div key={m.s} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openStock(m.s)}>
                  <span className="tkr">{m.s}</span>
                  <span className="mini-name">{m.n}</span>
                  <span className="mini-name" style={{ color: "var(--text-dim-solid)", fontSize: 11 }}>{m.reason}</span>
                  <span className={`pill ${m.c > 0 ? "up" : "dn"}`}>{arr(m.c)} {Math.abs(m.c).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Earnings */}
        <div className="col-4">
          <div className="card">
            <div className="card-h">
              <h3>Upcoming Earnings</h3>
              <a className="more" href="/menu/earnings">View all →</a>
            </div>
            <div className="card-b">
              {earnings.slice(0, 5).map(e => (
                <div key={e.s} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openEarnings(e.s)}>
                  <span className="tkr">{e.s}</span>
                  <span className="mini-name">{e.t}</span>
                  {e.epsA != null ? (
                    <span className={`pill ${e.epsA >= e.epsE ? "up" : "dn"}`}>
                      {e.epsA >= e.epsE ? "Beat" : "Miss"}
                    </span>
                  ) : (
                    <span className="pill flat">Upcoming</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Portfolio Snapshot */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>Portfolio Pulse</h3>
              <a className="more" href="/menu/portfolio">View all →</a>
            </div>
            <div className="card-b">
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim-solid)" }}>Total Value</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--f-mono)", color: "var(--text-hi)" }}>
                    ${fmt(totalVal)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim-solid)" }}>Total Gain</div>
                  <div className={`${cls(totalGain)}`} style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                    {arr(totalGain)} ${fmt(Math.abs(totalGain))} ({Math.abs(totalGainPct).toFixed(1)}%)
                  </div>
                </div>
              </div>
              {folio.slice(0, 4).map(f => {
                const gain = (f.px - f.avg) / f.avg * 100;
                return (
                  <div key={f.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(f.s)}>
                    <span className="tkr">{f.s}</span>
                    <span className="mini-name">{f.n}</span>
                    <span className="mini-val">${fmt(f.px)}</span>
                    <span className={`pill ${gain >= 0 ? "up" : "dn"}`}>{arr(gain)} {Math.abs(gain).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Analyst Actions */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>Analyst Actions</h3>
              <a className="more" href="/menu/analyst">View all →</a>
            </div>
            <div className="card-b">
              {analyst.slice(0, 4).map(a => (
                <div key={a.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(a.s)}>
                  <span className="tkr">{a.s}</span>
                  <span className="mini-name">{a.firm}</span>
                  <span style={{ fontSize: 11.5, color: a.type === "upgrade" ? "var(--up)" : a.type === "downgrade" ? "var(--down)" : "var(--brand-2)", fontWeight: 600 }}>
                    {a.type}
                  </span>
                  <span className="mini-val">${a.tgt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
