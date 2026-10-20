"use client";

import { useMemo, useState, useEffect, useCallback, useContext, useRef } from "react";
import { useIQActions } from "../shell";
import { DataState, StockLogo, VendorTag } from "../utils";
import { useApiList } from "../hooks/useApiList";
import { apiGet } from "../backend";
import { WatchlistsContext } from "../hooks/useWatchlists";
import type { AnalystConsensusDoc, CompanyDoc } from "../types";
import { useLiveQuotes } from "../live-quotes-context";
import { etTodayIso } from "../calendar-range";

// ============================================================================
// Types & Constants
// ============================================================================

const G = "#4ade80"; // Bullish Green
const R = "#f87171"; // Bearish Red
const A = "#fbbf24"; // Amber / Warning
const DIM = "#5f6763"; // Dim Gray
const TEXT_HI = "#e8ecea";
const TEXT_MUTED = "#8b938f";
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

/** Measured firm track record (GET /market-data/analyst-firm-stats; analyst-firm-stats job). */
interface FirmStat {
  firmKey: string;
  name: string;
  ratingChanges: number;
  avgMoveAfterCall: number | null;
  avgMoveAfterUpgrade: number | null;
  avgMoveAfterDowngrade: number | null;
  targetsResolved: number;
  hitRatePct: number | null;
  bullishPct: number | null;
  recentResolved?: Array<{ ticker: string; date: string; target: number; priceWhenPosted: number; hit: boolean }>;
}
/** "J.P. Morgan" / "JP Morgan" / "JPMorgan" → "jpmorgan" (matches the backend key). */
const firmKey = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
/** Calls within this many days count as "recent" for the header and needle list. */
const RECENT_DAYS = 7;
const BULLISH_GRADE = /buy|outperform|overweight|positive|accumulate/i;
const BEARISH_GRADE = /sell|underperform|underweight|negative|reduce/i;
const pctTxt = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);

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

type MainTab = "Analyst Actions" | "Top Firms" | "All Actions";
type FilterChip = "All" | "My stocks" | "High signal" | "Upgrades" | "Downgrades" | "Clusters";
type SortKey = "score" | "t" | "firm" | "up" | "act" | "to" | "date";
type FirmSortKey = "hit" | "ret" | "calls" | "name" | "rank";

interface ProcessedAction {
  id: string;
  t: string; // Ticker
  co: string; // Company Name
  firm: string;
  act: string; // "Upgrade", "Downgrade", "PT Raise", "PT Cut", "Initiate", "Maintain"
  dir: number; // 1 = bullish, -1 = bearish, 0 = neutral
  from: string;
  to: string;
  pt1: number; // Current firm price target
  prevPt: number | null;
  px: number; // Current price
  date: string;
  score: number; // 0-100 Signal Score
  comp: [number, number, number, number, number]; // Factor components
  cluster: number; // Number of firms acting on this ticker
  clusterFirms: string[];
  street: number[]; // All Street targets
  hit: string; // Firm's measured 12-month target hit rate, "—" when unmeasured
  move: string; // Firm's measured avg 5-day move after calls like this one, "—" when unmeasured
  headline: string;
  why: string[];
  held: boolean;
  watched: boolean;
  sector: string;
  cap: string;
  tags: string[];
  upPct: number | null; // % upside to this target
}

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
  recent: Array<{
    t: string;
    co: string;
    act: string;
    dir: number;
    when: string;
    res: string;
    pxAt: number | null;
    pxNow: number | null;
    pt: number | null;
  }>;
}

// ============================================================================
// Helpers
// ============================================================================

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

function resolveActionMeta(
  actionRaw?: string | null,
  previousGrade?: string | null,
  newGrade?: string | null,
  pt?: number | null,
  prevPt?: number | null,
) {
  const act = (actionRaw ?? "").toLowerCase().trim();
  const prev = (previousGrade ?? "").trim();
  const next = (newGrade ?? "").trim();

  let shownAction = "Maintain";
  let dir = 0;

  if (act.includes("upgrade")) {
    shownAction = "Upgrade";
    dir = 1;
  } else if (act.includes("downgrade")) {
    shownAction = "Downgrade";
    dir = -1;
  } else if (act.includes("init")) {
    shownAction = "Initiate";
    dir = BULLISH_GRADE.test(next) ? 1 : BEARISH_GRADE.test(next) ? -1 : 0;
  } else if (pt != null && prevPt != null && pt !== prevPt) {
    if (pt > prevPt) {
      shownAction = "PT Raise";
      dir = 1;
    } else {
      shownAction = "PT Cut";
      dir = -1;
    }
  } else if (BULLISH_GRADE.test(next)) {
    shownAction = "Reiterate";
    dir = 1;
  } else if (BEARISH_GRADE.test(next)) {
    shownAction = "Reiterate";
    dir = -1;
  }

  return {
    shownAction,
    dir,
    from: prev || "—",
    to: next || "—",
  };
}

function capCategory(cap?: number | null): string {
  if (cap == null || cap <= 0) return "—";
  if (cap >= 200e9) return "Mega";
  if (cap >= 10e9) return "Large";
  if (cap >= 2e9) return "Mid";
  if (cap >= 300e6) return "Small";
  return "Micro";
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
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1); // -1 = desc, 1 = asc
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

  const allActions = useMemo<ProcessedAction[]>(() => {
    const DAY = 86_400_000;
    const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
    const rows: ProcessedAction[] = [];

    liveConsensus.forEach((c, cIdx) => {
      const sym = (c.ticker || "").trim().toUpperCase();
      // Only real rating changes; a stock with none contributes no actions.
      const grades = (c.recentGrades ?? []).filter((g) => g.firm && g.date);
      if (!sym || grades.length === 0) return;
      const comp = companyMap.get(sym);
      const px = comp?.price && comp.price > 0 ? comp.price : extraQuotes.get(sym)?.price ?? null;
      if (px == null || !(px > 0)) return; // no live price yet: upside/slider cannot be computed
      const coName = comp?.name || sym;
      const sec = comp?.sector || "—";
      const cap = capCategory(comp?.marketCap);

      // Every target the Street has posted for the stock (real values only).
      const allPtValues = grades.map((g) => g.priceTarget).filter((v): v is number => v != null && v > 0);
      if (c.priceTargetConsensus) allPtValues.push(c.priceTargetConsensus);
      if (c.priceTargetHigh) allPtValues.push(c.priceTargetHigh);
      if (c.priceTargetLow) allPtValues.push(c.priceTargetLow);
      const streetTargets = [...new Set(allPtValues)].sort((a, b) => a - b);

      const metas = grades.map((g) => resolveActionMeta(g.action, g.previousGrade, g.newGrade, g.priceTarget, g.previousPriceTarget));

      grades.forEach((g, gIdx) => {
        const firmName = (g.firm as string).trim();
        const meta = metas[gIdx];
        const targetPt = g.priceTarget != null && g.priceTarget > 0 ? g.priceTarget : (c.priceTargetConsensus ?? null);
        if (targetPt == null) return; // nothing to place on the target map
        const prevPt = g.previousPriceTarget ?? null;
        const upPct = ((targetPt - px) / px) * 100;

        // Cluster: distinct firms making a same-direction call on this stock
        // within 72 hours of this one.
        const clusterFirmsList = [...new Set(
          grades
            .filter((o, oIdx) => metas[oIdx].dir === meta.dir && meta.dir !== 0 && Math.abs(dayMs(o.date as string) - dayMs(g.date as string)) <= 3 * DAY)
            .map((o) => (o.firm as string).trim()),
        )];
        const clusterCount = Math.max(1, clusterFirmsList.length);

        const stat = firmStatsByKey.get(firmKey(firmName)) ?? null;
        const hitRate = stat?.hitRatePct ?? null;
        const movePct = meta.dir > 0 ? stat?.avgMoveAfterUpgrade ?? null : meta.dir < 0 ? stat?.avgMoveAfterDowngrade ?? null : null;

        // Signal Score (0-100). Firm accuracy uses the measured hit rate; a firm
        // without enough resolved targets scores the neutral midpoint.
        const firmAccScore = hitRate != null ? Math.min(35, Math.max(12, Math.round((hitRate / 100) * 35))) : 20;
        const clusterScore = clusterCount >= 4 ? 25 : clusterCount === 3 ? 21 : clusterCount === 2 ? 15 : 7;
        const strengthScore = meta.shownAction === "Upgrade" || meta.shownAction === "Downgrade" ? 20 :
          meta.shownAction.includes("PT") ? 15 : meta.shownAction === "Initiate" ? 14 : 9;
        const movePctVal = prevPt && prevPt > 0 ? Math.abs((targetPt - prevPt) / prevPt) * 100 : Math.abs(upPct);
        const moveScore = movePctVal >= 20 ? 10 : movePctVal >= 12 ? 8 : movePctVal >= 5 ? 6 : 4;
        const isHeld = holdings.has(sym);
        const isWatched = watchedTickers.has(sym);
        const contextScore = isHeld ? 10 : isWatched ? 9 : clusterCount >= 2 ? 8 : 6;
        const totalScore = Math.min(100, Math.max(25, firmAccScore + clusterScore + strengthScore + moveScore + contextScore));
        const factorsComp: [number, number, number, number, number] = [firmAccScore, clusterScore, strengthScore, moveScore, contextScore];

        const headline = clusterCount >= 2
          ? `${clusterCount} ${meta.dir >= 0 ? "bullish" : "bearish"} calls within 72h: ${clusterFirmsList.slice(0, 3).join(", ")}${clusterFirmsList.length > 3 ? " and others" : ""}`
          : `${firmName} ${meta.shownAction.toLowerCase()}s ${sym}${meta.to !== "—" ? ` to ${meta.to}` : ""} with $${targetPt.toFixed(2)} target`;

        const whyBullets: string[] = [];
        if (isHeld) whyBullets.push(`You hold this stock in your portfolio`);
        if (isWatched) whyBullets.push(`In your watchlist`);
        if (clusterCount >= 2) whyBullets.push(`${clusterCount} firms made same-direction calls within 72 hours`);
        if (streetTargets.length >= 2 && targetPt >= streetTargets[streetTargets.length - 1]) {
          whyBullets.push(`New $${targetPt.toFixed(2)} PT is the highest on the Street`);
        } else if (streetTargets.length >= 2 && targetPt <= streetTargets[0]) {
          whyBullets.push(`New PT is the lowest on the Street`);
        } else {
          whyBullets.push(`Target is ${upPct >= 0 ? "+" : ""}${upPct.toFixed(1)}% vs current market price`);
        }
        if (hitRate != null && stat) {
          whyBullets.push(`${firmName}'s price targets were hit within 12 months ${hitRate}% of the time (${stat.targetsResolved} resolved)`);
        }

        const tags: string[] = [];
        if (isHeld) tags.push("HOLDING");
        if (isWatched) tags.push("WATCHLIST");
        if (clusterCount >= 2) tags.push(`${clusterCount}× CLUSTER`);

        rows.push({
          id: `${sym}-${firmName}-${g.date || cIdx}-${gIdx}`,
          t: sym,
          co: coName,
          firm: firmName,
          act: meta.shownAction,
          dir: meta.dir,
          from: meta.from,
          to: meta.to,
          pt1: targetPt,
          prevPt,
          px,
          date: g.date as string,
          score: totalScore,
          comp: factorsComp,
          cluster: clusterCount,
          clusterFirms: clusterFirmsList,
          street: streetTargets.length ? streetTargets : [targetPt],
          hit: hitRate != null ? `${hitRate}%` : "—",
          move: pctTxt(movePct),
          headline,
          why: whyBullets,
          held: isHeld,
          watched: isWatched,
          sector: sec,
          cap,
          tags,
          upPct,
        });
      });
    });

    return rows.sort((a, b) => b.score - a.score);
  }, [liveConsensus, companyMap, holdings, watchlistKey, extraQuotes, firmStatsByKey, watchedTickers]);

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
    const sortedSectors = Array.from(sectorNet.entries()).sort((a, b) => b[1] - a[1]);
    const topSector: [string, number] = sortedSectors[0] ?? ["—", 0];

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
      // Recent calls: this feed's calls (targets still inside their 12-month
      // window → OPEN), then the firm's latest RESOLVED targets (real HIT/MISS).
      const open = liveCalls.slice(0, 8).map((c) => ({
        t: c.t, co: c.co, act: c.act, dir: c.dir, when: c.date, res: "OPEN",
        pxAt: null, pxNow: c.px, pt: c.pt1,
      }));
      const resolved = (stat?.recentResolved ?? []).map((r) => ({
        t: r.ticker, co: r.ticker, act: "Price target", dir: r.target >= r.priceWhenPosted ? 1 : -1,
        when: r.date, res: r.hit ? "✓ HIT" : "MISS",
        pxAt: r.priceWhenPosted, pxNow: null, pt: r.target,
      }));
      list.push({
        rank: 0,
        name,
        hit: stat?.hitRatePct ?? null,
        hitTxt: stat?.hitRatePct != null ? `${stat.hitRatePct}%` : "—",
        ret: stat?.avgMoveAfterCall ?? null,
        retTxt: pctTxt(stat?.avgMoveAfterCall ?? null),
        calls: stat?.ratingChanges ?? null,
        bull: stat?.bullishPct ?? null,
        today: liveCalls.filter((c) => c.date === today).length,
        resolved: stat?.targetsResolved ?? 0,
        recent: [...open, ...resolved],
      });
    });
    // Measured firms first (by hit rate), then unmeasured by today's activity.
    list.sort((a, b) =>
      (b.hit ?? -1) - (a.hit ?? -1) || b.today - a.today || a.name.localeCompare(b.name));
    list.forEach((f, idx) => {
      f.rank = idx + 1;
    });
    return list;
  }, [allActions, firmStatsByKey]);

  const selectedFirm = useMemo(() => {
    return allFirms.find(f => f.name === selectedFirmName) || allFirms[0] || null;
  }, [allFirms, selectedFirmName]);

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

  // Follow Firm Toggle Handler
  const handleToggleFollow = (firmName: string) => {
    const wasFollowed = !!followedFirms[firmName];
    setFollowedFirms(prev => ({ ...prev, [firmName]: !wasFollowed }));
    showToast(wasFollowed ? `Unfollowed ${firmName}` : `Following ${firmName} — new calls appear in your feed`, () => {
      setFollowedFirms(prev => ({ ...prev, [firmName]: wasFollowed }));
    });
  };

  // Firm Calls Alert Toggle
  const handleToggleFirmAlerts = (firmName: string) => {
    const current = !!firmAlerts[firmName];
    setFirmAlerts(prev => ({ ...prev, [firmName]: !current }));
    showToast(current ? `Alerts off for ${firmName}` : `Alerts on: new ${firmName} calls will notify you`, () => {
      setFirmAlerts(prev => ({ ...prev, [firmName]: current }));
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
              onClick={() => setSectorFilter(summaryMetrics.topSectorName)}
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
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: TEXT_HI }}>{selectedStock.t}</span>
                        <button
                          onClick={e => handleToggleStar(e, selectedStock.t)}
                          style={{ background: "transparent", border: 0, color: selectedStock.watched ? G : TEXT_MUTED, cursor: "pointer", fontSize: 18, padding: 0 }}
                        >
                          {selectedStock.watched ? "★" : "☆"}
                        </button>
                        <span style={{ fontSize: 15, fontWeight: 700, color: selectedStock.dir >= 0 ? G : R }}>
                          {selectedStock.dir >= 0 ? "▲" : "▼"} {selectedStock.act}
                        </span>
                      </div>
                      <div style={{ fontSize: 14.5, color: TEXT_MUTED, marginTop: 2 }}>
                        {selectedStock.co} ·{" "}
                        <span
                          onClick={() => handleGoToFirm(selectedStock.firm)}
                          style={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(74,222,128,.4)", color: TEXT_HI }}
                        >
                          {selectedStock.firm}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* FIRM TRACK RECORD — between the ticker identity and the signal score */}
                  <div style={{ display: "flex", gap: 18, alignItems: "center", alignSelf: "center", flexShrink: 0 }}>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 20, lineHeight: 1.1, color: TEXT_HI }}>{selectedStock.hit}</div>
                      <div style={{ fontSize: 12, color: TEXT_MUTED, whiteSpace: "nowrap" }}>firm&apos;s calls hit target</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 20, lineHeight: 1.1, color: selectedStock.dir >= 0 ? G : R }}>{selectedStock.move}</div>
                      <div style={{ fontSize: 12, color: TEXT_MUTED, whiteSpace: "nowrap" }}>avg 5-day move after</div>
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
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED, marginTop: 2 }}>SIGNAL</div>
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 4 }}>Signal Score Breakdown</div>
                        <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>Five factors weighted into a 0–100 institutional credibility score:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {FACTORS.map(([factorName, maxPts, desc], fIdx) => {
                            const pts = selectedStock.comp[fIdx];
                            return (
                              <div key={factorName}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                  <span style={{ fontWeight: 600, color: TEXT_HI }}>{factorName}</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: G }}>{pts}/{maxPts}</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: "#1f2523", overflow: "hidden", marginBottom: 3 }}>
                                  <div style={{ height: 4, width: `${(pts / maxPts) * 100}%`, background: G }} />
                                </div>
                                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{desc}</div>
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
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>RATING</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: TEXT_HI }}>{selectedStock.to}</div>
                  </div>
                  <div style={{ padding: "10px 12px", borderRight: `1px solid ${BORDER_DARK}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>TARGET</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: TEXT_HI }}>
                      {fmtMoney(selectedStock.pt1)}
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>IMPLIED UPSIDE</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, marginTop: 2, color: selectedStock.upPct && selectedStock.upPct >= 0 ? G : R }}>
                      {selectedStock.upPct != null ? `${selectedStock.upPct >= 0 ? "+" : ""}${selectedStock.upPct.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>

                {/* WHERE THIS TARGET SITS - Visual Slider */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED, marginBottom: 8 }}>WHERE THIS TARGET SITS</div>
                  <div style={{ position: "relative", height: 86, margin: "0 18px" }}>
                    {/* Horizontal rail */}
                    <div style={{ position: "absolute", left: 0, right: 0, top: 40, height: 2, background: BORDER_DARK }} />
                    {/* Connection colored band */}
                    <div style={{ position: "absolute", top: 40, height: 2, left: sliderCalc.bandL, width: sliderCalc.bandW, background: selectedStock.dir >= 0 ? G : R, opacity: 0.6 }} />

                    {/* Street ticks */}
                    {sliderCalc.ticks.map((t, idx) => (
                      <div key={idx} style={{ position: "absolute", top: 34, left: t.left, width: 2, height: 14, background: DIM }} />
                    ))}

                    {/* Current Price Marker */}
                    <div style={{ position: "absolute", top: 48, left: `${sliderCalc.pL}%`, transform: "translateX(-50%)", textAlign: "center", fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", color: "#d3d9d6" }}>
                      <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "6px solid #e8ecea", margin: "0 auto 2px" }} />
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
                    <div style={{ position: "absolute", top: 68, left: -10, fontSize: 12, color: DIM, fontFamily: "'JetBrains Mono', monospace" }}>${sliderCalc.lo}</div>
                    <div style={{ position: "absolute", top: 68, right: -10, fontSize: 12, color: DIM, fontFamily: "'JetBrains Mono', monospace" }}>${sliderCalc.hi}</div>
                  </div>
                </div>

                {/* WHY IT MATTERS */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: G, marginBottom: 8 }}>WHY IT MATTERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedStock.why.map((bullet, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, fontSize: 14.5, lineHeight: 1.45, color: "#d3d9d6" }}>
                        <span style={{ color: selectedStock.dir >= 0 ? G : R }}>•</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* THE WHOLE STREET ON {TICKER} */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED, marginBottom: 8 }}>THE WHOLE STREET ON {selectedStock.t}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${BORDER_DARK}`, borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ padding: "8px 10px", borderRight: `1px solid ${BORDER_DARK}` }}>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>LAST</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: TEXT_HI }}>{fmtMoney(selectedStock.px)}</div>
                    </div>
                    <div style={{ padding: "8px 10px", borderRight: `1px solid ${BORDER_DARK}` }}>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>CONSENSUS</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: TEXT_HI }}>{fmtMoney(streetConsensus.cons)}</div>
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>TO CONSENSUS</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: streetConsensus.up >= 0 ? G : R }}>
                        {streetConsensus.up >= 0 ? "+" : ""}{streetConsensus.up.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Street Targets Table */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: TEXT_HI, marginBottom: 8 }}>EVERY TARGET ON THE STREET</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {streetConsensus.rows.map((r, rIdx) => (
                        <div key={rIdx} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 84px 44px 52px", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: TEXT_HI }}>
                            <span onClick={() => handleGoToFirm(r.firm)} style={{ cursor: "pointer", fontWeight: r.isSelFirm ? 800 : 700 }}>{r.firm}</span>{" "}
                            <span style={{ color: G, fontWeight: 400 }}>· {r.rating}</span>
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: TEXT_HI, textAlign: "right", whiteSpace: "nowrap" }}>{r.when}</span>
                          <div style={{ height: 5, borderRadius: 3, background: "#1b201e", overflow: "hidden" }}>
                            <div style={{ height: 5, width: r.w, background: r.c }} />
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textAlign: "right", whiteSpace: "nowrap", color: r.c }}>${Math.round(r.pt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 8-Week Consensus Drift Sparkline */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED, marginBottom: 6 }}>CONSENSUS DRIFT · 8 WEEKS</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 36 }}>
                      {streetConsensus.trend.map((b, bIdx) => (
                        <div key={bIdx} title={b.tip} style={{ flex: 1, height: b.h, borderRadius: 3, background: b.c }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: "auto", paddingTop: 8 }}>
                  <button
                    onClick={e => handleToggleAlert(e, selectedStock)}
                    style={{
                      padding: "10px 8px",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      border: `1px solid ${activeAlerts[selectedStock.id] ? G : G}`,
                      borderRadius: 8,
                      background: activeAlerts[selectedStock.id] ? G : "transparent",
                      color: activeAlerts[selectedStock.id] ? "#06120a" : G,
                      cursor: "pointer",
                    }}
                  >
                    {activeAlerts[selectedStock.id] ? "✓ Alert Set" : `Alert me if ${selectedStock.t} moves 5%`}
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

          <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 1.4fr) minmax(360px, 1fr)", gap: 24, alignItems: "stretch" }}>
            {/* Left: Firms Table */}
            <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: 14, background: BG_SURFACE, overflowX: "auto", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "grid", gridTemplateColumns: "36px minmax(130px, 1.5fr) minmax(100px, 1fr) 70px 60px 80px 50px", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
                <span>#</span>
                <span>FIRM</span>
                <span>HIT RATE</span>
                <span style={{ textAlign: "right" }}>AVG 30D</span>
                <span style={{ textAlign: "right" }}>CALLS</span>
                <span style={{ textAlign: "center" }}>BULL/BEAR</span>
                <span style={{ textAlign: "right" }}>TODAY</span>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {allFirms
                  .filter(f => !firmSearchQ.trim() || f.name.toLowerCase().includes(firmSearchQ.toLowerCase()))
                  .sort((a, b) => {
                    const x = a[firmSortKey];
                    const y = b[firmSortKey];
                    return (typeof x === "string" ? x.localeCompare(y as string) : ((x as number) - (y as number))) * firmSortDir;
                  })
                  .map(f => {
                    const isSel = f.name === selectedFirmName;
                    return (
                      <div
                        key={f.name}
                        onClick={() => setSelectedFirmName(f.name)}
                        style={{
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "36px minmax(130px, 1.5fr) minmax(100px, 1fr) 70px 60px 80px 50px",
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
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textAlign: "right", color: f.ret == null ? DIM : f.ret >= 0 ? G : R }}>
                          {f.retTxt}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "right", color: TEXT_MUTED }}>
                          {f.calls ?? "—"}
                        </span>
                        <div style={{ display: "flex", height: 5, borderRadius: 2, overflow: "hidden", background: "#1b201e" }}>
                          {f.bull != null && (<>
                            <div style={{ width: `${f.bull}%`, background: G }} />
                            <div style={{ width: `${100 - f.bull}%`, background: R }} />
                          </>)}
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textAlign: "right", color: f.today > 0 ? TEXT_HI : DIM }}>
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
                  <button
                    onClick={() => handleToggleFollow(selectedFirm.name)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: `1px solid ${G}`,
                      background: followedFirms[selectedFirm.name] ? "transparent" : G,
                      color: followedFirms[selectedFirm.name] ? G : "#06120a",
                      cursor: "pointer",
                    }}
                  >
                    {followedFirms[selectedFirm.name] ? "✓ Following" : "+ Follow"}
                  </button>
                </div>

                {/* Firm Alert Toggle */}
                <button
                  onClick={() => handleToggleFirmAlerts(selectedFirm.name)}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "left",
                    border: `1px solid ${firmAlerts[selectedFirm.name] ? G : BORDER_DARK}`,
                    background: firmAlerts[selectedFirm.name] ? "rgba(74,222,128,.12)" : "transparent",
                    color: firmAlerts[selectedFirm.name] ? G : TEXT_HI,
                    cursor: "pointer",
                  }}
                >
                  {firmAlerts[selectedFirm.name] ? "✓ Alerts On · Notify on all new calls" : "🔔 Alert me on new calls"}
                </button>

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

                {/* Recent Calls from This Firm */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: TEXT_MUTED }}>RECENT CALLS</span>
                    <button
                      onClick={() => setFirmHistModal(selectedFirm)}
                      style={{ background: "transparent", border: 0, color: G, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
                    >
                      Call History ↗
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedFirm.recent.map((c, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const fullAct = allActions.find(a => a.t === c.t);
                          setSingleCallModal({ action: fullAct || null, firmCall: c });
                        }}
                        style={{
                          cursor: "pointer",
                          padding: 10,
                          borderRadius: 8,
                          background: "#0d100f",
                          border: `1px solid ${BORDER_DARK}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StockLogo sym={c.t} size={24} />
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TEXT_HI }}>{c.t}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.dir >= 0 ? G : R }}>
                            {c.dir >= 0 ? "▲" : "▼"} {c.act}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: TEXT_MUTED }}>{c.when}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: c.res.includes("HIT") ? "rgba(74,222,128,.14)" : "#1b201e",
                              color: c.res.includes("HIT") ? G : TEXT_MUTED,
                            }}
                          >
                            {c.res}
                          </span>
                        </div>
                      </div>
                    ))}
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
            <div style={{ display: "grid", gridTemplateColumns: "minmax(95px, .7fr) minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(100px, .8fr) minmax(140px, 1.2fr) minmax(90px, .7fr) minmax(100px, 1fr)", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
              <span onClick={() => { setSortKey("date"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>DATE</span>
              <span onClick={() => { setSortKey("t"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>TICKER / COMPANY</span>
              <span onClick={() => { setSortKey("firm"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>FIRM</span>
              <span onClick={() => { setSortKey("act"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>ACTION</span>
              <span onClick={() => { setSortKey("to"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ cursor: "pointer" }}>PREVIOUS → NEW</span>
              <span onClick={() => { setSortKey("up"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ textAlign: "right", cursor: "pointer" }}>TO TARGET</span>
              <span onClick={() => { setSortKey("score"); setSortDir(d => d === -1 ? 1 : -1); }} style={{ textAlign: "right", cursor: "pointer" }}>SIGNAL</span>
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
                      gridTemplateColumns: "minmax(95px, .7fr) minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(100px, .8fr) minmax(140px, 1.2fr) minmax(90px, .7fr) minmax(100px, 1fr)",
                      gap: 12,
                      alignItems: "center",
                      padding: "12px 18px",
                      borderBottom: "1px solid #161a18",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: TEXT_MUTED, whiteSpace: "nowrap" }}>
                      {r.date ? r.date.slice(0, 10) : "—"}
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
                        <div style={{ fontSize: 11, color: TEXT_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
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
                      {r.act}
                    </span>

                    <span style={{ color: TEXT_MUTED }}>
                      {r.from} → <b style={{ color: TEXT_HI }}>{r.to}</b>
                    </span>

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
          <div onClick={e => e.stopPropagation()} style={{ width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", background: BG_CARD, border: `1px solid ${BORDER_DARK}`, borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,.85)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: TEXT_HI }}>{firmHistModal.name} Call History</h3>
                <div style={{ fontSize: 12, color: TEXT_MUTED }}>12-month track record across all covered equities</div>
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
              <div style={{ display: "grid", gridTemplateColumns: "70px minmax(80px, 1fr) minmax(90px, 1fr) 70px 70px 80px", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${BORDER_DARK}`, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: TEXT_MUTED }}>
                <span>DATE</span>
                <span>TICKER</span>
                <span>ACTION</span>
                <span style={{ textAlign: "right" }}>AT CALL</span>
                <span style={{ textAlign: "right" }}>TARGET</span>
                <span style={{ textAlign: "right" }}>RESULT</span>
              </div>

              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {firmHistModal.recent
                  .filter(c => {
                    if (firmHistFilter === "Hits") return c.res.includes("HIT");
                    if (firmHistFilter === "Open") return c.res === "OPEN";
                    if (firmHistFilter === "Misses") return !c.res.includes("HIT") && c.res !== "OPEN";
                    return true;
                  })
                  .map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "70px minmax(80px, 1fr) minmax(90px, 1fr) 70px 70px 80px",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: "1px solid #161a18",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: TEXT_MUTED }}>{c.when}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TEXT_HI }}>{c.t}</span>
                      <span style={{ color: c.dir >= 0 ? G : R, fontWeight: 600 }}>{c.act}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "right", color: TEXT_MUTED }}>{fmtMoney(c.pxAt)}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "right", color: TEXT_HI, fontWeight: 700 }}>{fmtMoney(c.pt)}</span>
                      <span style={{ textAlign: "right", fontWeight: 700, color: c.res.includes("HIT") ? G : c.res === "OPEN" ? TEXT_MUTED : R }}>
                        {c.res}
                      </span>
                    </div>
                  ))}
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
