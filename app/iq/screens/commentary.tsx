"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { firebaseDb, firebaseAuth } from "../../firebase";
import { useIQActions } from "../shell";
import { StockLogo, DataState, isEmptyState } from "../utils";
import { useCollection } from "../hooks/useCollection";
import { useExtendedHours } from "../hooks/useExtendedHours";

const TABS = ["Live", "Premarket", "After Hours", "My names", "Macro"];

/* ── Live news doc shape + helpers ── */
interface NewsDoc {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  publishedAt: string; // ISO
}
interface CompanyDoc { id: string; ticker: string; name: string | null; }

type CommentaryItem = { cat: string; accent: string; time: string; text: string; why: string; live?: boolean; ticker: string | null };

function etHour(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 12);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function etTimeLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(new Date(iso));
  const hour = parts.find(p => p.type === "hour")?.value ?? "12";
  const minute = parts.find(p => p.type === "minute")?.value ?? "00";
  const dayPeriod = (parts.find(p => p.type === "dayPeriod")?.value ?? "AM").toLowerCase()[0];
  return `${hour}:${minute}${dayPeriod}`;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function liveCatAccent(c: string): string {
  if (c === "earnings") return "var(--warn)";
  if (c === "merger") return "var(--ai)";
  if (c === "company") return "var(--brand-2)";
  return "var(--text-dim-solid)";
}
function liveCatLabel(c: string): string {
  if (c === "earnings") return "Earnings";
  if (c === "merger") return "M&A";
  if (c === "company") return "Company";
  return "Macro";
}

function liveToCommentaryItem(n: NewsDoc): CommentaryItem {
  return {
    cat: liveCatLabel(n.category),
    accent: liveCatAccent(n.category),
    time: etTimeLabel(n.publishedAt),
    text: `<b>${n.ticker}</b> ${n.headline}`,
    why: n.summary || `via ${n.source}`,
    live: true,
    ticker: n.ticker || null,
  };
}

/* ── Feed item component ── */
function FeedItem({ item, i, total, onItemClick }: {
  item: CommentaryItem;
  i: number;
  total: number;
  onItemClick: (ticker: string | null) => void;
}) {
  const ticker = item.ticker;
  return (
    <div
      onClick={() => onItemClick(ticker)}
      style={{
        display: "flex", gap: 12,
        padding: "12px 0",
        borderBottom: i < total - 1 ? "1px solid var(--border-soft)" : "none",
        cursor: "pointer",
        borderRadius: 8,
        transition: "background .14s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div style={{ flexShrink: 0, width: 90, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
        {ticker ? (
          <StockLogo sym={ticker} size={28} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${item.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: ".65rem", fontWeight: 800, color: item.accent }}>◆</span>
          </div>
        )}
        <span className="pill" style={{ background: "var(--surface-3)", color: item.accent, marginTop: 1 }}>{item.cat}</span>
        <div className="mono" style={{ fontSize: ".66rem", color: "var(--text-dim-solid)" }}>{item.time}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".88rem", color: "var(--text)" }} dangerouslySetInnerHTML={{ __html: item.text }} />
        <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", borderLeft: `2px solid ${item.accent}55`, paddingLeft: 9, marginTop: 5 }}>
          {item.why}
        </div>
        {ticker && (
          <div style={{ marginTop: 6, fontSize: ".68rem", color: "var(--brand-2)", fontWeight: 600 }}>
            View {ticker} news history →
          </div>
        )}
      </div>
    </div>
  );
}

/* ── News Drawer — live synced headlines only ── */
function NewsDrawer({ sym, name, allNews, onClose }: { sym: string; name: string; allNews: NewsDoc[]; onClose: () => void }) {
  const { openStockFull } = useIQActions();
  const liveItems = allNews.filter(n => n.ticker === sym).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="side-drawer">
        <div className="drawer-h">
          <StockLogo sym={sym} size={38} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
              {sym}{name ? ` · ${name}` : ""}
            </div>
            <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
              News history
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          <div className="ai-sec"><div className="h">{sym} · synced headlines</div></div>
          {liveItems.length === 0 ? (
            <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", padding: "10px 0" }}>
              No synced headlines for {sym} yet.
            </div>
          ) : liveItems.map(item => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer"
              className="minirow" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 12, textDecoration: "none" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ lineHeight: 1.5 }}>
                  <span className="pill" style={{ background: "var(--surface-3)", color: liveCatAccent(item.category), marginRight: 6, fontSize: ".66rem" }}>
                    {liveCatLabel(item.category)}
                  </span>
                  <span style={{ fontSize: ".84rem", color: "var(--text)" }}>{item.headline}</span>
                </div>
                <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 3 }}>
                  {item.source} · {timeAgo(item.publishedAt)}
                </div>
              </div>
            </a>
          ))}

          <button className="btn primary" style={{ width: "100%", marginTop: 14 }}
            onClick={() => { onClose(); openStockFull(sym); }}>
            Open full stock page →
          </button>
          <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 8, textAlign: "center" }}>
            Synced headlines only · not investment advice.
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main commentary screen ── */
export function CommentaryScreen() {
  const router = useRouter();
  const { data: liveNews, loading, error } = useCollection<NewsDoc>("news");
  const { data: companies } = useCollection<CompanyDoc>("companies");
  const [activeTab,     setActiveTab]     = useState(0);
  const [search,        setSearch]        = useState("");
  const [newsDrawer,    setNewsDrawer]    = useState<string | null>(null);
  const [noCompanyOpen, setNoCompanyOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [suggOpen, setSuggOpen] = useState(false);

  // The user's real tracked names — their saved watchlist + portfolio holdings.
  const uid = firebaseAuth.currentUser?.uid ?? null;
  const [watchSyms, setWatchSyms] = useState<string[]>([]);
  const [folioSyms, setFolioSyms] = useState<string[]>([]);
  useEffect(() => {
    if (!uid) return;
    const unsubW = onSnapshot(doc(firebaseDb, "users", uid, "watchlists", "default"), snap => {
      setWatchSyms((snap.data()?.tickers as string[] | undefined) ?? []);
    });
    const unsubH = onSnapshot(collection(firebaseDb, "users", uid, "portfolios", "default", "holdings"), snap => {
      setFolioSyms(snap.docs.map(d => d.id));
    });
    return () => { unsubW(); unsubH(); };
  }, [uid]);
  // Empty when signed out, regardless of any stale state from a prior session.
  const mySymbols = new Set(uid ? [...watchSyms, ...folioSyms] : []);

  const nameByTicker = new Map(companies.map(c => [c.ticker, c.name ?? ""]));

  const liveConverted: CommentaryItem[] = [...liveNews]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .map(liveToCommentaryItem);

  const livePremarket  = liveNews.filter(n => etHour(n.publishedAt) < 9.5).map(liveToCommentaryItem);
  const liveAfterHours = liveNews.filter(n => etHour(n.publishedAt) >= 16).map(liveToCommentaryItem);
  const liveMacro      = liveNews.filter(n => n.category !== "company").map(liveToCommentaryItem);
  const liveMyFeed     = liveNews.filter(n => mySymbols.has(n.ticker)).map(liveToCommentaryItem);

  // Real extended-hours moves for the names the user actually tracks, polled
  // only while the Premarket (1) or After Hours (2) tab is showing.
  const extHours = useExtendedHours(
    [...mySymbols],
    activeTab === 1 ? "pre" : "after",
    activeTab === 1 || activeTab === 2,
  );

  const tabFeed: CommentaryItem[] = (() => {
    if (activeTab === 1) return livePremarket;
    if (activeTab === 2) return liveAfterHours;
    if (activeTab === 3) return liveMyFeed;
    if (activeTab === 4) return liveMacro;
    return liveConverted;
  })();

  const feedLabel = (() => {
    if (activeTab === 0) return { title: "Intraday commentary", badge: <span className="live"><span className="dot" />Live · streaming</span> };
    if (activeTab === 1) return { title: "Pre-market · before 9:30a ET", badge: <span className="pill" style={{ background: "var(--surface-3)", color: "var(--brand-2)" }}>Pre-market</span> };
    if (activeTab === 2) return { title: "After hours · post 4:00p ET", badge: <span className="pill amc">After hours</span> };
    if (activeTab === 3) return { title: `My names · ${mySymbols.size} tracked`, badge: <span className="pill ai">Portfolio + Watchlist</span> };
    if (activeTab === 4) return { title: "Macro & rates", badge: <span className="pill" style={{ background: "var(--surface-3)", color: "var(--warn)" }}>Macro</span> };
    return { title: "Commentary", badge: null };
  })();

  const q = search.trim().toUpperCase();
  const ql = q.toLowerCase();
  const searchSyms = [...new Set([...companies.map(c => c.ticker), ...liveNews.map(n => n.ticker).filter(Boolean)])].sort();
  const suggestions = q.length >= 1
    ? searchSyms.filter(s => s.includes(q) || (nameByTicker.get(s) ?? "").toLowerCase().includes(ql)).slice(0, 8)
    : [];

  function openNews(sym: string) {
    setSearch("");
    setSuggOpen(false);
    setNewsDrawer(sym);
  }

  function handleItemClick(ticker: string | null) {
    if (ticker) setNewsDrawer(ticker);
    else setNoCompanyOpen(true);
  }

  const emptyMsg = activeTab === 3
    ? (mySymbols.size === 0 ? "Add names to your watchlist or portfolio to see their news here." : "No synced headlines for your tracked names yet.")
    : "No synced headlines in this category yet.";

  return (
    <>
      <div className="page-head">
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " on" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* Ticker search bar */}
        <div className="fbar" style={{ marginBottom: 12, position: "relative" }}>
          <div style={{ position: "relative", minWidth: "8.125rem" }}>
            <input
              ref={searchRef}
              className="mv-sel"
              placeholder="Search stock…"
              value={search}
              onChange={e => { setSearch(e.target.value); setSuggOpen(true); }}
              onFocus={() => setSuggOpen(true)}
              onBlur={() => setTimeout(() => setSuggOpen(false), 160)}
              autoComplete="off"
              style={{ width: "100%" }}
            />
            {suggOpen && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 30,
                background: "var(--surface-1)", border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)", marginTop: 2,
                minWidth: 220, width: "100%",
              }}>
                {suggestions.map(sym => (
                  <div
                    key={sym}
                    className="sugg-row"
                    onMouseDown={() => openNews(sym)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer" }}
                  >
                    <b style={{ fontFamily: "var(--f-mono)", color: "var(--text-hi)", minWidth: 52 }}>{sym}</b>
                    <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", flex: 1 }}>{nameByTicker.get(sym) ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
            {suggOpen && q.length >= 1 && suggestions.length === 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 30,
                background: "var(--surface-1)", border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)", marginTop: 2, minWidth: 220, width: "100%",
                padding: "10px 12px", fontSize: ".78rem", color: "var(--text-dim-solid)",
              }}>
                No match for &ldquo;{search.toUpperCase()}&rdquo;
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
            Type a ticker, then click it to open a side panel of its news
          </span>
        </div>

        <div className="dash">

          {/* col-8: Feed */}
          <div className="col-8">
            <div className="card">
              <div className="card-h">
                <h3>{feedLabel.title}</h3>
                {feedLabel.badge}
              </div>
              {/* Real extended-hours moves, ahead of the news list. */}
              {(activeTab === 1 || activeTab === 2) && extHours.movers.length > 0 && (
                <div style={{ padding: "8px 14px 10px", borderBottom: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                      {activeTab === 1 ? "Pre-market movers" : "After-hours movers"}
                    </span>
                    <span style={{ fontSize: ".62rem", color: "var(--text-dim-solid)" }}>
                      · delayed ~15 min
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {extHours.movers.slice(0, 12).map(m => (
                      <span
                        key={m.ticker}
                        className="pill"
                        style={{
                          background: "var(--surface-3)",
                          color: m.changePct >= 0 ? "var(--up)" : "var(--down)",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: ".7rem",
                        }}
                        title={m.price != null ? `Last $${m.price.toFixed(2)}` : undefined}
                      >
                        {m.ticker} {m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="card-b" style={{ paddingTop: 2, maxHeight: 620, overflowY: "auto" }}>
                {tabFeed.length === 0 ? (
                  <DataState
                    loading={loading}
                    error={error}
                    empty={isEmptyState(loading, error, tabFeed.length)}
                    label="commentary"
                    emptyMsg={emptyMsg}
                    subMsg={activeTab === 3 ? undefined : "Headlines sync from Polygon news on a rolling schedule."}
                  />
                ) : tabFeed.map((item, i) => (
                  <FeedItem key={i} item={item} i={i} total={tabFeed.length} onItemClick={handleItemClick} />
                ))}
              </div>
            </div>

            {/* Quick news lookup */}
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-h">
                <h3>{activeTab === 3 ? "Tracked names" : "Quick news lookup"}</h3>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>tap to open</span>
              </div>
              <div className="card-b" style={{ paddingTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {activeTab === 3 && mySymbols.size === 0 ? (
                  <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>No tracked names yet.</span>
                ) : (activeTab === 3 ? [...mySymbols] : [...new Set(liveNews.map(n => n.ticker).filter(Boolean))].slice(0, 12)).map(sym => (
                  <button key={sym} className="chip" onClick={() => openNews(sym)}>{sym}</button>
                ))}
              </div>
            </div>
          </div>

          {/* col-4: recap pointer */}
          <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="card-h">
                <h3>End-of-day recap</h3>
                <span className="pill amc">after the close</span>
              </div>
              <div className="card-b">
                <p style={{ fontSize: ".82rem", lineHeight: 1.55, color: "var(--text-dim-solid)" }}>
                  A summary of final index performance, the day&apos;s top synced stories, and what&apos;s scheduled for tomorrow is available on the recap page after each close.
                </p>
                <button className="btn ai" style={{ marginTop: 10, width: "100%" }} onClick={() => router.push("/menu/recap")}>
                  See today&apos;s EOD recap →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* No company associated — sliding drawer */}
      {noCompanyOpen && (
        <>
          <div className="scrim" onClick={() => setNoCompanyOpen(false)} />
          <div className="side-drawer">
            <div className="drawer-h">
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "var(--surface-3)", border: "1px solid var(--border-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".9rem", color: "var(--text-dim-solid)", fontWeight: 700,
              }}>
                ◆
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
                  Macro / Market news
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                  No company associated with this item
                </div>
              </div>
              <button className="closebtn" onClick={() => setNoCompanyOpen(false)}>✕</button>
            </div>

            <div className="drawer-b">
              <div className="ai-sec"><div className="h">No company associated</div></div>
              <div style={{
                background: "var(--surface-1)", border: "1px solid var(--border-soft)",
                borderRadius: 10, padding: 16, marginBottom: 18,
                fontSize: ".85rem", color: "var(--text-dim-solid)", lineHeight: 1.65,
              }}>
                This news item covers <b style={{ color: "var(--text-hi)" }}>macro conditions</b>,
                {" "}market-wide price action, or rates — it is not tied to a specific public company.
              </div>
              <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
                Use the search bar at the top to look up any ticker.
              </div>
            </div>
          </div>
        </>
      )}

      {/* News history sliding drawer */}
      {newsDrawer && (
        <NewsDrawer sym={newsDrawer} name={nameByTicker.get(newsDrawer) ?? ""} allNews={liveNews} onClose={() => setNewsDrawer(null)} />
      )}
    </>
  );
}
