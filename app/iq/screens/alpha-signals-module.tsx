"use client";

import { ModuleSwitcher } from "../module-switcher";
import { ProfileMenu } from "../profile-menu";
import { useSI } from "../si/si-context";
import { ModuleThemeToggle } from "../theme/theme-toggle";
import { EntitlementGate } from "../entitlement-gate";
import { AlphaSignals } from "./alpha-signals";

/**
 * Alpha Signals module (/alpha-signals): module chrome — title + HOME — with
 * the global module toggle, then the screen. The plan gate sits inside the
 * chrome so a locked or trial account still has the header and the toggle.
 * Header height matches MC's 44px top bar so the pinned toggle sits centred.
 */
export function AlphaSignalsModule() {
  const { exitToMC } = useSI();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      <style>{`.as-home:hover{border-color:#8b7cf6 !important;color:var(--text-hi) !important}@media (max-width:640px){.as-hdr-right{position:absolute;top:10px;right:14px;width:auto !important}}`}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "5px 18px", minHeight: 44, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1, fontFamily: "Manrope, system-ui, sans-serif" }}>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-hi)" }}>Alpha Signals</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".22em", color: "#b3a8ff" }}>BY MARKETCATALYST</div>
            </div>
            <div style={{ width: 1, height: 30, background: "var(--border)" }} />
            <button
              type="button"
              className="as-home"
              onClick={() => exitToMC()}
              title="Back to Market Catalyst"
              style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "1px solid var(--border-strong)", color: "var(--text)", borderRadius: 8, padding: "7px 12px", fontWeight: 800, fontSize: 11.5, letterSpacing: ".12em", cursor: "pointer", fontFamily: "Manrope, system-ui, sans-serif" }}
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
          <div className="as-hdr-right" style={{ flex: "none", width: 204, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
            <ModuleThemeToggle />
            <ProfileMenu />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, width: "100%", maxWidth: 1600, margin: "0 auto", padding: "16px 18px 40px", boxSizing: "border-box", minWidth: 0 }}>
        <EntitlementGate slug="alpha-signals">
          <AlphaSignals />
        </EntitlementGate>
      </div>
    </div>
  );
}
