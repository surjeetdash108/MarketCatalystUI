"use client";

import { useEffect, useState } from "react";
import { useBackendMarketStatus } from "./hooks/useBackendMarketStatus";

const etNow = () => {
  const d = new Date();
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
  };
};

/** "Wed, Nov 18 · 12:26 PM ET" and the session badge — the same pair Money Flow's header shows. */
export function MarketClockBadge() {
  const mkt = useBackendMarketStatus();
  const [now, setNow] = useState(etNow);
  useEffect(() => {
    const id = setInterval(() => setNow(etNow()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div data-testid="market-clock" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="as-clock" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: "var(--text)" }}>
        {now.day} · {now.time} ET
      </span>
      <span
        style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border-strong)", color: mkt.phase === "open" ? "var(--up)" : "var(--text-dim-solid)", borderRadius: 999, padding: "4px 10px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
        {mkt.label}
      </span>
    </div>
  );
}
