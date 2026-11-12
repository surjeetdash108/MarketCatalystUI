"use client";

import { ReactNode, useEffect } from "react";
import { useAppSelector } from "../store/hooks";
import { firebaseAuth } from "../firebase";

export function AuthGuard({ children }: Readonly<{ children: ReactNode }>) {
  const { user, status } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (status === "ready" && !user) {
      const search = typeof window !== "undefined" ? window.location.search : "";
      window.location.href = search ? `/auth/signup${search}` : "/auth/login";
      return;
    }
    // Unverified email/password accounts MUST verify their email before accessing the product.
    // Google sign-in accounts arrive with emailVerified: true automatically.
    const fbUser = firebaseAuth.currentUser;
    if (
      status === "ready" &&
      fbUser &&
      !fbUser.emailVerified &&
      fbUser.providerData?.some((p) => p.providerId === "password")
    ) {
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      if (currentPath !== "/verify-email" && !currentPath.startsWith("/auth/")) {
        const next = currentPath && currentPath !== "/" ? `?next=${encodeURIComponent(currentPath)}` : "";
        window.location.href = `/verify-email${next}`;
      }
    }
  }, [status, user]);

  if (status === "loading") {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "transparent",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16,
      }}>
        <style>{`
          @keyframes iq-spin { to { transform: rotate(360deg); } }
          @keyframes iq-fade { 0%,100%{opacity:.4} 50%{opacity:1} }
        `}</style>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2px solid #14181B",
          borderTopColor: "#4ADE80",
          animation: "iq-spin 0.75s linear infinite",
        }} />
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "0.6875rem", letterSpacing: "0.14em",
          textTransform: "uppercase", fontWeight: 600,
          color: "#6C747C",
          animation: "iq-fade 1.6s ease-in-out infinite",
        }}>
          MarketCatalyst
        </div>
      </div>
    );
  }

  if (!user) return null;

  return children;
}
