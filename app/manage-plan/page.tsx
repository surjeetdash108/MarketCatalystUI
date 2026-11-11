"use client";

import Link from "next/link";
import { BrandLogo } from "../iq/shell";
import { ManagePlanScreen } from "../iq/screens/manage-plan";

export default function ManagePlanPage() {
  return (
    <div
      className="iq-root"
      data-theme="dark"
      style={{
        minHeight: "100vh",
        background: "var(--bg, #08090a)",
        color: "var(--text, #f0f4f8)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(10, 14, 18, 0.85)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-dim-solid, #8a96a3)",
            fontSize: ".86rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <span>←</span> Back to Dashboard
        </Link>
        <BrandLogo height={26} />
        <Link
          href="/dashboard"
          aria-label="Close"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-dim-solid, #8a96a3)",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            textDecoration: "none",
            fontSize: ".88rem",
          }}
        >
          ✕
        </Link>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 16px 64px" }}>
        <ManagePlanScreen />
      </main>
    </div>
  );
}
