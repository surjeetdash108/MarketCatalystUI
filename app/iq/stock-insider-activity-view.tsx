"use client";

import { useState, useMemo } from "react";
import { useApiList } from "./hooks/useApiList";
import type { InsiderTxDoc } from "./types";
import { DataState, NotAvailable, StockLogo, VendorTag, formatUsDate } from "./utils";

type InsFilter = "All" | "Buys" | "Sells";
type InsSort = "value" | "date";

interface FormattedTx {
  id: string;
  s: string;
  dir: "buy" | "sell" | "other";
  role: string;
  det: string;
  valUsd: number | null;
  date: string;
  shares: number;
  price: number | null;
  code: string;
}

function fmtValue(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function StockInsiderActivityView({ symbol }: { symbol: string }) {
  const [insFilter, setInsFilter] = useState<InsFilter>("All");
  const [insSort, setInsSort] = useState<InsSort>("date");
  const [insDir, setInsDir] = useState<"asc" | "desc">("desc");
  const [insQuery, setInsQuery] = useState("");
  const [insPage, setInsPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: rawTxns, loading } = useApiList<InsiderTxDoc>("/market-data/insider-transactions");

  // Clean data and filter to this stock
  const stockTxns = useMemo(() => {
    return rawTxns
      .filter(x => x.ticker === symbol)
      .map(x => {
        const cleanPrice =
          x.pricePerShare != null && x.pricePerShare > 0 && x.pricePerShare <= 1_000_000
            ? x.pricePerShare
            : null;
        return { ...x, pricePerShare: cleanPrice };
      });
  }, [rawTxns, symbol]);

  const FEED: FormattedTx[] = useMemo(() => {
    return stockTxns
      .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""))
      .map(x => {
        const isOpenMarket = x.transactionCode === "P" || x.transactionCode === "S";
        const val =
          isOpenMarket && x.pricePerShare != null && x.shares > 0
            ? x.shares * x.pricePerShare
            : null;
        const isBuy = x.transactionCode === "P";
        const isSell = x.transactionCode === "S";
        const dir: "buy" | "sell" | "other" = isBuy ? "buy" : isSell ? "sell" : "other";

        const owner = x.ownerName ?? "Insider";
        const title = x.officerTitle ? ` · ${x.officerTitle}` : x.isOfficer ? " · Officer" : "";
        const role = `${owner}${title}`;

        const codeMap: Record<string, string> = {
          P: "Open-market purchase",
          S: "Open-market sale",
          A: "Grant / award",
          D: "Disposition to issuer",
          F: "Tax withholding",
          M: "Option exercise",
          G: "Gift",
        };
        const codeLabel = codeMap[x.transactionCode] ?? `Code ${x.transactionCode}`;
        const priceStr = x.pricePerShare != null ? ` @ $${x.pricePerShare.toFixed(2)}` : "";
        const det = `${codeLabel} · ${Math.round(x.shares).toLocaleString("en-US")} sh${priceStr}`;

        return {
          id: x.id,
          s: x.ticker,
          dir,
          role,
          det,
          valUsd: val,
          date: (x.transactionDate ?? "").slice(0, 10),
          shares: x.shares,
          price: x.pricePerShare,
          code: x.transactionCode,
        };
      });
  }, [stockTxns]);

  // Aggregate stats — open-market purchases (P) and sales (S) only per SEC rule
  const nBuy = stockTxns.filter(x => x.transactionCode === "P").length;
  const nSell = stockTxns.filter(x => x.transactionCode === "S").length;

  let totalBuyVal = 0;
  let totalSellVal = 0;
  FEED.forEach(x => {
    if (x.valUsd != null) {
      if (x.dir === "buy") totalBuyVal += x.valUsd;
      else if (x.dir === "sell") totalSellVal += x.valUsd;
    }
  });
  const netDollarVolume = totalBuyVal - totalSellVal;

  const read =
    nBuy > nSell ? (
      <>
        Net <b className="up">insider buying</b> in {symbol} — insiders adding is generally a constructive signal.
      </>
    ) : nSell > nBuy ? (
      <>
        Net <b className="down">insider selling</b> in {symbol} — often diversification, but worth monitoring if it clusters.
      </>
    ) : (
      <>Mixed insider activity in {symbol}.</>
    );

  // Filter & sort
  const filteredList = useMemo(() => {
    let out = FEED;
    if (insFilter === "Buys") out = out.filter(x => x.dir === "buy");
    else if (insFilter === "Sells") out = out.filter(x => x.dir === "sell");

    if (insQuery.trim()) {
      const q = insQuery.trim().toLowerCase();
      out = out.filter(x => x.role.toLowerCase().includes(q) || x.det.toLowerCase().includes(q));
    }

    return [...out].sort((a, b) => {
      const cmp =
        insSort === "date"
          ? (a.date ?? "").localeCompare(b.date ?? "")
          : (a.valUsd ?? 0) - (b.valUsd ?? 0);
      return insDir === "desc" ? -cmp : cmp;
    });
  }, [FEED, insFilter, insQuery, insSort, insDir]);

  const pageCount = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const pageClamped = Math.min(insPage, pageCount - 1);
  const pagedRows = filteredList.slice(pageClamped * PAGE_SIZE, pageClamped * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(col: InsSort) {
    if (insSort === col) {
      setInsDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setInsDir("desc");
    }
  }

  function setSortBy(col: InsSort) {
    setInsSort(col);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header and Aggregate Readout Card */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StockLogo sym={symbol} size={26} />
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>
                Insider Activity · {symbol}
              </h2>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)", fontSize: ".72rem" }}>
                SEC EDGAR Form 4
              </span>
            </div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
              Tracking Form 4 insider transactions, officer &amp; director filings, and net transaction momentum
            </div>
          </div>
          <VendorTag v="sec" />
        </div>

        {/* 4 Summary Metric Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
        }}>
          {/* Readout Insight */}
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "12px 14px", gridColumn: "span 2" }}>
            <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>
              Insider Sentiment &amp; Net Signal
            </div>
            <div style={{ fontSize: ".86rem", lineHeight: 1.5, color: "var(--text-hi)", marginTop: 6 }}>
              {read} Clusters of multiple insiders carry more signal than a single filing.
            </div>
          </div>

          {/* Buy vs Sell Count */}
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>
              Filings Breakdown
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span className="pill up" style={{ fontSize: ".72rem" }}>{nBuy} buy{nBuy !== 1 ? "s" : ""}</span>
              <span className="pill dn" style={{ fontSize: ".72rem" }}>{nSell} sell{nSell !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 6 }}>
              {FEED.length} total filings on file
            </div>
          </div>

          {/* Net Dollar Volume */}
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "12px 14px" }}>
            <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>
              Net $ Volume (Open Market)
            </div>
            <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: 6, color: netDollarVolume >= 0 ? "var(--up)" : "var(--down)" }}>
              {netDollarVolume >= 0 ? "+" : "−"}${Math.abs(netDollarVolume / 1e6).toFixed(1)}M
            </div>
            <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
              Buys: ${(totalBuyVal / 1e6).toFixed(1)}M · Sells: ${(totalSellVal / 1e6).toFixed(1)}M
            </div>
          </div>
        </div>
      </div>

      {/* Main Filings Feed Card */}
      <div className="card">
        {/* Filter bar */}
        <div className="card-h" style={{ flexWrap: "wrap", gap: 10, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(["All", "Buys", "Sells"] as InsFilter[]).map(c => (
              <button
                key={c}
                className={`chip ${insFilter === c ? "on" : ""}`}
                onClick={() => { setInsFilter(c); setInsPage(0); }}
                style={{ fontSize: ".72rem", padding: "4px 10px" }}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
            <input
              value={insQuery}
              onChange={e => { setInsQuery(e.target.value); setInsPage(0); }}
              placeholder="Search insider name or role…"
              style={{
                width: 240,
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                padding: "4px 10px",
                fontSize: ".75rem",
                color: "var(--text-hi)",
                outline: "none",
              }}
            />
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
              {filteredList.length} filing{filteredList.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card-b" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 36 }}>
              <DataState loading label={`Loading Form 4 insider transactions for ${symbol}...`} />
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ padding: 36 }}>
              <DataState label={insQuery ? `No filings match "${insQuery}".` : `No Form 4 insider filings recorded for ${symbol}.`} />
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%", fontSize: ".8rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border-soft)" }}>
                    <th
                      className="num"
                      style={{ textAlign: "left", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("date")}
                      title="Sort by date"
                    >
                      Date <span style={{ color: "var(--brand-2)", opacity: insSort === "date" ? 1 : 0.3 }}>{insSort === "date" && insDir === "asc" ? "▲" : "▼"}</span>
                    </th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Ticker</th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Insider / Owner</th>
                    <th style={{ textAlign: "left", padding: "10px 14px" }}>Transaction</th>
                    <th
                      className="num"
                      style={{ textAlign: "right", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("value")}
                      title="Sort by dollar value"
                    >
                      Value <span style={{ color: "var(--brand-2)", opacity: insSort === "value" ? 1 : 0.3 }}>{insSort === "value" && insDir === "asc" ? "▲" : "▼"}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((x, i) => (
                    <tr key={`${x.id}-${i}`} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                      <td className="num mono" style={{ textAlign: "left", padding: "10px 14px", color: "var(--text-dim-solid)" }}>
                        {formatUsDate(x.date)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StockLogo sym={x.s} size={20} />
                          <span className="mono" style={{ fontWeight: 700, color: "var(--text-hi)" }}>{x.s}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 14px" }}>
                        <span
                          style={{
                            color:
                              x.dir === "buy"
                                ? "var(--up, #10b981)"
                                : x.dir === "sell"
                                ? "var(--down, #ef4444)"
                                : "var(--text-dim-solid)",
                            fontWeight: 700,
                            fontSize: ".74rem",
                          }}
                        >
                          {x.dir === "buy" ? "Buy" : x.dir === "sell" ? "Sell" : x.code ? `Code ${x.code}` : "Other"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "normal", lineHeight: 1.4 }}>
                        <b style={{ color: "var(--text-hi)" }}>{x.role}</b>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "normal", lineHeight: 1.4, color: "var(--text-dim-solid)" }}>
                        {x.det}
                      </td>
                      <td className="num mono" style={{ textAlign: "right", padding: "10px 14px" }}>
                        {x.valUsd != null ? (
                          <b className={x.dir === "buy" ? "up" : "down"}>
                            {x.dir === "buy" ? "+" : "−"}{fmtValue(x.valUsd)}
                          </b>
                        ) : (
                          <NotAvailable />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredList.length > PAGE_SIZE && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid var(--border-soft)",
              flexWrap: "wrap",
              gap: 10,
            }}>
              <span style={{ fontSize: ".74rem", color: "var(--text-dim-solid)" }}>
                Showing {pageClamped * PAGE_SIZE + 1}–{Math.min((pageClamped + 1) * PAGE_SIZE, filteredList.length)} of {filteredList.length} filings
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="chip"
                  disabled={pageClamped === 0}
                  onClick={() => setInsPage(p => Math.max(0, p - 1))}
                  style={{ opacity: pageClamped === 0 ? 0.4 : 1, cursor: pageClamped === 0 ? "default" : "pointer" }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", minWidth: 80, textAlign: "center" }}>
                  Page {pageClamped + 1} of {pageCount}
                </span>
                <button
                  className="chip"
                  disabled={pageClamped >= pageCount - 1}
                  onClick={() => setInsPage(p => Math.min(pageCount - 1, p + 1))}
                  style={{ opacity: pageClamped >= pageCount - 1 ? 0.4 : 1, cursor: pageClamped >= pageCount - 1 ? "default" : "pointer" }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", padding: "4px 8px" }}>
        Real SEC Form 4 filings via EDGAR. Informational only — not investment advice.
      </div>
    </div>
  );
}
