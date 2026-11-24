"use client";

import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { sign, fmt, StockLogo, NotAvailable, DataState, VendorTag } from "../utils";
import { tilePctLabel } from "../heatmap-label";
import { heatTile, heatGradient, framePct, dayMovePct, asOfLabel, floorWeights, sectorHeaderPlan, squarify, packStocks, tileFontRem, MORE_KEY, type HeaderPlan, type HmFrame, type LRect } from "../heatmap-design";
import { useApiList } from "../hooks/useApiList";
import { useBackendMarketStatus } from "../hooks/useBackendMarketStatus";
import { useLiveQuotes, QUOTE_DELAY_LABEL } from "../live-quotes-context";
import { latestSessionDate } from "../market-status";
import { buildSectorList } from "../live-market-indices";
import { INDEX_MEMBERS, HEATMAP_TAB_KEYS } from "../index-constituents";
import type { CompanyDoc, SectorApiDoc } from "../types";

const StockScreenEmbed = dynamic<{ initialSym?: string }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

/** Index names as other screens link to them (`?index=Nasdaq`), so keep these keys. */
const TABS = ["Stocks", "S&P 500", "Nasdaq", "Dow", "Russell 2000"];
/** What the buttons say. */
const TAB_LABELS = ["All stocks", "S&P 500", "Nasdaq 100", "Dow 30", "Russell 2000"];
const FRAMES: HmFrame[] = ["1D", "1W", "1M", "YTD"];
const FRAME_TITLES: Record<HmFrame, string> = {
  "1D": "Change today",
  "1W": "5-session change",
  "1M": "21-session change (about a month)",
  "YTD": "Year-to-date isn't synced yet",
};
type SizeBy = "cap" | "volume";

/**
 * Smallest area (px²) a sector block is given, about 100 x 100: a two-row name, its
 * move and a few stocks. Measured on the real sectors: at 1289x475 the narrowest
 * block goes from 38px to 82px while the four biggest sectors keep 69% of the map
 * against 74% by pure market cap.
 */
const SECTOR_MIN_AREA = 10000;
/** Gap kept right of and below each sector (matches .hm2-sec padding). */
const SEC_PAD = 2;
const APPROX_W = 1100;
const APPROX_H = 620;

function capFmt(mcap: number) {
  return mcap >= 1000 ? `$${(mcap / 1000).toFixed(1)}T` : `$${Math.round(mcap)}B`;
}

/** One stock on the map. `weight` is what sizes the tile ($B of market cap, or of traded value). */
interface HmStock {
  sym: string;
  /** Market cap, $B. */
  mcap: number;
  /** Move over the chosen time frame; null when not synced. */
  chg: number | null;
  /** Dollars traded today, $B; null when no volume is synced. */
  vol: number | null;
  weight: number;
}
interface HmGroup {
  name: string;
  stocks: HmStock[];
  weight: number;
  /** Cap-weighted move of the stocks shown; null when none has one. */
  pct: number | null;
}

/** Cap-weighted move of the stocks that have one; null when none does. */
function avgChg(stocks: HmStock[]): number | null {
  const withChg = stocks.filter(s => s.chg != null);
  const cap = withChg.reduce((n, s) => n + s.mcap, 0);
  return cap > 0 ? withChg.reduce((n, s) => n + s.mcap * (s.chg as number), 0) / cap : null;
}

/** Smallest tile worth labelling on the all-sectors map, and the smallest "+N more" bundle. */
const OVERALL_MIN_TILE = (sym: string): [number, number] => [Math.max(26, sym.length * 5.6 + 8), 17];
const OVERALL_MIN_MORE: [number, number] = [30, 18];

/** Tab named by `?index=` (e.g. from the Dashboard index pop-up), else "Stocks". */
function tabFromParam(v: string | null): number {
  const i = v ? TABS.indexOf(v) : -1;
  return i > 0 ? i : 0;
}

/**
 * The Suspense boundary is required: HeatmapInner reads useSearchParams, and a
 * static export prerenders this page before the query string exists. It lives
 * here rather than in app/menu/[slug]/page.tsx so no other screen is affected.
 */
export function HeatmapScreen() {
  return (
    <Suspense fallback={<DataState loading label="Loading heatmap…" />}>
      <HeatmapInner />
    </Suspense>
  );
}

/** One tile. Memoised: hovering re-renders the screen, and there are ~1,300 of these. */
interface TileProps {
  sym: string;
  x: number; y: number; w: number; h: number;
  bg: string; fg: string;
  showText: boolean; fs: number; pctText: string | null;
  dim: boolean; mark: boolean;
  label?: string;
  onEnter?: (e: React.MouseEvent, sym: string) => void;
  onLeave?: () => void;
  onPick: (sym: string) => void;
}
const Tile = memo(function Tile(p: TileProps) {
  return (
    <div
      className={`hm2-tile${p.dim ? " dim" : ""}${p.mark ? " mark" : ""}`}
      onClick={e => { e.stopPropagation(); p.onPick(p.sym); }}
      onMouseEnter={p.onEnter ? e => p.onEnter!(e, p.sym) : undefined}
      onMouseLeave={p.onLeave}
      style={{ left: p.x, top: p.y, width: p.w, height: p.h, background: p.bg, color: p.fg }}
    >
      {p.showText && (
        <>
          <span className="sym" style={{ fontSize: `${p.fs}rem` }}>{p.label ?? p.sym}</span>
          {p.pctText != null && <span className="pct" style={{ fontSize: `${p.fs * 0.82}rem` }}>{p.pctText}</span>}
        </>
      )}
    </div>
  );
});

/** One row of the hover card's sector list. Memoised: a sector can have 250+ rows and the highlight moves with the cursor. */
const PeerRow = memo(function PeerRow(p: { sym: string; mcap: number; chg: number | null; hi: boolean; onPick: (sym: string) => void }) {
  return (
    <div className={`hpop-row${p.hi ? " hpop-row-hi" : ""}`} onClick={() => p.onPick(p.sym)}>
      <StockLogo sym={p.sym} size={16} />
      <span className="hpop-sym">{p.sym}</span>
      <span className="hpop-mcap">{capFmt(p.mcap)}</span>
      <span className={`hpop-chg ${p.chg == null ? "" : p.chg >= 0 ? "up" : "down"}`}>{p.chg == null ? "—" : sign(p.chg)}</span>
    </div>
  );
});

function HeatmapInner() {
  // Clicking a tile opens the stock in a slide-in drawer (same as Movers),
  // rather than navigating away to the full stock page.
  const [selectedSym, setSelectedSym] = useState<string | null>(null);
  const { data: companies, loading: companiesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: sectorsLive, loading: sectorsLoading } = useApiList<SectorApiDoc>("/market-data/sectors");
  const fullSectorList = useMemo(() => buildSectorList(companies, sectorsLive), [companies, sectorsLive]);
  const companyBySym = useMemo(() => new Map(companies.map(c => [c.ticker, c])), [companies]);
  const mkt = useBackendMarketStatus();

  // The URL picks the starting tab; a tab the user clicks wins until the URL
  // asks for a different index (e.g. another pop-up link while already here).
  const searchParams = useSearchParams();
  const urlTab = tabFromParam(searchParams.get("index"));
  const urlSector = searchParams.get("sector");

  const [picked, setPicked] = useState<{ tab: number; urlTab: number } | null>(null);
  const tab = picked && picked.urlTab === urlTab ? picked.tab : urlTab;

  // "Overall" = every sector on one map; a sector name zooms into that sector.
  const [selectedSector, setSelectedSector] = useState<string>(urlSector || "Overall");
  const [moreModal, setMoreModal] = useState<{ sector: string; stocks: HmStock[] } | null>(null);
  const [frame, setFrame] = useState<HmFrame>("1D");
  const [sizeBy, setSizeBy] = useState<SizeBy>("cap");
  const [find, setFind] = useState("");
  const [colorBlind, setColorBlindState] = useState<boolean>(() => {
    try { return localStorage.getItem("iq-heatmap-cb") === "1"; } catch { return false; }
  });
  const setColorBlind = (v: boolean) => {
    setColorBlindState(v);
    try { localStorage.setItem("iq-heatmap-cb", v ? "1" : "0"); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    if (!moreModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreModal]);

  const setTab = (i: number) => {
    setPicked({ tab: i, urlTab });
    setSelectedSector("Overall");
    setMoreModal(null);
  };

  // Tab 0 = all synced stocks; 1-3 filter to the S&P 500 / Nasdaq-100 / Dow-30.
  // 4 (Russell 2000) filters to small/mid caps (<$40B) or falls back to full list so all tabs have data.
  const tabKey    = HEATMAP_TAB_KEYS[tab];
  const memberSet = tabKey && tabKey !== "RUT" ? INDEX_MEMBERS[tabKey] : null;

  const baseSectorList = useMemo(() => {
    if (memberSet) {
      return fullSectorList
        .map(g => ({ ...g, items: g.items.filter(([sym]) => memberSet.has(sym)) }))
        .filter(g => g.items.length > 0);
    }
    if (tabKey === "RUT") {
      const smallCaps = fullSectorList
        .map(g => ({ ...g, items: g.items.filter(([, mcap]) => mcap < 40) }))
        .filter(g => g.items.length > 0);
      return smallCaps.length > 0 ? smallCaps : fullSectorList;
    }
    return fullSectorList;
  }, [fullSectorList, memberSet, tabKey]);

  // LIVE overlay. The tiles' stored %change comes from the `companies` docs,
  // which a per-ticker sweep only refreshes slowly — so a tile could show a
  // days-old move while the stock drawer (which polls live) showed today's,
  // i.e. the same ticker in two colours. /live/snapshot is a shared server-side
  // cache: one upstream refresh per interval regardless of how many browsers
  // are watching, and no vendor calls at all outside the extended session.
  // Tickers with no live quote keep their stored value rather than blanking.
  const liveTickers = useMemo(() => baseSectorList.flatMap(g => g.items.map(([sym]) => sym)), [baseSectorList]);
  const liveQuotes = useLiveQuotes(liveTickers);

  // The map's data: per stock the move for the chosen time frame and the weight
  // that sizes it. A stock with nothing to size it by is left off (zero area).
  // The session the page is "as of". Outside the session the 1D tile is THAT
  // session's move (see dayMovePct), not the extended-hours print the quote
  // carries: before the open nearly every quote and stored change is 0.00%.
  const sessionIso = latestSessionDate();
  const { groups, bySym } = useMemo(() => {
    const out: HmGroup[] = [];
    const lookup = new Map<string, { stock: HmStock; sector: string }>();
    for (const g of baseSectorList) {
      const stocks: HmStock[] = [];
      for (const [sym, mcap, storedPct] of g.items) {
        const lq = liveQuotes.get(sym);
        const c = companyBySym.get(sym);
        const day = dayMovePct(lq, storedPct, c?.week5Closes, sessionIso, mkt.phase);
        const price = lq?.price ?? c?.price ?? null;
        const shares = lq?.dayVolume ?? c?.dayVolume ?? null;
        const vol = shares != null && shares > 0 && price != null && price > 0 ? (shares * price) / 1e9 : null;
        const weight = sizeBy === "cap" ? mcap : (vol ?? 0);
        if (!(weight > 0)) continue;
        const stock: HmStock = { sym, mcap, chg: framePct(frame, day, c), vol, weight };
        stocks.push(stock);
        lookup.set(sym, { stock, sector: g.name });
      }
      if (stocks.length === 0) continue;
      stocks.sort((a, b) => b.weight - a.weight);
      const withChg = stocks.filter(s => s.chg != null);
      const capSum = withChg.reduce((n, s) => n + s.mcap, 0);
      out.push({
        name: g.name,
        stocks,
        weight: stocks.reduce((n, s) => n + s.weight, 0),
        pct: capSum > 0 ? withChg.reduce((n, s) => n + s.mcap * (s.chg as number), 0) / capSum : null,
      });
    }
    out.sort((a, b) => b.weight - a.weight);
    return { groups: out, bySym: lookup };
  }, [baseSectorList, liveQuotes, companyBySym, frame, sizeBy, sessionIso, mkt.phase]);

  const membersShown = groups.reduce((n, g) => n + g.stocks.length, 0);
  const activeSector = selectedSector !== "Overall" ? (groups.find(g => g.name === selectedSector) ?? null) : null;
  const isOverall = activeSector == null;
  const isLoading = companies.length === 0 && (companiesLoading || sectorsLoading);
  const noFrameData = frame !== "1D" && membersShown > 0 && groups.every(g => g.stocks.every(s => s.chg == null));

  const mapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: APPROX_W, h: APPROX_H });
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) {
        setBox(b => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: Math.round(width), h: Math.round(height) }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Squarified layout in pixels: sectors fill the map, then each sector's stocks
  // fill what is left under its header strip. Stocks too small to read are
  // bundled into one "+N more" tile per sector. Needs the map's measured size.
  const layout = useMemo(() => {
    // No sector is drawn smaller than about 100x100px (capped at 3% of the map on a
    // small screen), so even the tail of small sectors has room for its name.
    const minShare = Math.min(0.03, SECTOR_MIN_AREA / Math.max(1, box.w * box.h));
    const floored = floorWeights(groups.map(g => g.weight), minShare);
    const sectorRect = new Map(squarify(groups.map((g, i) => ({ key: g.name, weight: floored[i] })), 0, 0, box.w, box.h).map(r => [r.key, r]));
    // Each sector's header is sized to its block, so a narrow one shows its whole
    // name (the move goes under it) instead of "CONS…"; the stocks fill what is left.
    const plans = new Map<string, HeaderPlan>();
    const packs = new Map(groups.map(g => {
      const r = sectorRect.get(g.name);
      if (!r) return [g.name, packStocks([], 0, 0, OVERALL_MIN_TILE, OVERALL_MIN_MORE)] as const;
      const plan = sectorHeaderPlan(r.w, r.h, g.name, g.pct == null ? "—" : sign(g.pct));
      plans.set(g.name, plan);
      return [g.name, packStocks(g.stocks, r.w - SEC_PAD, Math.max(0, r.h - SEC_PAD - plan.h), OVERALL_MIN_TILE, OVERALL_MIN_MORE)] as const;
    }));
    return { sectorRect, packs, plans };
  }, [groups, box.w, box.h]);

  // Hover card. Not interactive, so it needs no leave delay.
  const [hover, setHover] = useState<{ sym: string; cx: number; cy: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHover = useCallback(() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  // The card is interactive (scroll it, click a row), so leaving a tile only
  // starts a short delay that moving onto the card cancels.
  const hideHover = useCallback(() => {
    cancelHover();
    hoverTimer.current = setTimeout(() => setHover(null), 200);
  }, [cancelHover]);
  const onEnter = useCallback((e: React.MouseEvent, sym: string) => {
    cancelHover();
    setHover({ sym, cx: e.clientX, cy: e.clientY });
  }, [cancelHover]);
  const onLeave = hideHover;
  const onPick = useCallback((sym: string) => { cancelHover(); setHover(null); setSelectedSym(sym); }, [cancelHover]);
  useEffect(() => cancelHover, [cancelHover]);

  const query = find.trim().toUpperCase();

  /** Builds one tile; `zoom` is the single-sector map, which packs smaller labels. */
  const tile = (s: HmStock, r: LRect, cw: number, ch: number, zoom: boolean) => {
    const hc = heatTile(s.chg, colorBlind);
    const showText = zoom ? cw >= Math.max(13, s.sym.length * 4) && ch >= 10 : Math.min(cw, ch) > 16 && cw > 20;
    const fs = tileFontRem(cw, ch);
    const hit = query !== "" && s.sym.includes(query);
    // Two lines (ticker, move) need about 29px at full size; shrink the text to the
    // tile's height, and drop the move only when even the smallest text won't fit.
    const wantPct = tilePctLabel(s.chg, cw, ch);
    const pctText = wantPct != null && ch >= 20 ? wantPct : null;
    const fit = (ch - (pctText != null ? 7 : 4)) / (16 * (pctText != null ? 1.82 : 1));
    const fsFit = Math.max(0.45, Math.min(fs, fit));
    return (
      <Tile key={s.sym} sym={s.sym} x={r.x} y={r.y} w={r.w} h={r.h} bg={hc.bg} fg={hc.fg}
        showText={showText} fs={fsFit} pctText={pctText}
        dim={query !== "" && !hit} mark={hit || s.sym === selectedSym}
        onEnter={onEnter} onLeave={onLeave} onPick={onPick} />
    );
  };

  /** The "+N more" tile: the stocks too small to label, coloured by their average move. */
  const moreTile = (sector: string, more: HmStock[], r: LRect) => {
    const avg = avgChg(more);
    const hc = heatTile(avg, colorBlind);
    const fs = Math.min(tileFontRem(r.w, r.h), 1);
    const hitMore = query !== "" && more.some(st => st.sym.includes(query));
    // The longest wording that fits the tile (mono type: about 0.6em a character).
    const labels = [`+${more.length} smaller stocks`, `+${more.length} more`, `+${more.length}`];
    const label = labels.find(t => t.length * fs * 16 * 0.62 + 12 <= r.w) ?? labels[2];
    return (
      <div key={MORE_KEY} role="button" tabIndex={0}
        className={`hm2-tile more${query !== "" && !hitMore ? " dim" : ""}${hitMore ? " mark" : ""}`}
        onClick={e => { e.stopPropagation(); setMoreModal({ sector, stocks: more }); }}
        onKeyDown={e => { if (e.key === "Enter") setMoreModal({ sector, stocks: more }); }}
        title={`+${more.length} smaller ${sector} stocks${avg == null ? "" : ` (${sign(avg)} on average)`} — click to see them`}
        style={{ left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: hc.bg, color: hc.fg }}>
        <span className="sym" style={{ fontSize: `${fs}rem` }}>{label}</span>
        {r.w >= 34 && r.h >= 30 && avg != null && <span className="pct" style={{ fontSize: `${fs * 0.82}rem` }}>{sign(avg)}</span>}
      </div>
    );
  };

  /** The zoomed single-sector map, with the smallest names bundled into "+N more". */
  const renderSector = (sector: HmGroup) => {
    const pack = packStocks(sector.stocks, box.w - 32, box.h - 24, sym => [Math.max(14, sym.length * 4.2), 10.5], [28, 14]);
    return (
      <div className="hm2-zoom">
        {pack.visible.map(s => {
          const r = pack.rects.get(s.sym);
          return r ? tile(s, r, r.w, r.h, true) : null;
        })}
        {pack.more.length > 0 && (() => {
          const r = pack.rects.get(MORE_KEY);
          return r ? moreTile(sector.name, pack.more, r) : null;
        })()}
      </div>
    );
  };

  const subtitle = [
    asOfLabel(mkt.phase, latestSessionDate(), QUOTE_DELAY_LABEL),
    `${membersShown.toLocaleString("en-US")} ${isOverall ? (tab === 0 ? "stocks" : `${TAB_LABELS[tab]} members`) : `${activeSector!.name} stocks`}`,
    `sized by ${sizeBy === "cap" ? "market cap" : "dollar volume"}`,
  ].join(" · ");

  const hov = hover ? bySym.get(hover.sym) : undefined;
  const hovCo = hover ? companyBySym.get(hover.sym) : undefined;
  const hovQ = hover ? liveQuotes.get(hover.sym) : undefined;
  // Outside the session the card shows the regular close, to match the tile's
  // move and the "as of close" line, not an extended-hours print.
  const hovPrice =
    (hovQ && hovQ.marketStatus != null && hovQ.marketStatus !== "open" ? hovQ.regularClose : null) ??
    hovQ?.price ?? hovCo?.price ?? null;
  const hovDay = hovQ?.dayVolume ?? hovCo?.dayVolume ?? null;
  const hovVsAvg = hovDay != null && hovCo?.avgVolume20 ? hovDay / hovCo.avgVolume20 : (hovCo?.rvol ?? null);

  return (
    <>
      <div className="hm2-page">
      <div className="hm2-head">
        <div>
          <h1 className="hm2-h1">Market Heatmap</h1>
          <p className="hm2-sub">{subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <VendorTag v={["fmp", "polygon"]} />
          <label className="hm2-search">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              value={find}
              onChange={e => setFind(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setFind(""); }}
              placeholder="Highlight a ticker"
              aria-label="Highlight a ticker on the map"
              maxLength={10}
            />
            {find && <button type="button" className="clr" aria-label="Clear" onClick={() => setFind("")}>×</button>}
          </label>
        </div>
      </div>

      <div className="hm2-controls">
        <div className="hm2-seg" role="group" aria-label="Stocks shown">
          {TAB_LABELS.map((t, i) => (
            <button key={t} type="button" className={i === tab ? "on" : ""} aria-pressed={i === tab} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
        <div className="hm2-seg" role="group" aria-label="Time frame">
          {FRAMES.map(f => (
            <button key={f} type="button" className={f === frame ? "on" : ""} aria-pressed={f === frame}
              disabled={f === "YTD"} title={FRAME_TITLES[f]} onClick={() => setFrame(f)}>{f}</button>
          ))}
        </div>
        <div className="hm2-seg" role="group" aria-label="Size tiles by">
          <button type="button" className={sizeBy === "cap" ? "on" : ""} aria-pressed={sizeBy === "cap"} onClick={() => setSizeBy("cap")}>Market cap</button>
          <button type="button" className={sizeBy === "volume" ? "on" : ""} aria-pressed={sizeBy === "volume"} onClick={() => setSizeBy("volume")}
            title="Dollars traded today (shares × price)">Volume</button>
        </div>
        <label className="hm2-sector">
          <span>Sector</span>
          <select value={activeSector?.name ?? "Overall"} onChange={e => setSelectedSector(e.target.value)} aria-label="Sector">
            <option value="Overall">All sectors ({groups.length})</option>
            {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
        </label>
        {!isOverall && (
          <button type="button" className="hm2-back" onClick={() => setSelectedSector("Overall")}>← All sectors</button>
        )}
      </div>

      <div className="hm2-legend">
        <div className="hm2-scale" aria-hidden>
          <div className="hm2-bar" style={{ background: heatGradient(colorBlind) }} />
          <div className="hm2-ticks">{["−3%", "−2%", "−1%", "0%", "+1%", "+2%", "+3%"].map(t => <span key={t}>{t}</span>)}</div>
        </div>
        <label className="hm2-cb">
          <input type="checkbox" checked={colorBlind} onChange={e => setColorBlind(e.target.checked)} />
          Color-blind palette
        </label>
      </div>

      {/* ── Treemap ── */}
      <div className="hm2-map" ref={mapRef}>
        {groups.length === 0 && isLoading && (
          <div className="hm2-empty"><DataState loading label="Loading heatmap…" /></div>
        )}
        {groups.length === 0 && !isLoading && (
          <div className="hm2-empty">
            <div className="t">{sizeBy === "volume" ? "No volume synced yet" : `No ${TABS[tab]} stocks to show yet`}</div>
            <div className="d">
              {sizeBy === "volume"
                ? "Today's traded volume hasn't loaded for these stocks. Switch back to Market cap, or check back shortly."
                : "This index's member stocks haven't loaded yet. Please check back shortly."}
            </div>
          </div>
        )}
        {noFrameData && (
          <div className="hm2-empty">
            <div className="t">No {frame} change synced yet</div>
            <div className="d">Switch back to 1D, or check back after the next technicals run.</div>
          </div>
        )}

        {/* ── All sectors ── */}
        {isOverall && groups.length > 0 && !noFrameData && (
          <div className="hm2-all">
            {groups.map(g => {
              const lr = layout.sectorRect.get(g.name);
              const pack = layout.packs.get(g.name);
              const plan = layout.plans.get(g.name);
              if (!lr || !pack || !plan) return null;
              return (
                <div key={g.name} className="hm2-sec" style={{ left: lr.x, top: lr.y, width: lr.w, height: lr.h }}>
                  <div className="hm2-sec-in">
                    <button type="button" className={`hm2-sec-h${plan.inline ? "" : " stack"}`} style={{ height: plan.h }}
                      onClick={() => setSelectedSector(g.name)} title={`Zoom in on ${g.name}`}>
                      <span className="name" style={plan.inline ? undefined : { WebkitLineClamp: plan.nameLines }}>{g.name}</span>
                      {plan.showPct && (
                        <span className={`pct ${g.pct == null ? "" : g.pct >= 0 ? "up" : "down"}`}>{g.pct == null ? "—" : sign(g.pct)}</span>
                      )}
                    </button>
                    <div className="hm2-sec-body">
                      {pack.visible.map(s => {
                        const r = pack.rects.get(s.sym);
                        return r ? tile(s, r, r.w, r.h, false) : null;
                      })}
                      {pack.more.length > 0 && (() => {
                        const r = pack.rects.get(MORE_KEY);
                        return r ? moreTile(g.name, pack.more, r) : null;
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isOverall && !noFrameData && renderSector(activeSector!)}
      </div>
      <p className="hm2-note">Click a sector name to zoom in. Hover any tile for details, click it to open the stock.</p>
      </div>

      {/* ── Hover card: the hovered stock, then every stock in its sector ── */}
      {hover && hov && (() => {
        const peers = (groups.find(g => g.name === hov.sector)?.stocks ?? []).slice().sort((a, b) => b.mcap - a.mcap);
        const maxH = Math.min(160 + 34 + peers.length * 27, window.innerHeight - 16);
        const x = hover.cx + 14 + 318 > window.innerWidth ? hover.cx - 326 : hover.cx + 14;
        const y = Math.max(8, Math.min(hover.cy - 10, window.innerHeight - maxH - 8));
        const chg = hov.stock.chg;
        return (
          <div className="dash-pop"
            style={{ left: x, top: y, width: 310, cursor: "default", maxHeight: `${window.innerHeight - y - 8}px`, overflowY: "auto" }}
            onMouseEnter={cancelHover} onMouseLeave={hideHover}>
            <div className="dp-head" style={{ cursor: "pointer" }} onClick={() => onPick(hover.sym)}>
              <StockLogo sym={hover.sym} size={28} />
              <span className="dp-sym">{hover.sym}</span>
              <span className={`pill ${chg == null ? "" : chg >= 0 ? "up" : "dn"}`} style={{ marginLeft: "auto" }}>{chg == null ? "—" : sign(chg)}</span>
            </div>
            <div className="dp-row"><span>Mkt Cap</span><b>{capFmt(hov.stock.mcap)}</b></div>
            <div className="dp-row"><span>Price</span><b>{hovPrice != null ? `$${fmt(hovPrice)}` : <NotAvailable />}</b></div>
            <div className="dp-row"><span>RVOL</span><b className={hovVsAvg != null && hovVsAvg >= 2 ? "up" : ""}>{hovVsAvg != null ? `${hovVsAvg.toFixed(1)}×` : <NotAvailable />}</b></div>
            <div className="dp-row"><span>RS Rating</span><b>{hovCo?.rsRating != null ? `${hovCo.rsRating}/99` : <NotAvailable />}</b></div>
            {peers.length > 0 && (
              <>
                <div className="hpop-label" style={isOverall ? undefined : { cursor: "default" }}
                  onClick={isOverall ? () => { cancelHover(); setHover(null); setSelectedSector(hov.sector); } : undefined}>
                  <span>{hov.sector}</span>
                  {isOverall && <span className="link" style={{ fontSize: ".62rem" }}>Open sector heatmap →</span>}
                </div>
                {peers.map(p => <PeerRow key={p.sym} sym={p.sym} mcap={p.mcap} chg={p.chg} hi={p.sym === hover.sym} onPick={onPick} />)}
              </>
            )}
          </div>
        );
      })()}

      {/* Bundled small-cap stocks modal */}
      {moreModal && (
        <>
          <div className="scrim" onClick={() => setMoreModal(null)} />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 101,
              width: "min(560px, 92vw)",
              maxHeight: "80vh",
              background: "var(--surface-1, #0B0D10)",
              border: "1px solid var(--border-soft, rgba(255,255,255,0.12))",
              borderRadius: 14,
              boxShadow: "0 24px 60px -10px rgba(0,0,0,0.75)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "var(--f-body, sans-serif)",
              color: "var(--text-hi, #F4F6F5)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface-2, rgba(255,255,255,0.02))",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--f-display, sans-serif)",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    color: "var(--text-hi)",
                  }}
                >
                  +{moreModal.stocks.length} More {moreModal.sector} Stocks
                </div>
                <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Too small to label at this map size, largest first · Click to view stock details
                </div>
              </div>
              <button
                className="closebtn"
                onClick={() => setMoreModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim-solid)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Stock List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Re-read each row from the live map: `moreModal` is a copy taken at click time, and its moves would otherwise freeze while the tiles behind keep updating. */}
              {moreModal.stocks.map(s => bySym.get(s.sym)?.stock ?? s).sort((a, b) => b.weight - a.weight).map(({ sym, mcap, chg }) => {
                const comp = companies.find((x) => x.ticker === sym);
                return (
                  <div
                    key={sym}
                    onClick={() => {
                      setMoreModal(null);
                      setSelectedSym(sym);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "var(--surface-2, rgba(255,255,255,0.03))",
                      border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
                      cursor: "pointer",
                      transition: "all .12s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-3, rgba(255,255,255,0.07))";
                      e.currentTarget.style.borderColor = "var(--border-strong, rgba(255,255,255,0.18))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--surface-2, rgba(255,255,255,0.03))";
                      e.currentTarget.style.borderColor = "var(--border-soft, rgba(255,255,255,0.06))";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <StockLogo sym={sym} size={24} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              fontFamily: "var(--f-mono, monospace)",
                              fontWeight: 700,
                              fontSize: ".88rem",
                              color: "var(--text-hi)",
                            }}
                          >
                            {sym}
                          </span>
                          {comp?.name && (
                            <span
                              style={{
                                fontSize: ".75rem",
                                color: "var(--text-dim-solid)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 220,
                              }}
                            >
                              {comp.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", fontFamily: "var(--f-mono)" }}>
                        {capFmt(mcap)}
                      </span>
                      <span className={`pill ${chg == null ? "" : chg >= 0 ? "up" : "dn"}`} style={{ minWidth: 54, textAlign: "center" }}>
                        {chg == null ? "—" : sign(chg)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Sliding stock detail drawer (same pattern as Movers) */}
      {selectedSym && (
        <>
          <div className="scrim" onClick={() => setSelectedSym(null)} />
          <div className="stock-side-drawer">
            <div className="drawer-h" style={{ paddingTop: 14, paddingBottom: 14 }}>
              <StockLogo sym={selectedSym} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
                  {selectedSym} · Stock Details
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                  Full analysis · chart · technicals · peers
                </div>
              </div>
              <button className="closebtn" onClick={() => setSelectedSym(null)}>✕</button>
            </div>
            <div className="drawer-b">
              <StockScreenEmbed initialSym={selectedSym} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
