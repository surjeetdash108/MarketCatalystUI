"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../backend";
import { useApiList } from "./useApiList";
import { useIntradayBars } from "./useIntradayBars";
import { etParts, getMarketStatus, type MarketPhase } from "../market-status";
import { pairedQuote, useLiveQuotes, type LiveQuote } from "../live-quotes-context";
import type { AnalystConsensusDoc, CompanyDoc } from "../types";
import { pickBear, pickTop, scoreCompany, uniqueTickers, withoutSplitTaint, type Signal } from "../alpha-signals-model";
import {
  evaluateIntraday, intradayCandidates, intradayLists, metricsFromBars,
  type IntradaySignal, type SessionMetrics,
} from "../alpha-intraday";

const pos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * A stored company doc with the app-wide live quote laid over its price and
 * day change (the same pair Market Catalyst shows — see pairedQuote), so a
 * ticker reads the same price on every screen.
 *
 * The 52-week range is brought up to that price too: the stored high/low come
 * from completed sessions and their % fields from whatever price the nightly
 * job saw, so today's high/low (the quote's, when there is one) and the price
 * itself are folded in and both % are measured from the price shown.
 */
export function withLiveQuote(c: CompanyDoc, q: LiveQuote | undefined): CompanyDoc {
  const { price, pctChange } = q ? pairedQuote(q, c) : { price: c.price ?? null, pctChange: c.pctChange ?? null };
  const out: CompanyDoc = price === c.price && pctChange === c.pctChange ? c : { ...c, price, pctChange };
  if (!pos(price)) return out;
  const patch: Partial<CompanyDoc> = {};
  if (pos(c.high52)) {
    const high = Math.max(c.high52, price, pos(q?.dayHigh) ? q.dayHigh : 0);
    const from = (price / high - 1) * 100;
    if (high !== c.high52) patch.high52 = high;
    if (from !== c.pctFromHigh52) patch.pctFromHigh52 = from;
  }
  if (pos(c.low52)) {
    const low = Math.min(c.low52, price, pos(q?.dayLow) ? q.dayLow : Infinity);
    const from = (price / low - 1) * 100;
    if (low !== c.low52) patch.low52 = low;
    if (from !== c.pctFromLow52) patch.pctFromLow52 = from;
  }
  return Object.keys(patch).length ? { ...out, ...patch } : out;
}

/**
 * Session metrics brought up to the live quote when it is newer than the last
 * 5-minute bar: price, day change and the day's range. VWAP, the opening range
 * and prior-day levels stay bar-based.
 */
export function metricsWithQuote(m: SessionMetrics, q: LiveQuote | undefined, today: string): SessionMetrics {
  if (!q || q.price == null || m.session !== today) return m;
  if (q.updatedAt != null && q.updatedAt <= m.lastBarAt + 5 * 60_000) return m;
  const price = q.price;
  const chg = q.pctChange != null ? q.pctChange / 100 : m.priorClose ? price / m.priorClose - 1 : m.chg;
  return { ...m, price, chg, dayHigh: Math.max(m.dayHigh, price), dayLow: Math.min(m.dayLow, price) };
}

/**
 * Company docs with a current next report date: the bulk docs carry none (or
 * a past one — it is resolved only on the single-stock read), so the earliest
 * upcoming date from the earnings calendar fills it. Without this the swing
 * "earnings within 5 days" cap never fired and NEXT EARNINGS read "—".
 */
export function withNextEarnings(
  companies: CompanyDoc[],
  events: Array<{ ticker: string; date: string }>,
  today: string,
): CompanyDoc[] {
  const next = new Map<string, string>();
  for (const e of events) {
    const d = (e.date ?? "").slice(0, 10);
    if (!e.ticker || d < today) continue;
    const prev = next.get(e.ticker);
    if (!prev || d < prev) next.set(e.ticker, d);
  }
  if (next.size === 0) return companies;
  return companies.map(c => {
    const have = c.nextEarningsDate ? c.nextEarningsDate.slice(0, 10) : null;
    if (have && have >= today) return c;
    const d = next.get(c.ticker);
    return d ? { ...c, nextEarningsDate: d } : c;
  });
}

/** 60-second clock: open/closed, the earnings window and staleness all read it. */
export function useMarketClock(tickMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  const phase: MarketPhase = getMarketStatus(new Date(now)).phase;
  return { now, phase, open: phase === "open" };
}

/**
 * A backend list, re-read every `everyMs` (or once when null). Unlike
 * useApiList, changing the cadence keeps the data on screen; a failed first
 * read is retried a few times.
 */
function usePolledList<T>(path: string | null, everyMs: number | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(path !== null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let got = false;
    const load = async (attempt = 0) => {
      try {
        const r = await apiGet<T[]>(path);
        if (cancelled) return;
        got = true;
        setData(Array.isArray(r) ? r : []);
        setLoading(false);
      } catch {
        if (cancelled) return;
        if (!got && attempt < 3) retry = setTimeout(() => void load(attempt + 1), 4000 * (attempt + 1));
        else setLoading(false);
      }
    };
    void load();
    const timer = everyMs ? setInterval(() => void load(), everyMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (retry) clearTimeout(retry);
    };
  }, [path, everyMs]);
  return { data, loading };
}

export interface AlphaPicksOptions {
  /** Cards per list (10 on the Alpha Signals screen, 2 on the Dashboard). */
  limit: number;
  /** Intraday shortlist size (24 / 12). */
  pool: number;
  /** 5-minute bar re-read cadence while the market is open (30 s / 60 s). */
  barsPollMs: number;
  /** Dashboard: top intraday lists up with the next-best Watch setups. */
  fill?: boolean;
  /** False: make no requests (locked or hidden). */
  enabled?: boolean;
}

export const COMPANY_POLL_MS = 60_000;

/**
 * Alpha Signals data for the screen and the Dashboard card: fetching, the live
 * clock, swing scores and picks, the intraday shortlist, its 5-minute bars,
 * SPY's move (market regime) and the intraday picks.
 */
export function useAlphaPicks({ limit, pool, barsPollMs, fill = false, enabled = true }: AlphaPicksOptions) {
  const { now, phase, open } = useMarketClock();
  const { data: storedCompanies, loading: companiesLoading } = usePolledList<CompanyDoc>(enabled ? "/market-data/companies" : null, open ? COMPANY_POLL_MS : null);
  const { data: analystDocs } = useApiList<AnalystConsensusDoc>(enabled ? "/market-data/analyst-actions" : null);
  // The shared live-quote map (one poll for the whole app). Tickers this hook
  // shows are subscribed below; every quote already in the map is used.
  const [watch, setWatch] = useState<string[]>([]);
  const quotes = useLiveQuotes(enabled ? watch : []);
  const { data: earningsEvents } = useApiList<{ ticker: string; date: string }>(enabled ? "/market-data/earnings" : null);
  const today = etParts(new Date(now)).isoDate;
  const companies = useMemo(
    // One doc per ticker; history-derived fields blanked while a split is unadjusted (SNDK).
    () => uniqueTickers(withNextEarnings(storedCompanies, earningsEvents, today)).map(c => withoutSplitTaint(withLiveQuote(c, quotes.get(c.ticker)))),
    [storedCompanies, earningsEvents, today, quotes],
  );

  const analyst = useMemo(() => new Map(analystDocs.map(a => [a.ticker, a])), [analystDocs]);
  // Scores use the clock minute (earnings window, freshness), not every render.
  const scoredAt = now;
  const sigs = useMemo(
    () => companies.map(c => scoreCompany(c, analyst.get(c.ticker), scoredAt)).filter((s): s is Signal => s !== null),
    [companies, analyst, scoredAt],
  );
  const sigBy = useMemo(() => new Map(sigs.map(s => [s.c.ticker, s])), [sigs]);
  const swingBull = useMemo(() => pickTop(sigs, limit, scoredAt), [sigs, limit, scoredAt]);
  const swingBear = useMemo(() => pickBear(sigs, limit, scoredAt), [sigs, limit, scoredAt]);

  const candidates = useMemo(() => intradayCandidates(companies, pool, scoredAt), [companies, pool, scoredAt]);
  const tickers = useMemo(() => (enabled && candidates.length ? [...candidates.map(c => c.ticker), "SPY"] : []), [enabled, candidates]);
  const { data: bars, loading: barsLoading, lastRound } = useIntradayBars(tickers, open ? barsPollMs : null);

  const intraday = useMemo(() => {
    const today = etParts(new Date(now)).isoDate;
    const spyRaw = metricsFromBars(bars.get("SPY")?.bars);
    const spy = spyRaw ? metricsWithQuote(spyRaw, quotes.get("SPY"), today) : null;
    const spx = spy?.chg ?? null;
    const out: IntradaySignal[] = [];
    for (const c of candidates) {
      const b = bars.get(c.ticker);
      if (!b) continue;
      const prevClose = c.price != null && c.pctChange != null && c.pctChange > -100 ? c.price / (1 + c.pctChange / 100) : null;
      const raw = metricsFromBars(b.bars, { dailyRvol: c.rvol ?? null, prevClose });
      if (!raw) continue;
      const m = metricsWithQuote(raw, quotes.get(c.ticker), today);
      out.push(evaluateIntraday(c.ticker, m, c, {
        marketOpen: open,
        spx,
        tradedValue: c.avgVolume20 != null && c.price != null ? c.avgVolume20 * c.price : null,
        swingTrend: sigBy.get(c.ticker)?.trend ?? null,
        newsToday: !!c.nextEarningsDate && c.nextEarningsDate.slice(0, 10) === today,
        now: b.fetchedAt,
        chopGuard: true,
        noiseStops: true,
      }));
    }
    return { all: out, spx, spySession: spy?.session ?? null };
  }, [bars, candidates, sigBy, open, now, quotes]);

  const lists = useMemo(() => intradayLists(intraday.all, limit, fill), [intraday.all, limit, fill]);

  // Subscribe the tickers this hook puts on screen (picks, the intraday pool, SPY).
  const watchKey = useMemo(
    () => [...new Set([...swingBull, ...swingBear].map(s => s.c.ticker).concat(candidates.map(c => c.ticker), "SPY"))].sort().join(","),
    [swingBull, swingBear, candidates],
  );
  useEffect(() => {
    queueMicrotask(() => setWatch(prev => (prev.join(",") === watchKey ? prev : watchKey.split(","))));
  }, [watchKey]);
  const lastBarAt = useMemo(
    () => intraday.all.reduce<number | null>((a, s) => (a == null || s.m.lastBarAt > a ? s.m.lastBarAt : a), null),
    [intraday.all],
  );

  return {
    now, phase, open,
    companies, companiesLoading, analyst, quotes,
    sigs, sigBy, swingBull, swingBear,
    candidates, barsLoading: barsLoading && tickers.length > 0, lastRound,
    intraAll: intraday.all, intraBull: lists.bull, intraBear: lists.bear,
    spx: intraday.spx, session: intraday.spySession, lastBarAt,
  };
}

export type AlphaPicks = ReturnType<typeof useAlphaPicks>;
