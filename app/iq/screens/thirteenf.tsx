"use client";

import { useIQActions } from "../shell";
import { funds } from "../data";

export function ThirteenFScreen() {
  const { openFund, openStock } = useIQActions();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">13F Intelligence</div>
          <div className="page-sub">Major institutional filings · Q1 2025</div>
        </div>
      </div>

      <div style={{ padding: "14px 18px" }}>
        <div style={{
          background: "var(--ai-dim)", border: "1px solid var(--ai)", borderRadius: "var(--r-lg)",
          padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "var(--text)",
        }}>
          <span style={{ color: "var(--ai)", fontWeight: 700 }}>✦ AI Insight:</span> Institutional money flowed into semiconductors (+$24B net) and out of consumer discretionary (−$8B net) this quarter. Berkshire's Apple reduction continues while adding energy.
        </div>

        <div className="card">
          <div className="card-h"><h3>Major Fund Holdings</h3></div>
          <div className="card-b">
            {funds.map((f, i) => (
              <div key={f.name} className="fundcard" onClick={() => openFund(i)}>
                <div className="fn">{f.name}</div>
                <div className="ft">{f.ticker} · AUM {f.atm}</div>
                <div className="ftops">
                  {f.top.map(t => (
                    <div key={t} className="ftop"
                      onClick={e => { e.stopPropagation(); openStock(t); }}>{t}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notable moves */}
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-h"><h3>Notable Q1 Moves</h3></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Fund</th><th>Stock</th><th>Action</th><th>Shares</th><th>Value</th></tr>
              </thead>
              <tbody>
                {[
                  { fund: "Berkshire Hathaway", sym: "AAPL", action: "Reduced", shares: "−116M", val: "$22.2B" },
                  { fund: "Berkshire Hathaway", sym: "CVX", action: "Added", shares: "+2.3M", val: "$340M" },
                  { fund: "ARK Innovation", sym: "TSLA", action: "Added", shares: "+1.1M", val: "$185M" },
                  { fund: "Bridgewater", sym: "GLD", action: "Added", shares: "+4.2M", val: "$320M" },
                  { fund: "Vanguard 500", sym: "NVDA", action: "Added", shares: "+8.1M", val: "$8.3B" },
                ].map((row, i) => (
                  <tr key={i} onClick={() => openStock(row.sym)}>
                    <td style={{ color: "var(--text-dim-solid)", fontSize: 12 }}>{row.fund}</td>
                    <td><span className="sym">{row.sym}</span></td>
                    <td>
                      <span style={{
                        color: row.action === "Added" ? "var(--up)" : "var(--down)",
                        fontWeight: 600, fontSize: 12,
                      }}>{row.action}</span>
                    </td>
                    <td className="mono" style={{ color: row.action === "Added" ? "var(--up)" : "var(--down)" }}>{row.shares}</td>
                    <td className="mono" style={{ color: "var(--text-hi)" }}>{row.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
