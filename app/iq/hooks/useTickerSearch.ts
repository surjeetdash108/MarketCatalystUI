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
 * Matches by ticker symbol AND company name, via three parallel queries over
 * the `tickers` collection, merged and de-duplicated by ticker (symbol match
 * ranked first, then name-prefix, then token):
 *   1. `ticker` prefix range (uppercased) — "GOOG" → GOOGL
 *   2. `nameLower` prefix range (lowercased) — "app" → "Apple Inc."
 *   3. `searchTokens` array-contains (lowercased whole word) — "motor" → "Ford
 *      Motor Company"
 * All three use Firestore's automatic single-field indexes (incl. the array
 * index for token), so no composite index is needed (unlike useOhlcvBars).
 *
 * Still cannot do (Firestore has no substring/full-text/alias search): mid-word
 * fragments ("oogle") and aliases where the legal name differs ("google" →
 * "Alphabet Inc."). Those are handled only by the shell's curated alias list,
 * or would need a search service (Algolia/Typesense). The curated list in
 * shell.tsx does substring matching, so "google" works there for top tickers.
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
      // Whole-word token match, e.g. "motor" → "Ford Motor Company". Matches a
      // full name word or the ticker (case-insensitive) — served by the
      // automatic array index on searchTokens.
      const byToken = getDocs(
        query(
          tickers,
          where("searchTokens", "array-contains", lower),
          limit(MAX_RESULTS),
        ),
      );

      Promise.all([bySymbol, byName, byToken])
        .then(([symbolSnap, nameSnap, tokenSnap]) => {
          // Symbol matches first, then name-prefix, then token; de-dupe by ticker.
          const seen = new Set<string>();
          const merged: TickerSearchResult[] = [];
          for (const snap of [symbolSnap, nameSnap, tokenSnap]) {
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
