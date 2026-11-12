"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "../iq/shell";
import { ProfileMenu } from "../iq/profile-menu";
import { firebaseAuth } from "../firebase";
import { useEntitlements } from "../iq/hooks/useEntitlements";

export default function ReferAFriendPage() {
  const { data: ent } = useEntitlements();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [userUid, setUserUid] = useState<string>("");

  useEffect(() => {
    void firebaseAuth.authStateReady().then(() => {
      const u = firebaseAuth.currentUser;
      if (u) {
        setUserUid(u.uid);
      }
    });
  }, []);

  // Deterministic unique referral code based on UID
  const referralCode = userUid
    ? `MC-${userUid.slice(0, 6).toUpperCase()}25`
    : "MC-INVITE25";

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/checkout?plan=starter&interval=monthly&promo=${referralCode}`
    : `https://app.marketcatalyst.ai/checkout?plan=starter&interval=monthly&promo=${referralCode}`;

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

  const isPaidUser = ent && (ent.planId === "starter" || ent.planId === "pro" || ent.planId === "elite" || ent.subscriptionPlanId);

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
        {!isPaidUser && (
          <div
            style={{
              padding: "14px 20px",
              borderRadius: 12,
              background: "rgba(234, 179, 8, 0.1)",
              border: "1px solid rgba(234, 179, 8, 0.3)",
              color: "#fde047",
              fontSize: ".88rem",
              marginBottom: 24,
            }}
          >
            ⭐ Referral rewards are active for subscribed members. Once you activate a plan, any friend who signs up will grant you both $25 credit!
          </div>
        )}

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
              background: "rgba(16, 185, 129, 0.12)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.3)",
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
            Share your unique referral link with fellow traders or investment partners. When they subscribe to any plan, they get $25 off and you receive a $25 credit automatically deducted from your next month renewal.
          </p>

          {/* Referral Link & Code Box */}
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
                  background: copiedLink ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
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
                Promo code:
              </span>
              <span
                style={{
                  fontSize: ".98rem",
                  fontWeight: 800,
                  color: "#10b981",
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
                  color: copiedCode ? "#10b981" : "rgba(255, 255, 255, 0.7)",
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
        </div>

        {/* 3 Step Breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginTop: 28,
          }}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div style={{ fontSize: "1.6rem", marginBottom: 12 }}>🔗</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
              1. Share your link
            </h3>
            <p style={{ margin: 0, fontSize: ".84rem", color: "rgba(255, 255, 255, 0.55)", lineHeight: 1.5 }}>
              Send your referral link to friends or investment groups. When they click, they land on checkout with your code auto-applied.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div style={{ fontSize: "1.6rem", marginBottom: 12 }}>⚡</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
              2. They get $25 off
            </h3>
            <p style={{ margin: 0, fontSize: ".84rem", color: "rgba(255, 255, 255, 0.55)", lineHeight: 1.5 }}>
              Your friend gets an instant $25 credit on their checkout across Starter, Pro, or Elite plans.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div style={{ fontSize: "1.6rem", marginBottom: 12 }}>💳</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
              3. You pay $25 less
            </h3>
            <p style={{ margin: 0, fontSize: ".84rem", color: "rgba(255, 255, 255, 0.55)", lineHeight: 1.5 }}>
              A $25 credit is placed directly on your Stripe customer balance. If your renewal is $39/mo, you will only pay $14 next month!
            </p>
          </div>
        </div>
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
