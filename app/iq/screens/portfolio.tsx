"use client";

import { useIQActions } from "../shell";
import { folio } from "../data";
import { fmt, cls, arr, Spark } from "../utils";

export function PortfolioScreen() {
  const { openStock } = useIQActions();

  const rows = folio.map(f => ({
    ...f,
    value: f.qty * f.px,
    cost: f.qty * f.avg,
    gain: f.qty * (f.px - f.avg),
    gainPct: (f.px - f.avg) / f.avg * 100,
  }));

  const totalVal = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalGain = totalVal - totalCost;
  const totalGainPct = totalGain / totalCost * 100;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Portfolio Pulse</div>
          <div className="page-sub">{folio.length} positions · Updated May 24, 2025</div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "14px 18px" }}>
        {[
          { l: "Total Value", v: `$${fmt(totalVal)}`, sub: "", c: 0 },
          { l: "Total Cost Basis", v: `$${fmt(totalCost)}`, sub: "", c: 0 },
          { l: "Total Gain / Loss", v: `${totalGain >= 0 ? "+" : ""}$${fmt(Math.abs(totalGain))}`, sub: `${Math.abs(totalGainPct).toFixed(1)}%`, c: totalGain },
          { l: "Day Change (est.)", v: `+$${fmt(totalVal * 0.0073)}`, sub: "+0.73%", c: 1 },
        ].map(card => (
          <div key={card.l} className="card">
            <div className="card-b">
              <div style={{ fontSize: 10.5, color: "var(--text-dim-solid)", marginBottom: 4 }}>{card.l}</div>
              <div className={`${cls(card.c)}`} style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                {card.v}
              </div>
              {card.sub && <div style={{ fontSize: 11, color: "var(--text-dim-solid)", marginTop: 2 }}>{card.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div style={{ padding: "0 18px 18px" }}>
        <div className="card">
          <div className="card-h"><h3>Holdings</h3></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Sector</th>
                  <th>Qty</th>
                  <th>Avg Cost</th>
                  <th>Current Px</th>
                  <th>Gain/Loss %</th>
                  <th>Gain/Loss $</th>
                  <th>Value</th>
                  <th>Weight</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.s} onClick={() => openStock(r.s)}>
                    <td><span className={`sym ${cls(r.gainPct)}`}>{r.s}</span></td>
                    <td style={{ color: "var(--text-hi)" }}>{r.n}</td>
                    <td><span className="pill flat">{r.sec}</span></td>
                    <td className="mono">{r.qty}</td>
                    <td className="mono">${r.avg}</td>
                    <td className="mono" style={{ color: "var(--text-hi)", fontWeight: 600 }}>${r.px}</td>
                    <td>
                      <span className={cls(r.gainPct)} style={{ fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                        {arr(r.gainPct)} {Math.abs(r.gainPct).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={cls(r.gain)} style={{ fontFamily: "var(--f-mono)", fontWeight: 600 }}>
                        {r.gain >= 0 ? "+" : ""}${fmt(Math.abs(r.gain))}
                      </span>
                    </td>
                    <td className="mono" style={{ color: "var(--text-hi)" }}>${fmt(r.value)}</td>
                    <td className="mono" style={{ color: "var(--text-dim-solid)" }}>
                      {(r.value / totalVal * 100).toFixed(1)}%
                    </td>
                    <td><Spark seed={i + 10} up={r.gainPct >= 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Allocation bar */}
      <div style={{ padding: "0 18px 18px" }}>
        <div className="card">
          <div className="card-h"><h3>Sector Allocation</h3></div>
          <div className="card-b">
            {Object.entries(
              rows.reduce((acc, r) => {
                acc[r.sec] = (acc[r.sec] ?? 0) + r.value;
                return acc;
              }, {} as Record<string, number>)
            )
              .sort((a, b) => b[1] - a[1])
              .map(([sec, val]) => {
                const pct = val / totalVal * 100;
                return (
                  <div key={sec} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--text-dim-solid)", width: 70 }}>{sec}</div>
                    <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 99 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand)", borderRadius: 99 }} />
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--text-hi)", width: 40, textAlign: "right" }}>
                      {pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
