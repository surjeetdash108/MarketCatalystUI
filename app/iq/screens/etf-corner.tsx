"use client";

import { useState } from "react";
import { hashStr } from "../utils";

/**
 * ETF Corner — visual placeholder only, no backend wiring (unlike AI Corner's
 * ai-infrastructure.tsx, there is no matching ETF endpoint yet). Categories
 * below are static, hand-authored labels for layout purposes — the same kind
 * of hand-curated constant themes.tsx already uses for its 8 sector themes —
 * not live data, so no company counts or tickers are shown on the tiles.
 */
const ETF_CATEGORIES = [
  { key: "broad-market", icon: "🌐", title: "Broad Market", blurb: "Total-market and broad index funds tracking the S&P 500, Nasdaq, and beyond." },
  { key: "sector", icon: "🏭", title: "Sector ETFs", blurb: "Funds concentrated in a single sector — tech, healthcare, financials, energy, and more." },
  { key: "fixed-income", icon: "💵", title: "Fixed Income", blurb: "Bond and treasury funds spanning the yield curve, from short-term to long-duration." },
  { key: "commodities", icon: "🛢️", title: "Commodities", blurb: "Gold, oil, agriculture and broad commodity-basket exposure." },
  { key: "international", icon: "🌍", title: "International & Emerging Markets", blurb: "Developed and emerging-market equity funds outside the US." },
  { key: "dividend-income", icon: "💰", title: "Dividend & Income", blurb: "High-yield and dividend-growth strategies built for income." },
  { key: "thematic-growth", icon: "🚀", title: "Thematic & Growth", blurb: "Innovation, clean energy, robotics and other thematic growth baskets." },
  { key: "leveraged-inverse", icon: "⚡", title: "Leveraged & Inverse", blurb: "Geared and inverse funds for short-term tactical positioning." },
];

const ACCENTS = ["#38BDF8", "#A78BFA", "#34D399", "#FBBF24", "#F472B6", "#FB923C", "#2DD4BF", "#818CF8", "#F87171", "#4ADE80"];
function accentFor(key: string): string {
  return ACCENTS[hashStr(key) % ACCENTS.length];
}

export function ComingSoonEtfScreen() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredCategories = q
    ? ETF_CATEGORIES.filter(c => c.title.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q))
    : ETF_CATEGORIES;

  return (
    <>
      <div className="page-head">
        <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim-solid)", pointerEvents: "none", fontSize: ".9rem" }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search fund categories…"
            style={{
              width: "100%", boxSizing: "border-box", background: "var(--surface-3)",
              border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px 8px 32px",
              fontSize: ".82rem", color: "var(--text-hi)", outline: "none", fontFamily: "var(--f-mono)",
            }}
          />
        </div>
        <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>Coming soon</span>
      </div>

      <div className="dash">
        <div className="col-12">
          {filteredCategories.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-dim-solid)", fontSize: ".82rem" }}>
              No fund categories match “{query}”.
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {filteredCategories.map(c => (
              <div
                key={c.key}
                className="card"
                style={{ borderTop: `3px solid ${accentFor(c.key)}`, opacity: 0.88 }}
              >
                <div className="card-b">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "1.15rem" }}>{c.icon}</span>
                    <h3 style={{ margin: 0, fontSize: ".92rem", color: "var(--text-hi)" }}>{c.title}</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: ".76rem", lineHeight: 1.5, color: "var(--text-dim-solid)", minHeight: "3.2em" }}>
                    {c.blurb}
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>Coming soon</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </>
  );
}
