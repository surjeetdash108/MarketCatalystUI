"use client";

import { useEffect, useState, useMemo } from "react";
import { StockScreenEmbed } from "../shell";
import { StockLogo, VendorTag, DataState } from "../utils";
import { useApiList } from "../hooks/useApiList";
import type { CompanyDoc } from "../types";

const ETF_DATA = [
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

const ETF_CATEGORIES = ETF_DATA.map(etf => ({
  key: etf.symbol.toLowerCase(),
  symbol: etf.symbol,
  title: etf.name,
}));

export interface EtfFundItem {
  symbol: string;
  name: string;
  badge?: string;
}

export interface EtfSection {
  id: string;
  label: string;
  funds: EtfFundItem[];
}

interface EtfCategoryRule {
  id: string;
  label: string;
  tickers: string[];
  defaultTag: string;
  fallbackBadges?: Record<string, string>;
  filter?: (c: CompanyDoc) => boolean;
}

function fmtFundMcap(mc: number | null | undefined): string | null {
  if (mc == null || mc <= 0) return null;
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(0)}B+`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M+`;
  return `$${mc.toLocaleString()}`;
}

function isFundCompany(c: CompanyDoc): boolean {
  const n = (c.name || "").toUpperCase();
  const ind = (c.industry || "").toUpperCase();
  const sec = (c.sector || "").toUpperCase();
  return (
    n.includes("ETF") ||
    n.includes("TRUST") ||
    n.includes("INDEX") ||
    n.includes("FUND") ||
    n.includes("SHARES") ||
    ind.includes("INVESTMENT") ||
    ind.includes("FUND") ||
    sec.includes("FINANCIAL")
  );
}

const KNOWN_ETF_NAMES: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF Trust",
  IVV: "iShares Core S&P 500 ETF",
  VOO: "Vanguard S&P 500 ETF",
  VTI: "Vanguard Total Stock Market ETF",
  QQQ: "Invesco QQQ Trust Series 1",
  VEA: "Vanguard FTSE Developed Markets ETF",
  IEFA: "iShares Core MSCI EAFE ETF",
  VUG: "Vanguard Growth ETF",
  BND: "Vanguard Total Bond Market ETF",
  VTV: "Vanguard Value ETF",
  AGG: "iShares Core U.S. Aggregate Bond ETF",
  IWF: "iShares Russell 1000 Growth ETF",
  IWM: "iShares Russell 2000 ETF",
  DIA: "SPDR Dow Jones Industrial Average ETF",
  SCHD: "Schwab U.S. Dividend Equity ETF",
  IJH: "iShares Core S&P Mid-Cap ETF",
  IJR: "iShares Core S&P Small-Cap ETF",
  VIG: "Vanguard Dividend Appreciation ETF",
  RSP: "Invesco S&P 500 Equal Weight ETF",
  QUAL: "iShares MSCI USA Quality Factor ETF",
  IBIT: "iShares Bitcoin Trust ETF",
  FBTC: "Fidelity Wise Origin Bitcoin Fund",
  ARKB: "ARK 21Shares Bitcoin ETF",
  BITB: "Bitwise Bitcoin ETF",
  GBTC: "Grayscale Bitcoin Trust",
  BITO: "ProShares Bitcoin Strategy ETF",
  HODL: "VanEck Bitcoin ETF",
  BRRR: "CoinShares Valkyrie Bitcoin Fund",
  EZBC: "Franklin Bitcoin ETF",
  BTCW: "WisdomTree Bitcoin Fund",
  ETHA: "iShares Ethereum Trust ETF",
  FETH: "Fidelity Ethereum Fund",
  ETHW: "Bitwise Ethereum ETF",
  CETH: "21Shares Core Ethereum ETF",
  ETHE: "Grayscale Ethereum Trust",
  ETH: "Grayscale Ethereum Mini Trust",
  EZET: "Franklin Ethereum ETF",
  QETH: "Invesco Galaxy Ethereum ETF",
  EETH: "ProShares Ether Strategy ETF",
  GLD: "SPDR Gold Shares",
  IAU: "iShares Gold Trust",
  GLDM: "SPDR Gold MiniShares Trust",
  SGOL: "abrdn Physical Gold Shares ETF",
  BAR: "GraniteShares Gold Trust",
  OUNZ: "VanEck Merk Gold Trust",
  GDX: "VanEck Gold Miners ETF",
  GDXJ: "VanEck Junior Gold Miners ETF",
  RING: "iShares MSCI Global Gold Miners ETF",
  TLT: "iShares 20+ Year Treasury Bond ETF",
  HYG: "iShares iBoxx $ High Yield Corporate Bond ETF",
  LQD: "iShares iBoxx $ Investment Grade Corporate Bond ETF",
  SHY: "iShares 1-3 Year Treasury Bond ETF",
  IEF: "iShares 7-10 Year Treasury Bond ETF",
  TIP: "iShares TIPS Bond ETF",
  JNK: "SPDR Bloomberg High Yield Bond ETF",
  VCIT: "Vanguard Intermediate-Term Corporate Bond ETF",
  BNDX: "Vanguard Total International Bond ETF",
  VNQ: "Vanguard Real Estate ETF",
  XLRE: "Real Estate Select Sector SPDR Fund",
  IYR: "iShares U.S. Real Estate ETF",
  SCHH: "Schwab U.S. REIT ETF",
  VNQI: "Vanguard Global ex-U.S. Real Estate ETF",
  MORT: "VanEck Mortgage REIT Income ETF",
  REM: "iShares Mortgage Real Estate ETF",
  REET: "iShares Global Real Estate ETF",
  ITOT: "iShares Core S&P Total U.S. Stock Market ETF",
  SPTM: "SPDR Portfolio S&P 1500 Composite Stock Market ETF",
  SCHB: "Schwab U.S. Broad Market ETF",
  VT: "Vanguard Total World Stock ETF",
  VXUS: "Vanguard Total International Stock ETF",
  IXUS: "iShares Core MSCI Total International Stock ETF",
  ACWI: "iShares MSCI ACWI ETF",
  GSG: "iShares S&P GSCI Commodity-Indexed Trust",
  DBC: "Invesco DB Commodity Index Tracking Fund",
  PDBC: "Invesco Optimum Yield Diversified Commodity Strategy",
  USO: "United States Oil Fund",
  BNO: "United States Brent Oil Fund",
  UNG: "United States Natural Gas Fund",
  SLV: "iShares Silver Trust",
  CPER: "United States Copper Index Fund",
  DBA: "Invesco DB Agriculture Fund",
  WEAT: "Teucrium Wheat Fund",
  CORN: "Teucrium Corn Fund",
  TQQQ: "ProShares UltraPro QQQ",
  SQQQ: "ProShares UltraPro Short QQQ",
  SPXL: "Direxion Daily S&P 500 Bull 3X Shares",
  SPXS: "Direxion Daily S&P 500 Bear 3X Shares",
  SOXL: "Direxion Daily Semiconductor Bull 3X Shares",
  SOXS: "Direxion Daily Semiconductor Bear 3X Shares",
  TNA: "Direxion Daily Small Cap Bull 3X Shares",
  TZA: "Direxion Daily Small Cap Bear 3X Shares",
  NVDL: "GraniteShares 2x Long NVDA Daily ETF",
  UVXY: "ProShares Ultra VIX Short-Term Futures ETF",
  BOIL: "ProShares Ultra Bloomberg Natural Gas",
};

const ETF_CATEGORY_RULES: EtfCategoryRule[] = [
  {
    id: "largest",
    label: "Largest",
    tickers: ["SPY", "IVV", "VOO", "VTI", "QQQ", "VEA", "IEFA", "VUG", "BND", "VTV", "AGG", "IWF"],
    defaultTag: "$100B+",
    fallbackBadges: {
      SPY: "$560B+", IVV: "$510B+", VOO: "$500B+", VTI: "$420B+", QQQ: "$290B+",
      VEA: "$130B+", IEFA: "$120B+", VUG: "$120B+", BND: "$115B+", VTV: "$110B+",
      AGG: "$110B+", IWF: "$95B+",
    },
    filter: c => (c.marketCap ?? 0) >= 50e9 && isFundCompany(c),
  },
  {
    id: "equity",
    label: "Equity",
    tickers: ["SPY", "QQQ", "IWM", "DIA", "VUG", "VTV", "SCHD", "IJH", "IJR", "VIG", "RSP", "QUAL"],
    defaultTag: "Equity",
    fallbackBadges: {
      SPY: "Large Blend", QQQ: "Large Growth", IWM: "Small Cap", DIA: "Large Value",
      VUG: "Large Growth", VTV: "Large Value", SCHD: "Dividend", IJH: "Mid Cap",
      IJR: "Small Cap", VIG: "Dividend", RSP: "Equal Weight", QUAL: "Factor",
    },
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    tickers: ["IBIT", "FBTC", "ARKB", "BITB", "GBTC", "BITO", "HODL", "BRRR", "EZBC", "BTCW"],
    defaultTag: "Spot BTC",
    fallbackBadges: { BITO: "Futures" },
    filter: c => /\b(bitcoin|btc)\b/i.test(`${c.name ?? ""} ${c.ticker}`),
  },
  {
    id: "ethereum",
    label: "Ethereum",
    tickers: ["ETHA", "FETH", "ETHW", "CETH", "ETHE", "ETH", "EZET", "QETH", "EETH"],
    defaultTag: "Spot ETH",
    fallbackBadges: { EETH: "Futures" },
    filter: c => /\b(ethereum|ether|eth)\b/i.test(`${c.name ?? ""} ${c.ticker}`),
  },
  {
    id: "gold",
    label: "Gold",
    tickers: ["GLD", "IAU", "GLDM", "SGOL", "BAR", "OUNZ", "GDX", "GDXJ", "RING"],
    defaultTag: "Physical",
    fallbackBadges: { GDX: "Miners", GDXJ: "Jr Miners", RING: "Miners" },
    filter: c => /\b(gold|bullion)\b/i.test(`${c.name ?? ""} ${c.ticker}`),
  },
  {
    id: "fixed_income",
    label: "Fixed Income",
    tickers: ["TLT", "BND", "AGG", "HYG", "LQD", "SHY", "IEF", "TIP", "JNK", "VCIT", "BNDX"],
    defaultTag: "Fixed Income",
    fallbackBadges: {
      TLT: "Long Treasury", BND: "Broad Aggregate", AGG: "Broad Aggregate",
      HYG: "High Yield", LQD: "Inv Grade", SHY: "Short Treasury",
      IEF: "Int Treasury", TIP: "Inflation", JNK: "High Yield",
      VCIT: "Corporate", BNDX: "International",
    },
    filter: c => /\b(treasury|bond|aggregate|fixed income|high yield)\b/i.test(`${c.name ?? ""} ${c.ticker}`),
  },
  {
    id: "real_estate",
    label: "Real Estate",
    tickers: ["VNQ", "XLRE", "IYR", "SCHH", "VNQI", "MORT", "REM", "REET"],
    defaultTag: "U.S. REITs",
    fallbackBadges: {
      VNQ: "U.S. REITs", XLRE: "S&P REITs", IYR: "Broad REITs", SCHH: "Low Cost",
      VNQI: "Ex-U.S.", MORT: "mREITs", REM: "mREITs", REET: "Global",
    },
    filter: c => (c.industry === "Real Estate Investment Trusts" || /\b(reit|real estate)\b/i.test(`${c.name ?? ""}`)) && isFundCompany(c),
  },
  {
    id: "total_market",
    label: "Total Market",
    tickers: ["VTI", "ITOT", "SPTM", "SCHB", "VT", "VXUS", "IXUS", "ACWI"],
    defaultTag: "Total Market",
    fallbackBadges: {
      VTI: "U.S. All-Cap", ITOT: "U.S. All-Cap", SPTM: "S&P 1500", SCHB: "Broad Market",
      VT: "Global World", VXUS: "Ex-U.S.", IXUS: "Ex-U.S.", ACWI: "All-Country",
    },
    filter: c => /\b(total (stock|market)|broad market|world stock|all-country|acwi)\b/i.test(`${c.name ?? ""}`),
  },
  {
    id: "commodities",
    label: "Commodities",
    tickers: ["GSG", "DBC", "PDBC", "USO", "BNO", "UNG", "SLV", "CPER", "DBA", "WEAT", "CORN"],
    defaultTag: "Commodity",
    fallbackBadges: {
      GSG: "Broad", DBC: "Diversified", PDBC: "No K-1", USO: "Crude Oil",
      BNO: "Brent Crude", UNG: "Nat Gas", SLV: "Silver", CPER: "Copper",
      DBA: "Agriculture", WEAT: "Wheat", CORN: "Corn",
    },
    filter: c => /\b(commodity|crude oil|brent|natural gas|silver|copper|agriculture|wheat|corn)\b/i.test(`${c.name ?? ""}`),
  },
  {
    id: "leveraged",
    label: "Leveraged",
    tickers: ["TQQQ", "SQQQ", "SPXL", "SPXS", "SOXL", "SOXS", "TNA", "TZA", "NVDL", "UVXY", "BOIL"],
    defaultTag: "Leveraged",
    fallbackBadges: {
      TQQQ: "3x Long QQQ", SQQQ: "3x Short QQQ", SPXL: "3x Long SPY", SPXS: "3x Short SPY",
      SOXL: "3x Long Semi", SOXS: "3x Short Semi", TNA: "3x Long IWM", TZA: "3x Short IWM",
      NVDL: "2x Long NVDA", UVXY: "1.5x VIX", BOIL: "2x Nat Gas",
    },
    filter: c => /\b([23]x|ultra|bull 3x|bear 3x|short|inverse|daily [23]x)\b/i.test(`${c.name ?? ""}`),
  },
];

export function EtfMarketFunds() {
  const [query, setQuery] = useState("");
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>("largest");
  const [selectedFundTicker, setSelectedFundTicker] = useState<string | null>(null);

  // Live company dataset from backend
  const { data: companies } = useApiList<CompanyDoc>("/market-data/companies");

  // Map received companies by ticker symbol
  const byTicker = useMemo(() => {
    const map = new Map<string, CompanyDoc>();
    for (const c of companies ?? []) {
      if (c?.ticker) map.set(c.ticker.toUpperCase(), c);
    }
    return map;
  }, [companies]);

  // Dynamically resolve and filter fund classifications from data received
  const sections: EtfSection[] = useMemo(() => {
    return ETF_CATEGORY_RULES.map(rule => {
      const seen = new Set<string>();
      const funds: EtfFundItem[] = [];

      for (const sym of rule.tickers) {
        if (seen.has(sym)) continue;
        seen.add(sym);
        const live = byTicker.get(sym);

        let badge = fmtFundMcap(live?.marketCap);
        if (!badge) {
          if (rule.fallbackBadges?.[sym]) {
            badge = rule.fallbackBadges[sym];
          } else {
            badge = rule.defaultTag;
          }
        }

        funds.push({
          symbol: sym,
          name: live?.name || KNOWN_ETF_NAMES[sym] || sym,
          badge,
        });
      }

      return {
        id: rule.id,
        label: rule.label,
        funds,
      };
    });
  }, [byTicker]);

  /*
   * Clicking ETF Corner in the sidebar should ALWAYS return
   * to the ETF grid, even if an ETF is currently open.
   */
  useEffect(() => {
    const handleEtfCornerHome = () => {
      setSelectedEtf(null);
    };

    window.addEventListener(
      "etf-corner-home",
      handleEtfCornerHome
    );

    return () => {
      window.removeEventListener(
        "etf-corner-home",
        handleEtfCornerHome
      );
    };
  }, []);

  const q = query.trim().toLowerCase();

  const filteredCategories = q
    ? ETF_CATEGORIES.filter(
        c =>
          c.symbol.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      )
    : ETF_CATEGORIES;

  const currentSection = useMemo(
    () => sections.find(s => s.id === activeSectionId) ?? sections[0],
    [sections, activeSectionId]
  );

  const filteredFunds = useMemo(() => {
    if (!q) return currentSection?.funds ?? [];
    return (currentSection?.funds ?? []).filter(
      f => f.symbol.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
    );
  }, [currentSection, q]);

  /*
   * ETF DETAIL VIEW (for top 16 ETF cards)
   *
   * Only Charts and News are visible in this specific mode.
   */
  if (selectedEtf) {
    const etf = ETF_DATA.find(
      item => item.symbol === selectedEtf
    );

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
              {etf?.name ?? selectedEtf}
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
   *
   * 1. Top row of 16 popular ETFs (8 per row on desktop, UI reactive).
   * 2. "Other ETF Market Funds" section with tabs and split layout (like AI Companies).
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

        {/* <span
          className="pill"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-dim-solid)",
          }}
        >
          Coming soon
        </span> */}
      </div>

      <div className="dash" style={{ paddingBottom: 30 }}>
        {/* Top 16 ETFs Grid: 8 in each row on desktop, reactive */}
        {/* ── Section: Popular ETFs ── */}
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
          {/* Top 16 ETFs Grid: 8 in each row on desktop, reactive */}
          <div>
          {filteredCategories.length === 0 ? (
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
              {filteredCategories.map(c => (
                <button
                  key={c.key}
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
                      title={c.title}
                      className="etf-card-title"
                    >
                      {c.title}
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

            {/* TAB BAR: All sections visible in full screen without scrolling */}
            <nav
              className="etf-tabbar"
              role="tablist"
              aria-label="Other ETF Market Funds categories"
            >
              {sections.map(s => {
                const active = activeSectionId === s.id;
                return (
                  <button
                    key={s.id}
                    className="etf-tabbtn"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveSectionId(s.id);
                      setSelectedFundTicker(null);
                    }}
                  >
                    {s.label}
                    <span className="count">{s.funds.length}</span>
                  </button>
                );
              })}
            </nav>

            {!selectedFundTicker ? (
              /* WHOLE SCREEN JUST LIST */
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
                      {currentSection?.label} Funds ({filteredFunds.length})
                    </h3>
                    <div style={{ marginTop: 2, fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                      Click any fund to view live chart, technical indicators, and details
                    </div>
                  </div>
                  <VendorTag v="polygon" />
                </div>

                <div style={{ padding: 10 }}>
                  {filteredFunds.length === 0 ? (
                    <div
                      style={{
                        padding: "36px 0",
                        textAlign: "center",
                        color: "var(--text-dim-solid)",
                        fontSize: ".8rem",
                      }}
                    >
                      No funds match “{query}”.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {filteredFunds.map(f => (
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
                  )}
                </div>
              </div>
            ) : (
              /* SPLIT VIEW (identical to AI Companies layout): Stock list on left, Chart etc on right */
              <div
                className="aic-split"
                style={{
                  padding: 0,
                  minHeight: 650,
                  height: 740,
                }}
              >
                {/* LEFT — Fund list for active category */}
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
                          {currentSection?.label} ({filteredFunds.length})
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
                    }}
                  >
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
                      filteredFunds.map(f => {
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
                </div>

                {/* RIGHT — full stock detail/chart with ALL stock sections (like in AI Companies) */}
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