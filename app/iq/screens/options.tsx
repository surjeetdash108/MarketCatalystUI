"use client";

import { useState } from "react";
import { fmt, sign, cls, arr, StockLogo, DataState, isEmptyState } from "../utils";
import { useCollection } from "../hooks/useCollection";

interface LiveOptionContract {
  contractTicker: string;
  contractType: "call" | "put";
  strike: number;
  expirationDate: string;
  lastClose: number | null;
  lastVolume: number | null;
  lastBarDate: string | null;
  // Per-contract OHLCV. Authorized on the current Polygon plan even though the
  // options SNAPSHOT (greeks/IV/OI/bid-ask) returns NOT_AUTHORIZED — so this is
  // real traded data, not a substitute for the quote fields we cannot get.
  lastOpen: number | null;
  lastHigh: number | null;
  lastLow: number | null;
  lastVwap: number | null;
  lastTradeCount: number | null;
  lastRangePct: number | null;
}
interface OptionsChainDoc {
  id: string;
  underlyingTicker: string;
  contracts: LiveOptionContract[];
  note: string;
}
interface CompanyDoc {
  id: string; ticker: string; name: string | null; price: number | null; pctChange: number | null;
}

export function OptionsScreen() {
  // Only real option data is shown. A full chain with greeks / IV / open-interest
  // / bid-ask needs Polygon's Options Advanced plan (the snapshot endpoint returns
  // NOT_AUTHORIZED here); what IS authorized is per-contract OHLCV, so that is what
  // this screen renders — no simulated/greeks chain.
  const { data: liveChains, loading, error } = useCollection<OptionsChainDoc>("options_chains");
  const { data: companies } = useCollection<CompanyDoc>("companies");
  const byTicker = new Map(companies.map(c => [c.ticker, c]));

  const [selSym, setSelSym] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // The underlyings we actually have live option data for.
  const underlyings = [...liveChains]
    .map(ch => {
      const c = byTicker.get(ch.underlyingTicker);
      return {
        s: ch.underlyingTicker,
        n: c?.name ?? ch.underlyingTicker,
        p: c?.price ?? null,
        c: c?.pctChange ?? null,
        count: ch.contracts.length,
      };
    })
    .sort((a, b) => (a.s < b.s ? -1 : 1));

  const effectiveSel = selSym ?? underlyings[0]?.s ?? null;
  const cur = underlyings.find(u => u.s === effectiveSel) ?? null;
  const liveChain = liveChains.find(c => c.underlyingTicker === effectiveSel);
  const filtered = query
    ? underlyings.filter(s => (s.s + " " + s.n).toLowerCase().includes(query.toLowerCase()))
    : underlyings;

  if (underlyings.length === 0) {
    return (
      <div style={{ padding: 18 }}>
        <DataState
          loading={loading}
          error={error}
          empty={isEmptyState(loading, error, underlyings.length)}
          label="options data"
          emptyMsg="No option chains have synced yet."
          subMsg="Per-contract options data syncs on a rolling schedule for a subset of tickers."
        />
      </div>
    );
  }

  return (
    <div className="opt-wrap">
      {/* ─── Left sidebar ─── */}
      <aside className="opt-side">
        <div className="opt-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          <input
            placeholder="Search stocks"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="opt-list">
          {filtered.map(o => (
            <div
              key={o.s}
              className={`opt-li${o.s === effectiveSel ? " sel" : ""}`}
              onClick={() => setSelSym(o.s)}
            >
              <StockLogo sym={o.s} size={26} />
              <div className="opt-li-tx">
                <div className="opt-li-s">{o.s}</div>
                <div className="opt-li-n">{o.n}</div>
              </div>
              <div className={`opt-li-r ${o.c == null ? "" : cls(o.c)}`}>{o.c == null ? "—" : sign(o.c)}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "14px 10px", fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
              No stocks match &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main chain ─── */}
      <div className="opt-main">
        {cur && (
          <div className="opt-h">
            <StockLogo sym={cur.s} size={36} />
            <div className="opt-h-tx">
              <div className="opt-h-s">
                {cur.s} <span className="opt-h-n">{cur.n}</span>
              </div>
              <div className="opt-h-p">
                {cur.p == null ? "—" : `$${fmt(cur.p)}`}{" "}
                {cur.c != null && <span className={cls(cur.c)}>{arr(cur.c)} {sign(cur.c)}</span>}
              </div>
            </div>
            <div className="opt-h-meta">
              {liveChain ? `${liveChain.contracts.length} contracts` : ""}
            </div>
          </div>
        )}

        {liveChain && liveChain.contracts.length > 0 ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>Options · {cur?.s} · per-contract OHLCV</h3>
              <span className="pill ai" style={{ fontSize: ".68rem" }}>live · Polygon (delayed)</span>
            </div>
            {liveChain.note && (
              <div style={{ padding: "0 14px 6px", fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                {liveChain.note}
              </div>
            )}
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th><th className="num">Strike</th><th>Expiration</th>
                    <th className="num">Open</th><th className="num">High</th><th className="num">Low</th>
                    <th className="num">Last close</th><th className="num">VWAP</th>
                    <th className="num">Range</th><th className="num">Volume</th>
                    <th className="num">Trades</th><th>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {[...liveChain.contracts]
                    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate) || a.strike - b.strike)
                    .map(c => {
                      const px = (v: number | null) => v != null ? `$${v.toFixed(2)}` : "—";
                      return (
                        <tr key={c.contractTicker}>
                          <td className={c.contractType === "call" ? "up" : "down"}>{c.contractType}</td>
                          <td className="num">{c.strike}</td>
                          <td>{c.expirationDate}</td>
                          <td className="num">{px(c.lastOpen)}</td>
                          <td className="num">{px(c.lastHigh)}</td>
                          <td className="num">{px(c.lastLow)}</td>
                          <td className="num">{px(c.lastClose)}</td>
                          <td className="num">{px(c.lastVwap)}</td>
                          <td className="num">{c.lastRangePct != null ? `${c.lastRangePct.toFixed(1)}%` : "—"}</td>
                          <td className="num">{c.lastVolume ?? "—"}</td>
                          <td className="num">{c.lastTradeCount ?? "—"}</td>
                          <td style={{ fontSize: ".76rem", color: "var(--text-dim-solid)" }}>{c.lastBarDate ?? "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <DataState
            loading={loading}
            error={error}
            empty={isEmptyState(loading, error, 0)}
            label={`options for ${cur?.s ?? "this ticker"}`}
            emptyMsg="No contracts synced for this ticker yet."
          />
        )}
      </div>
    </div>
  );
}
