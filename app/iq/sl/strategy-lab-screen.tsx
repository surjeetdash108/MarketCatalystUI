"use client";

import StrategyLab from "./lab-controller";
import { ModuleSwitcher } from "../module-switcher";
import { useSI } from "../si/si-context";

/**
 * Strategy Lab module (/sl): the prototype's module chrome — title + HOME —
 * with the global MC / SI / Strategy Lab toggle, then the lab itself.
 * Header height matches MC's 44px top bar so the pinned toggle sits centred
 * in it on every module.
 */
export function StrategyLabScreen() {
  const { exitToMC } = useSI();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#08090a", color: "#e6ebe8" }}>
      <style>{`.sl-home:hover{border-color:#c9a24a !important;color:#e6ebe8 !important}`}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "#08090a", borderBottom: "1px solid #171c1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "5px 18px", minHeight: 44, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1, fontFamily: "Manrope, system-ui, sans-serif" }}>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: ".14em", textTransform: "uppercase" }}>Strategy Lab</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".22em", color: "#e0bb5e" }}>BY MARKETCATALYST</div>
            </div>
            <div style={{ width: 1, height: 30, background: "#1e2427" }} />
            <button
              type="button"
              className="sl-home"
              onClick={() => exitToMC()}
              title="Back to Market Catalyst"
              style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "1px solid #263033", color: "#cfd6d3", borderRadius: 8, padding: "7px 12px", fontWeight: 800, fontSize: 11.5, letterSpacing: ".12em", cursor: "pointer", fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
                <path d="M3 11l9-8 9 8v10H3z" />
                <path d="M9 21v-7h6v7" />
              </svg>
              HOME
            </button>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 290 }}>
            <ModuleSwitcher />
          </div>
          <div style={{ flex: "none", width: 204 }} aria-hidden />
        </div>
      </div>
      <StrategyLab />
    </div>
  );
}
