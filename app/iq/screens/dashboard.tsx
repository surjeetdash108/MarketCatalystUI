"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAppSelector } from "../../store/hooks";
import { useIQActions } from "../shell";
import { pulse, wmn, movers, earnings, folio, analyst, watch, sectorList, screenerStocks, Mover } from "../data";
import { fmt, sign, cls, arr, Spark, SemiGauge, StockLogo } from "../utils";

const LIVE_FEED = [
  {
    cat: "Earnings", col: "var(--up)", time: "9:31a",
    t: '<b style="color:var(--text-hi)">NVDA</b> beats EPS 18%, raises FY25',
    why: "AI data-center demand still accelerating.",
  },
  {
    cat: "Analyst", col: "var(--brand-2)", time: "9:18a",
    t: 'MS upgrades <b style="color:var(--text-hi)">CRM</b> to Overweight, PT $340',
    why: "Sell-side turning constructive on margins.",
  },
  {
    cat: "Macro", col: "var(--warn)", time: "8:30a",
    t: 'May core CPI <b style="color:var(--text-hi)">+0.2%</b> m/m, below est.',
    why: "Lifts September rate-cut odds; yields fell.",
  },
];

const INSIDER_MINI = [
  { s: "NVDA", role: "CEO",        dir: "buy",  val: "4.8M" },
  { s: "MSFT", role: "CFO",        dir: "buy",  val: "2.2M" },
  { s: "META", role: "Director",   dir: "buy",  val: "880K" },
  { s: "AAPL", role: "10% owner",  dir: "sell", val: "12.1M" },
  { s: "TSLA", role: "10% owner",  dir: "sell", val: "22.4M" },
];

// ---- Dash hover popup ----
type PopBlock = "earnings" | "movers" | "analyst" | "watchlist" | "portfolio" | "insider" | "screener";

interface PopState {
  sym: string;
  block: PopBlock;
  right: number;
  top: number;
  left: number;
}

const BLOCK_LABEL: Record<PopBlock, string> = {
  earnings:  "Earnings",
  movers:    "Market Movers",
  analyst:   "Analyst action",
  watchlist: "Watchlist",
  portfolio: "Portfolio",
  insider:   "Insider / 13F",
  screener:  "Screener",
};

const BLOCK_NAV: Record<PopBlock, string> = {
  earnings:  "earnings page",
  movers:    "movers page",
  analyst:   "analyst page",
  watchlist: "watchlist",
  portfolio: "portfolio",
  insider:   "insider feed",
  screener:  "screener",
};

function DpRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dp-row">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );
}

function DashPopContent({ sym, block }: { sym: string; block: PopBlock }) {
  const mv  = movers.find(x => x.s === sym);
  const er  = earnings.find(x => x.s === sym);
  const an  = analyst.find(x => x.s === sym);
  const w   = watch.find(x => x.s === sym);
  const pf  = folio.find(x => x.s === sym);
  const scr = screenerStocks.find(x => x.s === sym);
  const ins = INSIDER_MINI.find(x => x.s === sym);
  const name = mv?.n ?? er?.n ?? an?.n ?? w?.n ?? scr?.n ?? sym;

  let body: React.ReactNode;

  if (block === "earnings") {
    if (er) {
      body = <>
        <DpRow label="When">{er.t === "BMO" ? "Before open" : er.t === "AMC" ? "After close" : er.t}</DpRow>
        <DpRow label="EPS est → act">
          ${er.epsE}{er.epsA != null && <> → ${er.epsA} <span className={er.epsA >= er.epsE ? "up" : "down"}>({er.epsA >= er.epsE ? "beat" : "miss"})</span></>}
        </DpRow>
        <DpRow label="Guidance">
          <span className={er.guide === "Raised" ? "up" : er.guide === "Lowered" ? "down" : ""}>{er.guide ?? "—"}</span>
        </DpRow>
        {er.react != null
          ? <DpRow label="Reaction"><span className={cls(er.react)}>{sign(er.react)}</span></DpRow>
          : <DpRow label="Implied move">±{er.implied}%</DpRow>
        }
        <div className="dp-note">Why it&apos;s here: reporting {er.t === "BMO" ? "before the open" : "after the close"}{er.guide === "Raised" ? " — and raised guidance." : "."}</div>
      </>;
    } else {
      body = <div className="dp-note">On this week&apos;s earnings calendar.</div>;
    }
  } else if (block === "movers" && mv) {
    body = <>
      <DpRow label="Today"><span className={cls(mv.c)}>{sign(mv.c)}</span></DpRow>
      <DpRow label="Rel. volume">{mv.rvol.toFixed(1)}×</DpRow>
      <DpRow label="Catalyst">{mv.cat}</DpRow>
      <DpRow label="Technicals">{mv.ma} · RS {mv.rs}</DpRow>
      <div className="dp-note">Why it&apos;s moving: {mv.cat === "No known catalyst" ? "trading with its sector and the broad tape" : mv.cat.toLowerCase()}, on {mv.rvol.toFixed(1)}× normal volume.</div>
    </>;
  } else if (block === "analyst" && an) {
    body = <>
      <DpRow label="Action">
        <span className={an.dir === "up" ? "up" : an.dir === "down" ? "down" : ""}>{an.dir === "up" ? "Upgrade" : an.dir === "down" ? "Downgrade" : "Reiterate"} · {an.firm}</span>
      </DpRow>
      <DpRow label="Rating">{an.from} → {an.to}</DpRow>
      <DpRow label="Price target">{an.ptF ? `$${an.ptF} → ` : ""}${an.ptT}</DpRow>
      <DpRow label="Reaction"><span className={cls(an.react)}>{sign(an.react)}</span></DpRow>
      <div className="dp-note">Why it&apos;s here: {an.firm} changed its call — {an.n30} firm(s) active in 30d.</div>
    </>;
  } else if (block === "watchlist") {
    const px = w?.px ?? mv?.p;
    body = <>
      {px != null && <DpRow label="Price"><span className="mono">${fmt(px, 2)}</span></DpRow>}
      <DpRow label="Day"><span className={cls(w?.c ?? mv?.c ?? 0)}>{sign(w?.c ?? mv?.c ?? 0)}</span></DpRow>
      {scr && <DpRow label="Mkt Cap">{scr.mc >= 1000 ? `${(scr.mc / 1000).toFixed(1)}T` : `${Math.round(scr.mc)}B`}</DpRow>}
      {scr && <DpRow label="P/E">{scr.pe > 0 ? scr.pe.toFixed(1) : "—"}</DpRow>}
      {scr && <DpRow label="RS rank">{scr.rs}/99</DpRow>}
      {scr && <DpRow label="Sector">{scr.sec}</DpRow>}
      <DpRow label="Next ER">{w?.er ?? "—"}</DpRow>
      {an && <DpRow label="Latest action"><span className={an.dir === "up" ? "up" : an.dir === "down" ? "down" : ""}>{an.dir === "up" ? "▲" : an.dir === "down" ? "▼" : "·"} {an.firm} → {an.to}</span></DpRow>}
      {w?.headline && w.headline !== "—" && <div className="dp-note">{w.headline}</div>}
    </>;
  } else if (block === "portfolio" && pf) {
    body = <>
      <DpRow label="Day"><span className={cls(pf.c)}>{sign(pf.c)}</span></DpRow>
      <DpRow label="Unrealized"><span className={cls(pf.gl)}>{pf.gl > 0 ? "+" : ""}{pf.gl.toFixed(1)}%</span></DpRow>
      <DpRow label="Conviction">{pf.conv}</DpRow>
      <div className="dp-note">Why it&apos;s here: {pf.evt !== "—" ? pf.evt : "a position in your book"}.</div>
    </>;
  } else if (block === "insider" && ins) {
    const buy = ins.dir === "buy";
    body = <>
      <DpRow label="Activity"><span className={buy ? "up" : "down"}>{buy ? "Insider buying" : "Insider selling"}</span></DpRow>
      <DpRow label="Insider">{ins.role}</DpRow>
      <DpRow label="Value"><span className={buy ? "up" : "down"}>{buy ? "+" : "−"}${ins.val}</span></DpRow>
      <div className="dp-note">Why it&apos;s here: notable {buy ? "buying" : "selling"} flagged in the feed.</div>
    </>;
  } else if (block === "screener" && scr) {
    body = <>
      <DpRow label="RS rank">{scr.rs}/99</DpRow>
      <DpRow label="Sector">{scr.sec}</DpRow>
      <DpRow label="Rating">{scr.rating}</DpRow>
      <DpRow label="Rev growth"><span className={cls(scr.salesG)}>{sign(scr.salesG)}</span></DpRow>
      <div className="dp-note">Why it&apos;s here: clears the leaders screen — high relative strength + growth.</div>
    </>;
  } else {
    const c = mv?.c ?? (w ? w.c : 0);
    body = <>
      <DpRow label="Price">{mv ? `$${fmt(mv.p)}` : "—"}</DpRow>
      <DpRow label="Today"><span className={cls(c)}>{sign(c)}</span></DpRow>
      <DpRow label="Sector">{mv?.sector ?? scr?.sec ?? "—"}</DpRow>
      <DpRow label="Rating">{scr?.rating ?? "—"}</DpRow>
    </>;
  }

  return <>
    <div className="dp-head">
      <span className="dp-sym">{sym}</span>
      <span className="dp-nm">{name}</span>
      <span className="dp-tag">{BLOCK_LABEL[block]}</span>
    </div>
    <div>{body}</div>
    <div className="dp-foot">Click to open {BLOCK_NAV[block]} →</div>
  </>;
}

function MoverPopup({ m }: { m: Mover }) {
  return (
    <div className="mv-dp" onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 800, color: "var(--text-hi)", fontSize: ".9rem" }}>{m.s}</span>
        <span style={{ flex: 1, fontSize: ".72rem", color: "var(--text-dim-solid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.n}</span>
        <span className={`r ${cls(m.c)}`} style={{ fontSize: ".78rem" }}>{sign(m.c)}</span>
      </div>
      <div className="mvtabs">
        <span className="mvt mvt-t">Technical</span>
        <span className="mvt mvt-n">News</span>
      </div>
      <div className="mvp mvp-t">
        <div className="dp-row"><span>Price</span><b>${fmt(m.p)}</b></div>
        <div className="dp-row"><span>RVOL</span><b>{m.rvol}×</b></div>
        <div className="dp-row"><span>RS Rating</span><b>{m.rs}/99</b></div>
        <div className="dp-row"><span>4-Week</span><b className={cls(m.wk)}>{m.wk > 0 ? "+" : ""}{m.wk}%</b></div>
        <div className="dp-note" style={{ marginTop: 6 }}>{m.tech}</div>
      </div>
      <div className="mvp mvp-n">
        <span className="dp-tag" style={{ display: "inline-block", marginBottom: 6 }}>{m.cat}</span>
        <div className="dp-note">{m.news}</div>
      </div>
    </div>
  );
}

function analystDir(type: string) {
  if (type === "up"   || type === "upgrade")    return <span className="up">▲ Upg</span>;
  if (type === "down" || type === "downgrade")  return <span className="down">▼ Dng</span>;
  if (type === "init" || type === "initiation") return <span style={{ color: "var(--ai)" }}>◆ Init</span>;
  return <span style={{ color: "var(--text-dim-solid)" }}>Reit</span>;
}

export function DashboardScreen() {
  const { openStock, openMoverModal, openEarnings, openSector, openIndex } = useIQActions();
  const { user } = useAppSelector(s => s.auth);
  const { data: profile } = useAppSelector(s => s.profile);

  const displayName = profile?.name || user?.displayName || "Investor";
  const firstName = displayName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const now = new Date();
  const dayName  = now.toLocaleDateString("en-US", { weekday: "long" });
  const datePart = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr  = `${dayName} · ${datePart} · ${timePart} ET`;

  const leaders  = [...screenerStocks].sort((a, b) => b.rs - a.rs).slice(0, 3);
  const laggards = [...screenerStocks].sort((a, b) => a.rs - b.rs).slice(0, 3);


  // ---- Dash pop hover ----
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pop, setPop] = useState<PopState | null>(null);

  const showPop = (e: React.MouseEvent<HTMLElement>, sym: string, block: PopBlock) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const r = e.currentTarget.getBoundingClientRect();
    setPop({ sym, block, right: r.right, top: r.top, left: r.left });
  };
  const hidePop = () => {
    hideTimerRef.current = setTimeout(() => setPop(null), 150);
  };
  const cancelHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  // Minirow props factory
  const mr = (sym: string, block: PopBlock) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showPop(e, sym, block),
    onMouseLeave: hidePop,
  });

  function downloadRecap(which: string) {
    if (typeof window === "undefined") return;
    const blob = new Blob([`InvestIQ ${which} Recap`], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `InvestIQ-Recap-${which}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <div className="eyebrow">{dateStr}</div>
          <h1 className="page-title">{greeting}, {firstName}</h1>
        </div>
      </div>

      <div className="dash" style={{ alignItems: "stretch" }}>

        {/* ── 1. Pulse strip ── */}
        <div className="col-12">
          <div className="pulse">
            {pulse.slice(0, 6).map((x, i) => (
              <div key={x.l} className="p" style={{ cursor: "pointer" }} onClick={() => openIndex(i)}>
                <div className="lbl">{x.l}</div>
                <div className="val">{fmt(x.v, x.v > 1000 ? 0 : 2)}</div>
                <div className={`chg ${cls(x.c)}`}>{arr(x.c)} {sign(x.c)}</div>
                <Spark seed={i + 1} up={x.c >= 0} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. What Matters Now ── */}
        <div className="col-12">
          <div className="wmn">
            <div className="wmn-h">
              <div className="t">
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2>What Matters Now</h2>
                  <div className="meta">
                    <span className="live"><span className="dot" />Live</span>
                    · AI-curated · updates every 90s
                  </div>
                </div>
              </div>
              <button className="btn ai">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                30-sec audio
              </button>
            </div>
            <ul className="wmn-body" style={{ maxHeight: 220, overflowY: "scroll" }}>
              {wmn.map((b, i) => (
                <li key={i}>
                  <span className="bullet" />
                  <span>
                    <b>{b.h}.</b>{" "}
                    <span dangerouslySetInnerHTML={{ __html: b.t }} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="wmn-foot">
              Sources used:
              <span className="src-chip">CPI release</span>
              <span className="src-chip">NVDA 10-Q</span>
              <span className="src-chip">Analyst feed</span>
              <span className="src-chip">Your portfolio</span>
              <span style={{ marginLeft: "auto", color: "var(--ai)" }}>
                AI-generated · informational, not investment advice
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. Earnings Today ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Earnings Today</h3>
              <Link className="link" href="/menu/earnings">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {earnings.slice(0, 5).map(e => (
                <div key={e.s} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openEarnings(e.s)}
                  {...mr(e.s, "earnings")}
                >
                  <StockLogo sym={e.s} size={20} />
                  <span className="tkr">{e.s}<small>{e.n}</small></span>
                  <span className="mid">
                    <span className={`pill ${e.t === "BMO" ? "bmo" : "amc"}`}>{e.t}</span>
                  </span>
                  <span className={`r ${e.react != null ? cls(e.react) : ""}`}>
                    {e.react != null
                      ? sign(e.react)
                      : <span style={{ color: "var(--text-dim-solid)" }}>pending</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 4. Market Movers ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Market Movers</h3>
              <Link className="link" href="/menu/movers">All →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              <div className="up" style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", margin: "0 0 4px" }}>
                ▲ Top gainers
              </div>
              {movers.filter(m => m.c > 0).sort((a, b) => b.c - a.c).slice(0, 3).map(m => (
                <div key={m.s} className="minirow mv-dash-row" style={{ cursor: "pointer" }} onClick={() => openMoverModal(m.s)}>
                  <StockLogo sym={m.s} size={20} />
                  <span className="tkr">{m.s}</span>
                  <span className="mid">{m.cat}</span>
                  <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                  <MoverPopup m={m} />
                </div>
              ))}
              <div className="down" style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", margin: "8px 0 4px" }}>
                ▼ Top losers
              </div>
              {movers.filter(m => m.c < 0).sort((a, b) => a.c - b.c).slice(0, 3).map(m => (
                <div key={m.s} className="minirow mv-dash-row" style={{ cursor: "pointer" }} onClick={() => openMoverModal(m.s)}>
                  <StockLogo sym={m.s} size={20} />
                  <span className="tkr">{m.s}</span>
                  <span className="mid">{m.cat}</span>
                  <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                  <MoverPopup m={m} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 5. Market Heatmap ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Market Heatmap</h3>
              <Link className="link" href="/menu/heatmap">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 10, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {sectorList.slice(0, 8).map(sd => {
                  const a   = Math.min(Math.abs(sd.chg) / 2, 1);
                  const bg  = sd.chg >= 0
                    ? `rgba(28,170,112,${(0.25 + a * 0.55).toFixed(2)})`
                    : `rgba(208,52,76,${(0.25 + a * 0.55).toFixed(2)})`;
                  return (
                    <div key={sd.name} onClick={() => openSector(sd.name)}
                      style={{
                        cursor: "pointer", background: bg, borderRadius: 7,
                        padding: "8px 9px", flex: `${Math.max(1, sd.items.reduce((s, i) => s + i[1], 0) / 1400)} 1 70px`,
                        transition: "filter .13s",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = "brightness(1.15)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = ""}
                    >
                      <div style={{ fontSize: ".6rem", fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{sd.name}</div>
                      <div className="mono" style={{ fontSize: ".64rem", color: "#ffffffd0" }}>{sign(sd.chg)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 9 }}>
                Tap to open the full heatmap.
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. Analyst Actions ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Analyst Actions</h3>
              <Link className="link" href="/menu/analyst">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {analyst.slice(0, 5).map((a, i) => (
                <div key={i} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openStock(a.s)}
                  {...mr(a.s, "analyst")}
                >
                  <StockLogo sym={a.s} size={20} />
                  <span className="tkr">{a.s}</span>
                  <span className="mid">{a.firm} → <b style={{ color: "var(--text-hi)" }}>{a.to}</b></span>
                  <span className="r">{analystDir(a.dir)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 7. Screener · Leaders & Laggards ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Screener · Leaders &amp; Laggards</h3>
              <Link className="link" href="/menu/screener">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              <div className="up" style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", margin: "0 0 4px" }}>
                ▲ Leaders
              </div>
              {leaders.map(s => (
                <div key={s.s} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openStock(s.s)}
                  {...mr(s.s, "screener")}
                >
                  <StockLogo sym={s.s} size={20} />
                  <span className="tkr">{s.s}</span>
                  <span className="mid">RS {s.rs} · {s.sec}</span>
                  <span className={`r ${cls(s.salesG)}`}>{sign(s.salesG)}</span>
                </div>
              ))}
              <div className="down" style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", margin: "8px 0 4px" }}>
                ▼ Laggards
              </div>
              {laggards.map(s => (
                <div key={s.s} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openStock(s.s)}
                  {...mr(s.s, "screener")}
                >
                  <StockLogo sym={s.s} size={20} />
                  <span className="tkr">{s.s}</span>
                  <span className="mid">RS {s.rs} · {s.sec}</span>
                  <span className={`r ${cls(s.salesG)}`}>{sign(s.salesG)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 8. Portfolio Pulse ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Portfolio Pulse</h3>
              <Link className="link" href="/menu/portfolio">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)" }}>$128,430</span>
                <span className="mono up" style={{ fontWeight: 600 }}>▲ +1.42%</span>
              </div>
              {folio.slice(0, 4).map(f => {
                const dayC = movers.find(m => m.s === f.s)?.c ?? f.c;
                return (
                  <div key={f.s} className="minirow" style={{ cursor: "pointer" }}
                    onClick={() => openStock(f.s)}
                    {...mr(f.s, "portfolio")}
                  >
                    <StockLogo sym={f.s} size={20} />
                    <span className="tkr">{f.s}</span>
                    <span className="mid">{f.size} · {f.conv} conv.</span>
                    <span className={`r ${cls(dayC)}`}>{sign(dayC)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 9. Watchlist ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Watchlist</h3>
              <Link className="link" href="/menu/watchlist">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              {watch.slice(0, 5).map(w => (
                <div key={w.s} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openStock(w.s)}
                  {...mr(w.s, "watchlist")}
                >
                  <StockLogo sym={w.s} size={20} />
                  <span className="tkr">{w.s}<small>{w.n}</small></span>
                  <span className="mid">
                    {w.opt ? <span className="pill opt">⚡</span> : null}{" "}
                    ER {w.er}
                  </span>
                  <span className={`r ${cls(w.c)}`}>{sign(w.c)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 10. Insider & Institutional ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Insider &amp; Institutional</h3>
              <Link className="link" href="/menu/insider">View all →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {INSIDER_MINI.map(x => (
                <div key={x.s + x.dir} className="minirow" style={{ cursor: "pointer" }}
                  onClick={() => openStock(x.s)}
                  {...mr(x.s, "insider")}
                >
                  <StockLogo sym={x.s} size={20} />
                  <span className="tkr">{x.s}</span>
                  <span className="mid">{x.dir === "buy" ? "Buy" : "Sell"} · {x.role.replace(/ \(.*\)/, "")}</span>
                  <span className={`r ${x.dir === "buy" ? "up" : "down"}`}>
                    {x.dir === "buy" ? "+" : "−"}${x.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 11. Live Market Feed ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Live Market Feed</h3>
              <Link className="link" href="/menu/commentary">Commentary →</Link>
            </div>
            <div className="card-b" style={{ paddingTop: 2 }}>
              {LIVE_FEED.map((f, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, padding: "9px 0",
                  borderBottom: i < LIVE_FEED.length - 1 ? "1px solid var(--border-soft)" : undefined,
                }}>
                  <div style={{ flexShrink: 0, width: 62 }}>
                    <span className="pill" style={{ background: "var(--surface-3)", color: f.col }}>{f.cat}</span>
                    <div style={{ fontFamily: "var(--f-mono)", fontSize: ".6rem", color: "var(--text-dim-solid)", marginTop: 5 }}>
                      {f.time}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".8rem", color: "var(--text)" }} dangerouslySetInnerHTML={{ __html: f.t }} />
                    <div style={{
                      fontSize: ".72rem", color: "var(--text-dim-solid)",
                      borderLeft: `2px solid ${f.col}55`, paddingLeft: 8, marginTop: 4,
                    }}>
                      <b style={{ color: "var(--ai)", fontWeight: 600 }}>Why · </b>{f.why}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 12. Recaps ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Recaps</h3>
              <Link className="link" href="/menu/recap">All →</Link>
            </div>
            <div className="card-b">
              <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", marginBottom: 10 }}>
                Structured executive-summary report (PDF).
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <button className="btn" style={{ justifyContent: "flex-start" }} onClick={() => downloadRecap("today")}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Today (EOD)
                </button>
                <button className="btn" style={{ justifyContent: "flex-start" }} onClick={() => downloadRecap("yesterday")}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Yesterday
                </button>
                <button className="btn" style={{ justifyContent: "flex-start" }} onClick={() => downloadRecap("week")}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Last week
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 13. VIX · Volatility ── */}
        <div className="col-4">
          <div className="card vix" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>VIX · Volatility</h3>
              <span className="pill up">Calm</span>
            </div>
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span className="big">14.18</span>
                <span className="mono down" style={{ fontWeight: 600 }}>▼ -2.51%</span>
              </div>
              <div className="pctl" style={{ marginTop: 12 }}><i style={{ width: "22%" }} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".66rem", color: "var(--text-dim-solid)", marginBottom: 10 }}>
                <span>12-mo pct: 22nd</span>
                <span>Trend: falling</span>
              </div>
              <div className="note">VIX at 14 is low — a calm, risk-on tape.</div>
            </div>
          </div>
        </div>

        {/* ── 14. Fear & Greed ── */}
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-h">
              <h3>Fear &amp; Greed</h3>
              <span className="link">History →</span>
            </div>
            <div className="card-b gauge-wrap">
              <SemiGauge val={62} label="Greed" id="fg" />
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                Previous close: <b style={{ color: "var(--text)" }}>58</b>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* ── Dash hover popup ── */}
      {pop && (
        <div
          className="dash-pop"
          style={{
            left: Math.min(pop.right + 12, (typeof window !== "undefined" ? window.innerWidth : 1400) - 320),
            top:  Math.max(8, Math.min(pop.top, (typeof window !== "undefined" ? window.innerHeight : 900) - 280)),
          }}
          onMouseEnter={cancelHide}
          onMouseLeave={hidePop}
          onClick={() => {
            setPop(null);
            if (pop.block === "earnings") openEarnings(pop.sym);
            else if (pop.block === "movers") openMoverModal(pop.sym);
            else openStock(pop.sym);
          }}
        >
          <DashPopContent sym={pop.sym} block={pop.block} />
        </div>
      )}
    </>
  );
}
