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
 * Ticker-prefix only, case-insensitive via uppercasing (tickers are always
 * uppercase) — a range query on a single field needs no composite index,
 * unlike an equality + different-field-orderBy query (see useOhlcvBars).
 * Company-NAME search (e.g. typing "Apple" to find AAPL) is NOT
 * implemented — would need a normalized lowercase name field added to the
 * sync job first, which doesn't exist yet.
 */
export function useTickerSearch(rawQuery: string): TickerSearchResult[] {
  const [results, setResults] = useState<TickerSearchResult[]>([]);

  useEffect(() => {
    const q = rawQuery.trim().toUpperCase();
    if (!q) {
      setResults([]);
      return;
    }

    const handle = setTimeout(() => {
      const fsQuery = query(
        collection(firebaseDb, "tickers"),
        where("ticker", ">=", q),
        where("ticker", "<", q + PREFIX_UPPER_BOUND),
        orderBy("ticker"),
        limit(MAX_RESULTS),
      );
      getDocs(fsQuery)
        .then((snap) => {
          setResults(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                ticker: data.ticker as string,
                name: (data.name as string | undefined) ?? null,
                price: (data.price as number | undefined) ?? null,
                pctChange: (data.pctChange as number | undefined) ?? null,
              };
            }),
          );
        })
        .catch((err) => {
          console.error(`Ticker search failed for "${q}":`, err);
          setResults([]);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [rawQuery]);

  return results;
}
