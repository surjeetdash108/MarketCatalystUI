"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commentary } from "../data";

const TABS = ["Live", "Premarket", "After Hours", "My names", "Macro"];

export function CommentaryScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Context</div>
          <div className="page-title">All-Market Commentary</div>
          <div className="page-sub">Live, plain-English coverage of stocks in play, news, ratings and the macro tape</div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " active" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="dash" style={{ padding: "0 18px 18px" }}>

        {/* col-8: Intraday live feed */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>Intraday commentary</h3>
              <span className="live"><span className="dot" />Live · streaming</span>
            </div>
            <div className="card-b" style={{ paddingTop: 2 }}>
              {commentary.map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12,
                  padding: "12px 0",
                  borderBottom: i < commentary.length - 1 ? "1px solid var(--border-soft)" : "none",
                }}>
                  <div style={{ flexShrink: 0, width: 84 }}>
                    <span className="pill" style={{
                      background: "var(--surface-3)",
                      color: item.accent,
                    }}>{item.cat}</span>
                    <div className="mono" style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 6 }}>
                      {item.time}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".88rem", color: "var(--text)" }}
                      dangerouslySetInnerHTML={{ __html: item.text }} />
                    <div style={{
                      fontSize: ".78rem", color: "var(--text-dim-solid)",
                      borderLeft: `2px solid ${item.accent}55`,
                      paddingLeft: 9, marginTop: 5,
                    }}>
                      <b style={{ color: "var(--ai)", fontWeight: 600 }}>Why it matters · </b>
                      {item.why}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* col-4: sidecards */}
        <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Before the Bell */}
          <div className="wmn">
            <div className="wmn-h">
              <div className="t">
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: ".92rem" }}>Before the Bell</h2>
                  <div className="meta">pushed 8:30a ET</div>
                </div>
              </div>
            </div>
            <ul className="wmn-body" style={{ columns: 1, padding: "6px 18px 14px" }}>
              <li>
                <span className="bullet" />
                <span>Futures point higher after a <b>cooler CPI</b> print; rate-cut odds for September rose.</span>
              </li>
              <li>
                <span className="bullet" />
                <span>Overnight: Asian semis rallied on NVDA; European luxury slipped on China demand.</span>
              </li>
              <li>
                <span className="bullet" />
                <span>Before open: <b>HD</b>, <b>DELL</b> report; watch guidance commentary.</span>
              </li>
            </ul>
          </div>

          {/* After the Close */}
          <div className="card">
            <div className="card-h">
              <h3>After the Close</h3>
              <span className="pill amc">within 30 min</span>
            </div>
            <div className="card-b">
              <p style={{ fontSize: ".82rem", lineHeight: 1.55, color: "var(--text-dim-solid)" }}>
                A pushed summary of final index performance, the day's top stories, and what's scheduled for tomorrow will appear here within 30 minutes of the close.
              </p>
              <button className="btn ai" style={{ marginTop: 10, width: "100%" }} onClick={() => router.push("/menu/recap")}>
                See today's EOD recap →
              </button>
            </div>
          </div>

          {/* General perspective */}
          <div className="card">
            <div className="card-h"><h3>General perspective</h3></div>
            <div className="card-b">
              <div className="note">
                Regime reads <b style={{ color: "var(--text-hi)" }}>Risk-On Rally</b>: breadth strong, yields easing, cyclicals leading defensives. Cheap-hedging environment with VIX at 14.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
