"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { funds } from "../data";

// ---- 13F section data ----
const AI_SECTIONS = [
  { h: "What changed",  p: "Berkshire <b>trimmed its Apple stake by ~13%</b> — the single biggest dollar move of the quarter — while sharply building cash. Net posture turned more defensive." },
  { h: "Biggest buys",  p: "Added to <b>Chubb (CB)</b>, the previously-secret position now disclosed at ~$6.7B, and topped up <b>Occidental</b>." },
  { h: "Biggest exits", p: "Fully exited <b>HP Inc</b> and <b>Paramount</b>, booking a loss on the latter." },
  { h: "Theme shift",   p: "Rotation <b>away from mega-cap tech concentration</b> toward insurance and energy — consistent with valuation caution." },
  { h: "Concentration", p: "Slightly <b>less concentrated</b>: top-5 weight fell from 79% to 75% after the Apple trim." },
  { h: "Your overlap",  p: "You both hold <b>AAPL</b>. Berkshire reducing while you hold a large high-conviction position — worth noting the divergence." },
];

const CROSS_OWN  = [{ s: "MSFT", note: "held by 4 funds", dir: 1 }, { s: "AMZN", note: "held by 3 funds", dir: 1 }, { s: "GOOGL", note: "held by 3 funds", dir: 1 }];
const CROSS_SOLD = [{ s: "AAPL", note: "trimmed by 3 funds", dir: -1 }, { s: "DIS", note: "trimmed by 3 funds", dir: -1 }];
const CROSS_LONE = [{ s: "BABA", note: "only Scion" }, { s: "CMG", note: "only Pershing" }];

// ---- Insider feed data ----
interface InsiderTx {
  s: string; role: string; det: string; dir: "buy" | "sell"; val: string; date: string;
}
const INSIDER_FEED: InsiderTx[] = [
  { s: "NVDA", role: "CEO",               det: "Open market purchase", dir: "buy",  val: "4.8M",  date: "Jun 12" },
  { s: "AAPL", role: "10% owner",         det: "Rule 10b5-1 sale",     dir: "sell", val: "12.1M", date: "Jun 11" },
  { s: "MSFT", role: "CFO",               det: "Open market purchase", dir: "buy",  val: "2.2M",  date: "Jun 11" },
  { s: "META", role: "Director",          det: "Open market purchase", dir: "buy",  val: "880K",  date: "Jun 10" },
  { s: "AMD",  role: "CEO",               det: "Open market purchase", dir: "buy",  val: "1.5M",  date: "Jun 10" },
  { s: "TSLA", role: "10% owner",         det: "Rule 10b5-1 sale",     dir: "sell", val: "22.4M", date: "Jun 9"  },
  { s: "AVGO", role: "EVP, Engineering",  det: "Open market purchase", dir: "buy",  val: "3.1M",  date: "Jun 9"  },
  { s: "AMZN", role: "Director",          det: "Open market purchase", dir: "buy",  val: "640K",  date: "Jun 8"  },
  { s: "PLTR", role: "10% owner",         det: "Rule 10b5-1 sale",     dir: "sell", val: "8.7M",  date: "Jun 8"  },
  { s: "CRM",  role: "CEO",               det: "Open market purchase", dir: "buy",  val: "990K",  date: "Jun 7"  },
];

type InsiderFilter = "All" | "Buys" | "Sells" | "10% owners";

export function InsiderScreen() {
  const { openFund, openStock } = useIQActions();
  const [view, setView] = useState<"insider" | "13f">("insider");
  const [activeFund, setActiveFund] = useState(0);
  const [insFilter, setInsFilter] = useState<InsiderFilter>("All");
  const [insSort, setInsSort] = useState<"value" | "date">("date");

  const filtered = INSIDER_FEED.filter(x => {
    if (insFilter === "Buys") return x.dir === "buy";
    if (insFilter === "Sells") return x.dir === "sell";
    if (insFilter === "10% owners") return x.role.includes("10% owner");
    return true;
  });

  const sortedFeed = [...filtered].sort((a, b) => {
    if (insSort === "value") {
      const parse = (v: string) => parseFloat(v) * (v.includes("M") ? 1 : 0.001);
      return parse(b.val) - parse(a.val);
    }
    return 0;
  });

  const sub = view === "13f"
    ? "Quarterly 13F fund positioning · sourced from SEC EDGAR"
    : "Form 4 insider transactions & 10%-owner moves · last 5 sessions";

  const CHIPS: InsiderFilter[] = ["All", "Buys", "Sells", "10% owners"];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">My Money · Smart money</div>
          <div className="page-title">Insider &amp; Institutional</div>
          <div className="page-sub">{sub}</div>
        </div>
        <div className="tabs">
          <button className={`tab${view === "insider" ? " active" : ""}`} onClick={() => setView("insider")}>
            Insider activity
          </button>
          <button className={`tab${view === "13f" ? " active" : ""}`} onClick={() => setView("13f")}>
            13F institutional
          </button>
        </div>
      </div>

      {/* ---- Insider activity view ---- */}
      {view === "insider" && (
        <>
          {/* Most active by $ volume chips */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-h">
              <h3>Most active by insider $ volume</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                last 5 sessions
              </span>
            </div>
            <div className="card-b" style={{ paddingTop: 8, display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {["TSLA", "NVDA", "AAPL", "AVGO", "PLTR", "MSFT"].map(s => {
                const txs = INSIDER_FEED.filter(x => x.s === s);
                const net = txs.reduce((acc, x) => {
                  const v = parseFloat(x.val) * (x.val.includes("M") ? 1 : 0.001);
                  return acc + (x.dir === "buy" ? v : -v);
                }, 0);
                return (
                  <button key={s} className="tr-pill" onClick={() => openStock(s)}>
                    <span className="tr-tk">{s}</span>
                    <span className="tr-mt">
                      {txs.length} filing{txs.length > 1 ? "s" : ""} · net {net >= 0 ? "+" : "−"}${Math.abs(net).toFixed(1)}M
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter bar */}
          <div className="fbar" style={{ marginBottom: 12 }}>
            {CHIPS.map(c => (
              <button key={c} className={`chip${insFilter === c ? " on" : ""}`} onClick={() => setInsFilter(c)}>{c}</button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center", marginRight: 6 }}>Sort</span>
            <button className={`chip${insSort === "value" ? " on" : ""}`} onClick={() => setInsSort("value")}>Value</button>
            <button className={`chip${insSort === "date" ? " on" : ""}`} onClick={() => setInsSort("date")}>Date</button>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-h">
              <h3>{insFilter === "All" ? "All activity" : insFilter} · {sortedFeed.length} filings</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                Form 4 · last 5 sessions
              </span>
            </div>
            <div className="card-b" style={{ paddingTop: 2, overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Side</th>
                    <th>Insider / owner</th>
                    <th>Transaction</th>
                    <th className="num">Value</th>
                    <th className="num">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFeed.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: "var(--text-dim-solid)", padding: 16 }}>
                        No filings match this filter.
                      </td>
                    </tr>
                  ) : sortedFeed.map((x, i) => (
                    <tr key={i} onClick={() => openStock(x.s)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="co">
                          <span className="s">{x.s}</span>
                        </div>
                      </td>
                      <td>
                        <span className="tr-badge" style={{
                          background: x.dir === "buy" ? "var(--up-dim)" : "var(--down-dim)",
                          color: x.dir === "buy" ? "var(--up)" : "var(--down)",
                        }}>
                          {x.dir === "buy" ? "BUY" : "SELL"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "normal", lineHeight: 1.4 }}>{x.role}</td>
                      <td style={{ whiteSpace: "normal", lineHeight: 1.4, color: "var(--text-dim-solid)" }}>{x.det}</td>
                      <td className="num">
                        <b className={x.dir === "buy" ? "up" : "down"}>
                          {x.dir === "buy" ? "+" : "−"}${x.val}
                        </b>
                      </td>
                      <td className="num" style={{ color: "var(--text-dim-solid)" }}>{x.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 10 }}>
            Click any row to open that company&apos;s stock page. Source (production): SEC Form 4 via EDGAR. Informational only — not investment advice.
          </p>
        </>
      )}

      {/* ---- 13F institutional view ---- */}
      {view === "13f" && (
        <>
          {/* Fund cards */}
          <div className="dash" style={{ marginBottom: 14 }}>
            {funds.map((f, i) => (
              <div key={f.nm} className="col-4">
                <div className={`fundcard${activeFund === i ? " on" : ""}`}
                  onClick={() => { setActiveFund(i); openFund(i); }}>
                  <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 12 }}>
                    <div className="av">{f.av}</div>
                    <div>
                      <div className="nm">{f.nm}</div>
                      <div className="mgr">{f.mgr}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontFamily: "var(--f-mono)", fontSize: ".78rem" }}>
                    <div>
                      <div style={{ color: "var(--text-dim-solid)", fontSize: ".62rem", fontFamily: "var(--f-body)" }}>13F AUM</div>
                      <b style={{ color: "var(--text-hi)" }}>{f.aum}</b>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-dim-solid)", fontSize: ".62rem", fontFamily: "var(--f-body)" }}>Positions</div>
                      <b style={{ color: "var(--text-hi)" }}>{f.pos}</b>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-dim-solid)", fontSize: ".62rem", fontFamily: "var(--f-body)" }}>Top</div>
                      <b style={{ color: "var(--text-hi)" }}>{f.top}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 11, alignItems: "center" }}>
                    <span className="pill up">{f.newPos} new buys</span>
                    <span className="pill dn">{f.exits} exits</span>
                    <span className="pill amc">{f.q}</span>
                    <span className="link" style={{ marginLeft: "auto" }}
                      onClick={e => { e.stopPropagation(); openFund(i); }}>
                      Deep analysis →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Summary + Cross-fund signals */}
          <div className="dash">
            <div className="col-8">
              <div className="ai-block">
                <div className="card-h">
                  <h3 className="ai-c">◆ AI 13F Summary · {funds[activeFund]?.nm} · {funds[activeFund]?.q}</h3>
                  <span className="pill ai">Auto-generated</span>
                </div>
                <div className="card-b">
                  {AI_SECTIONS.map(s => (
                    <div key={s.h} className="ai-sec">
                      <div className="h">{s.h}</div>
                      <p dangerouslySetInnerHTML={{ __html: s.p }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-4">
              <div className="card">
                <div className="card-h"><h3>Cross-fund signals</h3></div>
                <div className="card-b">
                  <div style={{ fontSize: ".7rem", textTransform: "uppercase" as const, letterSpacing: ".06em", color: "var(--up)", fontWeight: 700, margin: "4px 0 6px" }}>
                    Most owned (3+ funds)
                  </div>
                  {CROSS_OWN.map(r => (
                    <div key={r.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(r.s)}>
                      <span className="tkr">{r.s}</span>
                      <span className="mid">{r.note}</span>
                      <span className="r up">▲</span>
                    </div>
                  ))}

                  <div style={{ fontSize: ".7rem", textTransform: "uppercase" as const, letterSpacing: ".06em", color: "var(--down)", fontWeight: 700, margin: "12px 0 6px" }}>
                    Most sold (3+ funds)
                  </div>
                  {CROSS_SOLD.map(r => (
                    <div key={r.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(r.s)}>
                      <span className="tkr">{r.s}</span>
                      <span className="mid">{r.note}</span>
                      <span className="r down">▼</span>
                    </div>
                  ))}

                  <div style={{ fontSize: ".7rem", textTransform: "uppercase" as const, letterSpacing: ".06em", color: "var(--ai)", fontWeight: 700, margin: "12px 0 6px" }}>
                    Lone high-conviction
                  </div>
                  {CROSS_LONE.map(r => (
                    <div key={r.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(r.s)}>
                      <span className="tkr">{r.s}</span>
                      <span className="mid">{r.note}</span>
                      <span className="r ai-c">◆</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
