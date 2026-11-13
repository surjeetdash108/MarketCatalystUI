"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "../iq/shell";
import { ProfileMenu } from "../iq/profile-menu";
import { firebaseAuth } from "../firebase";
import { apiGet } from "../iq/backend";
import { referralLinkFor } from "../iq/billing/referral";
import { ReferralSteps } from "./referral-steps";

export default function ReferAFriendPage() {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  // The code comes from the server, only for members with an active plan
  // (GET /api/billing/referral). It is random — never derived from the uid.
  const [ref, setRef] = useState<{ state: "loading" } | { state: "ready"; code: string } | { state: "none" }>({ state: "loading" });

  useEffect(() => {
    let live = true;
    void firebaseAuth.authStateReady().then(async () => {
      if (!firebaseAuth.currentUser) return live && setRef({ state: "none" });
      try {
        const r = await apiGet<{ eligible: boolean; code?: string }>("/api/billing/referral");
        if (live) setRef(r.eligible && r.code ? { state: "ready", code: r.code } : { state: "none" });
      } catch {
        if (live) setRef({ state: "none" });
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const referralCode = ref.state === "ready" ? ref.code : "";
  const referralLink = referralLinkFor(
    typeof window !== "undefined" ? window.location.origin : "https://app.marketcatalyst.ai",
    referralCode,
  );

  const copyToClipboard = async (text: string, isCode: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isCode) {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      /* fallback */
    }
  };


  return (
    <div
      className="iq-root manage-plan-page"
      data-theme="dark"
      style={{
        minHeight: "100vh",
        height: "auto",
        maxHeight: "none",
        overflowY: "auto",
        overflowX: "hidden",
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

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 16px 80px" }}>

        {/* Hero Card */}
        <div
          style={{
            borderRadius: 16,
            background: "rgba(255, 255, 255, 0.025)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "36px 32px",
            textAlign: "center",
            backdropFilter: "blur(16px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "5px 16px",
              borderRadius: 99,
              background: "var(--brand-dim, rgba(74, 222, 128, 0.12))",
              color: "var(--brand, #4ADE80)",
              border: "1px solid var(--brand-line, rgba(74, 222, 128, 0.3))",
              fontSize: ".78rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
            }}
          >
            🎁 Exclusive Member Benefit
          </div>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "2.1rem",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            Refer a Friend. Give $25, Get $25.
          </h1>

          <p
            style={{
              margin: "0 auto 32px",
              maxWidth: 580,
              fontSize: ".96rem",
              color: "rgba(255, 255, 255, 0.65)",
              lineHeight: 1.6,
            }}
          >
            Share your referral link with fellow traders. When a friend signs up with it and their first payment goes through, you each get $25 account credit, used automatically on your next bill.
          </p>

          {ref.state === "ready" ? (
            <div
              style={{
                maxWidth: 620,
                margin: "0 auto 28px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Share Link */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  background: "rgba(0, 0, 0, 0.45)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 12,
                  padding: "6px 8px 6px 16px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: ".82rem",
                    color: "rgba(255, 255, 255, 0.7)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    textAlign: "left",
                    fontFamily: "monospace",
                  }}
                >
                  {referralLink}
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(referralLink, false)}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    background: copiedLink ? "var(--brand, #4ADE80)" : "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: copiedLink ? "var(--on-brand, #07080A)" : "#ffffff",
                    fontSize: ".82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedLink ? "✓ Copied!" : "Copy Link"}
                </button>
              </div>
  
              {/* Promo Code Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  margin: "0 auto",
                  padding: "8px 18px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px dashed rgba(255, 255, 255, 0.2)",
                }}
              >
                <span style={{ fontSize: ".82rem", color: "rgba(255, 255, 255, 0.6)" }}>
                  Referral code:
                </span>
                <span
                  style={{
                    fontSize: ".98rem",
                    fontWeight: 800,
                    color: "var(--brand, #4ADE80)",
                    fontFamily: "monospace",
                    letterSpacing: "0.08em",
                  }}
                >
                  {referralCode}
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(referralCode, true)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "transparent",
                    border: "none",
                    color: copiedCode ? "var(--brand, #4ADE80)" : "rgba(255, 255, 255, 0.7)",
                    fontSize: ".78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>
          ) : (
            <div data-testid="referral-not-eligible" style={{ maxWidth: 620, margin: "0 auto 28px", padding: "16px 20px", borderRadius: 12, background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", color: "#fde047", fontSize: ".9rem" }}>
              {ref.state === "loading" ? "Loading your referral link…" : (
                <>
                  Referral links are for members with an active plan.{" "}
                  <Link href="/manage-plan" style={{ color: "#fde047", textDecoration: "underline" }}>Choose a plan</Link> to get your link.
                </>
              )}
            </div>
          )}
        </div>

        <ReferralSteps />
      </main>

      <style jsx global>{`
        html:has(.manage-plan-page),
        body:has(.manage-plan-page) {
          height: auto !important;
          min-height: 100% !important;
          overflow-y: auto !important;
        }
        .iq-root.manage-plan-page {
          min-height: 100vh !important;
          min-height: 100dvh !important;
          height: auto !important;
          max-height: none !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
      `}</style>
    </div>
  );
}
