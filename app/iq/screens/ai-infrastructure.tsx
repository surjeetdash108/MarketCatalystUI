"use client";

import { useEffect, useState } from "react";
import { StockScreenEmbed } from "../shell";
// import { useIQActions, StockScreenEmbed } from "../shell";
import { useApiList } from "../hooks/useApiList";
import { useApiResource } from "../hooks/useApiResource";
import { DataState, NotAvailable, VendorTag, StockLogo, hashStr, fmt, sign, cls } from "../utils";
// import type { AiInfraTheme, AiInfraThemeDetail, AiInfraCompany, AiInfraCapBucket, CompanyDoc } from "../types";
import type { AiInfraTheme, AiInfraThemeDetail, AiInfraCompany, AiInfraCapBucket } from "../types";

// Backend icon tokens (ai-infrastructure-themes.ts) have no opinion on the
// actual glyph — mapped here to the same lightweight emoji icons the rest of
// the nav/menu system already uses (menu-items.ts) rather than pulling in an
// icon library for one screen.
const ICONS: Record<string, string> = {
  cpu: "🖥️", wrench: "🔧", factory: "🏭", package: "📦", database: "💾",
  sun: "☀️", network: "🌐", zap: "⚡", snowflake: "❄️", crane: "🏗️",
  "building-2": "🏢", radiation: "☢️", cloud: "☁️", bitcoin: "₿", globe: "🌍",
  pickaxe: "⛏️", flask: "🧪", settings: "⚙️", shield: "🛡️", satellite: "🛰️",
  battery: "🔋", boxes: "🗃️", plug: "🔌", chip: "🔲", rocket: "🚀",
};

// A fixed, varied accent palette assigned deterministically per theme (same
// `hashStr`-seeded pattern Spark/CandleChart use elsewhere) so each sector
// tile gets a consistent color across sessions without the backend having to
// carry a color field it has no opinion on either.
const ACCENTS = ["#38BDF8", "#A78BFA", "#34D399", "#FBBF24", "#F472B6", "#FB923C", "#2DD4BF", "#818CF8", "#F87171", "#4ADE80"];
function accentFor(key: string): string {
  return ACCENTS[hashStr(key) % ACCENTS.length];
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Premium gradient-orb icon badge — same glassy radial-gradient + glow
 *  language as `.wmn-orb` in iq.css, tinted per-theme via `accentFor` instead
 *  of the fixed brand green, since each tile needs its own identity. Swaps
 *  the previous bare emoji glyph for something with actual depth/presence. */
function ThemeIcon({ icon, accent, size = 40 }: { icon: string; accent: string; size?: number }) {
  const rgb = hexToRgb(accent);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.3, flex: "none",
        display: "grid", placeItems: "center",
        background: `radial-gradient(circle at 32% 26%, rgba(${rgb}, .9), rgba(${rgb}, .5) 60%, rgba(${rgb}, .22) 100%)`,
        boxShadow: `0 5px 16px -5px rgba(${rgb}, .7), inset 0 1px 0 rgba(255,255,255,.2)`,
        border: `1px solid rgba(${rgb}, .38)`,
      }}
    >
      <span style={{ fontSize: size * 0.48, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.3))" }}>{icon}</span>
    </div>
  );
}

function fmtMcap(mc: number | null): string {
  if (mc == null) return "—";
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

const CAP_STYLE: Record<AiInfraCapBucket, { bg: string; fg: string }> = {
  Mega: { bg: "var(--down-dim)", fg: "var(--down)" },
  Large: { bg: "rgba(245,181,68,.16)", fg: "var(--warn)" },
  Mid: { bg: "rgba(245,181,68,.16)", fg: "var(--warn)" },
  Small: { bg: "var(--up-dim)", fg: "var(--up)" },
  Micro: { bg: "var(--surface-3)", fg: "var(--text-dim-solid)" },
};

function CapPill({ cap }: { cap: AiInfraCapBucket | null }) {
  if (!cap) return <NotAvailable />;
  const s = CAP_STYLE[cap];
  return <span className="pill" style={{ background: s.bg, color: s.fg }}>{cap.toUpperCase()}</span>;
}

// const CAP_FILTERS: Array<"All" | AiInfraCapBucket> = ["All", "Mega", "Large", "Mid", "Small", "Micro"];

/** Company detail modal — mirrors mover-news-modal.tsx's centered-modal shell.
 *  `fullDescription` is the on-demand /live/company profile (richer than the
 *  theme endpoint's one-sentence blurb) when it has loaded; falls back to the
 *  blurb, then an honest empty state — never fabricated prose. */
// function CompanyModal({ row, theme, fullDescription, onClose, onOpenFull }: {
//   row: AiInfraCompany; theme: AiInfraThemeDetail; fullDescription: string | null;
//   onClose: () => void; onOpenFull: () => void;
// }) {
//   return (
//     <>
//       <div className="scrim" onClick={onClose} style={{ zIndex: 100 }} />
//       <div
//         style={{
//           position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
//           zIndex: 101, width: "min(640px, 94vw)", maxHeight: "86vh", overflowY: "auto",
//           background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: 16,
//           boxShadow: "0 24px 60px -10px rgba(0,0,0,.75)", padding: 22,
//         }}
//       >
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
//           <div style={{ minWidth: 0 }}>
//             <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//               <StockLogo sym={row.ticker} size={30} />
//               <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: "1.4rem", color: "var(--brand-2)" }}>{row.ticker}</div>
//             </div>
//             <div style={{ fontSize: ".84rem", color: "var(--text-dim-solid)", marginTop: 2 }}>{row.name ?? row.ticker}</div>
//             <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
//               <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)" }}>{theme.title}</span>
//               <CapPill cap={row.capBucket} />
//             </div>
//           </div>
//           <button className="closebtn" onClick={onClose}>✕</button>
//         </div>

//         <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 16 }}>
//           <div className="m"><div className="k">Price</div><div className="v">{row.price != null ? `$${fmt(row.price)}` : <NotAvailable />}</div></div>
//           <div className="m"><div className="k">Change</div><div className="v" style={row.pctChange != null ? { color: `var(--${cls(row.pctChange)})` } : undefined}>{row.pctChange != null ? sign(row.pctChange) : <NotAvailable />}</div></div>
//           <div className="m"><div className="k">Market cap</div><div className="v">{fmtMcap(row.marketCap)}</div></div>
//         </div>

//         <div className="ai-sec" style={{ marginTop: 4 }}><div className="h">What they do</div></div>
//         <div style={{ borderLeft: "3px solid var(--brand)", background: "var(--surface-2)", padding: "10px 14px", borderRadius: 6, fontSize: ".86rem", color: "var(--text-hi)", lineHeight: 1.5 }}>
//           {row.blurb ?? <NotAvailable />}
//         </div>

//         <div className="ai-sec" style={{ marginTop: 18 }}><div className="h">Sector relevance</div></div>
//         <p style={{ fontSize: ".84rem", lineHeight: 1.65, color: "var(--text-dim-solid)", margin: 0 }}>
//           {fullDescription ?? row.blurb ?? "No fuller company description synced yet."}
//         </p>

//         <div className="ai-sec" style={{ marginTop: 18, marginBottom: 8 }}><div className="h">Research links</div></div>
//         <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//           <a className="btn" href={`https://finance.yahoo.com/quote/${row.ticker}`} target="_blank" rel="noopener noreferrer">📈 Yahoo Finance</a>
//           <a className="btn" href={`https://finviz.com/quote.ashx?t=${row.ticker}`} target="_blank" rel="noopener noreferrer">📊 Finviz</a>
//           <a className="btn" href={`https://www.tradingview.com/symbols/${row.ticker}/`} target="_blank" rel="noopener noreferrer">📉 TradingView</a>
//         </div>

//         <button className="btn primary" style={{ width: "100%", marginTop: 18 }} onClick={onOpenFull}>
//           Open full stock page →
//         </button>
//       </div>
//     </>
//   );
// }

/** Sector detail — the companies classified into one AI-infrastructure theme. */
function ThemeDetail({
  themeKey,
  onBack,
}: {
  themeKey: string;
  onBack: () => void;
}) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const {
    data: detail,
    loading,
    error,
  } = useApiResource<AiInfraThemeDetail>(
    `/market-data/ai-infrastructure/${encodeURIComponent(themeKey)}`
  );

  const companies = detail?.companies ?? [];

  // Select the first company automatically when the theme loads.
  // If the current selection disappears, fall back to the first available company.
  useEffect(() => {
    if (companies.length === 0) {
      setSelectedTicker(null);
      return;
    }

    setSelectedTicker(current => {
      if (current && companies.some(c => c.ticker === current)) {
        return current;
      }

      return companies[0].ticker;
    });
  }, [companies]);

  const selectedCompany =
    companies.find(c => c.ticker === selectedTicker) ?? companies[0] ?? null;

  return (
    <>
      <div className="page-head">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
          }}
        >
          <ThemeIcon
            icon={ICONS[detail?.icon ?? ""] ?? "📊"}
            accent={accentFor(themeKey)}
            size={44}
          />

          <div style={{ minWidth: 0 }}>
            <div className="page-title">
              {detail?.title ?? "AI Corner"}
            </div>

            {detail?.blurb && (
              <div
                className="page-sub"
                style={{ maxWidth: 640 }}
              >
                {detail.blurb}
              </div>
            )}
          </div>
        </div>

        <button className="btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="dash">
        <div className="col-12">
          {companies.length === 0 ? (
            <DataState
              loading={loading}
              label={
                error
                  ? `Could not load this sector (${error}).`
                  : "No companies classified into this sector yet."
              }
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(250px, 0.32fr) minmax(0, 1fr)",
                gap: 14,
                alignItems: "stretch",
                height: "calc(100vh - 110px)",
                minHeight: 0,
              }}
            >
              {/* LEFT — companies */}
              <div
                className="card"
                style={{
                  overflow: "hidden",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div className="card-h">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <h3>
                      {companies.length} compan
                      {companies.length === 1 ? "y" : "ies"}
                    </h3>

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

                  {companies.map(c => {
                    const active = c.ticker === selectedTicker;

                    return (
                      <button
                        key={c.ticker}
                        type="button"
                        onClick={() => setSelectedTicker(c.ticker)}
                        style={{
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: "34px minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: 20,
                          padding: "10px 9px",
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
                        }}
                      >
                        <StockLogo
                          sym={c.ticker}
                          size={30}
                        />

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
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
                              {c.ticker}
                            </b>
                          </div>

                          <div
                            style={{
                              marginTop: 2,
                              fontSize: ".68rem",
                              color: "var(--text-dim-solid)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name ?? c.ticker}
                          </div>
                        </div>

                        <CapPill cap={c.capBucket} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT — full stock detail/chart */}
              <div
                className="card"
                style={{
                  minWidth: 0,
                  minHeight: 0,
                  overflowY: "auto",
                }}
              >
                {selectedCompany ? (
                  <StockScreenEmbed
                    initialSym={selectedCompany.ticker}
                  />
                ) : (
                  <DataState
                    loading={false}
                    label="Select a company."
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** AI Infrastructure — landing grid of investment-theme tiles, each drilling
 *  into its classified companies. Backed entirely by AiInfrastructureController
 *  (backend `companies` classified per-request against ai-infrastructure-themes.ts —
 *  no hardcoded ticker list, no mock data). */
export function AiInfrastructureScreen() {
  // const { openStockFull } = useIQActions();
  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleAiCornerHome = () => {
      setThemeKey(null);
    };

    window.addEventListener("ai-corner-home", handleAiCornerHome);

    return () => {
      window.removeEventListener("ai-corner-home", handleAiCornerHome);
    };
  }, []);

  const { data: themes, loading, error } = useApiList<AiInfraTheme>("/market-data/ai-infrastructure");

  if (themeKey) {
    return (
      <ThemeDetail
        themeKey={themeKey}
        onBack={() => setThemeKey(null)}
      />
    );
  }

  // Sector count is exact; the company total sums each tile's own count, so a
  // ticker classified into 2+ themes (a real possibility — see
  // ai-infrastructure-themes.ts) is counted once per theme rather than
  // deduped. Still real, backend-derived numbers — just not a distinct-ticker
  // count — so no separate "research notes" stat is invented for a field the
  // backend doesn't carry.
  const sectorCount = themes.length;
  const companyCount = themes.reduce((s, t) => s + t.companyCount, 0);

  const q = query.trim().toLowerCase();
  const filteredThemes = q
    ? themes.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.blurb.toLowerCase().includes(q) ||
        t.sampleTickers.some(tk => tk.toLowerCase().includes(q))
      )
    : themes;

  return (
    <>
      <div className="page-head">
        <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim-solid)", pointerEvents: "none", fontSize: ".9rem" }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search themes, companies, or tickers…"
            style={{
              width: "100%", boxSizing: "border-box", background: "var(--surface-3)",
              border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px 8px 32px",
              fontSize: ".82rem", color: "var(--text-hi)", outline: "none", fontFamily: "var(--f-mono)",
            }}
          />
        </div>
        <VendorTag v="polygon" />
      </div>

      <div className="dash">
        {/* <div className="col-12">
          <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 4 }}>
            <div className="m"><div className="k">Companies</div><div className="v">{loading ? "—" : companyCount.toLocaleString()}</div></div>
            <div className="m"><div className="k">Sectors</div><div className="v">{loading ? "—" : sectorCount}</div></div>
          </div>
        </div> */}

        <div className="col-12">
          {themes.length === 0 ? (
            <DataState
              loading={loading}
              label={error ? `Could not load AI infrastructure sectors (${error}).` : "No sectors classified yet."}
              height={200}
            />
          ) : filteredThemes.length === 0 ? (
            <DataState loading={false} label={`No sectors match “${query}”.`} height={200} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}
            >
              {filteredThemes.map(t => {
                const accent = accentFor(t.key);

                return (
                  <div
                    key={t.key}
                    className="card ai-theme-card"
                    onClick={() => setThemeKey(t.key)}
                    style={{
                      cursor: "pointer",
                      minHeight: 190,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        minHeight: 190,
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <ThemeIcon
                          icon={ICONS[t.icon] ?? "📊"}
                          accent={accent}
                          size={36}
                        />

                        <div style={{ minWidth: 0 }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: ".9rem",
                              lineHeight: 1.25,
                              color: "var(--text-hi)",
                              fontWeight: 600,
                            }}
                          >
                            {t.title}
                          </h3>

                          <div
                            style={{
                              marginTop: 4,
                              fontFamily: "var(--f-mono)",
                              fontSize: ".67rem",
                              color: "var(--brand-2)",
                            }}
                          >
                            {t.companyCount} compan{t.companyCount === 1 ? "y" : "ies"}
                          </div>
                        </div>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: ".74rem",
                          lineHeight: 1.55,
                          color: "var(--text-muted-solid)",
                          minHeight: "3.7em",
                        }}
                      >
                        {t.blurb}
                      </p>

                      {t.sampleTickers.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 5,
                            marginTop: "auto",
                            paddingTop: 18,
                          }}
                        >
                          {t.sampleTickers.map(tk => (
                            <span
                              key={tk}
                              style={{
                                padding: "4px 7px",
                                borderRadius: 4,
                                background: "var(--surface-3)",
                                border: "1px solid var(--border-soft)",
                                color: "var(--brand-2)",
                                fontFamily: "var(--f-mono)",
                                fontSize: ".62rem",
                                lineHeight: 1,
                              }}
                            >
                              {tk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
