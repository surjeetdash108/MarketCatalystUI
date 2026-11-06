"use client";

import StrategyLab from "./lab-controller";
import { ModuleSwitcher } from "../module-switcher";
import { useSI } from "../si/si-context";
import { ModuleThemeToggle } from "../theme/theme-toggle";

/**
 * Strategy Lab module (/sl): the prototype's module chrome — title + HOME —
 * with the global MC / SI / Strategy Lab toggle, then the lab itself.
 * Header height matches MC's 44px top bar so the pinned toggle sits centred
 * in it on every module.
 */
export function StrategyLabScreen() {
  const { exitToMC } = useSI();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--th-08090a)", color: "var(--th-e6ebe8)" }}>
      <style>{`.sl-home:hover{border-color:var(--th-c9a24a) !important;color:var(--th-e6ebe8) !important}@media (max-width:640px){.sl-hdr-right{position:absolute;top:10px;right:14px;width:auto !important}}`}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--th-08090a)", borderBottom: "1px solid var(--th-171c1e)" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "5px 18px", minHeight: 44, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1, fontFamily: "Manrope, system-ui, sans-serif" }}>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: ".14em", textTransform: "uppercase" }}>Strategy Lab</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".22em", color: "var(--th-e0bb5e)" }}>BY MARKETCATALYST</div>
            </div>
            <div style={{ width: 1, height: 30, background: "var(--th-1e2427)" }} />
            <button
              type="button"
              className="sl-home"
              onClick={() => exitToMC()}
              title="Back to Market Catalyst"
              style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "1px solid var(--th-263033)", color: "var(--th-cfd6d3)", borderRadius: 8, padding: "7px 12px", fontWeight: 800, fontSize: 11.5, letterSpacing: ".12em", cursor: "pointer", fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              <svg style={{ fill: "none", stroke: "currentColor" }} width={13} height={13} viewBox="0 0 24 24" strokeWidth={1.7} strokeLinejoin="round">
                <path d="M3 11l9-8 9 8v10H3z" />
                <path d="M9 21v-7h6v7" />
              </svg>
              HOME
            </button>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 290 }}>
            <ModuleSwitcher />
          </div>
          {/* Right: the theme switch (204px balances the title block so the toggle stays centred; top-right on a phone). */}
          <div className="sl-hdr-right" style={{ flex: "none", width: 204, display: "flex", justifyContent: "flex-end" }}>
            <ModuleThemeToggle />
          </div>
        </div>
      </div>
      <StrategyLab />
    </div>
  );
}
