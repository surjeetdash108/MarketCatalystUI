"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "../iq/shell";
import { ManagePlanScreen } from "../iq/screens/manage-plan";
import { ChoosePlanScreen } from "../iq/billing/choose-plan-screen";
import { ProfileMenu } from "../iq/profile-menu";
import { firebaseAuth } from "../firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { parsePlanParams, saveIntent } from "../iq/billing/plan-intent";

export default function ManagePlanPage() {
  const [authState, setAuthState] = useState<{ checked: boolean; user: User | null }>({
    checked: false,
    user: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        // Not logged in!
        // If query parameters have a plan intent (?plan=starter&interval=annual from marketcatalyst.ai),
        // save the intent and send them straight to Step 1 of onboarding: Sign Up.
        if (typeof window !== "undefined") {
          const search = window.location.search;
          const intent = parsePlanParams(search, ["starter", "pro", "elite"]);
          if (intent) {
            saveIntent(intent);
            const promoPart = intent.promoCode ? `&promo=${encodeURIComponent(intent.promoCode)}` : "";
            window.location.replace(`/auth/signup?plan=${encodeURIComponent(intent.planId)}&interval=${intent.interval}${promoPart}`);
            return;
          }
        }
      }
      setAuthState({ checked: true, user });
    });

    return () => unsubscribe();
  }, []);

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
          {authState.user && <ProfileMenu />}
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

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 16px 80px" }}>
        {!authState.checked ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-dim-solid)" }}>
            <div
              style={{
                display: "inline-block",
                width: 28,
                height: 28,
                border: "2px solid rgba(255,255,255,0.15)",
                borderTopColor: "var(--brand, #22c55e)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ marginTop: 16, fontSize: ".9rem" }}>Loading plans &amp; subscription…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : authState.user ? (
          <ManagePlanScreen />
        ) : (
          <div>
            <div
              style={{
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                borderRadius: 12,
                padding: "14px 20px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <span style={{ fontSize: ".88rem", color: "var(--text)" }}>
                Sign in to manage your active subscription or choose a plan below to get started.
              </span>
              <Link
                href="/auth/login?redirect=/manage-plan"
                style={{
                  background: "var(--brand, #22c55e)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: ".82rem",
                  padding: "8px 18px",
                  borderRadius: 99,
                  textDecoration: "none",
                }}
              >
                Sign in
              </Link>
            </div>
            <ChoosePlanScreen />
          </div>
        )}
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

