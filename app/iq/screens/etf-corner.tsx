"use client";

import { useState } from "react";
import { hashStr } from "../utils";
import { THEMES } from "../sector-filter";

/**
 * ETF Corner — visual placeholder only, no backend wiring (unlike AI Corner's
 * ai-infrastructure.tsx, there is no matching ETF endpoint yet). Categories
 * mirror the app-wide Sector filter (sector-filter.ts): the SIC-derived economic
 * sectors plus the curated theme baskets, so these tiles use the same category
 * names as the Sector dropdown elsewhere — not live data, so no fund counts or
 * tickers are shown on the tiles.
 */
const SECTOR_NAMES = [
  "Commercial Services", "Communications", "Consumer Durables", "Consumer Non-Durables",
  "Consumer Services", "Distribution Services", "Electronic Technology", "Energy Minerals",
  "Finance", "Health Services", "Health Technology", "Industrial Services",
  "Non-Energy Minerals", "Process Industries", "Producer Manufacturing", "Retail Trade",
  "Technology Services", "Transportation", "Utilities",
];

const SECTOR_ICONS: Record<string, string> = {
  "Commercial Services": "🧾",
  "Communications": "📡",
  "Consumer Durables": "🛋️",
  "Consumer Non-Durables": "🧴",
  "Consumer Services": "🛎️",
  "Distribution Services": "📦",
  "Electronic Technology": "💻",
  "Energy Minerals": "🛢️",
  "Finance": "🏦",
  "Health Services": "🏥",
  "Health Technology": "💊",
  "Industrial Services": "🏗️",
  "Non-Energy Minerals": "⛏️",
  "Process Industries": "🧪",
  "Producer Manufacturing": "🏭",
  "Retail Trade": "🛒",
  "Technology Services": "🖥️",
  "Transportation": "🚚",
  "Utilities": "💡",
};

const SECTOR_BLURBS: Record<string, string> = {
  "Commercial Services": "Business services, staffing and outsourcing funds.",
  "Communications": "Telecom carriers, satellite and communications-equipment funds.",
  "Consumer Durables": "Home goods, appliances and durable consumer-product makers.",
  "Consumer Non-Durables": "Food, beverage, household and personal-care staples.",
  "Consumer Services": "Restaurants, leisure, hospitality and consumer-facing services.",
  "Distribution Services": "Wholesalers, logistics and distribution-network operators.",
  "Electronic Technology": "Computing, networking and electronic-component manufacturers.",
  "Energy Minerals": "Oil, gas and coal exploration and production funds.",
  "Finance": "Banks, insurers, asset managers and diversified financials.",
  "Health Services": "Hospitals, providers and healthcare-delivery networks.",
  "Health Technology": "Pharma, biotech and medical-device innovators.",
  "Industrial Services": "Engineering, construction and industrial-support providers.",
  "Non-Energy Minerals": "Metals, mining and materials-extraction companies.",
  "Process Industries": "Chemicals, paper and industrial-process manufacturers.",
  "Producer Manufacturing": "Machinery, equipment and industrial-goods producers.",
  "Retail Trade": "Department stores, e-commerce and specialty retailers.",
  "Technology Services": "Software, IT services and enterprise-technology providers.",
  "Transportation": "Airlines, rail, shipping and freight-transport funds.",
  "Utilities": "Electric, gas and water utility income funds.",
};

const THEME_ICONS: Record<string, string> = {
  mag7: "🚀",
  ai: "🤖",
  software: "☁️",
  internet: "🌐",
  consumer: "🛍️",
  fintech: "💳",
  hardware: "⚙️",
  value: "💎",
};

const ETF_CATEGORIES = [
  ...SECTOR_NAMES.map(name => ({
    key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    icon: SECTOR_ICONS[name],
    title: name,
    blurb: SECTOR_BLURBS[name],
  })),
  ...THEMES.map(t => ({
    key: t.id,
    icon: THEME_ICONS[t.id] ?? "⭐",
    title: t.name,
    blurb: t.desc,
  })),
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
