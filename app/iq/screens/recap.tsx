"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { recap } from "../data";
import { cls, arr, sign } from "../utils";

const TABS = ["Today (EOD)", "This Week"];

const SECTORS: { name: string; v: number }[] = [
  { name: "Semiconductors", v: 3.10 },
  { name: "Software",       v: 1.40 },
  { name: "Internet",       v: 0.98 },
  { name: "Industrials",    v: 0.72 },
  { name: "Financials",     v: 0.61 },
  { name: "Healthcare",     v: 0.22 },
  { name: "Consumer Disc",  v: -0.44 },
  { name: "Real Estate",    v: -0.81 },
  { name: "Utilities",      v: -0.28 },
  { name: "Energy",         v: -1.12 },
];

function heatColor(v: number): string {
  const abs = Math.min(Math.abs(v) / 4, 1);
  if (v > 0) return `rgba(47,230,166,${0.2 + abs * 0.7})`;
  return `rgba(255,90,90,${0.2 + abs * 0.7})`;
}

export function RecapScreen() {
  const { openStock } = useIQActions();
  const [activeTab, setActiveTab] = useState(0);

  function downloadRecap(which: string) {
    const blob = new Blob([`InvestIQ ${which} Recap — ${recap.date}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `InvestIQ-Recap-${which}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Recaps</div>
          <div className="page-title">End-of-Day Recap</div>
          <div className="page-sub">{recap.date} · {recap.subtitle}</div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " active" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* Hero */}
        <div className="recap-hero">
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
            <div className="wmn-orb">
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
              </svg>
            </div>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>
              {recap.headline}
            </div>
          </div>

          {/* Index returns */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            {recap.indices.map(idx => (
              <div key={idx.l}>
                <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{idx.l}</div>
                <div className={`mono ${cls(idx.v)}`} style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  {arr(idx.v)}{sign(idx.v)}
                </div>
              </div>
            ))}
            <div style={{ marginLeft: "auto" }}>
              <button className="btn ai">
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
                60-sec audio recap
              </button>
            </div>
          </div>

          {/* PDF downloads */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 600, letterSpacing: ".03em" }}>DOWNLOAD PDF:</span>
            {(["Today (EOD)", "Yesterday", "Last week"] as const).map(w => (
              <button key={w} className="btn" onClick={() => downloadRecap(w)}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {w}
              </button>
            ))}
          </div>

          {/* Key stories + Up next */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="eyebrow">Key stories</div>
                <span className="link">View all →</span>
              </div>
              {recap.stories.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: ".84rem" }}>
                  <span className="bullet" style={{ marginTop: 6, flexShrink: 0 }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="eyebrow">Up next · tomorrow</div>
                <span className="link">View all →</span>
              </div>
              {recap.tomorrow.map((t, i) => (
                <div key={i} className="minirow">
                  <span className="mono" style={{ width: 54, color: "var(--warn)" }}>{t.time}</span>
                  <span className="mid">{t.ev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sector heatmap */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <h3>Sector heatmap</h3>
            <span className="link">View all →</span>
          </div>
          <div className="card-b">
            <div className="heat">
              {SECTORS.map(s => (
                <div key={s.name} className="s" style={{ background: heatColor(s.v) }}>
                  <div className="nm">{s.name}</div>
                  <div className="v">{arr(s.v)}{sign(s.v)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9, fontSize: ".74rem" }}>
              <span style={{ color: "var(--text-dim-solid)" }}>Sectors 1–10 of 50 · click one to open it in the heatmap</span>
              <span className="link">Show next 10 →</span>
            </div>
          </div>
        </div>

        {/* Movers + Internals */}
        <div className="dash" style={{ marginTop: 14 }}>
          <div className="col-6">
            <div className="card">
              <div className="card-h">
                <h3>Biggest earnings movers</h3>
                <span className="link">View all →</span>
              </div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {recap.movers.map(m => (
                  <div key={m.s} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(m.s)}>
                    <span className="tkr">{m.s}</span>
                    <span className="mid">{m.reason}</span>
                    <span className={`r ${cls(m.c)}`}>{sign(m.c)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="card">
              <div className="card-h">
                <h3>Market internals</h3>
                <span className="link">View all →</span>
              </div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {recap.internals.map(r => (
                  <div key={r.l} className="minirow">
                    <span className="mid">{r.l}</span>
                    <span className={`r ${r.c > 0 ? "up" : r.c < 0 ? "down" : ""}`}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
