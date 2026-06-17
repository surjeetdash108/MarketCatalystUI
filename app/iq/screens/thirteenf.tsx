"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { funds } from "../data";

const AI_SECTIONS = [
  { h: "What changed",   p: "Berkshire <b>trimmed its Apple stake by ~13%</b> — the single biggest dollar move of the quarter — while sharply building cash. Net posture turned more defensive." },
  { h: "Biggest buys",   p: "Added to <b>Chubb (CB)</b>, the previously-secret position now disclosed at ~$6.7B, and topped up <b>Occidental</b>." },
  { h: "Biggest exits",  p: "Fully exited <b>HP Inc</b> and <b>Paramount</b>, booking a loss on the latter." },
  { h: "Theme shift",    p: "Rotation <b>away from mega-cap tech concentration</b> toward insurance and energy — consistent with valuation caution." },
  { h: "Concentration",  p: "<b>Less concentrated</b>: top-5 weight fell from 79% to 75% after the Apple trim." },
  { h: "Your overlap",   p: "You both hold <b>AAPL</b>. Berkshire reducing while you hold a large high-conviction position — worth noting the divergence." },
];

const CROSS_OWN = [
  { s: "MSFT", note: "held by 4 funds", dir: 1 },
  { s: "AMZN", note: "held by 3 funds", dir: 1 },
  { s: "GOOGL", note: "held by 3 funds", dir: 1 },
];
const CROSS_SOLD = [
  { s: "AAPL", note: "trimmed by 3 funds", dir: -1 },
  { s: "DIS",  note: "trimmed by 3 funds", dir: -1 },
];
const CROSS_LONE = [
  { s: "BABA", note: "only Scion" },
  { s: "CMG",  note: "only Pershing" },
];

export function ThirteenFScreen() {
  const { openFund, openStock } = useIQActions();
  const [activeFund, setActiveFund] = useState(0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">13F Intelligence</div>
          <div className="page-title">Institutional Flow</div>
          <div className="page-sub">Tracking {funds.length} funds · Q1 2024 filings · sourced from SEC EDGAR</div>
        </div>
        <button className="btn">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Track a fund
        </button>
      </div>

      {/* Fund cards */}
      <div className="dash" style={{ padding: "0 18px" }}>
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
      <div className="dash" style={{ padding: "14px 18px 18px" }}>

        {/* AI 13F Summary (col-8) */}
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

        {/* Cross-fund signals (col-4) */}
        <div className="col-4">
          <div className="card">
            <div className="card-h"><h3>Cross-fund signals</h3></div>
            <div className="card-b">
              <div style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--up)", fontWeight: 700, margin: "4px 0 6px" }}>
                Most owned (3+ funds)
              </div>
              {CROSS_OWN.map(r => (
                <div key={r.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(r.s)}>
                  <span className="tkr">{r.s}</span>
                  <span className="mid">{r.note}</span>
                  <span className="r up">▲</span>
                </div>
              ))}

              <div style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--down)", fontWeight: 700, margin: "12px 0 6px" }}>
                Most sold (3+ funds)
              </div>
              {CROSS_SOLD.map(r => (
                <div key={r.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(r.s)}>
                  <span className="tkr">{r.s}</span>
                  <span className="mid">{r.note}</span>
                  <span className="r down">▼</span>
                </div>
              ))}

              <div style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ai)", fontWeight: 700, margin: "12px 0 6px" }}>
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
  );
}
