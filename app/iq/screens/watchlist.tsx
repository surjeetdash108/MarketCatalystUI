"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { watch as watchData, WatchItem } from "../data";
import { cls, arr, sign, fmt, StockLogo } from "../utils";

type WlRange = "eod" | "eow";
type Filter = "All" | "Has alert" | "Options active";

function wlAlerts(w: WatchItem): Array<[string, string, string]> {
  const a: Array<[string, string, string]> = [];
  if (Math.abs(w.c) >= 3) a.push(["Price", w.c >= 0 ? "up" : "down", (w.c >= 0 ? "+" : "") + w.c.toFixed(1) + "%"]);
  if (w.analyst && /upgrade|→ (Buy|Overweight|Outperform)/i.test(w.analyst)) a.push(["Analyst", "up", "upgrade"]);
  if (w.analyst && /downgrade|→ (Sell|Underweight|Neutral)/i.test(w.analyst)) a.push(["Analyst", "down", "downgrade"]);
  if (w.opt) a.push(["Options", "warn", "unusual"]);
  return a;
}

export function WatchlistScreen() {
  const { openStock } = useIQActions();
  const [wlRange, setWlRange] = useState<WlRange>("eod");
  const [aiOn, setAiOn] = useState<Set<string>>(() => new Set(watchData.map(w => w.s)));
  const [watching, setWatching] = useState<Set<string>>(() => new Set(watchData.map(w => w.s)));
  const [filter, setFilter] = useState<Filter>("All");

  function toggleAI(sym: string) {
    setAiOn(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  }

  function toggleWatch(sym: string) {
    setWatching(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  }

  const list = watchData.filter(w => {
    if (filter === "Has alert") return wlAlerts(w).length > 0;
    if (filter === "Options active") return w.opt;
    return true;
  });

  const up = list.filter(w => w.c > 0).length;
  const dn = list.filter(w => w.c < 0).length;
  const best = [...list].sort((a, b) => b.c - a.c)[0];
  const worst = [...list].sort((a, b) => a.c - b.c)[0];
  const aiCount = aiOn.size;

  const eodText =
    `Your ${list.length} watched names finished <b class="up">${up} up</b> / <b class="down">${dn} down</b> today.` +
    (best ? ` <b>${best.s}</b> led (${sign(best.c)})` : "") +
    (worst && worst.s !== best?.s ? `, <b>${worst.s}</b> lagged (${sign(worst.c)})` : "") +
    `. Broad market: Nasdaq <b class="up">+1.02%</b>, S&P 500 <b class="up">+0.73%</b> — a risk-on tape favoring your tech-heavy list.`;

  const eowText =
    `On the week the list tracked the broad market — Nasdaq <b class="up">+2.6%</b>, S&P 500 <b class="up">+1.8%</b>. Momentum names (${list.slice(0, 2).map(w => w.s).join(", ")}) carried; watch for mean-reversion into next week's data.`;

  const sumTxt = wlRange === "eod" ? eodText : eowText;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">My Watchlist</div>
          <div className="page-title">Names I&apos;m tracking</div>
          <div className="page-sub">
            {list.length} names · AI parsing on for {aiCount} · alerts fire on price moves &amp; analyst upgrades
          </div>
        </div>
        <div className="tabs">
          <button className={`tab${wlRange === "eod" ? " on" : ""}`} onClick={() => setWlRange("eod")}>EOD summary</button>
          <button className={`tab${wlRange === "eow" ? " on" : ""}`} onClick={() => setWlRange("eow")}>EOW summary</button>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* AI Watchlist Summary */}
        <div className="ai-block" style={{ marginBottom: 14 }}>
          <div className="card-h">
            <h3 className="ai-c">◆ Watchlist {wlRange === "eod" ? "end-of-day" : "end-of-week"} summary</h3>
            <span className="pill ai">AI</span>
          </div>
          <div className="card-b">
            <p dangerouslySetInnerHTML={{ __html: sumTxt }}
              style={{ marginBottom: 10, fontSize: ".88rem", lineHeight: 1.55 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="src-chip">Up {up}/{list.length}</span>
              <span className="src-chip">AI parsing: {aiCount}</span>
              <span className="src-chip">Nasdaq +1.02%</span>
              <span className="src-chip">S&amp;P +0.73%</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="fbar" style={{ marginBottom: 12 }}>
          {(["All", "Has alert", "Options active"] as Filter[]).map(f => (
            <button key={f} className={`chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Add names with the ⭐ in search (⌘K)</span>
        </div>

        {/* Watchlist table */}
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Price</th>
                  <th>Day</th>
                  <th>Next ER</th>
                  <th>Alerts</th>
                  <th>AI parse</th>
                  <th>Watch</th>
                </tr>
              </thead>
              <tbody>
                {list.map(w => {
                  const al = wlAlerts(w);
                  const ai = aiOn.has(w.s);
                  return (
                    <tr key={w.s}>
                      <td onClick={() => openStock(w.s)} style={{ cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StockLogo sym={w.s} size={26} />
                          <div className="co">
                            <span className="s">{w.s}</span>
                            <span className="n">{w.n}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num">{fmt(w.px)}</td>
                      <td className={`num ${cls(w.c)}`}>{arr(w.c)} {sign(w.c)}</td>
                      <td style={{ fontSize: ".8rem" }}>{w.er}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {al.length > 0
                          ? al.map((a, i) => (
                              <span key={i} className={`pill ${a[1]}`} style={{ fontSize: ".66rem", marginRight: 3 }}>
                                {a[0]}: {a[2]}
                              </span>
                            ))
                          : <span style={{ color: "var(--text-dim-solid)", fontSize: ".8rem" }}>—</span>
                        }
                      </td>
                      <td>
                        <button className={`ai-toggle${ai ? " on" : ""}`} onClick={() => toggleAI(w.s)}>
                          {ai ? "AI ✓" : "AI"}
                        </button>
                      </td>
                      <td>
                        <button className={`wl-star${watching.has(w.s) ? " on" : ""}`} onClick={() => toggleWatch(w.s)}>★</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
