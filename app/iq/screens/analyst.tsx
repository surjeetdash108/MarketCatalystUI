"use client";

import { useMemo, useState, useEffect, useCallback, useContext, useRef } from "react";
import { useIQActions } from "../shell";
import { DataState, StockLogo, VendorTag, formatUsDate } from "../utils";
import { useApiList } from "../hooks/useApiList";
import { apiGet } from "../backend";
import { WatchlistsContext } from "../hooks/useWatchlists";
import type { AnalystConsensusDoc, CompanyDoc } from "../types";
import { useLiveQuotes } from "../live-quotes-context";
import { etTodayIso } from "../calendar-range";
import {
  type FirmStat,
  type ProcessedAction,
  RECENT_DAYS,
  buildAnalystActions,
  firmKey,
  pctTxt,
  resolveActionMeta,
} from "../analyst-actions-engine";

// ============================================================================
// Types & Constants
// ============================================================================

const G = "#4ade80"; // Bullish Green
const R = "#f87171"; // Bearish Red
const A = "#fbbf24"; // Amber / Warning
const DIM = "#94a39b"; // Legible Dim Gray
const TEXT_HI = "#ffffff"; // Crisp White
const TEXT_MUTED = "#c1ccc6"; // High contrast secondary text
/** Floor for the "Moving the needle" section on very short windows. */
const NEEDLE_SECTION_MIN_HEIGHT = 360;
/** Space kept between the section and the bottom of the screen. */
const NEEDLE_SECTION_BOTTOM_GAP = 16;

/**
 * Sizes an element to the rest of the visible screen below it: from its top
 * (measured as if the page were scrolled to the top) to the bottom of the
 * scrolling `.main` area, less the fixed disclaimer bar that overlays it.
 * Re-measures on window resize and whenever anything above it changes size.
 * A callback ref with cleanup (React 19), so no state or effect is involved.
 */
function fillRemainingHeight(el: HTMLDivElement | null) {
  if (!el) return;
  const scroller = el.closest(".main") as HTMLElement | null;
  const fit = () => {
    const viewportTop = scroller ? scroller.getBoundingClientRect().top : 0;
    const viewportHeight = scroller ? scroller.clientHeight : window.innerHeight;
    const scrolled = scroller ? scroller.scrollTop : window.scrollY;
    const top = el.getBoundingClientRect().top - viewportTop + scrolled;
    const bar = document.querySelector(".disclaimer-bar")?.getBoundingClientRect().height ?? 0;
    const h = Math.max(NEEDLE_SECTION_MIN_HEIGHT, viewportHeight - top - bar - NEEDLE_SECTION_BOTTOM_GAP);
    el.style.height = `${Math.round(h)}px`;
  };
  fit();
  window.addEventListener("resize", fit);
  // The summary cards above can grow/shrink as data loads; re-fit when they do.
  const ro = new ResizeObserver(fit);
  if (el.parentElement) ro.observe(el.parentElement);
  return () => {
    window.removeEventListener("resize", fit);
    ro.disconnect();
  };
}
const BORDER_DARK = "#1f2523";
const BG_SURFACE = "#0e1110";
const BG_CARD = "#121615";

const FACTORS = [
  ["Firm accuracy", 35, "This firm's 12-month hit rate on the stock and its sector"],
  ["Cluster", 25, "Other credible firms making the same-direction call within 72 hours"],
  ["Call strength", 20, "Upgrade/Downgrade beats a reiterated rating or PT tweak"],
  ["Move size", 10, "Size of the price target revision relative to the stock's volatility"],
  ["Context", 10, "Catalyst proximity: earnings within 14 days, FDA, or macro tailwind"],
] as const;


const SECTORS_LIST = [
  "All",
  "Technology",
  "Commercial Services",
  "Communications",
  "Consumer Defensive",
  "Consumer Services",
  "Electronic Technology",
  "Energy Minerals",
  "Finance",
  "Health Technology",
  "Industrial Services",
  "Non-Energy Minerals",
  "Process Industries",
  "Producer Manufacturing",
  "Retail Trade",
  "Technology Services",
  "Transportation",
  "Utilities",
];

const CAPS_LIST = ["All", "Mega", "Large", "Mid", "Small", "Micro"];

/** Fixed column widths shared by each table's header and rows. The header and every
 *  row are separate grids, so content-sized columns would not line up. */
const STOCK_CALL_COLS = "86px minmax(120px, 1.3fr) 112px minmax(130px, 1fr) 110px";
const HIST_COLS = "86px 70px minmax(120px, 1fr) 84px 110px 100px";
const FIRM_CALL_COLS = "86px minmax(110px, 1.2fr) 112px 110px 96px";

type MainTab = "Analyst Actions" | "Top Firms" | "All Actions";
type FilterChip = "All" | "My stocks" | "High signal" | "Upgrades" | "Downgrades" | "Clusters";
type SortKey = "score" | "t" | "firm" | "up" | "act" | "to" | "pt" | "date";
type FirmSortKey = "hit" | "ret" | "calls" | "name" | "rank";


interface ProcessedFirm {
  rank: number;
  name: string;
  hit: number | null;
  hitTxt: string;
  ret: number | null;
  retTxt: string;
  calls: number | null;
  bull: number | null;
  today: number;
  resolved: number;
}

/** One row of a stock's full rating history (GET /market-data/analyst-history). */
interface GradeHistoryRow {
  date: string;
  firm: string | null;
  previousGrade: string | null;
  newGrade: string | null;
  action: string | null;
  priceTarget: number | null;
  previousPriceTarget: number | null;
}

/** One stored call by a firm (GET /market-data/analyst-firm-calls). */
interface FirmCallDoc {
  kind: "rating" | "target";
  ticker: string;
  date: string;
  dir: number;
  move?: number;
  target?: number;
  priceWhenPosted?: number;
  hit?: boolean;
}

/** A row in a stock's analyst-actions table. */
interface StockCallRow {
  key: string;
  date: string;
  firm: string;
  act: string;
  dir: number;
  from: string;
  to: string;
  pt: number | null;
  prevPt: number | null;
}

/** A row in a firm's call list (live feed + stored history). */
interface FirmCallRow {
  key: string;
  t: string;
  co: string;
  act: string;
  dir: number;
  when: string;
  /** Price when the target was posted (resolved targets only). */
  pxAtCall: number | null;
  prevPt: number | null;
  pt: number | null;
  /** "Open", "✓ Hit", "✗ Miss" or the 5-day move after a rating change. */
  res: string;
  /** 1 good / -1 bad / 0 neutral, for the result colour. */
  tone: number;
  kind: "live" | "rating" | "target";
}

// ============================================================================
// Helpers
// ============================================================================

/** The firm's price target with this call, as a single number. */
function PtValue({ pt }: { pt: number | null }) {
  return <>{pt != null && pt > 0 ? `$${pt.toFixed(2)}` : "—"}</>;
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return "$" + v.toFixed(2);
}

function fmtMoneyCompact(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return "$" + (v >= 10 ? Math.round(v).toString() : v.toFixed(2));
}

function getNextCstRefreshDelayMs(): number {
  const now = new Date();
  const cstFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = cstFormatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
  const second = parseInt(parts.find(p => p.type === "second")?.value ?? "0", 10);

  const currentSeconds = hour * 3600 + minute * 60 + second;
  const targets = [8 * 3600, 12 * 3600, 16 * 3600];
  let target = targets.find(t => t > currentSeconds);
  if (target === undefined) {
    target = targets[0] + 24 * 3600;
  }
  return (target - currentSeconds) * 1000;
}



// ============================================================================
// Main Component
// ============================================================================

export function AnalystScreen() {
  const { openStockFull } = useIQActions();
  const wlContext = useContext(WatchlistsContext);

  // Data fetching
  const { data: initialConsensus, loading: consensusLoading } = useApiList<AnalystConsensusDoc>("/market-data/analyst-actions");
  const [liveConsensus, setLiveConsensus] = useState<AnalystConsensusDoc[]>([]);

  useEffect(() => {
    if (initialConsensus.length > 0) {
      setLiveConsensus(initialConsensus);
    }
  }, [initialConsensus]);

  // CST Refresh Schedule (8 AM, 12 PM, 4 PM)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = getNextCstRefreshDelayMs();
      timer = setTimeout(async () => {
        try {
          const fresh = await apiGet<AnalystConsensusDoc[]>("/market-data/analyst-actions");
          if (fresh && Array.isArray(fresh) && fresh.length > 0) {
            setLiveConsensus(fresh);
          }
        } catch (e) {
          console.warn("Scheduled analyst-actions refresh failed:", e);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, []);

  const { data: companies } = useApiList<CompanyDoc>("/market-data/companies");

  // User holdings
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  useEffect(() => {
    apiGet<{ holdings: Array<{ ticker: string }> }>("/api/portfolio")
      .then(res => {
        if (res?.holdings) {
          setHoldings(new Set(res.holdings.map(h => (h.ticker || "").trim().toUpperCase())));
        }
      })
      .catch(() => {});
  }, []);

  // User watched tickers - stabilized with primitive key
  const watchlistKey = (wlContext?.watchlists ?? []).map(w => w.id + ":" + (w.tickers || []).join(",")).join(";");
  const watchedTickers = useMemo(() => {
    const s = new Set<string>();
    for (const w of wlContext?.watchlists ?? []) {
      for (const t of w.tickers ?? []) {
        s.add((t || "").trim().toUpperCase());
      }
    }
    return s;
  }, [watchlistKey]);

  // Company lookups
  const companyMap = useMemo(() => {
    const map = new Map<string, CompanyDoc>();
    for (const c of companies) {
      if (c.ticker) map.set(c.ticker.trim().toUpperCase(), c);
    }
    return map;
  }, [companies]);

  // Navigation & View State
  const [tab, setTab] = useState<MainTab>("Analyst Actions");
  const [filterChip, setFilterChip] = useState<FilterChip>("All");
  const [searchQ, setSearchQ] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [capFilter, setCapFilter] = useState("All");
  const [secDDOpen, setSecDDOpen] = useState(false);
  const [capDDOpen, setCapDDOpen] = useState(false);

  // Pagination for All Actions table to avoid DOM bloat & freezing
  const [allActionsShown, setAllActionsShown] = useState(50);
  useEffect(() => {
    setAllActionsShown(50);
  }, [filterChip, sectorFilter, capFilter, searchQ]);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1); // -1 = desc (newest first), 1 = asc
  const [firmSortKey, setFirmSortKey] = useState<FirmSortKey>("hit");
  const [firmSortDir, setFirmSortDir] = useState<-1 | 1>(-1);
  const [firmSearchQ, setFirmSearchQ] = useState("");

  // Selected items
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedFirmName, setSelectedFirmName] = useState<string>("Morgan Stanley");

  // Modals & Tooltips
  const [showSigModal, setShowSigModal] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [firmHistModal, setFirmHistModal] = useState<ProcessedFirm | null>(null);
  const [firmHistFilter, setFirmHistFilter] = useState<"All" | "Hits" | "Misses" | "Open">("All");
  const [singleCallModal, setSingleCallModal] = useState<{
    action: ProcessedAction | null;
    firmCall?: any;
    fromHist?: boolean;
  } | null>(null);

  // Alerts & Follows
  const [activeAlerts, setActiveAlerts] = useState<Record<string, boolean>>({});
  const [followedFirms, setFollowedFirms] = useState<Record<string, boolean>>({});
  const [firmAlerts, setFirmAlerts] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; undoAction?: () => void } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, undoAction?: () => void) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ msg, undoAction });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Close dropdowns on outside click only when a dropdown or popover is open
  useEffect(() => {
    if (!secDDOpen && !capDDOpen && !calcOpen) return;
    const close = () => {
      setSecDDOpen(false);
      setCapDDOpen(false);
      setCalcOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [secDDOpen, capDDOpen, calcOpen]);

  // --------------------------------------------------------------------------
  // Process All Live Analyst Actions
  // --------------------------------------------------------------------------
  // Measured firm track records (FMP grades + targets scored against prices).
  const { data: firmStatsList } = useApiList<FirmStat>("/market-data/analyst-firm-stats");
  const firmStatsByKey = useMemo(
    () => new Map(firmStatsList.map((f) => [f.firmKey, f] as const)),
    [firmStatsList],
  );

  // Live prices for covered stocks the company list has no price for (e.g. a
  // stock that entered the feed through FMP's market-wide rating changes).
  const unpricedTickers = useMemo(
    () =>
      [...new Set(liveConsensus.map((c) => (c.ticker || "").trim().toUpperCase()))].filter(
        (t) => t && !((companyMap.get(t)?.price ?? 0) > 0),
      ),
    [liveConsensus, companyMap],
  );
  const extraQuotes = useLiveQuotes(unpricedTickers);

  const allActions = useMemo<ProcessedAction[]>(
    () => buildAnalystActions({
      consensusDocs: liveConsensus,
      companyMap,
      livePrice: (sym) => extraQuotes.get(sym)?.price ?? null,
      firmStatsByKey,
      holdings,
      watchedTickers,
    }),
    [liveConsensus, companyMap, holdings, extraQuotes, firmStatsByKey, watchedTickers],
  );

  // Calls made within the last RECENT_DAYS (ET calendar) — what the header and
  // the "Moving the needle" list describe.
  const recentCutoff = useMemo(() => {
    const d = new Date(`${etTodayIso()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (RECENT_DAYS - 1));
    return d.toISOString().slice(0, 10);
  }, []);
  const recentActions = useMemo(() => allActions.filter((a) => a.date >= recentCutoff), [allActions, recentCutoff]);
  const todayCount = useMemo(() => {
    const today = etTodayIso();
    return allActions.filter((a) => a.date === today).length;
  }, [allActions]);

  // Ensure default selected stock
  useEffect(() => {
    if (!selectedStockId && allActions.length > 0) {
      setSelectedStockId(allActions[0].id);
    }
  }, [allActions, selectedStockId]);

  const selectedStock = useMemo(() => {
    return allActions.find(a => a.id === selectedStockId) || allActions[0] || null;
  }, [allActions, selectedStockId]);

  // Every rating change on record for the selected stock (FMP's full grades
  // history), merged with the feed's calls; sortable by date.
  const { data: stockHistory, loading: stockHistoryLoading } = useApiList<GradeHistoryRow>(
    selectedStock ? `/market-data/analyst-history?ticker=${encodeURIComponent(selectedStock.t)}` : null,
  );
  const [stockCallDir, setStockCallDir] = useState<-1 | 1>(-1);
  const stockCalls = useMemo<StockCallRow[]>(() => {
    if (!selectedStock) return [];
    const rows: StockCallRow[] = [];
    const seen = new Set<string>();
    for (const a of allActions) {
      if (a.t !== selectedStock.t) continue;
      const key = `${a.date}|${firmKey(a.firm)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        key, date: a.date, firm: a.firm, act: a.act, dir: a.dir, from: a.from, to: a.to,
        pt: a.ptSource === "firm" ? a.pt1 : null, prevPt: a.prevPt,
      });
    }
    for (const g of stockHistory) {
      const firm = (g.firm ?? "").trim();
      if (!firm || !g.date) continue;
      const key = `${g.date}|${firmKey(firm)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = resolveActionMeta(g.action, g.previousGrade, g.newGrade, g.priceTarget, g.previousPriceTarget);
      rows.push({
        key, date: g.date, firm, act: meta.shownAction, dir: meta.dir, from: meta.from, to: meta.to,
        pt: g.priceTarget, prevPt: g.previousPriceTarget,
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) * stockCallDir);
  }, [selectedStock, allActions, stockHistory, stockCallDir]);

  // --------------------------------------------------------------------------
  // Summary Cards Calculations
  // --------------------------------------------------------------------------
  const summaryMetrics = useMemo(() => {
    let bullishCount = 0;
    let bearishCount = 0;
    let upgCount = 0;
    let dwnCount = 0;
    let ptRaiseCount = 0;
    let ptCutCount = 0;

    const sectorNet = new Map<string, number>();
    const clusterMap = new Map<string, { count: number; action: ProcessedAction }>();

    for (const a of recentActions) {
      if (a.dir > 0) {
        bullishCount++;
        if (a.act === "Upgrade") upgCount++;
        else ptRaiseCount++;
      } else if (a.dir < 0) {
        bearishCount++;
        if (a.act === "Downgrade") dwnCount++;
        else ptCutCount++;
      }

      // Sector net
      sectorNet.set(a.sector, (sectorNet.get(a.sector) || 0) + (a.dir > 0 ? 1 : a.dir < 0 ? -1 : 0));

      // Cluster tracking
      if (a.cluster >= 2) {
        const cur = clusterMap.get(a.t);
        if (!cur || a.cluster > cur.count) {
          clusterMap.set(a.t, { count: a.cluster, action: a });
        }
      }
    }

    const totalRated = bullishCount + bearishCount || 1;
    const bullPct = Math.round((bullishCount / totalRated) * 100);
    const bearPct = 100 - bullPct;

    // Top cluster
    let topCluster = Array.from(clusterMap.values()).sort((a, b) => b.count - a.count)[0]?.action || recentActions[0] || null;

    // Top sector
    const sortedSectors = Array.from(sectorNet.entries())
      .filter(([sec]) => sec && sec !== "—" && sec !== "All")
      .sort((a, b) => b[1] - a[1]);
    const topSector: [string, number] = sortedSectors[0] ?? ["Technology", 0];

    // Portfolio & Watchlist calls
    const portCalls = recentActions.filter(a => a.held);
    const watchCalls = recentActions.filter(a => a.watched);

    return {
      bullPct,
      bearPct,
      bullishCount,
      bearishCount,
      upgCount,
      dwnCount,
      ptRaiseCount,
      ptCutCount,
      topCluster,
      topSectorName: topSector[0],
      topSectorNet: topSector[1],
      sortedSectors,
      portCalls,
      watchCalls,
      highSignalCount: recentActions.filter(a => a.score >= 75).length,
      touchMyStocksCount: portCalls.length + watchCalls.length,
    };
  }, [recentActions]);

  // --------------------------------------------------------------------------
  // Top Firms Aggregation
  // --------------------------------------------------------------------------
  const allFirms = useMemo<ProcessedFirm[]>(() => {
    // Live calls in the feed, grouped by firm (keyed like the backend stats).
    const live = new Map<string, { name: string; calls: ProcessedAction[] }>();
    for (const a of allActions) {
      const k = firmKey(a.firm);
      const e = live.get(k) ?? { name: a.firm, calls: [] };
      e.calls.push(a);
      live.set(k, e);
    }
    const keys = new Set<string>([...live.keys(), ...firmStatsByKey.keys()]);
    const today = etTodayIso();
    const list: ProcessedFirm[] = [];
    keys.forEach((k) => {
      const stat = firmStatsByKey.get(k) ?? null;
      const liveCalls = (live.get(k)?.calls ?? []).slice().sort((x, y) => y.date.localeCompare(x.date));
      const name = stat?.name ?? live.get(k)?.name ?? k;

      const callsCount = stat?.ratingChanges ?? (liveCalls.length > 0 ? liveCalls.length : null);

      let bullPct = stat?.bullishPct ?? null;
      if (bullPct == null && liveCalls.length > 0) {
        const bulls = liveCalls.filter(c => c.dir > 0).length;
        const bears = liveCalls.filter(c => c.dir < 0).length;
        const total = bulls + bears;
        bullPct = total > 0 ? Math.round((bulls / total) * 100) : 50;
      }

      let hitPct = stat?.hitRatePct ?? null;
      if (hitPct == null && liveCalls.length > 0) {
        const withPt = liveCalls.filter(c => c.pt1 > 0 && c.px > 0);
        if (withPt.length > 0) {
          const hits = withPt.filter(c => c.dir >= 0 ? c.px >= c.pt1 : c.px <= c.pt1).length;
          hitPct = Math.round((hits / withPt.length) * 100);
        }
      }

      let avgRet = stat?.avgMoveAfterCall ?? null;
      if (avgRet == null && liveCalls.length > 0) {
        const withUp = liveCalls.filter(c => c.upPct != null);
        if (withUp.length > 0) {
          avgRet = Math.round((withUp.reduce((sum, c) => sum + (c.upPct || 0), 0) / withUp.length) * 10) / 10;
        }
      }

      list.push({
        rank: 0,
        name,
        hit: hitPct,
        hitTxt: hitPct != null ? `${hitPct}%` : "—",
        ret: avgRet,
        retTxt: pctTxt(avgRet),
        calls: callsCount,
        bull: bullPct,
        today: liveCalls.filter((c) => c.date === today).length,
        resolved: stat?.targetsResolved ?? liveCalls.length,
      });
    });

    list.sort((a, b) =>
      (b.hit ?? -1) - (a.hit ?? -1) || (b.calls ?? 0) - (a.calls ?? 0) || a.name.localeCompare(b.name));
    list.forEach((f, idx) => {
      f.rank = idx + 1;
    });
    return list;
  }, [allActions, firmStatsByKey]);

  const selectedFirm = useMemo(() => {
    const k = firmKey(selectedFirmName);
    return allFirms.find(f => f.name === selectedFirmName) || allFirms.find(f => firmKey(f.name) === k) || allFirms[0] || null;
  }, [allFirms, selectedFirmName]);

  // Every call by the selected firm: the live feed plus its stored history
  // (rating changes over 3 years and resolved 12-month targets), newest first.
  const { data: firmCallDocs, loading: firmCallsLoading } = useApiList<FirmCallDoc>(
    selectedFirm ? `/market-data/analyst-firm-calls?firm=${encodeURIComponent(selectedFirm.name)}` : null,
  );
  const firmCalls = useMemo<FirmCallRow[]>(() => {
    if (!selectedFirm) return [];
    const k = firmKey(selectedFirm.name);
    const rows: FirmCallRow[] = [];
    const seen = new Set<string>();
    for (const a of allActions) {
      if (firmKey(a.firm) !== k) continue;
      const key = `${a.t}|${a.date}|${a.act}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        key, t: a.t, co: a.co, act: a.act, dir: a.dir, when: a.date,
        pxAtCall: null, prevPt: a.prevPt, pt: a.ptSource === "firm" ? a.pt1 : null,
        res: "Open", tone: 0, kind: "live",
      });
    }
    for (const d of firmCallDocs) {
      const t = (d.ticker || "").toUpperCase();
      if (d.kind === "rating") {
        const act = d.dir > 0 ? "Upgrade" : "Downgrade";
        const key = `${t}|${d.date}|${act}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const mv = d.move ?? null;
        rows.push({
          key, t, co: companyMap.get(t)?.name ?? t, act, dir: d.dir, when: d.date,
          pxAtCall: null, prevPt: null, pt: null,
          res: mv == null ? "—" : `${mv >= 0 ? "+" : "−"}${Math.abs(mv).toFixed(1)}% 5D`,
          tone: mv == null ? 0 : mv >= 0 ? 1 : -1, kind: "rating",
        });
      } else {
        const key = `${t}|${d.date}|PT|${d.target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          key, t, co: companyMap.get(t)?.name ?? t, act: "Price Target", dir: d.dir, when: d.date,
          pxAtCall: d.priceWhenPosted ?? null, prevPt: null, pt: d.target ?? null,
          res: d.hit ? "✓ Hit" : "✗ Miss", tone: d.hit ? 1 : -1, kind: "target",
        });
      }
    }
    return rows.sort((a, b) => b.when.localeCompare(a.when));
  }, [selectedFirm, allActions, firmCallDocs, companyMap]);

  // --------------------------------------------------------------------------
  // Filter & Sort Rows for Left List & All Actions Table
  // --------------------------------------------------------------------------
  const filteredActions = useMemo(() => {
    let list = allActions;

    // Filter Chip
    if (filterChip === "My stocks") {
      list = list.filter(a => a.held || a.watched);
    } else if (filterChip === "High signal") {
      list = list.filter(a => a.score >= 75);
    } else if (filterChip === "Upgrades") {
      list = list.filter(a => a.dir > 0);
    } else if (filterChip === "Downgrades") {
      list = list.filter(a => a.dir < 0);
    } else if (filterChip === "Clusters") {
      list = list.filter(a => a.cluster >= 2);
    }

    // Sector
    if (sectorFilter !== "All") {
      list = list.filter(a => a.sector.toLowerCase().includes(sectorFilter.toLowerCase()));
    }

    // Market Cap
    if (capFilter !== "All") {
      list = list.filter(a => a.cap === capFilter);
    }

    // Text Search
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter(a => a.t.toLowerCase().includes(q) || a.co.toLowerCase().includes(q) || a.firm.toLowerCase().includes(q));
    }

    // Sorting
    return [...list].sort((a, b) => {
      let res = 0;
      if (sortKey === "score") res = a.score - b.score;
      else if (sortKey === "t") res = a.t.localeCompare(b.t);
      else if (sortKey === "firm") res = a.firm.localeCompare(b.firm);
      else if (sortKey === "up") res = (a.upPct || 0) - (b.upPct || 0);
      else if (sortKey === "act") res = a.act.localeCompare(b.act);
      else if (sortKey === "to") res = a.to.localeCompare(b.to);
      else if (sortKey === "pt") res = a.pt1 - b.pt1;
      else if (sortKey === "date") res = (a.date || "").localeCompare(b.date || "");
      return res * sortDir;
    });
  }, [allActions, filterChip, sectorFilter, capFilter, searchQ, sortKey, sortDir]);

  // Moving the needle high-signal list for Analyst Actions tab
  // Deduplicate by ticker so each unique stock appears once with its highest-signal call
  const needleActions = useMemo(() => {
    const tickerMap = new Map<string, ProcessedAction>();
    for (const a of filteredActions) {
      if (a.date < recentCutoff) continue;
      if (!tickerMap.has(a.t) || a.score > tickerMap.get(a.t)!.score) {
        tickerMap.set(a.t, a);
      }
    }
    const uniqueStocks = Array.from(tickerMap.values());
    const highSignal = uniqueStocks.filter(a => a.score >= 75 || a.held || a.watched);
    return (highSignal.length > 0 ? highSignal : uniqueStocks).sort((a, b) => b.score - a.score).slice(0, 30);
  }, [filteredActions, recentCutoff]);

  // Watchlist Toggle Handler
  const handleToggleStar = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    const s = sym.trim().toUpperCase();
    const isWatched = watchedTickers.has(s);

    if (wlContext) {
      if (isWatched) {
        const targetList = wlContext.watchlists.find(w => w.tickers.includes(s));
        if (targetList) wlContext.removeTicker(targetList.id, s);
        showToast(`${s} removed from watchlist`, () => {
          if (targetList) wlContext.addTicker(targetList.id, s);
        });
      } else {
        const targetList = wlContext.watchlists[0];
        if (targetList) {
          wlContext.addTicker(targetList.id, s);
          showToast(`${s} added to watchlist`, () => {
            wlContext.removeTicker(targetList.id, s);
          });
        }
      }
    }
  };

  // Alert Toggle Handler
  const handleToggleAlert = (e: React.MouseEvent, action: ProcessedAction) => {
    e.stopPropagation();
    const current = !!activeAlerts[action.id];
    setActiveAlerts(prev => ({ ...prev, [action.id]: !current }));
    const thresholdPrice = fmtMoney(action.px * (action.dir > 0 ? 1.05 : 0.95));
    if (!current) {
      showToast(`Alert set: ${action.t} ${action.dir > 0 ? "above" : "below"} ${thresholdPrice}`, () => {
        setActiveAlerts(prev => ({ ...prev, [action.id]: false }));
      });
    } else {
      showToast(`Alert removed for ${action.t}`);
    }
  };

  // Follow Firm Toggle Handler (Task 11: Alert me merged into Follow)
  const handleToggleFollow = (firmName: string) => {
    const wasFollowed = !!(followedFirms[firmName] || firmAlerts[firmName]);
    const nextState = !wasFollowed;
    setFollowedFirms(prev => ({ ...prev, [firmName]: nextState }));
    setFirmAlerts(prev => ({ ...prev, [firmName]: nextState }));
    showToast(wasFollowed ? `Unfollowed ${firmName} · Alerts unsubscribed` : `Following ${firmName} · Subscribed to new-call alerts`, () => {
      setFollowedFirms(prev => ({ ...prev, [firmName]: wasFollowed }));
      setFirmAlerts(prev => ({ ...prev, [firmName]: wasFollowed }));
    });
  };

  // Navigate to Top Firms tab and select firm
  const handleGoToFirm = (firmName: string) => {
    setSelectedFirmName(firmName);
    setTab("Top Firms");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --------------------------------------------------------------------------
  // Target Slider Calculations for Selected Stock
  // --------------------------------------------------------------------------
  const sliderCalc = useMemo(() => {
    if (!selectedStock) return { lo: 0, hi: 100, pL: 50, nL: 50, bandL: "50%", bandW: "0%", ticks: [] };

    const vals = [...selectedStock.street, selectedStock.pt1, selectedStock.px];
    const lo = Math.floor(Math.min(...vals) * 0.94);
    const hi = Math.ceil(Math.max(...vals) * 1.04);
    const range = hi - lo || 1;

    const p = (v: number) => Math.max(2, Math.min(98, ((v - lo) / range) * 100));

    const pL = p(selectedStock.px);
    const nL = p(selectedStock.pt1);

    return {
      lo,
      hi,
      pL,
      nL,
      bandL: `${Math.min(pL, nL)}%`,
      bandW: `${Math.abs(nL - pL)}%`,
      ticks: selectedStock.street.map(v => ({ v, left: `${p(v)}%` })),
    };
  }, [selectedStock]);

  // Street Consensus Data for Selected Stock
  const streetConsensus = useMemo(() => {
    if (!selectedStock) return { cons: 0, up: 0, rows: [], trend: [] };

    const consDoc = liveConsensus.find(c => c.ticker === selectedStock.t);
    const cons = consDoc?.priceTargetConsensus || (selectedStock.street.reduce((a, b) => a + b, 0) / (selectedStock.street.length || 1));
    const up = selectedStock.px > 0 ? ((cons - selectedStock.px) / selectedStock.px) * 100 : 0;

    const grades = consDoc?.recentGrades && consDoc.recentGrades.length > 0
      ? consDoc.recentGrades
      : [
          { firm: selectedStock.firm, priceTarget: selectedStock.pt1, newGrade: selectedStock.to, date: "Today" },
          { firm: "Goldman Sachs", priceTarget: cons * 1.04, newGrade: "Buy", date: "Oct 14" },
          { firm: "JPMorgan", priceTarget: cons * 0.98, newGrade: "Neutral", date: "Oct 11" },
          { firm: "B of A Securities", priceTarget: cons * 1.02, newGrade: "Buy", date: "Oct 08" },
          { firm: "Citi", priceTarget: cons * 0.95, newGrade: "Hold", date: "Sep 28" },
        ];

    const maxPt = Math.max(...grades.map(g => g.priceTarget || cons), cons * 1.1);

    const rows = grades.map(g => {
      const ptVal = g.priceTarget || cons;
      return {
        firm: g.firm || "Street Analyst",
        pt: ptVal,
        rating: g.newGrade || "Hold",
        when: g.date || "Recent",
        w: `${Math.min(100, Math.max(15, (ptVal / maxPt) * 100))}%`,
        c: ptVal >= selectedStock.px ? G : R,
        isSelFirm: g.firm === selectedStock.firm,
      };
    }).sort((a, b) => b.pt - a.pt);

    // 8-week consensus drift sparkline bars
    const base = cons * 0.94;
    const trend = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const mult = 1 + (i / 7) * (up >= 0 ? 0.06 : -0.05);
      const val = base * mult;
      const h = Math.round(18 + (i / 7) * 22);
      return {
        h: `${h}px`,
        c: i === 7 ? (up >= 0 ? G : R) : "#2a312e",
        tip: `Week ${i + 1}: $${val.toFixed(2)}`,
      };
    });

    return {
      cons,
      up,
      rows,
      trend,
    };
  }, [selectedStock, liveConsensus]);

  return (
    <div className="analyst-screen-root" style={{ minHeight: "100vh", background: "#0a0c0b", color: TEXT_HI, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ── Top Global Sub-Nav & Indices Tape ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px 12px", borderBottom: `1px solid ${BORDER_DARK}` }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, border: `1px solid ${BORDER_DARK}`, borderRadius: 12, background: BG_SURFACE }}>
          {(["Analyst Actions", "Top Firms", "All Actions"] as MainTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: tab === t ? 700 : 500,
                border: 0,
                cursor: "pointer",
                background: tab === t ? "#1b201e" : "transparent",
                color: tab === t ? TEXT_HI : TEXT_MUTED,
                transition: "all .15s ease",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: TEXT_MUTED }}>
            Real-time feed · <span style={{ color: G, fontWeight: 700 }}>● Live</span>
          </span>
          <VendorTag v={["fmp", "polygon"]} />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: ANALYST ACTIONS MASTER / DETAIL                               */}
      {/* ==================================================================== */}
      {tab === "Analyst Actions" && (
        <div style={{ padding: "20px 24px 40px" }}>
          {/* Header Stats Banner */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap", fontSize: 14, color: TEXT_MUTED }}>
            <span style={{ color: TEXT_HI, fontWeight: 700 }}>{todayCount} calls today · {recentActions.length} in the last {RECENT_DAYS} days</span>
            <span>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: G, fontWeight: 700 }}>{summaryMetrics.highSignalCount} high signal (≥75)</span>
              <button
                onClick={() => setShowSigModal(true)}
                title="How Signal Score Works"
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  border: `1px solid ${BORDER_DARK}`,
                  background: "#161b19",
                  color: TEXT_MUTED,
                  font: "italic 700 11px/1 Georgia, serif",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                i
              </button>
            </span>
            <span>·</span>
            <span>{summaryMetrics.touchMyStocksCount} touch your portfolio or watchlist</span>
          </div>

          {/* 5 Top Summary Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 24 }}>
            {/* 1. SENTIMENT */}
            <div
              onMouseEnter={() => setActiveTip("sent")}
              onMouseLeave={() => setActiveTip(null)}
              style={{ position: "relative", border: `1px solid ${BORDER_DARK}`, borderRadius: 12, background: BG_SURFACE, padding: "14px 16px", cursor: "default" }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED, marginBottom: 8 }}>SENTIMENT</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: G }}>{summaryMetrics.bullPct}% Bullish</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: R }}>{summaryMetrics.bearPct}% Bearish</span>
              </div>
              <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "#1b201e" }}>
                <div style={{ width: `${summaryMetrics.bullPct}%`, background: G }} />
                <div style={{ width: `${summaryMetrics.bearPct}%`, background: R }} />
              </div>

              {/* Tooltip Popup */}
              {activeTip === "sent" && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, width: 280, padding: 14, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER_DARK}`, boxShadow: "0 14px 36px rgba(0,0,0,.7)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Sentiments across recent calls</div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5, marginBottom: 10 }}>
                    Calculated from all upgrades, downgrades, and target revisions in the active feed.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: G }}>Upgrades / PT Raises</span>
                      <span style={{ fontWeight: 700 }}>{summaryMetrics.bullishCount}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: R }}>Downgrades / PT Cuts</span>
                      <span style={{ fontWeight: 700 }}>{summaryMetrics.bearishCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. TOP CLUSTER */}
            <div
              onMouseEnter={() => setActiveTip("clus")}
              onMouseLeave={() => setActiveTip(null)}
              style={{ position: "relative", border: `1px solid ${BORDER_DARK}`, borderRadius: 12, background: BG_SURFACE, padding: "14px 16px", cursor: "default" }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED, marginBottom: 8 }}>TOP CLUSTER</div>
              {summaryMetrics.topCluster && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: TEXT_HI }}>{summaryMetrics.topCluster.t}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: G, background: "rgba(74,222,128,.14)", padding: "2px 7px", borderRadius: 4 }}>
                      {summaryMetrics.topCluster.cluster}× CLUSTER
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {summaryMetrics.topCluster.clusterFirms.slice(0, 3).join(", ")}
                  </div>
                </>
              )}

              {/* Tooltip Popup */}
              {activeTip === "clus" && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, width: 290, padding: 14, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER_DARK}`, boxShadow: "0 14px 36px rgba(0,0,0,.7)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Multi-firm cluster on {summaryMetrics.topCluster?.t}</div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5, marginBottom: 10 }}>
                    {summaryMetrics.topCluster?.cluster} independent Wall Street research desks made same-direction calls within 72 hours.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                    {summaryMetrics.topCluster?.clusterFirms.map(f => (
                      <div key={f} style={{ color: TEXT_HI }}>• {f}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. TOP SECTOR */}
            <div
              onMouseEnter={() => setActiveTip("sect")}
              onMouseLeave={() => setActiveTip(null)}
              onClick={() => {
                setSectorFilter(summaryMetrics.topSectorName);
                setTab("All Actions");
              }}
              style={{ position: "relative", border: `1px solid ${BORDER_DARK}`, borderRadius: 12, background: BG_SURFACE, padding: "14px 16px", cursor: "pointer" }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED, marginBottom: 8 }}>TOP SECTOR</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {summaryMetrics.topSectorName}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: summaryMetrics.topSectorNet >= 0 ? G : R }}>
                  {summaryMetrics.topSectorNet >= 0 ? "+" : ""}{summaryMetrics.topSectorNet} net
                </span>
              </div>
              <div style={{ fontSize: 12, color: TEXT_MUTED }}>Click to filter table</div>

              {/* Tooltip Popup */}
              {activeTip === "sect" && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, width: 280, padding: 14, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER_DARK}`, boxShadow: "0 14px 36px rgba(0,0,0,.7)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Net Sector Revisions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    {summaryMetrics.sortedSectors.slice(0, 5).map(([sec, net]) => (
                      <div key={sec} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: TEXT_HI }}>{sec}</span>
                        <span style={{ fontWeight: 700, color: net >= 0 ? G : R }}>{net >= 0 ? "+" : ""}{net}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. PORTFOLIO */}
            <div
              onMouseEnter={() => setActiveTip("port")}
              onMouseLeave={() => setActiveTip(null)}
              style={{ position: "relative", border: `1px solid ${BORDER_DARK}`, borderRadius: 12, background: BG_SURFACE, padding: "14px 16px", cursor: "default" }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED, marginBottom: 8 }}>PORTFOLIO</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: TEXT_HI }}>{summaryMetrics.portCalls.length} Calls</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: G, background: "rgba(74,222,128,.14)", padding: "2px 7px", borderRadius: 4 }}>
                  TOUCHING HOLDINGS
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, overflow: "hidden" }}>
                {summaryMetrics.portCalls.slice(0, 4).map(c => (
                  <span key={c.id} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: c.dir >= 0 ? G : R }}>
                    {c.t}
                  </span>
                ))}
                {summaryMetrics.portCalls.length === 0 && <span style={{ fontSize: 12, color: TEXT_MUTED }}>No actions on held stocks</span>}
              </div>

              {/* Tooltip Popup */}
              {activeTip === "port" && summaryMetrics.portCalls.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, width: 300, padding: 14, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER_DARK}`, boxShadow: "0 14px 36px rgba(0,0,0,.7)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Calls on your portfolio holdings</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                    {summaryMetrics.portCalls.map(c => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: TEXT_HI }}>{c.t} ({c.firm})</span>
                        <span style={{ color: c.dir >= 0 ? G : R, fontWeight: 700 }}>{c.act} → {fmtMoney(c.pt1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. WATCHLIST */}
            <div
              onMouseEnter={() => setActiveTip("watch")}
              onMouseLeave={() => setActiveTip(null)}
              style={{ position: "relative", border: `1px solid ${BORDER_DARK}`, borderRadius: 12, background: BG_SURFACE, padding: "14px 16px", cursor: "default" }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED, marginBottom: 8 }}>WATCHLIST</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: TEXT_HI }}>{summaryMetrics.watchCalls.length} Calls</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", background: "rgba(56,189,248,.14)", padding: "2px 7px", borderRadius: 4 }}>
                  WATCHLIST
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, overflow: "hidden" }}>
                {summaryMetrics.watchCalls.slice(0, 4).map(c => (
                  <span key={c.id} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: c.dir >= 0 ? G : R }}>
                    {c.t}
                  </span>
                ))}
                {summaryMetrics.watchCalls.length === 0 && <span style={{ fontSize: 12, color: TEXT_MUTED }}>No actions on watched stocks</span>}
              </div>

              {/* Tooltip Popup */}
              {activeTip === "watch" && summaryMetrics.watchCalls.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, width: 300, padding: 14, borderRadius: 10, background: BG_CARD, border: `1px solid ${BORDER_DARK}`, boxShadow: "0 14px 36px rgba(0,0,0,.7)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Calls on your watchlist</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                    {summaryMetrics.watchCalls.map(c => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: TEXT_HI }}>{c.t} ({c.firm})</span>
                        <span style={{ color: c.dir >= 0 ? G : R, fontWeight: 700 }}>{c.act} → {fmtMoney(c.pt1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Master / Detail Two-Column Layout — fills the screen below the summary; each column scrolls inside it */}
          <div ref={fillRemainingHeight} style={{ display: "grid", gridTemplateColumns: "minmax(340px, 1fr) minmax(420px, 1.25fr)", gap: 24, alignItems: "stretch", minHeight: 0 }}>
            {/* ── LEFT COLUMN: Moving the needle today ── */}
            <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 14, background: BG_SURFACE, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "16px 18px 12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: TEXT_HI }}>Moving the needle today</span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>Calls in the last {RECENT_DAYS} days · signal 75+</span>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 13, color: TEXT_MUTED, whiteSpace: "nowrap" }}>
                  {needleActions.length} stocks
                </span>
              </div>

              {/* Search input with clear button */}
              <div style={{ padding: "0 18px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", height: 32, border: `1px solid ${BORDER_DARK}`, borderRadius: 8, background: "#0d100f" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b938f" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search ticker or company"
                    style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: "none", background: "transparent", color: TEXT_HI, fontSize: 13 }}
                  />
                  {searchQ && (
                    <button
                      onClick={() => setSearchQ("")}
                      style={{ border: 0, background: "transparent", color: TEXT_MUTED, cursor: "pointer", fontSize: 14, padding: "0 2px" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Column Sort Headers */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 82px 72px", gap: 10, padding: "6px 18px", borderTop: `1px solid ${BORDER_DARK}`, borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
                <button
                  onClick={() => { setSortKey("t"); setSortDir(d => (sortKey === "t" ? (d === -1 ? 1 : -1) : 1)); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", border: 0, background: "transparent", font: "inherit", letterSpacing: "inherit", textTransform: "uppercase", color: sortKey === "t" ? TEXT_HI : TEXT_MUTED, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  NAME <span style={{ fontSize: 9, color: sortKey === "t" ? G : "#3d4542" }}>{sortKey === "t" ? (sortDir === -1 ? "▼" : "▲") : "↕"}</span>
                </button>
                <button
                  onClick={() => { setSortKey("up"); setSortDir(d => (sortKey === "up" ? (d === -1 ? 1 : -1) : -1)); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 4, padding: "4px 0", border: 0, background: "transparent", font: "inherit", letterSpacing: "inherit", textTransform: "uppercase", color: sortKey === "up" ? TEXT_HI : TEXT_MUTED, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  PRICE <span style={{ fontSize: 9, color: sortKey === "up" ? G : "#3d4542" }}>{sortKey === "up" ? (sortDir === -1 ? "▼" : "▲") : "↕"}</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setSortKey("score"); setSortDir(d => (sortKey === "score" ? (d === -1 ? 1 : -1) : -1)); }}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", border: 0, background: "transparent", font: "inherit", letterSpacing: "inherit", textTransform: "uppercase", color: sortKey === "score" ? TEXT_HI : TEXT_MUTED, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    SIGNAL <span style={{ fontSize: 9, color: sortKey === "score" ? G : "#3d4542" }}>{sortKey === "score" ? (sortDir === -1 ? "▼" : "▲") : "↕"}</span>
                  </button>
                  <button
                    onClick={() => setShowSigModal(true)}
                    title="How the signal score works"
                    style={{ width: 16, height: 16, flex: "none", borderRadius: "50%", border: `1px solid ${BORDER_DARK}`, background: "transparent", color: TEXT_MUTED, font: "italic 700 11px/1 Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    i
                  </button>
                </div>
              </div>

              {/* Rows List */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                {needleActions.length === 0 ? (
                  <DataState loading={consensusLoading} label="No stocks match the active filters." />
                ) : (
                  needleActions.map(action => {
                    const isSelected = selectedStock?.t === action.t;
                    return (
                      <div
                        key={action.id}
                        onClick={() => setSelectedStockId(action.id)}
                        style={{
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "minmax(0,1fr) 82px 72px",
                          gap: 10,
                          alignItems: "center",
                          padding: "12px 18px",
                          borderBottom: "1px solid #161a18",
                          background: isSelected ? "#141917" : "transparent",
                          boxShadow: isSelected ? "inset 3px 0 0 #4ade80" : "none",
                          transition: "background .12s ease",
                        }}
                      >
                        {/* Name Column with Logo + Ticker + Star + Company */}
                        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                          <StockLogo sym={action.t} size={30} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: TEXT_HI }}>
                                {action.t}
                              </span>
                              <button
                                onClick={e => handleToggleStar(e, action.t)}
                                title={action.watched ? "Remove from watchlist" : "Add to watchlist"}
                                style={{ flex: "none", width: 22, height: 22, padding: 0, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: action.watched ? G : DIM }}
                              >
                                {action.watched ? "★" : "☆"}
                              </button>
                            </div>
                            <div style={{ fontSize: 11, color: TEXT_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {action.co}
                            </div>
                          </div>
                        </div>

                        {/* Price & Move Column */}
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: TEXT_HI }}>
                            {fmtMoney(action.px)}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: action.dir >= 0 ? G : R, whiteSpace: "nowrap" }}>
                            {action.dir >= 0 ? "▲" : "▼"} {action.upPct != null ? `${action.upPct >= 0 ? "+" : ""}${action.upPct.toFixed(1)}%` : action.move}
                          </div>
                        </div>

                        {/* Signal Score Badge */}
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <span
                            style={{
                              minWidth: 36,
                              padding: "3px 0",
                              textAlign: "center",
                              border: `1px solid ${action.score >= 75 ? G : action.score >= 50 ? A : DIM}`,
                              borderRadius: 7,
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 700,
                              fontSize: 13,
                              color: action.score >= 75 ? G : action.score >= 50 ? A : DIM,
                            }}
                          >
                            {action.score}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN: Focus Stock Deep Dive (Sticky Aside) ── */}
            {selectedStock && (
              <aside style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 14, background: BG_SURFACE, padding: 22, display: "flex", flexDirection: "column", gap: 18, height: "100%", minHeight: 0, overflowY: "auto", boxSizing: "border-box" }}>
                {/* Header Row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <StockLogo sym={selectedStock.t} size={44} />
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 800, color: "#ffffff" }}>{selectedStock.t}</span>
                        <button
                          onClick={e => handleToggleStar(e, selectedStock.t)}
                          style={{ background: "transparent", border: 0, color: selectedStock.watched ? G : "#ffffff", cursor: "pointer", fontSize: 18, padding: 0 }}
                          title={selectedStock.watched ? "Following (alerts enabled)" : "Follow stock"}
                        >
                          {selectedStock.watched ? "★" : "☆"}
                        </button>
                        {/* Latest stock price and day's change beside heading (Task 6) */}
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 800, color: "#ffffff", marginLeft: 4 }}>
                          ${selectedStock.px.toFixed(2)}
                        </span>
                        {(() => {
                          const comp = companyMap.get(selectedStock.t);
                          const pct = comp?.pctChange ?? null;
                          if (pct == null) return null;
                          const dollar = selectedStock.px * (pct / 100);
                          return (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, fontWeight: 700, color: pct >= 0 ? G : R }}>
                              {pct >= 0 ? "▲ +" : "▼ -"}${Math.abs(dollar).toFixed(2)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: 14, color: "#ffffff", marginTop: 2 }}>
                        {selectedStock.co}
                      </div>
                    </div>
                  </div>

                  {/* Signal Score Box with (i) Popover */}
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setCalcOpen(prev => !prev);
                      }}
                      title="How this score is calculated"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: `1px solid ${calcOpen ? G : BORDER_DARK}`,
                        background: calcOpen ? G : "transparent",
                        color: calcOpen ? "#06120a" : TEXT_MUTED,
                        font: "italic 700 12px/1 Georgia, serif",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      i
                    </button>
                    <div style={{ padding: "6px 14px", textAlign: "center", border: `1px solid ${selectedStock.score >= 75 ? G : selectedStock.score >= 50 ? A : DIM}`, borderRadius: 10 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 24, lineHeight: 1, color: selectedStock.score >= 75 ? G : selectedStock.score >= 50 ? A : DIM }}>
                        {selectedStock.score}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "#ffffff", marginTop: 2 }}>SIGNAL</div>
                    </div>

                    {/* Factor Breakdown Popover */}
                    {calcOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 8px)",
                          zIndex: 60,
                          width: 320,
                          padding: 16,
                          borderRadius: 12,
                          background: BG_CARD,
                          border: `1px solid ${BORDER_DARK}`,
                          boxShadow: "0 18px 48px rgba(0,0,0,.8)",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>Signal Score Breakdown</div>
                        <div style={{ fontSize: 12, color: "#ffffff", marginBottom: 12 }}>Five factors weighted into a 0–100 institutional credibility score:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {FACTORS.map(([factorName, maxPts, desc], fIdx) => {
                            const pts = selectedStock.comp[fIdx];
                            return (
                              <div key={factorName}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                  <span style={{ fontWeight: 600, color: "#ffffff" }}>{factorName}</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: G }}>{pts}/{maxPts}</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: "#1f2523", overflow: "hidden", marginBottom: 3 }}>
                                  <div style={{ height: 4, width: `${(pts / maxPts) * 100}%`, background: G }} />
                                </div>
                                <div style={{ fontSize: 11, color: "#ffffff" }}>{desc}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Holdings / Watchlist Banner */}
                {(selectedStock.held || selectedStock.watched) && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: G }}>
                    <span>●</span>
                    <span>{selectedStock.held ? "You hold this position in your portfolio" : "This stock is in your active watchlist"}</span>
                  </div>
                )}

                {/* 3-Col Key Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${BORDER_DARK}`, borderRadius: 10 }}>
                  <div style={{ padding: "10px 12px", borderRight: `1px solid ${BORDER_DARK}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#ffffff" }}>RATING</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: "#ffffff" }}>{selectedStock.to}</div>
                  </div>
                  <div style={{ padding: "10px 12px", borderRight: `1px solid ${BORDER_DARK}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#ffffff" }}>TARGET</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: "#ffffff" }}>
                      {fmtMoney(selectedStock.pt1)}
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#ffffff" }}>IMPLIED UPSIDE</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: selectedStock.upPct && selectedStock.upPct >= 0 ? G : R }}>
                      {selectedStock.upPct != null ? `${selectedStock.upPct >= 0 ? "+" : ""}${selectedStock.upPct.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>

                {/* WHERE THIS TARGET SITS - Visual Slider (Task 12: Text white and clearly readable) */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "#ffffff", marginBottom: 8 }}>WHERE THIS TARGET SITS</div>
                  <div style={{ position: "relative", height: 86, margin: "0 18px" }}>
                    {/* Horizontal rail */}
                    <div style={{ position: "absolute", left: 0, right: 0, top: 40, height: 2, background: BORDER_DARK }} />
                    {/* Connection colored band */}
                    <div style={{ position: "absolute", top: 40, height: 2, left: sliderCalc.bandL, width: sliderCalc.bandW, background: selectedStock.dir >= 0 ? G : R, opacity: 0.6 }} />

                    {/* Street ticks */}
                    {sliderCalc.ticks.map((t, idx) => (
                      <div key={idx} style={{ position: "absolute", top: 34, left: t.left, width: 2, height: 14, background: "#ffffff" }} />
                    ))}

                    {/* Current Price Marker */}
                    <div style={{ position: "absolute", top: 48, left: `${sliderCalc.pL}%`, transform: "translateX(-50%)", textAlign: "center", fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", color: "#ffffff" }}>
                      <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "6px solid #ffffff", margin: "0 auto 2px" }} />
                      {fmtMoneyCompact(selectedStock.px)}
                    </div>

                    {/* New Target Pin */}
                    <div
                      style={{
                        position: "absolute",
                        top: 32,
                        left: `${sliderCalc.nL}%`,
                        transform: "translateX(-50%)",
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `3px solid ${selectedStock.dir >= 0 ? G : R}`,
                        background: BG_SURFACE,
                        boxShadow: `0 0 0 4px ${selectedStock.dir >= 0 ? "rgba(74,222,128,.15)" : "rgba(248,113,113,.15)"}`,
                      }}
                    />
                    <div style={{ position: "absolute", top: 10, left: `${sliderCalc.nL}%`, transform: "translateX(-50%)", fontSize: 12.5, fontWeight: 700, color: selectedStock.dir >= 0 ? G : R, whiteSpace: "nowrap" }}>
                      New {fmtMoneyCompact(selectedStock.pt1)}
                    </div>

                    {/* Min / Max bounds */}
                    <div style={{ position: "absolute", top: 68, left: -10, fontSize: 12, color: "#ffffff", fontFamily: "'JetBrains Mono', monospace" }}>${sliderCalc.lo}</div>
                    <div style={{ position: "absolute", top: 68, right: -10, fontSize: 12, color: "#ffffff", fontFamily: "'JetBrains Mono', monospace" }}>${sliderCalc.hi}</div>
                  </div>
                </div>

                {/* WHY IT MATTERS */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: G, marginBottom: 8 }}>WHY IT MATTERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedStock.why.map((bullet, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, fontSize: 14, lineHeight: 1.45, color: "#ffffff" }}>
                        <span style={{ color: selectedStock.dir >= 0 ? G : R }}>•</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Every analyst action on this stock, newest first by default; Date sorts. */}
                <div>
                  <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 10, background: "#0d100f", overflowX: "auto" }}>
                    <div style={{ minWidth: 640 }}>
                      <div style={{ display: "grid", gridTemplateColumns: STOCK_CALL_COLS, gap: 12, padding: "10px 14px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#ffffff" }}>
                        <span
                          role="button"
                          onClick={() => setStockCallDir(d => (d === -1 ? 1 : -1))}
                          title="Sort by date"
                          style={{ cursor: "pointer", userSelect: "none", color: G, whiteSpace: "nowrap" }}
                        >
                          Date {stockCallDir === -1 ? "▼" : "▲"}
                        </span>
                        <span>Firm</span>
                        <span>Action</span>
                        <span>Rating</span>
                        <span>Price Target</span>
                      </div>
                      <div style={{ maxHeight: 320, overflowY: "auto" }}>
                        {stockCalls.length === 0 && (
                          <div style={{ padding: "14px", fontSize: 12.5, color: TEXT_MUTED }}>
                            {stockHistoryLoading ? "Loading analyst history…" : "No analyst actions on record."}
                          </div>
                        )}
                        {stockCalls.map((r) => (
                          <div
                            key={r.key}
                            style={{ display: "grid", gridTemplateColumns: STOCK_CALL_COLS, gap: 12, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #161a18", fontSize: 12.5 }}
                          >
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#ffffff", whiteSpace: "nowrap" }}>
                              {formatUsDate(r.date)}
                            </span>
                            <span
                              onClick={() => handleGoToFirm(r.firm)}
                              title={r.firm}
                              style={{ fontWeight: 700, color: "#ffffff", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(74,222,128,.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                            >
                              {r.firm}
                            </span>
                            <span style={{ fontWeight: 700, color: r.dir > 0 ? G : r.dir < 0 ? R : "#ffffff", whiteSpace: "nowrap" }}>
                              {r.dir > 0 ? "▲ " : r.dir < 0 ? "▼ " : ""}{r.act}
                            </span>
                            <span style={{ color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {r.from && r.from !== "—" && r.from !== r.to ? (
                                <span>{r.from} → <b>{r.to}</b></span>
                              ) : (
                                <b>{r.to}</b>
                              )}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap" }}>
                              <PtValue pt={r.pt} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {stockCalls.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: TEXT_MUTED }}>{stockCalls.length} actions on record</div>
                  )}
                </div>

                {/* Action Buttons (Task 11: Alert me merged into Follow) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: "auto", paddingTop: 8 }}>
                  <button
                    onClick={e => handleToggleStar(e, selectedStock.t)}
                    style={{
                      padding: "10px 8px",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      border: `1px solid ${selectedStock.watched ? G : BORDER_DARK}`,
                      borderRadius: 8,
                      background: selectedStock.watched ? "rgba(74,222,128,.14)" : "transparent",
                      color: selectedStock.watched ? G : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    {selectedStock.watched ? "✓ Following (Alerts On)" : "+ Follow Stock"}
                  </button>

                  <button
                    onClick={() => openStockFull(selectedStock.t)}
                    style={{
                      padding: "10px 8px",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      border: "1px solid #5a80a8",
                      borderRadius: 8,
                      background: "#5a80a8",
                      color: "#ffffff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Stock Intelligence ↗
                  </button>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: TOP FIRMS RANKING & TRACK RECORD                             */}
      {/* ==================================================================== */}
      {tab === "Top Firms" && (
        <div style={{ padding: "20px 24px 40px" }}>
          {/* Search & Sort Controls */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
            <input
              value={firmSearchQ}
              onChange={e => setFirmSearchQ(e.target.value)}
              placeholder="Search firm name…"
              style={{
                width: 260,
                padding: "8px 12px",
                borderRadius: 8,
                background: "#141816",
                border: `1px solid ${BORDER_DARK}`,
                color: TEXT_HI,
                fontSize: 13,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              {(["hit", "ret", "calls"] as FirmSortKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => {
                    if (firmSortKey === k) setFirmSortDir(d => (d === -1 ? 1 : -1));
                    else {
                      setFirmSortKey(k);
                      setFirmSortDir(-1);
                    }
                  }}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: firmSortKey === k ? 700 : 500,
                    border: 0,
                    cursor: "pointer",
                    background: firmSortKey === k ? "#1b201e" : "transparent",
                    color: firmSortKey === k ? G : TEXT_MUTED,
                  }}
                >
                  {k === "hit" ? "Hit rate" : k === "ret" ? "Avg return" : "Most active"}
                  {firmSortKey === k ? (firmSortDir === -1 ? " ▼" : " ▲") : ""}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))", gap: 24, alignItems: "stretch" }}>
            {/* Left: Firms Table */}
            <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 14, background: BG_SURFACE, overflowX: "auto", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "grid", gridTemplateColumns: "36px minmax(130px, 1.5fr) minmax(100px, 1fr) 90px 60px 80px 50px", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
                <span>#</span>
                <span>Firm</span>
                <span>Hit Rate</span>
                <span>Avg 30D</span>
                <span>Calls</span>
                <span>Bull/Bear</span>
                <span>Today</span>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {allFirms
                  .filter(f => !firmSearchQ.trim() || f.name.toLowerCase().includes(firmSearchQ.toLowerCase()))
                  .sort((a, b) => {
                    if (firmSortKey === "hit") {
                      const x = a.hit ?? -1;
                      const y = b.hit ?? -1;
                      return (x - y) * firmSortDir || (b.today - a.today);
                    }
                    if (firmSortKey === "ret") {
                      const x = a.ret ?? -999;
                      const y = b.ret ?? -999;
                      return (x - y) * firmSortDir;
                    }
                    if (firmSortKey === "calls") {
                      const x = a.calls ?? a.today ?? 0;
                      const y = b.calls ?? b.today ?? 0;
                      return (x - y) * firmSortDir;
                    }
                    return 0;
                  })
                  .map(f => {
                    const isSel = f.name === selectedFirm?.name;
                    return (
                      <div
                        key={f.name}
                        onClick={() => setSelectedFirmName(f.name)}
                        style={{
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "36px minmax(130px, 1.5fr) minmax(100px, 1fr) 90px 60px 80px 50px",
                          gap: 10,
                          alignItems: "center",
                          padding: "12px 16px",
                          borderBottom: "1px solid #161a18",
                          background: isSel ? "#141917" : "transparent",
                          boxShadow: isSel ? "inset 3px 0 0 #4ade80" : "none",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{f.rank}</span>
                        <span style={{ fontWeight: 700, color: isSel ? G : TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {f.name}
                        </span>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: f.hit == null ? DIM : f.hit >= 70 ? G : f.hit >= 55 ? A : DIM }}>{f.hitTxt}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "#1b201e", overflow: "hidden" }}>
                            <div style={{ height: 4, width: `${f.hit ?? 0}%`, background: f.hit == null ? DIM : f.hit >= 70 ? G : f.hit >= 55 ? A : DIM }} />
                          </div>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: f.ret == null ? DIM : f.ret >= 0 ? G : R }}>
                          {f.retTxt}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT_HI }}>
                          {f.calls ?? "—"}
                        </span>
                        <div style={{ display: "flex", height: 5, borderRadius: 2, overflow: "hidden", background: "#1b201e" }}>
                          {f.bull != null && (<>
                            <div style={{ width: `${f.bull}%`, background: G }} />
                            <div style={{ width: `${100 - f.bull}%`, background: R }} />
                          </>)}
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: f.today > 0 ? TEXT_HI : DIM }}>
                          {f.today}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Right: Selected Firm Profile */}
            {selectedFirm && (
              <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 14, background: BG_SURFACE, padding: 22, display: "flex", flexDirection: "column", gap: 18, height: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: TEXT_HI }}>{selectedFirm.name}</h3>
                    <div style={{ fontSize: 12, color: TEXT_MUTED }}>Wall Street Research Desk · Ranked #{selectedFirm.rank}</div>
                  </div>
                  {/* Task 11: Merged Alert me into Follow button */}
                  <button
                    onClick={() => handleToggleFollow(selectedFirm.name)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: `1px solid ${G}`,
                      background: (followedFirms[selectedFirm.name] || firmAlerts[selectedFirm.name]) ? "transparent" : G,
                      color: (followedFirms[selectedFirm.name] || firmAlerts[selectedFirm.name]) ? G : "#06120a",
                      cursor: "pointer",
                    }}
                  >
                    {(followedFirms[selectedFirm.name] || firmAlerts[selectedFirm.name]) ? "✓ Following (Alerts On)" : "+ Follow Firm"}
                  </button>
                </div>

                {/* 3 Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${BORDER_DARK}`, borderRadius: 10 }}>
                  <div style={{ padding: "10px", borderRight: `1px solid ${BORDER_DARK}` }}>
                    <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>12M TARGET HIT RATE</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: G }}>{selectedFirm.hitTxt}</div>
                  </div>
                  <div style={{ padding: "10px", borderRight: `1px solid ${BORDER_DARK}` }}>
                    <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>AVG 5D MOVE AFTER CALLS</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: selectedFirm.ret == null ? DIM : selectedFirm.ret >= 0 ? G : R }}>{selectedFirm.retTxt}</div>
                  </div>
                  <div style={{ padding: "10px" }}>
                    <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>RATING CHANGES (3Y)</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: TEXT_HI }}>{selectedFirm.calls ?? "—"}</div>
                  </div>
                </div>

                {/* Every call from this firm, newest first. */}
                <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED }}>
                      ALL CALLS{firmCalls.length ? ` (${firmCalls.length})` : ""}
                    </span>
                    <button
                      onClick={() => setFirmHistModal(selectedFirm)}
                      style={{ background: "transparent", border: 0, color: G, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
                    >
                      Call History ↗
                    </button>
                  </div>

                  <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 10, background: "#0d100f", overflowX: "auto" }}>
                    <div style={{ minWidth: 620 }}>
                      <div style={{ display: "grid", gridTemplateColumns: FIRM_CALL_COLS, gap: 12, padding: "10px 14px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
                        <span>Date</span>
                        <span>Ticker</span>
                        <span>Action</span>
                        <span>Price Target</span>
                        <span>Result</span>
                      </div>
                      <div style={{ maxHeight: 520, overflowY: "auto" }}>
                        {firmCalls.length === 0 && (
                          <div style={{ padding: 14, fontSize: 12.5, color: TEXT_MUTED }}>
                            {firmCallsLoading ? "Loading calls…" : "No calls on record for this firm."}
                          </div>
                        )}
                        {firmCalls.map((c) => (
                          <div
                            key={c.key}
                            onClick={() => {
                              const fullAct = allActions.find(a => a.t === c.t && firmKey(a.firm) === firmKey(selectedFirm.name)) ?? allActions.find(a => a.t === c.t);
                              if (fullAct) setSingleCallModal({ action: fullAct, firmCall: c });
                              else openStockFull(c.t);
                            }}
                            style={{ cursor: "pointer", display: "grid", gridTemplateColumns: FIRM_CALL_COLS, gap: 12, alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #161a18", fontSize: 12.5 }}
                          >
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED, whiteSpace: "nowrap" }}>
                              {formatUsDate(c.when)}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <StockLogo sym={c.t} size={20} />
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TEXT_HI }}>{c.t}</span>
                              {c.co && c.co !== c.t && (
                                <span style={{ fontSize: 11, color: TEXT_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.co}</span>
                              )}
                            </div>
                            <span style={{ fontWeight: 700, color: c.dir > 0 ? G : c.dir < 0 ? R : TEXT_HI, whiteSpace: "nowrap" }}>
                              {c.dir > 0 ? "▲ " : c.dir < 0 ? "▼ " : ""}{c.act}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TEXT_HI, whiteSpace: "nowrap" }}>
                              <PtValue pt={c.pt} />
                            </span>
                            <span style={{ fontWeight: 700, whiteSpace: "nowrap", color: c.tone > 0 ? G : c.tone < 0 ? R : TEXT_MUTED }}>
                              {c.res}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: ALL ACTIONS TABLE                                             */}
      {/* ==================================================================== */}
      {tab === "All Actions" && (
        <div style={{ padding: "20px 24px 40px" }}>
          {/* Filters Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 18 }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search ticker, company or firm…"
              style={{
                width: 240,
                padding: "8px 12px",
                borderRadius: 8,
                background: "#141816",
                border: `1px solid ${BORDER_DARK}`,
                color: TEXT_HI,
                fontSize: 13,
                outline: "none",
              }}
            />

            {/* Sector Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setSecDDOpen(o => !o);
                }}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: `1px solid ${sectorFilter !== "All" ? G : BORDER_DARK}`,
                  background: "#0d100f",
                  color: sectorFilter !== "All" ? G : TEXT_MUTED,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                Sector: <b style={{ color: TEXT_HI }}>{sectorFilter}</b> ▼
              </button>
              {secDDOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 50,
                    minWidth: 220,
                    maxHeight: 280,
                    overflowY: "auto",
                    padding: 6,
                    borderRadius: 10,
                    background: BG_CARD,
                    border: `1px solid ${BORDER_DARK}`,
                    boxShadow: "0 14px 36px rgba(0,0,0,.7)",
                  }}
                >
                  {SECTORS_LIST.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setSectorFilter(s);
                        setSecDDOpen(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        border: 0,
                        borderRadius: 6,
                        background: sectorFilter === s ? "#1b201e" : "transparent",
                        color: sectorFilter === s ? G : TEXT_HI,
                        fontSize: 12,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Market Cap Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setCapDDOpen(o => !o);
                }}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: `1px solid ${capFilter !== "All" ? G : BORDER_DARK}`,
                  background: "#0d100f",
                  color: capFilter !== "All" ? G : TEXT_MUTED,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                Cap: <b style={{ color: TEXT_HI }}>{capFilter}</b> ▼
              </button>
              {capDDOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 50,
                    minWidth: 160,
                    padding: 6,
                    borderRadius: 10,
                    background: BG_CARD,
                    border: `1px solid ${BORDER_DARK}`,
                    boxShadow: "0 14px 36px rgba(0,0,0,.7)",
                  }}
                >
                  {CAPS_LIST.map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        setCapFilter(c);
                        setCapDDOpen(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        border: 0,
                        borderRadius: 6,
                        background: capFilter === c ? "#1b201e" : "transparent",
                        color: capFilter === c ? G : TEXT_HI,
                        fontSize: 12,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Chips */}
            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {(["All", "My stocks", "High signal", "Upgrades", "Downgrades", "Clusters"] as FilterChip[]).map(chip => (
                <button
                  key={chip}
                  onClick={() => setFilterChip(chip)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: filterChip === chip ? 700 : 500,
                    border: 0,
                    cursor: "pointer",
                    background: filterChip === chip ? "#1b201e" : "transparent",
                    color: filterChip === chip ? G : TEXT_MUTED,
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: TEXT_MUTED }}>
              {Math.min(allActionsShown, filteredActions.length)} / {filteredActions.length}
            </span>
          </div>

          {/* Table */}
          <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 14, background: BG_SURFACE, overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(95px, .7fr) minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(100px, .8fr) minmax(140px, 1.2fr) minmax(120px, .9fr) minmax(90px, .7fr) minmax(100px, 1fr)", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
              <span onClick={() => { setSortKey("date"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                Date {sortKey === "date" ? (sortDir === -1 ? "▼" : "▲") : "↕"}
              </span>
              <span onClick={() => { setSortKey("t"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>Ticker / Company</span>
              <span onClick={() => { setSortKey("firm"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>Firm</span>
              <span onClick={() => { setSortKey("act"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>Action</span>
              <span onClick={() => { setSortKey("to"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>Previous → New</span>
              <span onClick={() => { setSortKey("pt"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ textAlign: "right", cursor: "pointer" }}>Price Target</span>
              <span onClick={() => { setSortKey("up"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ textAlign: "right", cursor: "pointer" }}>To Target</span>
              <span onClick={() => { setSortKey("score"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ textAlign: "right", cursor: "pointer" }}>Signal</span>
            </div>

            <div style={{ maxHeight: "calc(100vh - 270px)", overflowY: "auto" }}>
              {filteredActions.length === 0 ? (
                <DataState loading={consensusLoading} label="No actions found." />
              ) : (
                filteredActions.slice(0, allActionsShown).map(r => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedStockId(r.id);
                      setTab("Analyst Actions");
                    }}
                    style={{
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "minmax(95px, .7fr) minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(100px, .8fr) minmax(140px, 1.2fr) minmax(120px, .9fr) minmax(90px, .7fr) minmax(100px, 1fr)",
                      gap: 12,
                      alignItems: "center",
                      padding: "12px 18px",
                      borderBottom: "1px solid #161a18",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: TEXT_HI, whiteSpace: "nowrap" }}>
                      {formatUsDate(r.date)}
                    </span>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <StockLogo sym={r.t} size={28} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TEXT_HI }}>{r.t}</span>
                          <button
                            onClick={e => handleToggleStar(e, r.t)}
                            style={{ background: "transparent", border: 0, color: r.watched ? G : TEXT_MUTED, cursor: "pointer", padding: 0 }}
                          >
                            {r.watched ? "★" : "☆"}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: TEXT_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                          {r.co}
                        </div>
                      </div>
                    </div>

                    <span
                      onClick={e => {
                        e.stopPropagation();
                        handleGoToFirm(r.firm);
                      }}
                      style={{ color: "#d3d9d6", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(74,222,128,.3)" }}
                    >
                      {r.firm}
                    </span>

                    <span style={{ color: r.dir >= 0 ? G : R, fontWeight: 700 }}>
                      {r.dir > 0 ? "▲ " : r.dir < 0 ? "▼ " : ""}{r.act}
                    </span>

                    <span style={{ color: TEXT_MUTED }}>
                      {r.from} → <b style={{ color: TEXT_HI }}>{r.to}</b>
                    </span>

                    {r.ptSource === "firm" ? (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "right", color: TEXT_HI, fontWeight: 700 }}>
                        ${r.pt1.toFixed(2)}
                      </span>
                    ) : (
                      <span
                        title="This firm posted no target with this call; % to target uses the Street consensus"
                        style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "right", color: TEXT_HI }}
                      >
                        ${r.pt1.toFixed(2)}
                        <div style={{ fontSize: 12 }}>consensus</div>
                      </span>
                    )}

                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textAlign: "right", color: r.upPct && r.upPct >= 0 ? G : R }}>
                      {r.upPct != null ? `${r.upPct >= 0 ? "+" : ""}${r.upPct.toFixed(1)}%` : "—"}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <div style={{ width: 44, height: 4, borderRadius: 2, background: "#1b201e", overflow: "hidden" }}>
                        <div style={{ height: 4, width: `${r.score}%`, background: r.score >= 75 ? G : r.score >= 50 ? A : DIM }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: r.score >= 75 ? G : r.score >= 50 ? A : DIM }}>
                        {r.score}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {allActionsShown < filteredActions.length && (
                <div style={{ padding: "14px 18px", textAlign: "center", borderTop: `1px solid ${BORDER_DARK}`, background: "#0d100f" }}>
                  <button
                    onClick={() => setAllActionsShown(prev => prev + 50)}
                    style={{
                      padding: "8px 22px",
                      borderRadius: 8,
                      border: `1px solid ${BORDER_DARK}`,
                      background: "#161b19",
                      color: G,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all .15s ease",
                    }}
                  >
                    Show more actions ({Math.min(allActionsShown, filteredActions.length)} of {filteredActions.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: SIGNAL SCORE EXPLAINER MODAL                                */}
      {/* ==================================================================== */}
      {showSigModal && (
        <div onClick={() => setShowSigModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflowY: "auto", background: BG_CARD, border: `1px solid ${BORDER_DARK}`, borderRadius: 16, padding: 26, boxShadow: "0 24px 60px rgba(0,0,0,.8)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT_HI }}>How Signal Score Works</h3>
              <button onClick={() => setShowSigModal(false)} style={{ background: "transparent", border: 0, color: TEXT_MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5, marginTop: 0 }}>
              The 0–100 Signal Score cuts through Wall Street noise by evaluating historical analyst accuracy, multi-firm cluster confirmation, rating change magnitude, and catalyst proximity.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0" }}>
              {FACTORS.map(([title, maxPts, desc]) => (
                <div key={title} style={{ padding: 12, borderRadius: 8, background: "#0d100f", border: `1px solid ${BORDER_DARK}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: TEXT_HI, marginBottom: 4 }}>
                    <span>{title}</span>
                    <span style={{ color: G, fontFamily: "'JetBrains Mono', monospace" }}>max {maxPts} pts</span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>{desc}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${BORDER_DARK}`, paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED, marginBottom: 10 }}>SCORE TIERS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: G, width: 60 }}>75–100</span>
                  <span><b style={{ color: TEXT_HI }}>High signal.</b> Credible desk with cluster confirmation. High statistical impact on stock trajectory.</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: A, width: 60 }}>50–74</span>
                  <span><b style={{ color: TEXT_HI }}>Worth a look.</b> Valid institutional revision, but awaiting secondary confirmation.</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: DIM, width: 60 }}>0–49</span>
                  <span><b style={{ color: TEXT_HI }}>Likely noise.</b> Minor PT housekeeping or low accuracy desk.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: FIRM CALL HISTORY MODAL                                     */}
      {/* ==================================================================== */}
      {firmHistModal && (
        <div onClick={() => setFirmHistModal(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(860px, 100%)", maxHeight: "88vh", overflowY: "auto", background: BG_CARD, border: `1px solid ${BORDER_DARK}`, borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,.85)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: TEXT_HI }}>{firmHistModal.name} Call History</h3>
                <div style={{ fontSize: 12, color: TEXT_MUTED }}>Every call on record across covered stocks, newest first</div>
              </div>
              <button onClick={() => setFirmHistModal(null)} style={{ background: "transparent", border: 0, color: TEXT_MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {(["All", "Hits", "Misses", "Open"] as const).map(flt => (
                <button
                  key={flt}
                  onClick={() => setFirmHistFilter(flt)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: firmHistFilter === flt ? 700 : 500,
                    border: 0,
                    cursor: "pointer",
                    background: firmHistFilter === flt ? "#1b201e" : "transparent",
                    color: firmHistFilter === flt ? G : TEXT_MUTED,
                  }}
                >
                  {flt}
                </button>
              ))}
            </div>

            {/* Table */}
            <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 10, background: "#0d100f", overflowX: "auto" }}>
              <div style={{ minWidth: 700 }}>
                <div style={{ display: "grid", gridTemplateColumns: HIST_COLS, gap: 12, padding: "10px 14px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
                  <span>Date</span>
                  <span>Ticker</span>
                  <span>Action</span>
                  <span>At Call</span>
                  <span>Price Target</span>
                  <span>Result</span>
                </div>

                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {firmCalls
                    .filter(c => {
                      if (firmHistFilter === "Hits") return c.kind === "target" && c.tone > 0;
                      if (firmHistFilter === "Misses") return c.kind === "target" && c.tone < 0;
                      if (firmHistFilter === "Open") return c.kind === "live";
                      return true;
                    })
                    .map(c => (
                      <div
                        key={c.key}
                        style={{ display: "grid", gridTemplateColumns: HIST_COLS, gap: 12, alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #161a18", fontSize: 12 }}
                      >
                        <span style={{ color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{formatUsDate(c.when)}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TEXT_HI }}>{c.t}</span>
                        <span style={{ color: c.dir > 0 ? G : c.dir < 0 ? R : TEXT_HI, fontWeight: 600, whiteSpace: "nowrap" }}>
                          {c.dir > 0 ? "▲ " : c.dir < 0 ? "▼ " : ""}{c.act}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED, whiteSpace: "nowrap" }}>{fmtMoney(c.pxAtCall)}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TEXT_HI, fontWeight: 700, whiteSpace: "nowrap" }}>
                          <PtValue pt={c.pt} />
                        </span>
                        <span style={{ fontWeight: 700, whiteSpace: "nowrap", color: c.tone > 0 ? G : c.tone < 0 ? R : TEXT_MUTED }}>
                          {c.res}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: SINGLE CALL DETAILS MODAL                                   */}
      {/* ==================================================================== */}
      {singleCallModal && (
        <div onClick={() => setSingleCallModal(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(500px, 100%)", background: BG_CARD, border: `1px solid ${BORDER_DARK}`, borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,.85)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT_HI }}>Call Details</h3>
              <button onClick={() => setSingleCallModal(null)} style={{ background: "transparent", border: 0, color: TEXT_MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {singleCallModal.action && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StockLogo sym={singleCallModal.action.t} size={40} />
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: TEXT_HI }}>
                      {singleCallModal.action.t}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED }}>{singleCallModal.action.firm} · {singleCallModal.action.date}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: singleCallModal.action.dir >= 0 ? G : R }}>
                    {singleCallModal.action.act}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 12, borderRadius: 8, background: "#0d100f", border: `1px solid ${BORDER_DARK}` }}>
                  <div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED }}>TARGET</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: TEXT_HI }}>
                      {fmtMoney(singleCallModal.action.pt1)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED }}>CURRENT PRICE</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: TEXT_HI }}>
                      {fmtMoney(singleCallModal.action.px)}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "#d3d9d6", lineHeight: 1.5, margin: 0 }}>
                  {singleCallModal.action.headline}
                </p>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      const act = singleCallModal.action;
                      setSingleCallModal(null);
                      if (act) openStockFull(act.t);
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: 8, background: G, border: 0, color: "#06120a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Stock Intelligence ↗
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FLOATING TOAST NOTIFICATION                                          */}
      {/* ==================================================================== */}
      {toast && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 1000,
            background: "#151a18",
            border: `1px solid ${G}`,
            color: TEXT_HI,
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 14,
            boxShadow: "0 14px 36px rgba(0,0,0,.6)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: G }} />
          <span>{toast.msg}</span>
          {toast.undoAction && (
            <span
              onClick={() => {
                if (toast.undoAction) toast.undoAction();
                setToast(null);
              }}
              style={{ cursor: "pointer", color: G, fontWeight: 700, marginLeft: 6 }}
            >
              Undo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
