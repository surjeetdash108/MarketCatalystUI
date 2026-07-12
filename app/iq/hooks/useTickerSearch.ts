"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { firebaseDb } from "../../firebase";

export interface TickerSearchResult {
  ticker: string;
  name: string | null;
  price: number | null;
  pctChange: number | null;
}

const DEBOUNCE_MS = 200;
const MAX_RESULTS = 20;
// Highest-codepoint BMP char, built via fromCharCode to avoid embedding a
// literal special character in source — the standard Firestore prefix-range
// trick: where(field >= "AB") AND where(field < "AB" + PREFIX_UPPER_BOUND)
// matches every string starting with "AB".
const PREFIX_UPPER_BOUND = String.fromCharCode(0xf8ff);

/**
 * On-demand ticker-prefix search over the full ~10,000-ticker `tickers`
 * collection (name/exchange/type from ticker-universe.job.ts, price/
 * pctChange/volume from market-quotes.job.ts). Deliberately NOT a
 * useCollection()-style full-collection subscription — that would mean
 * every page load, for every user, downloads the whole collection (this
 * hook lives in the shell, which wraps every screen). Instead this runs a
 * single scoped range query per search, only when there's a query.
 *
 * Matches by BOTH ticker symbol AND company name, via two parallel
 * single-field prefix range queries — `ticker` (uppercased; tickers are
 * always uppercase) and `nameLower` (lowercased company name, written by
 * ticker-universe.job.ts). Each is a single-field range, which Firestore
 * serves from its automatic single-field index — no composite index needed
 * (unlike useOhlcvBars). Results are merged and de-duplicated by ticker,
 * with symbol matches ranked ahead of name matches.
 *
 * Prefix-only, by design (Firestore has no substring/full-text search): a
 * name query matches names STARTING with the text ("App" → "Apple Inc."),
 * not a word in the middle ("Motor" won't find "Ford Motor Co"). A real
 * mid-word/fuzzy search would need a search service (Algolia/Typesense) or
 * a stored keyword-token array — out of scope here.
 *
 * NOTE: `nameLower` only exists on ticker docs written after that field was
 * added, so name search returns nothing until ticker-universe.job re-runs.
 */
function mapDoc(data: Record<string, unknown>): TickerSearchResult {
  return {
    ticker: data.ticker as string,
    name: (data.name as string | undefined) ?? null,
    price: (data.price as number | undefined) ?? null,
    pctChange: (data.pctChange as number | undefined) ?? null,
  };
}

export function useTickerSearch(rawQuery: string): TickerSearchResult[] {
  const [results, setResults] = useState<TickerSearchResult[]>([]);

  useEffect(() => {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    const tickers = collection(firebaseDb, "tickers");

    const handle = setTimeout(() => {
      const bySymbol = getDocs(
        query(
          tickers,
          where("ticker", ">=", upper),
          where("ticker", "<", upper + PREFIX_UPPER_BOUND),
          orderBy("ticker"),
          limit(MAX_RESULTS),
        ),
      );
      const byName = getDocs(
        query(
          tickers,
          where("nameLower", ">=", lower),
          where("nameLower", "<", lower + PREFIX_UPPER_BOUND),
          orderBy("nameLower"),
          limit(MAX_RESULTS),
        ),
      );

      Promise.all([bySymbol, byName])
        .then(([symbolSnap, nameSnap]) => {
          // Symbol matches first, then name matches; de-dupe by ticker.
          const seen = new Set<string>();
          const merged: TickerSearchResult[] = [];
          for (const snap of [symbolSnap, nameSnap]) {
            for (const d of snap.docs) {
              const r = mapDoc(d.data());
              if (r.ticker && !seen.has(r.ticker)) {
                seen.add(r.ticker);
                merged.push(r);
              }
            }
          }
          setResults(merged.slice(0, MAX_RESULTS));
        })
        .catch((err) => {
          console.error(`Ticker search failed for "${trimmed}":`, err);
          setResults([]);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [rawQuery]);

  return results;
}
