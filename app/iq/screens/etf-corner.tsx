"use client";

import { useState } from "react";

/**
 * ETF Corner — visual placeholder only, no backend wiring yet.
 * ETF list mirrors the funds shown in the current ETF UI design.
 */

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
  blurb: etf.name,
}));

export function ComingSoonEtfScreen() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredCategories = q
    ? ETF_CATEGORIES.filter(
        c =>
          c.symbol.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      )
    : ETF_CATEGORIES;

  return (
    <>
      <div className="page-head">
        <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
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

        <span
          className="pill"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-dim-solid)",
          }}
        >
          Coming soon
        </span>
      </div>

      <div className="dash">
        <div className="col-12">
          {filteredCategories.length === 0 ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--text-dim-solid)",
                fontSize: ".82rem",
              }}
            >
              No ETFs match “{query}”.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 14,
              }}
            >
              {filteredCategories.map(c => (
                <div
                  key={c.key}
                  className="card"
                  style={{
                    opacity: 0.88,
                  }}
                >
                  <div className="card-b">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: ".92rem",
                          color: "var(--text-hi)",
                        }}
                      >
                        {c.symbol}
                      </h3>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: ".76rem",
                        lineHeight: 1.5,
                        color: "var(--text-dim-solid)",
                        minHeight: "3.2em",
                      }}
                    >
                      {c.title}
                    </p>

                    <div style={{ marginTop: 10 }}>
                      <span
                        className="pill"
                        style={{
                          background: "var(--surface-3)",
                          color: "var(--text-dim-solid)",
                        }}
                      >
                        Coming soon
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
