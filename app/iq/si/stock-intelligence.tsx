"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSI } from "./si-context";
import { barsForHorizon } from "./horizon-bars";
import { TrackedTradesList, type TrackedTrade } from "./tracked-trades-list";
import { addTrade, formatSavedAt, listAllTrades, readTrades, removeTrade, writeTrades, type SavedTrade } from "./saved-trades";
import { StockItem, DetailStock, UpcomingEvent } from "./types";
import {
  POPULAR,
  EMPTY_FACTS,
  type SiFacts,
  LG,
  LG_COL,
  ORDER,
  TABS,
  UP,
  DN,
  STEEL,
  getStock,
  detail,
  fundSeries,
  thesisWeights,
  thesisRun,
  thesisTargets,
  usd,
  pct,
  pct1,
  sc,
  CATS_T,
  SHORT,
  KEYS,
  getTP,
  normW,
  smaOf,
  rsiOf,
  dailyPivots,
  getSixMonthMajorEvents,
  aboutTicker,
} from "./data";
import { summarizeNewsSentiment } from "./news-significance";
import { localCopilotAnswer } from "./copilot-local";
import { InfoTip, highlightNumbers, highlightSignedPercents } from "./read-cards";
import { weekMove } from "./week-move";
import { ConfidenceBreakdown, ConfidenceExplainer, TradeBuilderGuide } from "./trade-builder-parts";
import { fundamentalRead, overallVerdict, sentenceCase, supportResistance, technicalRead, topTargets, verdictBreakdown, verdictStatus } from "./si-reads";
import { headlineRead } from "./si-headline";
import { TechnicalTiles, PriceLadder } from "./technical-tiles";
import { SiOverview, type NavItem, type Tone } from "./si-overview";
import { SiMasthead, SiTabRail } from "./si-masthead";
import { PanelCard, MovedPanel, CouldPanel, type PanelRow } from "./overview-panels";
import { chartSpec, type ChartInput } from "./overview-charts";
import { ReadChart } from "./read-chart";
import { LeadLine, LevelsRuler, ReadTiles } from "./read-tiles";
import { bigMovesIn10, couldMove, dropForming, titleWords, weekRows, yesterdayMove, yesterdayRows, type MoveNews, type MoveRow, type MoveTone } from "./si-moves";
import { ConfidenceDialog } from "./confidence-dialog";
import { VerdictDialog } from "./verdict-dialog";
import { growthSeries, scoreRows, statusForTone } from "./overview-model";
import { SI_TOKENS_CSS, SI_TYPE_CSS } from "./si-redesign-css";
import { analystTargetList, epsGrowths, grossMargins, mean, operatingMargins, peerAverage, peerStats, revenueGrowths, type FactQuarter } from "./facts-4q";
import { useTickerSearch } from "../hooks/useTickerSearch";
import { BarInterval } from "../candle-chart";
import { StockChart } from "../stock-panel";
import { buildChartEarnings, type ChartEarnings } from "../chart-earnings";
import { nextEarningsDate, withOneUpcomingReport } from "../next-earnings";
import { useIntervalBars, useBackendBars } from "../hooks/useBackendBars";
import { useLiveQuotes } from "../live-quotes-context";
import { useLiveTick } from "../hooks/useLiveTick";
import { etTodayIso, fmtMarketDate, next13fDeadline, nextFomcDecision, nextMonthlyOpex, previous13fDeadline, previousFomcDecision, previousMonthlyOpex, upcomingPoliticalEvents } from "../calendar-range";
import { StockLogo } from "../utils";
import { resolveActionMeta } from "../analyst-actions-engine";
import { useHeadlineQuote } from "../quote-headline";
import { range52 } from "../range52";
import { forwardAnnualEstimates } from "../eps-sales-data";
import { ModuleSwitcher } from "../module-switcher";
import { useApiResource } from "../hooks/useApiResource";
import { useTickerNews } from "../hooks/useTickerNews";
import { useApiList } from "../hooks/useApiList";
import { apiGet, apiPost } from "../backend";
import type {
  CompanyDoc,
  FinancialsDoc,
  QuarterFinancials,
  AnalystConsensusDoc,
  AnalystRatingChange,
  InsiderTxDoc,
  NewsArticleDoc,
  LiveEarningsDoc,
  AiAnalysisDoc,
} from "../types";
import { computeTtmFcf, computeQuarterFcf, computeOperatingIncomeSeries, gaapQuarterEps, surprisePct, quarterEpsSurprisePct } from "../types";
import { useIQActions } from "../shell";
import { useWatchlistsContext } from "../hooks/useWatchlists";
import type { Stock13FResponse } from "../stock-13f-view";
import { useEntitlements } from "../hooks/useEntitlements";
import { LockedFeature } from "../entitlement-gate";
import { ProfileMenu } from "../profile-menu";
import { MarketClockBadge } from "../market-clock-badge";

/** Upcoming Catalysts timeline: how many days ahead an event may be and still show. */
const CATALYST_WINDOW_DAYS = 45;
/** ...and how many days back an event that already happened stays on the timeline. */
const CATALYST_LOOKBACK_DAYS = 14;
/** At most this many past events are shown, the most recent ones, so they never crowd out what is ahead. */
const CATALYST_MAX_PAST = 3;
/** The stock's own major moves (big price days with their cause) stay on the timeline this long. */
const CATALYST_MAJOR_LOOKBACK_DAYS = 30;
/**
 * Hand edits to the stock's own recent events on the catalyst timeline, keyed "TICKER|YYYY-MM-DD".
 * The wording comes from news headlines, so a long or vague one can be hidden or given a short title here.
 * Only the timeline is affected; the "Why it moved" chart pins keep their own text.
 */
const CATALYST_EVENT_EDITS: Record<string, { hide?: boolean; title?: string }> = {
  "NVDA|2026-11-05": { hide: true }, // "Why Nvidia Stock Is Getting Punished Today"
  "NVDA|2026-11-10": { title: "CEO Scandal" }, // "Nvidia Stock Plunges 5.5% as CEO Scandal Overshadows Its Up…"
};

/** How each Fundamentals scorecard grade is worked out (shown by its "i" button). */
const SCORECARD_INFO: Record<string, [string, string][]> = {
  GROWTH: [
    ["Measure:", "Latest quarter's revenue vs the same quarter a year ago."],
    ["Strong:", "+15% or more."],
    ["Steady:", "+3% to +15%."],
    ["Flat:", "-3% to +3%."],
    ["Weak:", "below -3%."],
  ],
  PROFITABILITY: [
    ["Measure:", "Latest quarter's operating margin (operating income / revenue). The y/y change is shown beside it."],
    ["Strong:", "20% or more."],
    ["Solid:", "10% to 20%."],
    ["Thin:", "0% to 10%."],
    ["Losing money:", "below 0%."],
  ],
  "FINANCIAL HEALTH": [
    ["Measure:", "Net debt = total debt minus cash, with the current ratio and debt / equity as checks."],
    ["Strong:", "more cash than debt."],
    ["Weak:", "net debt, and current ratio under 1\u00D7 or debt / equity over 2\u00D7."],
    ["Mixed:", "net debt otherwise."],
  ],
  VALUATION: [
    ["Measure:", "Live P/E against a sector reference (38\u00D7 for semiconductors, 22\u00D7 otherwise)."],
    ["Attractive:", "at least 5% below the reference."],
    ["Fair:", "up to 30% above it."],
    ["Stretched:", "more than 30% above it."],
  ],
};

export function StockIntelligenceScreen() {
  const { data: ent } = useEntitlements();
  const isUnsubscribed = ent?.subscriptionsEnabled === true && !ent?.staff && (ent?.planId === "none" || ent?.planId === "free");
  const { theme, setTheme } = useIQActions();
  const isLight = theme === "light";
  // The shell's setTheme persists to localStorage + backend, keeping MC in sync.
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const router = useRouter();
  const { siTicker, setSiTicker, activeTab, setActiveTab, goToSearch } = useSI();

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchResults = useTickerSearch(searchQuery);

  // Technicals chart candle interval (matches MC Overview & StockChart)
  const [barInterval, setBarInterval] = useState<BarInterval>("1D");

  // Active stock — the URL (?sym=) is the single source of truth on /si, so
  // /si is always the home view and /si?sym=X is always that stock. Reading it
  // through useSearchParams keeps it correct on the first render after a
  // router.push and on back/forward, with no stale copy to fall out of sync.
  const searchParams = useSearchParams();
  const currentTicker = searchParams?.get("sym")?.toUpperCase().trim() || null;

  // Mirror it into the SI context so the switcher knows which stock to carry
  // back to Market Catalyst.
  useEffect(() => {
    setSiTicker(currentTicker);
  }, [currentTicker, setSiTicker]);

  // Live price stream via SSE + /live/quotes polling fallback (identical to MC StockScreen)
  const live = useLiveTick(currentTicker || "");
  const liveQuotesMap = useLiveQuotes(currentTicker ? [currentTicker] : []);
  // Landing-page chips: live change for each popular ticker (no stored prices).
  const popularQuotes = useLiveQuotes(ORDER);
  const sharedQuote = currentTicker ? liveQuotesMap.get(currentTicker) : undefined;

  // Live vendor & MC backend data
  const { data: liveCompany, loading: liveCompanyLoading } = useApiResource<CompanyDoc>(
    currentTicker ? `/live/company?ticker=${encodeURIComponent(currentTicker)}` : null,
    30000
  );
  const { data: financialsDoc, loading: financialsLoading, error: financialsError } = useApiResource<FinancialsDoc>(
    currentTicker ? `/live/financials?ticker=${encodeURIComponent(currentTicker)}` : null
  );
  // First load = stored history; every 30 s after, only new/changed articles (?since=).
  const { data: tickerNews } = useTickerNews(currentTicker || null, 30000);
  // Scoped to this ticker: FMP on demand, so any stock has its own consensus
  // and full insider history (not just tickers a nightly sweep covered).
  const { data: liveConsensusList } = useApiList<AnalystConsensusDoc>(
    currentTicker ? `/market-data/analyst-actions?ticker=${encodeURIComponent(currentTicker)}` : null,
  );
  const { data: liveAnalystHistory } = useApiList<AnalystRatingChange>(
    currentTicker ? `/market-data/analyst-history?ticker=${encodeURIComponent(currentTicker)}` : null,
  );
  const { data: liveInsiderList } = useApiList<InsiderTxDoc>(
    currentTicker ? `/market-data/insider-transactions?ticker=${encodeURIComponent(currentTicker)}` : null,
  );
  const { data: liveEarningsList } = useApiList<LiveEarningsDoc>("/market-data/earnings");
  const { data: companiesList, loading: companiesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: aiAnalysisDoc } = useApiResource<AiAnalysisDoc>(
    currentTicker ? `/live/ai-analysis?ticker=${encodeURIComponent(currentTicker)}` : null,
    // Re-check: a slow model outlives the request timeout; the backend still
    // finishes and caches the synthesis for the next poll.
    30_000,
  );

  const [pendingPeerOpen, setPendingPeerOpen] = useState<{ ticker: string; name?: string } | null>(null);
  // The "how MC Confidence is calculated" dialog, opened from the Overview ring and score rows.
  const [confOpen, setConfOpen] = useState(false);
  const [verdictOpen, setVerdictOpen] = useState(false);

  // Form 13F Institutional Holdings (FMP)
  const [inst13FData, setInst13FData] = useState<Stock13FResponse | null>(null);
  useEffect(() => {
    if (!currentTicker) return;
    let cancelled = false;
    apiGet<Stock13FResponse>(`/live/13f-filings?ticker=${encodeURIComponent(currentTicker)}`)
      .then((res) => {
        if (!cancelled) setInst13FData(res);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [currentTicker]);

  // Live technical bars for the Technicals tab (matches MC Overview)
  const { bars: realBars, asOf: barsAsOf, loading: barsLoading } = useIntervalBars(
    currentTicker || "", // no stock picked (SI home) → no request
    barInterval
  );

  // 6-Month bars for Why It Moved tab (matches stock function 6M area chart)
  const { bars: sixMonthBars, loading: sixMonthLoading } = useBackendBars(
    currentTicker || "", // no stock picked (SI home) → no request
    "6M"
  );

  // 1-Year daily bars for chart key moments & context (matching MC stock function)
  const { bars: yearBars } = useBackendBars(
    currentTicker || "", // no stock picked (SI home) → no request
    "1Y"
  );

  // Chart earnings with EPS estimate/actual beat/miss markers (matching MC stock function)
  const chartEarnings: ChartEarnings[] = useMemo(() => {
    const sym = currentTicker || "";
    const symEvents = (liveEarningsList ?? []).filter((e) => e.ticker === sym);
    return buildChartEarnings(financialsDoc, symEvents, etTodayIso());
  }, [financialsDoc, liveEarningsList, currentTicker]);

  // Real-time price and change from live tick, quotes context, or backend company resource
  // Same headline rule as the stock page (useHeadlineQuote): outside regular
  // hours the price is the last REGULAR close with that session's change; the
  // extended-hours move is separate. Taking the after-hours trade with a % that
  // still included the regular session mixed the two (E2E Oct 23: BAC −0.90%
  // vs −0.79%, EPM, GE, JACK).
  const headline = useHeadlineQuote(currentTicker || "", live, {
    price: liveCompany?.price ?? null,
    pctChange: liveCompany?.pctChange ?? null,
  });
  const currentPrice = (headline.regPrice > 0 ? headline.regPrice : null) ?? live.tick?.price ?? sharedQuote?.price ?? liveCompany?.price ?? undefined;
  const currentChange = (headline.regPrice > 0 ? headline.regPct : null) ?? live.pct ?? sharedQuote?.pctChange ?? liveCompany?.pctChange ?? undefined;

  // The top five company peers the scores are measured against: their reported quarters (one financials request
  // each) and their P/E (one summary request for all five). With fewer than three peers that have data there
  // is no peer average, and the "vs peers" rows and the four-quarter averages are left out.
  const scoringPeers = useMemo(
    () =>
      (liveCompany?.peers ?? [])
        .map((t) => (t ?? "").toUpperCase().trim())
        .filter((t) => t && t !== (currentTicker ?? "").toUpperCase())
        .slice(0, 5),
    [liveCompany?.peers, currentTicker],
  );
  const scoringPeersKey = scoringPeers.join(",");
  // The daily bars without the one still forming today, and how the peers and the two market indexes move today:
  // the Overview's "Why it moved" and "Why it could move" panels read them.
  const moveBars = useMemo(() => dropForming(sixMonthBars, etTodayIso()), [sixMonthBars]);
  const moveTickers = useMemo(() => [...scoringPeers, "QQQ", "SPY"], [scoringPeers]);
  const moveQuotes = useLiveQuotes(moveTickers);
  const [peerQuarters, setPeerQuarters] = useState<Record<string, FactQuarter[]>>({});
  const [peerPes, setPeerPes] = useState<Record<string, number | null>>({});
  const [peerFwdPes, setPeerFwdPes] = useState<Record<string, number | null>>({});
  useEffect(() => {
    setPeerQuarters({});
    if (!scoringPeersKey) return;
    let live = true;
    for (const t of scoringPeersKey.split(",")) {
      apiGet<{ quarters?: FactQuarter[] }>(`/live/financials?ticker=${encodeURIComponent(t)}`)
        .then((b) => {
          if (live && Array.isArray(b?.quarters)) setPeerQuarters((prev) => ({ ...prev, [t]: b.quarters as FactQuarter[] }));
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [scoringPeersKey]);
  useEffect(() => {
    setPeerPes({});
    setPeerFwdPes({});
    if (!scoringPeersKey) return;
    let live = true;
    apiGet<Array<{ ticker: string; peRatio?: number | null; forwardPe?: number | null }>>(`/live/peers-summary?tickers=${encodeURIComponent(scoringPeersKey)}`)
      .then((rows) => {
        if (!live || !Array.isArray(rows)) return;
        const pick = (field: "peRatio" | "forwardPe") =>
          Object.fromEntries(rows.map((r) => [String(r.ticker).toUpperCase(), typeof r[field] === "number" && (r[field] as number) > 0 ? (r[field] as number) : null]));
        setPeerPes(pick("peRatio"));
        setPeerFwdPes(pick("forwardPe"));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [scoringPeersKey]);
  const peerGrowth = useMemo(() => peerStats(peerQuarters), [peerQuarters]);
  const peerPeAvg = useMemo(() => peerAverage(peerPes), [peerPes]);
  const peerFwdPeAvg = useMemo(() => peerAverage(peerFwdPes), [peerFwdPes]);

  // Every input the Stock Intelligence engine reasons from — all real data
  // loaded above. Missing inputs stay null; the engine drops what needs them.
  const siFacts: SiFacts = useMemo(() => {
    if (!currentTicker) return EMPTY_FACTS;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const qs = [...(financialsDoc?.quarters ?? [])]
      .filter((q) => q.endDate)
      .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
    const latest = qs[0];
    const yearAgo = latest
      ? qs.find((q) => q.fiscalPeriod === latest.fiscalPeriod && Number(q.fiscalYear) === Number(latest.fiscalYear) - 1) ?? qs[4]
      : undefined;
    const margin = (q: typeof latest | undefined, field: "grossProfit" | "operatingIncome") =>
      q && q.revenue && q[field] != null ? ((q[field] as number) / q.revenue) * 100 : null;
    const last4 = qs.slice(0, 4).filter((q) => q.epsActualReported != null && q.epsEstimateReported != null);
    // The fiscal year in progress is the first after the last REPORTED year,
    // matched on period end dates (see forwardAnnualEstimates — label
    // comparison put January year-ends one year behind).
    const est = forwardAnnualEstimates(financialsDoc);
    const curEst = est[0]?.epsEstimate != null ? est[0] : null;
    const nextEst = curEst ? est.find((e) => Number(e.fiscalYear) === Number(curEst.fiscalYear) + 1 && e.epsEstimate != null) ?? null : null;
    const cons = (Array.isArray(liveConsensusList) ? liveConsensusList : []).find((c) => c.ticker === currentTicker) ?? null;
    // Windows anchored on today's ET date (render-pure, no clock read).
    const todayMs = Date.parse(`${etTodayIso()}T00:00:00Z`);
    const since90 = todayMs - 90 * 86_400_000;
    const grades90 = (cons?.recentGrades ?? []).filter((g) => g.date && Date.parse(g.date) >= since90);
    const insider90 = (Array.isArray(liveInsiderList) ? liveInsiderList : []).filter(
      (x) => (x.transactionCode === "P" || x.transactionCode === "S") && x.pricePerShare && Date.parse(x.transactionDate) >= since90,
    );
    const insiderNet = insider90.reduce((a, x) => a + (x.transactionCode === "P" ? 1 : -1) * x.shares * (x.pricePerShare ?? 0), 0);
    const news7 = (Array.isArray(tickerNews) ? tickerNews : []).filter((n) => n.publishedAt && Date.parse(n.publishedAt) >= todayMs - 7 * 86_400_000);
    // Impact-weighted mood of the stock's own news (not a raw count of vendor tags).
    const newsSent = summarizeNewsSentiment(news7, {
      ticker: currentTicker,
      name: liveCompany?.name,
      bars: sixMonthBars,
      isAbout: (x) => aboutTicker(x, currentTicker, liveCompany?.name),
    });
    // Next report on or after today: the stored date when it is still ahead,
    // else the earnings calendar (a stored date can be a report already made).
    const todayIso = etTodayIso();
    const erDate = nextEarningsDate(
      liveCompany?.nextEarningsDate,
      (Array.isArray(liveEarningsList) ? liveEarningsList : []).filter((e) => e.ticker === currentTicker),
      todayIso,
    );
    const erDays = erDate ? Math.round((Date.parse(erDate + "T00:00:00Z") - todayMs) / 86_400_000) : null;
    // Key levels from the company record, else from the last completed daily bar.
    const etHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(new Date())) % 24;
    const pivots = liveCompany?.keyLevels?.daily ?? dailyPivots(yearBars ?? [], todayIso, etHour);
    const isBank = /bank|savings|thrift|financial/i.test(liveCompany?.industry ?? "") || /financial/i.test(liveCompany?.sector ?? "");
    const isUtilityOrSame = latest?.grossProfit != null && latest?.operatingIncome != null && latest.grossProfit === latest.operatingIncome;
    const suppressGross = isBank || isUtilityOrSame;
    const dailyCloses = (yearBars ?? []).map((b) => b.c).filter((c) => Number.isFinite(c));
    return {
      price: num(currentPrice),
      changePct: num(currentChange),
      sector: liveCompany?.sector ?? null,
      revGrowthYoY: latest?.revenue != null && yearAgo?.revenue ? ((latest.revenue - yearAgo.revenue) / Math.abs(yearAgo.revenue)) * 100 : null,
      grossMargin: suppressGross ? null : margin(latest, "grossProfit"),
      opMargin: margin(latest, "operatingIncome"),
      opMarginYearAgo: margin(yearAgo, "operatingIncome"),
      epsBeats: last4.length ? last4.filter((q) => (q.epsActualReported as number) >= (q.epsEstimateReported as number)).length : null,
      epsReports: last4.length || null,
      fwdEps: curEst?.epsEstimate ?? null,
      nextFyEps: nextEst?.epsEstimate ?? null,
      trailingPe: num(liveCompany?.peRatio),
      consensus: cons?.consensus ?? null,
      buyCount: cons ? cons.strongBuy + cons.buy : null,
      holdCount: cons ? cons.hold : null,
      sellCount: cons ? cons.sell + cons.strongSell : null,
      targetMean: num(cons?.priceTargetConsensus),
      upgrades90: cons ? grades90.filter((g) => /upgrade/i.test(g.action ?? "")).length : null,
      downgrades90: cons ? grades90.filter((g) => /downgrade/i.test(g.action ?? "")).length : null,
      // Same label the Analyst Actions tab shows: target cut, rating unchanged.
      ptCuts90: cons
        ? grades90.filter((g) => resolveActionMeta(g.action, g.previousGrade, g.newGrade, g.priceTarget, g.previousPriceTarget, g.priceTargetChange).shownAction === "PT Cut").length
        : null,
      // The backend stores only the 50/200; the short-term pair comes from the
      // same daily closes the chart draws.
      sma9: smaOf(dailyCloses, 9),
      sma21: smaOf(dailyCloses, 21),
      sma50: num(liveCompany?.sma50),
      sma200: num(liveCompany?.sma200),
      rsi14: num(liveCompany?.rsi14) ?? rsiOf(dailyCloses, 14),
      rvol: num(liveCompany?.rvol),
      rsRating: num(liveCompany?.rsRating),
      pctFromHigh52: num(liveCompany?.pctFromHigh52),
      beta: num(liveCompany?.beta),
      realizedVol30: num(liveCompany?.realizedVol30),
      pivotR1: num(pivots?.r1),
      pivotR2: num(pivots?.r2),
      pivotS1: num(pivots?.s1),
      pivotS2: num(pivots?.s2),
      sectorRank: num(liveCompany?.sectorRank),
      sectorRankTotal: num(liveCompany?.sectorRankTotal),
      instOwnershipPct: num(liveCompany?.instOwnershipPct),
      instHoldersChange: num(liveCompany?.inst13FHoldersChange),
      instSharesChange: num(liveCompany?.inst13FSharesChange),
      instPutCallRatio: num(liveCompany?.instPutCallRatio),
      insiderNet90: insider90.length ? insiderNet : null,
      daysToEarnings: erDays != null && erDays >= 0 ? erDays : null,
      newsPos: newsSent.total ? newsSent.pos : null,
      newsNeg: newsSent.total ? newsSent.neg : null,
      newsHighPos: newsSent.total ? newsSent.highPos : null,
      newsHighNeg: newsSent.total ? newsSent.highNeg : null,
      newsWPos: newsSent.total ? newsSent.wPos : null,
      newsWNeg: newsSent.total ? newsSent.wNeg : null,
      analystTargets: cons ? analystTargetList(cons.recentGrades) : null,
      // Four-quarter averages, and the same over the peers, only once the peers are known.
      revGrowth4q: peerGrowth ? mean(revenueGrowths(qs)) : null,
      epsGrowth4q: peerGrowth ? mean(epsGrowths(qs)) : null,
      opMargin4q: peerGrowth ? mean(operatingMargins(qs)) : null,
      grossMargin4q: peerGrowth && !suppressGross ? mean(grossMargins(qs)) : null,
      peerRevGrowth4q: peerGrowth?.revGrowth ?? null,
      peerEpsGrowth4q: peerGrowth?.epsGrowth ?? null,
      peerOpMargin4q: peerGrowth?.opMargin ?? null,
      peerGrossMargin4q: peerGrowth && !suppressGross ? peerGrowth.grossMargin : null,
      peerTickers: peerGrowth?.tickers ?? null,
      peerPe: peerPeAvg?.avg ?? null,
      peerPeCount: peerPeAvg?.n ?? null,
      peerFwdPe: peerFwdPeAvg?.avg ?? null,
      peerFwdPeCount: peerFwdPeAvg?.n ?? null,
    };
  }, [currentTicker, currentPrice, currentChange, liveCompany, financialsDoc, liveConsensusList, liveInsiderList, tickerNews, liveEarningsList, yearBars, sixMonthBars, peerGrowth, peerPeAvg, peerFwdPeAvg]);

  const stock: StockItem | null = useMemo(() => {
    if (!currentTicker) return null;
    return getStock(currentTicker, {
      price: currentPrice,
      change: currentChange,
      name: liveCompany?.name ?? undefined,
      sector: liveCompany?.sector ?? undefined,
      mcap: liveCompany?.marketCap ?? undefined,
      pe: liveCompany?.peRatio ?? undefined,
      hi: liveCompany?.high52 ?? undefined,
      lo: liveCompany?.low52 ?? undefined,
    }, false, siFacts);
  }, [currentTicker, currentPrice, currentChange, liveCompany, siFacts]);

  const stockDetail: DetailStock | null = useMemo(() => {
    if (!currentTicker) return null;
    return detail(currentTicker, {
      price: currentPrice,
      change: currentChange,
      name: liveCompany?.name ?? undefined,
      sector: liveCompany?.sector ?? undefined,
      mcap: liveCompany?.marketCap ?? undefined,
      pe: liveCompany?.peRatio ?? undefined,
      hi: liveCompany?.high52 ?? undefined,
      lo: liveCompany?.low52 ?? undefined,
      beta: liveCompany?.beta ?? undefined,
      rvol: liveCompany?.rvol ?? undefined,
      avgVolume20: liveCompany?.avgVolume20 ?? undefined,
      volume: liveCompany?.avgVolume20 != null && liveCompany?.rvol != null ? liveCompany.avgVolume20 * liveCompany.rvol : undefined,
      inst13FSharesChange: liveCompany?.inst13FSharesChange ?? undefined,
      instPutCallRatio: liveCompany?.instPutCallRatio ?? undefined,
      realizedVol30: liveCompany?.realizedVol30 ?? undefined,
      keyLevels: liveCompany?.keyLevels ?? undefined,
      sma50: liveCompany?.sma50 ?? undefined,
      facts: siFacts,
    });
  }, [currentTicker, currentPrice, currentChange, liveCompany, siFacts]);

  // Declared ahead of the catalysts timeline below, which also lists the recent ones.
  const majorEvents = useMemo(() => {
    if (!stock) return [];
    return getSixMonthMajorEvents(
      stock.t,
      stock,
      sixMonthBars,
      financialsDoc?.quarters,
      tickerNews,
      financialsDoc?.epsHistory,
    );
  }, [stock, sixMonthBars, financialsDoc?.quarters, tickerNews, financialsDoc?.epsHistory]);

  // Real upcoming catalysts derived from actual exchange earnings calendar & corporate events (replaces hardcoded dates)
  const upcomingCatalysts = useMemo<UpcomingEvent[]>(() => {
    if (!stock) return [];
    const todayStr = etTodayIso();
    const todayMs = new Date(todayStr + "T00:00:00-04:00").getTime();

    const symEvents = (Array.isArray(liveEarningsList) ? liveEarningsList : [])
      .filter((e) => e.ticker === stock.t)
      .sort((a, b) => a.date.localeCompare(b.date));

    // One next-report date for every card (next-earnings.ts).
    const realErDate = nextEarningsDate(liveCompany?.nextEarningsDate, symEvents, todayStr);
    const upcomingEr = withOneUpcomingReport(symEvents, realErDate, todayStr).find((e) => e.date >= todayStr) ?? null;

    const items: UpcomingEvent[] = [];

    // Earliest day an already-happened event may be and still show.
    const lookback = new Date(`${todayStr}T12:00:00Z`);
    lookback.setUTCDate(lookback.getUTCDate() - CATALYST_LOOKBACK_DAYS);
    const lookbackIso = lookback.toISOString().slice(0, 10);

    // 0. The report this stock just made (inside the look-back window), with its result.
    const lastReport = [...symEvents]
      .reverse()
      .find((e) => e.date < todayStr && e.date >= lookbackIso && (e.epsActual != null || e.revenueActual != null));
    if (lastReport) {
      const erMs = new Date(lastReport.date + "T09:30:00-04:00").getTime();
      const ago = Math.max(1, Math.round((todayMs - erMs) / 86_400_000));
      const eps = lastReport.epsActual != null ? `EPS $${lastReport.epsActual.toFixed(2)}` : null;
      const epsVs = lastReport.epsActual != null && lastReport.epsEstimate != null ? ` vs $${lastReport.epsEstimate.toFixed(2)} est` : "";
      const rev = lastReport.revenueActual != null ? `Rev $${(lastReport.revenueActual / 1e9).toFixed(1)}B` : null;
      items.push({
        date: fmtMarketDate(lastReport.date),
        iso: lastReport.date,
        days: ago === 1 ? "yesterday" : `${ago} days ago`,
        n: lastReport.session ? `Earnings Reported (${lastReport.session})` : "Quarterly Earnings Reported",
        txt: [eps ? `${eps}${epsVs}` : null, rev].filter(Boolean).join(" · ") || `${stock.t} reported quarterly results`,
        imp: "HIGH",
        col: "#f5b031",
        cat: "Earnings",
        past: true,
      });
    }

    // 1. Real Earnings Report from backend/FMP
    if (realErDate && realErDate >= todayStr) {
      const erMs = new Date(realErDate + "T09:30:00-04:00").getTime();
      const diffDays = Math.max(0, Math.round((erMs - todayMs) / (1000 * 60 * 60 * 24)));
      const daysStr = diffDays === 0 ? "today" : diffDays === 1 ? "in 1 day" : `in ${diffDays} days`;
      const dateParts = realErDate.split("-");
      const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
      const fmtDateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const epsEst = upcomingEr?.epsEstimate != null ? `$${upcomingEr.epsEstimate.toFixed(2)}` : null;
      const revEst = upcomingEr?.revenueEstimate != null ? `$${(upcomingEr.revenueEstimate / 1e9).toFixed(1)}B` : null;
      const estTxt = epsEst || revEst
        ? `Consensus: ${[epsEst ? `EPS ${epsEst}` : "", revEst ? `Rev ${revEst}` : ""].filter(Boolean).join(" · ")}`
        : `Consensus quarterly revenue and EPS report for ${stock.t}`;

      const isConfirmed = Boolean(
        (upcomingEr as any)?.confirmed ?? (liveCompany as any)?.earningsConfirmed
      );
      const estBadge = !isConfirmed ? " (Estimated)" : "";

      items.push({
        date: `${fmtDateStr}${estBadge}`,
        iso: realErDate,
        days: daysStr,
        n: upcomingEr?.session ? `Earnings Release (${upcomingEr.session})` : "Quarterly Earnings Release",
        txt: `${estTxt}; historical event volatility window`,
        imp: "HIGH",
        col: "#f5b031",
        cat: "Earnings",
      });
    }

    // 2. Upcoming Macro & Regulatory Dates
    const fomcDay = nextFomcDecision(todayStr);
    const prevFomcDay = previousFomcDecision(todayStr);
    // Events that already happened stay for CATALYST_LOOKBACK_DAYS (an election
    // or a Fed decision is still moving the market for a while); the window
    // filter below drops anything older.
    const POLITICAL_COL = "#a78bfa";
    const OPEX = { name: "Monthly Options Expiry (OpEx)", desc: `Pinning pressure expected around key ${stock.t} open interest strikes`, imp: "LOW" as const, col: "#93a1af", cat: "Market" };
    const FOMC = { name: "FOMC Rate Decision", desc: "Federal Reserve policy decision and press conference; macro equity multiple driver", imp: "HIGH" as const, col: STEEL, cat: "Macro" };
    const F13 = { name: "13F Filing Deadline", desc: "Institutional ownership updates and hedge fund positioning reports filed with SEC", imp: "MED" as const, col: STEEL, cat: "Market" };
    const calendarEvents: Array<{ date: string; name: string; desc: string; imp: "HIGH" | "MED" | "LOW"; col: string; cat: string }> = [
      { date: previousMonthlyOpex(todayStr), ...OPEX },
      { date: nextMonthlyOpex(todayStr), ...OPEX },
      ...(prevFomcDay ? [{ date: prevFomcDay, ...FOMC }] : []),
      ...(fomcDay ? [{ date: fomcDay, ...FOMC }] : []),
      { date: previous13fDeadline(todayStr), ...F13 },
      { date: next13fDeadline(todayStr), ...F13 },
      ...upcomingPoliticalEvents(todayStr, CATALYST_LOOKBACK_DAYS).map((p) => ({ ...p, col: POLITICAL_COL, cat: "Political" })),
    ];
    calendarEvents.sort((a, b) => a.date.localeCompare(b.date));

    calendarEvents.forEach((ev) => {
      if (ev.date < lookbackIso) return; // calendar dates keep the short look-back
      const evMs = new Date(ev.date + "T09:30:00-04:00").getTime();
      const diffDays = Math.round((evMs - todayMs) / (1000 * 60 * 60 * 24));
      const daysStr = diffDays === 0 ? "today" : diffDays === 1 ? "in 1 day" : diffDays === -1 ? "yesterday" : diffDays < 0 ? `${-diffDays} days ago` : `in ${diffDays} days`;
      const dateParts = ev.date.split("-");
      const dObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
      const fmtDateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(diffDays > 180 ? { year: "numeric" as const } : {}) });
      items.push({
        date: fmtDateStr,
        iso: ev.date,
        days: daysStr,
        n: ev.name,
        txt: ev.desc,
        imp: ev.imp,
        col: ev.col,
        cat: ev.cat,
        past: ev.date < todayStr,
      });
    });

    // 3. The stock's own recent major events: the big price days from "Why it
    // moved", each with its real cause (earnings, a headline, an analyst call).
    // Those pins carry display dates only, so the day is found from the chart bars.
    const majorLookback = new Date(`${todayStr}T12:00:00Z`);
    majorLookback.setUTCDate(majorLookback.getUTCDate() - CATALYST_MAJOR_LOOKBACK_DAYS);
    const majorLookbackIso = majorLookback.toISOString().slice(0, 10);
    const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
    const barDay = new Map<string, string>(); // "Nov 12" -> latest bar day with that label
    for (const b of sixMonthBars ?? []) {
      barDay.set(fmtMarketDate(b.t, { month: "short", day: "2-digit" }), new Date(b.t).toISOString().slice(0, 10));
    }
    for (const ev of majorEvents) {
      const iso = barDay.get(ev.date);
      if (!iso || iso >= todayStr || iso < majorLookbackIso) continue;
      if (ev.category === "Earnings" && lastReport) continue; // already shown as the report itself
      const edit = CATALYST_EVENT_EDITS[`${stock.t.toUpperCase()}|${iso}`];
      if (edit?.hide) continue;
      const ago = Math.max(1, Math.round((todayMs - new Date(iso + "T09:30:00-04:00").getTime()) / 86_400_000));
      const ret = `${ev.mv >= 0 ? "+" : "−"}${Math.abs(ev.mv).toFixed(1)}%`;
      const high = Boolean(ev.card);
      items.push({
        date: fmtMarketDate(iso),
        iso,
        days: ago === 1 ? "yesterday" : `${ago} days ago`,
        n: edit?.title ?? clip(ev.label, 60),
        txt: `${stock.t} ${ret} that session. ${clip(ev.details.replace(/\s*Stock moved [^.]*\.$/, ""), 100)}`.trim(),
        imp: high ? "HIGH" : "MED",
        col: high ? "#f5b031" : STEEL,
        cat: ev.category === "Macro" ? "Price move" : ev.category,
        past: true,
      });
    }

    if (!realErDate || realErDate < todayStr) {
      items.unshift({
        date: "TBD",
        days: "date pending",
        n: "Next Earnings Announcement",
        txt: `Next quarterly report date for ${stock.t} has not yet been officially scheduled with the exchange.`,
        imp: "MED",
        col: STEEL,
      });
    }

    // Only what is coming up soon, and strictly in date order. Without the
    // window a far-off calendar item (e.g. a Sep-2027 funding deadline) landed
    // on the timeline, and the earnings card — pushed first — sat ahead of
    // nearer macro dates. The "TBD" placeholder has no date and stays first.
    const cutoff = new Date(`${todayStr}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() + CATALYST_WINDOW_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    // The look-back adds the last CATALYST_MAX_PAST events that already
    // happened (oldest first) ahead of the usual six upcoming ones. "TBD" has no
    // date and sorts at today's edge: after what happened, before what is next.
    const inWindow = items.filter((it) => !it.iso || (it.iso >= majorLookbackIso && it.iso <= cutoffIso));
    const ordered = [...inWindow].sort((a, b) => (a.iso ?? todayStr).localeCompare(b.iso ?? todayStr));
    // Of everything that already happened, keep the biggest few (then the most recent),
    // and show them oldest to newest like the rest of the timeline.
    const impRank = (i: string) => (i === "HIGH" ? 2 : i === "MED" ? 1 : 0);
    const recent = ordered
      .filter((it) => it.past)
      .sort((a, b) => impRank(b.imp) - impRank(a.imp) || (b.iso ?? "").localeCompare(a.iso ?? ""))
      .slice(0, CATALYST_MAX_PAST)
      .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""));
    return [...recent, ...ordered.filter((it) => !it.past).slice(0, 6)];
  }, [stock, liveCompany?.nextEarningsDate, liveEarningsList, majorEvents, sixMonthBars]);

  // 5 Major Catalysts derived dynamically from FMP data (bars, quarters, news, and stock metrics)
  // "+ Watch" is the Market Catalyst watchlist (the shell's shared watchlist state).
  const wl = useWatchlistsContext();
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const isWatched = !!stock && wl.watchlists.some((w) => w.tickers.includes(stock.t.toUpperCase()));
  /** Watch → the first watchlist (one is created if there is none); Watching → removed from every list. */
  const toggleWatch = async () => {
    if (!stock || watchBusy) return;
    const sym = stock.t.toUpperCase();
    setWatchBusy(true);
    setWatchMsg(null);
    try {
      if (isWatched) {
        for (const w of wl.watchlists) if (w.tickers.includes(sym)) await wl.removeTicker(w.id, sym);
      } else {
        if (!wl.uid) { setWatchMsg("Sign in to add stocks to your watchlist."); return; }
        const list = wl.watchlists[0] ?? (await wl.createList("My Watchlist"));
        if (!list) { setWatchMsg(`Couldn't add ${sym}. Please try again.`); return; }
        const res = await wl.addTicker(list.id, sym);
        if (!res.ok) setWatchMsg(res.message);
      }
    } finally {
      setWatchBusy(false);
    }
  };

  // Real peers from Polygon/FMP (liveCompany.peers) and MC company universe (matches stock function)
  const isBumble = stock?.t?.toUpperCase() === "BMBL" || stock?.name?.toLowerCase().includes("bumble") || currentTicker?.toUpperCase() === "BMBL";

  const rawPeerTickers = useMemo(() => {
    if (!stock) return [];
    return (liveCompany?.peers ?? []).filter((t) => {
      if (!t) return false;
      const ut = t.toUpperCase().trim();
      if (ut === stock.t.toUpperCase()) return false;
      if (isBumble && (ut === "BMBL" || ut === "BUMBLE")) return false;
      return true;
    });
  }, [liveCompany?.peers, stock, isBumble]);

  const inUniverse = useMemo(() => new Set((companiesList || []).map((c) => c.ticker)), [companiesList]);
  const missingPeers = useMemo(() => rawPeerTickers.filter((t) => !inUniverse.has(t)), [rawPeerTickers, inUniverse]);
  const peerQuotesMap = useLiveQuotes(missingPeers);

  const [enrichedPeers, setEnrichedPeers] = useState<Map<string, {
    name?: string | null;
    marketCap?: number | null;
    peRatio?: number | null;
    rsRating?: number | null;
  }>>(new Map());

  const missingPeersKey = missingPeers.join(",");
  // Key of the peer set whose summary request has settled (success or failure).
  const [peersSettledKey, setPeersSettledKey] = useState("");
  useEffect(() => {
    if (!missingPeersKey) return;
    let active = true;
    apiGet<Array<{
      ticker: string;
      name: string | null;
      marketCap: number | null;
      peRatio: number | null;
      rsRating: number | null;
    }>>(`/live/peers-summary?tickers=${encodeURIComponent(missingPeersKey)}`)
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setEnrichedPeers((prev) => {
          const next = new Map(prev);
          for (const r of rows) {
            next.set(r.ticker, {
              name: r.name,
              marketCap: r.marketCap != null ? (r.marketCap > 1e6 ? r.marketCap / 1e9 : r.marketCap) : null,
              peRatio: r.peRatio,
              rsRating: r.rsRating,
            });
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => { if (active) setPeersSettledKey(missingPeersKey); });
    return () => { active = false; };
  }, [missingPeersKey]);

  // Hold the table back until company, universe and peer summaries have landed,
  // so rows don't render as dashes (or sector-fallback tickers) and then fill in.
  const peersPending =
    liveCompanyLoading ||
    companiesLoading ||
    (missingPeersKey !== "" && peersSettledKey !== missingPeersKey);

  type PeerRowItem = {
    t: string;
    name: string;
    price: number | null;
    c: number | null;
    marketCap: number | null;
    peRatio: number | null;
    rsRating: number | null;
  };

  const peersAll: PeerRowItem[] = useMemo(() => {
    if (!stock) return [];
    const related: PeerRowItem[] = rawPeerTickers.map((t) => {
      const c = (companiesList || []).find((x) => x.ticker === t);
      const extra = enrichedPeers.get(t);
      if (c && c.pctChange != null) {
        return {
          t: c.ticker,
          name: c.name || extra?.name || t,
          price: c.price ?? null,
          c: c.pctChange as number,
          marketCap: c.marketCap != null ? c.marketCap / 1e9 : (extra?.marketCap ?? null),
          peRatio: c.peRatio ?? extra?.peRatio ?? null,
          rsRating: c.rsRating ?? extra?.rsRating ?? null,
        };
      }
      const q = peerQuotesMap.get(t);
      if (q && q.pctChange != null) {
        return {
          t,
          name: extra?.name || t,
          price: q.price ?? null,
          c: q.pctChange,
          marketCap: extra?.marketCap ?? null,
          peRatio: extra?.peRatio ?? null,
          rsRating: extra?.rsRating ?? null,
        };
      }
      // No live quote yet: list the peer without a price rather than a stale one.
      return {
        t,
        name: extra?.name || POPULAR[t] || t,
        price: null,
        c: null,
        marketCap: extra?.marketCap ?? null,
        peRatio: extra?.peRatio ?? null,
        rsRating: extra?.rsRating ?? null,
      };
    }).filter((p) => {
      if (!p || !p.t) return false;
      if (p.t.toUpperCase() === stock.t.toUpperCase()) return false;
      if (isBumble && (p.t.toUpperCase() === "BMBL" || p.t.toUpperCase() === "BUMBLE")) return false;
      return true;
    });

    if (related.length >= 3) {
      return related.slice(0, 6);
    }

    // Fallback to same-sector peers from companiesList
    const sectorFallback = (companiesList || [])
      .filter((c) => {
        if (!c.ticker) return false;
        if (c.ticker.toUpperCase() === stock.t.toUpperCase()) return false;
        if (isBumble && (c.ticker.toUpperCase() === "BMBL" || c.ticker.toUpperCase() === "BUMBLE")) return false;
        return c.sector === stock.sector || c.sector === liveCompany?.sector;
      })
      .sort((a, b) => (b.rsRating ?? 0) - (a.rsRating ?? 0))
      .slice(0, 6)
      .map((c) => ({
        t: c.ticker,
        name: c.name || c.ticker,
        price: c.price ?? null,
        c: c.pctChange ?? null,
        marketCap: c.marketCap != null ? c.marketCap / 1e9 : null,
        peRatio: c.peRatio ?? null,
        rsRating: c.rsRating ?? null,
      }));

    const combined = [...related];
    for (const sf of sectorFallback) {
      if (combined.length >= 6) break;
      if (!combined.some((x) => x.t.toUpperCase() === sf.t.toUpperCase())) {
        combined.push(sf);
      }
    }
    return combined;
  }, [rawPeerTickers, companiesList, peerQuotesMap, enrichedPeers, stock, liveCompany?.sector, isBumble]);

  // YTD for the peer table. The backend returns each peer's prior-year-end close
  // and the % is measured here against the price the row shows, so the two agree.
  // Fetched for every peer on screen (universe peers included — the enrichment
  // request above only covers peers missing from the universe).
  const peerTickersKey = peersAll.map((p) => p.t).join(",");
  // `since` is set only for a stock listed this year (no prior-year close): the base is then its first close.
  const [peerYtdBase, setPeerYtdBase] = useState<Map<string, { base: number | null; since: string | null }>>(new Map());
  useEffect(() => {
    if (!peerTickersKey) return;
    let active = true;
    apiGet<Array<{ ticker: string; ytdBaseClose?: number | null; ytdSince?: string | null }>>(
      `/live/peers-summary?tickers=${encodeURIComponent(peerTickersKey)}`,
    )
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setPeerYtdBase((prev) => {
          const next = new Map(prev);
          for (const r of rows) next.set(r.ticker, { base: r.ytdBaseClose ?? null, since: r.ytdSince ?? null });
          return next;
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [peerTickersKey]);

  // Expandable sections state
  const [showReadme, setShowReadme] = useState(false);

  // Thesis Lab interactive state
  const [labDir, setLabDir] = useState<"Bull" | "Bear">("Bull");
  const [labHz, setLabHz] = useState<string>("6M");
  const [labMode, setLabMode] = useState<"NORMAL" | "ADVANCED">("NORMAL");
  const [labWeightsState, setLabWeightsState] = useState<Record<string, number> | null>(null);
  const [targetOverride, setTargetOverride] = useState<number | null>(null);
  const [stopOverride, setStopOverride] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedLabDrivers, setExpandedLabDrivers] = useState<Record<string, boolean>>({});
  const [labEditTargets, setLabEditTargets] = useState(false);
  // Trade Builder: three set-up steps first (direction, horizon, mode), then Run shows the trade.
  const [labStarted, setLabStarted] = useState(false);
  const [pickDir, setPickDir] = useState<"Bull" | "Bear" | null>(null);
  const [pickHz, setPickHz] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<"NORMAL" | "ADVANCED" | null>(null);
  const [labSaveOpen, setLabSaveOpen] = useState(false);
  const [labSavedNote, setLabSavedNote] = useState<string | null>(null);
  const [labExplainerOpen, setLabExplainerOpen] = useState(false);
  const [labWeightsDialog, setLabWeightsDialog] = useState(false);
  const [labBreakdownOpen, setLabBreakdownOpen] = useState<Record<string, boolean>>({});
  // A new stock starts from an empty set-up.
  useEffect(() => {
    queueMicrotask(() => {
      setLabStarted(false);
      setPickDir(null);
      setPickHz(null);
      setPickMode(null);
      setLabSavedNote(null);
    });
  }, [siTicker]);
  // The set-up page opens at the top, whatever the last tab's scroll position was.
  useEffect(() => {
    if (activeTab !== "lab" || labStarted || typeof window === "undefined") return;
    const toTop = () => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      // On Stock Intelligence the page scrolls inside main.si-main-scroll (see shell.tsx), not the window.
      document.querySelectorAll("main.main, .main, .si-main-scroll").forEach((el) => {
        if (el.scrollTop > 0) el.scrollTop = 0;
      });
    };
    toTop();
    const raf = requestAnimationFrame(toTop);
    const timer = setTimeout(toTop, 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [activeTab, labStarted]);
  /** Back to the empty three-step set-up (after a save). */
  const resetBuilder = () => {
    setLabStarted(false);
    setPickDir(null);
    setPickHz(null);
    setPickMode(null);
    setLabWeightsState(null);
    setTargetOverride(null);
    setStopOverride(null);
    setLabEditTargets(false);
    setLabBreakdownOpen({});
  };

  // Thesis Monitor state
  const [monScenario, setMonScenario] = useState<"live" | "cut" | "break" | "surge">("live");
  const [confirmDeleteThesis, setConfirmDeleteThesis] = useState(false);
  // Every trade saved for the open stock (newest first) and the one shown on the right.
  // A stock can hold several: a bullish and a bearish set-up, or different horizons.
  const [savedTrades, setSavedTrades] = useState<SavedTrade[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  // Only this stock's trades: right after switching stocks the list still holds the previous stock's until it reloads.
  const stockTrades = savedTrades.filter((t) => t.ticker === currentTicker);
  const savedThesis: SavedTrade | null = stockTrades.find((t) => t.id === selectedTradeId) ?? stockTrades[0] ?? null;

  // Watchlist state

  // AI interactive prompt state
  const [aiQuery, setAiQuery] = useState("");
  const [aiChat, setAiChat] = useState<Array<{ role: "user" | "assistant"; text: string; note?: string }>>([]);
  const [aiBusy, setAiBusy] = useState(false);

  // Fundamentals tab: the bar picked in each metric card, keyed `${ticker}:${cardIndex}`.
  const [fundSel, setFundSel] = useState<Record<string, number>>({});

  // Load the open stock's saved trades from localStorage (see saved-trades.ts).
  useEffect(() => {
    if (!currentTicker) return;
    try {
      const found = readTrades(localStorage, currentTicker);
      // Keep the SAME array when nothing changed. `stock` is rebuilt whenever any
      // data input re-renders, and storing a fresh array here every time re-rendered
      // again — a loop (React's "Maximum update depth exceeded") that starved the
      // router, so nothing else could be clicked.
      setSavedTrades(prev => (JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
    } catch { }
  }, [currentTicker, stock]);

  // Every trade saved in this browser, for the Trade Tracker's list. Re-read when
  // the tab opens, the open stock changes, or a trade is saved or removed.
  const [trackedTrades, setTrackedTrades] = useState<TrackedTrade[]>([]);
  useEffect(() => {
    try {
      const found: TrackedTrade[] = listAllTrades(localStorage).map((t) => ({
        id: t.id, ticker: t.ticker, dir: t.dir, hz: t.hz, target: t.target, stop: t.stop, entryPx: t.entryPx, savedAt: t.savedAt,
      }));
      // Same array when nothing changed, so this can never feed a render loop.
      setTrackedTrades(prev => (JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
    } catch { }
  }, [activeTab, currentTicker, savedTrades]);

  // Handle stock selection
  const handleSelectStock = (ticker: string) => {
    const clean = ticker.toUpperCase().trim();
    if (typeof window !== "undefined") {
      localStorage.setItem("iq-stock", clean);
    }
    setSiTicker(clean);
    setSearchQuery("");
    setSearchFocused(false);
    router.push(`/si?sym=${clean}`);
  };

  // Trade Tracker list: open that stock's trade. The simulation and the
  // "Remove this trade?" prompt belong to the trade that was open, so they reset
  // rather than carry over to the next one.
  const selectTrackedTrade = (trade: TrackedTrade) => {
    setMonScenario("live");
    setConfirmDeleteThesis(false);
    setSelectedTradeId(trade.id);
    if (trade.ticker !== currentTicker) handleSelectStock(trade.ticker);
  };

  /** Delete one saved trade (any stock's, from the list or the open trade's Remove button). */
  const removeSavedTrade = (trade: { id: string; ticker: string }) => {
    try {
      const next = removeTrade(readTrades(localStorage, trade.ticker), trade.id);
      writeTrades(localStorage, trade.ticker, next);
      if (trade.ticker === currentTicker) setSavedTrades(next);
      else setTrackedTrades(prev => prev.filter(t => t.id !== trade.id));
    } catch { }
    if (selectedTradeId === trade.id) setSelectedTradeId(null);
    setConfirmDeleteThesis(false);
    setMonScenario("live");
  };

  // Format assistant replies: render bold markdown cleanly and strip stray **
  const formatAiChatReply = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, lIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={lIdx} style={{ height: 8 }} />;
      }
      const isBullet = trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ");
      const cleanLine = isBullet ? trimmed.replace(/^[•\-\*]\s*/, "") : line;
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
      const content = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={pIdx} style={{ color: "var(--si-text-hi, #ffffff)", fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        // A lone *word* is italics (models add one to the closing disclaimer).
        return part
          .replace(/\*\*/g, "")
          .split(/(\*[^*\s][^*]*\*)/g)
          .map((seg, sIdx) =>
            seg.length > 2 && seg.startsWith("*") && seg.endsWith("*") ? <em key={`${pIdx}-${sIdx}`}>{seg.slice(1, -1)}</em> : seg,
          );
      });

      if (isBullet) {
        return (
          <div key={lIdx} style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 4, alignItems: "flex-start" }}>
            <span style={{ color: "var(--si-accent, #5980a6)", flex: "none" }}>•</span>
            <div style={{ flex: 1 }}>{content}</div>
          </div>
        );
      }

      return (
        <div key={lIdx} style={{ marginTop: 2, marginBottom: 4 }}>
          {content}
        </div>
      );
    });
  };

  // Ask AI copilot function
  const handleAskAI = (promptText?: string) => {
    const q = (promptText || aiQuery).trim();
    // One question at a time: a second click used to start another model call
    // while the first was still running, and the replies could land out of order.
    if (!q || !stock || !stockDetail || aiBusy) return;

    // Earlier turns, so a follow-up ("why?") has its subject. `aiChat` is the
    // state before this question was added.
    const history = aiChat.slice(-6).map((m) => ({ role: m.role, text: m.text }));

    setAiChat((prev) => [...prev, { role: "user", text: q }]);
    if (!promptText) setAiQuery("");
    setAiBusy(true);

    // The data the model may use. Missing values are left out, so the model sees
    // "not provided" rather than a null it might read as zero.
    const compact = (o: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(
        Object.entries(o).filter(([, v]) => {
          if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) return false;
          return !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
        }),
      );
    const r = (v: number | null, digits = 2) => (v == null ? null : +v.toFixed(digits));
    const f = siFacts;
    const context = compact({
      name: stock.name,
      price: stock.p,
      changePct: r(stock.c),
      marketCap: realMcap,
      sector: stock.sector,
      setup: stock.setup,
      signalCategoriesConfirming: `${stock.cf} of 7`,
      thesisScore: stock.conf,
      trailingPE: stock.pe,
      forwardPE: stock.fpe,
      movingAverages: compact({ dma9: f.sma9, dma21: f.sma21, dma50: f.sma50, dma200: f.sma200 }),
      momentum: compact({
        rsi14: r(f.rsi14, 0),
        relativeVolume: r(f.rvol),
        rsRating: f.rsRating,
        pctFromHigh52: r(f.pctFromHigh52, 1),
        beta: r(f.beta),
        realizedVol30: r(f.realizedVol30, 0),
      }),
      levels: compact({ support1: f.pivotS1, support2: f.pivotS2, resistance1: f.pivotR1, resistance2: f.pivotR2 }),
      analysts: compact({
        consensus: f.consensus,
        buy: f.buyCount,
        hold: f.holdCount,
        sell: f.sellCount,
        meanTarget: f.targetMean,
        upgrades90d: f.upgrades90,
        downgrades90d: f.downgrades90,
      }),
      fundamentals: compact({
        revenueGrowthYoYPct: r(f.revGrowthYoY, 1),
        grossMarginPct: r(f.grossMargin, 1),
        operatingMarginPct: r(f.opMargin, 1),
        epsBeatsOfLastReports: f.epsBeats != null && f.epsReports != null ? `${f.epsBeats} of ${f.epsReports}` : null,
        epsThisFY: f.fwdEps,
        epsNextFY: f.nextFyEps,
      }),
      positioning: compact({
        institutionalOwnershipPct: r(f.instOwnershipPct, 1),
        filers13FChangeQoQ: f.instHoldersChange,
        shares13FChange: f.instSharesChange,
        insiderNetUsd90d: r(f.insiderNet90, 0),
        putCall13F: r(f.instPutCallRatio),
      }),
      signals: stock.sig,
      invalidation: stockDetail.invalid.map(([title, cond]) => `${title}: ${cond}`),
      alreadyBroken: stockDetail.broken.map(([title, cond]) => `${title}: ${cond}`),
      upcoming: upcomingCatalysts.filter((c) => !c.past).slice(0, 4).map((c) => `${c.date} (${c.days}): ${c.n}. ${c.txt}`),
      today: stockDetail.movedTxt,
      peers: peersAll.slice(0, 5).map((p) => `${p.t}: P/E ${p.peRatio != null ? p.peRatio.toFixed(1) : "n/a"}, ${p.c != null ? pct(p.c) : "n/a"} today`),
      newsSummary: aiAnalysisDoc?.analysis?.newsSummary,
      technicalSummary: aiAnalysisDoc?.analysis?.technicalSummary,
      // The names the server's no-model summary reads.
      change: r(stock.c),
      mcap: realMcap,
      pe: stock.pe,
      fpe: stock.fpe,
    });

    // The reply when no live model answered: tied to what was asked, from the
    // data on this page (it used to be one generic summary for every question).
    const answerLocally = (why: string) =>
      setAiChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: localCopilotAnswer(q, {
            sym: stock.t,
            price: stock.p,
            changePct: stock.c,
            setup: stock.setup,
            confluence: stock.cf,
            facts: siFacts,
            signals: stock.sig,
            invalid: stockDetail.invalid,
            broken: stockDetail.broken,
            catalysts: upcomingCatalysts.filter((c) => !c.past).map((c) => ({ date: c.date, days: c.days, n: c.n, txt: c.txt })),
            peers: peersAll.map((p) => ({ t: p.t, pe: p.peRatio, changePct: p.c })),
            movedTxt: stockDetail.movedTxt,
          }),
          note: why,
        },
      ]);

    apiPost<{ reply?: string; provider?: string }>("/live/copilot", {
      ticker: stock.t,
      question: q,
      query: q,
      history,
      context,
    })
      .then((res) => {
        // "deterministic-synthesis" is the server saying no model replied.
        if (res?.reply?.trim() && res.provider !== "deterministic-synthesis") {
          setAiChat((prev) => [...prev, { role: "assistant", text: res.reply as string }]);
        } else {
          answerLocally("The live AI model did not reply, so this read is built from the data on this page.");
        }
      })
      .catch(() => {
        answerLocally("The live AI model did not reply in time, so this read is built from the data on this page.");
      })
      .finally(() => {
        setAiBusy(false);
      });
  };

  // These two memos must stay ABOVE the empty-state return below: a hook placed
  // after it runs only when a stock is open, so going from the home view to a
  // stock changed the hook count and React threw "Rendered more hooks than
  // during the previous render".

  // Real market cap format
  const stockMcap = stock?.mcap ?? "";
  const realMcap = useMemo(() => {
    if (liveCompany?.marketCap) {
      const mc = liveCompany.marketCap;
      if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
      if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
      if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
    }
    return stockMcap;
  }, [liveCompany, stockMcap]);

  // ----------------------------------------------------
  // EMPTY STATE (NO STOCK SELECTED YET)
  // ----------------------------------------------------
  if (!stock || !stockDetail) {
    return (
      <div
        className="si-screen"
        data-theme={theme}
        style={{
          minHeight: "100vh",
          background: "var(--si-bg, #080b10)",
          color: "var(--si-text-hi, #e8eef4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          paddingBottom: 120,
          position: "relative",
        }}
      >

      <style>{SI_TOKENS_CSS}</style>
      <style>{`
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: #14171c;
          --si-card-solid: #14171c;
          --si-card-sec: #0f1216;
          --si-card-tert: #1a1e24;
          --si-card-tint: rgba(20, 23, 28, 0.8);
          --si-border: #232830;
          --si-border-sec: #2e343d;
          --si-border-dashed: #2e343d;
          --si-text-hi: #e8eef4;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-input-bg: #14171c;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: #14171c;
          --si-card-solid: #14171c;
          --si-card-sec: #0f1216;
          --si-card-tert: #1a1e24;
          --si-card-tint: rgba(20, 23, 28, 0.8);
          --si-border: #232830;
          --si-border-sec: #2e343d;
          --si-border-dashed: #2e343d;
          --si-text-hi: #e8eef4;
          --si-text-body: #d5dfe9;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-evidence-bg: rgba(89, 128, 166, 0.08);
          --si-evidence-title: #a9c6e3;
          --si-input-bg: #14171c;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen[data-theme="light"],
        .iq-root[data-theme="light"] .si-screen {
          --si-bg: #f4f6fa;
          --si-topbar: rgba(255,255,255,0.96);
          --si-card: #ffffff;
          --si-card-solid: #ffffff;
          --si-card-sec: #f8fafc;
          --si-card-tert: #f1f5f9;
          --si-card-tint: rgba(255, 255, 255, 0.95);
          --si-border: #e2e8f0;
          --si-border-sec: #cbd5e1;
          --si-border-dashed: #94a3b8;
          --si-text-hi: #07080a;
          --si-text-body: #0f172a;
          --si-text-mid: #1e293b;
          --si-text-dim: #334155;
          --si-text-sub: #475569;
          --si-accent: #1d4ed8;
          --si-accent-soft: #2563eb;
          --si-accent-light: #07080a;
          --si-accent-bg: rgba(37, 99, 235, 0.08);
          --si-accent-btn: #1d4ed8;
          --si-evidence-bg: #f1f5f9;
          --si-evidence-title: #07080a;
          --si-input-bg: #ffffff;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .si-screen[data-theme="light"] input,
        .iq-root[data-theme="light"] .si-screen input {
          color: #0f172a !important;
        }
        .si-screen[data-theme="light"] input::placeholder,
        .iq-root[data-theme="light"] .si-screen input::placeholder {
          color: #94a3b8 !important;
        }
      `}</style>

        <div className="si-switch-wrap" style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10, padding: "0 24px" }}>
          <ModuleSwitcher />
          <div style={{ position: "absolute", right: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={toggleTheme}
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            style={{
              height: 34,
              width: 34,
              padding: 0,
              border: "1px solid var(--si-border-sec, #2a3a4a)",
              background: "var(--si-card-solid, #0c1118)",
              color: "var(--si-text-hi, #e8eef4)",
              fontFamily: "'Manrope', sans-serif",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              transition: "all 150ms ease",
            }}
          >
            {isLight ? (
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
          <ProfileMenu />
          </div>
        </div>
        <div style={{ maxWidth: 640, width: "100%", textAlign: "center", marginTop: 70 }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 57.6, // 48 × 1.2
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "var(--si-text-hi, #e8eef4)",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            STOCK INTELLIGENCE
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14.4, // 12 × 1.2
              fontWeight: 500,
              letterSpacing: "0.22em",
              color: "var(--si-accent, #5980a6)",
              marginBottom: 28,
            }}
          >
            DEEP-DIVE RESEARCH & THESIS ENGINE
          </div>

          <p
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 18, // 15 × 1.2
              color: "var(--si-text-mid, #93a1af)",
              lineHeight: 1.6,
              marginBottom: 36,
            }}
          >
            Search any ticker to generate an institutional-grade breakdown covering factor attribution, forward scenario modeling, thesis stress-testing, and live technicals.
          </p>

          {/* Large Global Search Field */}
          <div style={{ position: "relative", marginBottom: 36, textAlign: "left" }}>
            <div
              style={{
                height: 52,
                border: "1px solid var(--si-border-sec, #2a3a4a)",
                background: "var(--si-card-solid, #0c1118)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0 18px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--si-accent, #5980a6)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    e.preventDefault();
                    handleSelectStock(searchQuery.trim());
                  }
                }}
                placeholder="Search tickers (e.g. NVDA, AAPL, MSFT, META, TSLA, STRL)…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--si-text-hi, #e8eef4)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 15,
                }}
              />
            </div>

            {/* Autocomplete Dropdown */}
            {searchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
              <div
                style={{
                  position: "absolute",
                  top: 58,
                  left: 0,
                  right: 0,
                  background: "var(--si-card-solid, #0c1118)",
                  border: "1px solid #5980a6",
                  borderRadius: 8,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                  zIndex: 50,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {searchResults.slice(0, 8).map((r) => (
                  <div
                    key={r.ticker}
                    onMouseDown={() => handleSelectStock(r.ticker)}
                    style={{
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--si-border, #1c2733)",
                    }}
                  >
                    <StockLogo sym={r.ticker} size={24} />
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--si-text-hi, #e8eef4)",
                        width: 60,
                      }}
                    >
                      {r.ticker}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "'Manrope', sans-serif",
                        fontSize: 13,
                        color: "var(--si-text-mid, #93a1af)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.name || r.ticker}
                    </span>
                    {r.price != null && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-hi, #e8eef4)" }}>
                        {usd(r.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick-Access Stock Chips */}
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--si-accent, #5980a6)",
                marginBottom: 12,
              }}
            >
              POPULAR STOCKS WITH FULL COVERAGE
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {ORDER.map((sym) => {
                const chg = popularQuotes.get(sym)?.pctChange ?? null;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectStock(sym);
                    }}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                      border: "1px solid var(--si-border-sec, #2a3a4a)",
                      borderRadius: 6,
                      color: "var(--si-text-hi, #e8eef4)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <StockLogo sym={sym} size={18} />
                    <span>{sym}</span>
                    {chg != null && <span style={{ fontSize: 11, color: chg >= 0 ? UP : DN }}>{pct(chg)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // LOADED STOCK INTELLIGENCE DASHBOARD
  // ----------------------------------------------------
  // Stats definition for Overview header
  const peVal = liveCompany?.peRatio ?? stock.pe;
  const fpeVal = liveCompany?.forwardPe ?? stock.fpe;
  const r52 = range52(
    { high: liveCompany?.high52 ?? stock.hi, low: liveCompany?.low52 ?? stock.lo },
    { high: sharedQuote?.dayHigh, low: sharedQuote?.dayLow },
  );
  const hi52 = r52.high;
  const lo52 = r52.low;

  // Overview signal scores and confidence come from one 6-month bullish forward run, the same
  // engine the Trade Builder uses (the old fallback showed fixed 88/87/80/… for every stock).
  const overviewRun = thesisRun(stock.t, "Bull", "6M", undefined, undefined, siFacts);
  const movedWeek = weekMove(stock.t, moveBars, tickerNews as unknown as Parameters<typeof weekMove>[2]);
  const mcConfidence = overviewRun.conf != null ? Math.round(overviewRun.conf) : null;
  if (isUnsubscribed) {
    return (
      <div
        className="si-screen"
        data-theme={theme}
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--si-bg, #080b10)",
          color: "var(--si-text-hi, #e8eef4)",
          padding: "80px 20px",
        }}
      >
        <LockedFeature entitlement="stockIntelligence" requiredPlan="starter" />
      </div>
    );
  }

  return (
    <div
      className="si-screen"
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: "var(--si-bg, #080b10)",
        color: "var(--si-text-hi, #e8eef4)",
        paddingBottom: 120, // Issue 8 fix: generous padding at bottom
      }}
    >
      <style>{SI_TYPE_CSS}</style>
      <style>{SI_TOKENS_CSS}</style>
      <style>{`
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: #14171c;
          --si-card-solid: #14171c;
          --si-card-sec: #0f1216;
          --si-card-tert: #1a1e24;
          --si-card-tint: rgba(20, 23, 28, 0.8);
          --si-border: #232830;
          --si-border-sec: #2e343d;
          --si-border-dashed: #2e343d;
          --si-text-hi: #e8eef4;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-input-bg: #14171c;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen {
          --si-bg: #080b10;
          --si-topbar: rgba(8,11,16,0.96);
          --si-card: #14171c;
          --si-card-solid: #14171c;
          --si-card-sec: #0f1216;
          --si-card-tert: #1a1e24;
          --si-card-tint: rgba(20, 23, 28, 0.8);
          --si-border: #232830;
          --si-border-sec: #2e343d;
          --si-border-dashed: #2e343d;
          --si-text-hi: #e8eef4;
          --si-text-body: #d5dfe9;
          --si-text-mid: #93a1af;
          --si-text-dim: #7d8b99;
          --si-text-sub: #5d6b79;
          --si-accent: #5980a6;
          --si-accent-soft: #7fa8d0;
          --si-accent-light: #a9c6e3;
          --si-accent-bg: rgba(89, 128, 166, 0.18);
          --si-accent-btn: #5980a6;
          --si-evidence-bg: rgba(89, 128, 166, 0.08);
          --si-evidence-title: #a9c6e3;
          --si-input-bg: #14171c;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .si-screen[data-theme="light"],
        .iq-root[data-theme="light"] .si-screen {
          --si-bg: #f4f6fa;
          --si-topbar: rgba(255,255,255,0.96);
          --si-card: #ffffff;
          --si-card-solid: #ffffff;
          --si-card-sec: #f8fafc;
          --si-card-tert: #f1f5f9;
          --si-card-tint: rgba(255, 255, 255, 0.95);
          --si-border: #e2e8f0;
          --si-border-sec: #cbd5e1;
          --si-border-dashed: #94a3b8;
          --si-text-hi: #07080a;
          --si-text-body: #0f172a;
          --si-text-mid: #1e293b;
          --si-text-dim: #334155;
          --si-text-sub: #475569;
          --si-accent: #1d4ed8;
          --si-accent-soft: #2563eb;
          --si-accent-light: #07080a;
          --si-accent-bg: rgba(37, 99, 235, 0.08);
          --si-accent-btn: #1d4ed8;
          --si-evidence-bg: #f1f5f9;
          --si-evidence-title: #07080a;
          --si-input-bg: #ffffff;
          --si-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .si-screen[data-theme="light"] input,
        .iq-root[data-theme="light"] .si-screen input {
          color: #0f172a !important;
        }
        .si-screen[data-theme="light"] input::placeholder,
        .iq-root[data-theme="light"] .si-screen input::placeholder {
          color: #94a3b8 !important;
        }
        /* ── Top bar: the 660px module switcher stays beside the name, home and search until it would touch the search box (about 1400px), then takes its own row ── */
        @media screen and (max-width: 1419px) {
          .si-topbar .si-switch-wrap { order: 5; flex: 1 1 100% !important; min-width: 0 !important; padding-bottom: 4px; }
          /* with the switcher on its own row the search has the room: full width */
          .si-screen .si-nav-search { width: 320px !important; max-width: 100%; }
          /* the switcher is pinned to the screen's top centre from 1024px up (module-switcher.tsx); in this bar it sits in its own row instead */
          .si-topbar .si-switch-wrap .mod-switch-pin { position: static !important; transform: none !important; }
        }
        /* ── Phone (≤760px): less page padding, and the tab rail scrolls away with the page instead of sticking ── */
        @media (max-width: 760px) {
          .si-main { padding: 14px 12px 100px !important; }
          .si-tabrail { position: static !important; }
          .si-topbar .si-switch-wrap .mod-switch-pin [role="group"] { padding-left: 14px; box-sizing: border-box; }
        }
      `}</style>

      {/* ====================================================
          TOP BAR, MASTHEAD AND TAB RAIL (redesign): the top bar scrolls away; the tab rail stays on screen
          ==================================================== */}
      <div className="si-topbar" style={{ display: "contents" }}>
        <div
          style={{
            background: "var(--si-topbar, rgba(8,11,16,0.96))",
            borderBottom: "1px solid var(--si-border, #232830)",
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "8px 24px",
            flexWrap: "wrap",
          }}
        >
          {/* Logo & Subtitle: click to go back to the Stock Intelligence home (search page) */}
          <button
            type="button"
            onClick={goToSearch}
            title="Stock Intelligence home"
            aria-label="Stock Intelligence home"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              flex: "none",
              border: "none",
              borderRight: "1px solid var(--si-border, #1c2733)",
              background: "transparent",
              padding: "0 16px 0 0",
              cursor: "pointer",
              userSelect: "none",
              textAlign: "left",
            }}
          >
            <span
              data-caps
              style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap" }}
            >
              <span style={{ color: "var(--si-text-hi, #ffffff)" }}>Stock</span> <span style={{ color: "var(--si-accent-light, #8eaedb)" }}>Intelligence</span>
            </span>
            <span
              data-caps
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.2em", color: "var(--si-accent, #5980a6)", marginTop: 3 }}
            >
              By MarketCatalyst
            </span>
          </button>

          {/* Search Bar */}
          <div className="si-nav-search" style={{ position: "relative", width: 220, flex: "none" }}>
            <div
              // The box can shrink to just the icon on narrow windows (module-switcher.tsx),
              // so a click anywhere on it, not only on the input, focuses the input.
              onClick={(e) => e.currentTarget.querySelector("input")?.focus()}
              style={{
                height: 34,
                border: "1px solid var(--si-border, #1c2733)",
                background: "var(--si-card-solid, #0c1118)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 10px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--si-accent, #5980a6)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    e.preventDefault();
                    handleSelectStock(searchQuery.trim());
                  }
                }}
                placeholder="Search tickers…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--si-text-hi, #e8eef4)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                }}
              />
            </div>
            {searchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
              <div
                style={{
                  position: "absolute",
                  top: 38,
                  left: 0,
                  right: 0,
                  background: "var(--si-card-solid, #0c1118)",
                  border: "1px solid #5980a6",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                  zIndex: 50,
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {searchResults.slice(0, 6).map((r) => (
                  <div
                    key={r.ticker}
                    onMouseDown={() => handleSelectStock(r.ticker)}
                    style={{
                      height: 42,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "0 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--si-border, #1c2733)",
                    }}
                  >
                    <StockLogo sym={r.ticker} size={20} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: "var(--si-text-hi, #e8eef4)", width: 50 }}>
                      {r.ticker}
                    </span>
                    <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </span>
                    {r.price != null && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-hi, #e8eef4)" }}>
                        {usd(r.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Issue 5 Fix: Centered SISwitcher inside the header bar */}
          <div className="si-switch-wrap" style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 290 }}>
            <ModuleSwitcher />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            {/* ET clock + market session, as in Market Catalyst, Money Flow and Alpha Signals */}
            <MarketClockBadge />
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isLight ? "Switch to dark mode" : "Switch to light mode"}
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              style={{
                height: 34,
                width: 34,
                padding: 0,
                border: "1px solid var(--si-border-sec, #2a3a4a)",
                background: "var(--si-card-solid, #0c1118)",
                color: "var(--si-text-hi, #e8eef4)",
                fontFamily: "'Manrope', sans-serif",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                transition: "all 150ms ease",
              }}
            >
              {isLight ? (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )}
            </button>
            <ProfileMenu />
          </div>
        </div>

        <SiMasthead
          logo={<StockLogo sym={stock.t} size={56} />}
          ticker={stock.t}
          name={stock.name || liveCompany?.name || ""}
          /* Watchlist star, as on the Market Catalyst stock page: filled when the ticker is in a Market Catalyst watchlist. */
          afterTicker={
            <button
              type="button"
              onClick={toggleWatch}
              disabled={watchBusy}
              aria-pressed={isWatched}
              aria-label={isWatched ? `Remove ${stock.t} from your watchlist` : `Add ${stock.t} to your watchlist`}
              title={watchMsg ?? (isWatched ? "In your Market Catalyst watchlist \u2014 click to remove" : "Add to your Market Catalyst watchlist")}
              style={{
                background: "none",
                border: "none",
                padding: "0 2px 0 6px",
                fontSize: 18,
                lineHeight: 1,
                cursor: watchBusy ? "default" : "pointer",
                color: isWatched ? "var(--warn, #f5b544)" : "var(--si-text-mid, #93a1af)",
              }}
            >
              {isWatched ? "\u2605" : "\u2606"}
            </button>
          }
          note={
            watchMsg ? (
              <div role="status" style={{ fontSize: 12, color: "var(--down, #dc2626)", maxWidth: 260 }}>
                {watchMsg}
              </div>
            ) : null
          }
          price={usd(stock.p)}
          change={pct(stock.c)}
          up={stock.c >= 0}
          ext={
            headline.showAfterHours && headline.ahPrice != null && headline.ahPct != null
              ? { label: headline.extLabel, price: usd(headline.ahPrice), pct: pct(headline.ahPct), up: headline.ahPct >= 0 }
              : null
          }
          marketCap={realMcap || "\u2014"}
          pe={peVal != null ? `${peVal.toFixed(1)}\u00D7` : "\u2014"}
          fpe={fpeVal != null ? `${fpeVal.toFixed(1)}\u00D7` : "\u2014"}
          range={
            hi52 != null && lo52 != null && (siFacts.price ?? stock.p) != null
              ? { low: lo52, high: hi52, price: (siFacts.price ?? stock.p) as number, lowText: usd(lo52), highText: usd(hi52) }
              : null
          }
        />
        <SiTabRail tabs={TABS} active={activeTab} onSelect={setActiveTab} />
      </div>

      {/* Main Container */}
      {/* 1480px left wide empty strips on a 1920px monitor while a 1536px laptop was already
          edge to edge. The cap now only matters on ultra-wide screens, where lines would
          get too long to read. */}
      <div className="si-main" style={{ maxWidth: 2200, margin: "0 auto", padding: "24px 24px 120px 24px" }}>
        {/* ====================================================
            TAB 1: OVERVIEW (redesign): growth chart, MC Confidence with its signal scores, and the read menu.
            Why it moved and Why it could move are panels in that menu, not tabs.
            ==================================================== */}
        {activeTab === "overview" && (() => {
          const price = siFacts.price ?? stock.p;
          const scores = scoreRows(overviewRun.cats, SHORT);
          const tech = technicalRead(siFacts);
          const fund = fundamentalRead(siFacts, fpeVal);
          const overall = overallVerdict(tech.verdict, fund.verdict, mcConfidence);
          const weekTone: Tone = movedWeek ? (movedWeek.pct >= 0.05 ? "up" : movedWeek.pct <= -0.05 ? "down" : "flat") : "flat";
          // The MarketCatalyst read: a headline, a short body and the two prices to watch. Without enough
          // data for one, the verdict and the two reads' own lines stand in.
          const read = headlineRead(stock.t, siFacts, tech, fund, overall, { bars: sixMonthBars, low52: lo52 });
          const nextEvent = upcomingCatalysts.find((u) => !u.past && u.iso) ?? null;
          // The Fundamentals charts: revenue and EPS growth over the last four quarters, the four latest quarters, the P/Es.
          const growth = growthSeries(financialsDoc?.quarters);
          const latestFour = [...(financialsDoc?.quarters ?? [])]
            .filter((q) => q.endDate)
            .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))
            .slice(0, 4);
          const chartInput: ChartInput = {
            ticker: stock.t,
            facts: siFacts,
            forwardPe: fpeVal,
            revenue: growth.find((g) => g.key === "rev")?.rows ?? [],
            eps: growth.find((g) => g.key === "eps")?.rows ?? [],
            quarters: latestFour,
          };
          // The analysts' average target on the Technicals ruler: the top analysts' when known, else the mean target.
          const topAnalysts = topTargets(siFacts.analystTargets);
          const rulerTarget = topAnalysts
            ? { avg: topAnalysts.avg, median: topAnalysts.median, n: topAnalysts.n }
            : siFacts.targetMean != null
              ? { avg: siFacts.targetMean, median: null, n: null }
              : null;
          // Why it moved: yesterday and the last five sessions, from the daily bars and the stock's headlines.
          const todayNy = etTodayIso();
          const news = (Array.isArray(tickerNews) ? tickerNews : []) as unknown as MoveNews[];
          const yMove = yesterdayMove(moveBars);
          const toneCol = (t?: MoveTone) => (t === "up" ? "#4ade80" : t === "down" ? "#f05656" : "var(--si-text-mid, #93a1af)");
          const asRows = (rows: MoveRow[]): PanelRow[] => rows.map((r) => ({ title: r.title, detail: r.detail, tag: r.tag, col: toneCol(r.tone), isNew: r.isNew }));
          const weekReasons = weekRows(moveBars, news);
          const weekFallback: PanelRow[] = (movedWeek ? movedWeek.ev : stockDetail.movedEv)
            .slice(0, 3)
            .map((ev) => ({ title: "Recent activity", detail: typeof ev === "string" ? highlightNumbers(ev) : ev }));
          // Why it could move: what could push it up and what could pull it down.
          const ctxQuote = (t: string) => moveQuotes.get(t)?.pctChange;
          const reasons = couldMove(siFacts, {
            sector: scoringPeers.flatMap((t) => (typeof ctxQuote(t) === "number" ? [{ t, pct: ctxQuote(t) as number }] : [])),
            market: ([["QQQ", "Nasdaq 100"], ["SPY", "S&P 500"]] as const).flatMap(([t, label]) => (typeof ctxQuote(t) === "number" ? [{ label, pct: ctxQuote(t) as number }] : [])),
            news,
            bigMoves10: bigMovesIn10(moveBars),
            todayIso: todayNy,
          });
          const couldTone: Tone = reasons.up.length > reasons.down.length ? "up" : reasons.down.length > reasons.up.length ? "down" : "flat";
          const nav: NavItem[] = [
            { id: "read", label: "MarketCatalyst read", ...verdictStatus(overall) },
            { id: "fund", label: "Fundamentals", ...verdictStatus(fund.verdict) },
            { id: "tech", label: "Technicals", ...verdictStatus(tech.verdict) },
            { id: "moved", label: "Why it moved", status: statusForTone(weekTone), tone: weekTone },
            { id: "could", label: "Why it could move", status: statusForTone(couldTone), tone: couldTone },
          ];
          return (
            <>
              <SiOverview
                key={stock.t}
                data={{
                  growth,
                  scores,
                  conf: mcConfidence,
                  onScores: () => setConfOpen(true),
                  nav,
                  read: {
                    headline: read ? read.headline : sentenceCase(overall.label),
                    body: read ? read.body : `${fund.action} ${tech.action}`,
                    now: price ?? null,
                    nowText: usd(price),
                    low: read?.levels.find((l) => l.tone === "down") ?? null,
                    high: read?.levels.find((l) => l.tone === "up") ?? null,
                    onInfo: () => setVerdictOpen(true),
                  },
                  panels: {
                    fund: (
                      <PanelCard>
                        {fund.reads.length ? (
                          <>
                            <LeadLine text={fund.action} />
                            <ReadTiles
                              reads={fund.reads}
                              glow
                              chartFor={(r) => {
                                const spec = chartSpec(r.k, chartInput);
                                return spec ? <ReadChart spec={spec} /> : undefined;
                              }}
                            />
                          </>
                        ) : (
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, color: "var(--si-text-mid, #93a1af)" }}>{fund.action}</span>
                        )}
                      </PanelCard>
                    ),
                    tech: (
                      <PanelCard>
                        {tech.reads.length ? (
                          <>
                            <LeadLine text={tech.action} />
                            {price != null && (
                              <LevelsRuler
                                price={price}
                                low52={lo52 ?? null}
                                high52={hi52 ?? null}
                                support={tech.nextSupport}
                                resistance={tech.nextResistance}
                                target={rulerTarget}
                                money={usd}
                              />
                            )}
                            <ReadTiles reads={tech.reads} />
                          </>
                        ) : (
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, color: "var(--si-text-mid, #93a1af)" }}>{tech.action}</span>
                        )}
                      </PanelCard>
                    ),
                    moved: (
                      <MovedPanel
                        yesterday={{
                          label: yMove ? `YESTERDAY \u00B7 ${fmtMarketDate(yMove.t, { weekday: "short", month: "short", day: "numeric" })}` : "YESTERDAY",
                          pct: yMove?.pct ?? null,
                          heading: "Yesterday",
                          rows: yMove ? asRows(yesterdayRows(yMove, news)) : [],
                          empty: "Not enough price history to explain this move yet.",
                        }}
                        week={{
                          label: "LAST 5 SESSIONS",
                          pct: movedWeek?.pct ?? null,
                          heading: "Last 5 Sessions",
                          rows: weekReasons.length ? asRows(weekReasons) : weekFallback,
                          empty: "Not enough price history to explain this week yet.",
                        }}
                      />
                    ),
                    could: (
                      <CouldPanel
                        next={nextEvent}
                        nextLabel={nextEvent ? titleWords(`NEXT EVENT \u00B7 ${nextEvent.date} \u00B7 ${nextEvent.days}`) : ""}
                        upTitle={titleWords("What could push it up")}
                        downTitle={titleWords("What could pull it down")}
                        up={asRows(reasons.up)}
                        down={asRows(reasons.down)}
                      />
                    ),
                  },
                }}
              />
              {confOpen && <ConfidenceDialog cats={overviewRun.cats} conf={mcConfidence} peerTickers={siFacts.peerTickers} onClose={() => setConfOpen(false)} />}
              {verdictOpen && <VerdictDialog breakdown={verdictBreakdown(tech.verdict, fund.verdict, mcConfidence)} techReads={tech.reads} fundReads={fund.reads} onClose={() => setVerdictOpen(false)} />}
            </>
          );
        })()}

        {/* ====================================================
            TAB 4: FUNDAMENTALS (Complete Implementation)
            ==================================================== */}
        {activeTab === "fund" && (() => {
          const hasFmp = Boolean(financialsDoc?.quarters && financialsDoc.quarters.length >= 2);
          // Banks: gross margin, EBITDA and free cash flow are not meaningful.
          const isBank = /bank|savings|thrift|financial/i.test(liveCompany?.industry ?? "") || /bank|financial/i.test(liveCompany?.sector ?? "");
          const fmpQ = hasFmp && financialsDoc?.quarters ? [...financialsDoc.quarters].slice(0, 8).reverse() : null;

          let fsr: number[][];
          let QL: [string, string];

          if (fmpQ && fmpQ.length >= 2) {
            // Real FMP fundamental data series
            const revSeries = fmpQ.map((q) => (q.revenue || 0) / 1e9);
            // GAAP diluted (gaapQuarterEps) — the same basis as EPS (TTM) and P/E.
            const epsSeries = fmpQ.map((q) => gaapQuarterEps(q) ?? 0);
            // Gross margin means nothing for a bank (no cost of goods; JPM read
            // 62.3%), and a statement whose gross profit IS operating income
            // (NEE: 32.4% / 32.4%) has no real gross line — show no data then.
            const noGross = isBank || fmpQ.every((q) => q.grossProfit != null && q.operatingIncome != null && q.grossProfit === q.operatingIncome);
            const gmSeries = noGross ? [] : fmpQ.map((q) => q.grossMarginPct != null ? q.grossMarginPct : (q.revenue ? ((q.grossProfit || 0) / q.revenue) * 100 : 0));
            // Same definition as the TTM FCF yield (computeQuarterFcf) — never
            // operating cash flow or net income standing in for it.
            const fcfSeries = fmpQ.map((q) => (computeQuarterFcf(q) ?? 0) / 1e9);
            // Never fall back to net income; return [] to render "—" when missing or for banks.
            const opSeries = computeOperatingIncomeSeries(fmpQ, isBank);
            // Total debt (short + long term + leases), as quote pages report it — not long-term only.
            const debtSeries = fmpQ.map((q) => (q.totalDebt ?? q.longTermDebt ?? 0) / 1e9);
            fsr = [revSeries, epsSeries, gmSeries, fcfSeries, opSeries, debtSeries];
            QL = [
              `${fmpQ[0].fiscalPeriod || "Q"} '${(fmpQ[0].fiscalYear || "").slice(-2)}`,
              `${fmpQ[fmpQ.length - 1].fiscalPeriod || "Q"} '${(fmpQ[fmpQ.length - 1].fiscalYear || "").slice(-2)}`
            ];
          } else {
            fsr = fundSeries(stock.t);
            QL = ["", ""];
          }

          if (!hasFmp && (!fsr[0] || fsr[0].length === 0)) {
            // Financials still in flight (data is null until the fetch resolves):
            // show a quiet placeholder instead of flashing "Not Available".
            if (financialsLoading || (!financialsDoc && !financialsError)) {
              return <div style={{ minHeight: 240 }} aria-busy="true" />;
            }
            return (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--si-text-dim, #5a6876)" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #f0f4f8)", marginBottom: 8 }}>
                  Quarterly Statements Not Available
                </div>
                <div style={{ fontSize: 13, maxWidth: 420, margin: "0 auto" }}>
                  Quarterly financial statements for {stock.t} are not reported or synced yet.
                </div>
              </div>
            );
          }

          // Dollar amounts in billions: the sign goes before the "$" ("-$5.4B",
          // not "$-5.4B", which reads as 5.4), and under $1B shows in millions
          // ("$167M", not "$0.0B").
          const usdB = (v: number) => {
            const a = Math.abs(v);
            const sign = v < 0 && a >= 0.0005 ? "-" : "";
            return a >= 1 ? `${sign}$${a.toFixed(1)}B` : `${sign}$${(a * 1000).toFixed(0)}M`;
          };
          const FM: [string, (v: number) => string][] = [
            ["Revenue", usdB],
            ["EPS (GAAP)", (v) => (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(2)],
            ["Gross Margin", (v) => v.toFixed(1) + "%"],
            ["Free Cash Flow", usdB],
            [hasFmp ? "Operating Income" : "ROIC", (v) => (hasFmp ? usdB(v) : v.toFixed(0) + "%")],
            ["Total Debt", usdB],
          ];
          // What a click on one bar shows: that quarter's label, value, change
          // vs the prior quarter and the same quarter a year earlier, plus one
          // line of the figures behind it (estimate, margin, cash flow, cash).
          type FundBar = { h: string; c: string; label: string; end: string; value: string; qoq: number | null; yoy: number | null; note: string | null };
          // Quarter figures are raw dollars; usdB above takes billions.
          const usdRaw = (v: number) => usdB(v / 1e9);
          const chgPct = (cur: number, prev: number | undefined): number | null =>
            prev == null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
          const barNote = (card: number, q: QuarterFinancials | undefined): string | null => {
            if (!q) return null;
            switch (card) {
              case 0: {
                if (q.revenueEstimateReported == null) return null;
                const s = surprisePct(q.revenue, q.revenueEstimateReported);
                return `Estimate ${usdRaw(q.revenueEstimateReported)}${s != null ? ` · ${pct1(s)} vs estimate` : ""}`;
              }
              case 1: {
                // The bar is GAAP diluted EPS; estimates and surprises are on the
                // adjusted basis, so say so rather than mix the two figures.
                if (q.epsEstimateReported == null) return null;
                const s = quarterEpsSurprisePct(q);
                return `Adjusted EPS ${q.epsActualReported != null ? `$${q.epsActualReported.toFixed(2)} ` : ""}vs $${q.epsEstimateReported.toFixed(2)} estimate${s != null ? ` · ${pct1(s)}` : ""}`;
              }
              case 2:
                return q.grossProfit != null && q.revenue ? `Gross profit ${usdRaw(q.grossProfit)} on ${usdRaw(q.revenue)} revenue` : null;
              case 3:
                return q.operatingCashFlow != null && q.capitalExpenditures != null
                  ? `Operating cash flow ${usdRaw(q.operatingCashFlow)} less ${usdRaw(Math.abs(q.capitalExpenditures))} capex`
                  : null;
              case 4:
                return q.operatingIncome != null && q.revenue ? `Operating margin ${((q.operatingIncome / q.revenue) * 100).toFixed(1)}% of ${usdRaw(q.revenue)} revenue` : null;
              case 5: {
                const debt = q.totalDebt ?? q.longTermDebt;
                return debt != null && q.cashAndCashEquivalents != null
                  ? `Cash ${usdRaw(q.cashAndCashEquivalents)} · net debt ${usdRaw(debt - q.cashAndCashEquivalents)}`
                  : null;
              }
              default:
                return null;
            }
          };
          const fundMetrics = FM.map(([k, f], i) => {
            const a = fsr[i] ?? [];
            // No FMP quarters for this metric: show a dash, never a stand-in series.
            if (a.length === 0) {
              return { k, last: "—", yoy: "no data", col: STEEL, q0: QL[0], q1: QL[1], bars: [] as FundBar[] };
            }
            const lastIdx = a.length - 1;
            const yoyBaseIdx = Math.max(0, lastIdx - 4);
            const mxv = Math.max(...a) || 1;
            const yoy = yoyBaseIdx < lastIdx && a[yoyBaseIdx] !== 0
              ? ((a[lastIdx] / (a[yoyBaseIdx] || 1)) - 1) * 100
              : 0;
            const good = i === 5 ? yoy <= 0 : yoy >= 0;
            return {
              k,
              last: f(a[lastIdx]),
              yoy: pct1(yoy) + " y/y",
              col: good ? UP : DN,
              q0: QL[0],
              q1: QL[1],
              bars: a.map((v, j): FundBar => {
                const q = fmpQ?.[j];
                return {
                  h: Math.max(6, Math.round((Math.abs(v) / (mxv || 1)) * 100)) + "%",
                  c: j === lastIdx ? STEEL : "rgba(89,128,166,0.38)",
                  label: q ? `${q.fiscalPeriod || "Q"} '${(q.fiscalYear || "").slice(-2)}` : `Quarter ${j + 1}`,
                  end: q?.endDate ? fmtMarketDate(q.endDate, { month: "short", day: "numeric", year: "numeric" }) : "",
                  value: f(v),
                  qoq: j > 0 ? chgPct(v, a[j - 1]) : null,
                  yoy: j >= 4 ? chgPct(v, a[j - 4]) : null,
                  note: barNote(i, q),
                };
              }),
            };
          });

          const semi = stock.sector === "Semiconductor" || stock.sector === "Semiconductors";
          const livePe = liveCompany?.peRatio ?? stock.pe;

          const mcapNum = liveCompany?.marketCap ?? null;
          const ttmEbitda = fmpQ && fmpQ.length >= 4
            ? fmpQ.slice(-4).reduce((sum, q) => sum + (q.ebitda ?? q.operatingIncome ?? 0), 0)
            : null;
          const latestQ = fmpQ && fmpQ.length > 0 ? fmpQ[fmpQ.length - 1] : null;
          const latestDebt = latestQ ? (latestQ.totalDebt ?? latestQ.longTermDebt ?? null) : null;
          const hasTotalDebt = latestQ?.totalDebt != null;
          const latestCash = latestQ ? (latestQ.cashAndCashEquivalents ?? null) : null;

          // Enterprise Value = Market Capitalization + Debt - Cash and Cash Equivalents
          // If required inputs (mcap, debt, or cash) are unavailable, do not assume zero.
          const enterpriseVal = (mcapNum != null && latestDebt != null && latestCash != null)
            ? mcapNum + latestDebt - latestCash
            : null;
          const realEvEbitda = (!isBank && enterpriseVal != null && ttmEbitda != null && Number.isFinite(ttmEbitda) && ttmEbitda > 0)
            ? enterpriseVal / ttmEbitda
            : null;

          const ttmFcf = computeTtmFcf(fmpQ);
          const realFcfYield = (!isBank && ttmFcf != null && mcapNum != null && Number.isFinite(mcapNum) && mcapNum > 0)
            ? (ttmFcf / mcapNum) * 100
            : null;

          // ── Financial health (latest quarter) and earnings quality (trailing 12 months) ──
          // Graded as in the design, from the quarterly statements already synced. A figure whose inputs are
          // missing shows a dash, never a zero. Kept from the earlier Fundamentals fixes: banks are skipped (debt,
          // current ratio and free cash flow do not mean the same for them), debt that is long-term only is
          // labelled "LT debt", and a negative equity or a loss-making year reads "n/m" instead of a misleading ratio.
          type HealthRow = { k: string; v: string; note: string; col: string };
          const GOOD = "#2fb86a", MID = "#f0a23b", BAD = "#e5534b", SKY = "#4fb3ff";
          const ttm4 = !isBank && fmpQ && fmpQ.length >= 4 ? fmpQ.slice(-4) : null;
          const sum4 = (pick: (q: QuarterFinancials) => number | null | undefined): number | null => {
            if (!ttm4) return null;
            let s = 0;
            for (const q of ttm4) {
              const v = pick(q);
              if (v == null || !Number.isFinite(v)) return null;
              s += v;
            }
            return s;
          };
          const dollars = (v: number | null) => (v == null ? "—" : usdRaw(v));
          const fundNow = !isBank ? latestQ : null;
          const netDebt = fundNow && latestDebt != null && latestCash != null ? latestDebt - latestCash : null;
          const curRatio = fundNow
            ? fundNow.currentRatio ?? (fundNow.currentAssets != null && fundNow.currentLiabilities ? fundNow.currentAssets / fundNow.currentLiabilities : null)
            : null;
          const curRatioOk = curRatio != null && Number.isFinite(curRatio) ? curRatio : null;
          const equityNow = fundNow?.equity ?? null;
          const debtEquity = fundNow && latestDebt != null && equityNow != null && equityNow > 0 ? latestDebt / equityNow : null;
          const debtEbitda = fundNow && latestDebt != null && ttmEbitda != null && ttmEbitda > 0 ? latestDebt / ttmEbitda : null;
          const healthRows: HealthRow[] = fundNow
            ? [
                { k: "Cash", v: dollars(latestCash), note: "Cash and equivalents", col: STEEL },
                hasTotalDebt || latestDebt == null
                  ? { k: "Total debt", v: dollars(latestDebt), note: "Short and long term, incl. leases", col: STEEL }
                  : { k: "LT debt", v: dollars(latestDebt), note: "Long-term debt only", col: STEEL },
                {
                  k: netDebt != null && netDebt <= 0 ? "Net cash" : "Net debt",
                  v: netDebt == null ? "—" : dollars(Math.abs(netDebt)),
                  note: netDebt == null ? "" : netDebt <= 0 ? "More cash than debt" : "Debt is more than its cash",
                  col: netDebt == null ? STEEL : netDebt <= 0 ? GOOD : MID,
                },
                {
                  k: "Current ratio",
                  v: curRatioOk != null ? `${curRatioOk.toFixed(2)}×` : "—",
                  note: curRatioOk == null ? "" : curRatioOk >= 1.5 ? "Covers short-term bills comfortably" : curRatioOk >= 1 ? "Covers short-term bills, thinly" : "Short-term bills exceed liquid assets",
                  col: curRatioOk == null ? STEEL : curRatioOk >= 1.5 ? GOOD : curRatioOk >= 1 ? MID : BAD,
                },
                equityNow != null && equityNow <= 0 && latestDebt != null
                  ? { k: "Debt / equity", v: "n/m", note: "Shareholder equity is negative", col: MID }
                  : {
                      k: "Debt / equity",
                      v: debtEquity != null ? `${debtEquity.toFixed(2)}×` : "—",
                      note: debtEquity == null ? "" : debtEquity < 0.5 ? "Lightly borrowed" : debtEquity < 1.5 ? "Moderately borrowed" : "Heavily borrowed",
                      col: debtEquity == null ? STEEL : debtEquity < 0.5 ? GOOD : debtEquity < 1.5 ? MID : BAD,
                    },
                {
                  k: "Debt / EBITDA",
                  v: debtEbitda != null ? `${debtEbitda.toFixed(1)}×` : "—",
                  note: debtEbitda == null ? "" : debtEbitda < 1 ? "Repaid in under a year of earnings" : debtEbitda < 3 ? `Repaid in about ${Math.round(debtEbitda)} years of earnings` : "Many years of earnings to repay",
                  col: debtEbitda == null ? STEEL : debtEbitda < 1 ? GOOD : debtEbitda < 3 ? MID : BAD,
                },
              ]
            : [];

          const ttmRev = sum4((q) => q.revenue);
          const ttmNi = sum4((q) => q.netIncome);
          const ttmFcf4 = sum4((q) => computeQuarterFcf(q));
          const ttmCapex = sum4((q) => (q.capitalExpenditures != null ? Math.abs(q.capitalExpenditures) : null));
          const ofSales = (v: number | null) => (v != null && ttmRev != null && ttmRev > 0 ? (v / ttmRev) * 100 : null);
          const fcfMargin = ofSales(ttmFcf4), netMargin = ofSales(ttmNi), capexSales = ofSales(ttmCapex);
          const cashConv = ttmFcf4 != null && ttmNi != null && ttmNi > 0 ? ttmFcf4 / ttmNi : null;
          const marginCol = (m: number | null) => (m == null ? STEEL : m >= 10 ? GOOD : m >= 0 ? MID : BAD);
          const pctOrDash = (m: number | null) => (m == null ? "—" : `${m.toFixed(1)}%`);
          const qualityRows: HealthRow[] = fundNow
            ? [
                { k: "FCF margin", v: pctOrDash(fcfMargin), note: "Free cash flow per $ of sales", col: marginCol(fcfMargin) },
                { k: "Net margin", v: pctOrDash(netMargin), note: "Profit per $ of sales", col: marginCol(netMargin) },
                { k: "Capex / sales", v: pctOrDash(capexSales), note: "Spent on equipment and buildings", col: STEEL },
                ttmNi != null && ttmNi <= 0 && ttmFcf4 != null
                  ? { k: "Cash conversion", v: "n/m", note: "No profit over the last 12 months", col: MID }
                  : {
                      k: "Cash conversion",
                      v: cashConv != null ? `${cashConv.toFixed(2)}×` : "—",
                      note: cashConv != null ? `$${cashConv.toFixed(2)} of free cash per $1 of profit` : "",
                      col: cashConv == null ? STEEL : cashConv >= 0.9 ? GOOD : cashConv >= 0.5 ? MID : BAD,
                    },
              ]
            : [];

          // PEG = trailing P/E ÷ expected EPS growth (next fiscal year's estimate
          // vs the year in progress) — not one quarter's volatile y/y change.
          const expGrowth = siFacts.fwdEps != null && siFacts.nextFyEps != null && siFacts.fwdEps > 0
            ? (siFacts.nextFyEps / siFacts.fwdEps - 1) * 100
            : null;
          const realPeg = (livePe != null && livePe > 0 && expGrowth != null && expGrowth > 0)
            ? livePe / expGrowth
            : null;

          const evLabel = latestQ && !hasTotalDebt && latestQ.longTermDebt != null ? "EV/EBITDA (LT Debt)" : "EV/EBITDA";

          // Reference benchmark medians by sector (semiconductor vs general market)
          // Outlier multiples (e.g. >100x P/E) are rendered dynamically with log-scale / proportional upper bounds.
          const basePe = semi ? 38.0 : 22.0;
          const baseFpe = semi ? 31.2 : 16.8;
          const baseEv = semi ? 29.4 : 14.2;

          const VV: [string, string, number, string, number][] = [
            ["P/E", livePe != null ? livePe.toFixed(1) : "—", basePe, "×", livePe ?? 0],
            ["Forward P/E", stock.fpe != null ? stock.fpe.toFixed(1) : "—", baseFpe, "×", stock.fpe ?? 0],
            [evLabel, realEvEbitda != null && Number.isFinite(realEvEbitda) && realEvEbitda > 0 ? realEvEbitda.toFixed(1) : "—", baseEv, "×", realEvEbitda && realEvEbitda > 0 ? realEvEbitda : 0],
            ["PEG", realPeg != null && Number.isFinite(realPeg) && realPeg > 0 ? realPeg.toFixed(2) : "—", 1.45, "", realPeg && realPeg > 0 ? realPeg : 0],
            ["FCF Yield", realFcfYield != null && Number.isFinite(realFcfYield) ? realFcfYield.toFixed(1) : "—", 2.6, "%", realFcfYield && realFcfYield > 0 ? realFcfYield : 0],
          ];
          const valRows = VV.map(([k, vStr, med, u, numVal]) => {
            // Generic outlier scaling: if metric is > 4x benchmark, use dynamic scaling
            const top = Math.max(numVal, med) * 1.25 || 1;
            return {
              k,
              v: vStr !== "—" ? vStr + u : "—",
              med: med + u,
              w: vStr !== "—" ? Math.min(100, (numVal / top) * 100).toFixed(1) + "%" : "0%",
              m: Math.min(100, (med / top) * 100).toFixed(1) + "%",
            };
          });

          // ── Margin trend: gross, operating and net margin over the quarters shown ──
          const marginPct = (stated: number | null | undefined, part: number | null | undefined, rev: number | null | undefined) =>
            stated != null && Number.isFinite(stated) ? stated : part != null && rev ? (part / rev) * 100 : null;
          const noGrossLine = isBank || (fmpQ ?? []).every((q) => q.grossProfit != null && q.operatingIncome != null && q.grossProfit === q.operatingIncome);
          const marginLines = isBank || !fmpQ || fmpQ.length < 3 ? [] : ([
            { k: "Gross", col: "#c9d6e3", on: !noGrossLine, vals: fmpQ.map((q) => marginPct(q.grossMarginPct, q.grossProfit, q.revenue)) },
            { k: "Operating", col: GOOD, on: true, vals: fmpQ.map((q) => marginPct(q.operatingMarginPct, q.operatingIncome, q.revenue)) },
            { k: "Net", col: MID, on: true, vals: fmpQ.map((q) => marginPct(q.netMarginPct, q.netIncome, q.revenue)) },
          ] as Array<{ k: string; col: string; on: boolean; vals: Array<number | null> }>).filter((l) => l.on && l.vals.filter((v) => v != null).length >= 3);
          const marginAll = marginLines.flatMap((l) => l.vals.filter((v): v is number => v != null));
          const mLo = marginAll.length ? Math.min(...marginAll) : 0, mHi = marginAll.length ? Math.max(...marginAll) : 1;
          const mPad = (mHi - mLo || 1) * 0.12;
          const MW = 300, MH = 120, mCount = fmpQ?.length ?? 0;
          const mx = (i: number) => (mCount > 1 ? (i / (mCount - 1)) * (MW - 8) + 4 : MW / 2);
          const my = (v: number) => MH - 6 - ((v - (mLo - mPad)) / (mHi + mPad - (mLo - mPad) || 1)) * (MH - 12);

          // ── Scorecard: four plain grades, each from one visible number (the design's rules) ──
          const quarters = fmpQ ?? [];
          const qNow = quarters.length ? quarters[quarters.length - 1] : null;
          const qYearAgo = quarters.length >= 5 ? quarters[quarters.length - 5] : null;
          const opMarginOf = (q: QuarterFinancials | null) => (q ? marginPct(q.operatingMarginPct, q.operatingIncome, q.revenue) : null);
          const growthYoY = qNow && qYearAgo && qYearAgo.revenue ? ((qNow.revenue ?? 0) / qYearAgo.revenue - 1) * 100 : null;
          const opNow = isBank ? null : opMarginOf(qNow), opThen = isBank ? null : opMarginOf(qYearAgo);
          const peNow = livePe != null && livePe > 0 ? livePe : null;
          const peRel = peNow != null ? peNow / basePe : null;
          type Verdict = { word: string; col: string };
          const NO_DATA: Verdict = { word: "No data", col: STEEL };
          const growthGrade: Verdict = growthYoY == null ? NO_DATA : growthYoY >= 15 ? { word: "Strong", col: GOOD } : growthYoY >= 3 ? { word: "Steady", col: STEEL } : growthYoY >= -3 ? { word: "Flat", col: MID } : { word: "Weak", col: BAD };
          const profitGrade: Verdict = opNow == null ? NO_DATA : opNow >= 20 ? { word: "Strong", col: GOOD } : opNow >= 10 ? { word: "Solid", col: STEEL } : opNow >= 0 ? { word: "Thin", col: MID } : { word: "Losing money", col: BAD };
          const healthGrade: Verdict = netDebt == null ? NO_DATA : netDebt <= 0 ? { word: "Strong", col: GOOD } : (curRatioOk != null && curRatioOk < 1) || (debtEquity != null && debtEquity > 2) ? { word: "Weak", col: BAD } : { word: "Mixed", col: MID };
          const valGrade: Verdict = peRel == null ? NO_DATA : peRel <= 0.95 ? { word: "Attractive", col: GOOD } : peRel <= 1.3 ? { word: "Fair", col: STEEL } : { word: "Stretched", col: BAD };
          const figure = (text: string, color: string) => <span style={{ color, fontWeight: 700 }}>{text}</span>;
          const upDown = (v: number) => (v >= 0 ? GOOD : BAD);
          const scoreCards: Array<{ k: string; label: string; g: Verdict; sub: React.ReactNode }> = [
            { k: "GROWTH", label: "Growth", g: growthGrade, sub: growthYoY != null ? <>Revenue {figure(pct1(growthYoY), upDown(growthYoY))} y/y</> : "Revenue growth unavailable" },
            {
              k: "PROFITABILITY",
              label: "Profitability",
              g: profitGrade,
              sub: isBank
                ? "Not graded for banks"
                : opNow != null
                  ? <>Operating margin {figure(`${opNow.toFixed(1)}%`, opNow >= 10 ? GOOD : opNow >= 0 ? MID : BAD)}{opThen != null ? <> ({figure(`${opNow - opThen >= 0 ? "+" : "−"}${Math.abs(opNow - opThen).toFixed(1)} pts`, upDown(opNow - opThen))} y/y)</> : null}</>
                  : "Operating margin unavailable",
            },
            {
              k: "FINANCIAL HEALTH",
              label: "Financial Health",
              g: healthGrade,
              sub: isBank ? "Not graded for banks" : netDebt != null ? (netDebt <= 0 ? <>Net cash {figure(dollars(-netDebt), GOOD)}</> : <>Net debt {figure(dollars(netDebt), BAD)}</>) : "Balance sheet unavailable",
            },
            {
              k: "VALUATION",
              label: "Valuation",
              g: valGrade,
              sub: peNow != null ? <>P/E {figure(`${peNow.toFixed(1)}×`, peNow <= basePe * 0.95 ? GOOD : peNow <= basePe * 1.3 ? SKY : BAD)} vs {figure(`${basePe}×`, SKY)} sector reference</> : "P/E unavailable",
            },
          ];
          // The card shell and heading shared by the balance-sheet, cash-quality and margin cards.
          const fundCard: React.CSSProperties = { border: "1px solid var(--si-border, #232830)", background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 };
          const fundCardHead = (title: string, sub: string) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span data-caps style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>{title}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-white, #ffffff)", opacity: 0.6 }}>{sub}</span>
            </div>
          );

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Scorecard: one grade per question, each from the number shown under it */}
              {qNow && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                  {scoreCards.map((c) => (
                    <div key={c.k} style={{ border: `1px solid ${c.g.col}`, background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ display: "flex", alignItems: "center" }}>
                          <span data-caps style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.14em", color: "var(--si-text-white, #ffffff)", opacity: 0.7 }}>{c.label}</span>
                          <InfoTip lines={SCORECARD_INFO[c.k] ?? []} />
                        </span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800, color: c.g.col, textAlign: "right" }}>{c.g.word}</span>
                      </span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, color: "var(--si-text-white, #ffffff)", lineHeight: 1.5 }}>{c.sub}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 6 Financial Metric Cards with 8-Quarter Mini-Bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
                {fundMetrics.map((fm, idx) => {
                  const selKey = `${stock.t}:${idx}`;
                  const selIdx = fundSel[selKey];
                  const selBar = selIdx != null ? fm.bars[selIdx] : undefined;
                  // Revenue, EPS, margins and cash flow are better when higher; debt when lower.
                  const chgCol = (v: number) => ((idx === 5 ? -v : v) >= 0 ? UP : DN);
                  return (
                  <div key={idx} style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", columnGap: 8 }}>
                      <span data-caps style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "var(--si-accent-light, #a9c6e3)", whiteSpace: "nowrap" }}>
                        {fm.k}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: fm.col, whiteSpace: "nowrap" }}>
                        {fm.yoy}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                      {fm.last}
                    </div>
                    <div style={{ height: 80, display: "flex", alignItems: "flex-end", gap: 5, padding: "4px 0" }}>
                      {fm.bars.map((br, bIdx) => {
                        const picked = bIdx === selIdx;
                        return (
                          <button
                            key={bIdx}
                            type="button"
                            aria-pressed={picked}
                            aria-label={`${fm.k} ${br.label}: ${br.value}`}
                            title={`${br.label} · ${br.value}`}
                            onClick={() =>
                              setFundSel((prev) => {
                                const next = { ...prev };
                                if (next[selKey] === bIdx) delete next[selKey];
                                else next[selKey] = bIdx;
                                return next;
                              })
                            }
                            onMouseEnter={(e) => {
                              if (!picked) e.currentTarget.style.background = "rgba(127,168,208,0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = picked ? "rgba(127,168,208,0.14)" : "transparent";
                            }}
                            style={{
                              flex: 1,
                              height: "100%",
                              display: "flex",
                              alignItems: "flex-end",
                              padding: 0,
                              border: "none",
                              cursor: "pointer",
                              background: picked ? "rgba(127,168,208,0.14)" : "transparent",
                            }}
                          >
                            <span style={{ display: "block", width: "100%", height: br.h, background: picked ? "var(--si-accent-light, #a9c6e3)" : br.c, transition: "height 300ms ease" }} />
                          </button>
                        );
                      })}
                    </div>
                    {selBar && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: "var(--si-accent-light, #a9c6e3)" }}>{selBar.label}</span>
                          {selBar.end && <span style={{ color: "var(--si-text-sub, #5d6b79)" }}>ended {selBar.end}</span>}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>{selBar.value}</div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                          {selBar.qoq != null && <span style={{ color: chgCol(selBar.qoq) }}>{pct1(selBar.qoq)} q/q</span>}
                          {selBar.yoy != null && <span style={{ color: chgCol(selBar.yoy) }}>{pct1(selBar.yoy)} y/y</span>}
                          {selBar.qoq == null && selBar.yoy == null && <span style={{ color: "var(--si-text-sub, #5d6b79)" }}>earliest quarter shown</span>}
                        </div>
                        {selBar.note && (
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-dim, #93a1af)", lineHeight: 1.4 }}>{selBar.note}</div>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--si-text-sub, #5d6b79)" }}>
                      <span>{fm.q0}</span>
                      {fm.bars.length > 0 && !selBar && <span style={{ opacity: 0.7 }}>click a bar</span>}
                      <span>{fm.q1}</span>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Financial health (balance sheet), earnings quality (cash vs profit) and margin trend */}
              {(healthRows.length > 0 || marginLines.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 18, alignItems: "stretch" }}>
                  {[
                    { title: "Financial Health", sub: `${QL[1]} balance sheet`, rows: healthRows },
                    { title: "Earnings Quality", sub: "Last 12 months", rows: qualityRows },
                  ].filter((p) => p.rows.length > 0).map((p) => (
                    <div key={p.title} style={fundCard}>
                      {fundCardHead(p.title, p.sub)}
                      {p.rows.map((r) => (
                        <div key={r.k} style={{ display: "grid", gridTemplateColumns: "10px minmax(100px,128px) minmax(64px,86px) minmax(110px,1fr)", alignItems: "center", columnGap: 12, padding: "8px 0" }}>
                          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: r.col }} />
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, color: "var(--si-text-white, #ffffff)", opacity: 0.9 }}>{r.k}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: r.col === STEEL ? SKY : r.col, textAlign: "right" }}>{r.v}</span>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-white, #ffffff)", opacity: 0.75, lineHeight: 1.4 }}>{r.note}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {marginLines.length > 0 && fmpQ && (
                    <div style={fundCard}>
                      {fundCardHead("Margin Trend", `${QL[0]} to ${QL[1]}`)}
                      <svg viewBox={`0 0 ${MW} ${MH}`} width="100%" height={130} preserveAspectRatio="none" role="img" aria-label="Gross, operating and net margin by quarter">
                        {[0.25, 0.5, 0.75].map((f) => (
                          <line key={f} x1={0} x2={MW} y1={MH * f} y2={MH * f} stroke="rgba(147,161,175,0.12)" strokeWidth={1} />
                        ))}
                        {marginLines.map((l) => {
                          const pts = l.vals.map((v, i) => (v == null ? null : `${mx(i).toFixed(1)},${my(v).toFixed(1)}`)).filter(Boolean).join(" ");
                          return pts ? <polyline key={l.k} points={pts} fill="none" stroke={l.col} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null;
                        })}
                      </svg>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
                        {marginLines.map((l) => {
                          const now = l.vals[l.vals.length - 1] ?? null;
                          const then = l.vals.length >= 5 ? l.vals[l.vals.length - 5] ?? null : null;
                          const diff = now != null && then != null ? now - then : null;
                          return (
                            <span key={l.k} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--si-text-mid, #93a1af)" }}>
                              <span style={{ width: 12, height: 2, background: l.col }} />
                              {l.k}{" "}
                              <b style={{ color: "var(--si-text-hi, #e8eef4)" }}>{now != null ? `${now.toFixed(1)}%` : "—"}</b>
                              <span style={{ color: diff != null && diff < 0 ? DN : UP }}>{diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts y/y` : ""}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Valuation & Peer Comparison Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 18, alignItems: "start" }}>
                {/* Valuation Multiples vs Reference Benchmark */}
                <div style={{ border: "1px solid var(--si-border, #232830)", background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span data-caps style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      Valuation Multiples
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-white, #ffffff)", opacity: 0.8 }}>
                      ▮ {stock.t} &nbsp; ┃ Reference Benchmark
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-white, #ffffff)", opacity: 0.75, lineHeight: 1.5 }}>
                    Reference benchmarks (indicated by ┃ and right column) are static sector reference values, not live peer-company medians.
                  </div>
                  {valRows.map((vl, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, height: 34 }}>
                      <span style={{ width: 120, fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 600, color: "var(--si-text-white, #ffffff)" }}>
                        {vl.k}
                      </span>
                      <div style={{ position: "relative", flex: 1, height: 10, background: "#232830" }}>
                        <div style={{ height: 10, width: vl.w, background: "#5980a6" }} />
                        <div style={{ position: "absolute", top: -4, left: vl.m, width: 2, height: 18, background: "#e8eef4", boxShadow: "0 0 6px rgba(255,255,255,0.4)" }} />
                      </div>
                      <span style={{ width: 76, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: SKY }}>
                        {vl.v}
                      </span>
                      <span style={{ width: 70, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--si-text-white, #ffffff)", opacity: 0.7 }}>
                        {vl.med}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Peer Comparison Table */}
                <div style={{ border: "1px solid var(--si-border, #232830)", background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span data-caps style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>
                      Peer Comparison
                    </span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-white, #ffffff)", opacity: 0.75 }}>
                      Click any peer to open in SI
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.4fr) repeat(6, minmax(75px, 1fr))", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-accent, #5980a6)", padding: "6px 0", borderBottom: "1px solid var(--si-border, #232830)" }}>
                    <span>Company</span>
                    <span style={{ textAlign: "right" }}>Price</span>
                    <span style={{ textAlign: "right" }}>Change</span>
                    <span style={{ textAlign: "right" }} title="Year to date: price vs the last close of the prior year. A * means it was listed this year, so it is measured from its first close.">YTD</span>
                    <span style={{ textAlign: "right" }}>Mkt cap</span>
                    <span style={{ textAlign: "right" }}>P/E</span>
                    <span style={{ textAlign: "right" }}>RS rank</span>
                  </div>
                  {peersPending ? (
                    <div aria-busy="true" style={{ padding: "8px 0" }}>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} style={{ height: 38, margin: "8px 0", borderRadius: 6, background: "rgba(147,161,175,0.08)" }} />
                      ))}
                    </div>
                  ) : peersAll.length === 0 ? (
                    <div style={{ padding: "18px 0", textAlign: "center", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 13 }}>
                      No peer companies reported for {stock.t}.
                    </div>
                  ) : (
                    peersAll.map((peer) => {
                      const chgCol = (peer.c ?? 0) >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)";
                      const chgStr = peer.c != null ? `${peer.c >= 0 ? "+" : ""}${peer.c.toFixed(2)}%` : "—";
                      const ytdInfo = peerYtdBase.get(peer.t);
                      const ytdBase = ytdInfo?.base ?? null;
                      const ytd = peer.price != null && peer.price > 0 && ytdBase != null && ytdBase > 0
                        ? (peer.price / ytdBase - 1) * 100
                        : null;
                      const ytdCol = (ytd ?? 0) >= 0 ? "var(--up, #16a34a)" : "var(--down, #dc2626)";
                      // Listed this year: measured from its first close, marked with * and explained on hover.
                      const ytdSince = ytd != null ? ytdInfo?.since ?? null : null;
                      const ytdStr = ytd != null ? `${ytd >= 0 ? "+" : ""}${ytd.toFixed(2)}%${ytdSince ? "*" : ""}` : "—";
                      const ytdTitle = ytdSince ? `Since it began trading (first close ${fmtMarketDate(ytdSince, { month: "short", day: "numeric", year: "numeric" })}): it was listed this year` : undefined;
                      const pStr = peer.price != null ? `$${peer.price >= 10 ? peer.price.toFixed(2) : peer.price.toFixed(3)}` : "—";
                      const mcapStr = peer.marketCap != null ? `$${peer.marketCap >= 1000 ? (peer.marketCap / 1000).toFixed(2) + "T" : peer.marketCap.toFixed(1) + "B"}` : "—";
                      const peStr = peer.peRatio != null && Number.isFinite(peer.peRatio) && peer.peRatio > 0 ? `${peer.peRatio.toFixed(1)}×` : "—";
                      const rsStr = peer.rsRating != null ? String(peer.rsRating) : "—";

                      return (
                        <div
                          key={peer.t}
                          onClick={() => setPendingPeerOpen({ ticker: peer.t, name: peer.name })}
                          role="button"
                          tabIndex={0}
                          title={`Click to open ${peer.t} in Stock Intelligence`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setPendingPeerOpen({ ticker: peer.t, name: peer.name });
                            }
                          }}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(140px, 1.4fr) repeat(6, minmax(75px, 1fr))",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            color: "var(--si-text-hi, #e8eef4)",
                            padding: "10px 8px",
                            borderBottom: "1px solid var(--si-border, #232830)",
                            cursor: "pointer",
                            borderRadius: 4,
                            transition: "background 150ms ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(89, 128, 166, 0.12)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, minWidth: 0 }}>
                            <StockLogo sym={peer.t} size={18} />
                            <span style={{ color: "var(--si-accent-light, #a9c6e3)" }}>{peer.t}</span>
                            <span style={{ fontSize: 11, color: "var(--si-text-dim, #64748b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {peer.name !== peer.t ? peer.name : ""}
                            </span>
                          </span>
                          <span style={{ textAlign: "right" }}>{pStr}</span>
                          <span style={{ textAlign: "right", color: chgCol, fontWeight: 600 }}>{chgStr}</span>
                          <span title={ytdTitle} style={{ textAlign: "right", color: ytd == null ? "var(--si-text-mid, #93a1af)" : ytdCol, fontWeight: 600, cursor: ytdTitle ? "help" : undefined }}>{ytdStr}</span>
                          <span style={{ textAlign: "right" }}>{mcapStr}</span>
                          <span style={{ textAlign: "right" }}>{peStr}</span>
                          <span style={{ textAlign: "right", color: "var(--si-text-mid, #93a1af)" }}>{rsStr}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ====================================================
            TAB 5: TECHNICALS (Issue 2: Full Live Technical Chart)
            ==================================================== */}
        {activeTab === "tech" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <TechnicalTiles reads={stockDetail.read} facts={siFacts} high52={hi52} />
            <div className="si-ov" style={{ alignItems: "stretch" }}>
              <style>{`.si-ov{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr);gap:18px;align-items:start}@media (max-width:1050px){.si-ov{grid-template-columns:minmax(0,1fr)}}`}</style>
              {/* Live technical chart with the full MC stock-function toolbar */}
            <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", minWidth: 0 }}>
              <div className="si-tech-chart" style={{ minHeight: 540, width: "100%" }}>
                <style>{`.si-tech-chart .cc-tvbtn.icon{display:none}.si-tech-chart .cc-tvbtn{display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:12.96px;font-weight:500;line-height:1.2;padding:6px 8px;background:none;border:0;color:var(--si-text-hi,#e8eef4);cursor:pointer;white-space:nowrap}.si-tech-chart .cc-tvbtn svg{opacity:.75}.si-tech-chart .cc-tvbtn b{font-weight:600}.si-tech-chart .cc-tvbtn b{font-size:inherit}${isLight ? "" : ".si-tech-chart .rng.indbtn{padding:4px 9px;border-radius:6px;font-weight:600;color:#6c747c;background:transparent}.si-tech-chart .rng.indbtn.on{background:#14181b;color:#f4f6f5}.si-tech-chart .cc-ma.on .cc-ma-all,.si-tech-chart .cc-ma.on .cc-ma-all *{color:#f4f6f5}.si-tech-chart .cc-ma:not(.on) .cc-ma-all,.si-tech-chart .cc-ma:not(.on) .cc-ma-all *{color:#6c747c}"}`}</style>
                <StockChart
                  sym={stock.t}
                  name={stock.name || liveCompany?.name}
                  interval={barInterval}
                  onIntervalChange={setBarInterval}
                  expandable
                  height={540}
                  data={{
                    live,
                    bars: { bars: realBars, loading: barsLoading },
                    yearBars: yearBars ?? null,
                    news: tickerNews,
                    earnings: chartEarnings,
                  }}
                />
              </div>
            </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
                <div style={{ border: "1px solid var(--si-border, #232830)", background: "var(--si-card, rgba(20, 23, 28, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", marginBottom: 8 }}>
                    <span data-caps>Where Price Sits {"\u00B7"} Support &amp; Resistance</span>
                  </span>
                  <PriceLadder price={siFacts.price} {...supportResistance(siFacts)} max={4} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 7: AI RESEARCH
            ==================================================== */}
        {activeTab === "ai" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18, alignItems: "start" }}>
            <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", display: "flex", flexDirection: "column", minHeight: 560 }}>
              <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
                  <span data-caps>✦ AI research copilot</span>
                </span>
              </div>
              <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {aiAnalysisDoc?.analysis && (
                  <div style={{ border: "1px solid rgba(127,168,208,0.25)", background: "var(--si-card-tint, rgba(20, 23, 28, 0.6))", padding: "14px 16px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      {aiAnalysisDoc.analysis.headline && (
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                          {aiAnalysisDoc.analysis.headline}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                      {[aiAnalysisDoc.analysis.newsSummary, aiAnalysisDoc.analysis.technicalSummary]
                        .filter((t): t is string => !!t)
                        .flatMap((t) => t.split(/(?<=\.) (?=[A-Z])/))
                        .map((sentence, n) => (
                          <div key={n} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", display: "flex", gap: 10, lineHeight: 1.5 }}>
                            <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>{"▸"}</span>
                            <span>{highlightNumbers(sentence)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {aiChat.length === 0 && !aiAnalysisDoc?.analysis && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.6 }}>
                    Ask anything about {stock.t}. The assistant already has full knowledge of current signals, catalysts, valuation metrics, and intraday factor attribution.
                  </div>
                )}
                {aiChat.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      // Theme tokens, not fixed dark values: the reply bubble was a
                      // hard-coded near-black, so in day mode the (dark) text sat
                      // on a dark box and could not be read.
                      border: m.role === "user" ? "1px solid #5980a6" : "1px solid var(--si-border, #1c2733)",
                      background: m.role === "user" ? "rgba(89,128,166,0.18)" : "var(--si-card, rgba(12,17,24,0.95))",
                      padding: "12px 16px",
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: 14.5,
                      color: "var(--si-text-hi, #e8eef4)",
                      lineHeight: 1.55,
                      whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                    }}
                  >
                    {m.role === "user" ? m.text : formatAiChatReply(m.text)}
                    {m.note && (
                      <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-sub, #5d6b79)", lineHeight: 1.4 }}>
                        {m.note}
                      </div>
                    )}
                  </div>
                ))}
                {aiBusy && (
                  <div style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-accent-soft, #7fa8d0)" }}>
                    Synthesizing research on {stock.t}…
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", padding: 12, display: "flex", gap: 8 }}>
                <input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                  placeholder={`Ask about ${stock.t}…`}
                  style={{
                    flex: 1,
                    height: 42,
                    background: "var(--si-bg, #080b10)",
                    border: "1px solid var(--si-border-sec, #2a3a4a)",
                    color: "var(--si-text-hi, #e8eef4)",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 14,
                    padding: "0 14px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => handleAskAI()}
                  style={{
                    height: 42,
                    padding: "0 18px",
                    border: "none",
                    background: "#5980a6",
                    color: "#ffffff",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ask
                </button>
              </div>
            </div>

            {/* Suggested Prompts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                <span data-caps>Suggested Research Questions</span>
              </div>
              {[
                `What is the institutional bull case for ${stock.t}?`,
                `What is the biggest downside risk or bear trade?`,
                `What exact price and metric levels invalidate this setup?`,
                `How does ${stock.t}'s valuation compare against peers?`,
              ].map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleAskAI(sq)}
                  style={{
                    textAlign: "left",
                    border: "1px solid var(--si-border, #1c2733)",
                    background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                    padding: 14,
                    color: "var(--si-text-hi, #e8eef4)",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 13.5,
                    lineHeight: 1.4,
                    cursor: "pointer",
                  }}
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 8: THESIS LAB (Issue 6 & 7: Full Scenario Engine)
            ==================================================== */}
        {activeTab === "lab" && (() => {
          if (!labStarted) {
            const ready = pickDir != null && pickHz != null && pickMode != null;
            const stepLabel: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 8 };
            const choice = (active: boolean, accent: string, disabled: boolean): React.CSSProperties => ({
              height: 44,
              minWidth: 120,
              padding: "0 18px",
              border: `1px solid ${active ? accent : "#1c2733"}`,
              background: active ? "rgba(89,128,166,0.2)" : "transparent",
              color: "var(--si-text-hi, #ffffff)",
              opacity: disabled ? 0.35 : 1,
              fontFamily: "'Manrope', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "background 160ms, border-color 160ms",
            });
            return (
              <>
                {labSavedNote && (
                  <div style={{ maxWidth: 780, width: "100%", margin: "14px auto -6px", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.07)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--up, #4ade80)", fontSize: 16 }}>✓</span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-hi, #ffffff)" }}>{labSavedNote}</span>
                    <button
                      onClick={() => {
                        setLabSavedNote(null);
                        setActiveTab("mon");
                      }}
                      style={{ marginLeft: "auto", height: 30, padding: "0 12px", border: "1px solid var(--si-accent, #5980a6)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}
                    >
                      VIEW IN TRADE TRACKER ▸
                    </button>
                    <button onClick={() => setLabSavedNote(null)} aria-label="Dismiss" style={{ width: 26, height: 26, border: "none", background: "transparent", color: "var(--si-text-hi, #ffffff)", fontSize: 16, cursor: "pointer" }}>
                      ×
                    </button>
                  </div>
                )}
                <div
                  id="si-trade-builder-top"
                  style={{ scrollMarginTop: 110, maxWidth: 780, width: "100%", margin: "14px auto 20px", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "22px 30px", display: "flex", flexDirection: "column", gap: 20 }}
                >
                  <div>
                    <div data-caps style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)", textShadow: "0 0 6px rgba(127, 168, 208, 0.75), 0 0 14px rgba(89, 128, 166, 0.55)" }}>Trade Builder</div>
                    <div data-caps style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, color: "var(--si-text-hi, #ffffff)", marginTop: 4, lineHeight: 1.05 }}>Build your trade strategy for {stock.t}</div>
                  </div>
                  <div>
                    <div data-caps style={stepLabel}>Step 1 · Direction</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(["Bull", "Bear"] as const).map((d) => (
                        <button key={d} onClick={() => setPickDir(d)} style={choice(pickDir === d, d === "Bull" ? UP : DN, false)}>
                          {d === "Bull" ? "▲ Bullish" : "▼ Bearish"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div data-caps style={stepLabel}>Step 2 · Horizon</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["1M", "3M", "6M", "9M"].map((hz) => (
                        <button key={hz} disabled={pickDir == null} onClick={() => setPickHz(hz)} style={{ ...choice(pickHz === hz, STEEL, pickDir == null), minWidth: 80, fontFamily: "'JetBrains Mono', monospace" }}>
                          {hz}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div data-caps style={stepLabel}>Step 3 · Mode</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {([
                        ["NORMAL", "Normal", "Engine weights, fixed"],
                        ["ADVANCED", "Advanced", "Edit the engine weights yourself"],
                      ] as const).map(([m, title, sub]) => (
                        <button
                          key={m}
                          disabled={pickHz == null}
                          onClick={() => setPickMode(m)}
                          style={{ ...choice(pickMode === m, STEEL, pickHz == null), height: 62, minWidth: 230, textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}
                        >
                          <span>{title}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <button
                      disabled={!ready}
                      onClick={() => {
                        if (!pickDir || !pickHz || !pickMode) return;
                        setLabDir(pickDir);
                        setLabHz(pickHz);
                        setLabMode(pickMode);
                        setLabWeightsState(null);
                        setTargetOverride(null);
                        setStopOverride(null);
                        setLabEditTargets(false);
                        setLabBreakdownOpen({});
                        setLabSavedNote(null);
                        setLabStarted(true);
                      }}
                      style={{ height: 50, padding: "0 30px", border: "none", background: ready ? "#5980a6" : "#1c2733", color: "#ffffff", opacity: ready ? 1 : 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", cursor: ready ? "pointer" : "not-allowed" }}
                    >
                      <span data-caps>Run Strategy →</span>
                    </button>
                  </div>
                </div>
                <TradeBuilderGuide done={[pickDir != null, pickHz != null, pickMode != null]} />
              </>
            );
          }
          const thBull = labDir === "Bull";
          // Custom weights only count in Advanced mode.
          const thCustomW = labMode === "ADVANCED" ? labWeightsState : null;
          const thRun = thesisRun(stock.t, labDir, labHz, null, thCustomW || undefined, siFacts);
          const thPrev = thesisRun(stock.t, labDir, labHz, (c: any, n: any, f: any, dd: number) => -dd, thCustomW || undefined, siFacts);
          const TT = thesisTargets(stock.t, labDir, labHz, thRun, stock.p, siFacts);
          const TPt = getTP(stock.t, siFacts);

          const tgtV = targetOverride != null ? targetOverride : TT.target;
          const stopV = stopOverride != null ? stopOverride : TT.stop;
          const thUp = ((tgtV / stock.p) - 1) * 100;
          const thDn = ((stopV / stock.p) - 1) * 100;
          const thRR = Math.abs(thUp / (thDn || 1));
          const thConf = thRun.conf != null ? Math.round(thRun.conf) : null;
          const dConf = (thRun.conf != null && thPrev.conf != null) ? Math.round(thRun.conf - thPrev.conf) : 0;
          const thBand: [string, string] = thConf == null
            ? ["UNAVAILABLE", "#93a1af"]
            : thConf >= 75
                ? ["HIGH CONVICTION", UP]
                : thConf >= 60
                  ? ["CONSTRUCTIVE", STEEL]
                  : thConf >= 45
                    ? ["MIXED", "#f5b031"]
                    : ["WEAK", DN];

          const thStrong = thRun.drv.slice().sort((a: any, b: any) => b.pts - a.pts).slice(0, 3);

          const thLo = Math.min(TT.dn, stopV, stock.p) * 0.97;
          const thHi = Math.max(TT.up, tgtV, stock.p) * 1.03;
          const thPos = (v: number) => (((v - thLo) / (thHi - thLo || 1)) * 100).toFixed(2) + "%";

          // Historical price series based on real market bars (replaces PRNG synthetic series)
          // Sliced to the selected horizon (1M/3M/6M/12M) so Return, High, Low,
          // Max Drawdown and Volatility change with the buttons.
          const histBars = barsForHorizon(labHz, yearBars, sixMonthBars);
          const hs = histBars && histBars.length >= 5
            ? histBars.map((b) => b.c)
            : [stock.p * 0.95, stock.p * 0.98, stock.p];
          const hExt = hs.concat([tgtV, stopV]);
          const hsLo = Math.min(...hExt) * 0.97;
          const hsHi = Math.max(...hExt) * 1.03;
          const hsDiff = hsHi - hsLo || 1;
          const hsPath = hs
            .map((val, idx) => {
              const x = (idx / (hs.length - 1)) * 1000;
              const y = 260 - ((val - hsLo) / hsDiff) * 236 - 12;
              return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          const hsArea = `${hsPath} L 1000 260 L 0 260 Z`;
          const hsRet = ((hs[hs.length - 1] / hs[0]) - 1) * 100;
          let hsPk = hs[0], hsDD = 0;
          hs.forEach((v) => {
            hsPk = Math.max(hsPk, v);
            hsDD = Math.min(hsDD, (v / hsPk) - 1);
          });
          const hsRr = hs.slice(1).map((v, i) => Math.log(v / hs[i]));
          const hsMu = hsRr.reduce((a, b) => a + b, 0) / (hsRr.length || 1);
          const hsVolA = Math.sqrt(hsRr.reduce((a, b) => a + (b - hsMu) * (b - hsMu), 0) / (hsRr.length || 1)) * Math.sqrt(252) * 100;

          const yOf = (v: number) => 260 - ((v - hsLo) / hsDiff) * 236 - 12;
          const tgtYPct = `${(yOf(tgtV) / 260) * 100}%`;
          const stopYPct = `${(yOf(stopV) / 260) * 100}%`;
          const nowYPct = `${(yOf(stock.p) / 260) * 100}%`;


          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Thesis Controls Header */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--si-border, #1c2733)",
                  background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 230 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
                    TRADE BUILDER · {stock.t}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", marginTop: 4 }}>
                    {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} STRATEGY
                  </div>
                  <button
                    onClick={() => {
                      setPickDir(labDir);
                      setPickHz(labHz);
                      setPickMode(labMode);
                      setLabStarted(false);
                    }}
                    style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer" }}
                  >
                    ← EDIT SETUP
                  </button>
                </div>

                {/* Mode Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    MODE
                  </div>
                  <div style={{ display: "flex", border: "1px solid var(--si-border-sec, #2a3a4a)", padding: 3, gap: 3 }}>
                    {(["NORMAL", "ADVANCED"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setLabMode(m);
                          if (m === "NORMAL") {
                            setTargetOverride(null);
                            setStopOverride(null);
                            setLabEditTargets(false);
                          }
                        }}
                        style={{
                          height: 30,
                          padding: "0 14px",
                          border: "none",
                          background: labMode === m ? "#5980a6" : "transparent",
                          color: labMode === m ? "#ffffff" : "#93a1af",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          cursor: "pointer",
                          transition: "background 160ms, color 160ms",
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direction Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    DIRECTION
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["Bull", "Bear"] as const).map((d) => {
                      const isActive = labDir === d;
                      const col = d === "Bull" ? UP : DN;
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            setLabDir(d);
                            setTargetOverride(null);
                            setStopOverride(null);
                            setLabWeightsState(null);
                          }}
                          style={{
                            width: 110,
                            height: 38,
                            border: `1px solid ${isActive ? col : "#1c2733"}`,
                            background: isActive ? (d === "Bull" ? "rgba(74,222,128,0.12)" : "rgba(240,86,86,0.12)") : "transparent",
                            color: "var(--si-text-hi, #e8eef4)",
                            fontFamily: "'Manrope', sans-serif",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "background 160ms, border-color 160ms",
                          }}
                        >
                          {d === "Bull" ? "▲ Bullish" : "▼ Bearish"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Horizon Toggle */}
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    HORIZON
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["1M", "3M", "6M", "9M"].map((hz) => {
                      const isActive = labHz === hz;
                      return (
                        <button
                          key={hz}
                          onClick={() => {
                            setLabHz(hz);
                            setTargetOverride(null);
                            setStopOverride(null);
                            setLabWeightsState(null);
                          }}
                          style={{
                            width: 60,
                            height: 38,
                            border: `1px solid ${isActive ? STEEL : "#1c2733"}`,
                            background: isActive ? "rgba(89,128,166,0.2)" : "transparent",
                            color: "var(--si-text-hi, #e8eef4)",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background 160ms, border-color 160ms",
                          }}
                        >
                          {hz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Driver Weights Strip */}
                <div style={{ marginLeft: "auto", minWidth: 300, flex: 1, maxWidth: 520, paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                    <span>{thCustomW ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}</span>
                    <span style={{ color: "var(--si-text-mid, #93a1af)", letterSpacing: "0.04em" }}>
                      {labHz === "1M" ? "1M tactical" : labHz === "9M" || labHz === "12M" ? `${labHz} fundamental` : labHz === "3M" ? "3M momentum" : "6M balanced"} · {thBull ? "bullish" : "bearish"}
                    </span>
                  </div>
                  <div style={{ display: "flex", minHeight: 30, gap: 2 }}>
                    {thRun.cats.map((c: any) => (
                      <div
                        key={c.k}
                        style={{
                          flexGrow: c.w,
                          flexBasis: 0,
                          minWidth: 38,
                          borderTop: `2px solid ${sc(c.score)}`,
                          background: "rgba(89,128,166,0.12)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1.1,
                          padding: "3px 0",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--si-text-body, #d5dfe9)",
                          transition: "flex-grow 300ms ease",
                        }}
                      >
                        <span style={{ color: "var(--si-text-mid, #93a1af)" }}>{c.k}</span>
                        <span>{Math.round(c.w)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Engine weights: sliders are live in Advanced mode and greyed out (tap for an explanation) in Normal mode */}
              <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 28 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: thCustomW ? "#f5b031" : "var(--si-text-hi, #e8eef4)" }}>
                    {thCustomW ? "CUSTOM WEIGHTS" : "ENGINE WEIGHTS"}
                  </span>
                  <button
                    type="button"
                    aria-label="How the trade confidence is calculated"
                    aria-expanded={labExplainerOpen}
                    title="How this is calculated"
                    onClick={() => setLabExplainerOpen((v) => !v)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1px solid var(--si-accent-light, #a9c6e3)",
                      background: labExplainerOpen ? "var(--si-accent-light, #a9c6e3)" : "transparent",
                      color: labExplainerOpen ? "#0c1118" : "var(--si-accent-light, #a9c6e3)",
                      fontFamily: "Georgia, serif",
                      fontSize: 12,
                      fontStyle: "italic",
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: 0,
                      cursor: "pointer",
                      alignSelf: "center",
                      flex: "none",
                    }}
                  >
                    i
                  </button>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)" }}>
                    {labMode === "ADVANCED" ? "Drag to set relative importance — automatically normalized to 100%." : "Fixed in Normal mode."}
                  </span>
                  {labMode === "ADVANCED" && (
                    <button
                      onClick={() => setLabWeightsState(null)}
                      style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Reset to engine weights
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 22px" }}>
                  {CATS_T.map(([k, label]) => {
                    const raw = thCustomW ? thCustomW[k] : thesisWeights(labDir, labHz)[k];
                    const shown = Math.round(thRun.W[k]);
                    return (
                      <div key={k} style={{ position: "relative", opacity: labMode === "ADVANCED" ? 1 : 0.42, filter: labMode === "ADVANCED" ? "none" : "grayscale(1)", transition: "opacity 200ms ease" }}>
                        {labMode !== "ADVANCED" && (
                          <div
                            role="button"
                            aria-label={`${label} weight is fixed in Normal mode`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setLabWeightsDialog(true);
                            }}
                            style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "pointer" }}
                          />
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--si-text-body, #d5dfe9)", marginBottom: 4 }}>
                          <span>{label}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{shown}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          step="1"
                          value={raw || 0}
                          tabIndex={labMode === "ADVANCED" ? 0 : -1}
                          onChange={(e) => {
                            if (labMode !== "ADVANCED") {
                              setLabWeightsDialog(true);
                              return;
                            }
                            const base = labWeightsState || thesisWeights(labDir, labHz);
                            setLabWeightsState({ ...base, [k]: +e.target.value });
                          }}
                          style={{ width: "100%", accentColor: "#5980a6", cursor: "pointer" }}
                        />
                      </div>
                    );
                  })}
                </div>
                {labExplainerOpen && (
                  <ConfidenceExplainer cats={thRun.cats} conf={thConf} hz={labHz} bull={thBull} custom={!!thCustomW} onClose={() => setLabExplainerOpen(false)} />
                )}
                {labWeightsDialog && labMode !== "ADVANCED" && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Engine weights"
                    onClick={() => setLabWeightsDialog(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 7, 11, 0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: "min(420px, 100%)", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "var(--si-card, #0c1118)", boxShadow: "0 18px 48px rgba(0,0,0,0.6)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}
                    >
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-text-hi, #e8eef4)" }}>ENGINE WEIGHTS</div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-hi, #ffffff)", lineHeight: 1.55 }}>Switch to Advanced mode to edit the weights.</div>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                        <button
                          onClick={() => setLabWeightsDialog(false)}
                          style={{ height: 34, padding: "0 14px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          OK
                        </button>
                        <button
                          autoFocus
                          onClick={() => {
                            setLabWeightsDialog(false);
                            setLabMode("ADVANCED");
                          }}
                          style={{ height: 34, padding: "0 14px", border: "none", background: "var(--si-accent-btn, #5980a6)", color: "#ffffff", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                        >
                          Switch to Advanced
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))", gap: 18, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
                  {/* Market history */}
                  <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>MARKET HISTORY</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-text-hi, #ffffff)" }}>LAST {labHz === "12M" ? "9M" : labHz}</span>
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.45 }}>
                      Historical Underlying Asset Benchmark Performance — buy-and-hold returns, drawdown and volatility; not an active strategy backtest.
                    </div>
                    <div style={{ position: "relative", height: 260 }}>
                      <svg width="100%" height="260" viewBox="0 0 1000 260" preserveAspectRatio="none" style={{ display: "block" }}>
                        <line x1="0" x2="1000" y1="65" y2="65" stroke="#152029" vectorEffect="non-scaling-stroke" />
                        <line x1="0" x2="1000" y1="130" y2="130" stroke="#152029" vectorEffect="non-scaling-stroke" />
                        <line x1="0" x2="1000" y1="195" y2="195" stroke="#152029" vectorEffect="non-scaling-stroke" />
                        <path d={hsArea} fill={hsRet >= 0 ? UP : DN} opacity="0.1" />
                        <path d={hsPath} fill="none" stroke={hsRet >= 0 ? UP : DN} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <div style={{ position: "absolute", left: 0, right: 0, top: tgtYPct, borderTop: "1px dashed #4ade80" }}>
                        <span style={{ position: "absolute", right: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#4ade80", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>TARGET {usd(tgtV)}</span>
                      </div>
                      <div style={{ position: "absolute", left: 0, right: 0, top: stopYPct, borderTop: "1px dashed #f05656" }}>
                        <span style={{ position: "absolute", left: 0, top: "-18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#f05656", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>INVALIDATION {usd(stopV)}</span>
                      </div>
                      <div style={{ position: "absolute", left: 0, right: 0, top: nowYPct, borderTop: "1px dashed rgba(255,255,255,0.55)" }}>
                        <span style={{ position: "absolute", right: 12, top: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "var(--si-text-hi, #ffffff)", background: "var(--si-card-solid, #0c1118)", padding: "1px 6px" }}>PRESENT {usd(stock.p)}</span>
                      </div>
                      <div style={{ position: "absolute", right: -4, top: nowYPct, width: 8, height: 8, marginTop: -4, borderRadius: 99, background: "#e8eef4", boxShadow: "0 0 10px rgba(232,238,244,0.6)" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                      {[
                        ["RETURN", pct1(hsRet), hsRet >= 0 ? UP : DN],
                        ["HIGH", usd(Math.max(...hs)), "var(--si-text-hi, #e8eef4)"],
                        ["LOW", usd(Math.min(...hs)), "var(--si-text-hi, #e8eef4)"],
                        ["MAX DRAWDOWN", pct1(hsDD * 100), "var(--down, #dc2626)"],
                        ["VOLATILITY", Math.round(hsVolA) + "% ann.", "var(--si-text-hi, #e8eef4)"],
                      ].map(([k, v, c], idx) => (
                        <div key={idx} style={{ padding: "10px 12px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>{k}</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: c as string, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trade card */}
                  <div style={{ position: "relative", border: "1px solid #5980a6", background: "var(--si-card, rgba(12, 17, 24, 0.95))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>TRADE CARD</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                        {thBull ? "LONG" : "SHORT"} {stock.t} · {labHz} TRADE
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                      {[
                        ["PRESENT PRICE", usd(stock.p), "#ffffff"],
                        ["TARGET", usd(tgtV), thBull ? UP : DN],
                        ["INVALIDATION", usd(stopV), DN],
                        ["UPSIDE", pct1(thUp), UP],
                        ["DOWNSIDE", pct1(thDn), DN],
                        ["REWARD / RISK", thRR.toFixed(1) + "×", thRR >= 2 ? UP : thRR >= 1.2 ? "#f5b031" : DN],
                        ["TRADE CONFIDENCE", thConf != null ? `${thConf} / 100` : "Unavailable", thBand[1]],
                      ].map(([k, v, c], idx) => (
                        <div key={idx} style={{ padding: "12px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--si-text-hi, #ffffff)" }}>{k}</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: c as string, marginTop: 4 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                      <div style={{ border: "1px solid var(--si-border, #1c2733)", padding: "12px 14px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>KEY CATALYST</div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", marginTop: 6 }}>{TPt.cat}</div>
                      </div>
                      <div style={{ border: "1px solid var(--si-border, #1c2733)", padding: "12px 14px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#f5b031" }}>BIGGEST RISK</div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)", marginTop: 6 }}>{TPt.risk}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setLabSaveOpen(true)}
                      style={{ height: 48, border: "none", background: "#5980a6", color: "#ffffff", fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "background 160ms" }}
                    >
                      Save and monitor trade setup →
                    </button>
                  </div>

                  {/* Price target: only in Advanced mode, where the target and stop can be overridden */}
                  {labMode === "ADVANCED" && (
                    <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)" }}>PRICE TARGET</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: targetOverride != null ? "#f5b031" : STEEL, border: `1px solid ${targetOverride != null ? "#f5b031" : STEEL}`, padding: "1px 6px" }}>
                          {targetOverride != null ? "OVERRIDDEN" : "SUGGESTED"}
                        </span>
                        <button
                          onClick={() => setLabEditTargets(!labEditTargets)}
                          style={{ marginLeft: "auto", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {labEditTargets ? "Done" : "Edit / Override"}
                        </button>
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", lineHeight: 1 }}>{usd(tgtV)}</div>
                      <div style={{ position: "relative", height: 56, margin: "4px 6px 0" }}>
                        <div style={{ position: "absolute", left: 0, right: 0, top: 26, height: 2, background: "#1c2733" }} />
                        <div style={{ position: "absolute", top: 18, left: thPos(stopV), width: 2, height: 18, background: "#f05656" }} />
                        <div style={{ position: "absolute", top: 16, left: thPos(tgtV), width: 12, height: 12, marginLeft: -5, border: "2px solid #e8eef4", background: "var(--si-bg, #080b10)", transform: "rotate(45deg)", transition: "left 300ms ease" }} />
                        {([
                          ["BEAR", TT.dn, DN],
                          ["NOW", stock.p, "var(--si-text-hi, #e8eef4)"],
                          ["BASE", TT.base, STEEL],
                          ["BULL", TT.up, UP],
                        ] as [string, number, string][]).map(([k, v, c], idx) => (
                          <div key={idx} style={{ position: "absolute", top: 0, left: thPos(v), transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: c }}>{k}</span>
                            <span style={{ width: 1, height: 14, background: c, marginTop: 2 }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "var(--si-text-mid, #93a1af)", marginTop: 16 }}>{usd(v)}</span>
                          </div>
                        ))}
                      </div>
                      {labEditTargets && (
                        <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                              <span>OVERRIDE TARGET · SUGGESTED {usd(TT.target)}</span>
                              <span style={{ color: "var(--si-text-hi, #e8eef4)" }}>{usd(tgtV)}</span>
                            </div>
                            <input type="range" min={Math.round(stock.p * 0.5)} max={Math.round(stock.p * 1.8)} step="1" value={Math.round(tgtV)} onChange={(e) => setTargetOverride(+e.target.value)} style={{ width: "100%", accentColor: UP }} />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-accent, #5980a6)", marginBottom: 6 }}>
                              <span>OVERRIDE INVALIDATION · SUGGESTED {usd(TT.stop)}</span>
                              <span style={{ color: "#f05656" }}>{usd(stopV)}</span>
                            </div>
                            <input type="range" min={Math.round(stock.p * 0.5)} max={Math.round(stock.p * 1.4)} step="1" value={Math.round(stopV)} onChange={(e) => setStopOverride(+e.target.value)} style={{ width: "100%", accentColor: DN }} />
                          </div>
                          <button
                            onClick={() => {
                              setTargetOverride(null);
                              setStopOverride(null);
                            }}
                            style={{ alignSelf: "flex-start", height: 28, padding: "0 10px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Reset to suggested
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right column: the trade confidence and where it comes from */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ position: "relative", border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, #0c1118)", boxShadow: "var(--si-shadow, none)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>TRADE CONFIDENCE</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: thConf != null ? 56 : 32, fontWeight: 700, lineHeight: 0.9, color: thConf != null ? thBand[1] : "var(--si-text-hi, #e8eef4)" }}>{thConf ?? "Unavailable"}</span>
                          {thConf != null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: "var(--si-text-sub, #5d6b79)" }}>/ 100</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em", color: thBand[1] }}>{thBand[0]}</div>
                      </div>
                    </div>
                    <div style={{ height: 8, background: "var(--si-border, #1c2733)" }}>
                      <div style={{ height: 8, width: `${thConf ?? 0}%`, background: thBand[1], transition: "width 400ms ease" }} />
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.55 }}>
                      {thBull ? "Bullish" : "Bearish"} because {highlightSignedPercents(thStrong.map((d: any) => `${d.name} (${d.val})`).join(", "))} carry the most weight in the {labHz} profile.
                    </div>
                    <ConfidenceBreakdown cats={thRun.cats} colorFor={sc} open={labBreakdownOpen} onToggle={(k) => setLabBreakdownOpen((o) => ({ ...o, [k]: !o[k] }))} />
                  </div>
                </div>
              </div>

              {labSaveOpen && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Save this trade"
                  onClick={() => setLabSaveOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 7, 11, 0.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: "min(440px, 100%)", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "var(--si-card, #0c1118)", boxShadow: "0 18px 48px rgba(0,0,0,0.6)", padding: "24px 26px", display: "flex", flexDirection: "column", gap: 14 }}
                  >
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", color: "var(--si-text-hi, #ffffff)" }}>SAVE THIS TRADE?</div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, color: "var(--si-text-hi, #ffffff)", lineHeight: 1.55 }}>
                      <b style={{ color: thBull ? "var(--up, #4ade80)" : "var(--down, #f87171)" }}>{thBull ? "Long" : "Short"}</b> {stock.t}, target <b style={{ color: "var(--up, #4ade80)" }}>{usd(tgtV)}</b>, invalidation <b style={{ color: "var(--down, #f87171)" }}>{usd(stopV)}</b> over <b style={{ color: "#4fb3ff" }}>{labHz}</b>. This trade will be saved to your Trade Tracker.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                      <button
                        onClick={() => setLabSaveOpen(false)}
                        style={{ height: 40, padding: "0 18px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        autoFocus
                        onClick={() => {
                          // Added to this stock's saved trades; nothing already saved is replaced.
                          const nowMs = Date.now();
                          let saved: SavedTrade | null = null;
                          try {
                            const { trades, trade } = addTrade(
                              readTrades(localStorage, stock.t),
                              {
                                ticker: stock.t,
                                dir: labDir,
                                hz: labHz,
                                title: `${thBull ? "LONG" : "SHORT"} ${stock.t} → ${usd(tgtV)} · ${labHz}`,
                                target: tgtV,
                                stop: stopV,
                                confAtSave: thConf,
                                savedDate: "Just now · Active",
                                entryPx: Number.isFinite(stock.p) ? stock.p : null,
                                savedAt: new Date(nowMs).toISOString(),
                                wO: thCustomW,
                              },
                              nowMs,
                            );
                            writeTrades(localStorage, stock.t, trades);
                            setSavedTrades(trades);
                            saved = trade;
                          } catch { }
                          if (saved) setSelectedTradeId(saved.id);
                          setLabSaveOpen(false);
                          setLabSavedNote(`${stock.t} trade saved to your Trade Tracker`);
                          resetBuilder();
                          // Back to the top, where the "saved" note and the set-up are. The scroller is
                          // main.si-main-scroll; the effect above also does this once the set-up re-renders.
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                            document.querySelectorAll(".si-main-scroll").forEach((el) => el.scrollTo({ top: 0, behavior: "smooth" }));
                          }, 60);
                        }}
                        style={{ height: 40, padding: "0 20px", border: "none", background: "#5980a6", color: "#ffffff", fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                      >
                        Save to Trade Tracker
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ====================================================
            TAB 9: TRADE TRACKER (was "Strategy Monitor"; Issue 7: Full Monitored View)
            ==================================================== */}
        {activeTab === "mon" && (() => {
          // With a saved trade the tab is a list on the left and the open stock's
          // trade on the right; with none it stays full width.
          const monLayout = (body: React.ReactNode) =>
            trackedTrades.length > 0 ? (
              <div className="si-trk">
                <TrackedTradesList trades={trackedTrades} activeId={savedThesis?.id ?? null} onSelect={selectTrackedTrade} onRemove={removeSavedTrade} />
                <div className="si-trk-detail">{body}</div>
              </div>
            ) : body;

          if (!savedThesis) {
            return monLayout(
              <div
                style={{
                  border: "1px dashed var(--si-border-dashed, #2a3a4a)",
                  borderRadius: 8,
                  padding: "64px 24px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  background: "var(--si-card, rgba(12, 17, 24, 0.9))",
                  maxWidth: 680,
                  margin: "40px auto",
                  boxShadow: "var(--si-shadow, 0 4px 16px rgba(0,0,0,0.5))",
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "var(--si-accent-bg, rgba(89, 128, 166, 0.18))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--si-accent-soft, #7fa8d0)",
                    marginBottom: 4,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "var(--si-text-hi, #e8eef4)",
                  }}
                >
                  PAPER TRADE TRACKER — CLIENT-SIDE ONLY
                </span>
                <span
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 15,
                    color: "var(--si-text-mid, #93a1af)",
                    maxWidth: 520,
                    lineHeight: 1.55,
                  }}
                >
                  No trade is being tracked for {stock.t}. Save a trade setup in Trade Builder to track it. This trade is stored in the current browser and is not broker-connected or guaranteed to synchronize across devices.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("lab")}
                  style={{
                    height: 44,
                    padding: "0 24px",
                    border: "none",
                    background: "var(--si-accent-btn, #5980a6)",
                    color: "#ffffff",
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    borderRadius: 4,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                    transition: "all 150ms ease",
                  }}
                >
                  Save a Trade Setup in Trade Builder →
                </button>
              </div>
            );
          }

          const b2 = savedThesis.dir === "Bull";
          const TPt = getTP(stock.t, siFacts);
          const monAdj = (cat: string, name: string, fl: string) => {
            let a = 0;
            if (monScenario === "cut" && cat === "EARN") a += fl.indexOf("K") >= 0 ? -60 : -28;
            if (monScenario === "cut" && cat === "BUS" && fl.indexOf("K") >= 0) a -= 10;
            if (monScenario === "surge" && (cat === "TECH" || cat === "POS")) a += 12;
            if (monScenario === "break" && cat === "TECH") a -= 30;
            return a;
          };

          const monRun = thesisRun(stock.t, savedThesis.dir, savedThesis.hz, monAdj, savedThesis.wO || undefined, siFacts);
          const monPx = monScenario === "break" ? (b2 ? savedThesis.stop * 0.985 : savedThesis.stop * 1.015) : stock.p;
          const monPriceBroken = b2 ? monPx <= savedThesis.stop : monPx >= savedThesis.stop;
          const monConfInvalid = monRun.conf != null && monRun.conf < 30;
          const monDelta = (monRun.conf != null && savedThesis.confAtSave != null) ? monRun.conf - savedThesis.confAtSave : 0;
          const monEntry = typeof savedThesis.entryPx === "number" && savedThesis.entryPx > 0 ? savedThesis.entryPx : null;
          // Against the live price (the PRICE NOW at the top), not a simulated one.
          const monSinceEntry = monEntry != null && Number.isFinite(stock.p) ? ((stock.p - monEntry) / monEntry) * 100 : null;

          let monStatus = "ON TRACK";
          let monCol = UP;
          let monCause = monRun.conf != null ? `Trade confidence ${Math.round(monRun.conf)} / 100, within tolerance.` : "Trade confidence unavailable.";
          let monBy = "Trade confidence";

          if (monPriceBroken) {
            monStatus = "INVALIDATED";
            monCol = DN;
            monBy = "Price invalidation";
            monCause = `Price closed ${b2 ? "below" : "above"} the ${usd(savedThesis.stop)} invalidation level (${usd(monPx)}).`;
          } else if (monConfInvalid) {
            monStatus = "INVALIDATED";
            monCol = DN;
            monBy = "Trade confidence";
            monCause = `Trade confidence fell to ${Math.round(monRun.conf ?? 0)}, below the 30 invalidation line.`;
          } else if (monRun.conf != null && monRun.conf < 45) {
            monStatus = "AT RISK";
            monCol = "#f2763a";
            monBy = "Trade confidence";
            monCause = "Trade confidence fell below 45.";
          } else if (monDelta >= 3) {
            monStatus = "STRENGTHENING";
            monCol = UP;
            monBy = "Score momentum";
            monCause = `Trade evidence improved (+${Math.round(monDelta)} pts).`;
          } else if (monDelta <= -3) {
            monStatus = "WEAKENING";
            monCol = "#f5b031";
            monBy = "Factor pressure";
            monCause = `Trade evidence slipped (${Math.round(monDelta)} pts).`;
          }

          const L5 = ["ON TRACK", "STRENGTHENING", "WEAKENING", "AT RISK", "INVALIDATED"];
          const lo2 = Math.min(savedThesis.stop, savedThesis.target);
          const hi2 = Math.max(savedThesis.stop, savedThesis.target);
          const monNowF = Math.max(0, Math.min(1, (monPx - lo2) / (hi2 - lo2 || 1)));

          return monLayout(
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Monitored Summary Box */}
              <div style={{ position: "relative", border: `1px solid ${monCol}`, background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, transition: "border-color 300ms" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 22, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                      <span style={{ color: savedThesis.dir === "Bull" ? UP : DN }}>{savedThesis.dir === "Bull" ? "LONG" : "SHORT"}</span> {stock.t} · TARGET{" "}
                      <span style={{ color: UP }}>{usd(savedThesis.target).replace(/\.00$/, "")}</span> IN <span style={{ color: "#4fb3ff" }}>{savedThesis.hz}</span> TIMEFRAME
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span title="This trade is stored in your current browser. It is not broker-connected and may not sync across devices." style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", background: "rgba(89, 128, 166, 0.2)", padding: "2px 6px", borderRadius: 3, color: "var(--si-accent-light, #a9c6e3)" }}>
                        SAVED IN THIS BROWSER · NOT BROKER-CONNECTED
                      </span>
                    </div>
                    {formatSavedAt(savedThesis.savedAt) && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "var(--si-text-mid, #93a1af)", marginTop: 4 }}>
                        Saved on {formatSavedAt(savedThesis.savedAt)}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          setLabDir(savedThesis.dir);
                          setLabHz(savedThesis.hz);
                          // Advanced mode, so the saved weights, target and invalidation are visible and editable.
                          setLabMode("ADVANCED");
                          setLabWeightsState(savedThesis.wO || null);
                          setTargetOverride(savedThesis.target);
                          setStopOverride(savedThesis.stop);
                          setLabBreakdownOpen({});
                          setLabSavedNote(null);
                          setLabStarted(true);
                          setActiveTab("lab");
                        }}
                        style={{ height: 30, padding: "0 12px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-accent-light, #a9c6e3)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit in Trade Builder
                      </button>

                      {confirmDeleteThesis ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#ffd2d2" }}>
                            Remove this trade?
                          </span>
                          <button
                            onClick={() => removeSavedTrade(savedThesis)}
                            style={{ height: 30, padding: "0 12px", border: "none", background: "#f05656", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmDeleteThesis(false)}
                            style={{ height: 30, padding: "0 12px", border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-mid, #93a1af)", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteThesis(true)}
                          style={{ height: 30, padding: "0 12px", border: "1px solid rgba(240,86,86,0.45)", background: "transparent", color: "#f08a8a", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Remove trade
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 36, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end", textAlign: "right" }}>
                    {/* The stock's live price, whatever scenario is simulated below. */}
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>PRICE NOW</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "0.02em", color: "var(--si-text-hi, #e8eef4)" }}>
                        {usd(stock.p)}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: stock.c >= 0 ? UP : DN }}>
                        {pct(stock.c)} today
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>STATUS</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "0.04em", color: monCol, transition: "color 300ms" }}>
                        {monStatus}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-Step Status Ladder */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4 }}>
                  {L5.map((k) => {
                    const isCurrent = k === monStatus;
                    return (
                      <div
                        key={k}
                        style={{
                          height: 30,
                          border: `1px solid ${isCurrent ? monCol : "#1c2733"}`,
                          background: isCurrent ? `${monCol}1f` : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: isCurrent ? 700 : 600,
                          letterSpacing: "0.08em",
                          color: isCurrent ? monCol : "var(--si-text-hi, #e8eef4)",
                          transition: "all 250ms",
                        }}
                      >
                        {k}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)" }}>CHANGED BY</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{monBy}</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-body, #c5d0db)" }}>{monCause}</span>
                </div>

                {/* Progress bar between stop and target */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#f05656" }}>
                    INVALIDATION {usd(savedThesis.stop)}
                  </span>
                  <div style={{ position: "relative", flex: 1, height: 10, background: "#1c2733" }}>
                    <div style={{ height: 10, width: `${monNowF * 100}%`, background: "#5980a6", transition: "width 300ms" }} />
                    <div style={{ position: "absolute", top: -6, left: `${monNowF * 100}%`, width: 2, height: 22, background: "#e8eef4", transition: "left 300ms" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#4ade80" }}>
                    TARGET {usd(savedThesis.target)}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", borderTop: "1px solid var(--si-border, #1c2733)", borderLeft: "1px solid var(--si-border, #1c2733)" }}>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>CONFIDENCE AT SAVE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{savedThesis.confAtSave != null ? savedThesis.confAtSave : "Unavailable"}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>CONFIDENCE NOW</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>
                      {monRun.conf != null ? (
                        <>
                          {Math.round(monRun.conf)}{" "}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: monDelta > 0 ? UP : monDelta < 0 ? "#f5b031" : "#93a1af" }}>
                            ({monDelta >= 0 ? "+" : ""}{Math.round(monDelta)})
                          </span>
                        </>
                      ) : (
                        "Unavailable"
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid var(--si-border, #1c2733)", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>ENTRY PRICE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{monEntry != null ? usd(monEntry) : "Unavailable"}</div>
                    {monEntry != null && savedThesis.savedAt && !Number.isNaN(Date.parse(savedThesis.savedAt)) && (
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--si-text-mid, #93a1af)" }}>
                        Started {new Date(savedThesis.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    {monSinceEntry != null && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: monSinceEntry >= 0 ? UP : DN }}>
                        {pct(monSinceEntry)} since entry
                      </div>
                    )}
                  </div>
                </div>

                {/* Simulate Scenarios Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--si-accent, #5980a6)", marginRight: 4 }}>
                    SIMULATE
                  </span>
                  {[
                    ["live", "Live data"],
                    ["cut", "EPS estimates cut −12%"],
                    ["break", "Price breaks support"],
                    ["surge", "Momentum surge"],
                  ].map(([k, l]) => {
                    const isCur = monScenario === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setMonScenario(k as typeof monScenario)}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          border: `1px solid ${isCur ? STEEL : "#1c2733"}`,
                          background: isCur ? "rgba(89,128,166,0.22)" : "transparent",
                          color: "var(--si-text-hi, #e8eef4)",
                          fontFamily: "'Manrope', sans-serif",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 160ms, border-color 160ms",
                        }}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Driver Tracking Table & Invalidation Checks */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, alignItems: "start" }}>
                {/* Driver Tracking Table */}
                <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", flex: 1 }}>
                      DRIVER TRACKING
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-text-sub, #5d6b79)", width: 46, textAlign: "right" }}>SAVED</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-text-sub, #5d6b79)", width: 46, textAlign: "right" }}>NOW</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--si-text-sub, #5d6b79)", width: 42, textAlign: "right" }}>Δ</span>
                    <span style={{ width: 92 }} />
                  </div>

                  {monRun.drv.slice(0, 8).map((d: any, idx: number) => {
                    const was = Math.round(d.ev - (d.dd || 0));
                    const now = Math.round(d.ev);
                    const dv = now - was;
                    const stt = now < 40
                      ? ["AGAINST", DN]
                      : dv <= -3
                        ? ["SLIPPING", "#f5b031"]
                        : dv >= 3
                          ? ["IMPROVING", UP]
                          : ["HOLDING", STEEL];

                    return (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {d.name}
                        </span>
                        <span style={{ width: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--si-text-mid, #93a1af)" }}>
                          {was}
                        </span>
                        <span style={{ width: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "var(--si-text-hi, #e8eef4)" }}>
                          {now}
                        </span>
                        <span style={{ width: 34, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: dv > 0 ? UP : dv < 0 ? "#f5b031" : "#93a1af" }}>
                          {dv >= 0 ? "+" : ""}{dv}
                        </span>
                        <span style={{ width: 92, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: stt[1] as string }}>
                          {stt[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Right Side: Invalidation Checks & Alert Log */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Invalidation Checks */}
                  <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 12 }}>
                      INVALIDATION CHECKS
                    </div>
                    {[
                      {
                        k: `Daily close ${b2 ? "below" : "above"} ${usd(savedThesis.stop)}`,
                        st: monPriceBroken ? "TRIGGERED" : "CLEAR",
                        c: monPriceBroken ? DN : UP,
                      },
                      {
                        k: "Trade confidence under 30 (at risk under 45)",
                        st: monConfInvalid ? "TRIGGERED" : monRun.conf != null && monRun.conf < 45 ? "WATCH" : "CLEAR",
                        c: monConfInvalid ? DN : monRun.conf != null && monRun.conf < 45 ? "#f5b031" : UP,
                      },
                    ].map((fc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: fc.c, boxShadow: `0 0 8px ${fc.c}` }} />
                        <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)" }}>
                          {fc.k}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: fc.c }}>
                          {fc.st}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Alert Log */}
                  <div style={{ border: "1px solid var(--si-border, #1c2733)", background: "var(--si-card, rgba(12, 17, 24, 0.9))", padding: "18px 20px" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-text-hi, #e8eef4)", marginBottom: 12 }}>
                      ALERT LOG
                    </div>
                    {[
                      ["Now", `Status → ${monStatus}. ${monCause}`],
                      [formatSavedAt(savedThesis.savedAt).split(" · ")[0] || savedThesis.savedDate, `Trade saved${monEntry != null ? ` at ${usd(monEntry)}` : ""} · confidence ${savedThesis.confAtSave != null ? savedThesis.confAtSave : "Unavailable"} · target ${usd(savedThesis.target)} · invalidation ${usd(savedThesis.stop)}.`],
                    ].map(([tt, m], i) => (
                      <div key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--si-border, #1c2733)" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "var(--si-accent, #5980a6)", width: 88, flex: "none" }}>
                          {tt}
                        </span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-body, #d5dfe9)", lineHeight: 1.45 }}>
                          {m}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Peer Switch Confirmation Modal */}
      {pendingPeerOpen && stock && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setPendingPeerOpen(null)}
        >
          <div
            style={{
              background: "var(--si-card-solid, #0c1118)",
              border: "1px solid var(--si-border-sec, #2a3a4a)",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
              borderRadius: 8,
              maxWidth: 440,
              width: "100%",
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <StockLogo sym={pendingPeerOpen.ticker} size={40} />
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)", letterSpacing: "0.04em" }}>
                  Open {pendingPeerOpen.ticker} in Stock Intelligence?
                </div>
                {pendingPeerOpen.name && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-mid, #93a1af)", marginTop: 2 }}>
                    {pendingPeerOpen.name}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, color: "var(--si-text-mid, #93a1af)", lineHeight: 1.55 }}>
              Switch from <b>{stock.t}</b> to <b>{pendingPeerOpen.ticker}</b> to analyze its 6-month trajectory, factor attribution, fundamentals, catalysts, and valuation in Stock Intelligence.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setPendingPeerOpen(null)}
                style={{
                  padding: "9px 18px",
                  border: "1px solid var(--si-border-sec, #2a3a4a)",
                  background: "transparent",
                  color: "var(--si-text-mid, #93a1af)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: 4,
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const symToOpen = pendingPeerOpen.ticker;
                  setPendingPeerOpen(null);
                  handleSelectStock(symToOpen);
                }}
                style={{
                  padding: "9px 20px",
                  border: "none",
                  background: "var(--si-accent, #5980a6)",
                  color: "#ffffff",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  borderRadius: 4,
                  boxShadow: "0 2px 10px rgba(89, 128, 166, 0.4)",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Open in SI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
