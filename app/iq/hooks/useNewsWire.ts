"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "../backend";
import type { NewsArticleDoc } from "../types";

/** Client poll cadence. The server re-polls FMP's news + press feeds every 15s
 *  (analyst calls, 8-Ks, macro every 30s), so a story shows within ~15-45s. */
const POLL_MS = 15_000;
/** Wire stories kept client-side. */
const KEEP = 500;

/** `now` is the server's cursor: pass it back as `since` for what arrived after. */
interface WireResponse { now: number; polledAt: string | null; items: NewsArticleDoc[] }

/**
 * Live news tape: polls GET /live/news-wire every POLL_MS while `active` and
 * the tab is visible, asking only for stories that arrived since its last
 * poll. The feed sorts by publish time, so the newest story is always on top.
 */
export function useNewsWire(active: boolean) {
  const [items, setItems] = useState<NewsArticleDoc[]>([]);
  const [polledAt, setPolledAt] = useState<string | null>(null);
  const cursor = useRef<number | null>(null);
  const seenUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const since = cursor.current;
      const res = await apiGet<WireResponse>(
        `/live/news-wire${since != null ? `?since=${since}` : ""}`,
      ).catch(() => null);
      if (cancelled || !res) return;
      cursor.current = res.now;
      setPolledAt(res.polledAt);
      // The server may resend a story at the cursor boundary — keep URLs unique.
      const add = res.items.filter(d => !seenUrls.current.has(d.url));
      if (add.length === 0) return;
      for (const d of add) seenUrls.current.add(d.url);
      setItems(prev => [...add, ...prev].slice(0, KEEP));
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return { items, polledAt };
}
