"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "../backend";
import {
  SNAPSHOT_OFFHOURS_MAX_AGE_MS,
  loadCachedBoard,
  newerBoard,
  readSavedBoard,
  saveCachedBoard,
} from "./board-source";

/** Board refresh: the worker saves a new board every minute, so 30 s is plenty. */
export const BOARD_POLL_MS = 30_000;

type Board = { asOf?: string | null };

/**
 * The Money Flow board, from the fastest source that has it (see board-source.ts):
 * this browser's last copy → Firestore money_flow/latest → GET /live/money-flow.
 * Same { data, loading, error } shape as useApiResource, so the screen is unchanged.
 */
export function useMoneyFlowBoard<T extends Board>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<T | null>(null);
  const directOk = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const offer = (next: T | null, persist: boolean) => {
      if (cancelled || !next) return;
      const winner = newerBoard(current.current, next);
      if (winner === current.current) return;
      current.current = winner;
      setData(winner);
      setError(null);
      if (persist) void saveCachedBoard(winner);
    };

    const fromApi = async () => {
      const b = await apiGet<T>("/live/money-flow");
      offer(b, true);
      return b;
    };

    const fromFirestore = async () => {
      try {
        const b = await readSavedBoard<T>();
        offer(b, true);
        return b;
      } catch {
        return null; // refused (plan claim not refreshed yet) or unavailable → API
      }
    };

    // 1. This browser's last board, at once (a return visit never waits).
    void loadCachedBoard<T>().then((cached) => {
      const at = Date.parse(cached?.asOf ?? "");
      if (cached && Number.isFinite(at) && Date.now() - at <= SNAPSHOT_OFFHOURS_MAX_AGE_MS) offer(cached, false);
    });

    // 2. Firestore, and 3. the API once in the background (usage stats, the
    // backend's entitlement check, and the fallback if Firestore said no).
    void (async () => {
      const direct = await fromFirestore();
      directOk.current = direct != null;
      try {
        await fromApi();
      } catch (err) {
        if (!cancelled && !direct && !current.current) {
          if ((err as Error)?.name !== "AbortError") console.error("Money Flow board failed:", err);
          setError((err as Error)?.message || "unavailable");
        }
      }
      if (!cancelled) schedule();
    })();

    function schedule() {
      timer = setTimeout(async () => {
        if (cancelled) return;
        if (typeof document !== "undefined" && document.hidden) return schedule();
        if (directOk.current) {
          const b = await fromFirestore();
          if (b == null) directOk.current = false;
        }
        if (!directOk.current) await fromApi().catch(() => undefined);
        if (!cancelled) schedule();
      }, BOARD_POLL_MS);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { data, loading: data == null && error == null, error };
}
