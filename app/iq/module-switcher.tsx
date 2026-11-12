"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSI, type AppModule } from "./si/si-context";
import { useEntitlements, effectivePlanId } from "./hooks/useEntitlements";

/** Pill colours per module (active segment background / label). */
const ACTIVE: Record<AppModule, { bg: string; fg: string; glow: string; hover: string }> = {
  MC: { bg: "#4ade80", fg: "#05210f", glow: "0 0 18px rgba(74,222,128,0.35)", hover: "rgba(74,222,128,0.18)" },
  SI: { bg: "#5980a6", fg: "#ffffff", glow: "0 0 18px rgba(127,168,208,0.45)", hover: "rgba(89,128,166,0.25)" },
  SL: { bg: "#c9a24a", fg: "#08090a", glow: "0 0 18px rgba(201,162,74,0.40)", hover: "rgba(201,162,74,0.22)" },
  MF: { bg: "#e0bb5e", fg: "#08090a", glow: "0 0 18px rgba(224,187,94,0.40)", hover: "rgba(224,187,94,0.22)" },
};

/**
 * Module order:
 * Starter — MC, SI
 * Pro     — MC, SI, MF
 * Elite   — MC, SI, MF, SL
 */
const SEGMENTS: Array<[AppModule, string]> = [
  ["MC", "Market Catalyst"],
  ["SI", "Stock Intelligence"],
  ["MF", "Money Flow"],
  ["SL", "Strategy Lab"],
];

export function canAccessModule(module: AppModule, plan: string): boolean {
  if (module === "MC" || module === "SI") return true;
  if (plan === "staff" || plan === "elite") return true;
  if (plan === "pro") return module === "MF";
  return false;
}

/** Toggle width (530px for MC + SI + MF + SL). */
const WIDTH = 530;
/** From this viewport width the toggle is pinned to one spot on every module. */
const PIN_MIN = 1024;

const PIN_CSS = `
.mod-switch-pin [role="group"]::-webkit-scrollbar{display:none}
@media (min-width: ${PIN_MIN}px) {
  .si-main-scroll .mod-switch-pin,
  .sl-main-scroll .mod-switch-pin,
  .mf-main-scroll .mod-switch-pin {
    position: fixed !important;
    top: 7px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 950;
  }
  .si-nav-search { width: clamp(150px, calc(50vw - ${WIDTH / 2 + 12 + 378}px), 220px) !important; }
}
.app .subbar .mod-switch-pin {
  position: static !important;
  transform: none !important;
  top: auto !important;
  left: auto !important;
}
`;

export function ModuleSwitcher({ style }: { style?: React.CSSProperties }) {
  const { activeModule, enterSI, exitToMC, enterSL, enterMF } = useSI();
  const { data: entitlements } = useEntitlements();
  const plan = effectivePlanId(entitlements);
  const [hover, setHover] = useState<AppModule | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<"MF" | "SL" | null>(null);
  const [modalInterval, setModalInterval] = useState<"monthly" | "annual">("annual");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const refs = useRef<Record<AppModule, HTMLSpanElement | null>>({ MC: null, SI: null, SL: null, MF: null });
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  // Slide the indicator under the active segment (segments are sized by label).
  useLayoutEffect(() => {
    const update = () => {
      const el = refs.current[activeModule];
      if (!el) return;
      setBox({ left: el.offsetLeft, width: el.offsetWidth });
      // On a phone narrower than the four labels the pill scrolls: keep the active one in view.
      const g = el.parentElement;
      if (g && g.scrollWidth > g.clientWidth) g.scrollLeft = el.offsetLeft - (g.clientWidth - el.offsetWidth) / 2;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeModule]);

  const go = (m: AppModule) => {
    if (!canAccessModule(m, plan)) {
      setUpgradeModal(m === "MF" ? "MF" : "SL");
      return;
    }
    if (m === activeModule) return;
    if (m === "MC") exitToMC();
    else if (m === "SI") enterSI();
    else if (m === "MF") enterMF();
    else enterSL();
  };
  const a = ACTIVE[activeModule];

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');${PIN_CSS}`}</style>
      <div className="mod-switch-pin" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 900, pointerEvents: "auto", ...style }}>
        <div
          role="group"
          aria-label="Switch module"
          style={{
            position: "relative",
            width: WIDTH,
            maxWidth: "calc(100vw - 20px)",
            height: 34,
            borderRadius: 99,
            border: "1px solid var(--si-border-sec, #2a3a4a)",
            background: "var(--si-card-solid, #0c1118)",
            display: "flex",
            alignItems: "center",
            boxShadow: "var(--si-shadow, 0 4px 16px rgba(0,0,0,0.5))",
            userSelect: "none",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {box && (
            <span
              style={{
                position: "absolute",
                top: 3,
                bottom: 3,
                left: box.left,
                width: box.width,
                borderRadius: 99,
                background: a.bg,
                boxShadow: a.glow,
                transition: "left 280ms cubic-bezier(.2,.7,.2,1), width 280ms cubic-bezier(.2,.7,.2,1), background 280ms, box-shadow 280ms",
                zIndex: 1,
              }}
            />
          )}
          {SEGMENTS.map(([m, label], i) => {
            const on = m === activeModule;
            const locked = !canAccessModule(m, plan);
            return (
              <span
                key={m}
                ref={(el) => { refs.current[m] = el; }}
                role="button"
                aria-pressed={on}
                tabIndex={on ? -1 : 0}
                onClick={(e) => { e.stopPropagation(); go(m); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(m); } }}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
                style={{
                  position: "relative",
                  flex: "1 1 auto",
                  alignSelf: "stretch",
                  margin: i === 0 ? "3px 0 3px 3px" : i === SEGMENTS.length - 1 ? "3px 3px 3px 0" : "3px 0",
                  padding: "0 clamp(8px, 2.5vw, 14px)",
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  fontFamily: "'Manrope', -apple-system, sans-serif",
                  fontSize: "clamp(11px, 2.8vw, 12px)",
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  color: on ? a.fg : locked ? "var(--si-text-dim, #717d84)" : "var(--si-text-dim, #9aa3a8)",
                  background: hover === m && !on ? ACTIVE[m].hover : "transparent",
                  cursor: on ? "default" : "pointer",
                  transition: "color 260ms, background 220ms",
                  zIndex: 2,
                }}
              >
                <span>{label}</span>
                {locked && <span style={{ fontSize: "10px", opacity: 0.65, marginLeft: 2 }} title="Upgrade required">🔒</span>}
              </span>
            );
          })}
        </div>
      </div>

      {mounted && upgradeModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            onClick={() => setUpgradeModal(null)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "relative",
              width: 440,
              maxWidth: "calc(100vw - 32px)",
              background: "#0e141d",
              border: "1px solid #283749",
              borderRadius: 16,
              padding: "26px 24px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
              zIndex: 10001,
              fontFamily: "'Manrope', -apple-system, sans-serif",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontSize: ".72rem",
                  fontWeight: 800,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  background: upgradeModal === "MF" ? "rgba(224,187,94,0.18)" : "rgba(201,162,74,0.18)",
                  color: upgradeModal === "MF" ? "#e0bb5e" : "#c9a24a",
                  border: upgradeModal === "MF" ? "1px solid rgba(224,187,94,0.35)" : "1px solid rgba(201,162,74,0.35)",
                }}
              >
                {upgradeModal === "MF" ? "Pro or Elite Feature" : "Elite Feature"}
              </span>
              <button
                onClick={() => setUpgradeModal(null)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9aa3a8",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ margin: "0 0 14px", fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.35 }}>
              {upgradeModal === "MF"
                ? "Upgrade to Pro or Elite for Money Flow"
                : "Upgrade to Elite for Strategy Lab"}
            </h2>

            {/* Monthly / Annual Toggle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div
                style={{
                  display: "inline-flex",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 99,
                  padding: 3,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalInterval("monthly")}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 99,
                    border: "none",
                    fontSize: ".75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: modalInterval === "monthly" ? "var(--brand, #22c55e)" : "transparent",
                    color: modalInterval === "monthly" ? "#000" : "var(--text-dim-solid, #8a96a3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setModalInterval("annual")}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 99,
                    border: "none",
                    fontSize: ".75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: modalInterval === "annual" ? "var(--brand, #22c55e)" : "transparent",
                    color: modalInterval === "annual" ? "#000" : "var(--text-dim-solid, #8a96a3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  Annual <span style={{ opacity: 0.8, fontSize: ".68rem" }}>· Save 20%</span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upgradeModal === "MF" ? (
                <>
                  <Link
                    href={`/checkout?plan=pro&interval=${modalInterval}`}
                    onClick={() => setUpgradeModal(null)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textDecoration: "none",
                      padding: "12px 18px",
                      borderRadius: 10,
                      background: "#22c55e",
                      color: "#05210f",
                      fontWeight: 800,
                      fontSize: ".9rem",
                    }}
                  >
                    <span>Upgrade to Pro</span>
                    <span style={{ fontSize: ".82rem", fontWeight: 700, opacity: 0.9 }}>
                      {modalInterval === "annual" ? "$566.40/yr ($47.20/mo)" : "$59/mo"}
                    </span>
                  </Link>
                  <Link
                    href={`/checkout?plan=elite&interval=${modalInterval}`}
                    onClick={() => setUpgradeModal(null)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textDecoration: "none",
                      padding: "12px 18px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.16)",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: ".9rem",
                    }}
                  >
                    <span>Upgrade to Elite</span>
                    <span style={{ fontSize: ".82rem", fontWeight: 600, color: "#9aa3a8" }}>
                      {modalInterval === "annual" ? "$1,791/yr ($149.25/mo)" : "$199/mo"}
                    </span>
                  </Link>
                </>
              ) : (
                <Link
                  href={`/checkout?plan=elite&interval=${modalInterval}`}
                  onClick={() => setUpgradeModal(null)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    textDecoration: "none",
                    padding: "12px 18px",
                    borderRadius: 10,
                    background: "#c9a24a",
                    color: "#08090a",
                    fontWeight: 800,
                    fontSize: ".9rem",
                  }}
                >
                  <span>Upgrade to Elite</span>
                  <span style={{ fontSize: ".82rem", fontWeight: 700, opacity: 0.9 }}>
                    {modalInterval === "annual" ? "$1,791/yr ($149.25/mo)" : "$199/mo"}
                  </span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setUpgradeModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6b7785",
                  padding: "8px",
                  fontSize: ".82rem",
                  cursor: "pointer",
                  textAlign: "center",
                  marginTop: 2,
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
