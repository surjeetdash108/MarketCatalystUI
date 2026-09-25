"use client";

// iq.css is imported globally via app/layout.tsx
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamic import breaks the circular dep: stock.tsx → shell.tsx → stock.tsx
export const StockScreenEmbed = dynamic<{ initialSym?: string }>(
  () => import("./screens/stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { apiGet, apiPatch, apiPost } from "./backend";
import { useAppSelector } from "../store/hooks";
import { AuthGuard } from "../dashboard/auth-guard";
import { menuItems } from "../dashboard/menu-items";

/**
 * Sidebar sections, in display order. 'Hidden' is deliberately absent — those
 * routes exist for the static export but never appear in the nav.
 */
const NAV_GROUPS = ["Home", "Markets", "Research", "Market Recaps", "My Workspace"] as const;
type NavGroup = (typeof NAV_GROUPS)[number];

/**
 * Items bucketed by section and sorted A→Z within each one. Built once at module
 * scope: menuItems is a frozen literal, so re-deriving this per render would be
 * pure waste. localeCompare (not <) so labels like 'Macro & VIX' sort predictably.
 */
const navItemsByGroup = Object.fromEntries(
  NAV_GROUPS.map(g => [
    g,
    menuItems
      .filter(m => m.group === g)
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, "en")),
  ]),
) as Record<NavGroup, { label: string; slug: string; group: string; icon: string; badge: string | null }[]>;

import { type PulseItem } from "./data";
import { fmt, sign, cls, arr, SemiGauge, DataState, NotAvailable, VendorTag, titleCaseLabel, StockLogo} from "./utils";
import { NotificationBell } from "./notification-bell";
import { useTickerSearch } from "./hooks/useTickerSearch";
import { useTapeStream } from "./hooks/useTapeStream";
import { useBackendMarketStatus } from "./hooks/useBackendMarketStatus";
import { useApiList } from "./hooks/useApiList";
import { useApiResource } from "./hooks/useApiResource";
import { useWatchlists, WatchlistsContext } from "./hooks/useWatchlists";
import { WatchlistPicker } from "./watchlist-picker";
import { pulseFromLive, tapeItemsToIndexDocs } from "./live-market-indices";
import type { CompanyDoc, SectorApiDoc, LiveEarningsDoc } from "./types";
import { surprisePct } from "./types";
import { LiveQuotesProvider, QUOTE_DELAY_LABEL } from "./live-quotes-context";

// ---- Route helpers ----
function slugToHref(slug: string): string {
  return slug === "dashboard" ? "/dashboard" : `/menu/${slug}`;
}

// Fire-and-forget: records a resolved ticker search/selection for the
// "Most searched tickers" dashboard widget. Never blocks or throws on the
// caller — a failed log write shouldn't stop navigation to the stock page.
function logSearchedTicker(sym: string) {
  void apiPost("/live/searched-ticker", { ticker: sym }).catch(() => {});
}

// ---- Font type ----
/** "inter-source" is a PAIRING, not a single face: it sets the heading font as
 *  well as the body font. Every other key changes --f-body only. */
export type FontKey =
  | "geist" | "inter" | "dm-sans" | "space-grotesk" | "plus-jakarta-sans"
  | "ibm-plex-sans" | "outfit" | "manrope" | "inter-source"
  | "figtree" | "public-sans" | "sora" | "lexend" | "urbanist"
  | "work-sans" | "archivo" | "rubik" | "nunito-sans";

// ---- IQ Actions context ----
interface IQActions {
  openStock: (sym: string) => void;
  openStockFull: (sym: string) => void;
  openStockDetail: (sym: string, list?: string[]) => void;
  openMoverModal: (sym: string) => void;
  openEarnings: (sym: string) => void;
  openSector: (name: string) => void;
  openIndex: (i: number) => void;
  openFearGreed: () => void;
  setCopilot: (open: boolean) => void;
  openChart: (title: string, node: ReactNode) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  font: FontKey;
  setFont: (f: FontKey) => void;
}
export const IQActionsContext = createContext<IQActions>({
  openStock: () => {},
  openStockFull: () => {},
  openStockDetail: () => {},
  openMoverModal: () => {},
  openEarnings: () => {},
  openSector: () => {},
  openIndex: () => {},
  openFearGreed: () => {},
  setCopilot: () => {},
  openChart: () => {},
  theme: "dark",
  setTheme: () => {},
  font: "dm-sans",
  setFont: () => {},
});
export function useIQActions() { return useContext(IQActionsContext); }

export function ExpandBtn({ title, node }: { title: string; node: ReactNode }) {
  const { openChart } = useIQActions();
  return (
    <button
      className="chart-expand-btn"
      title="Expand chart"
      onClick={(e) => { e.stopPropagation(); openChart(title, node); }}
    >
      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  );
}

// ---- Nav icon SVG ----
/**
 * MarketCatalyst brand mark — inline SVG (gradient ascending bar-chart +
 * trend line ending in an arrowhead) and the wordmark "Market" (light) +
 * "Catalyst" (brand green). Crisp at any size, theme-aware (the gradient's
 * bright stop tracks var(--brand) per theme).
 */
function BrandLogo({ height = 28 }: { height?: number }) {
  return (
    <span className="brand-logo" style={{ gap: Math.round(height * 0.3), lineHeight: 1 }}>
      <svg viewBox="0 0 44 44" width={height} height={height} aria-hidden="true" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="mcBrandGrad" x1="4" y1="40" x2="40" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0D3B2E" />
            <stop offset="1" style={{ stopColor: "var(--brand)" }} />
          </linearGradient>
        </defs>
        <rect x="5" y="27" width="6" height="12" rx="2" fill="url(#mcBrandGrad)" />
        <rect x="14" y="21" width="6" height="18" rx="2" fill="url(#mcBrandGrad)" />
        <rect x="23" y="15" width="6" height="24" rx="2" fill="url(#mcBrandGrad)" />
        <rect x="32" y="9" width="6" height="30" rx="2" fill="url(#mcBrandGrad)" />
        <path d="M7 30 L16 23 L25 17 L36 8" fill="none" stroke="url(#mcBrandGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 8 L36 8 L36 16" fill="none" stroke="url(#mcBrandGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{
        fontFamily: "var(--f-display), system-ui, sans-serif",
        fontWeight: 800, fontSize: Math.round(height * 0.68), letterSpacing: "-0.02em", whiteSpace: "nowrap",
      }}>
        <span style={{ color: "var(--text-hi)" }}>Market</span>
        <span className="brand-word-grad">Catalyst</span>
      </span>
    </span>
  );
}

function NavIcon({ slug }: { slug: string }) {
  const paths: Record<string, string> = {
    dashboard:   "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
    earnings:    "M4 5h16v14H4V5Zm0 4h16M8 3v4m8-4v4",
    movers:      "M3 17l5-5 4 3 7-9M16 6h6v6",
    heatmap:     "M3 3h8v8H3V3Zm13 0h8v5h-8V3ZM13 10h8v11h-8V10ZM3 13h8v8H3v-8Z",
    analyst:     "M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z",
    screener:    "M3 4h18l-7 8v6l-4 2V12z",
    themes:      "M12 2L2 7l10 5 10-5L12 2zM2 12l10 5 10-5M2 17l10 5 10-5",
    ipos:        "M3 17l6-6 4 4 8-8M14 7h7v7",
    portfolio:   "M3 13a9 9 0 1 0 18 0 9 9 0 0 0-18 0ZM12 7v6l4 2",
    watchlist:   "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7ZM12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
    stock:       "M4 19V5M4 19h16M8 15l3-4 3 2 4-7",
    insider:     "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-1a6 6 0 0 1 12 0v1M18 11l2 2 3-3",
    commentary:  "M4 5h16v11H8l-4 4V5z",
    recap:       "M4 3h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4V3Zm0 0v18M8 8h8M8 12h8M8 16h5",
    macro:       "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18",
    options:     "M12 3l8 4.5-8 4.5-8-4.5L12 3zM4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5",
    "etf-corner":        "M8 10a4 4 0 0 1 8 0M3 10h18l-2 9H5L3 10ZM9 14v3M15 14v3",
    "ai-infrastructure": "M7 7h10v10H7ZM10 10h4v4h-4ZM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  };
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[slug] ?? "M5 12h14"} />
    </svg>
  );
}

// ---- Drawers ----
function StockDrawer({ sym, companies, sectorsLive, loading, onClose }: {
  sym: string; companies: CompanyDoc[]; sectorsLive: SectorApiDoc[]; loading: boolean; onClose: () => void;
}) {
  const { openStockFull, openSector } = useIQActions();
  const c = companies.find(x => x.ticker === sym);

  const name   = c?.name ?? sym;
  const sector = c?.sector ?? null;
  const p      = c?.price ?? null;
  const chg    = c?.pctChange ?? null;
  const rvol   = c?.rvol ?? null;
  const rs     = c?.rsRating ?? null;
  const mc     = c?.marketCap ?? null;
  const mcTxt  = mc != null ? (mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : `$${(mc / 1e9).toFixed(1)}B`) : null;
  const sec    = sector ? sectorsLive.find(s => s.sector === sector) ?? null : null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-h">
          {/* The company logo, as every ticker row draws it. */}
          <StockLogo sym={sym} size={31} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>
              {sym}
            </div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
              {name} · {sector ?? "—"}
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          {!c ? (
            <DataState loading={loading} label={`No live data synced for ${sym} yet.`} />
          ) : (
            <>
              {/* Pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {chg != null && <span className={`pill ${chg >= 0 ? "up" : "dn"}`}>{arr(chg)} {sign(chg)} today</span>}
                {rvol != null && rvol >= 2 && <span className="pill amc">{rvol.toFixed(1)}× volume</span>}
              </div>

              {sec && chg != null && (
                <div className="ai-block" style={{ marginBottom: 14 }}>
                  <div className="card-h">
                    <h3 className="ai-c">◆ Sector context</h3>
                  </div>
                  <div className="card-b">
                    <p style={{ fontSize: ".85rem", lineHeight: 1.6, color: "var(--text)", margin: 0 }}>
                      Its group, <b>{titleCaseLabel(sector)}</b>, is {sec.pctChange >= 0 ? "up" : "down"}{" "}
                      <b className={cls(sec.pctChange)}>{sign(sec.pctChange)}</b> today —{" "}
                      {(sec.pctChange >= 0) === (chg >= 0) ? "in line with sector strength." : "bucking its sector today."}
                    </p>
                  </div>
                </div>
              )}

              {/* Grid 1: Today · Rel. volume · RS rank */}
              <div className="metric-grid" style={{ marginBottom: 12 }}>
                <div className="m"><div className="k">Today</div><div className={chg != null ? `v ${cls(chg)}` : "v"}>{chg != null ? sign(chg) : <NotAvailable />}</div></div>
                <div className="m"><div className="k">Rel. volume</div><div className="v">{rvol != null ? `${rvol.toFixed(1)}×` : <NotAvailable />}</div></div>
                <div className="m"><div className="k">RS rank</div><div className="v">{rs != null ? `${rs}/99` : <NotAvailable />}</div></div>
              </div>

              {/* Grid 2: Last price · Market cap */}
              <div className="metric-grid" style={{ marginBottom: 14 }}>
                <div className="m"><div className="k">Last price</div><div className="v">{p != null ? `$${fmt(p)}` : <NotAvailable />}</div></div>
                <div className="m"><div className="k">Market cap</div><div className="v" style={{ fontSize: ".92rem" }}>{mcTxt ?? <NotAvailable />}</div></div>
              </div>
            </>
          )}

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {sector && (
              <button className="btn" style={{ width: "100%" }}
                onClick={() => { onClose(); openSector(sector); }}>
                View {titleCaseLabel(sector)} in heatmap →
              </button>
            )}
            <button className="btn primary" style={{ width: "100%" }}
              onClick={() => { onClose(); openStockFull(sym); }}>
              Open full stock page →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function EarningsDrawer({ sym, liveEarnings, loading, onClose }: { sym: string; liveEarnings: LiveEarningsDoc[]; loading: boolean; onClose: () => void }) {
  const { openStockFull } = useIQActions();
  const events = liveEarnings.filter(x => x.ticker === sym).sort((a, b) => b.date.localeCompare(a.date));
  const e = events[0] ?? null;
  const epsBeat = e ? surprisePct(e.epsActual, e.epsEstimate) : null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-h">
          {/* The company logo, as every ticker row draws it. */}
          <StockLogo sym={sym} size={31} />
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)" }}>{sym}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>{e ? e.date : "—"}</div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          {!e ? (
            <DataState loading={loading} label={`No earnings data synced for ${sym} yet.`} />
          ) : (
            <div className="metric-grid">
              <div className="m">
                <div className="k">EPS · actual vs est</div>
                <div className="v">{e.epsActual != null ? `$${e.epsActual}` : <NotAvailable />}</div>
                <div className={epsBeat != null ? `s ${epsBeat >= 0 ? "up" : "dn"}` : "s"}>
                  est {e.epsEstimate != null ? `$${e.epsEstimate}` : "—"} · {epsBeat != null ? `${epsBeat > 0 ? "+" : ""}${epsBeat.toFixed(1)}%` : ""}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => { onClose(); openStockFull(sym); }}>Open full stock page</button>
          </div>
        </div>
      </div>
    </>
  );
}

function SectorDrawer({ name, companies, sectorsLive, loading, onClose }: {
  name: string; companies: CompanyDoc[]; sectorsLive: SectorApiDoc[]; loading: boolean; onClose: () => void;
}) {
  const { openStock } = useIQActions();
  const sector = sectorsLive.find(s => s.sector === name) ?? null;
  const sorted = companies
    .filter(c => c.sector === name && c.marketCap != null && c.pctChange != null)
    .sort((a, b) => (b.marketCap as number) - (a.marketCap as number));

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#14181B,#0E1013)", color: "var(--brand)" }}>
            {name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>{name}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
              {sector != null ? <span className={cls(sector.pctChange)}>{sign(sector.pctChange)} today</span> : <NotAvailable />}
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          <div className="ai-sec"><div className="h">Constituents · by market cap</div></div>
          {sorted.length === 0 ? (
            <DataState loading={loading} label={`No live constituents synced for ${name} yet.`} />
          ) : sorted.map(c => (
            <div key={c.ticker} className="minirow" style={{ cursor: "pointer" }} onClick={() => { onClose(); openStock(c.ticker); }}>
              <span className="mono" style={{ fontWeight: 700, color: "var(--text-hi)", minWidth: 52 }}>{c.ticker}</span>
              <span style={{ fontSize: ".75rem", color: "var(--text-dim-solid)", flex: 1, marginLeft: 8 }}>${((c.marketCap as number) / 1e9).toFixed(1)}B</span>
              <span className={`mono ${cls(c.pctChange as number)}`} style={{ fontSize: ".82rem" }}>{sign(c.pctChange as number)}</span>
            </div>
          ))}

          <button className="btn primary" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Back to heatmap</button>
        </div>
      </div>
    </>
  );
}

/**
 * Says, once and app-wide, what every percentage on screen currently means.
 *
 * Outside regular hours the vendor rebases each quote on the LAST close, so the
 * "change" on every tile, row and table is the extended-hours move — not the
 * session move. MDB read +3.73% while its last regular session actually closed
 * DOWN 4.09%, and the tiny ±0.0x% figures across the dashboard were after-hours
 * drift rather than real day moves.
 *
 * One banner rather than a badge per row: the condition is a property of the
 * market clock, not of any ticker, so it is identical for every number on the
 * page. The stock header still carries its own precise tag, where the exact
 * regular close is worth naming.
 *
 * NOT shown on Movers. That board is a leaderboard for a COMPLETED session, so
 * outside regular hours it deliberately keeps that session's close and move
 * rather than the extended-hours print (see shownValues in screens/movers.tsx)
 * and marks the affected rows PM/AH itself. This banner would state the exact
 * opposite of what those rows are showing — and it was already untrue there for
 * the two weekly tabs, whose column is a 5-day move and not a move against the
 * last close.
 */
const NO_SESSION_NOTICE = ["/menu/movers"];

/*
function SessionNotice({ phase, pathname }: { phase: "open" | "pre" | "after" | "closed" | "unknown"; pathname: string }) {
  if (phase === "open" || phase === "unknown") return null;
  if (NO_SESSION_NOTICE.includes(pathname)) return null;
  const label =
    phase === "pre" ? "Pre-market" : phase === "after" ? "After hours" : "Market closed";
  return (
    <div
      role="note"
      style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        margin: "0 0 12px", padding: "7px 12px",
        background: "var(--surface-2)", border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-sm)", fontSize: ".72rem", color: "var(--text-dim-solid)",
        lineHeight: 1.5,
      }}
    >
      <span className="pill" style={{ background: "var(--surface-3)", color: "var(--warn)", fontSize: ".62rem" }}>
        {label}
      </span>
      <span>
        Percentage changes shown are moves against the last close, so they
        reflect {phase === "pre" ? "pre-market" : phase === "after" ? "after-hours" : "extended-hours"} trading
        rather than the last full session.
      </span>
    </div>
  );
}
*/

// ---- Index drawer (openIndex) ----
function IndexDrawer({ idx, pulse: livePulse, sectorsLive, loading, phase, onClose }: {
  idx: number; pulse: PulseItem[]; sectorsLive: SectorApiDoc[]; loading: boolean;
  phase: "open" | "pre" | "after" | "closed" | "unknown"; onClose: () => void;
}) {
  const x = livePulse[idx];
  if (!x) return null;
  const dec = x.value > 1000 ? 0 : 2;
  const dollar = x.value - x.prevClose;
  /**
   * Whether the open / high / low below describe the SAME session as the price
   * above them.
   *
   * The vendor's OHLC block is the last COMPLETED regular session, while the
   * price keeps updating through pre- and post-market. Outside regular hours
   * the two therefore describe different sessions, and the drawer was labelling
   * the older one "Day high" / "Day low" next to a newer price — MDB showed a
   * price of 382.51 above a day high of 381.25, a range that excluded the very
   * number printed above it.
   *
   * Two independent signals, because either alone can miss:
   *  - the market phase says a regular session is not running;
   *  - the price sits outside the quoted range, which is proof on its own that
   *    the two cannot be the same session, whatever the clock says.
   */
  const outsideRange =
    x.dayHigh != null && x.dayLow != null &&
    (x.value > x.dayHigh || x.value < x.dayLow);
  const priorSession = phase !== "open" && phase !== "unknown" ? true : outsideRange;
  const c = x.change >= 0 ? "up" : "down";
  const eq = ["S&P 500", "Nasdaq", "Dow", "Russell 2000"].includes(x.label);
  const sortedSectors = [...sectorsLive].sort((a, b) => b.pctChange - a.pctChange);
  const lead = sortedSectors.slice(0, 3);
  const lag = sortedSectors.slice(-3).reverse();
  const crypto = ["Bitcoin", "Ethereum"].includes(x.label);
  const sub = eq
    ? "Equity index"
    : x.label === "VIX"
      ? "Volatility index"
      : x.label.includes("Yield")
        ? "Treasury yield"
        : crypto
          ? "Cryptocurrency"
          : "Market benchmark";
  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="side-drawer">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#14181B,#0E1013)", color: "var(--brand)" }}>{x.label[0]}</div>
          <div><div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>{x.label}</div><div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>{sub} · {QUOTE_DELAY_LABEL}</div></div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-b">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--text-hi)" }}>{fmt(x.value, dec)}</div>
            <div className={c} style={{ fontWeight: 600 }}>{arr(x.change)} {x.change >= 0 ? "+" : ""}{fmt(Math.abs(dollar), dec)} ({sign(x.change)})</div>
          </div>
          {/* "Last session" rather than "Day" whenever these do not describe the
              same session as the price above — see priorSession. */}
          <div className="metric-grid">
            <div className="m"><div className="k">{priorSession ? "Session open" : "Open"}</div><div className="v">{fmt(x.open, dec)}</div></div>
            <div className="m"><div className="k">Prev close</div><div className="v">{fmt(x.prevClose, dec)}</div></div>
            <div className="m"><div className="k">{priorSession ? "Session high" : "Day high"}</div><div className="v">{x.dayHigh != null ? fmt(x.dayHigh, dec) : <NotAvailable />}</div></div>
            <div className="m"><div className="k">{priorSession ? "Session low" : "Day low"}</div><div className="v">{x.dayLow != null ? fmt(x.dayLow, dec) : <NotAvailable />}</div></div>
          </div>
          {priorSession && (
            <div style={{ marginTop: 8, fontSize: ".68rem", color: "var(--text-dim-solid)", lineHeight: 1.5 }}>
              Open, high and low are the last completed regular session. The
              price above is the latest {phase === "pre" ? "pre-market" : phase === "after" ? "after-hours" : "extended-hours"} print,
              so it can sit outside that range.
            </div>
          )}
          {eq && (
            <>
              {sortedSectors.length === 0 ? (
                <div style={{ marginTop: 16 }}><DataState loading={loading} label="No live sector performance data yet." /></div>
              ) : (
                <>
                  <div className="ai-sec" style={{ marginTop: 16 }}><div className="h">Leading sectors today</div></div>
                  {lead.map(g => (
                    <div key={g.sector} className="minirow" style={{ cursor: "pointer" }} onClick={() => { onClose(); }}>
                      <span className="tkr" style={{ fontFamily: "var(--f-body)", fontWeight: 600, width: "auto" }}>{titleCaseLabel(g.sector)}</span>
                      <span className="mid" />
                      <span className="r up">{sign(g.pctChange)}</span>
                    </div>
                  ))}
                  <div className="ai-sec" style={{ marginTop: 12 }}><div className="h">Lagging sectors today</div></div>
                  {lag.map(g => (
                    <div key={g.sector} className="minirow" style={{ cursor: "pointer" }} onClick={() => { onClose(); }}>
                      <span className="tkr" style={{ fontFamily: "var(--f-body)", fontWeight: 600, width: "auto" }}>{titleCaseLabel(g.sector)}</span>
                      <span className="mid" />
                      <span className="r down">{sign(g.pctChange)}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>
            {eq ? "View market heatmap →" : "Go to Macro & VIX →"}
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Mover Drawer — full stock page in a right-side sliding drawer ----
function MoverModal({ sym, onClose }: { sym: string; onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="stock-side-drawer">
        <div className="drawer-h" style={{ paddingTop: 14, paddingBottom: 14 }}>
          {/* The company logo, as every ticker row draws it. */}
          <StockLogo sym={sym} size={31} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
              {sym} · Stock Details
            </div>
            <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>Full analysis · chart · technicals · peers</div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-b">
          <StockScreenEmbed initialSym={sym} />
        </div>
      </div>
    </>
  );
}

/**
 * The whole stock detail screen rendered INSIDE the centred popover, instead of
 * a summary plus an "Open full stock page" button that navigated away.
 *
 * Deliberately a separate drawer type from StockDrawer: this is wired only to
 * the dashboard's Most Searched cards (openStockDetail). Every other caller of
 * openStock still gets the compact StockDrawer summary, so click behaviour
 * elsewhere in the app is unchanged.
 *
 * `.drawer.wide` is the same centred popover shell as StockDrawer, just wider
 * and taller so the embedded screen's columns are not crushed. StockScreenEmbed
 * brings its own padding, hence `.drawer.wide .drawer-b{padding:0}` in iq.css.
 */
function StockDetailPopover({ sym, list, onNavigate, onClose }: {
  sym: string;
  /** Tickers to page through with the arrows — the list the popover was opened from. */
  list?: string[];
  onNavigate: (sym: string) => void;
  onClose: () => void;
}) {
  // Arrows step through the originating list. Disabled (not wrapped) at either
  // end, so the ends of a ranked list stay legible rather than silently looping.
  const idx  = list?.indexOf(sym) ?? -1;
  const prev = idx > 0 ? list![idx - 1] : null;
  const next = idx >= 0 && idx < (list?.length ?? 0) - 1 ? list![idx + 1] : null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open wide">
        <div className="drawer-h" style={{ paddingTop: 14, paddingBottom: 14 }}>
          {/* The company logo, as every ticker row draws it. */}
          <StockLogo sym={sym} size={31} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
              {sym} · Stock Details
            </div>
            <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>Full analysis · chart · technicals · peers</div>
          </div>
          {/* .closebtn carries margin-left:auto; the group takes that over. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            {list && list.length > 1 && (
              <>
                <button className="closebtn" style={{ marginLeft: 0 }} disabled={!prev}
                  title={prev ? `Previous · ${prev}` : "Start of list"}
                  aria-label={prev ? `Show previous ticker, ${prev}` : "Start of list"}
                  onClick={() => prev && onNavigate(prev)}>◀</button>
                <button className="closebtn" style={{ marginLeft: 0 }} disabled={!next}
                  title={next ? `Next · ${next}` : "End of list"}
                  aria-label={next ? `Show next ticker, ${next}` : "End of list"}
                  onClick={() => next && onNavigate(next)}>▶</button>
              </>
            )}
            <button className="closebtn" style={{ marginLeft: 0 }} aria-label="Close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="drawer-b">
          <StockScreenEmbed initialSym={sym} />
        </div>
      </div>
    </>
  );
}

// ---- Fear & Greed drawer ----
function FearGreedDrawer({ onClose }: { onClose: () => void }) {
  const comps = [
    ["Market momentum", "Greed", 72], ["Stock price strength", "Greed", 66],
    ["Stock price breadth", "Neutral", 54], ["Put / call ratio", "Greed", 68],
    ["Market volatility (VIX)", "Calm", 60], ["Safe-haven demand", "Greed", 64],
    ["Junk-bond demand", "Greed", 58],
  ] as [string, string, number][];
  return (
    <>
      <div className="scrim open" onClick={onClose} />
      <div className="side-drawer">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#1F7A46,#2A5B3D)", color: "#A7F3C0" }}>62</div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>Fear &amp; Greed Index</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Composite sentiment · 7 inputs · updates continuously</div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-b">
          <div className="gauge-wrap" style={{ padding: "4px 0 10px" }}>
            <SemiGauge val={62} label="Greed" id="fg-drawer" />
          </div>
          <div className="ai-sec"><div className="h">History</div></div>
          <div className="metric-grid">
            <div className="m"><div className="k">Previous close</div><div className="v up">58 · Greed</div></div>
            <div className="m"><div className="k">1 week ago</div><div className="v">49 · Neutral</div></div>
            <div className="m"><div className="k">1 month ago</div><div className="v up">71 · Greed</div></div>
            <div className="m"><div className="k">1 year ago</div><div className="v down">39 · Fear</div></div>
          </div>
          <div className="ai-sec" style={{ marginTop: 16 }}><div className="h">Seven components</div></div>
          {comps.map(([label, rating, val]) => (
            <div key={label} style={{ margin: "9px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", color: "var(--text)" }}>
                <span>{label}</span>
                <span style={{ color: val >= 60 ? "var(--up)" : val < 45 ? "var(--down)" : "var(--text-dim-solid)", fontWeight: 600 }}>{rating} · {val}</span>
              </div>
              <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 4, marginTop: 4 }}>
                <i style={{ display: "block", height: "100%", width: val + "%", borderRadius: 4, background: val >= 60 ? "var(--up)" : val < 45 ? "var(--down)" : "var(--warn)" }} />
              </div>
            </div>
          ))}
          <div className="note" style={{ marginTop: 16 }}>
            <b style={{ color: "var(--text-hi)" }}>AI read:</b> Sentiment is in <b>Greed (62)</b> and rising vs last week (49). Risk appetite is healthy but not euphoric — a push above 75 (extreme greed) would be a contrarian caution flag.
          </div>
          <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>Stay on Macro &amp; VIX</button>
        </div>
      </div>
    </>
  );
}

// ---- Copilot panel ----
// No LLM backend is wired up yet (no /api/copilot-style endpoint exists) —
// this used to cycle 4 hardcoded replies regardless of what was typed while
// claiming "Connected to your portfolio · live data". That's exactly the kind
// of fabricated response this pass removes: it never leaves silent, but it
// must say plainly that there's no real assistant behind it yet.
type CopilotMsg = { role: "user" | "ai"; text: string };
const NOT_AVAILABLE_REPLY = "AI Copilot isn't connected to a live assistant yet — there's no model wired up behind this panel. Use the screens directly for live data (Stock Detail, Screener, Dashboard, etc.).";

function CopilotPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<CopilotMsg[]>([
    { role: "ai", text: "AI Copilot is a planned feature — no live assistant is connected yet. Your message won't be answered, but the rest of the app's data is real." },
  ]);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  function send(overrideText?: string) {
    const txt = (overrideText ?? input).trim();
    if (!txt) return;
    setMessages(prev => [...prev, { role: "user", text: txt }, { role: "ai", text: NOT_AVAILABLE_REPLY }]);
    setInput("");
    setTimeout(() => { bodyRef.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, 50);
  }

  const SUGGESTS = [
    "Explain today's biggest mover",
    "How's my portfolio positioned?",
    "What's driving rates today?",
  ];

  return (
    <div className="copilot">
      <div className="copilot-head">
        <div className="copilot-icon">✦</div>
        <div>
          <div className="copilot-title">Market Copilot</div>
          <div className="copilot-sub">
            <span className="dot" style={{ background: "var(--text-dim-solid)", width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
            Not connected — no live assistant yet
          </div>
        </div>
        <button className="copilot-close" onClick={onClose}>✕</button>
      </div>
      <div className="copilot-body" ref={bodyRef}>
        {/* Keyed by role+position+content rather than the bare index: the list
            grows from the top as replies stream in, and an index key made React
            reuse the previous message's DOM node for the new one. */}
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}-${m.text.slice(0, 24)}`} className={`copilot-msg ${m.role}`}>
            <div className="cm-text">{m.text}</div>
          </div>
        ))}
      </div>
      {messages.length === 1 && (
        <div className="cop-suggest">
          {SUGGESTS.map(s => (
            <button key={s} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}
      <div className="copilot-inp">
        <input
          placeholder="Ask about markets, earnings, your portfolio…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          autoFocus
        />
        <button className="copilot-send" onClick={() => send()}>
          <svg viewBox="0 0 24 24" width="16" fill="none">
            <path d="M4 12l16-8-6 16-2-6-8-2z" fill="#fff" />
          </svg>
        </button>
      </div>
    </div>
  );
}


// ---- Main IQ Shell ----
export function IQShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const { data: profile } = useAppSelector(state => state.profile);

  // Same live merge Dashboard's Market Pulse widget uses — keeps the top
  // ticker strip and the index drawer it opens in sync with each other.
  // Backed by the backend's ticker-tape SSE broadcast, not a direct Firestore
  // listener — one shared upstream Polygon call for every connected browser.
  const { frame: tapeFrame } = useTapeStream();
  const liveIndices = tapeFrame ? tapeItemsToIndexDocs(tapeFrame.items) : [];
  const livePulse = pulseFromLive(liveIndices);
  const tickerItems = [...livePulse, ...livePulse];

  // Shared live data for the shell-level drawers (stock/sector/earnings/index
  // quick-preview popups reachable from every screen via useIQActions()).
  const { data: shellCompanies, loading: shellCompaniesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: shellSectors, loading: shellSectorsLoading } = useApiList<SectorApiDoc>("/market-data/sectors");
  const { data: shellEarnings, loading: shellEarningsLoading } = useApiList<LiveEarningsDoc>("/market-data/earnings");

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("iq-theme") as "dark" | "light") || "dark";
  });
  const [font, setFont] = useState<FontKey>(() => {
    if (typeof window === "undefined") return "dm-sans";
    return (localStorage.getItem("iq-font") as FontKey) || "dm-sans";
  });
  // Always the US Eastern session clock, regardless of the viewer's own
  // timezone — this label is hard-coded "ET" in the JSX below, so the value
  // itself must actually be ET (previously used the browser's local
  // timezone with no `timeZone` option, so a viewer in India saw IST labelled
  // "ET").
  const [navTime, setNavTime] = useState(() => {
    const d = new Date();
    const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
    return { day, time };
  });
  // GET /live/market-status (vendor session state), not the local ET-clock
  // computation — falls back to that computation internally on a fetch failure.
  const mkt = useBackendMarketStatus();

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNavTime({
        day: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }),
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
      });
    };
    tick(); // correct any build-time (static-export) value right after hydration
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [expandedChart, setExpandedChart] = useState<{ title: string; node: ReactNode } | null>(null);
  // Collapsed-rail tooltip. A CSS ::after cannot be used here: .rail sets
  // overflow-x:hidden (and overflow-y:auto forces the other axis to compute as
  // auto), so anything drawn to the right of an item is clipped. A fixed-position
  // element positioned from the hovered item's rect escapes that entirely.
  const [navTip, setNavTip] = useState<{ label: string; top: number } | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("iq-nav-collapsed") === "1";
  });
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // One shared watchlists instance for the whole app (provided via context
  // below). The ⌘K search star opens the "which watchlist" picker; membership
  // is the union across every list, and any add/remove is reflected instantly
  // on the Watchlist screen (same state).
  const wl = useWatchlists();
  const searchStarred = new Set(wl.watchlists.flatMap(w => w.tickers));
  const [wlPicker, setWlPicker] = useState<{ sym: string; x: number; y: number } | null>(null);
  function openSearchStar(sym: string, e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setWlPicker({ sym, x: r.right - 250, y: r.bottom });
  }

  // Open the Search (stock) page for a ticker. Persist it (for a fresh mount),
  // broadcast it (so an already-mounted StockScreen switches immediately), then
  // navigate. Used by both the search Enter key and clicking a result.
  function goToStock(sym: string) {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    logSearchedTicker(s);
    if (typeof window !== "undefined") {
      localStorage.setItem("iq-stock", s);
      window.dispatchEvent(new CustomEvent("iq-stock-change", { detail: s }));
    }
    setSearchOpen(false);
    setSearchQ("");
    router.push("/menu/stock");
  }
  // Live top-by-market-cap companies, used both as the "quick access" list
  // shown before the user types and as a name-match augmentation once they
  // do — useTickerSearch's full ~10,000-ticker universe only matches by
  // ticker prefix, so a company-name search (e.g. "apple") needs this.
  const quickAccessCompanies = [...shellCompanies].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 15);
  const tickerSearchResults = useTickerSearch(searchQ);
  const searchMatches: Array<{ sym: string; name: string | null; price: number | null; pctChange: number | null }> = searchQ
    ? (() => {
        const q = searchQ.toLowerCase();
        const bySym = new Map(tickerSearchResults.map(r => [r.ticker, r]));
        // A handful of live `companies` docs are written by side-jobs (news
        // count, fundamentals growth) that can create the doc before the
        // primary sync job ever sets `ticker` — guard rather than crash on
        // that partial data.
        const nameMatched = shellCompanies.filter(
          c => !!c.ticker && ((c.name ?? "").toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q)) && !bySym.has(c.ticker),
        );
        return [
          ...tickerSearchResults.map(r => ({ sym: r.ticker, name: r.name, price: r.price, pctChange: r.pctChange })),
          ...nameMatched.map(c => ({ sym: c.ticker, name: c.name, price: c.price, pctChange: c.pctChange })),
        ];
      })()
    : quickAccessCompanies.filter(c => !!c.ticker).map(c => ({ sym: c.ticker, name: c.name, price: c.price, pctChange: c.pctChange }));
  // On-demand quote enrichment: /live/search returns only ticker+name (its
  // in-memory universe carries no quote), so searched tickers arrive with a
  // null price. Fetch live quotes for the visible matches and overlay
  // price/pctChange so the search row can show them next to the ticker.
  // Live quotes for the visible search matches — polled every 30s while the
  // dropdown is open, so searched tickers show a LIVE price (the /live/search
  // universe carries no quote), matching watchlist/portfolio.
  const enrichSyms = searchMatches.slice(0, 12).map(m => m.sym).slice(0, 25).join(",");
  // NOTE: deliberately NOT the shared useLiveQuotes poll — this runs in IQShell,
  // which is the component that RENDERS LiveQuotesProvider, so it sits outside
  // its own context and would silently read an empty map. /live/quotes now
  // serves the same shared server-side cache anyway, so the dropdown shows the
  // same numbers as every other surface; only its poll phase is independent.
  const searchQuotesPath = searchOpen && enrichSyms ? `/live/quotes?tickers=${encodeURIComponent(enrichSyms)}` : null;
  const { data: liveSearchQuotes } = useApiResource<Array<{ ticker: string; price: number | null; pctChange: number | null }>>(searchQuotesPath, 30000);
  const quoteMap = new Map((liveSearchQuotes ?? []).map(q => [q.ticker.toUpperCase(), { price: q.price, pctChange: q.pctChange }]));
  const displayMatches = searchMatches.map(m => {
    const q = quoteMap.get(m.sym);
    return q ? { ...m, price: q.price ?? m.price, pctChange: q.pctChange ?? m.pctChange } : m;
  });
  const cmdRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [drawer, setDrawer] = useState<
    | { type: "stock"; sym: string }
    | { type: "mover-modal"; sym: string }
    | { type: "stock-detail"; sym: string; list?: string[] }
    | { type: "earnings"; sym: string }
    | { type: "sector"; name: string }
    | { type: "index"; idx: number }
    | { type: "feargreed" }
    | null
  >(null);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Overlay scrollbars. The thumb is transparent at rest (see iq.css) and CSS
  // :hover covers the common case, but a trackpad or keyboard scroll can happen
  // with the pointer nowhere near the scroller — this flips the thumb on for a
  // beat whenever anything actually scrolls. Capture phase is required: `scroll`
  // does not bubble, so a listener on document only sees it on the way down.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const root = document.querySelector(".iq-root");
      if (!root) return;
      root.classList.add("is-scrolling");
      if (t) clearTimeout(t);
      t = setTimeout(() => root.classList.remove("is-scrolling"), 800);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      if (t) clearTimeout(t);
    };
  }, []);

  // Load saved theme + font from the backend on mount
  useEffect(() => {
    if (!user?.uid) return;
    void (async () => {
      try {
        const data = await apiGet<{ darkMode?: boolean; font?: string }>("/api/settings");
        if (typeof data.darkMode === "boolean") {
          const resolved = data.darkMode ? "dark" : "light";
          localStorage.setItem("iq-theme", resolved);
          setTheme(resolved);
        }
        if (typeof data.font === "string") {
          localStorage.setItem("iq-font", data.font);
          setFont(data.font as FontKey);
        }
      } catch { /* keep defaults on error */ }
    })();
  }, [user?.uid]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileDropdownOpen]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleCmdOutside(e: MouseEvent) {
      if (cmdRef.current && !cmdRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQ("");
      }
    }
    if (searchOpen) document.addEventListener("mousedown", handleCmdOutside);
    return () => document.removeEventListener("mousedown", handleCmdOutside);
  }, [searchOpen]);

  // Close mobile nav on route change
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Auto-collapse the left rail on the stock/search detail page (slug "stock",
  // route /menu/stock) so the ticker view gets the full width. goToStock() routes
  // here on search, so searching a ticker collapses the rail too; landing on the
  // page with a ticker already loaded collapses it as well. Navigating anywhere
  // else restores the user's manual rail preference. setNavCollapsed(true) here
  // is transient — it does NOT write localStorage, so the manual toggle's saved
  // preference is preserved and re-applied on exit.
  useEffect(() => {
    if (pathname === "/menu/stock") {
      setNavCollapsed(true);
    } else if (typeof window !== "undefined") {
      setNavCollapsed(localStorage.getItem("iq-nav-collapsed") === "1");
    }
  }, [pathname]);

  // Persist rail scroll position across page navigations
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const saved = sessionStorage.getItem("iq-rail-scroll");
    if (saved) rail.scrollTop = parseInt(saved, 10);
    function onScroll() { sessionStorage.setItem("iq-rail-scroll", String(rail!.scrollTop)); }
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => rail.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); (document.querySelector(".cmd-input") as HTMLInputElement)?.focus(); }
      if (e.key === "Escape") { setSearchOpen(false); setSearchQ(""); setDrawer(null); setCopilotOpen(false); setProfileDropdownOpen(false); setNavOpen(false); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Action context
  const actions: IQActions = {
    openStock: useCallback((sym) => setDrawer({ type: "stock", sym }), []),
    openMoverModal: useCallback((sym) => setDrawer({ type: "mover-modal", sym }), []),
    openStockDetail: useCallback((sym, list) => setDrawer({ type: "stock-detail", sym, list }), []),
    openStockFull: useCallback((sym) => {
      const s = sym.trim().toUpperCase();
      if (!s) return;

      if (typeof window !== "undefined") {
        localStorage.setItem("iq-stock", s);
        window.dispatchEvent(
          new CustomEvent("iq-stock-change", {
            detail: s,
          }),
        );
      }

      router.push("/menu/stock");
    }, [router]),
    openEarnings: useCallback((sym) => setDrawer({ type: "earnings", sym }), []),
    openSector: useCallback((name) => setDrawer({ type: "sector", name }), []),
    openIndex: useCallback((idx) => setDrawer({ type: "index", idx }), []),
    openFearGreed: useCallback(() => setDrawer({ type: "feargreed" }), []),
    openChart: useCallback((title: string, node: ReactNode) => setExpandedChart({ title, node }), []),
    setCopilot: setCopilotOpen,
    theme,
    setTheme,
    font,
    setFont,
  };

  const displayName = profile?.name || user?.displayName || user?.email || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const profileImage = profile?.profile_image || user?.photoURL || null;

  // First-time Google sign-ins arrive with only name/email — flag the profile as
  // incomplete (drives the "Pending" pill on My Profile) until every field is filled.
  const profileIncomplete =
    !profile ||
    (["name", "mobileNumber", "age", "incomeRange", "investmentExperience",
      "investmentGoals", "riskTolerance", "investmentHorizon", "currentPortfolioValue"] as const)
      .some(f => String(profile[f] ?? "").trim() === "") ||
    (profile.preferredAssetClasses?.length ?? 0) === 0;

  async function handleSignOut() {
    await signOut(firebaseAuth);
    window.location.href = "/";
  }

  return (
    <AuthGuard>
      <IQActionsContext.Provider value={actions}>
       <WatchlistsContext.Provider value={wl}>
        <LiveQuotesProvider>
        <div className="iq-root" data-theme={theme} data-font={font}>
          <div className={`app${navCollapsed ? " nav-collapsed" : ""}`}>
            {/* Brand cell */}
            <div className="brandcell">
              <div className="brand-top">
                <BrandLogo height={28} />
                <button
                  className="nav-collapse-btn"
                  onClick={() => setNavCollapsed(c => { const next = !c; localStorage.setItem("iq-nav-collapsed", next ? "1" : "0"); return next; })}
                  aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
                  title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                  {/* Panel-collapse glyph: a framed rail with a chevron showing
                      which way the sidebar will move. */}
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18" />
                    {navCollapsed ? <path d="m14 9 3 3-3 3" /> : <path d="m16 15-3-3 3-3" />}
                  </svg>
                </button>
              </div>
            </div>

            {/* Topbar */}
            <div className="topbar">
              {/* Mobile hamburger — hidden on desktop via CSS */}
              <button className="mob-ham" onClick={() => setNavOpen(o => !o)} aria-label="Open navigation">
                <svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M3 7h18M3 12h18M3 17h18" />
                </svg>
              </button>
              {/* Mobile brand — hidden on desktop via CSS */}
              <div className="mob-brand">
                <BrandLogo height={22} />
              </div>
              <div className="cmd-wrap" ref={cmdRef}>
                <div className={`cmd${searchOpen ? " cmd-active" : ""}`}>
                  <span className="palette-icon">⌕</span>
                  <input
                    className="cmd-input"
                    placeholder="Search tickers and stocks…"
                    value={searchQ}
                    onFocus={() => setSearchOpen(true)}
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onKeyDown={e => {
                      if (e.key === "Escape") { setSearchOpen(false); setSearchQ(""); }
                      if (e.key === "Enter") {
                        // Use the top match, or fall back to the raw typed ticker
                        // (the stock page fetches any symbol on demand), so pressing
                        // Enter always opens the Search page.
                        goToStock(displayMatches[0]?.sym ?? searchQ);
                      }
                    }}
                  />
                  {searchQ && <button className="cmd-clear" onClick={() => { setSearchQ(""); setSearchOpen(false); }}>✕</button>}
                </div>
                {searchOpen && (
                  <div className="cmd-dropdown">
                    {displayMatches.length > 0 && (
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, padding: "6px 12px 2px", fontSize: ".6rem", color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        Tickers <VendorTag v="polygon" />
                      </div>
                    )}
                    {displayMatches.map(m => (
                      <div key={m.sym} className="palette-item"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => goToStock(m.sym)}
                      >
                        <div className="palette-item-icon" style={{ color: "var(--brand-2)", fontWeight: 700, fontFamily: "var(--f-mono)" }}>{m.sym[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <div className="palette-item-label">{m.sym}</div>
                            {m.price != null && (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <span className="mono" style={{ fontSize: ".78rem", color: "var(--text-hi)" }}>{fmt(m.price)}</span>
                                {m.pctChange != null && <span className={`mono ${cls(m.pctChange)}`} style={{ fontSize: ".72rem" }}>{sign(m.pctChange)}</span>}
                              </div>
                            )}
                          </div>
                          <div className="palette-item-sub">{m.name ?? "Stock"} · click to open</div>
                        </div>
                        <button
                          title={searchStarred.has(m.sym) ? "Edit watchlists" : "Add to a watchlist"}
                          onMouseDown={e => e.preventDefault()}
                          onClick={e => { e.stopPropagation(); openSearchStar(m.sym, e); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: searchStarred.has(m.sym) ? "var(--warn)" : "var(--text-dim-solid)", padding: "0 4px" }}>
                          {searchStarred.has(m.sym) ? "★" : "☆"}
                        </button>
                      </div>
                    ))}
                    {searchQ && displayMatches.length === 0 && (
                      <div style={{ padding: "12px 15px", color: "var(--text-dim-solid)", fontSize: "0.8125rem" }}>No results for &ldquo;{searchQ}&rdquo;</div>
                    )}
                  </div>
                )}
              </div>
              {/* Session ET clock — sits immediately to the right of the search box. */}
              <div className="topbar-clock">
                {navTime.day} · <span style={{ color: "var(--text-hi)", fontWeight: 700 }}>{navTime.time} ET</span>
              </div>
              <div className={`statuspill${mkt.phase === "open" ? "" : mkt.phase === "closed" ? " mkt-closed" : " mkt-ext"}`}>
                <div className="dot" />
                {mkt.label}
              </div>
              <button
                className="iconbtn"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  localStorage.setItem("iq-theme", next);
                  setTheme(next);
                  if (user?.uid) {
                    void apiPatch("/api/settings", { darkMode: next === "dark" });
                  }
                }}
              >
                {theme === "dark"
                  ? <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                  : <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>}
              </button>
              <button className={`iconbtn${copilotOpen ? " ai-active" : ""}`} title="AI Copilot"
                onClick={() => setCopilotOpen(o => !o)}>
                ✦
              </button>
              {/* Bell sits immediately left of the profile avatar. */}
              <NotificationBell />
              <div className="profile-dropdown-wrap" ref={profileDropdownRef}>
                <div
                  className="topbar-avatar"
                  title={displayName}
                  onClick={() => setProfileDropdownOpen(o => !o)}
                  style={{ cursor: "pointer" }}
                >
                  {initials}
                  {profileImage && <img src={profileImage} alt={displayName} />}
                </div>

                {profileDropdownOpen && (
                  <div className="profile-dropdown">
                    {/* User info */}
                    <div className="pd-user">
                      <div className="pd-avatar">
                        {initials}
                        {profileImage && <img src={profileImage} alt={displayName} />}
                      </div>
                      <div className="pd-name">{displayName}</div>
                      <div className="pd-email">{user?.email ?? ""}</div>
                    </div>

                    {/* Menu items */}
                    <button className="pd-item" onClick={() => { router.push("/profile/edit"); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">👤</span> My Profile
                      {profileIncomplete && <span className="pd-pending">Pending</span>}
                    </button>
                    <button className="pd-item" onClick={() => { router.push("/settings"); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">⚙</span> Settings
                    </button>
                    <button className="pd-item" onClick={() => { router.push("/manage-plan"); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">◈</span> Manage Account
                    </button>
                    <button className="pd-item" onClick={() => { router.push("/requests"); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">💡</span> Feature Requests
                    </button>
                    <div className="pd-divider" />
                    <button className="pd-item danger" onClick={() => { handleSignOut(); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">↩</span> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Ticker */}
            <div className="ticker">
              <div className="ticker-track">
                {tickerItems.map((x, i) => (
                  <div key={i} className="tk">
                    <span className="lbl">{x.label}</span>
                    <span className="val">{fmt(x.value, x.value > 1000 ? 0 : 2)}</span>
                    <span className={`chg ${cls(x.change)}`}>{arr(x.change)} {Math.abs(x.change).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile nav scrim — inside .app so it shares .app's stacking context with the rail */}
            {navOpen && <div className="mob-nav-scrim" onClick={() => setNavOpen(false)} />}

            {/* Rail / Sidebar */}
            <nav ref={railRef} className={`rail${navOpen ? " mob-open" : ""}`}>
              {/* Mobile rail header — hidden on desktop via CSS */}
              <div className="mob-rail-head">
                <BrandLogo height={22} />
                <button className="mob-nav-close" onClick={() => setNavOpen(false)} aria-label="Close navigation">✕</button>
              </div>
              {NAV_GROUPS.map(group => {
                const items = navItemsByGroup[group];
                // Sections always render expanded — no accordion, nothing to toggle.
                // When the rail is icon-only there is no room for a section header,
                // so it's skipped and every item renders under the icon-only rail.
                return (
                  <div key={group} className="nav-sec open">
                    {!navCollapsed && (
                      <div className="sec-lbl">
                        <span className="sec-name">{group}</span>
                      </div>
                    )}
                    {items.map(item => {
                    const href = slugToHref(item.slug);
                    const isActive = pathname === href;
                    return (
                      <Link
                          key={item.slug}
                          href={href}
                          className={`navitem${isActive ? " active" : ""}`}
                          onClick={() => {
                            if (item.slug === "ai-infrastructure") {
                              window.dispatchEvent(new Event("ai-corner-home"));
                            }
                          }}
                          onMouseEnter={e => {
                            if (!navCollapsed) return;
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setNavTip({ label: item.label, top: r.top + r.height / 2 });
                          }}
                          onMouseLeave={() => setNavTip(null)}
                        >
                        <div className="nicon"><NavIcon slug={item.slug} /></div>
                        <span className="nav-label">{item.label}</span>
                        {item.badge && <span className="nav-tag">{item.badge}</span>}
                      </Link>
                    );
                  })}
                  </div>
                );
              })}

            </nav>

            {/* Rendered outside .rail so overflow-x:hidden cannot clip it. */}
            {navCollapsed && navTip && (
              <div className="nav-tip" style={{ top: navTip.top }}>{navTip.label}</div>
            )}

            {/* Main content */}
            <main className="main">
              {/* <SessionNotice phase={tapeFrame?.marketPhase ?? "unknown"} pathname={pathname} /> */}
              {children}
              <footer className="disclaimer-bar">
                <span className="disclaimer-text">
                  MarketCatalyst LLC is not a registered investment advisor and does not manage client assets. Information and tools on this platform are for informational and educational purposes only and do not constitute investment advice. MarketCatalyst is a data provider, not a stock-picks or alert service. Trading stocks and options carries risk — consult your own financial advisor.
                </span>
                {/* Blogs and FAQs live on the marketing site, which is a
                    separate origin from this app — so these are absolute links
                    that open in a new tab rather than router navigations, and a
                    signed-in reader keeps their session here. */}
                <nav className="disclaimer-links">
                  <a href="https://marketcatalyst.ai/posts" target="_blank" rel="noopener noreferrer">Blogs</a>
                  <a href="https://marketcatalyst.ai/faqs" target="_blank" rel="noopener noreferrer">FAQs</a>
                </nav>
              </footer>
            </main>
          </div>

          {/* Drawers */}
          {drawer?.type === "stock" && (
            <StockDrawer sym={drawer.sym} companies={shellCompanies} sectorsLive={shellSectors} loading={shellCompaniesLoading} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "mover-modal" && (
            <MoverModal key={drawer.sym} sym={drawer.sym} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "stock-detail" && (
            <StockDetailPopover key={drawer.sym} sym={drawer.sym} list={drawer.list}
              onNavigate={(s) => setDrawer({ type: "stock-detail", sym: s, list: drawer.list })}
              onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "earnings" && (
            <EarningsDrawer sym={drawer.sym} liveEarnings={shellEarnings} loading={shellEarningsLoading} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "sector" && (
            <SectorDrawer name={drawer.name} companies={shellCompanies} sectorsLive={shellSectors} loading={shellCompaniesLoading} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "index" && (
            <IndexDrawer idx={drawer.idx} pulse={livePulse} sectorsLive={shellSectors} loading={shellSectorsLoading} phase={tapeFrame?.marketPhase ?? "unknown"} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "feargreed" && (
            <FearGreedDrawer onClose={() => setDrawer(null)} />
          )}


          {/* Copilot panel */}
          {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}

          {/* Chart expand modal */}
          {expandedChart && (
            <div className="chart-modal-overlay" onClick={() => setExpandedChart(null)}>
              <div className="chart-modal" onClick={e => e.stopPropagation()}>
                <div className="chart-modal-head">
                  <h3>{expandedChart.title}</h3>
                  <button className="chart-modal-close" onClick={() => setExpandedChart(null)}>
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3v5H3M21 8h-5V3M16 21v-5h5M3 16h5v5" />
                    </svg>
                  </button>
                </div>
                <div className="chart-modal-body">
                  {expandedChart.node}
                </div>
              </div>
            </div>
          )}

          {wlPicker && (
            <WatchlistPicker
              sym={wlPicker.sym}
              watchlists={wl.watchlists}
              onAdd={id => wl.addTicker(id, wlPicker.sym)}
              onRemove={id => wl.removeTicker(id, wlPicker.sym)}
              onCreate={name => wl.createList(name)}
              onClose={() => setWlPicker(null)}
              anchor={{ x: wlPicker.x, y: wlPicker.y }}
            />
          )}
        </div>
        </LiveQuotesProvider>
       </WatchlistsContext.Provider>
      </IQActionsContext.Provider>
    </AuthGuard>
  );
}
