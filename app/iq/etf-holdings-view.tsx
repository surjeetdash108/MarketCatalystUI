"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useApiResource } from "./hooks/useApiResource";
import { useIQActions } from "./shell";
import { StockLogo, VendorTag, DataState, NotAvailable } from "./utils";

export interface EtfHoldingItem {
  asset: string;
  name: string;
  isin?: string | null;
  securityCusip?: string | null;
  sharesNumber?: number | null;
  weightPercentage: number;
  marketValue?: number | null;
}

export interface EtfHoldingsDoc {
  symbol: string;
  name: string;
  etfType: "stock" | "bond" | "commodity" | "crypto";
  asOfDate: string;
  source: "fmp" | "issuer";
  holdingsCount: number;
  top10Concentration: number;
  aum?: number | null;
  expenseRatio?: number | null;
  nav?: number | null;
  weightingNote?: string | null;
  sectors?: Array<{ sector: string; weight: number }>;
  singleAssetStats?: {
    assetName: string;
    unitsHeld?: number | null;
    unitLabel?: string;
    description?: string;
  } | null;
  holdings: EtfHoldingItem[];
  updatedAt: string;
}

interface EtfHoldingsViewProps {
  symbol: string;
}

function formatDateDisplay(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    if (!y || !m || !d) return isoDate;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function isOlderThanDays(isoDate: string, days: number): boolean {
  try {
    const parsed = new Date(isoDate).getTime();
    if (isNaN(parsed)) return false;
    const diffDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
    return diffDays > days;
  } catch {
    return false;
  }
}

export function EtfHoldingsView({ symbol }: EtfHoldingsViewProps) {
  const sym = symbol.toUpperCase().trim();
  const { openStock } = useIQActions();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalPage, setModalPage] = useState(0);

  const { data, loading, error } = useApiResource<EtfHoldingsDoc>(
    `/market-data/etf-holdings?symbol=${encodeURIComponent(sym)}`,
  );

  const isBond = data?.etfType === "bond";
  const isCommodity = data?.etfType === "commodity";
  const isCrypto = data?.etfType === "crypto";
  const isStock = !isBond && !isCommodity && !isCrypto;

  // Filtered & paginated for modal
  const filteredModalHoldings = useMemo(() => {
    if (!data?.holdings) return [];
    const q = modalSearch.trim().toLowerCase();
    if (!q) return data.holdings;
    return data.holdings.filter(
      (h) =>
        h.asset.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        (h.isin && h.isin.toLowerCase().includes(q)) ||
        (h.securityCusip && h.securityCusip.toLowerCase().includes(q)),
    );
  }, [data?.holdings, modalSearch]);

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filteredModalHoldings.length / PAGE_SIZE));
  const currentPage = Math.min(modalPage, totalPages - 1);
  const pagedHoldings = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredModalHoldings.slice(start, start + PAGE_SIZE);
  }, [filteredModalHoldings, currentPage]);

  if (loading) {
    return <DataState loading label={`Loading portfolio holdings for ${sym}…`} height={260} />;
  }

  if (error || !data || !data.holdings || data.holdings.length === 0) {
    return (
      <div className="card" style={{ padding: "24px 20px" }}>
        <div style={{ color: "var(--text-dim-solid)", fontSize: ".86rem" }}>
          Portfolio holdings data is currently unavailable for {sym}.
        </div>
      </div>
    );
  }

  const top10 = data.holdings.slice(0, 10);
  const maxWeight = Math.max(...top10.map((h) => h.weightPercentage || 0), 1);
  const asOfFormatted = formatDateDisplay(data.asOfDate);
  const isStale = isOlderThanDays(data.asOfDate, 7);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. Summary Bar */}
      <div
        className="card"
        style={{
          padding: "14px 18px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "var(--surface-1, #0D1117)",
          border: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-dim-solid)" }}>
              Total Holdings
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)", marginTop: 2 }}>
              {data.holdingsCount.toLocaleString()}
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: "var(--border-soft, rgba(255,255,255,0.08))" }} />

          <div>
            <div style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-dim-solid)" }}>
              Top 10 Concentration
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--brand, #38BDF8)", marginTop: 2 }}>
              {data.top10Concentration.toFixed(2)}%
            </div>
          </div>

          {data.aum != null && data.aum > 0 && (
            <>
              <div style={{ width: 1, height: 28, background: "var(--border-soft, rgba(255,255,255,0.08))" }} />
              <div>
                <div style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-dim-solid)" }}>
                  Assets Under Mgmt
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)", marginTop: 2 }}>
                  ${(data.aum / 1e9).toFixed(1)}B
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sector chips for Stock ETFs */}
        {data.sectors && data.sectors.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", maxWidth: 640 }}>
            {data.sectors.slice(0, 4).map((s) => (
              <span
                key={s.sector}
                style={{
                  fontSize: ".7rem",
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
                  color: "var(--text-hi)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{s.sector}</span>
                <span style={{ color: "var(--text-dim-solid)", fontWeight: 600 }}>{s.weight}%</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Weighting Note Banner (DIA, QQEW) */}
      {data.weightingNote && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            color: "var(--text-hi)",
            fontSize: ".78rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: "1rem" }}>ℹ</span>
          <span>{data.weightingNote}</span>
        </div>
      )}

      {/* 3. Single-Asset Card (Commodity: GLD, Crypto: IBIT) */}
      {(isCommodity || isCrypto) && data.singleAssetStats && (
        <div
          className="card"
          style={{
            padding: "20px",
            background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid var(--border-soft, rgba(255,255,255,0.12))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.4rem" }}>{isCommodity ? "🪙" : "₿"}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-hi)" }}>
                  {data.singleAssetStats.assetName}
                </h3>
                <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Underlying Primary Asset
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: ".88rem",
                fontWeight: 700,
                color: "var(--brand, #38BDF8)",
                background: "rgba(56, 189, 248, 0.12)",
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              100.0% Allocation
            </span>
          </div>

          <p style={{ margin: "0 0 14px", fontSize: ".82rem", color: "var(--text-dim-solid)", lineHeight: 1.5 }}>
            {data.singleAssetStats.description}
          </p>

          {data.singleAssetStats.unitsHeld != null && data.singleAssetStats.unitsHeld > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 6,
                border: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
                fontSize: ".78rem",
              }}
            >
              <span style={{ color: "var(--text-dim-solid)" }}>Total Vault Reserves:</span>
              <span style={{ color: "var(--text-hi)", fontWeight: 700 }} className="mono">
                {data.singleAssetStats.unitsHeld.toLocaleString()} {data.singleAssetStats.unitLabel || "units"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. Top 10 Holdings Table */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Table Header Row */}
        <div
          className="card-h"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 700, color: "var(--text-hi)" }}>
              Top 10 Holdings
            </h3>
            <VendorTag v="fmp" />
          </div>
{/* 
          {data.holdingsCount > 10 && (
            <button
              type="button"
              onClick={() => {
                setModalSearch("");
                setModalPage(0);
                setModalOpen(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--brand, #38BDF8)",
                fontSize: ".82rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              className="link"
            >
              View Holdings →
            </button>
          )} */}
        </div>

        {/* Table Headings */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr 110px 160px",
            padding: "8px 18px",
            fontSize: ".68rem",
            textTransform: "uppercase",
            letterSpacing: ".05em",
            fontWeight: 600,
            color: "var(--text-dim-solid)",
            background: "rgba(255,255,255,0.015)",
            borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
          }}
        >
          <div>#</div>
          <div>{isBond ? "Bond / Issuer" : "Company"}</div>
          <div style={{ textAlign: "left" }}>Symbol</div>
          <div style={{ textAlign: "right" }}>% of Total Net Assets</div>
        </div>

        {/* Top 10 Rows */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {top10.map((h, idx) => {
            const hasStockLink = isStock && h.asset && !h.asset.includes(" ") && !h.asset.startsWith("USD");
            const barWidth = Math.max(3, Math.min(100, (h.weightPercentage / maxWeight) * 100));

            return (
              <div
                key={h.asset + idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 110px 160px",
                  padding: "10px 18px",
                  alignItems: "center",
                  borderBottom:
                    idx < top10.length - 1 ? "1px solid var(--border-soft, rgba(255,255,255,0.04))" : "none",
                  transition: "background 0.15s ease",
                  cursor: hasStockLink ? "pointer" : "default",
                }}
                className={hasStockLink ? "hover-row" : ""}
                onClick={() => {
                  if (hasStockLink) {
                    openStock(h.asset);
                  }
                }}
              >
                {/* Rank */}
                <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid)" }} className="mono">
                  {idx + 1}
                </div>

                {/* Company Name & Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, paddingRight: 12 }}>
                  {hasStockLink && <StockLogo sym={h.asset} size={22} />}
                  <span
                    style={{
                      fontSize: ".82rem",
                      fontWeight: 500,
                      color: "var(--text-hi)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={h.name || h.asset}
                  >
                    {h.name || h.asset}
                  </span>
                </div>

                {/* Symbol */}
                <div>
                  <span
                    style={{
                      fontSize: ".78rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: hasStockLink ? "rgba(56, 189, 248, 0.1)" : "rgba(255,255,255,0.05)",
                      color: hasStockLink ? "var(--brand, #38BDF8)" : "var(--text-dim-solid)",
                      display: "inline-block",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    className="mono"
                  >
                    {h.asset}
                  </span>
                </div>

                {/* Weight Percentage + Inline Accent Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      maxWidth: 80,
                      height: 5,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                    title={`${h.weightPercentage}%`}
                  >
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: "linear-gradient(90deg, var(--brand, #38BDF8) 0%, rgba(56, 189, 248, 0.7) 100%)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: ".82rem",
                      fontWeight: 700,
                      color: "var(--text-hi)",
                      minWidth: 52,
                      textAlign: "right",
                    }}
                    className="mono"
                  >
                    {h.weightPercentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table Footer with As Of Date and View All Link */}
        <div
          style={{
            padding: "10px 18px",
            background: "rgba(255,255,255,0.01)",
            borderTop: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>As of {asOfFormatted}</span>
            {isStale && (
              <span style={{ fontSize: ".68rem", color: "#F59E0B", fontStyle: "italic" }}>
                · (Issuer filings update periodically)
              </span>
            )}
          </div>

          {data.holdingsCount > 10 && (
            <span
              className="link"
              onClick={() => {
                setModalSearch("");
                setModalPage(0);
                setModalOpen(true);
              }}
              style={{
                fontSize: ".78rem",
                color: "var(--brand, #38BDF8)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              View All Holdings →
            </span>
          )}
        </div>
      </div>

      {/* 5. Complete Holdings Modal */}
      {modalOpen && (
        <>
          {/* Backdrop Scrim */}
          <div
            className="scrim"
            onClick={() => setModalOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
            }}
          />

          {/* Modal Container */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1001,
              width: "min(780px, 94vw)",
              maxHeight: "88vh",
              background: "var(--surface-1, #0D1117)",
              border: "1px solid var(--border-soft, rgba(255,255,255,0.12))",
              borderRadius: 14,
              boxShadow: "0 24px 60px -10px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              color: "var(--text-hi)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface-2, rgba(255,255,255,0.02))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <StockLogo sym={sym} size={32} />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text-hi)" }}>
                    {sym} Portfolio Holdings
                  </h3>
                  <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                    {data.holdingsCount.toLocaleString()} Total Holdings · As of {asOfFormatted}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim-solid)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  lineHeight: 1,
                  borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div
              style={{
                padding: "10px 20px",
                borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
                background: "rgba(255,255,255,0.01)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <input
                type="text"
                placeholder="Search holding by symbol or company name…"
                value={modalSearch}
                onChange={(e) => {
                  setModalSearch(e.target.value);
                  setModalPage(0);
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: ".82rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-soft, rgba(255,255,255,0.12))",
                  borderRadius: 6,
                  color: "var(--text-hi)",
                  outline: "none",
                }}
              />
              <span style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", whiteSpace: "nowrap" }}>
                {filteredModalHoldings.length} results
              </span>
            </div>

            {/* Modal Table Headings */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 110px 110px 130px",
                padding: "8px 20px",
                fontSize: ".68rem",
                textTransform: "uppercase",
                letterSpacing: ".05em",
                fontWeight: 600,
                color: "var(--text-dim-solid)",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
              }}
            >
              <div>#</div>
              <div>Company / Asset</div>
              <div>Symbol</div>
              <div style={{ textAlign: "right" }}>Shares</div>
              <div style={{ textAlign: "right" }}>% Net Assets</div>
            </div>

            {/* Modal Scrollable Table Body */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 280, maxHeight: "55vh" }}>
              {pagedHoldings.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-dim-solid)", fontSize: ".84rem" }}>
                  No holdings match &ldquo;{modalSearch}&rdquo;
                </div>
              ) : (
                pagedHoldings.map((h, idx) => {
                  const globalIdx = currentPage * PAGE_SIZE + idx + 1;
                  const hasStockLink = isStock && h.asset && !h.asset.includes(" ") && !h.asset.startsWith("USD");

                  return (
                    <div
                      key={h.asset + globalIdx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 1fr 110px 110px 130px",
                        padding: "9px 20px",
                        alignItems: "center",
                        borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.03))",
                        cursor: hasStockLink ? "pointer" : "default",
                      }}
                      className={hasStockLink ? "hover-row" : ""}
                      onClick={() => {
                        if (hasStockLink) {
                          setModalOpen(false);
                          openStock(h.asset);
                        }
                      }}
                    >
                      <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)" }} className="mono">
                        {globalIdx}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, paddingRight: 10 }}>
                        {hasStockLink && <StockLogo sym={h.asset} size={20} />}
                        <span
                          style={{
                            fontSize: ".8rem",
                            color: "var(--text-hi)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={h.name || h.asset}
                        >
                          {h.name || h.asset}
                        </span>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: ".74rem",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: hasStockLink ? "rgba(56, 189, 248, 0.1)" : "rgba(255,255,255,0.04)",
                            color: hasStockLink ? "var(--brand, #38BDF8)" : "var(--text-dim-solid)",
                            display: "inline-block",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          className="mono"
                        >
                          {h.asset}
                        </span>
                      </div>

                      <div style={{ textAlign: "right", fontSize: ".76rem", color: "var(--text-dim-solid)" }} className="mono">
                        {h.sharesNumber != null ? h.sharesNumber.toLocaleString() : "—"}
                      </div>

                      <div style={{ textAlign: "right", fontSize: ".8rem", fontWeight: 700, color: "var(--text-hi)" }} className="mono">
                        {h.weightPercentage.toFixed(2)}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Pagination Footer */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: "10px 20px",
                  borderTop: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
                  background: "var(--surface-2, rgba(255,255,255,0.02))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid)" }}>
                  Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredModalHoldings.length)} of {filteredModalHoldings.length}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setModalPage((p) => Math.max(0, p - 1))}
                    style={{
                      padding: "4px 10px",
                      fontSize: ".76rem",
                      borderRadius: 5,
                      background: currentPage === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                      color: currentPage === 0 ? "var(--text-dim-solid)" : "var(--text-hi)",
                      border: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
                      cursor: currentPage === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: ".76rem", color: "var(--text-hi)", minWidth: 60, textAlign: "center" }}>
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setModalPage((p) => Math.min(totalPages - 1, p + 1))}
                    style={{
                      padding: "4px 10px",
                      fontSize: ".76rem",
                      borderRadius: 5,
                      background: currentPage >= totalPages - 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                      color: currentPage >= totalPages - 1 ? "var(--text-dim-solid)" : "var(--text-hi)",
                      border: "1px solid var(--border-soft, rgba(255,255,255,0.1))",
                      cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
