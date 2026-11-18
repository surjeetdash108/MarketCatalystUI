"use client";

import { useEffect, useState } from "react";
import { useIQActions } from "./shell";
import { useApiResource } from "./hooks/useApiResource";
import { StockLogo } from "./utils";

/*
 * Market Catalyst Pulse — short posts the MarketCatalyst desk writes from the
 * admin console (/admin/blogs → Market Catalyst Pulse), newest on top. Served
 * by GET /api/pulse; every plan sees it.
 */

export interface PulsePost {
  id: string;
  text: string;
  ticker: string | null;
  name: string;
  handle: string;
  createdAt: string;
}

/** Re-read the posts this often, so a new post shows up without a reload. */
const POLL_MS = 60_000;
const AVATARS = ["#4ade80", "#8b7cf6", "#f2b33d", "#6f9fd8", "#f0565a", "#5bc0f8"];

/** "now", "5m", "3h", "2d" since the post went out. */
export function pulseAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Time of the post in US Eastern ("9:41 AM"); earlier days also carry the date. */
export function pulseTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const tz = "America/New_York";
  const time = new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: tz });
  if (day(t) === day(now)) return time;
  return `${new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })} · ${time}`;
}

/** The read for the card: the newest posts, or the search for `q` (ticker, words, name or handle). */
export const pulseQueryPath = (q: string) => {
  const t = q.trim().slice(0, 100);
  return t ? `/api/pulse?q=${encodeURIComponent(t)}` : "/api/pulse";
};

/** The avatar letter when no ticker is tagged: the post's first character. */
export const pulseLetter = (text: string) => (text.trim()[0] ?? "M").toUpperCase();

export function CommunityPulse() {
  const { openStock } = useIQActions();
  // Search box: the query is sent after a short pause in typing.
  const [q, setQ] = useState("");
  const [sentQ, setSentQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSentQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading } = useApiResource<{ posts: PulsePost[] }>(pulseQueryPath(sentQ), POLL_MS);
  const posts = data?.posts ?? [];
  const searching = sentQ.trim().length > 0;
  // Keeps "5m" / "1h" current between polls.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="cpulse">
      <div className="cpulse-h">
        <div className="cpulse-orb">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l2.5-6 4 13 3-9 1.5 2H22" /></svg>
        </div>
        <h3>Market Catalyst Pulse</h3>
        <span className="wmn-live"><span className="dot" />Live</span>
      </div>
      <div className="cpulse-search">
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") setQ(""); }}
          placeholder="Search posts — ticker, keyword or @handle"
          aria-label="Search Market Catalyst Pulse"
          maxLength={100}
          data-testid="pulse-search"
        />
        {q && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQ("")}>×</button>}
      </div>

      <div className="cpulse-body">
        {posts.length === 0 && (
          <div style={{ padding: "18px 4px", fontSize: ".8rem", color: "var(--text-dim-solid)", textAlign: "center" }}>
            {loading && !data ? (searching ? "Searching…" : "Loading…") : searching ? `No posts match “${sentQ.trim()}”.` : "No posts yet."}
          </div>
        )}
        {posts.map((p, i) => (
          <div key={p.id} className="cpulse-tw">
            {p.ticker ? (
              <span className="cpulse-av" style={{ background: "transparent", overflow: "hidden" }}>
                <StockLogo sym={p.ticker} size={22} />
              </span>
            ) : (
              <div className="cpulse-av" style={{ background: AVATARS[i % AVATARS.length] }}>{pulseLetter(p.text)}</div>
            )}
            <div className="cpulse-tw-main">
              <div className="cpulse-tw-top">
                <span className="nm">{p.name}</span>
                <span className="hd">@{p.handle}</span>
                <span className="ago">{pulseAgo(p.createdAt, now)}</span>
              </div>
              <div className="cpulse-tw-text">{p.text}</div>
              <div className="cpulse-tw-foot">
                {p.ticker && (
                  <button type="button" className="tk-link" title={`Open ${p.ticker}`} onClick={() => openStock(p.ticker as string)}>${p.ticker}</button>
                )}
                <span className="tm">{pulseTime(p.createdAt, now)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
