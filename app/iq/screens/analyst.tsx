"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { StockLogo, DataState, isEmptyState } from "../utils";
import { useCollection } from "../hooks/useCollection";

// The only redistributable analyst data on the current plan is a grades-consensus
// snapshot: a current Buy/Hold/Sell vote count per ticker. A per-firm
// upgrade/downgrade EVENT feed (with price targets and firm names) needs
// Polygon's Benzinga add-on — so this screen shows the real consensus and is
// honest that the per-firm history isn't available, rather than fabricating it.
interface ConsensusDoc {
  id: string; ticker: string; name?: string | null;
  strongBuy: number; buy: number; hold: number; sell: number; strongSell: number;
  consensus: string;
}

export function AnalystScreen() {
  const { openStock } = useIQActions();
  const { data: liveConsensus, loading, error } = useCollection<ConsensusDoc>("analyst_actions");
  const [buyLeaning, setBuyLeaning] = useState(false);

  const rows = [...liveConsensus]
    .filter(c => !buyLeaning || (c.strongBuy + c.buy) > (c.sell + c.strongSell))
    .sort((a, b) => (b.strongBuy + b.buy) - (a.strongBuy + a.buy));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-sub">Street consensus — the current Buy / Hold / Sell distribution per company</div>
        </div>
      </div>

      {/* Honest scope note — no fabricated per-firm event table. */}
      <div style={{
        margin: "0 0 12px", padding: "10px 14px", fontSize: ".76rem",
        color: "var(--text-dim-solid)", border: "1px solid var(--border-soft)",
        borderRadius: 8, background: "var(--surface-1)",
      }}>
        Showing the live grades-consensus snapshot. Individual firm upgrades/downgrades
        and price-target history are not available on the current data plan and are not shown.
      </div>

      <div className="fbar">
        <button className={`chip${buyLeaning ? " on" : ""}`} onClick={() => setBuyLeaning(o => !o)}>Buy-leaning</button>
        <div className="spacer" />
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{rows.length} companies</span>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <DataState
            loading={loading}
            error={error}
            empty={isEmptyState(loading, error, rows.length)}
            label="analyst consensus"
            emptyMsg="No analyst consensus has synced yet."
            subMsg="Consensus grades refresh on a rolling schedule — check back shortly."
          />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="num">Buy</th>
                  <th className="num">Hold</th>
                  <th className="num">Sell</th>
                  <th className="num">Total</th>
                  <th>Distribution</th>
                  <th>Consensus</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const buy = c.strongBuy + c.buy;
                  const sell = c.sell + c.strongSell;
                  const total = buy + c.hold + sell || 1;
                  return (
                    <tr key={c.ticker} onClick={() => openStock(c.ticker)} style={{ cursor: "pointer" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StockLogo sym={c.ticker} size={22} />
                          <div className="co">
                            <span className="s" style={{ fontFamily: "var(--f-mono)" }}>{c.ticker}</span>
                            {c.name && <span className="n">{c.name}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="num"><b style={{ color: "var(--up)" }}>{buy}</b></td>
                      <td className="num" style={{ color: "var(--text-dim-solid)" }}>{c.hold}</td>
                      <td className="num"><b style={{ color: sell > 0 ? "var(--down)" : "var(--text-dim-solid)" }}>{sell}</b></td>
                      <td className="num" style={{ color: "var(--text-dim-solid)" }}>{buy + c.hold + sell}</td>
                      <td style={{ minWidth: 110 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 1, height: 8 }}>
                          <span style={{ width: `${buy / total * 100}%`, minWidth: buy ? 3 : 0, height: 8, background: "var(--up)", borderRadius: 2 }} />
                          <span style={{ width: `${c.hold / total * 100}%`, minWidth: c.hold ? 3 : 0, height: 8, background: "var(--text-dim-solid)", opacity: .5, borderRadius: 2 }} />
                          <span style={{ width: `${sell / total * 100}%`, minWidth: sell ? 3 : 0, height: 8, background: "var(--down)", borderRadius: 2 }} />
                        </span>
                      </td>
                      <td>
                        <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)", fontWeight: 700 }}>{c.consensus}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
