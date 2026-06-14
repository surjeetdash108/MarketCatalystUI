"use client";

import { recap } from "../data";

export function RecapScreen() {
  function downloadPDF() {
    const content = [
      `InvestIQ Weekly Recap — ${recap.date}`,
      "",
      "MARKET OVERVIEW",
      recap.mkt,
      "",
      ...recap.items.flatMap(item => [
        `${item.dt}: ${item.title}`,
        item.body,
        "",
      ]),
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `InvestIQ-Recap-${recap.date.replace(/[^a-z0-9]/gi, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Weekly Recaps</div>
          <div className="page-sub">Summarised week-by-week market intelligence</div>
        </div>
      </div>

      <div style={{ padding: "14px 18px" }}>
        {/* Hero */}
        <div className="recap-hero">
          <div className="recap-date">WEEK OF {recap.date.toUpperCase()}</div>
          <div className="recap-title">Weekly Market Recap</div>
          <div className="recap-blurb">{recap.mkt}</div>
          <button className="recap-dl" onClick={downloadPDF}>↓ Download PDF</button>
        </div>

        {/* Daily items */}
        {recap.items.map((item, i) => (
          <div key={i} className="recap-item">
            <div className="recap-item-date">{item.dt}</div>
            <div className="recap-item-title">{item.title}</div>
            <div className="recap-item-body">{item.body}</div>
          </div>
        ))}

        {/* Older recaps placeholder */}
        <div className="card" style={{ marginTop: 4 }}>
          <div className="card-h"><h3>Previous Weeks</h3></div>
          <div className="card-b">
            {[
              "May 13–17, 2025 — Fed hold, retail sales miss, CPI in-line",
              "May 6–10, 2025 — Strong jobs report, Apple steady, energy selloff",
              "Apr 29–May 3, 2025 — Q1 GDP beat, FOMC meeting, META earnings surge",
            ].map((w, i) => (
              <div key={i} style={{
                padding: "9px 0",
                borderBottom: i < 2 ? "1px solid var(--border-soft)" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>{w}</span>
                <button className="chip" style={{ fontSize: 10.5, padding: "2px 8px" }}>View →</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
