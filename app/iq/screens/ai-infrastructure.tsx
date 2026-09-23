"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { useApiList } from "../hooks/useApiList";
import { useApiResource } from "../hooks/useApiResource";
import { DataState, NotAvailable, VendorTag, StockLogo, hashStr, fmt, sign, cls } from "../utils";
import type { AiInfraTheme, AiInfraThemeDetail, AiInfraCompany, AiInfraCapBucket, CompanyDoc } from "../types";

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

const CAP_FILTERS: Array<"All" | AiInfraCapBucket> = ["All", "Mega", "Large", "Mid", "Small", "Micro"];

/** Company detail modal — mirrors mover-news-modal.tsx's centered-modal shell.
 *  `fullDescription` is the on-demand /live/company profile (richer than the
 *  theme endpoint's one-sentence blurb) when it has loaded; falls back to the
 *  blurb, then an honest empty state — never fabricated prose. */
function CompanyModal({ row, theme, fullDescription, onClose, onOpenFull }: {
  row: AiInfraCompany; theme: AiInfraThemeDetail; fullDescription: string | null;
  onClose: () => void; onOpenFull: () => void;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} style={{ zIndex: 100 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 101, width: "min(640px, 94vw)", maxHeight: "86vh", overflowY: "auto",
          background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: 16,
          boxShadow: "0 24px 60px -10px rgba(0,0,0,.75)", padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StockLogo sym={row.ticker} size={30} />
              <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: "1.4rem", color: "var(--brand-2)" }}>{row.ticker}</div>
            </div>
            <div style={{ fontSize: ".84rem", color: "var(--text-dim-solid)", marginTop: 2 }}>{row.name ?? row.ticker}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)" }}>{theme.title}</span>
              <CapPill cap={row.capBucket} />
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 16 }}>
          <div className="m"><div className="k">Price</div><div className="v">{row.price != null ? `$${fmt(row.price)}` : <NotAvailable />}</div></div>
          <div className="m"><div className="k">Change</div><div className="v" style={row.pctChange != null ? { color: `var(--${cls(row.pctChange)})` } : undefined}>{row.pctChange != null ? sign(row.pctChange) : <NotAvailable />}</div></div>
          <div className="m"><div className="k">Market cap</div><div className="v">{fmtMcap(row.marketCap)}</div></div>
        </div>

        <div className="ai-sec" style={{ marginTop: 4 }}><div className="h">What they do</div></div>
        <div style={{ borderLeft: "3px solid var(--brand)", background: "var(--surface-2)", padding: "10px 14px", borderRadius: 6, fontSize: ".86rem", color: "var(--text-hi)", lineHeight: 1.5 }}>
          {row.blurb ?? <NotAvailable />}
        </div>

        <div className="ai-sec" style={{ marginTop: 18 }}><div className="h">Sector relevance</div></div>
        <p style={{ fontSize: ".84rem", lineHeight: 1.65, color: "var(--text-dim-solid)", margin: 0 }}>
          {fullDescription ?? row.blurb ?? "No fuller company description synced yet."}
        </p>

        <div className="ai-sec" style={{ marginTop: 18, marginBottom: 8 }}><div className="h">Research links</div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn" href={`https://finance.yahoo.com/quote/${row.ticker}`} target="_blank" rel="noopener noreferrer">📈 Yahoo Finance</a>
          <a className="btn" href={`https://finviz.com/quote.ashx?t=${row.ticker}`} target="_blank" rel="noopener noreferrer">📊 Finviz</a>
          <a className="btn" href={`https://www.tradingview.com/symbols/${row.ticker}/`} target="_blank" rel="noopener noreferrer">📉 TradingView</a>
        </div>

        <button className="btn primary" style={{ width: "100%", marginTop: 18 }} onClick={onOpenFull}>
          Open full stock page →
        </button>
      </div>
    </>
  );
}

/** Sector detail — the companies classified into one AI-infrastructure theme. */
function ThemeDetail({ themeKey, onBack, onOpenFull }: {
  themeKey: string; onBack: () => void; onOpenFull: (sym: string) => void;
}) {
  const [capFilter, setCapFilter] = useState<"All" | AiInfraCapBucket>("All");
  const [modalTicker, setModalTicker] = useState<string | null>(null);

  const { data: detail, loading, error } = useApiResource<AiInfraThemeDetail>(`/market-data/ai-infrastructure/${encodeURIComponent(themeKey)}`);
  // Richer per-company text than the theme endpoint's one-sentence blurb —
  // same on-demand /live/company fetch screener.tsx/earnings.tsx use for a
  // selected row, so the modal never fabricates prose the backend doesn't have.
  const { data: modalCompany } = useApiResource<CompanyDoc>(modalTicker ? `/live/company?ticker=${encodeURIComponent(modalTicker)}` : null);

  const companies = detail?.companies ?? [];
  const rows = capFilter === "All" ? companies : companies.filter(c => c.capBucket === capFilter);
  const modalRow = modalTicker ? companies.find(c => c.ticker === modalTicker) ?? null : null;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <ThemeIcon icon={ICONS[detail?.icon ?? ""] ?? "📊"} accent={accentFor(themeKey)} size={44} />
          <div style={{ minWidth: 0 }}>
            <div className="page-title">{detail?.title ?? "AI Corner"}</div>
            {detail?.blurb && <div className="page-sub" style={{ maxWidth: 640 }}>{detail.blurb}</div>}
          </div>
        </div>
        <button className="btn" onClick={onBack}>← Back</button>
      </div>

      <div className="fbar" style={{ margin: "14px 18px 0" }}>
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center" }}>Cap</span>
        {CAP_FILTERS.map(c => (
          <button key={c} className={`chip${capFilter === c ? " on" : ""}`} onClick={() => setCapFilter(c)}>{c}</button>
        ))}
      </div>

      <div className="dash">
        <div className="col-12">
          <div className="card">
            <div className="card-h">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><h3>{rows.length} compan{rows.length === 1 ? "y" : "ies"}</h3><VendorTag v="polygon" /></div>
            </div>
            <div className="card-b" style={{ paddingTop: 2, overflowX: "auto" }}>
              {rows.length === 0 ? (
                <DataState
                  loading={loading}
                  label={error ? `Could not load this sector (${error}).` : "No companies classified into this sector yet."}
                />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ticker</th><th>Company</th><th>What they do</th><th className="center">Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(c => (
                      <tr key={c.ticker} onClick={() => setModalTicker(c.ticker)} style={{ cursor: "pointer" }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <StockLogo sym={c.ticker} size={20} />
                            <b style={{ color: "var(--brand-2)" }}>{c.ticker}</b>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "normal" }}>{c.name ?? c.ticker}</td>
                        <td style={{ whiteSpace: "normal", color: "var(--text-dim-solid)" }}>{c.blurb ?? <NotAvailable />}</td>
                        <td className="center"><CapPill cap={c.capBucket} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalRow && detail && (
        <CompanyModal
          row={modalRow}
          theme={detail}
          fullDescription={modalCompany?.description ?? null}
          onClose={() => setModalTicker(null)}
          onOpenFull={() => { setModalTicker(null); onOpenFull(modalRow.ticker); }}
        />
      )}
    </>
  );
}

/** AI Infrastructure — landing grid of investment-theme tiles, each drilling
 *  into its classified companies. Backed entirely by AiInfrastructureController
 *  (backend `companies` classified per-request against ai-infrastructure-themes.ts —
 *  no hardcoded ticker list, no mock data). */
export function AiInfrastructureScreen() {
  const { openStockFull } = useIQActions();
  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const { data: themes, loading, error } = useApiList<AiInfraTheme>("/market-data/ai-infrastructure");

  if (themeKey) {
    return <ThemeDetail themeKey={themeKey} onBack={() => setThemeKey(null)} onOpenFull={openStockFull} />;
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
        <div className="col-12">
          <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 4 }}>
            <div className="m"><div className="k">Companies</div><div className="v">{loading ? "—" : companyCount.toLocaleString()}</div></div>
            <div className="m"><div className="k">Sectors</div><div className="v">{loading ? "—" : sectorCount}</div></div>
          </div>
        </div>

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {filteredThemes.map(t => (
                <div
                  key={t.key}
                  className="card"
                  style={{ cursor: "pointer", borderTop: `3px solid ${accentFor(t.key)}` }}
                  onClick={() => setThemeKey(t.key)}
                >
                  <div className="card-b">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <ThemeIcon icon={ICONS[t.icon] ?? "📊"} accent={accentFor(t.key)} />
                      <h3 style={{ margin: 0, fontSize: ".92rem", color: "var(--text-hi)" }}>{t.title}</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: ".76rem", lineHeight: 1.5, color: "var(--text-dim-solid)", minHeight: "3.2em" }}>
                      {t.blurb}
                    </p>
                    <div style={{ marginTop: 10, fontSize: ".72rem", color: "var(--brand-2)", fontWeight: 600 }}>
                      {t.companyCount} compan{t.companyCount === 1 ? "y" : "ies"}
                    </div>
                    {t.sampleTickers.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {t.sampleTickers.map(tk => (
                          <span key={tk} className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)" }}>{tk}</span>
                        ))}
                      </div>
                    )}
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
