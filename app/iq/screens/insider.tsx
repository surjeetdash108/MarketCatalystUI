"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit as fbLimit } from "firebase/firestore";
import { firebaseDb } from "../../firebase";
import { useIQActions } from "../shell";
import { StockLogo, DataState, isEmptyState } from "../utils";
import { useCollection } from "../hooks/useCollection";

// ---- types ----
type InsFilter   = "All" | "Buys" | "Sells";
type InsSort     = "value" | "date";
type DrawerState = { kind: "insider"; sym: string } | { kind: "fund"; fund: FundHoldingDoc } | null;

// ---- Firestore doc shapes (see backend/src/sync/sec-13f.job.ts and sec-form4.job.ts) ----
interface InsiderTxDoc {
  id: string; ticker: string; issuerName: string | null; ownerName: string | null; isOfficer: boolean;
  officerTitle: string | null; transactionDate: string; transactionCode: string;
  acquiredOrDisposed: "A" | "D" | string; shares: number; pricePerShare: number | null;
}
interface FundHoldingDoc {
  id: string; fundName: string; latestFilingDate: string; latestAccessionNumber: string;
  totalPositions: number; totalValue: number;
}
interface PositionDoc { id: string; cusip: string; nameOfIssuer: string; value: number; shares: number; }

// A single Form 4 row, derived entirely from a real insider_transactions doc.
interface FeedRow {
  id: string; ticker: string; role: string; detail: string;
  dir: "buy" | "sell"; valNum: number; date: string;
}

function fmtValue(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
async function fetchPositions(cik: string, accessionNumber: string): Promise<PositionDoc[]> {
  const col = collection(firebaseDb, `fund_holdings/${cik}/filings/${accessionNumber}/positions`);
  const snap = await getDocs(query(col, orderBy("value", "desc"), fbLimit(25)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PositionDoc);
}

// ---- insider stock drawer (real Form 4 filings only) ----
function InsiderDrawer({ sym, liveTxns, onClose, onOpenFull }: {
  sym: string; liveTxns: InsiderTxDoc[]; onClose: () => void; onOpenFull: (s: string) => void;
}) {
  const liveForSym = liveTxns
    .filter(x => x.ticker === sym)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const nBuy  = liveForSym.filter(x => x.acquiredOrDisposed === "A").length;
  const nSell = liveForSym.filter(x => x.acquiredOrDisposed === "D").length;
  const read  = nBuy > nSell
    ? `Net insider buying in ${sym} across recent Form 4 filings.`
    : nSell > nBuy
    ? `Net insider selling in ${sym} across recent Form 4 filings.`
    : `Mixed insider activity in ${sym}.`;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="side-drawer">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#1f6b4d,#0e3a2a)", color: "#5ff0b3" }}>{sym[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>{sym}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Insider activity · SEC Form 4 filings</div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-b">
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <span className="pill up">{nBuy} buy filing{nBuy !== 1 ? "s" : ""}</span>
            <span className="pill dn">{nSell} sell filing{nSell !== 1 ? "s" : ""}</span>
          </div>

          <div className="ai-sec"><div className="h">SEC EDGAR Form 4 filings</div></div>
          {liveForSym.length ? liveForSym.map((x) => (
            <div key={x.id} className="minirow" style={{ alignItems: "flex-start" }}>
              <span className="tr-badge" style={{ background: x.acquiredOrDisposed === "A" ? "var(--up)22" : "var(--down)22", color: x.acquiredOrDisposed === "A" ? "var(--up)" : "var(--down)", flexShrink: 0 }}>
                {x.acquiredOrDisposed === "A" ? "BUY" : "SELL"}
              </span>
              <span className="mid" style={{ marginLeft: 8 }}>
                <b style={{ color: "var(--text-hi)" }}>{x.ownerName ?? "Unknown filer"}</b>
                {x.officerTitle && <span style={{ color: "var(--text-dim-solid)" }}> · {x.officerTitle}</span>}
                <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                  {x.shares.toLocaleString()} sh{x.pricePerShare ? ` @ $${x.pricePerShare.toFixed(2)}` : ""} · {x.transactionDate}
                </div>
              </span>
              {x.pricePerShare != null && (
                <span className={`r ${x.acquiredOrDisposed === "A" ? "up" : "down"}`}>
                  {x.acquiredOrDisposed === "A" ? "+" : "−"}{fmtValue(x.shares * x.pricePerShare)}
                </span>
              )}
            </div>
          )) : (
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>No synced Form 4 filings for {sym}.</div>
          )}

          <div className="ai-block" style={{ marginTop: 16 }}>
            <div className="card-h"><h3>Summary</h3></div>
            <div className="card-b">
              <p style={{ fontSize: ".84rem", lineHeight: 1.55, color: "var(--text)" }}>
                {read} Clusters of multiple insiders carry more signal than a single filing. Filed data only — informational, not investment advice.
              </p>
            </div>
          </div>
          <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={() => { onClose(); onOpenFull(sym); }}>
            Open full stock page →
          </button>
        </div>
      </div>
    </>
  );
}

// ---- fund drawer: a tracked 13F fund's real top positions ----
function FundDrawer({ fund, onClose }: { fund: FundHoldingDoc; onClose: () => void }) {
  const [positions, setPositions] = useState<PositionDoc[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!fund.latestAccessionNumber) { setPositions([]); return; }
      const rows = await fetchPositions(fund.id, fund.latestAccessionNumber);
      if (alive) setPositions(rows);
    })();
    return () => { alive = false; };
  }, [fund.id, fund.latestAccessionNumber]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="side-drawer">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#3a2f6b,#241c44)", color: "var(--brand-2)" }}>{fund.fundName[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>{fund.fundName}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>13F · filed {fund.latestFilingDate}</div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-b">
          <div className="metric-grid" style={{ marginBottom: 14 }}>
            <div className="m"><div className="k">13F value</div><div className="v">{fmtValue(fund.totalValue)}</div></div>
            <div className="m"><div className="k">Positions</div><div className="v">{fund.totalPositions}</div></div>
          </div>
          <div className="ai-sec"><div className="h">Top positions · by reported value</div></div>
          {positions === null ? (
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "8px 0" }}>Loading positions…</div>
          ) : positions.length === 0 ? (
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "8px 0" }}>No positions found for this filing.</div>
          ) : positions.map((p) => (
            <div key={p.id} className="minirow">
              <span className="mid">
                <b style={{ color: "var(--text-hi)" }}>{p.nameOfIssuer}</b>
                <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{p.shares.toLocaleString()} sh · CUSIP {p.cusip}</div>
              </span>
              <span className="r">{fmtValue(p.value)}</span>
            </div>
          ))}
          <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 14 }}>
            13F filings are reported with a lag — positioning context, not a real-time signal.
          </p>
        </div>
      </div>
    </>
  );
}

// ============================================================
export function InsiderScreen() {
  const { openStockFull } = useIQActions();
  const [view,       setView]       = useState<"insider" | "13f">("insider");
  const [insFilter,  setInsFilter]  = useState<InsFilter>("All");
  const [insSearch,  setInsSearch]  = useState("");
  const [insSort,    setInsSort]    = useState<InsSort>("value");
  const [drawer,     setDrawer]     = useState<DrawerState>(null);

  const { data: liveInsiderTx, loading: insLoading, error: insError } = useCollection<InsiderTxDoc>("insider_transactions");
  const { data: liveFunds, loading: fundLoading, error: fundError } = useCollection<FundHoldingDoc>("fund_holdings");

  // Real cross-fund overlap (CUSIP-matched across live 13F positions).
  const [liveOverlap, setLiveOverlap] = useState<Array<{ cusip: string; name: string; funds: string[] }> | null>(null);
  useEffect(() => {
    if (view !== "13f" || liveOverlap !== null || liveFunds.length === 0) return;
    (async () => {
      const byCusip = new Map<string, { name: string; funds: string[] }>();
      for (const f of liveFunds) {
        if (!f.latestAccessionNumber) continue;
        const positions = await fetchPositions(f.id, f.latestAccessionNumber);
        for (const p of positions) {
          const existing = byCusip.get(p.cusip);
          if (existing) existing.funds.push(f.fundName);
          else byCusip.set(p.cusip, { name: p.nameOfIssuer, funds: [f.fundName] });
        }
      }
      setLiveOverlap([...byCusip.entries()].map(([cusip, v]) => ({ cusip, ...v })).filter(x => x.funds.length >= 2).sort((a, b) => b.funds.length - a.funds.length));
    })();
  }, [view, liveFunds, liveOverlap]);

  const openIns = (sym: string) => setDrawer({ kind: "insider", sym });

  // The feed IS the real Form 4 data — no mock rows.
  const feed: FeedRow[] = liveInsiderTx.map(x => ({
    id: x.id,
    ticker: x.ticker,
    role: x.officerTitle ?? x.ownerName ?? "Filer",
    detail: `${x.acquiredOrDisposed === "A" ? "acquired" : "disposed"} ${x.shares.toLocaleString()} sh${x.pricePerShare ? ` @ $${x.pricePerShare.toFixed(2)}` : ""}`,
    dir: x.acquiredOrDisposed === "A" ? "buy" : "sell",
    valNum: x.pricePerShare != null ? x.shares * x.pricePerShare : 0,
    date: x.transactionDate,
  }));

  const insQ = insSearch.trim().toUpperCase();
  const list = feed
    .filter(x => {
      if (insQ && !x.ticker.toUpperCase().includes(insQ)) return false;
      if (insFilter === "Buys")  return x.dir === "buy";
      if (insFilter === "Sells") return x.dir === "sell";
      return true;
    })
    .sort((a, b) => insSort === "date" ? b.date.localeCompare(a.date) : b.valNum - a.valNum);

  // most active by $ volume — from the real feed
  const agg: Record<string, { n: number; buy: number; sell: number }> = {};
  feed.forEach(x => {
    if (!agg[x.ticker]) agg[x.ticker] = { n: 0, buy: 0, sell: 0 };
    agg[x.ticker].n++;
    if (x.dir === "buy") agg[x.ticker].buy += x.valNum; else agg[x.ticker].sell += x.valNum;
  });
  const active = Object.entries(agg)
    .map(([s, o]) => ({ s, n: o.n, gross: o.buy + o.sell, net: o.buy - o.sell }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 6);

  const funds = [...liveFunds].sort((a, b) => b.totalValue - a.totalValue);

  return (
    <>
      {/* ---- tabs ---- */}
      <div className="tabs" style={{ marginBottom: 14, alignSelf: "flex-start" }}>
        <button className={`tab${view === "insider" ? " active" : ""}`} onClick={() => setView("insider")}>Insider activity</button>
        <button className={`tab${view === "13f" ? " active" : ""}`} onClick={() => setView("13f")}>13F institutional</button>
      </div>

      {/* ======================================================== INSIDER ACTIVITY */}
      {view === "insider" && (
        <>
          {active.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-h">
                <h3>Most active by insider $ volume</h3>
                <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>tap a name for all its filings</span>
              </div>
              <div className="card-b" style={{ paddingTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {active.map(o => (
                  <button key={o.s} className="tr-pill" onClick={() => openIns(o.s)}>
                    <StockLogo sym={o.s} size={18} />
                    <span className="tr-tk">{o.s}</span>
                    <span className="tr-mt">{o.n} filing{o.n > 1 ? "s" : ""} · {o.net >= 0 ? "net +" : "net −"}{fmtValue(Math.abs(o.net))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fbar" style={{ marginBottom: 12 }}>
            {(["All", "Buys", "Sells"] as InsFilter[]).map(c => (
              <button key={c} className={`chip${insFilter === c ? " on" : ""}`} onClick={() => setInsFilter(c)}>{c}</button>
            ))}
            <input value={insSearch} onChange={e => setInsSearch(e.target.value)} placeholder="Search ticker…" style={{ marginLeft: 8, background: "var(--surface-3)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "5px 10px", color: "var(--text)", fontSize: ".78rem", width: "9rem" }} />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center", marginRight: 6 }}>Sort</span>
            <button className={`chip${insSort === "value" ? " on" : ""}`} onClick={() => setInsSort("value")}>Value</button>
            <button className={`chip${insSort === "date"  ? " on" : ""}`} onClick={() => setInsSort("date")}>Date</button>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>{insFilter === "All" ? "All activity" : insFilter} · {list.length} filings</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)" }}>SEC Form 4 · live</span>
            </div>
            <div className="card-b" style={{ paddingTop: 2, overflowX: "auto" }}>
              {feed.length === 0 ? (
                <DataState
                  loading={insLoading}
                  error={insError}
                  empty={isEmptyState(insLoading, insError, feed.length)}
                  label="insider filings"
                  emptyMsg="No SEC Form 4 filings have synced yet."
                  subMsg="Insider filings sync from SEC EDGAR on a rolling schedule."
                />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ticker</th><th>Side</th><th>Insider / owner</th><th>Transaction</th>
                      <th className="num">Value</th><th className="num">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr><td colSpan={6} style={{ color: "var(--text-dim-solid)", padding: 16 }}>No filings match this filter.</td></tr>
                    ) : list.map((x) => (
                      <tr key={x.id} data-sym={x.ticker} onClick={() => openIns(x.ticker)} style={{ cursor: "pointer" }}>
                        <td>
                          <div className="co">
                            <span className="s"><StockLogo sym={x.ticker} size={20} />{x.ticker}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tr-badge" style={{ background: x.dir === "buy" ? "var(--up)22" : "var(--down)22", color: x.dir === "buy" ? "var(--up)" : "var(--down)" }}>
                            {x.dir === "buy" ? "BUY" : "SELL"}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "normal", lineHeight: 1.4 }}>{x.role}</td>
                        <td style={{ whiteSpace: "normal", lineHeight: 1.4, color: "var(--text-dim-solid)" }}>{x.detail}</td>
                        <td className="num"><b className={x.dir === "buy" ? "up" : "down"}>{x.valNum > 0 ? `${x.dir === "buy" ? "+" : "−"}${fmtValue(x.valNum)}` : "—"}</b></td>
                        <td className="num" style={{ color: "var(--text-dim-solid)" }}>{x.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 10 }}>
            Real SEC Form 4 filings via EDGAR. Click any row for that company&#8217;s filings. Informational only — not investment advice.
          </p>
        </>
      )}

      {/* ======================================================== 13F INSTITUTIONAL */}
      {view === "13f" && (
        <>
          <div style={{ margin: "0 0 10px", fontSize: ".74rem", textTransform: "uppercase" as const, letterSpacing: ".06em", color: "var(--text-dim-solid)", fontWeight: 700 }}>
            Tracked funds · latest 13F filings
          </div>

          {funds.length === 0 ? (
            <DataState
              loading={fundLoading}
              error={fundError}
              empty={isEmptyState(fundLoading, fundError, funds.length)}
              label="13F fund filings"
              emptyMsg="No 13F fund filings have synced yet."
              subMsg="Institutional 13F filings sync from SEC EDGAR on a rolling schedule."
            />
          ) : (
            <>
              <div className="dash" style={{ marginBottom: 14 }}>
                {funds.map((f) => (
                  <div key={f.id} className="col-4">
                    <div className="fundcard" onClick={() => setDrawer({ kind: "fund", fund: f })}>
                      <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 12 }}>
                        <div className="av">{f.fundName.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div className="nm">{f.fundName}</div>
                          <div className="mgr">Filed {f.latestFilingDate}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontFamily: "var(--f-mono)", fontSize: ".78rem" }}>
                        <div>
                          <div style={{ color: "var(--text-dim-solid)", fontSize: ".62rem", fontFamily: "var(--f-body)" }}>13F value</div>
                          <b style={{ color: "var(--text-hi)" }}>{fmtValue(f.totalValue)}</b>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-dim-solid)", fontSize: ".62rem", fontFamily: "var(--f-body)" }}>Positions</div>
                          <b style={{ color: "var(--text-hi)" }}>{f.totalPositions}</b>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 11, alignItems: "center" }}>
                        <span className="link" style={{ marginLeft: "auto" }}>View positions →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-h"><h3>Cross-fund overlap · CUSIP-matched across tracked 13F filings</h3></div>
                <div className="card-b">
                  {liveOverlap === null ? (
                    <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", padding: "6px 0" }}>Computing overlap…</div>
                  ) : liveOverlap.length === 0 ? (
                    <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", padding: "6px 0" }}>No positions are held by 2+ tracked funds yet.</div>
                  ) : liveOverlap.slice(0, 12).map(o => (
                    <div key={o.cusip} className="minirow">
                      <span className="mid">
                        <b style={{ color: "var(--text-hi)" }}>{o.name}</b>
                        <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)" }}>{o.funds.join(", ")}</div>
                      </span>
                      <span className="r">{o.funds.length} funds</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ---- drawers ---- */}
      {drawer?.kind === "insider" && (
        <InsiderDrawer sym={drawer.sym} liveTxns={liveInsiderTx} onClose={() => setDrawer(null)} onOpenFull={openStockFull} />
      )}
      {drawer?.kind === "fund" && (
        <FundDrawer fund={drawer.fund} onClose={() => setDrawer(null)} />
      )}
    </>
  );
}
