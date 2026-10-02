"use client";

import { useEffect, useState, useMemo } from "react";
import { StockScreenEmbed } from "../shell";
import { StockLogo, VendorTag, DataState } from "../utils";
import { useApiResource } from "../hooks/useApiResource";

// Hardcoded original 16 Popular ETFs
const POPULAR_ETFS = [
  { symbol: "CIBR", name: "First Trust NASDAQ Cybersecurity ETF" },
  { symbol: "DIA", name: "State Street SPDR Dow Jones Industrial Average ETF" },
  { symbol: "GLD", name: "SPDR Gold Trust" },
  { symbol: "HACK", name: "Amplify Cybersecurity ETF" },
  { symbol: "HYG", name: "iShares iBoxx $ High Yield Corporate Bond ETF" },
  { symbol: "IBIT", name: "iShares Bitcoin Trust ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "QQEW", name: "First Trust NASDAQ-100 Equal Weighted Index Fund" },
  { symbol: "QQQ", name: "Invesco QQQ Trust, Series 1" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF" },
  { symbol: "SPY", name: "State Street SPDR S&P 500 ETF Trust" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
  { symbol: "XLE", name: "State Street Energy Select Sector SPDR ETF" },
  { symbol: "XLF", name: "State Street Financial Select Sector SPDR ETF" },
  { symbol: "XLK", name: "State Street Technology Select Sector SPDR ETF" },
];

export interface EtfFundItem {
  symbol: string;
  name: string;
  badge?: string;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  volume?: number | null;
  aum?: number | null;
  categories?: string[];
}

export interface EtfSection {
  id: string;
  label: string;
  funds: EtfFundItem[];
}

export interface EtfMarketResponse {
  updatedAt: number;
  source: string;
  categories: EtfSection[];
  largest: EtfFundItem[];
  equity: EtfFundItem[];
  bitcoin: EtfFundItem[];
  ethereum: EtfFundItem[];
  gold: EtfFundItem[];
  fixedIncome: EtfFundItem[];
  realEstate: EtfFundItem[];
  totalMarket: EtfFundItem[];
  commodities: EtfFundItem[];
  leveraged: EtfFundItem[];
}

const PAGE_SIZE = 100;

export function EtfMarketFunds() {
  const [query, setQuery] = useState("");
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>("largest");
  const [selectedFundTicker, setSelectedFundTicker] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);

  // Dynamic API-driven ETF Discovery & Classification dataset
  const { data: etfData, loading, error } = useApiResource<EtfMarketResponse>(
    "/live/etf-market",
    60_000
  );

  // Dynamic category buckets directly from backend classification engine
  const sections: EtfSection[] = useMemo(() => {
    return etfData?.categories ?? [];
  }, [etfData]);

  // Reset pagination to first 100 when switching categories or filtering
  useEffect(() => {
    setPage(0);
  }, [activeSectionId, query]);

  /*
   * Clicking ETF Corner in the sidebar should ALWAYS return
   * to the ETF grid, even if an ETF is currently open.
   */
  useEffect(() => {
    const handleEtfCornerHome = () => {
      setSelectedEtf(null);
    };

    window.addEventListener("etf-corner-home", handleEtfCornerHome);

    return () => {
      window.removeEventListener("etf-corner-home", handleEtfCornerHome);
    };
  }, []);

  const q = query.trim().toLowerCase();

  const filteredPopular = useMemo(() => {
    if (!q) return POPULAR_ETFS;
    return POPULAR_ETFS.filter(
      c =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [q]);

  const currentSection = useMemo(() => {
    if (!sections.length) return null;
    return (
      sections.find(
        s =>
          s.id === activeSectionId ||
          s.id.toLowerCase() === activeSectionId.toLowerCase() ||
          s.id.replace(/-|_/g, "").toLowerCase() ===
            activeSectionId.replace(/-|_/g, "").toLowerCase()
      ) ?? sections[0]
    );
  }, [sections, activeSectionId]);

  const filteredFunds = useMemo(() => {
    if (!currentSection) return [];
    if (!q) return currentSection.funds;
    return currentSection.funds.filter(
      f =>
        f.symbol.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q)
    );
  }, [currentSection, q]);

  // 100 funds per screen pagination calculations
  const totalFunds = filteredFunds.length;
  const pageCount = Math.max(1, Math.ceil(totalFunds / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(0, page), pageCount - 1);
  const startIdx = clampedPage * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalFunds);
  const pagedFunds = useMemo(() => {
    return filteredFunds.slice(startIdx, endIdx);
  }, [filteredFunds, startIdx, endIdx]);

  /*
   * ETF DETAIL VIEW (for top 16 popular ETF cards)
   * Only Charts and News are visible in this specific mode.
   */
  if (selectedEtf) {
    const popularMatch = POPULAR_ETFS.find(item => item.symbol === selectedEtf);
    const apiMatch = (etfData?.categories || []).flatMap(c => c.funds).find(item => item.symbol === selectedEtf);
    const etfName = popularMatch?.name || apiMatch?.name || selectedEtf;

    return (
      <>
        <div
          className="page-head"
          style={{
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)" }}>
              {selectedEtf}
            </h2>
            <div style={{ marginTop: 2, fontSize: ".74rem", color: "var(--text-dim-solid)" }}>
              {etfName}
            </div>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => setSelectedEtf(null)}
            aria-label="Close ETF"
            title="Back to ETF Corner"
            style={{
              fontSize: ".95rem",
              lineHeight: 1,
              padding: "7px 14px",
            }}
          >
            ✕ Back
          </button>
        </div>

        <div className="dash">
          <div className="col-12">
            <div
              className="card"
              style={{
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <StockScreenEmbed
                key={selectedEtf}
                initialSym={selectedEtf}
                visibleTabs={["chart", "news"]}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  /*
   * DEFAULT ETF CORNER VIEW
   * 1. Top row of 16 hardcoded popular ETFs (8 per row on desktop, UI reactive).
   * 2. "Other ETF Market Funds" section with 10 tabs, paginated 100 per screen.
   */
  return (
    <>
      <div className="page-head">
        <div
          style={{
            position: "relative",
            flex: 1,
            maxWidth: 420,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-dim-solid)",
              pointerEvents: "none",
              fontSize: ".9rem",
            }}
          >
            ⌕
          </span>

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search ETFs…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "var(--surface-3)",
              border: "1px solid var(--border-soft)",
              borderRadius: 8,
              padding: "8px 12px 8px 32px",
              fontSize: ".82rem",
              color: "var(--text-hi)",
              outline: "none",
              fontFamily: "var(--f-mono)",
            }}
          />
        </div>
      </div>

      <div className="dash" style={{ paddingBottom: 30 }}>
        {/* ── Section: Popular ETFs (Hardcoded 16) ── */}
        <div className="col-12" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <h2
              style={{
                fontSize: "1.08rem",
                fontWeight: 700,
                color: "var(--text-hi)",
                margin: 0,
                letterSpacing: "-.01em",
              }}
            >
              Popular ETFs
            </h2>
          </div>

          <div>
            {filteredPopular.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "var(--text-dim-solid)",
                  fontSize: ".82rem",
                }}
              >
                No ETFs match “{query}”.
              </div>
            ) : (
              <div className="etf-top-grid">
                {filteredPopular.map(c => (
                  <button
                    key={c.symbol}
                    type="button"
                    onClick={() => setSelectedEtf(c.symbol)}
                    className="card etf-card"
                  >
                    <div className="card-b">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 4,
                        }}
                      >
                        <StockLogo sym={c.symbol} size={20} />
                        <h3
                          style={{
                            margin: 0,
                            fontSize: ".88rem",
                            fontWeight: 700,
                            color: "var(--text-hi)",
                          }}
                        >
                          {c.symbol}
                        </h3>
                      </div>

                      <p
                        title={c.name}
                        className="etf-card-title"
                      >
                        {c.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Section: Other ETF Market Funds ── */}
        <div className="col-12" style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <h2
                style={{
                  fontSize: "1.08rem",
                  fontWeight: 700,
                  color: "var(--text-hi)",
                  margin: 0,
                  letterSpacing: "-.01em",
                }}
              >
                Other ETF Market Funds
              </h2>
            </div>

            {/* TAB BAR: All 10 sections visible */}
            <nav
              className="etf-tabbar"
              role="tablist"
              aria-label="Other ETF Market Funds categories"
            >
              {sections.map(s => {
                const active =
                  activeSectionId === s.id ||
                  activeSectionId.toLowerCase() === s.id.toLowerCase() ||
                  activeSectionId.replace(/-|_/g, "").toLowerCase() ===
                    s.id.replace(/-|_/g, "").toLowerCase();
                return (
                  <button
                    key={s.id}
                    className="etf-tabbtn"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveSectionId(s.id);
                      setSelectedFundTicker(null);
                      setPage(0);
                    }}
                  >
                    {s.label}
                    <span className="count">{s.funds.length}</span>
                  </button>
                );
              })}
            </nav>

            {!selectedFundTicker ? (
              /* WHOLE SCREEN LIST (100 per screen) */
              <div
                className="card"
                style={{
                  overflow: "hidden",
                  minHeight: 380,
                }}
              >
                <div
                  className="card-h"
                  style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: ".88rem",
                        fontWeight: 700,
                        color: "var(--text-hi)",
                      }}
                    >
                      {currentSection?.label ?? "ETF"} Funds ({totalFunds > 0 ? `${startIdx + 1}–${endIdx} of ${totalFunds}` : "0"})
                    </h3>
                    <div style={{ marginTop: 2, fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                      Click any fund to view live chart, technical indicators, and details
                    </div>
                  </div>
                  <VendorTag v="polygon" />
                </div>

                <div style={{ padding: 10 }}>
                  {loading && !etfData ? (
                    <div style={{ padding: "40px 0" }}>
                      <DataState loading label="Loading ETF category funds…" />
                    </div>
                  ) : filteredFunds.length === 0 ? (
                    <div
                      style={{
                        padding: "36px 0",
                        textAlign: "center",
                        color: "var(--text-dim-solid)",
                        fontSize: ".8rem",
                      }}
                    >
                      {error ? `Failed to load ETFs: ${error}` : `No funds match “${query}”.`}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {pagedFunds.map(f => (
                          <button
                            key={f.symbol}
                            type="button"
                            onClick={() => setSelectedFundTicker(f.symbol)}
                            className="etf-full-row"
                          >
                            <StockLogo sym={f.symbol} size={24} />

                            <div>
                              <span
                                style={{
                                  fontFamily: "var(--f-mono)",
                                  fontWeight: 800,
                                  fontSize: ".92rem",
                                  color: "var(--text-hi)",
                                }}
                              >
                                {f.symbol}
                              </span>
                            </div>

                            <div
                              title={f.name}
                              style={{
                                fontSize: ".76rem",
                                color: "var(--text)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {f.name}
                            </div>

                            {f.badge && (
                              <span
                                className="pill"
                                style={{
                                  background: "var(--surface-3)",
                                  color: "var(--text-dim-solid)",
                                  fontSize: ".62rem",
                                  padding: "3px 7px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {f.badge}
                              </span>
                            )}

                            <span
                              className="etf-full-row-action"
                              style={{
                                fontSize: ".72rem",
                                fontWeight: 600,
                                color: "var(--brand-2)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                whiteSpace: "nowrap",
                              }}
                            >
                              View Details →
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Pagination: 100 per screen (1-100, 101-200, etc.) */}
                      {totalFunds > PAGE_SIZE && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            paddingTop: 12,
                            marginTop: 8,
                            borderTop: "1px solid var(--border-soft)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: ".74rem",
                              color: "var(--text-dim-solid)",
                              fontFamily: "var(--f-mono)",
                            }}
                          >
                            {startIdx + 1}–{endIdx} of {totalFunds}
                          </span>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              className="btn"
                              disabled={clampedPage === 0}
                              onClick={() => setPage(p => Math.max(0, p - 1))}
                              style={{
                                padding: "4px 10px",
                                fontSize: ".74rem",
                                lineHeight: 1,
                                opacity: clampedPage === 0 ? 0.35 : 1,
                                cursor: clampedPage === 0 ? "default" : "pointer",
                              }}
                            >
                              ← Prev
                            </button>
                            <span
                              style={{
                                fontSize: ".74rem",
                                color: "var(--text-dim-solid)",
                                minWidth: 84,
                                textAlign: "center",
                              }}
                            >
                              Page {clampedPage + 1} / {pageCount}
                            </span>
                            <button
                              type="button"
                              className="btn"
                              disabled={clampedPage >= pageCount - 1}
                              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                              style={{
                                padding: "4px 10px",
                                fontSize: ".74rem",
                                lineHeight: 1,
                                opacity: clampedPage >= pageCount - 1 ? 0.35 : 1,
                                cursor: clampedPage >= pageCount - 1 ? "default" : "pointer",
                              }}
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* SPLIT VIEW (identical to AI Companies layout) */
              <div
                className="aic-split"
                style={{
                  padding: 0,
                  minHeight: 650,
                  height: 740,
                }}
              >
                {/* LEFT — Fund list for active category (100 per screen) */}
                <div
                  className="card"
                  style={{
                    overflow: "hidden",
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    className="card-h"
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setSelectedFundTicker(null)}
                          title="Back to full list"
                          style={{
                            padding: "3px 8px",
                            fontSize: ".7rem",
                            lineHeight: 1,
                          }}
                        >
                          ← Full list
                        </button>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: ".82rem",
                            fontWeight: 700,
                            color: "var(--text-hi)",
                          }}
                        >
                          {currentSection?.label} ({totalFunds > 0 ? `${startIdx + 1}–${endIdx} of ${totalFunds}` : "0"})
                        </h3>
                      </div>
                      <VendorTag v="polygon" />
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 8,
                      overflowY: "auto",
                      minHeight: 0,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      {filteredFunds.length === 0 ? (
                        <div
                          style={{
                            padding: "24px 0",
                            textAlign: "center",
                            color: "var(--text-dim-solid)",
                            fontSize: ".78rem",
                          }}
                        >
                          No funds match “{query}”.
                        </div>
                      ) : (
                        pagedFunds.map(f => {
                          const active = f.symbol === selectedFundTicker;
                          return (
                            <button
                              key={f.symbol}
                              type="button"
                              onClick={() => setSelectedFundTicker(f.symbol)}
                              style={{
                                width: "100%",
                                display: "grid",
                                gridTemplateColumns: "38px minmax(0, 1fr) auto",
                                alignItems: "center",
                                gap: 14,
                                padding: "9px 10px",
                                marginBottom: 4,
                                borderRadius: 8,
                                border: active
                                  ? "1px solid var(--brand)"
                                  : "1px solid transparent",
                                background: active
                                  ? "rgba(74,222,128,.08)"
                                  : "transparent",
                                color: "inherit",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "background .12s ease",
                              }}
                            >
                              <StockLogo sym={f.symbol} size={24} />

                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <b
                                    style={{
                                      color: active
                                        ? "var(--brand-2)"
                                        : "var(--text-hi)",
                                      fontSize: ".82rem",
                                    }}
                                  >
                                    {f.symbol}
                                  </b>
                                </div>

                                <div
                                  title={f.name}
                                  style={{
                                    marginTop: 2,
                                    fontSize: ".68rem",
                                    color: "var(--text-dim-solid)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {f.name}
                                </div>
                              </div>

                              {f.badge && (
                                <span
                                  className="pill"
                                  style={{
                                    background: "var(--surface-3)",
                                    color: "var(--text-dim-solid)",
                                    fontSize: ".58rem",
                                    padding: "2px 5px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {f.badge}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Split View Pagination Controls */}
                    {totalFunds > PAGE_SIZE && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          paddingTop: 10,
                          marginTop: 6,
                          borderTop: "1px solid var(--border-soft)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: ".68rem",
                            color: "var(--text-dim-solid)",
                            fontFamily: "var(--f-mono)",
                          }}
                        >
                          {startIdx + 1}–{endIdx}
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button
                            type="button"
                            className="btn"
                            disabled={clampedPage === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            style={{
                              padding: "3px 7px",
                              fontSize: ".68rem",
                              lineHeight: 1,
                              opacity: clampedPage === 0 ? 0.35 : 1,
                              cursor: clampedPage === 0 ? "default" : "pointer",
                            }}
                          >
                            ← Prev
                          </button>
                          <span
                            style={{
                              fontSize: ".68rem",
                              color: "var(--text-dim-solid)",
                              minWidth: 54,
                              textAlign: "center",
                            }}
                          >
                            {clampedPage + 1}/{pageCount}
                          </span>
                          <button
                            type="button"
                            className="btn"
                            disabled={clampedPage >= pageCount - 1}
                            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                            style={{
                              padding: "3px 7px",
                              fontSize: ".68rem",
                              lineHeight: 1,
                              opacity: clampedPage >= pageCount - 1 ? 0.35 : 1,
                              cursor: clampedPage >= pageCount - 1 ? "default" : "pointer",
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT — full stock detail/chart with ALL stock sections */}
                <div
                  className="card"
                  style={{
                    minWidth: 0,
                    minHeight: 0,
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                  }}
                >
                  <StockScreenEmbed
                    key={selectedFundTicker}
                    initialSym={selectedFundTicker}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}