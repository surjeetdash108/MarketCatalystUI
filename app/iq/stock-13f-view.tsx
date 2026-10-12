"use client";

import { useState, useEffect, useMemo } from "react";
import { apiGet } from "./backend";
import { DataState, NotAvailable, VendorTag, StockLogo } from "./utils";

export interface Institutional13FRow {
  cik: string;
  investorName: string;
  symbol: string;
  reportingQuarter: string;
  reportDate: string;
  filingDate: string;
  sharesNumber: number;
  lastSharesNumber: number;
  changeInShares: number;
  changeInSharesPct: number | null;
  marketValue: number | null;
  ownershipPct: number | null;
  activityStatus: "New" | "Increased" | "Reduced" | "Closed Position" | "Maintained";
  secFilingUrl: string;
}

export interface Stock13FResponse {
  symbol: string;
  selectedQuarter: string;
  year: number;
  quarter: number;
  availableQuarters: Array<{ year: number; quarter: number; label: string }>;
  holders: Institutional13FRow[];
  summary: {
    totalHolders: number;
    newPositions: number;
    increasedPositions: number;
    reducedPositions: number;
    closedPositions: number;
    totalSharesHeld: number;
    totalMarketValue: number;
  };
}

type ActivityFilter = "All" | "New" | "Increased" | "Reduced" | "Closed Position";
type SortCol = "shares" | "change" | "value" | "name" | "status";

function fmtCompact(val: number | null): string {
  if (val == null) return "—";
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

export function Stock13FFilingsView({ symbol }: { symbol: string }) {
  const [data, setData] = useState<Stock13FResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>("");

  // Filters & sorting
  const [filter, setFilter] = useState<ActivityFilter>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortCol>("shares");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let url = `/live/13f-filings?ticker=${encodeURIComponent(symbol)}`;
    if (selectedQuarterKey) {
      const [y, q] = selectedQuarterKey.split("-");
      if (y && q) url += `&year=${encodeURIComponent(y)}&quarter=${encodeURIComponent(q)}`;
    }

    apiGet<Stock13FResponse>(url)
      .then(res => {
        if (cancelled) return;
        setData(res);
        if (!selectedQuarterKey && res?.year && res?.quarter) {
          setSelectedQuarterKey(`${res.year}-${res.quarter}`);
        }
        setPage(0);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || "Failed to load 13F filings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol, selectedQuarterKey]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setPage(0);
  }, [filter, search, sortBy, sortDir]);

  const filteredHolders = useMemo(() => {
    if (!data?.holders) return [];
    return data.holders.filter(h => {
      if (filter !== "All" && h.activityStatus !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = h.investorName.toLowerCase().includes(q);
        const matchesCik = h.cik.includes(q);
        if (!matchesName && !matchesCik) return false;
      }
      return true;
    });
  }, [data?.holders, filter, search]);

  const sortedHolders = useMemo(() => {
    return [...filteredHolders].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "shares") {
        cmp = (a.sharesNumber ?? 0) - (b.sharesNumber ?? 0);
      } else if (sortBy === "change") {
        cmp = (a.changeInShares ?? 0) - (b.changeInShares ?? 0);
      } else if (sortBy === "value") {
        cmp = (a.marketValue ?? 0) - (b.marketValue ?? 0);
      } else if (sortBy === "name") {
        cmp = a.investorName.localeCompare(b.investorName);
      } else if (sortBy === "status") {
        cmp = a.activityStatus.localeCompare(b.activityStatus);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredHolders, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedHolders.length / PAGE_SIZE));
  const pagedHolders = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedHolders.slice(start, start + PAGE_SIZE);
  }, [sortedHolders, page]);

  function toggleSort(col: SortCol) {
    if (sortBy === col) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header Card */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StockLogo sym={symbol} size={26} />
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>
                13F Institutional Filings · {symbol}
              </h2>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--brand-2)", fontSize: ".72rem", fontWeight: 700 }}>
                {data?.selectedQuarter || "Quarterly 13F"}
              </span>
            </div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
              Quarterly SEC Form 13F filings detailing institutional ownership, share count changes, and position activity
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {data?.availableQuarters && data.availableQuarters.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>Reporting Quarter:</span>
                <select
                  value={selectedQuarterKey}
                  onChange={e => setSelectedQuarterKey(e.target.value)}
                  style={{
                    background: "var(--surface-1)",
                    color: "var(--text-hi)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    padding: "4px 10px",
                    fontSize: ".75rem",
                    fontFamily: "var(--f-mono)",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {data.availableQuarters.map(q => (
                    <option key={`${q.year}-${q.quarter}`} value={`${q.year}-${q.quarter}`}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <VendorTag v="fmp" />
            <VendorTag v="sec" />
          </div>
        </div>

        {/* 5 Summary KPI Cards */}
        {data?.summary && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}>
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
              <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>Total 13F Holders</div>
              <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-hi)", marginTop: 4 }}>
                {data.summary.totalHolders.toLocaleString()}
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2 }}>Reporting institutions</div>
            </div>

            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
              <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>New Positions</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--up)" }}>
                  {data.summary.newPositions.toLocaleString()}
                </span>
                <span className="pill up" style={{ fontSize: ".65rem" }}>NEW</span>
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2 }}>Initiated this quarter</div>
            </div>

            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
              <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>Increased</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--brand-2)" }}>
                  {data.summary.increasedPositions.toLocaleString()}
                </span>
                <span className="pill" style={{ fontSize: ".65rem", background: "rgba(0,180,216,0.15)", color: "var(--brand-2)" }}>ADDED</span>
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2 }}>Increased share count</div>
            </div>

            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
              <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>Reduced</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f59e0b" }}>
                  {data.summary.reducedPositions.toLocaleString()}
                </span>
                <span className="pill" style={{ fontSize: ".65rem", background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>TRIMMED</span>
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2 }}>Decreased share count</div>
            </div>

            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
              <div style={{ fontSize: ".68rem", textTransform: "uppercase", color: "var(--text-dim-solid)", fontWeight: 700 }}>Closed Positions</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--down)" }}>
                  {data.summary.closedPositions.toLocaleString()}
                </span>
                <span className="pill dn" style={{ fontSize: ".65rem" }}>EXITED</span>
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2 }}>Sold out completely</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Filings Table Card */}
      <div className="card">
        {/* Filter & Search Bar */}
        <div className="card-h" style={{ flexWrap: "wrap", gap: 10, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(["All", "New", "Increased", "Reduced", "Closed Position"] as ActivityFilter[]).map(c => (
              <button
                key={c}
                className={`chip ${filter === c ? "on" : ""}`}
                onClick={() => setFilter(c)}
                style={{ fontSize: ".72rem", padding: "4px 10px" }}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
            <input
              type="text"
              placeholder="Search investor (e.g. Vanguard, BlackRock)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                padding: "4px 10px",
                fontSize: ".75rem",
                color: "var(--text-hi)",
                outline: "none",
                width: 240,
              }}
            />
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
              {filteredHolders.length} matching holder{filteredHolders.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card-b" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 36 }}>
              <DataState loading label={`Loading quarterly 13F institutional filings for ${symbol}...`} />
            </div>
          ) : error ? (
            <div style={{ padding: 36 }}>
              <DataState label={`Error loading 13F filings: ${error}`} />
            </div>
          ) : sortedHolders.length === 0 ? (
            <div style={{ padding: 36 }}>
              <DataState label={search ? `No institutional investors match "${search}".` : `No Form 13F holdings recorded for ${symbol} in this quarter.`} />
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%", fontSize: ".8rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border-soft)" }}>
                    <th
                      style={{ textAlign: "left", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("name")}
                    >
                      Institutional Investor {sortBy === "name" && (sortDir === "desc" ? "▼" : "▲")}
                    </th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>
                      Quarter
                    </th>
                    <th
                      style={{ textAlign: "right", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("shares")}
                    >
                      Latest Shares {sortBy === "shares" && (sortDir === "desc" ? "▼" : "▲")}
                    </th>
                    <th style={{ textAlign: "right", padding: "10px 14px" }}>
                      Previous Shares
                    </th>
                    <th
                      style={{ textAlign: "right", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("change")}
                    >
                      Change in Holdings {sortBy === "change" && (sortDir === "desc" ? "▼" : "▲")}
                    </th>
                    <th
                      style={{ textAlign: "center", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("status")}
                    >
                      Activity Status {sortBy === "status" && (sortDir === "desc" ? "▼" : "▲")}
                    </th>
                    <th
                      style={{ textAlign: "right", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("value")}
                    >
                      Market Value {sortBy === "value" && (sortDir === "desc" ? "▼" : "▲")}
                    </th>
                    <th style={{ textAlign: "center", padding: "10px 14px" }}>
                      SEC Filing
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHolders.map((holder, idx) => {
                    const isNew = holder.activityStatus === "New";
                    const isClosed = holder.activityStatus === "Closed Position";
                    const isInc = holder.activityStatus === "Increased";
                    const isRed = holder.activityStatus === "Reduced";

                    const badgeBg = isNew
                      ? "rgba(34,197,94,0.15)"
                      : isClosed
                      ? "rgba(239,68,68,0.15)"
                      : isInc
                      ? "rgba(0,180,216,0.15)"
                      : isRed
                      ? "rgba(245,158,11,0.15)"
                      : "var(--surface-3)";

                    const badgeColor = isNew
                      ? "var(--up)"
                      : isClosed
                      ? "var(--down)"
                      : isInc
                      ? "var(--brand-2)"
                      : isRed
                      ? "#f59e0b"
                      : "var(--text-dim-solid)";

                    return (
                      <tr
                        key={`${holder.cik}-${idx}`}
                        style={{
                          borderBottom: "1px solid var(--border-soft)",
                          transition: "background .12s ease",
                        }}
                      >
                        {/* Investor Name */}
                        <td style={{ padding: "10px 14px" }}>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: ".82rem" }}>
                              {holder.investorName}
                            </div>
                            <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                              <span>CIK: {holder.cik || "—"}</span>
                              {holder.ownershipPct != null && (
                                <span>· {holder.ownershipPct.toFixed(2)}% of outstanding</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Quarter */}
                        <td style={{ textAlign: "center", padding: "10px 14px", color: "var(--text-dim-solid)", fontSize: ".75rem" }}>
                          <span className="mono">{holder.reportingQuarter}</span>
                        </td>

                        {/* Latest Shares */}
                        <td className="mono" style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600, color: "var(--text-hi)" }}>
                          {holder.sharesNumber != null ? holder.sharesNumber.toLocaleString("en-US") : "—"}
                        </td>

                        {/* Previous Shares */}
                        <td className="mono" style={{ textAlign: "right", padding: "10px 14px", color: "var(--text-dim-solid)" }}>
                          {holder.lastSharesNumber != null ? holder.lastSharesNumber.toLocaleString("en-US") : "—"}
                        </td>

                        {/* Change in Holdings */}
                        <td className="mono" style={{ textAlign: "right", padding: "10px 14px" }}>
                          <div>
                            <span style={{
                              fontWeight: 700,
                              color: holder.changeInShares > 0 ? "var(--up)" : holder.changeInShares < 0 ? "var(--down)" : "var(--text-dim-solid)",
                            }}>
                              {holder.changeInShares > 0 ? `+${holder.changeInShares.toLocaleString("en-US")}` : holder.changeInShares < 0 ? `${holder.changeInShares.toLocaleString("en-US")}` : "0"}
                            </span>
                            {holder.changeInSharesPct != null && (
                              <div style={{
                                fontSize: ".68rem",
                                color: holder.changeInSharesPct > 0 ? "var(--up)" : holder.changeInSharesPct < 0 ? "var(--down)" : "var(--text-dim-solid)",
                                marginTop: 1,
                              }}>
                                {holder.changeInSharesPct > 0 ? `+${holder.changeInSharesPct.toFixed(2)}%` : `${holder.changeInSharesPct.toFixed(2)}%`}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Activity Status */}
                        <td style={{ textAlign: "center", padding: "10px 14px" }}>
                          <span
                            className="pill"
                            style={{
                              background: badgeBg,
                              color: badgeColor,
                              fontWeight: 700,
                              fontSize: ".68rem",
                              letterSpacing: ".02em",
                              textTransform: "uppercase",
                              padding: "3px 8px",
                            }}
                          >
                            {holder.activityStatus}
                          </span>
                        </td>

                        {/* Market Value */}
                        <td className="mono" style={{ textAlign: "right", padding: "10px 14px", color: "var(--text-hi)" }}>
                          {holder.marketValue != null ? fmtCompact(holder.marketValue) : <NotAvailable />}
                        </td>

                        {/* SEC Filing Link */}
                        <td style={{ textAlign: "center", padding: "10px 14px" }}>
                          <a
                            href={holder.secFilingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="link"
                            style={{
                              fontSize: ".75rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              textDecoration: "none",
                            }}
                          >
                            SEC EDGAR ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {sortedHolders.length > PAGE_SIZE && (
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
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedHolders.length)} of {sortedHolders.length} institutional investors
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="chip"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  style={{ opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? "default" : "pointer" }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", minWidth: 80, textAlign: "center" }}>
                  Page {page + 1} of {pageCount}
                </span>
                <button
                  className="chip"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  style={{ opacity: page >= pageCount - 1 ? 0.4 : 1, cursor: page >= pageCount - 1 ? "default" : "pointer" }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SEC 13F Information Footer */}
      <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", lineHeight: 1.5, padding: "4px 8px" }}>
        Quarterly SEC Form 13F institutional ownership filings reflect fund manager equity holdings as of the fiscal quarter&#8217;s end, reported within 45 days. Shows regulatory position snapshots, not real-time intraday trading. Source: SEC EDGAR Form 13F.
      </div>
    </div>
  );
}
