"use client";

import { useEffect, useRef, useState } from "react";
import { useIQActions } from "./shell";
import { useApiResource } from "./hooks/useApiResource";
import { StockLogo } from "./utils";
import { parsePulse, pulsePlainText, type PulseInline } from "./pulse-rich";
import { useFreshStories } from "./hooks/useFreshStories";
import { useArrivalMotion } from "./hooks/useArrivalMotion";

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

/** The read for the card: the newest posts, or the search for `q` (ticker or words). */
export const pulseQueryPath = (q: string) => {
  const t = q.trim().slice(0, 100);
  return t ? `/api/pulse?q=${encodeURIComponent(t)}` : "/api/pulse";
};

/** The avatar letter when no ticker is tagged: the post's first character. */
export const pulseLetter = (text: string) => (text.trim()[0] ?? "M").toUpperCase();

/**
 * The words to highlight for what is typed in the search box: split on spaces,
 * a leading $ (ticker) or @ (handle) dropped, lower-cased, duplicates removed.
 */
export function pulseTerms(q: string): string[] {
  const out: string[] = [];
  for (const w of q.trim().split(/\s+/)) {
    const t = w.replace(/^[$@]+/, "").toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 8);
}

/** `text` cut into runs, each marked when it matches one of `terms` (case-insensitive). */
export function pulseSegments(text: string, terms: string[]): Array<{ t: string; hit: boolean }> {
  if (!text || terms.length === 0) return [{ t: text, hit: false }];
  const alt = [...terms].sort((a, b) => b.length - a.length)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${alt})`, "gi"));
  return parts.filter(t => t !== "").map(t => ({ t, hit: terms.includes(t.toLowerCase()) }));
}

/** How many times `terms` match in `text` (what the card marks), for the count beside the search box. */
export const pulseMatchCount = (text: string, terms: string[]): number =>
  pulseSegments(text, terms).filter(s => s.hit).length;

/** `text` with the matching words wrapped in <mark>. */
function Hl({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {pulseSegments(text, terms).map((seg, i) =>
        seg.hit ? <mark key={i} className="cpulse-hl">{seg.t}</mark> : seg.t,
      )}
    </>
  );
}

/** Inline runs (bold, italic, links) with search matches marked inside them. */
function RichInline({ c, terms }: { c: PulseInline[]; terms: string[] }) {
  return (
    <>
      {c.map((x, i) =>
        x.k === "text" ? <Hl key={i} text={x.t} terms={terms} />
          : x.k === "b" ? <strong key={i}><RichInline c={x.c} terms={terms} /></strong>
          : x.k === "i" ? <em key={i}><RichInline c={x.c} terms={terms} /></em>
          : <a key={i} href={x.href} target="_blank" rel="noopener noreferrer nofollow"><RichInline c={x.c} terms={terms} /></a>,
      )}
    </>
  );
}

/** A post's formatted text: paragraphs with line breaks, bullet and numbered lists. */
function PulseRich({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {parsePulse(text).map((b, i) =>
        b.k === "p" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>{j > 0 && <br />}<RichInline c={l} terms={terms} /></span>
            ))}
          </p>
        ) : b.k === "ul" ? (
          <ul key={i}>{b.items.map((it, j) => <li key={j}><RichInline c={it} terms={terms} /></li>)}</ul>
        ) : (
          <ol key={i}>{b.items.map((it, j) => <li key={j}><RichInline c={it} terms={terms} /></li>)}</ol>
        ),
      )}
    </>
  );
}

/**
 * One post's text, held to a few lines with a Show more / Show less toggle.
 * The toggle only appears when the text really overflows the collapsed height
 * (ResizeObserver also reports once on observe, so it is measured on mount and
 * again when the card is resized).
 */
function PulseText({ text, terms }: { text: string; terms: string[] }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // While searching the whole post shows: a match past the fourth line would
  // otherwise be in the results but hidden behind "Show more".
  const searching = terms.length > 0;
  const clamped = !open && !searching;
  useEffect(() => {
    const el = ref.current;
    if (!el || !clamped) return;
    const ro = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, clamped]);
  return (
    <>
      <div ref={ref} className={`cpulse-tw-text${clamped ? " clamp" : ""}`}><PulseRich text={text} terms={terms} /></div>
      {!searching && (overflows || open) && (
        <button type="button" className="cpulse-more" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

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
  // Live Feed look: a post that arrives while the card is open flashes green
  // with a NEW chip and drops in (useFreshStories + useArrivalMotion). Searching
  // shows a different list, so nothing is "new" there.
  const ready = !!data && !loading;
  const freshIds = useFreshStories(sentQ.trim() ? [] : posts.map(p => [p.id]), ready && !sentQ.trim());
  const bodyRef = useRef<HTMLDivElement>(null);
  useArrivalMotion(bodyRef, sentQ.trim() ? `q:${sentQ.trim()}` : "latest");
  // Opening the dashboard: the top three posts drop in one after another, as
  // if they had just come in. Once per mount (each visit to the dashboard).
  const [introIds, setIntroIds] = useState<string[] | null>(null);
  if (introIds === null && ready && !sentQ.trim() && posts.length > 0) setIntroIds(posts.slice(0, 3).map(p => p.id));
  // Highlights follow the box as it is typed; the posts below catch up after the pause.
  const terms = pulseTerms(q);
  const searching = sentQ.trim().length > 0;
  // Everything marked below: the post's visible text and its ticker.
  const matches = terms.length === 0 ? 0 : posts.reduce(
    (n, p) => n + [pulsePlainText(p.text), p.ticker ?? ""].reduce((m, f) => m + pulseMatchCount(f, terms), 0),
    0,
  );
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
          placeholder="Search posts — ticker or keyword"
          aria-label="Search Market Catalyst Pulse"
          maxLength={100}
          data-testid="pulse-search"
        />
        {terms.length > 0 && (
          <span className={`cnt${matches === 0 ? " none" : ""}`} aria-live="polite" data-testid="pulse-count">
            {matches === 0 ? "No matches" : `${matches} ${matches === 1 ? "match" : "matches"}`}
          </span>
        )}
        {q && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQ("")}>×</button>}
      </div>

      <div className="cpulse-body" ref={bodyRef}>
        {posts.length === 0 && (
          <div style={{ padding: "18px 4px", fontSize: ".8rem", color: "var(--text-dim-solid)", textAlign: "center" }}>
            {loading && !data ? (searching ? "Searching…" : "Loading…") : searching ? `No posts match “${sentQ.trim()}”.` : "No posts yet."}
          </div>
        )}
        {posts.map((p, i) => {
          const fresh = freshIds.has(p.id);
          const intro = !fresh && !searching && introIds ? introIds.indexOf(p.id) : -1;
          return (
          <div
            key={p.id}
            className={`cpulse-tw lfb-row${fresh ? " lfb-fresh" : ""}${intro >= 0 ? " cpulse-intro" : ""}`}
            style={intro >= 0 ? { animationDelay: `${intro * 220}ms` } : undefined}
            data-fid={p.id}
            data-fresh={fresh ? "1" : undefined}
          >
            {fresh && <span className="lfb-new">NEW</span>}
            {p.ticker ? (
              <span className="cpulse-av" style={{ background: "transparent", overflow: "hidden" }}>
                <StockLogo sym={p.ticker} size={22} />
              </span>
            ) : (
              <div className="cpulse-av" style={{ background: AVATARS[i % AVATARS.length] }}>{pulseLetter(p.text)}</div>
            )}
            <div className="cpulse-tw-main">
              <PulseText text={p.text} terms={terms} />
              <div className="cpulse-tw-foot">
                {p.ticker && (
                  <button type="button" className="tk-link" title={`Open ${p.ticker}`} onClick={() => openStock(p.ticker as string)}>$<Hl text={p.ticker} terms={terms} /></button>
                )}
                <span className="tm">{pulseTime(p.createdAt, now)} · {pulseAgo(p.createdAt, now)}</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
