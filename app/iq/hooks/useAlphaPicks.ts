"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../backend";
import { useApiList } from "./useApiList";
import { useIntradayBars } from "./useIntradayBars";
import { etParts, getMarketStatus, type MarketPhase } from "../market-status";
import type { AnalystConsensusDoc, CompanyDoc } from "../types";
import { pickBear, pickTop, scoreCompany, type Signal } from "../alpha-signals-model";
import {
  evaluateIntraday, intradayCandidates, intradayLists, metricsFromBars,
  type IntradaySignal,
} from "../alpha-intraday";

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
  const { data: companies, loading: companiesLoading } = usePolledList<CompanyDoc>(enabled ? "/market-data/companies" : null, open ? COMPANY_POLL_MS : null);
  const { data: analystDocs } = useApiList<AnalystConsensusDoc>(enabled ? "/market-data/analyst-actions" : null);

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
    const spy = metricsFromBars(bars.get("SPY")?.bars);
    const spx = spy?.chg ?? null;
    const today = etParts(new Date(now)).isoDate;
    const out: IntradaySignal[] = [];
    for (const c of candidates) {
      const b = bars.get(c.ticker);
      if (!b) continue;
      const prevClose = c.price != null && c.pctChange != null && c.pctChange > -100 ? c.price / (1 + c.pctChange / 100) : null;
      const m = metricsFromBars(b.bars, { dailyRvol: c.rvol ?? null, prevClose });
      if (!m) continue;
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
  }, [bars, candidates, sigBy, open, now]);

  const lists = useMemo(() => intradayLists(intraday.all, limit, fill), [intraday.all, limit, fill]);
  const lastBarAt = useMemo(
    () => intraday.all.reduce<number | null>((a, s) => (a == null || s.m.lastBarAt > a ? s.m.lastBarAt : a), null),
    [intraday.all],
  );

  return {
    now, phase, open,
    companies, companiesLoading, analyst,
    sigs, sigBy, swingBull, swingBear,
    candidates, barsLoading: barsLoading && tickers.length > 0, lastRound,
    intraAll: intraday.all, intraBull: lists.bull, intraBear: lists.bear,
    spx: intraday.spx, session: intraday.spySession, lastBarAt,
  };
}

export type AlphaPicks = ReturnType<typeof useAlphaPicks>;
