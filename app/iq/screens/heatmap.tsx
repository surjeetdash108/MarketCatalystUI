"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useIQActions } from "../shell";
import { sign, heatCol, fmt, StockLogo, NotAvailable, DataState, VendorTag } from "../utils";
import { useApiList } from "../hooks/useApiList";
import { useLiveQuotes } from "../live-quotes-context";
import { buildSectorList } from "../live-market-indices";
import { INDEX_MEMBERS, HEATMAP_TAB_KEYS } from "../index-constituents";
import type { CompanyDoc, SectorApiDoc } from "../types";

const StockScreenEmbed = dynamic<{ initialSym?: string }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

const TABS = ["Stocks", "S&P 500", "Nasdaq", "Dow", "Russell 2000"];
const HEADER_H = 24;
const APPROX_W = 1100;
const APPROX_H = 620;

interface LItem { key: string; weight: number; }
interface LRect  { key: string; x: number; y: number; w: number; h: number; }

function bisect(items: LItem[], x: number, y: number, w: number, h: number): LRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ key: items[0].key, x, y, w, h }];
  if (items.length === 2) {
    const total = items[0].weight + items[1].weight;
    const f = items[0].weight / total;
    return w >= h
      ? [{ key: items[0].key, x, y, w: w * f, h }, { key: items[1].key, x: x + w * f, y, w: w * (1 - f), h }]
      : [{ key: items[0].key, x, y, w, h: h * f }, { key: items[1].key, x, y: y + h * f, w, h: h * (1 - f) }];
  }
  const total = items.reduce((s, i) => s + i.weight, 0);
  let cum = 0; let split = 0;
  for (let i = 0; i < items.length - 1; i++) {
    cum += items[i].weight; split = i;
    if (cum >= total / 2) break;
  }
  const first = items.slice(0, split + 1);
  const rest  = items.slice(split + 1);
  const frac  = first.reduce((s, i) => s + i.weight, 0) / total;
  return w >= h
    ? [...bisect(first, x, y, w * frac, h), ...bisect(rest, x + w * frac, y, w * (1 - frac), h)]
    : [...bisect(first, x, y, w, h * frac), ...bisect(rest, x, y + h * frac, w, h * (1 - frac))];
}

function capFmt(mcap: number) {
  return mcap >= 1000 ? `$${(mcap / 1000).toFixed(1)}T` : `$${Math.round(mcap)}B`;
}

interface HoverStock {
  sym: string; chg: number; mcap: number; x: number; y: number;
  sector: string;
  peers: [string, number, number][];
}

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

function HeatmapInner() {
  const { openSector } = useIQActions();
  // Clicking a tile opens the stock in a slide-in drawer (same as Movers),
  // rather than navigating away to the full stock page.
  const [selectedSym, setSelectedSym] = useState<string | null>(null);
  const { data: companies, loading: companiesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: sectorsLive } = useApiList<SectorApiDoc>("/market-data/sectors");
  const fullSectorList = buildSectorList(companies, sectorsLive);

  // The URL picks the starting tab; a tab the user clicks wins until the URL
  // asks for a different index (e.g. another pop-up link while already here).
  const searchParams = useSearchParams();
  const urlTab = tabFromParam(searchParams.get("index"));
  const urlSector = searchParams.get("sector");

  const [picked, setPicked] = useState<{ tab: number; urlTab: number } | null>(null);
  const tab = picked && picked.urlTab === urlTab ? picked.tab : urlTab;

  // Sector selection: null = Sector Directory Screen; string = Dedicated Sector Heatmap Screen
  const [selectedSector, setSelectedSector] = useState<string | null>(urlSector || null);
  const [moreModal, setMoreModal] = useState<[string, number, number][] | null>(null);

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
    setSelectedSector(null);
    setMoreModal(null);
  };

  // Tab 0 = all synced stocks; 1-3 filter to the S&P 500 / Nasdaq-100 / Dow-30
  // members that also exist in the live universe; 4 (Russell 2000) has no set.
  const tabKey    = HEATMAP_TAB_KEYS[tab];
  const memberSet = tabKey && tabKey !== "RUT" ? INDEX_MEMBERS[tabKey] : null;
  // No member list for the Russell 2000: show nothing (and say so below)
  // rather than falling back to the full large-cap map under its name.
  const noMap = tabKey === "RUT";
  const baseSectorList = noMap ? [] : memberSet
    ? fullSectorList
        .map(g => ({ ...g, items: g.items.filter(([sym]) => memberSet.has(sym)) }))
        .filter(g => g.items.length > 0)
    : fullSectorList;

  // LIVE overlay. The tiles' stored %change comes from the `companies` docs,
  // which a per-ticker sweep only refreshes slowly — so a tile could show a
  // days-old move while the stock drawer (which polls live) showed today's,
  // i.e. the same ticker in two colours. /live/snapshot is a shared server-side
  // cache: one upstream refresh per interval regardless of how many browsers
  // are watching, and no vendor calls at all outside the extended session.
  // Tickers with no live quote keep their stored value rather than blanking.
  const liveTickers = baseSectorList.flatMap(g => g.items.map(([sym]) => sym));
  const liveQuotes = useLiveQuotes(liveTickers);
  const mergedSectorList = liveQuotes.size === 0
    ? baseSectorList
    : baseSectorList.map(g => ({
        ...g,
        items: g.items.map(([sym, mcap, pct]) => {
          const lq = liveQuotes.get(sym);
          return [sym, mcap, lq?.pctChange ?? pct] as [string, number, number];
        }),
      }));
  const membersShown = mergedSectorList.reduce((n, g) => n + g.items.length, 0);
  const [hover, setHover] = useState<HoverStock | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHover = (e: React.MouseEvent, sym: string, chg: number, mcap: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const sector = mergedSectorList.find(g => g.items.some(([s]) => s === sym));
    const peers  = sector ? [...sector.items].sort((a, b) => b[1] - a[1]) : [];
    const estH   = 160 + 34 + peers.length * 27; // header rows + label + peer rows
    const maxH   = Math.min(estH, window.innerHeight - 16);
    const x = e.clientX + 14 + 318 > window.innerWidth ? e.clientX - 326 : e.clientX + 14;
    const y = Math.max(8, Math.min(e.clientY - 10, window.innerHeight - maxH - 8));
    setHover({ sym, chg, mcap, x, y, sector: sector?.name ?? "", peers });
  };
  const hideHover   = () => { hoverTimer.current = setTimeout(() => setHover(null), 200); };
  const cancelHover = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); };

  const sorted = [...mergedSectorList].sort(
    (a, b) => b.items.reduce((s, i) => s + i[1], 0) - a.items.reduce((s, i) => s + i[1], 0)
  );

  // Active sector: user-selected sector, else default to the first sector in the sorted list
  const activeSectorName = selectedSector && sorted.some(g => g.name === selectedSector)
    ? selectedSector
    : (sorted[0]?.name ?? null);

  const activeSector = sorted.find(g => g.name === activeSectorName) ?? null;

  return (
    <>
      <div className="page-head" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Level 1: Index Selection */}
        <div className="tabs" style={{ maxWidth: "100%", overflowX: "auto", flexWrap: "nowrap" }}>
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === tab ? " on" : ""}`} onClick={() => setTab(i)} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{t}</button>
          ))}
        </div>

        {/* Level 2: Sector Selection (multiple rows so all sectors show at once) */}
        {!noMap && sorted.length > 0 && (
          <div className="tabs" style={{ maxWidth: "100%", flexWrap: "wrap", gap: 6 }}>
            {sorted.map(s => {
              const isSelected = s.name === activeSectorName;
              return (
                <button
                  key={s.name}
                  className={`tab${isSelected ? " on" : ""}`}
                  onClick={() => setSelectedSector(s.name)}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="fbar">
        <button className="chip on">Color: % change</button>
        {activeSector && (
          <span style={{ fontSize: ".72rem", color: "var(--text-hi)", transform: "translateY(10px)" }}>
            {`${activeSector.items.length} ${activeSector.name} member${activeSector.items.length === 1 ? "" : "s"} in the live universe`}
          </span>
        )}
        <div className="spacer" />
        <div
          style={{
            transform: "scaleY(1) translateY(6px)",
            transformOrigin: "center",
          }}
        >
          <VendorTag v="polygon" />
        </div>
        <div className="legend" style={{ gap: 4 }}>
          <span style={{ fontSize: ".66rem", color: "var(--down)" }}>−3%</span>
          {(["rgba(138,46,21,.85)", "rgba(138,46,21,.4)", "#2A3037", "rgba(31,122,70,.4)", "rgba(31,122,70,.85)"] as const).map((bg, i) => (
            <i key={i} style={{ width: 22, height: 12, display: "inline-block", borderRadius: 2, background: bg }} />
          ))}
          <span style={{ fontSize: ".66rem", color: "var(--up)" }}>+3%</span>
        </div>
      </div>

      {/* ── Treemap ── */}
      <div style={{
        position: "relative", width: "100%",
        height: "calc(100vh - 220px)", minHeight: 520,
        borderRadius: 10, overflow: "hidden",
        border: "1px solid var(--border)", background: "var(--bg)",
        marginBottom: 24,
      }}>
        {mergedSectorList.length === 0 && companiesLoading && !noMap && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DataState loading label="Loading heatmap…" />
          </div>
        )}
        {mergedSectorList.length === 0 && (!companiesLoading || noMap) && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, textAlign: "center", padding: 24,
          }}>
            <div style={{ fontSize: ".92rem", fontWeight: 700, color: "var(--text-hi)" }}>
              {noMap ? `${TABS[tab]} heatmap isn't available yet` : `No ${TABS[tab]} stocks to show yet`}
            </div>
            <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", maxWidth: 460, lineHeight: 1.55 }}>
              {noMap
                ? `We don't have the list of ${TABS[tab]} member stocks yet, so there is nothing to map. You can view one of these indices instead:`
                : "This index's member stocks haven't loaded yet. Please check back shortly."}
            </div>
            {noMap && (
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
                {TABS.map((t, i) => (i === 0 || i === tab ? null : (
                  HEATMAP_TAB_KEYS[i] === "RUT" ? null : (
                    <button
                      key={t}
                      className="btn"
                      onClick={() => setTab(i)}
                      style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--text-hi)", fontWeight: 600 }}
                    >{t}</button>
                  )
                )))}
              </div>
            )}
          </div>
        )}
        {!noMap && activeSector && (() => {
          const stocksSorted = [...activeSector.items].sort((a, b) => b[1] - a[1]);

          const checkLayout = (cutoff: number) => {
            const visible = stocksSorted.slice(0, cutoff);
            const more = stocksSorted.slice(cutoff);
            const moreWeight = more.reduce((s, i) => s + i[1], 0);

            const items: LItem[] = visible.map(([sym, mc]) => ({ key: sym, weight: mc }));
            if (more.length > 0) {
              items.push({ key: "__more__", weight: moreWeight });
            }

            const layout = bisect(items, 0, 0, 100, 100);
            const map = Object.fromEntries(layout.map(r => [r.key, r]));

            for (const [sym] of visible) {
              const r = map[sym];
              if (!r) return false;
              const cellPxW = (r.w / 100) * (APPROX_W - 32);
              const cellPxH = (r.h / 100) * (APPROX_H - 24);
              const minW = Math.max(14, sym.length * 4.2);
              if (cellPxW < minW || cellPxH < 10.5) return false;
            }

            if (more.length > 0) {
              const rMore = map["__more__"];
              if (!rMore) return false;
              const cellPxW = (rMore.w / 100) * (APPROX_W - 32);
              const cellPxH = (rMore.h / 100) * (APPROX_H - 24);
              if (cellPxW < 28 || cellPxH < 14) return false;
            }

            return true;
          };

          let bestCutoff = stocksSorted.length;
          if (stocksSorted.length > 1 && !checkLayout(stocksSorted.length)) {
            let low = 1;
            let high = stocksSorted.length - 1;
            bestCutoff = 1;
            while (low <= high) {
              const mid = Math.floor((low + high) / 2);
              if (checkLayout(mid)) {
                bestCutoff = mid;
                low = mid + 1; // Try to include more visible stocks
              } else {
                high = mid - 1; // Too many stocks, shrink
              }
            }
          }

          const visibleStocks = stocksSorted.slice(0, bestCutoff);
          const moreStocks    = stocksSorted.slice(bestCutoff);
          const moreWeight    = moreStocks.reduce((sum, s) => sum + s[1], 0);

          const finalItems: LItem[] = visibleStocks.map(([sym, mc]) => ({ key: sym, weight: mc }));
          if (moreStocks.length > 0) {
            finalItems.push({ key: "__more__", weight: moreWeight });
          }

          const stockLayout = bisect(finalItems, 0, 0, 100, 100);
          const stockMap    = Object.fromEntries(stockLayout.map(r => [r.key, r]));

          const moreAvgChg = moreStocks.length > 0
            ? (moreWeight > 0
                ? moreStocks.reduce((sum, s) => sum + s[1] * s[2], 0) / moreWeight
                : moreStocks.reduce((sum, s) => sum + s[2], 0) / moreStocks.length)
            : 0;

          return (
            <div style={{ position: "absolute", top: 8, bottom: 16, left: 16, right: 16 }}>
              {visibleStocks.map(([sym, mcap, chg]) => {
                const sr = stockMap[sym];
                if (!sr) return null;
                const hc      = heatCol(chg);
                const cellPxW = (sr.w / 100) * (APPROX_W - 32);
                const cellPxH = (sr.h / 100) * (APPROX_H - 24);
                const showText   = cellPxW >= Math.max(13, sym.length * 4) && cellPxH >= 10;
                const showChange = cellPxW >= 32 && cellPxH >= 24;
                const fs = Math.max(0.48, Math.min(1.05, Math.sqrt(cellPxW * cellPxH) / 70));

                return (
                  <div key={sym}
                    onClick={e => { e.stopPropagation(); setSelectedSym(sym); }}
                    onMouseEnter={e => showHover(e, sym, chg, mcap)}
                    onMouseLeave={hideHover}
                    title={`${sym}  ${sign(chg)}`}
                    style={{
                      position: "absolute",
                      left: `${sr.x}%`, top: `${sr.y}%`,
                      width: `${sr.w}%`, height: `${sr.h}%`,
                      background: hc.bg, cursor: "pointer",
                      display: "flex", flexDirection: "column",
                      justifyContent: "center", alignItems: "center",
                      boxSizing: "border-box", border: "1px solid rgba(0,0,0,.18)",
                      overflow: "hidden", padding: 1, transition: "filter .1s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.filter = "brightness(1.25)")}
                    onMouseOut={e => (e.currentTarget.style.filter = "")}
                  >
                    {showText && (
                      <>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontWeight: 700,
                          color: hc.fg, fontSize: `${fs}rem`,
                          lineHeight: 1, textAlign: "center", whiteSpace: "nowrap",
                        }}>{sym}</span>
                        {showChange && (
                          <span style={{
                            fontFamily: "var(--f-mono)", color: hc.fg, opacity: .82,
                            fontSize: `${fs * 0.82}rem`, lineHeight: 1, marginTop: 2,
                          }}>{sign(chg)}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {moreStocks.length > 0 && (() => {
                const sr = stockMap["__more__"];
                if (!sr) return null;
                const hc      = heatCol(moreAvgChg);
                const cellPxW = (sr.w / 100) * (APPROX_W - 32);
                const cellPxH = (sr.h / 100) * (APPROX_H - 24);
                const showChange = cellPxW >= 34 && cellPxH >= 24;
                const fs = Math.max(0.48, Math.min(1.05, Math.sqrt(cellPxW * cellPxH) / 70));

                return (
                  <div key="__more__"
                    onClick={e => { e.stopPropagation(); setMoreModal(moreStocks); }}
                    title={`+${moreStocks.length} more stocks (${sign(moreAvgChg)}) — Click to view`}
                    style={{
                      position: "absolute",
                      left: `${sr.x}%`, top: `${sr.y}%`,
                      width: `${sr.w}%`, height: `${sr.h}%`,
                      background: hc.bg, cursor: "pointer",
                      display: "flex", flexDirection: "column",
                      justifyContent: "center", alignItems: "center",
                      boxSizing: "border-box", border: "1px solid rgba(0,0,0,.25)",
                      overflow: "hidden", padding: 1, transition: "filter .1s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.filter = "brightness(1.25)")}
                    onMouseOut={e => (e.currentTarget.style.filter = "")}
                  >
                    <span style={{
                      fontFamily: "var(--f-mono)", fontWeight: 700,
                      color: hc.fg, fontSize: `${fs}rem`,
                      lineHeight: 1, textAlign: "center", whiteSpace: "nowrap",
                    }}>+{moreStocks.length} more</span>
                    {showChange && (
                      <span style={{
                        fontFamily: "var(--f-mono)", color: hc.fg, opacity: .82,
                        fontSize: `${fs * 0.82}rem`, lineHeight: 1, marginTop: 2,
                      }}>{sign(moreAvgChg)}</span>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </div>

      {/* ── Hover tooltip ── */}
      {hover && (() => {
        const c = companies.find(x => x.ticker === hover.sym);
        return (
          <div className="dash-pop"
            style={{ left: hover.x, top: hover.y, cursor: "default", width: 310, maxHeight: `${window.innerHeight - hover.y - 8}px`, overflowY: "auto" }}
            onMouseEnter={cancelHover}
            onMouseLeave={hideHover}
          >
            {/* Hovered stock header */}
            <div className="dp-head" style={{ cursor: "pointer" }} onClick={() => { setHover(null); setSelectedSym(hover.sym); }}>
              <StockLogo sym={hover.sym} size={28} />
              <span className="dp-sym">{hover.sym}</span>
              <VendorTag v="polygon" />
              <span className={`pill ${hover.chg >= 0 ? "up" : "dn"}`}>{sign(hover.chg)}</span>
            </div>
            <div className="dp-row"><span>Mkt Cap</span><b>{capFmt(hover.mcap)}</b></div>
            <div className="dp-row"><span>Price</span><b>{c?.price != null ? `$${fmt(c.price)}` : <NotAvailable />}</b></div>
            <div className="dp-row"><span>RVOL</span><b className={c?.rvol != null && c.rvol >= 2 ? "up" : ""}>{c?.rvol != null ? `${c.rvol.toFixed(1)}×` : <NotAvailable />}</b></div>
            <div className="dp-row"><span>RS Rating</span><b>{c?.rsRating != null ? `${c.rsRating}/99` : <NotAvailable />}</b></div>

            {/* Same-sector stock list */}
            {hover.peers.length > 0 && (
              <>
                <div className="hpop-label" onClick={() => { setHover(null); setSelectedSector(hover.sector); }}>
                  <span>{hover.sector}</span>
                  <span className="link" style={{ fontSize: ".62rem" }}>Open sector heatmap →</span>
                </div>
                {hover.peers.map(([psym, pmcap, pchg]) => (
                  <div key={psym}
                    className={`hpop-row${psym === hover.sym ? " hpop-row-hi" : ""}`}
                    onClick={() => { setHover(null); setSelectedSym(psym); }}
                  >
                    <StockLogo sym={psym} size={16} />
                    <span className="hpop-sym">{psym}</span>
                    <span className="hpop-mcap">{capFmt(pmcap)}</span>
                    <span className={`hpop-chg ${pchg >= 0 ? "up" : "down"}`}>{sign(pchg)}</span>
                    <i className="hpop-bar" style={{ background: heatCol(pchg).bg, width: `${Math.min(56, Math.abs(pchg) * 14)}px` }} />
                  </div>
                ))}
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
                  +{moreModal.length} More {activeSectorName ? `${activeSectorName} ` : ""}Stocks
                </div>
                <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Smaller market-cap constituents bundled for readability · Click to view stock details
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
              {[...moreModal].sort((a, b) => b[1] - a[1]).map(([sym, mcap, chg]) => {
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
                      <span className={`pill ${chg >= 0 ? "up" : "dn"}`} style={{ minWidth: 54, textAlign: "center" }}>
                        {sign(chg)}
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
