"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../backend";
import type { NewsArticleDoc } from "../types/news";
import { mergeNews, sinceParam } from "./news-merge";
import { retryDelayMs } from "./retry-policy";

/**
 * Per-ticker news with incremental polling. The first fetch pulls the ticker's
 * stored articles (`GET /live/news?ticker=X`); every later poll sends
 * `&since=<newest createdAt we hold>` and gets back only what is new or changed
 * (usually `[]`, a few bytes) which is merged into the list already on screen.
 * Same `{ data, loading, error }` shape as useApiResource<NewsArticleDoc[]>,
 * so callers swap it in without other changes. Pass ticker === null to skip.
 */
export function useTickerNews(ticker: string | null, refetchMs?: number) {
  const [data, setData] = useState<NewsArticleDoc[] | null>(null);
  const [loading, setLoading] = useState(ticker !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticker === null) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    let held: NewsArticleDoc[] | null = null; // what this effect run has loaded
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const base = `/live/news?ticker=${encodeURIComponent(ticker)}`;

    // Ticker changed: drop the previous ticker's articles straight away.
    queueMicrotask(() => {
      if (!cancelled) {
        setData(null);
        setError(null);
        setLoading(true);
      }
    });

    async function load(attempt = 0) {
      try {
        const cursor = held ? sinceParam(held, Date.now()) : null;
        const result = await apiGet<NewsArticleDoc[]>(
          cursor ? `${base}&since=${encodeURIComponent(cursor)}` : base,
        );
        if (cancelled) return;
        const list = Array.isArray(result) ? result : [];
        held = held ? mergeNews(held, list) : list;
        setData(held);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const wait = retryDelayMs(err, attempt);
        if (wait != null) {
          retryTimer = setTimeout(() => void load(attempt + 1), wait);
          return;
        }
        if ((err as Error)?.name !== "AbortError") {
          console.error(`Backend fetch failed for "${base}":`, err);
        }
        // A failed poll must not blank articles already on screen.
        if (!held) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    void load();
    const interval = refetchMs ? setInterval(() => void load(), refetchMs) : undefined;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [ticker, refetchMs]);

  return { data, loading, error };
}
