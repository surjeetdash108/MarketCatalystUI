"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { earnings } from "../data";
import { cls, arr, sign, fmt } from "../utils";

const TABS = ["Today", "Tomorrow", "This Week", "Next Week", "Custom"];

function timePill(t: string) {
  const isBMO = t.toLowerCase().includes("pre");
  return <span className={`pill ${isBMO ? "bmo" : "amc"}`}>{isBMO ? "BMO" : "AMC"}</span>;
}

function guidePill(guide: string | null) {
  if (!guide) return <span style={{ color: "var(--text-dim-solid)" }}>—</span>;
  const g = guide.toLowerCase();
  if (g === "raised") return <span className="pill raise">Raised</span>;
  if (g === "lowered") return <span className="pill lower">Lowered</span>;
  return <span className="pill hold">Maintained</span>;
}

function tagCls(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "beat") return "beat";
  if (t === "miss") return "miss";
  if (t === "raised") return "raise";
  if (t === "lowered") return "lower";
  return t;
}

export function EarningsScreen() {
  const { openEarnings, openSector } = useIQActions();
  const [activeTab, setActiveTab] = useState(0);
  const [showOwned, setShowOwned] = useState(false);
  const [showBMO, setShowBMO] = useState(false);
  const [showAMC, setShowAMC] = useState(false);
  const [beatsOnly, setBeatsOnly] = useState(false);
  const [sortReact, setSortReact] = useState(false);

  let filtered = earnings.filter(e => {
    if (showOwned && !e.owned) return false;
    if (showBMO && !e.t.toLowerCase().includes("pre")) return false;
    if (showAMC && !e.t.toLowerCase().includes("post")) return false;
    if (beatsOnly && (e.epsA === null || e.epsA <= e.epsE)) return false;
    return true;
  });

  if (sortReact) {
    filtered = [...filtered].sort((a, b) => {
      const ra = a.react ?? 0;
      const rb = b.react ?? 0;
      return Math.abs(rb) - Math.abs(ra);
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Earnings Workspace</div>
          <div className="page-title">Earnings Calendar</div>
          <div className="page-sub">
            {earnings.length} companies report today · {earnings.filter(e => e.owned).length} in your portfolio or watchlist
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab${i === activeTab ? " active" : ""}`}
              onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="fbar">
        <button className={`chip${showOwned ? " active" : ""}`} onClick={() => setShowOwned(o => !o)}>
          ✓ My names
        </button>
        <button className={`chip${showBMO ? " active" : ""}`} onClick={() => setShowBMO(o => !o)}>
          Before open
        </button>
        <button className={`chip${showAMC ? " active" : ""}`} onClick={() => setShowAMC(o => !o)}>
          After close
        </button>
        <button className="chip">Large cap</button>
        <button className="chip">Options active</button>
        <button className={`chip${beatsOnly ? " active" : ""}`} onClick={() => setBeatsOnly(o => !o)}>
          Beats only
        </button>
        <div style={{ flex: 1 }} />
        <button className={`chip${sortReact ? " active" : ""}`} onClick={() => setSortReact(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Sort: Price reaction
        </button>
      </div>

      <div className="card" style={{ margin: "0 18px 14px", borderTop: "none", borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                <th>Time</th>
                <th>Sector</th>
                <th className="num">EPS</th>
                <th className="num">Surprise</th>
                <th className="num">Revenue</th>
                <th>Guidance</th>
                <th className="num">Reaction</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const epsSurp = e.epsA != null ? ((e.epsA - e.epsE) / e.epsE * 100) : null;
                return (
                  <tr key={e.s} className={e.owned ? "owned" : ""} style={{ cursor: "pointer" }}
                    onClick={() => openEarnings(e.s)}>
                    <td>
                      <div className="co">
                        <span className="s">
                          {e.owned && <span className="own-dot" />}
                          {e.s}
                        </span>
                        <span className="n">{e.n}</span>
                      </div>
                    </td>
                    <td>{timePill(e.t)}</td>
                    <td>
                      <span className="link"
                        onClick={ev => { ev.stopPropagation(); openSector(e.sec); }}>
                        {e.sec}
                      </span>
                    </td>
                    <td className="num">
                      {e.epsA != null
                        ? `$${fmt(e.epsA)}`
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td className={`num${epsSurp != null ? " " + cls(epsSurp) : ""}`}>
                      {epsSurp != null
                        ? sign(epsSurp)
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td className="num">
                      {e.revA != null
                        ? `$${fmt(e.revA, 1)}B`
                        : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}
                    </td>
                    <td>{guidePill(e.guide)}</td>
                    <td className={`num${e.react != null ? " " + cls(e.react) : ""}`}>
                      {e.react != null
                        ? `${arr(e.react)} ${sign(e.react)}`
                        : <span style={{ color: "var(--warn)" }}>±{e.implied}% impl</span>}
                    </td>
                    <td>
                      <div className="cellpills">
                        {e.tags.map(t => (
                          <span key={t} className={`pill ${tagCls(t)}`}>{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", padding: "0 18px 14px" }}>
        Click any row to open the earnings detail drawer with AI summary and peer reactions.
      </p>
    </>
  );
}
