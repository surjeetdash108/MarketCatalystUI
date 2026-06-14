"use client";

import { useState } from "react";
import { commentary } from "../data";

const TAGS = ["All", "AI", "Macro", "Sectors", "Consumer"];

export function CommentaryScreen() {
  const [tag, setTag] = useState("All");
  const filtered = commentary.filter(c => tag === "All" || c.tag === tag);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Commentary</div>
          <div className="page-sub">InvestIQ analysis, sector views, and market perspectives</div>
        </div>
      </div>

      <div className="fbar">
        {TAGS.map(t => (
          <button key={t} className={`chip${tag === t ? " active" : ""}`} onClick={() => setTag(t)}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "14px 18px" }}>
        {filtered.map((c, i) => (
          <div key={i} className="comm-card">
            <div>
              <span className="comm-by">{c.by} · {c.dt}</span>
              <span className="comm-tag">{c.tag}</span>
            </div>
            <div className="comm-title">{c.title}</div>
            <div className="comm-blurb">{c.blurb}</div>
            <div style={{ marginTop: 10 }}>
              <button className="chip" style={{ fontSize: 11, padding: "3px 10px" }}>Read full analysis →</button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ color: "var(--text-dim-solid)", fontSize: 13, padding: 20, textAlign: "center" }}>
            No commentary for tag: {tag}
          </div>
        )}
      </div>
    </>
  );
}
