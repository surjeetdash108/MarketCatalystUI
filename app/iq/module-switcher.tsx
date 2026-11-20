"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSI, type AppModule } from "./si/si-context";
import { useEntitlements, gateDecisionFor, hiddenInTrial, type Entitlements } from "./hooks/useEntitlements";
import { plansHref } from "./entitlement-gate";

/** Pill colours per module (active segment background / label). */
const ACTIVE: Record<AppModule, { bg: string; fg: string; glow: string; hover: string }> = {
  MC: { bg: "#4ade80", fg: "#05210f", glow: "0 0 18px rgba(74,222,128,0.35)", hover: "rgba(74,222,128,0.18)" },
  SI: { bg: "#5980a6", fg: "#ffffff", glow: "0 0 18px rgba(127,168,208,0.45)", hover: "rgba(89,128,166,0.25)" },
  SL: { bg: "#c9a24a", fg: "#08090a", glow: "0 0 18px rgba(201,162,74,0.40)", hover: "rgba(201,162,74,0.22)" },
  MF: { bg: "#e0bb5e", fg: "#08090a", glow: "0 0 18px rgba(224,187,94,0.40)", hover: "rgba(224,187,94,0.22)" },
  AS: { bg: "#8b7cf6", fg: "#ffffff", glow: "0 0 18px rgba(139,124,246,0.45)", hover: "rgba(139,124,246,0.22)" },
};

/**
 * Module order:
 * Starter — MC, SI
 * Pro     — MC, SI, MF
 * Elite   — MC, SI, MF, Alpha Signals, SL (Alpha Signals is not shown during
 *           the free trial or the new-account intro)
 */
const SEGMENTS: Array<[AppModule, string]> = [
  ["MC", "Market Catalyst"],
  ["SI", "Stock Intelligence"],
  ["MF", "Money Flow"],
  ["AS", "Alpha Signals"],
  ["SL", "Strategy Lab"],
];

/** Entitlement key behind each paid module (Market Catalyst and Stock Intelligence are always open). */
const MODULE_KEY: Partial<Record<AppModule, string>> = { MF: "moneyFlow", SL: "strategyLab", AS: "alphaSignals" };

/** Paid modules with their upgrade pop-up copy. */
type PaidModule = "MF" | "SL" | "AS";
const UPGRADE: Record<PaidModule, { badge: string; name: string; color: string; tint: string; line: string; text: string; plan: string }> = {
  MF: { badge: "Pro or Elite Feature", name: "Money Flow", color: "#e0bb5e", tint: "rgba(224,187,94,0.18)", line: "rgba(224,187,94,0.35)", plan: "pro",
    text: "See where institutional money is moving, by sector, with the biggest institutional gainers and losers." },
  SL: { badge: "Elite Feature", name: "Strategy Lab", color: "#c9a24a", tint: "rgba(201,162,74,0.18)", line: "rgba(201,162,74,0.35)", plan: "elite",
    text: "Build or pick a strategy, backtest it, and get entry, stop and target levels." },
  AS: { badge: "Elite Feature", name: "Alpha Signals", color: "#8b7cf6", tint: "rgba(139,124,246,0.18)", line: "rgba(139,124,246,0.35)", plan: "elite",
    text: "Intraday and swing setups, bullish and bearish, each with an entry, stop and target." },
};

/**
 * Whether a module's segment is on the toggle at all. Alpha Signals is left
 * out while entitlements load and for a trial or intro account (it isn't
 * revealed during the trial); every other module is always listed.
 */
export function showsModule(module: AppModule, ent: Entitlements | null | undefined): boolean {
  if (module !== "AS") return true;
  if (!ent) return false;
  return !hiddenInTrial(ent, "alphaSignals");
}

/**
 * Whether the signed-in user may open a module. Decided by the backend's
 * entitlements (the same answer every gate uses), never by the plan name —
 * so the new-account intro, paid trials and staff all follow the server.
 * Unknown entitlements (still loading) count as locked for paid modules.
 */
export function canAccessModule(module: AppModule, ent: Entitlements | null | undefined): boolean {
  const key = MODULE_KEY[module];
  if (!key) return true;
  if (!ent) return false;
  return gateDecisionFor(ent, key).kind === "allow";
}

/** Toggle width: 530px for MC + SI + MF + SL, 650px with Alpha Signals. */
const WIDTH = 530;
const WIDTH_AS = 650;
/**
 * The toggle is pinned to the exact centre of the window only when there is room on both sides of
 * it: the logo, HOME and a search icon on the left (about 430px) and the action buttons on the right
 * (about 430px with "Watching" and the profile menu). Narrower than that, a centred toggle runs over
 * HOME, the search box and the buttons, so it stays in the header's own flow instead, where the
 * buttons wrap to a second row and the toggle takes the free space and scrolls if it still doesn't fit.
 */
const PIN_SIDES = 860;

const pinCss = (width: number) => `
.mod-switch-pin { min-width: 0; max-width: 100%; }
.mod-switch-pin [role="group"]::-webkit-scrollbar{display:none}
/* Not pinned: the search box gives way to a search icon before it crowds the toggle. */
@media (max-width: ${width + PIN_SIDES - 1}px) {
  div.si-nav-search.si-nav-search { flex: 0 1 220px !important; min-width: 40px !important; }
}
.si-nav-search > div:first-child { overflow: hidden; box-sizing: border-box; transition: width 120ms ease; cursor: text; }
.si-nav-search input { min-width: 0; }
.si-nav-search:hover > div:first-child,
.si-nav-search:focus-within > div:first-child { width: 220px; position: relative; z-index: 960; }
.si-nav-search:focus-within > div:nth-child(2) { right: auto !important; width: 220px; z-index: 961 !important; }
@media (min-width: ${width + PIN_SIDES}px) {
  .si-main-scroll .mod-switch-pin,
  .sl-main-scroll .mod-switch-pin,
  .mf-main-scroll .mod-switch-pin,
  .as-main-scroll .mod-switch-pin {
    position: fixed !important;
    top: 7px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 950;
  }
  /* The search sits left of the pinned toggle. When the window is too narrow for the
     full box it shrinks to a search icon (down to 40px) instead of running underneath
     the toggle, and opens to its full 220px over the toggle while hovered or focused.
     The doubled class beats the inline-style rule that lives later in the document. */
  div.si-nav-search.si-nav-search { width: clamp(40px, calc(50vw - ${width / 2 + 12 + 378}px), 220px) !important; }
}
.app .subbar .mod-switch-pin {
  position: static !important;
  transform: none !important;
  top: auto !important;
  left: auto !important;
}
`;

export function ModuleSwitcher({ style }: { style?: React.CSSProperties }) {
  const { activeModule, enterSI, exitToMC, enterSL, enterMF, enterAS } = useSI();
  const { data: entitlements } = useEntitlements();
  const [hover, setHover] = useState<AppModule | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<PaidModule | null>(null);
  const segments = SEGMENTS.filter(([m]) => showsModule(m, entitlements) || m === activeModule);
  const width = segments.some(([m]) => m === "AS") ? WIDTH_AS : WIDTH;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const refs = useRef<Record<AppModule, HTMLSpanElement | null>>({ MC: null, SI: null, SL: null, MF: null, AS: null });
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
    // The segments are sized by their labels, so they move when the web font arrives and when the
    // lock icons appear or go (entitlements load after first paint): measure again each time, or the
    // pill is left at the old spot and no longer lines up with its label.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    for (const el of Object.values(refs.current)) if (el) ro?.observe(el);
    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) update();
      });
    }
    return () => {
      cancelled = true;
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [activeModule, segments.length]);

  const go = (m: AppModule) => {
    // Plan not known yet (first load): don't show an upgrade pop-up for a
    // module the account may well have; the screen's own gate decides.
    if (!entitlements && MODULE_KEY[m]) {
      if (m === "MF") enterMF();
      else if (m === "AS") enterAS();
      else if (m === "SL") enterSL();
      return;
    }
    if (!canAccessModule(m, entitlements)) {
      if (m === "MF" || m === "SL" || m === "AS") setUpgradeModal(m);
      return;
    }
    if (m === activeModule) return;
    if (m === "MC") exitToMC();
    else if (m === "SI") enterSI();
    else if (m === "MF") enterMF();
    else if (m === "AS") enterAS();
    else enterSL();
  };
  const a = ACTIVE[activeModule];

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');${pinCss(width)}`}</style>
      <div className="mod-switch-pin" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 900, pointerEvents: "auto", ...style }}>
        <div
          role="group"
          aria-label="Switch module"
          style={{
            position: "relative",
            width,
            maxWidth: "min(100%, calc(100vw - 20px))",
            minWidth: 0,
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
          {segments.map(([m, label], i) => {
            const on = m === activeModule;
            // No lock until the plan is known: a lock that vanishes a second
            // later (staff, Elite) reads as a glitch.
            const locked = !!entitlements && !canAccessModule(m, entitlements);
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
                  margin: i === 0 ? "3px 0 3px 3px" : i === segments.length - 1 ? "3px 3px 3px 0" : "3px 0",
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
                {locked && <span style={{ fontSize: "10px", opacity: 0.65, marginLeft: 2 }} title="Switch plan to unlock">🔒</span>}
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
                  background: UPGRADE[upgradeModal].tint,
                  color: UPGRADE[upgradeModal].color,
                  border: `1px solid ${UPGRADE[upgradeModal].line}`,
                }}
              >
                {UPGRADE[upgradeModal].badge}
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

            <h2 style={{ margin: "0 0 10px", fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.35 }} data-testid="module-upgrade-title">
              <>What&apos;s inside <span style={{ color: UPGRADE[upgradeModal].color }}>{UPGRADE[upgradeModal].name}</span></>
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: ".88rem", color: "#9aa3a8", lineHeight: 1.55 }}>
              {UPGRADE[upgradeModal].text}
            </p>
            <div style={{ margin: "0 0 18px", fontSize: ".82rem", color: "var(--brand, #4ade80)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span>✓</span> Cancel anytime (no questions asked)
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href={plansHref(UPGRADE[upgradeModal].plan)}
                onClick={() => setUpgradeModal(null)}
                data-testid="module-see-plans"
                style={{ display: "flex", justifyContent: "center", alignItems: "center", textDecoration: "none", padding: "12px 18px", borderRadius: 10, background: "#22c55e", color: "#05210f", fontWeight: 800, fontSize: ".9rem" }}
              >
                See the plans
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
