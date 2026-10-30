"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { useSI, type AppModule } from "./si/si-context";

/** Pill colours per module (active segment background / label). */
const ACTIVE: Record<AppModule, { bg: string; fg: string; glow: string; hover: string }> = {
  MC: { bg: "#4ade80", fg: "#05210f", glow: "0 0 18px rgba(74,222,128,0.35)", hover: "rgba(74,222,128,0.18)" },
  SI: { bg: "#5980a6", fg: "#ffffff", glow: "0 0 18px rgba(127,168,208,0.45)", hover: "rgba(89,128,166,0.25)" },
  SL: { bg: "#c9a24a", fg: "#08090a", glow: "0 0 18px rgba(201,162,74,0.40)", hover: "rgba(201,162,74,0.22)" },
  MF: { bg: "#e0bb5e", fg: "#08090a", glow: "0 0 18px rgba(224,187,94,0.40)", hover: "rgba(224,187,94,0.22)" },
};
const SEGMENTS: Array<[AppModule, string]> = [
  ["MC", "Market Catalyst"],
  ["SI", "Stock Intelligence"],
  ["SL", "Strategy Lab"],
  ["MF", "Money Flow"],
];

/** Toggle width (530px for MC + SI + SL + MF). */
const WIDTH = 530;
/** From this viewport width the toggle is pinned to one spot on every module. */
const PIN_MIN = 1024;

/*
 * One fixed spot for the toggle on MC, SI and Money Flow: top-centre of the
 * viewport, vertically centred in MC's 48px top bar. Each page still renders
 * the toggle in its own slot; on wide screens it is lifted out of flow to the
 * same place, and the two left-side search boxes are capped so they end before
 * it. Narrower screens keep the in-bar slot (there is not room to pin it
 * without covering MC's or SI's search).
 */
const PIN_CSS = `
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
  const [hover, setHover] = useState<AppModule | null>(null);
  const refs = useRef<Record<AppModule, HTMLSpanElement | null>>({ MC: null, SI: null, SL: null, MF: null });
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  // Slide the indicator under the active segment (segments are sized by label).
  useLayoutEffect(() => {
    const update = () => {
      const el = refs.current[activeModule];
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeModule]);

  const go = (m: AppModule) => {
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
            const isNew = m === "SL";
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
                  color: on ? a.fg : "var(--si-text-dim, #9aa3a8)",
                  background: hover === m && !on ? ACTIVE[m].hover : "transparent",
                  cursor: on ? "default" : "pointer",
                  transition: "color 260ms, background 220ms",
                  zIndex: 2,
                }}
              >
                <span>{label}</span>
                {isNew && !on && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: ".06em",
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "rgba(201,162,74,.2)",
                      color: "#f0d68c",
                      lineHeight: 1.2,
                    }}
                  >
                    NEW
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}
