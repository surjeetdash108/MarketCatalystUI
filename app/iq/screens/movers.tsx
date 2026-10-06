"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fmtDate } from "../calendar-range";
import dynamic from "next/dynamic";
import { type Mover, maPostureLabel, isLeveragedProduct } from "../data";
import { fmt, sign, arr, StockLogo, DataState, VendorTag, titleCaseLabel, cls } from "../utils";
import { apiGet } from "../backend";
import { useApiList } from "../hooks/useApiList";
import { useApiResource } from "../hooks/useApiResource";
import { useLiveQuotes, QUOTE_DELAY_LABEL, pairedQuote, extendedSession } from "../live-quotes-context";
import { useWatchlistsContext } from "../hooks/useWatchlists";
import type { LiveMoverDoc, CompanyDoc, NewsArticleDoc, AnalystConsensusDoc, AnalystRatingChange } from "../types";
import { sectorFilterOptions, matchesSector } from "../sector-filter";
import { MoverNewsModal } from "../mover-news-modal";

const StockScreenEmbed = dynamic<{ initialSym?: string }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

interface ScanItem {
  ticker: string;
  name: string | null;
  pctChange: number | null;
  price?: number | null;
  volume?: number | null;
  rvol?: number | null;
}
interface SectorGroup {
  sector: string;
  items: ScanItem[];
}
interface BiggestPctScan {
  generatedAt: string;
  gainers: SectorGroup[];
  losers: SectorGroup[];
}

interface MostActiveScan {
  generatedAt: string;
  byVolume: SectorGroup[];
  byRelVolume: SectorGroup[];
}

function mergeMostActiveSectors(
  data: MostActiveScan,
  resolveClassification?: (ticker: string) => CanonicalMoverClassification,
): SectorGroup[] {
  const map = new Map<string, Map<string, ScanItem>>();
  const addGroups = (groups: SectorGroup[] = []) => {
    for (const group of groups) {
      for (const item of group.items) {
        const canon = resolveClassification ? resolveClassification(item.ticker) : null;
        const canonSector = (canon?.sector && canon.sector !== "—") ? canon.sector : group.sector;
        if (!map.has(canonSector)) {
          map.set(canonSector, new Map());
        }
        const sectorMap = map.get(canonSector)!;
        const existing = sectorMap.get(item.ticker);
        if (!existing) {
          sectorMap.set(item.ticker, {
            ...item,
            name: canon?.name || item.name,
          });
        } else {
          sectorMap.set(item.ticker, {
            ...existing,
            ...item,
            name: canon?.name || item.name || existing.name,
            rvol: item.rvol ?? existing.rvol ?? null,
            volume: item.volume ?? existing.volume ?? null,
            price: item.price ?? existing.price ?? null,
            pctChange: item.pctChange ?? existing.pctChange ?? null,
          });
        }
      }
    }
  };

  addGroups(data.byVolume);
  addGroups(data.byRelVolume);

  return Array.from(map.entries())
    .map(([sector, items]) => ({
      sector,
      items: Array.from(items.values()),
    }))
    .sort((a, b) => b.items.length - a.items.length);
}

const scanTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const TABS = [
  ["win",      "Top Gainers"],
  ["lose",     "Top Losers"],
  ["active",   "Most Active"],
  ["biggest",  "Biggest %"],
  ["vol",      "Unusual Volume"],
  ["weekwin",  "Weekly Gainers"],
  ["weeklose", "Weekly Losers"],
] as const;
type TabKey = "win" | "lose" | "active" | "biggest" | "vol" | "weekwin" | "weeklose";
/** True for the two 5-day tabs, which rank on weekPct rather than today's move. */
const isWeekTab = (t: TabKey) => t === "weekwin" || t === "weeklose";

function ScanSection({
  title,
  color,
  groups,
  onSelect,
  resolvePriceAndChange,
  resolveRvolAndVolume,
}: {
  title: string;
  color: string;
  groups: SectorGroup[];
  onSelect: (sym: string) => void;
  resolvePriceAndChange: (
    ticker: string,
    fallbackPrice?: number | null,
    fallbackPct?: number | null,
  ) => { price: number | null; change: number | null };
  resolveRvolAndVolume: (
    ticker: string,
    fallbackRvol?: number | null,
    fallbackVolume?: number | null,
  ) => { rvol: number | null; volume: number | null };
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: ".82rem",
          color,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{title}</span>
      </div>

      {(!groups || groups.length === 0) ? (
        <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "14px 0" }}>
          No stocks match the selected filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {groups.map((g) => {
            const items = g.items.map((it) => {
              const { price, change } = resolvePriceAndChange(it.ticker, it.price, it.pctChange);
              const { rvol, volume } = resolveRvolAndVolume(it.ticker, it.rvol, it.volume);
              return {
                ...it,
                price: price ?? it.price,
                pctChange: change ?? it.pctChange,
                rvol,
                volume,
              };
            });
            const up = items.filter(it => (it.pctChange ?? 0) >= 0).length;
            const down = items.length - up;
            const maxAbs = Math.max(...items.map(it => Math.abs(it.pctChange ?? 0)), 1);

            return (
              <div
                key={g.sector}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {/* Sector header */}
                <div
                  style={{
                    padding: "10px 12px 8px",
                    borderBottom: "1px solid var(--border-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--text-hi)" }}>
                    {titleCaseLabel(g.sector)}
                  </span>
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: ".62rem", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--up)" }}>▲ {up}</span>{" "}
                    <span style={{ color: "var(--down)" }}>▼ {down}</span>
                  </span>
                </div>

                {/* Stocks */}
                <div>
                  {items.map((it) => {
                    const pct = it.pctChange ?? 0;
                    const width = Math.min(100, Math.max(4, (Math.abs(pct) / maxAbs) * 100));
                    return (
                      <button
                        key={it.ticker}
                        type="button"
                        onClick={() => onSelect(it.ticker)}
                        style={{
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: "minmax(64px, auto) minmax(46px, auto) 1fr auto",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 11px",
                          border: 0,
                          borderBottom: "1px solid var(--border-soft)",
                          background: "transparent",
                          color: "inherit",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <StockLogo sym={it.ticker} size={20} />
                          <b style={{ fontFamily: "var(--f-mono)", fontSize: ".74rem", color: "var(--text-hi)" }}>
                            {it.ticker}
                          </b>
                        </span>

                        <span
                          style={{
                            justifySelf: "start",
                            fontFamily: "var(--f-mono)",
                            fontSize: ".6rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: it.rvol != null ? "rgba(245,181,68,.14)" : "var(--surface-3)",
                            color: it.rvol != null ? "var(--warn)" : "var(--text-dim-solid)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {it.rvol != null
                            ? `${it.rvol.toFixed(1)}x`
                            : it.volume != null
                              ? `${(it.volume / 1e6).toFixed(1)}M`
                              : "—"}
                        </span>

                        <div style={{ height: 6, display: "flex", justifyContent: pct >= 0 ? "flex-start" : "flex-end", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${width}%`,
                              maxWidth: "100%",
                              height: 6,
                              borderRadius: 2,
                              background: pct >= 0 ? "var(--up)" : "var(--down)",
                              opacity: 0.9,
                            }}
                          />
                        </div>

                        <span
                          className={cls(pct)}
                          style={{
                            fontFamily: "var(--f-mono)",
                            fontSize: ".66rem",
                            fontWeight: 700,
                            padding: "3px 6px",
                            borderRadius: 4,
                            background: pct >= 0 ? "var(--up-dim)" : "var(--down-dim)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sign(pct)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Cap tier from a raw USD market cap — same thresholds the Live Feed uses.
 * Needed because the weekly tabs are built from `companies` (which carry
 * marketCap) rather than the movers feed (which carries a pre-bucketed `cap`).
 */
/* "—" for an unknown cap, not "Mid": a ticker whose market cap has not synced
   is not a mid-cap, and returning one put it in the Market cap filter's Mid
   bucket where a user filtering for mid-caps would be handed micro-caps. */
function capFromMarketCap(mc: number | null | undefined): Mover["cap"] {
  if (mc == null || mc <= 0) return "—";
  if (mc >= 200e9) return "Mega";
  if (mc >= 10e9) return "Large";
  if (mc >= 2e9) return "Mid";
  if (mc >= 300e6) return "Small";
  return "Micro";
}
/** Compact USD market cap for the table cell — "$1.24T" / "$12.5B" / "$340M".
 *  null/≤0 → "—" so an un-synced or out-of-universe ticker reads as unknown. */
function fmtMcap(mc: number | null | undefined): string {
  if (mc == null || mc <= 0) return "—";
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6)  return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${Math.round(mc).toLocaleString()}`;
}
// Largest → smallest. The dropdown only offers tiers that actually have movers
// right now — the day's top movers are almost never mega-caps, so "Mega" would
// otherwise sit there returning nothing; "Micro" (which the feed does produce)
// was missing entirely before.
const CAP_ORDER = ["Mega", "Large", "Mid", "Small", "Micro"];
function uniqueByTicker<T extends { ticker: string }>(rows: T[]): T[] {
  const seen = new Set<string>();

  return rows.filter(row => {
    const ticker = row.ticker?.trim().toUpperCase();

    if (!ticker || seen.has(ticker)) {
      return false;
    }

    seen.add(ticker);
    return true;
  });
}

/** One row of GET /market-data/volume-leaders — pre-ranked on the server. */
interface VolumeLeaderDoc {
  ticker: string;
  volume: number;
  avgVolume: number;
  rvol: number;
  close: number | null;
  changePct: number | null;
}

/** Sortable columns. `cap` orders by the tier's rank (Mega→Micro), not the
 *  label's alphabet, so the sort reads as a real size ordering. */
type MoverSortKey = "company" | "price" | "change" | "rvol" | "mcap" | "cap";
/** Direction a column starts in on first click — text ascends (A→Z), numbers
 *  descend (biggest first), which is what you almost always want. */
const SORT_FIRST_DIR: Record<MoverSortKey, "asc" | "desc"> = {
  company: "asc", price: "desc", change: "desc", rvol: "desc", mcap: "desc", cap: "asc",
};

/**
 * Live-only: a row exists here only if a real `market_movers` doc exists for
 * it. RVOL comes from `companies.rvol` (technical-indicators.job) when
 * synced. MA posture is derived from `companies.aboveSma50/aboveSma200`
 * (technical-indicators.job), "—" until synced. (Catalyst was removed — Polygon
 * has no catalyst feed, so it only ever showed "—".)
 */

interface CanonicalMoverClassification {
  name: string;
  sector: string;
  industry: string | null;
  marketCap: number | null;
  cap: Mover["cap"];
}

function mergeMovers(
  live: LiveMoverDoc[],
  companyByTicker: Map<string, CompanyDoc>,
  volumeLeaderByTicker: Map<string, VolumeLeaderDoc>,
  resolveClassification: (ticker: string) => CanonicalMoverClassification,
): Mover[] {
  return uniqueByTicker(live.filter(l => !isLeveragedProduct(l.name))).map(l => {
    const sym = l.ticker?.trim().toUpperCase();
    const c = companyByTicker.get(sym);
    const vl = volumeLeaderByTicker.get(sym);
    const canon = resolveClassification(l.ticker);
    return {
      ticker: l.ticker,
      name: canon.name,
      price: l.price,
      pctChange: l.pctChange,
      rvolRatio: vl?.rvol ?? l.rvol ?? c?.rvol ?? 0,
      relativeStrength: 0,
      maPosture: maPostureLabel(c?.aboveSma50, c?.aboveSma200),
      owned: false,
      sector: canon.sector,
      industry: canon.industry,
      marketCap: canon.marketCap,
      cap: canon.cap,
      // Real 5-session change from technical-indicators.job; null → "—".
      weekPct: c?.week5ChangePct ?? null,
      weekBase: c?.week5BaseClose ?? null,
      techContext: `Live EOD data as of ${l.asOfDate}.`,
      newsContext: "",
    };
  });
}

export function MoversScreen() {
  const { data: liveMovers, loading: moversLoading, error: moversError } = useApiList<LiveMoverDoc>("/market-data/movers");
  const { data: rvolCompanies, loading: companiesLoading, error: companiesError } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: volumeLeaders, loading: volumeLoading } = useApiResource<{ leaders: VolumeLeaderDoc[] }>(
    "/market-data/volume-leaders",
  );
  const companyByTicker = useMemo(
    () => new Map(rvolCompanies.map(c => [c.ticker?.trim().toUpperCase(), c])),
    [rvolCompanies],
  );
  const liveMoverByTicker = useMemo(
    () => new Map(liveMovers.map(l => [l.ticker?.trim().toUpperCase(), l])),
    [liveMovers],
  );
  const volumeLeaderByTicker = useMemo(
    () => new Map((volumeLeaders?.leaders ?? []).map(l => [l.ticker?.trim().toUpperCase(), l])),
    [volumeLeaders],
  );

  /**
   * CANONICAL CLASSIFICATION RESOLVER:
   * Guarantees that for any ticker T, Top Gainers, Top Losers, Unusual Volume,
   * Weekly Gainers, and Weekly Losers always receive the exact same:
   * - Company Name
   * - Sector (authoritative SEC EDGAR SIC -> TradingView RBICS taxonomy, freshly enriched)
   * - Industry
   * - Market Cap figure
   * - Market Cap classification bucket ('Mega' | 'Large' | 'Mid' | 'Small' | 'Micro' | '—')
   */
  const canonicalClassification = useCallback((ticker: string): CanonicalMoverClassification => {
    const sym = ticker?.trim().toUpperCase();
    const l = liveMoverByTicker.get(sym);
    const c = companyByTicker.get(sym);

    // 1. Company Name: prefer canonical company doc name, fall back to mover doc
    const name = (c?.name && c.name !== sym ? c.name : l?.name) ?? c?.name ?? sym;

    // 2. Market Cap: prefer canonical company market cap, fall back to mover doc
    const marketCap = (c?.marketCap != null && c.marketCap > 0)
      ? c.marketCap
      : (l?.marketCap != null && l.marketCap > 0)
        ? l.marketCap
        : null;

    // 3. Cap tier: strictly derived from marketCap figure using capFromMarketCap thresholds
    const cap: Mover["cap"] = marketCap != null ? capFromMarketCap(marketCap) : ((l?.cap as Mover["cap"] | null) ?? "—");

    // 4. Sector: canonical companies collection primary (SIC -> RBICS), fall back to mover doc
    const sector = (c?.sector && c.sector !== "—")
      ? c.sector
      : (l?.sector && l.sector !== "—")
        ? l.sector
        : "—";

    // 5. Industry: canonical companies collection primary, fall back to mover doc
    const industry = (c?.industry && c.industry !== "—")
      ? c.industry
      : (l?.industry && l.industry !== "—")
        ? l.industry
        : null;

    return { name, sector, industry, marketCap, cap };
  }, [liveMoverByTicker, companyByTicker]);

  const movers = useMemo(
    () => mergeMovers(liveMovers, companyByTicker, volumeLeaderByTicker, canonicalClassification),
    [liveMovers, companyByTicker, volumeLeaderByTicker, canonicalClassification],
  );

  /** One `companies` doc as a board row. Shared by every tab built from the
   *  tracked universe rather than the daily movers feed. */
  const companyRow = useCallback((c: CompanyDoc): Mover => {
    const sym = c.ticker?.trim().toUpperCase();
    const canon = canonicalClassification(c.ticker);
    const lm = liveMoverByTicker.get(sym);
    const vl = volumeLeaderByTicker.get(sym);
    return {
      ticker: c.ticker,
      name: canon.name,
      price: lm?.price ?? c.price ?? 0,
      pctChange: lm?.pctChange ?? c.pctChange ?? 0,
      rvolRatio: vl?.rvol ?? lm?.rvol ?? c.rvol ?? 0,
      relativeStrength: 0,
      maPosture: maPostureLabel(c.aboveSma50, c.aboveSma200),
      owned: false,
      sector: canon.sector,
      industry: canon.industry,
      cap: canon.cap,
      marketCap: canon.marketCap,
      weekPct: c.week5ChangePct ?? c.pctChange ?? null,
      weekBase: c.week5BaseClose ?? null,
      techContext: "",
      newsContext: "",
    };
  }, [canonicalClassification, liveMoverByTicker, volumeLeaderByTicker]);

  // Leveraged/inverse products are excluded from every universe-built tab for
  // the same reason mergeMovers excludes them from the daily feed: a 2x ETF's
  // move is a multiple of something else's.
  const universeRows = useMemo(
    () => uniqueByTicker(
      rvolCompanies.filter(
        c => c.ticker && !isLeveragedProduct(canonicalClassification(c.ticker).name),
      )
    ),
    [rvolCompanies, canonicalClassification],
  );

  /**
   * 5-day rows, from the COMPANIES universe rather than the daily movers feed.
   * That feed is the day's top-100 gainers/losers — overwhelmingly micro-caps
   * outside the tracked universe — so only ~46 of its 200 rows carry
   * `week5ChangePct` at all, which made the weekly board look broken.
   */
  const weeklyRows: Mover[] = useMemo(
    () => universeRows
      .filter(c => typeof c.week5ChangePct === "number" || typeof c.pctChange === "number")
      .map(companyRow),
    [universeRows, companyRow],
  );

  /**
   * UNUSUAL VOLUME — the whole US market, ranked on the server.
   *
   * It used to rank RVOL inside the daily movers feed: the top 100 gainers and
   * 100 losers, chosen by PRICE. Unusual volume is a volume event and its
   * clearest cases are heavy trading on a FLAT price, which that feed never
   * contains — 17 of the 20 highest-RVOL names could not appear at all, and a
   * 30-name cross-check against Yahoo Finance and MarketChameleon matched 2.
   *
   * The server now ranks ~12,600 listed symbols and publishes only the leaders,
   * so this reads one small document instead of sorting the universe in the
   * browser. Falls back to the tracked-universe ranking (~900 names) until the
   * volume-leaders job has run, so the tab is never empty.
   */
  const volumeRows: Mover[] = useMemo(() => {
    const served = volumeLeaders?.leaders ?? [];
    if (served.length > 0) {
      return uniqueByTicker(
        served.filter(
          l => !isLeveragedProduct(canonicalClassification(l.ticker).name)
        )
      ).map(l => {
          const sym = l.ticker?.trim().toUpperCase();
          const c = companyByTicker.get(sym);
          const lm = liveMoverByTicker.get(sym);
          const baseRow = companyRow(c ?? ({ ticker: l.ticker } as CompanyDoc));
          return {
            ...baseRow,
            // The served row is the authority for the volume numbers; the
            // companies doc only supplies name/sector/cap where we track it.
            price: lm?.price ?? l.close ?? c?.price ?? 0,
            pctChange: lm?.pctChange ?? l.changePct ?? c?.pctChange ?? 0,
            rvolRatio: l.rvol ?? lm?.rvol ?? c?.rvol ?? 0,
          };
        });
    }
    return universeRows
      .filter(c => typeof c.rvol === "number" && (c.rvol as number) > 0)
      .map(companyRow);
  }, [volumeLeaders, universeRows, companyByTicker, liveMoverByTicker, canonicalClassification, companyRow]);


  const [tab,          setTab]          = useState<TabKey>("win");
  /** The row set the active tab draws from — declared AFTER `tab` so it can
   *  read it (a `const` referenced above its declaration is a TDZ crash). */
  const [sector,       setSector]       = useState("All");
  const [cap,          setCap]          = useState("All");
  const [query,        setQuery]        = useState("");

  const { data: biggestPctData, loading: biggestLoading } = useApiResource<BiggestPctScan>(
    tab === "biggest" ? "/live/scan/biggest-pct" : null,
  );

  const filteredBiggest = useMemo(() => {
    if (!biggestPctData) return null;
    const qFilter = query.trim().toUpperCase();

    const filterGroups = (groups: SectorGroup[]) => {
      const bySector = new Map<string, ScanItem[]>();
      for (const g of groups) {
        for (const it of g.items) {
          const canon = canonicalClassification(it.ticker);
          const targetSector = (canon.sector && canon.sector !== "—") ? canon.sector : g.sector;
          if (!matchesSector(sector, it.ticker, targetSector)) continue;
          const name = (canon.name && canon.name !== it.ticker ? canon.name : it.name) ?? it.name;
          if (qFilter && !it.ticker.toUpperCase().includes(qFilter) && !(name && name.toUpperCase().includes(qFilter))) {
            continue;
          }
          if (!bySector.has(targetSector)) bySector.set(targetSector, []);
          bySector.get(targetSector)!.push({
            ...it,
            name,
          });
        }
      }
      return Array.from(bySector.entries())
        .map(([sec, items]) => ({ sector: sec, items }))
        .filter(g => g.items.length > 0);
    };

    return {
      generatedAt: biggestPctData.generatedAt,
      gainers: filterGroups(biggestPctData.gainers || []),
      losers: filterGroups(biggestPctData.losers || []),
    };
  }, [biggestPctData, sector, query, canonicalClassification]);

  const biggestCount = useMemo(() => {
    if (!filteredBiggest) return 0;
    return (filteredBiggest.gainers?.reduce((n, g) => n + g.items.length, 0) ?? 0) +
           (filteredBiggest.losers?.reduce((n, g) => n + g.items.length, 0) ?? 0);
  }, [filteredBiggest]);

  const { data: mostActiveData, loading: mostActiveLoading } = useApiResource<MostActiveScan>(
    tab === "active" ? "/live/scan/most-active" : null,
  );

  const filteredMostActive = useMemo(() => {
    if (!mostActiveData) return null;
    const qFilter = query.trim().toUpperCase();

    const filterGroups = (groups: SectorGroup[]) => {
      return groups
        .map(g => ({
          ...g,
          items: g.items.filter(it => {
            const canon = canonicalClassification(it.ticker);
            const targetSector = (canon.sector && canon.sector !== "—") ? canon.sector : g.sector;
            if (!matchesSector(sector, it.ticker, targetSector)) return false;
            const name = (canon.name && canon.name !== it.ticker ? canon.name : it.name) ?? it.name;
            if (qFilter && !it.ticker.toUpperCase().includes(qFilter) && !(name && name.toUpperCase().includes(qFilter))) {
              return false;
            }
            return true;
          }).map(it => {
            const canon = canonicalClassification(it.ticker);
            return {
              ...it,
              name: (canon.name && canon.name !== it.ticker ? canon.name : it.name) ?? it.name,
            };
          }),
        }))
        .filter(g => g.items.length > 0);
    };

    return {
      generatedAt: mostActiveData.generatedAt,
      byVolume: filterGroups(mostActiveData.byVolume || []),
      byRelVolume: filterGroups(mostActiveData.byRelVolume || []),
    };
  }, [mostActiveData, sector, query, canonicalClassification]);

  const activeSectors = useMemo(() => {
    if (!filteredMostActive) return [];
    return mergeMostActiveSectors(filteredMostActive, canonicalClassification);
  }, [filteredMostActive, canonicalClassification]);

  const activeCount = useMemo(() => {
    return activeSectors.reduce((sum, s) => sum + s.items.length, 0);
  }, [activeSectors]);

  const activeAllItems = useMemo(() => activeSectors.flatMap(s => s.items), [activeSectors]);

  // Column sort. null = the tab's own ranking (gainers by %chg desc, losers by
  // %chg asc, unusual-volume by RVOL desc). Clicking a header overrides it.
  const [sortKey,      setSortKey]      = useState<MoverSortKey | null>(null);
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("desc");
  const [selectedSym,  setSelectedSym]  = useState<string | null>(null);
  const [newsModalSym, setNewsModalSym] = useState<{
    ticker: string;
    name?: string;
    price?: number | null;
    pctChange?: number | null;
    direction?: string;
  } | null>(null);

  // Pressing Escape closes the open stock drawer or news modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (newsModalSym) {
          setNewsModalSym(null);
        } else if (selectedSym) {
          setSelectedSym(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSym, newsModalSym]);

  const sourceRows =
    isWeekTab(tab) ? weeklyRows
    : tab === "vol" ? volumeRows
    : movers;
  const liveCount = sourceRows.length;
  const q = query.trim().toUpperCase();

  // Watchlist: the drawer header's "Add to watchlist" button. A ticker is
  // "watched" if it's in ANY of the user's lists; adding drops it into the first
  // list (creating a default one if the user has none). A small toast confirms
  // the action WITHOUT closing the drawer.
  const { watchlists, addTicker, createList } = useWatchlistsContext();
  const watchedSet = useMemo(() => new Set(watchlists.flatMap(w => w.tickers)), [watchlists]);
  const [toast, setToast] = useState<string | null>(null);
  // "error" styles the toast as a failure (e.g. the watchlist is full).
  const [toastKind, setToastKind] = useState<"ok" | "error">("ok");
  // Tickers added from this screen in this visit. Their button reads "Added to
  // your watchlist"; only tickers that were ALREADY saved read "Already in your
  // watchlist" — the wording QA asked for (row 315), instead of no hover text.
  const [justAdded, setJustAdded] = useState<Set<string>>(() => new Set());
  // Ticker whose save is in flight: the shared hook marks it watched straight
  // away (optimistic), so without this the button claimed "In watchlist" before
  // the server answered — and flipped back if the add was refused.
  const [adding, setAdding] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    // Failures carry a longer explanation, so they stay up a little longer.
    const t = setTimeout(() => setToast(null), toastKind === "error" ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [toast, toastKind]);
  const addToWatchlist = useCallback(async (sym: string) => {
    const s = sym.toUpperCase();
    if (watchedSet.has(s)) { setToastKind("ok"); setToast(`${s} is already in your watchlist`); return; }
    let listId: string | undefined = watchlists[0]?.id;
    if (!listId) listId = (await createList("My Watchlist"))?.id;
    if (!listId) { setToastKind("error"); setToast("Couldn't add — please sign in first"); return; }
    // Only confirm once the server has actually saved it.
    setAdding(s);
    const res = await addTicker(listId, s).finally(() => setAdding(null));
    if (res.ok) { setJustAdded(prev => new Set(prev).add(s)); setToastKind("ok"); setToast(`${s} added to watchlist`); }
    else { setToastKind("error"); setToast(res.message); }
  }, [watchedSet, watchlists, addTicker, createList]);

  const allSectorsSource = useMemo(
    () => [...movers, ...weeklyRows, ...volumeRows, ...rvolCompanies],
    [movers, weeklyRows, volumeRows, rvolCompanies],
  );
  const sectors = useMemo(
    () => sectorFilterOptions(allSectorsSource),
    [allSectorsSource],
  );

  // Only the cap tiers present in the current feed are selectable; if the chosen
  // tier is no longer present (data refreshed), behave as "All".
  const availableCaps = ["All", ...CAP_ORDER.filter(c => sourceRows.some(m => m.cap === c))];
  const effCap = availableCaps.includes(cap) ? cap : "All";

  // Rows matching the current tab + cap, before the sector filter is applied.
  const tabCapRows = sourceRows.filter(m => {
    if (effCap !== "All" && m.cap !== effCap) return false;
    if (tab === "win")  return m.pctChange > 0;
    if (tab === "lose") return m.pctChange < 0;
    // Weekly tabs split on the 5-day move. `weekPct` is guaranteed non-null on
    // weeklyRows (they're filtered on it), but the guard keeps this honest if
    // the source ever changes.
    if (tab === "weekwin")  return (m.weekPct ?? 0) > 0;
    if (tab === "weeklose") return (m.weekPct ?? 0) < 0;
    return true;
  });

  // Sector + free-text filtering, left unsorted — the ranking pass below
  // needs live quotes for exactly this set of tickers, so the quote poll and
  // `shownValues` are wired up against this list before sorting happens.
  const searched = tabCapRows
    .filter(m => matchesSector(sector, m.ticker, m.sector))
    .filter(m => {
      if (!q) return true;
      // Free-text search across EVERY displayed field — ticker, company name,
      // sector, cap tier and MA posture, plus the numeric columns as text
      // (price, %change, RVOL, 5-day %) — so a user can filter by any of them
      // (e.g. "financial", "large", "169", "+5"). Fields are joined with a
      // separator so a query can't span two adjacent fields.
      const hay = [
        m.ticker,
        m.name,
        m.sector,
        m.cap,
        m.maPosture,
        m.price != null ? String(m.price) : "",
        String(m.pctChange),
        m.rvolRatio ? String(m.rvolRatio) : "",
        m.marketCap != null ? fmtMcap(m.marketCap) : "",
        m.weekPct != null ? String(m.weekPct) : "",
      ].join(" | ").toUpperCase();
      return hay.includes(q);
    });

  // Live price/%-overlay so the table matches the stock drawer (same
  // universal-snapshot quote). Fetched for ALL shown rows — the list is small
  // (top gainers/losers/unusual-volume) and useLiveQuotes is a shared union poll
  // that chunks at 250, so no pagination cap is needed. Polls every 30s.
  // In addition, include tickers from activeAllItems and filteredBiggest so all sections
  // in Movers share the exact same live quotes.
  const shownTickers = useMemo(() => {
    const set = new Set<string>();
    for (const m of searched) {
      if (m.ticker) set.add(m.ticker.trim().toUpperCase());
    }
    if (tab === "active") {
      for (const it of activeAllItems) {
        if (it.ticker) set.add(it.ticker.trim().toUpperCase());
      }
    } else if (tab === "biggest" && filteredBiggest) {
      for (const g of filteredBiggest.gainers ?? []) {
        for (const it of g.items) {
          if (it.ticker) set.add(it.ticker.trim().toUpperCase());
        }
      }
      for (const g of filteredBiggest.losers ?? []) {
        for (const it of g.items) {
          if (it.ticker) set.add(it.ticker.trim().toUpperCase());
        }
      }
    }
    for (const m of liveMovers) {
      if (m.ticker) set.add(m.ticker.trim().toUpperCase());
    }
    return Array.from(set);
  }, [searched, tab, activeAllItems, filteredBiggest, liveMovers]);

  // Shared app-wide poll: one timer + one request for every live surface, so a
  // ticker here always matches the same ticker on the heatmap/drawer exactly.
  const quoteByTicker = useLiveQuotes(shownTickers);

  /**
   * CANONICAL RVOL AND VOLUME RESOLVER:
   * Guarantees that whether a ticker is shown in Top Gainers, Unusual Volume,
   * Most Active, or Biggest %, its RVOL and volume figures are identical.
   */
  const resolveRvolAndVolume = useCallback((
    ticker: string,
    fallbackRvol?: number | null,
    fallbackVolume?: number | null,
  ): { rvol: number | null; volume: number | null } => {
    const sym = ticker?.trim().toUpperCase();
    const vl = volumeLeaderByTicker.get(sym);
    const lm = liveMoverByTicker.get(sym);
    const c = companyByTicker.get(sym);

    const rvol = vl?.rvol ?? lm?.rvol ?? c?.rvol ?? fallbackRvol ?? null;
    const volume = vl?.volume ?? fallbackVolume ?? null;

    return { rvol, volume };
  }, [volumeLeaderByTicker, liveMoverByTicker, companyByTicker]);

  /**
   * CANONICAL PRICE AND % CHANGE RESOLVER:
   * Guarantees that whether a ticker is shown in Top Gainers, Top Losers,
   * Most Active, Biggest %, Unusual Volume, or Weekly Movers, its displayed
   * price and percent change are completely identical and sourced from the
   * authoritative live quote / paired snapshot.
   */
  const resolvePriceAndChange = useCallback((
    ticker: string,
    fallbackPrice?: number | null,
    fallbackPct?: number | null,
    weekBase?: number | null,
    weekPct?: number | null,
  ): { price: number | null; change: number | null } => {
    const sym = ticker?.trim().toUpperCase();
    const q = quoteByTicker.get(sym);
    const lm = liveMoverByTicker.get(sym);
    const c = companyByTicker.get(sym);
    const vl = volumeLeaderByTicker.get(sym);

    const extOnly = extendedSession(q) !== null;

    const baselinePair = pairedQuote(
      lm ? { price: lm.price, pctChange: lm.pctChange } : null,
      fallbackPrice != null && fallbackPct != null ? { price: fallbackPrice, pctChange: fallbackPct } : null,
      vl ? { price: vl.close, pctChange: vl.changePct } : null,
      c ? { price: c.price, pctChange: c.pctChange } : null,
      { price: fallbackPrice ?? null, pctChange: fallbackPct ?? null },
    );

    const pq = extOnly ? baselinePair : pairedQuote(q, baselinePair);

    const change = isWeekTab(tab)
      ? (pq.price != null && weekBase != null && weekBase > 0
          ? ((pq.price - weekBase) / weekBase) * 100
          : (weekPct ?? pq.pctChange))
      : pq.pctChange;

    return { price: pq.price, change };
  }, [quoteByTicker, liveMoverByTicker, companyByTicker, volumeLeaderByTicker, tab]);

  /**
   * Most Active items mapped through canonical resolvers so summary cards and
   * sector cards agree perfectly with each other and with Top Gainers / Losers.
   */
  const resolvedActiveItems = useMemo(() => {
    return activeAllItems.map(it => {
      const { price, change } = resolvePriceAndChange(it.ticker, it.price, it.pctChange);
      const { rvol, volume } = resolveRvolAndVolume(it.ticker, it.rvol, it.volume);
      const canon = canonicalClassification(it.ticker);
      return {
        ...it,
        name: (canon.name && canon.name !== it.ticker ? canon.name : it.name) ?? it.name,
        price: price ?? it.price,
        pctChange: change ?? it.pctChange,
        rvol,
        volume,
      };
    });
  }, [activeAllItems, resolvePriceAndChange, resolveRvolAndVolume, canonicalClassification]);

  const activeGainers = useMemo(() => resolvedActiveItems
    .filter(it => (it.pctChange ?? 0) > 0)
    .sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0)), [resolvedActiveItems]);

  const activeLosers = useMemo(() => resolvedActiveItems
    .filter(it => (it.pctChange ?? 0) < 0)
    .sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0)), [resolvedActiveItems]);

  const activeHeaviestVolume = useMemo(() => [...resolvedActiveItems]
    .filter(it => it.volume != null)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0], [resolvedActiveItems]);

  const activeTotalVolume = useMemo(() => resolvedActiveItems.reduce(
    (sum, it) => sum + (it.volume ?? 0),
    0
  ), [resolvedActiveItems]);

  const activeRvolItems = useMemo(() => resolvedActiveItems.filter(it => it.rvol != null), [resolvedActiveItems]);

  const activeAvgRvol = useMemo(() =>
    activeRvolItems.length > 0
      ? activeRvolItems.reduce(
          (sum, it) => sum + (it.rvol ?? 0),
          0
        ) / activeRvolItems.length
      : 0, [activeRvolItems]);

  const activeUpCount = useMemo(() => resolvedActiveItems.filter(
    it => (it.pctChange ?? 0) > 0
  ).length, [resolvedActiveItems]);

  const activeDownCount = useMemo(() => resolvedActiveItems.filter(
    it => (it.pctChange ?? 0) < 0
  ).length, [resolvedActiveItems]);

  /**
   * The Price and Change this row will actually SHOW.
   *
   * One function, used by the render and by the tab guard below, so what a row
   * displays and what decides it belongs cannot come apart.
   */
  const shownValues = useCallback((m: Mover): { price: number | null; change: number | null } => {
    return resolvePriceAndChange(m.ticker, m.price, m.pctChange, m.weekBase, m.weekPct);
  }, [resolvePriceAndChange]);

  /**
   * The marker that qualifies a Change value with the session it happened in —
   * "PM" pre-market, "AH" after hours, "EXT" when the vendor's session state
   * cannot say which. null during regular hours, where the figure is a plain
   * day move and needs nothing.
   */
  const sessionTag = useCallback((m: Mover) => {
    const q = quoteByTicker.get(m.ticker);
    const ext = extendedSession(q);
    if (!ext) return null;
    const short = ext === "pre-market" ? "PM" : ext === "after hours" ? "AH" : "EXT";
    /* The cell shows the completed session (see shownValues); this reports the
       extended-hours print that is trading now, so the live number is still
       available without displacing the one the row is ranked by. */
    const live = q?.price != null ? `$${q.price.toFixed(2)}` : null;
    return (
      <span
        className="mv-sess"
        title={
          `Price and change are the last completed session's.` +
          (live ? ` Trading ${ext} now at ${live}.` : ` There is ${ext} trading in this name.`)
        }
      >{short}</span>
    );
  }, [quoteByTicker]);

  const filtered = [...searched].sort((a, b) => {
    // Explicit column sort wins over the tab's default ranking.
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "company":
          return a.ticker.localeCompare(b.ticker) * dir;
        case "price": {
          // Sort on the number actually displayed — the live-quote overlay
          // from shownValues, not the stale stored close — so clicking the
          // header visibly reorders the rows on screen.
          const pa = shownValues(a).price ?? a.price ?? 0;
          const pb = shownValues(b).price ?? b.price ?? 0;
          return (pa - pb) * dir;
        }
        case "change": {
          // Same reasoning as "price": shownValues already picks the right
          // number for the active tab (live %, or the live-remeasured 5-day
          // move on weekly tabs), so sort on that instead of the stored field.
          const ca = shownValues(a).change ?? (isWeekTab(tab) ? (a.weekPct ?? 0) : a.pctChange);
          const cb = shownValues(b).change ?? (isWeekTab(tab) ? (b.weekPct ?? 0) : b.pctChange);
          return (ca - cb) * dir;
        }
        case "rvol":
          return ((a.rvolRatio ?? 0) - (b.rvolRatio ?? 0)) * dir;
        case "mcap": {
          // Unknown caps (null) always sort LAST, in either direction — like
          // the `cap` column — so the "—" rows never lead an ascending sort.
          if (a.marketCap == null && b.marketCap == null) return 0;
          if (a.marketCap == null) return 1;
          if (b.marketCap == null) return -1;
          return (a.marketCap - b.marketCap) * dir;
        }
        case "cap": {
          // Unknown tiers sort last in either direction rather than jumping
          // to the top as index -1.
          const rank = (c: string | null) => {
            const i = CAP_ORDER.indexOf(c ?? "");
            return i === -1 ? CAP_ORDER.length : i;
          };
          const d = rank(a.cap) - rank(b.cap);
          return (d !== 0 ? d : (a.sector ?? "").localeCompare(b.sector ?? "")) * dir;
        }
      }
    }
    if (tab === "win")  return b.pctChange    - a.pctChange;
    if (tab === "lose") return a.pctChange    - b.pctChange;
    if (tab === "weekwin")  return (b.weekPct ?? 0) - (a.weekPct ?? 0);
    if (tab === "weeklose") return (a.weekPct ?? 0) - (b.weekPct ?? 0);
    return b.rvolRatio - a.rvolRatio; // "vol"
  });

  /**
   * A row whose LIVE number contradicts the tab it is sitting in.
   *
   * Membership is decided on the movers feed's stored move, which is as of the
   * last sync; the number rendered is the live one. A stock that was down at the
   * sync and has since turned up therefore stayed under "Top Losers" showing a
   * green +24.25% — the tab and the figure disagreeing about the same stock.
   *
   * Applied here rather than in the tab filter on purpose. `shownTickers` is
   * derived from `searched`, so a row dropped here KEEPS its subscription and
   * its quote keeps updating; it reappears the moment it turns negative again.
   * Folding this into `filtered` would unsubscribe the row, strand it on its
   * stored value, and flip it straight back into the list.
   */
  const visible = uniqueByTicker(
    filtered.filter(m => {
      const { change } = shownValues(m);

      if (change == null) return true;

      if (tab === "win" || tab === "weekwin") return change > 0;
      if (tab === "lose" || tab === "weeklose") return change < 0;

      return true;
    })
  );

  /**
   * Direction that would exactly reproduce the ACTIVE tab's own default
   * ranking for this column — Top Gainers/Weekly Gainers already sort by
   * Change descending, Unusual Volume already sorts by RVOL descending.
   * Starting a first click in that same direction produced a sort identical
   * to what was already on screen, so the click looked like it did nothing.
   */
  const tabDefaultDir = (k: MoverSortKey): "asc" | "desc" | null => {
    if (k === "change") {
      if (tab === "win" || tab === "weekwin") return "desc";
      if (tab === "lose" || tab === "weeklose") return "asc";
    }
    if (k === "rvol" && tab === "vol") return "desc";
    return null;
  };

  /** Click a column: first click applies that column's natural direction (or
   *  its opposite, when the natural direction would just reproduce the tab's
   *  own default ranking), further clicks toggle, and a third state returns
   *  to the tab's own ranking. `firstDir` is recomputed from the ACTIVE tab
   *  on every call (not just the first) so the 3-click cycle keeps anchoring
   *  on the same direction it actually started from. */
  const toggleSort = (k: MoverSortKey) => {
    const natural = SORT_FIRST_DIR[k];
    const firstDir = natural === tabDefaultDir(k) ? (natural === "asc" ? "desc" : "asc") : natural;
    if (sortKey !== k) { setSortKey(k); setSortDir(firstDir); return; }
    if (sortDir === firstDir) { setSortDir(sortDir === "asc" ? "desc" : "asc"); return; }
    setSortKey(null); // back to the default ranking
  };
  /** Sortable header cell. A plain render helper (not a nested component) so
   *  React doesn't remount the header on every parent render. `align` keeps
   *  the "num" class for its monospace font, but the header and its data
   *  cell are both centered via inline style — overriding the shared
   *  `.tbl th/td.num` right-align rather than changing that class, since
   *  insider.tsx and recap.tsx also use it and stay right-aligned. */
  const sortTh = (k: MoverSortKey, label: string, align?: boolean | "center") => (
    <th
      key={k}
      className={align === "center" ? "center" : align ? "num" : undefined}
      onClick={() => toggleSort(k)}
      title={`Sort by ${label}`}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", textAlign: align === true ? "center" : undefined }}
    >
      {label}
      {/* Matches the sortable header in insider.tsx: always a FILLED glyph in
          brand violet, dimmed when inactive. The hollow "▽" this used to show
          when unsorted was near-invisible — an outline glyph, in grey, at 0.35
          opacity — and being a different character from ▲/▼ it also nudged the
          header width on every toggle. `.82em` tracks the th's own font-size
          rather than fixing a larger absolute size. */}
      <span
        style={{
          color: "var(--brand-2)",
          fontSize: ".82em",
          marginLeft: 4,
          opacity: sortKey === k ? 1 : 0.45,
        }}
      >
        {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
      </span>
    </th>
  );

  return (
    <>
      <div className="page-head">
        <div className="tabs" >
          {TABS.map(([k, l]) => (
            <button key={k} className={`tab${k === tab ? " on" : ""}`} onClick={() => setTab(k as TabKey)}>{l}</button>
          ))}
        </div>
        {/* The caption has to describe the tab you are ON.
            It was hard-coded to the daily movers feed — "top 100 gainers + 100
            losers · ranked by session move" — and shown on every tab, including
            Unusual Volume and the two weekly ones, which draw from the tracked
            universe and rank by RVOL or by the 5-day move. It was stating the
            wrong source AND the wrong ranking on three tabs out of five. */}
        {((tab === "biggest" ? biggestCount : tab === "active" ? activeCount : liveCount) > 0) && (
          <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
            {tab === "biggest"
              ? `${biggestCount} names · top 20 gainers + top 20 losers by sector · ${QUOTE_DELAY_LABEL}`
              : tab === "active"
              ? `${activeCount} names · top volume + top relative volume by sector · ${QUOTE_DELAY_LABEL}`
              : `${liveCount} names · ${
                  isWeekTab(tab) ? "tracked universe · ranked by 5-day move"
                  : tab === "vol" ? "tracked universe · ranked by relative volume"
                  : "top 100 gainers + 100 losers · ranked by session move"
                } · ${QUOTE_DELAY_LABEL}`}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="fbar" style={{padding:"10px 24px"}}>
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center" }}>Sector</span>
        <select className="mv-sel" value={sector} onChange={e => setSector(e.target.value)}>
          {sectors.map(s => <option key={s} value={s}>{titleCaseLabel(s)}</option>)}
        </select>
        {tab !== "biggest" && tab !== "active" && (
          <>
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center", marginLeft: 10 }}>Market cap</span>
            <select className="mv-sel" value={effCap} onChange={e => setCap(e.target.value)}>
              {availableCaps.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        <input
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          placeholder="Search…"
          style={{ marginLeft: 10, width: 230, boxSizing: "border-box", background: "var(--surface-3)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "5px 9px", fontSize: ".74rem", color: "var(--text-hi)", outline: "none", fontFamily: "var(--f-mono)", textAlign: "left" }}
        />
        <div className="spacer" />
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
          {tab === "biggest" ? `${biggestCount} stocks` : tab === "active" ? `${activeCount} stocks` : `${visible.length} stocks`}
        </span>
      </div>

      {tab === "active" ? (
        <div style={{ marginLeft: 16, marginRight: 20, marginTop: 16 }}>
          <div className="card">
            <div className="card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700, color: "var(--text-hi)" }}>
                  Today&apos;s Most Active Stocks by Sector
                </h3>
                <VendorTag v="polygon" />
              </div>
              {filteredMostActive?.generatedAt && (
                <span style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                  as of {scanTime(filteredMostActive.generatedAt)}
                </span>
              )}
            </div>
            <div className="card-b" style={{ maxHeight: "none", padding: "16px 18px" }}>
              {!filteredMostActive ? (
                <DataState loading={mostActiveLoading} label="Generating scan…" />
              ) : activeSectors.length === 0 ? (
                <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "14px 0" }}>
                  No stocks match the selected filters.
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                    {/* UP / DOWN */}
                    <div className="card" style={{ padding: 14 }}>
                      <div style={{ fontSize: ".6rem", fontWeight: 700, color: "var(--text-dim-solid)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                        Up / Down
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontFamily: "var(--f-mono)", fontSize: "1rem", fontWeight: 700 }}>
                        <span style={{ color: "var(--up)" }}>▲ {activeUpCount}</span>
                        <span style={{ color: "var(--down)" }}>▼ {activeDownCount}</span>
                      </div>
                      <div style={{ display: "flex", height: 5, marginTop: 8, borderRadius: 4, overflow: "hidden", background: "var(--down)" }}>
                        <div style={{ width: `${activeAllItems.length ? (activeUpCount / activeAllItems.length) * 100 : 0}%`, background: "var(--up)" }} />
                      </div>
                    </div>

                    {/* BIGGEST GAINER */}
                    <div className="card" style={{ padding: 14 }}>
                      <div style={{ fontSize: ".6rem", fontWeight: 700, color: "var(--text-dim-solid)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                        Biggest Gainer
                      </div>
                      <div style={{ marginTop: 7, display: "flex", alignItems: "baseline", gap: 6 }}>
                        <b style={{ fontFamily: "var(--f-mono)", fontSize: "1rem", color: "var(--text-hi)" }}>
                          {activeGainers[0]?.ticker ?? "—"}
                        </b>
                        {activeGainers[0] && (
                          <span className="up" style={{ fontFamily: "var(--f-mono)", fontWeight: 700 }}>
                            {sign(activeGainers[0].pctChange ?? 0)}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 5, fontSize: ".68rem", color: "var(--text-dim-solid)" }}>
                        {activeGainers[0]?.ticker
                          ? (() => {
                              const canonSec = canonicalClassification(activeGainers[0].ticker).sector;
                              const sec = activeSectors.find(s => s.items.some(i => i.ticker === activeGainers[0]?.ticker))?.sector;
                              const finalSec = canonSec && canonSec !== "—" ? canonSec : sec;
                              return finalSec ? titleCaseLabel(finalSec) : "—";
                            })()
                          : "—"}
                      </div>
                    </div>

                    {/* BIGGEST LOSER */}
                    <div className="card" style={{ padding: 14 }}>
                      <div style={{ fontSize: ".6rem", fontWeight: 700, color: "var(--text-dim-solid)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                        Biggest Loser
                      </div>
                      <div style={{ marginTop: 7, display: "flex", alignItems: "baseline", gap: 6 }}>
                        <b style={{ fontFamily: "var(--f-mono)", fontSize: "1rem", color: "var(--text-hi)" }}>
                          {activeLosers[0]?.ticker ?? "—"}
                        </b>
                        {activeLosers[0] && (
                          <span className="down" style={{ fontFamily: "var(--f-mono)", fontWeight: 700 }}>
                            {sign(activeLosers[0].pctChange ?? 0)}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 5, fontSize: ".68rem", color: "var(--text-dim-solid)" }}>
                        {activeLosers[0]?.ticker
                          ? (() => {
                              const canonSec = canonicalClassification(activeLosers[0].ticker).sector;
                              const sec = activeSectors.find(s => s.items.some(i => i.ticker === activeLosers[0]?.ticker))?.sector;
                              const finalSec = canonSec && canonSec !== "—" ? canonSec : sec;
                              return finalSec ? titleCaseLabel(finalSec) : "—";
                            })()
                          : "—"}
                      </div>
                    </div>

                    {/* HEAVIEST VOLUME */}
                    <div className="card" style={{ padding: 14 }}>
                      <div style={{ fontSize: ".6rem", fontWeight: 700, color: "var(--text-dim-solid)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                        Heaviest Volume
                      </div>
                      <div style={{ marginTop: 7, display: "flex", alignItems: "baseline", gap: 7 }}>
                        <b style={{ fontFamily: "var(--f-mono)", fontSize: "1rem", color: "var(--text-hi)" }}>
                          {activeHeaviestVolume?.ticker ?? "—"}
                        </b>
                        {activeHeaviestVolume?.volume != null && (
                          <span style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: ".78rem" }}>
                            {(activeHeaviestVolume.volume / 1e6).toFixed(1)}M
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 5, fontSize: ".68rem", color: "var(--text-dim-solid)" }}>
                        shares traded · {activeHeaviestVolume ? sign(activeHeaviestVolume.pctChange ?? 0) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Volume stats bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, fontSize: ".65rem", color: "var(--text-dim-solid)" }}>
                    <div>
                      <span style={{ display: "inline-block", padding: "3px 6px", marginRight: 5, borderRadius: 4, background: "var(--surface-3)", color: "var(--text-hi)", fontFamily: "var(--f-mono)", fontWeight: 700 }}>
                        {(activeTotalVolume / 1e6).toFixed(1)}M
                      </span>
                      shares traded
                      <span style={{ margin: "0 7px" }}>·</span>
                      <span style={{ display: "inline-block", padding: "3px 6px", borderRadius: 4, background: "rgba(245,181,68,.14)", color: "var(--warn)", fontFamily: "var(--f-mono)", fontWeight: 700 }}>
                        {activeAvgRvol ? `${activeAvgRvol.toFixed(1)}x` : "—"}
                      </span>
                      <span style={{ marginLeft: 5 }}>vs 1-month avg volume</span>
                    </div>
                    <span>Sectors ordered by number of active names</span>
                  </div>

                  {/* Sector Board */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                    {activeSectors.map((sec) => (
                      <div key={sec.sector} style={{ minWidth: 0 }}>
                        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border-soft)" }}>
                            <span style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--text-hi)" }}>
                              {titleCaseLabel(sec.sector)}
                            </span>
                          </div>
                          {sec.items.map((it) => {
                            const { price, change } = resolvePriceAndChange(it.ticker, it.price, it.pctChange);
                            const { rvol, volume } = resolveRvolAndVolume(it.ticker, it.rvol, it.volume);
                            const pct = change ?? it.pctChange ?? 0;
                            return (
                              <button
                                key={it.ticker}
                                type="button"
                                onClick={() => setSelectedSym(it.ticker)}
                                style={{
                                  width: "100%",
                                  display: "grid",
                                  gridTemplateColumns: "60px 46px 1fr auto",
                                  alignItems: "center",
                                  gap: 7,
                                  padding: "9px 11px",
                                  border: 0,
                                  borderBottom: "1px solid var(--border-soft)",
                                  background: "transparent",
                                  color: "inherit",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                <b style={{ fontFamily: "var(--f-mono)", fontSize: ".86rem", color: "var(--text-hi)" }}>
                                  {it.ticker}
                                </b>
                                <span style={{
                                  fontFamily: "var(--f-mono)",
                                  fontSize: ".66rem",
                                  fontWeight: 700,
                                  padding: "3px 5px",
                                  borderRadius: 4,
                                  background: rvol != null ? "rgba(245,181,68,.14)" : "var(--surface-3)",
                                  color: rvol != null ? "var(--warn)" : "var(--text-dim-solid)",
                                }}>
                                  {rvol != null ? `${rvol.toFixed(1)}x` : volume != null ? `${(volume / 1e6).toFixed(1)}M` : "—"}
                                </span>
                                <div style={{ height: 5, display: "flex", justifyContent: pct >= 0 ? "flex-start" : "flex-end" }}>
                                  <div style={{
                                    width: `${Math.min(100, Math.max(5, Math.abs(pct) * 4))}%`,
                                    height: 8,
                                    borderRadius: 2,
                                    background: pct >= 0 ? "var(--up)" : "var(--down)",
                                  }} />
                                </div>
                                <span className={cls(pct)} style={{
                                  fontFamily: "var(--f-mono)",
                                  fontSize: ".66rem",
                                  fontWeight: 700,
                                  padding: "3px 6px",
                                  borderRadius: 4,
                                  background: pct >= 0 ? "var(--up-dim)" : "var(--down-dim)",
                                  whiteSpace: "nowrap",
                                }}>
                                  {sign(pct)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : tab === "biggest" ? (
        <div style={{ marginLeft: 16, marginRight: 20, marginTop: 16 }}>
          <div className="card">
            <div className="card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700, color: "var(--text-hi)" }}>
                  Today&apos;s Biggest Gainers and Losers
                </h3>
                <VendorTag v="polygon" />
              </div>
              {filteredBiggest?.generatedAt && (
                <span style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                  as of {scanTime(filteredBiggest.generatedAt)}
                </span>
              )}
            </div>
            <div className="card-b" style={{ maxHeight: "none", padding: "16px 18px" }}>
              {!filteredBiggest ? (
                <DataState loading={biggestLoading} label="Generating scan…" />
              ) : (
                <>
                  <ScanSection
                    title="Today's top 20 % gainers"
                    color="var(--up)"
                    groups={filteredBiggest.gainers}
                    onSelect={setSelectedSym}
                    resolvePriceAndChange={resolvePriceAndChange}
                    resolveRvolAndVolume={resolveRvolAndVolume}
                  />
                  <ScanSection
                    title="Today's top 20 % losers"
                    color="var(--down)"
                    groups={filteredBiggest.losers}
                    onSelect={setSelectedSym}
                    resolvePriceAndChange={resolvePriceAndChange}
                    resolveRvolAndVolume={resolveRvolAndVolume}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
      <div className="card" style={{marginLeft: 16,marginRight: 20, marginTop:16}}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "8px 12px 0" }}><VendorTag v="polygon" /></div>
        <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {sortTh("company", "Company")}
              {sortTh("mcap",    "Mkt Cap", true)}
              {sortTh("price",   "Price",  true)}
              {sortTh("change",  isWeekTab(tab) ? "5-day" : "Change", true)}
              {sortTh("rvol",    "RVOL",   true)}
              {sortTh("cap", "Cap · Sector", true)}
              <th style={{ whiteSpace: "nowrap" }}>Why It Moved</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const isBoardLoading = moversLoading || companiesLoading || (tab === "vol" && volumeLoading);
              if (visible.length === 0) {
                return (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      {isBoardLoading ? (
                        <DataState loading label="Loading movers…" />
                      ) : (
                        <div style={{ padding: 16, color: "var(--text-dim-solid)" }}>
                          {moversError || companiesError
                            ? "Unable to connect to backend server. Please ensure MarketCatalystBackend is running."
                            : "No stocks match these filters."}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }
              return visible.map((m) => {
                // Same values the tab guard used — see shownValues.
                const { price, change: v } = shownValues(m);
                return (
                  <tr
                    key={m.ticker}
                    className={m.owned ? "owned" : ""}
                    onClick={() => setSelectedSym(m.ticker)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StockLogo sym={m.ticker} size={26} />
                        <div className="co">
                          <span className="s">
                            {m.owned && <span className="own-dot" />}
                            {m.ticker}
                          </span>
                          <span className="n">{m.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: "center" }}>
                      {m.marketCap != null
                        ? <span style={{ color: "var(--text-hi)" }}>{fmtMcap(m.marketCap)}</span>
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td className="num" style={{ textAlign: "center" }}>{price == null ? "—" : `$${fmt(price)}`}</td>
                    <td className="num" style={{ textAlign: "center", color: v == null ? undefined : v >= 0 ? "var(--up)" : "var(--down)", fontWeight: 600 }}>
                      {v == null ? "—" : <>{arr(v)} {sign(v)}{!isWeekTab(tab) && sessionTag(m)}</>}
                    </td>
                    <td className="num" style={{ textAlign: "center" }}>
                      {m.rvolRatio > 0
                        ? <b style={{ color: m.rvolRatio > 3 ? "var(--warn)" : "var(--text)" }}>{m.rvolRatio.toFixed(1)}×</b>
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <span style={{ fontSize: ".74rem" }}>
                        <b style={{ color: "var(--text-hi)" }}>{m.cap}</b>
                        {" · "}
                        <span style={{ color: "var(--text-dim-solid)" }}>{m.sector}</span>
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const canon = canonicalClassification(m.ticker);
                          const { price: nPrice, change: nChange } = shownValues(m);
                          setNewsModalSym({
                            ticker: m.ticker,
                            name: canon.name,
                            price: nPrice,
                            pctChange: nChange,
                            direction: (nChange ?? 0) >= 0 ? "gainer" : "loser",
                          });
                        }}
                        title="View news catalyst for why this stock moved"
                        style={{
                          background: "rgba(74,222,128, 0.12)",
                          color: "var(--brand, #4ADE80)",
                          border: "1px solid rgba(74,222,128, 0.3)",
                          borderRadius: 6,
                          padding: "3px 8px",
                          fontSize: ".72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        📰 News
                      </button>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
        </div>
      </div>
      )}



      {/* Sliding stock detail drawer */}
      {selectedSym && (
        <>
          <div className="scrim" onClick={() => setSelectedSym(null)} />
          <div className="stock-side-drawer">
           <div
              className="drawer-h"
              style={{
                paddingTop: 14,
                paddingBottom: 14,
                display: "flex",
                alignItems: "center",
              }}
            >
              {(() => {
                const sym = selectedSym!;
                // Shown as saved only once the server confirmed it (see `adding`).
                const inList = watchedSet.has(sym) && adding !== sym.toUpperCase();
                const canon = canonicalClassification(sym);
                const { price: dPrice, change: dPct } = resolvePriceAndChange(sym);

                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() =>
                        setNewsModalSym({
                          ticker: sym,
                          name: canon.name,
                          price: dPrice,
                          pctChange: dPct,
                          direction: (dPct ?? 0) >= 0 ? "gainer" : "loser",
                        })
                      }
                      title="View News & Catalyst why this stock moved"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                        background: "rgba(74,222,128, 0.15)",
                        border: "1px solid var(--brand, #4ADE80)",
                        color: "var(--text-hi, #ffffff)",
                        borderRadius: 8,
                        padding: "7px 13px",
                        cursor: "pointer",
                        fontSize: ".8rem",
                        fontWeight: 600,
                        fontFamily: "var(--f-body)",
                      }}
                    >
                      <span>📰</span> Why It Moved (News)
                    </button>

                    <button
                      onClick={() => addToWatchlist(sym)}
                      disabled={adding === sym.toUpperCase()}
                      title={adding === sym.toUpperCase() ? "Saving to your watchlist…"
                        : !inList ? "Add this stock to your watchlist"
                        : justAdded.has(sym.toUpperCase()) ? "Added to your watchlist"
                        : "Already in your watchlist"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                        background: inList
                          ? "var(--brand-dim)"
                          : "var(--surface-2)",
                        border: `1px solid ${
                          inList ? "var(--brand)" : "var(--border-soft)"
                        }`,
                        color: inList
                          ? "var(--brand)"
                          : "var(--text-hi)",
                        borderRadius: 8,
                        padding: "7px 13px",
                        cursor: "pointer",
                        fontSize: ".8rem",
                        fontWeight: 600,
                        fontFamily: "var(--f-body)",
                      }}
                    >
                      <span style={{ fontSize: ".95rem", lineHeight: 1 }}>
                        {inList ? "★" : "☆"}
                      </span>
                      {adding === sym.toUpperCase() ? "Adding…" : inList ? "In watchlist" : "Add to watchlist"}
                    </button>
                  </div>
                );
              })()}

              <button
                className="closebtn"
                onClick={() => setSelectedSym(null)}
                style={{ marginLeft: "auto" }}
              >
                ✕
              </button>
            </div>
            <div className="drawer-b">
              <StockScreenEmbed initialSym={selectedSym} />
            </div>
          </div>
        </>
      )}

      {/* Watchlist confirmation toast — floats above the drawer (z-index 999 vs
          the drawer's 51), auto-dismisses after 2.6s; the drawer stays open. */}
      {toast && (
        <div
          role={toastKind === "error" ? "alert" : "status"}
          aria-live={toastKind === "error" ? "assertive" : "polite"}
          style={{
            position: "fixed", top: 22, left: "50%", transform: "translateX(-50%)",
            zIndex: 999, background: "var(--surface-1)",
            border: `1px solid ${toastKind === "error" ? "var(--down)" : "var(--brand)"}`,
            color: "var(--text-hi)", borderRadius: 10, padding: "11px 20px",
            fontSize: ".85rem", fontWeight: 600, lineHeight: 1.4,
            // A failure explains itself, so let it wrap instead of overflowing.
            whiteSpace: toastKind === "error" ? "normal" : "nowrap",
            maxWidth: "min(560px, calc(100vw - 32px))",
            boxShadow: "0 14px 40px -10px rgba(0,0,0,.6)",
            display: "inline-flex", alignItems: "center", gap: 9,
          }}
        >
          <span style={{ color: toastKind === "error" ? "var(--down)" : "var(--brand)", fontSize: "1rem", flexShrink: 0 }}>
            {toastKind === "error" ? "!" : "★"}
          </span>
          {toast}
        </div>
      )}

      {/* Dedicated News & Catalyst Modal */}
      {newsModalSym && (
        <MoverNewsModal
          ticker={newsModalSym.ticker}
          name={newsModalSym.name}
          price={newsModalSym.price}
          pctChange={newsModalSym.pctChange}
          direction={newsModalSym.direction}
          onClose={() => setNewsModalSym(null)}
        />
      )}
    </>
  );
}
