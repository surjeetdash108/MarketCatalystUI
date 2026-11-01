"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../backend";

export interface TickerSearchResult {
  ticker: string;
  name: string | null;
  price: number | null;
  pctChange: number | null;
}

interface SearchResponse {
  q: string;
  results: Array<{ ticker: string; name: string | null }>;
}

const DEBOUNCE_MS = 100;

// Client-side query cache: backspacing or repeating queries resolves instantly in 0ms
const queryCache = new Map<string, TickerSearchResult[]>();

/**
 * On-demand ticker search via GET /live/search — an in-memory ~13,000-ticker
 * universe (src/live/ticker-search.service.ts), zero Firestore reads.
 * Replaces three parallel Firestore prefix-range queries against the
 * `tickers` collection (ticker prefix, nameLower prefix, searchTokens
 * array-contains).
 */
export function useTickerSearch(rawQuery: string): TickerSearchResult[] {
  const trimmed = rawQuery.trim();
  const cacheKey = trimmed.toLowerCase();
  const [results, setResults] = useState<TickerSearchResult[]>(() => queryCache.get(cacheKey) ?? []);

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      return;
    }

    // Cache hit: instant 0ms update, no network call or debounce delay
    const cached = queryCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      return;
    }

    let cancelled = false;

    const handle = setTimeout(() => {
      apiGet<SearchResponse>(`/live/search?q=${encodeURIComponent(trimmed)}`)
        .then((data) => {
          if (cancelled) return;
          const mapped = data.results.map((r) => ({
            ticker: r.ticker,
            name: r.name,
            price: null,
            pctChange: null,
          }));
          queryCache.set(cacheKey, mapped);
          setResults(mapped);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error(`Ticker search failed for "${trimmed}":`, err);
          setResults([]);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, cacheKey]);

  return results;
}
