"use client";

import { ReactNode, useEffect } from "react";
import { useAppSelector } from "../store/hooks";

export function AuthGuard({ children }: Readonly<{ children: ReactNode }>) {
  const { user, status } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (status === "ready" && !user) {
      window.location.href = "/auth/login";
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
          border: "2px solid #1B2433",
          borderTopColor: "#7C6CF5",
          animation: "iq-spin 0.75s linear infinite",
        }} />
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "0.6875rem", letterSpacing: "0.14em",
          textTransform: "uppercase", fontWeight: 600,
          color: "#697486",
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
