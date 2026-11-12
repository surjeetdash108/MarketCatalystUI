"use client";

import { useEffect } from "react";

export default function ReferralRedirectPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || params.get("promo") || params.get("ref");
    const plan = params.get("plan") || "starter";
    const interval = params.get("interval") || "monthly";

    const target = code
      ? `/checkout?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval)}&promo=${encodeURIComponent(code)}`
      : `/checkout?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval)}`;

    window.location.replace(target);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#08090a",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚡</div>
        <p style={{ color: "#8a96a3", fontSize: ".9rem" }}>Applying your referral discount and loading checkout…</p>
      </div>
    </div>
  );
}

