"use client";

import Link from "next/link";
import { BrandLogo } from "../../iq/shell";
import { ProfileMenu } from "../../iq/profile-menu";
import { BillingSuccess } from "../../iq/billing/billing-pages";

export default function BillingSuccessPage() {
  return (
    <div
      className="iq-root manage-plan-page"
      data-theme="dark"
      style={{
        minHeight: "100vh",
        height: "auto",
        overflowY: "auto",
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ProfileMenu />
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
        </div>
      </header>

      <main style={{ padding: "32px 16px 80px" }}>
        <BillingSuccess />
      </main>
    </div>
  );
}
