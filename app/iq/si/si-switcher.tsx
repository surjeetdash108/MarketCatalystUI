"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useSI, useActiveSwitch, SWITCH_MS, type ActiveSwitch } from "./si-context";

export function SISwitcher({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  const { isSI, enterSI, exitToMC } = useSI();
  const [hoverSide, setHoverSide] = useState<"mc" | "si" | null>(null);

  // Proportional pill geometry for "Market Catalyst" vs "Stock Intelligence"
  const tg = isSI
    ? {
        left: "calc(47% + 2px)",
        w: "calc(53% - 5px)",
        bg: "#5980a6",
        glow: "0 0 18px rgba(127,168,208,0.45)",
        mcFg: "var(--si-text-dim, #93a1af)",
        siFg: "#ffffff",
      }
    : {
        left: "3px",
        w: "calc(47% - 4px)",
        bg: "#4ade80",
        glow: "0 0 18px rgba(74,222,128,0.35)",
        mcFg: "#05210f",
        siFg: "var(--si-text-dim, #9aa3a8)",
      };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
      `}</style>

      {/* Switcher Pill Container */}
      <div
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 900,
          pointerEvents: "auto",
          ...style,
        }}
      >
        <div
          role="group"
          title="Switch between Market Catalyst and Stock Intelligence"
          style={{
            position: "relative",
            width: 296,
            height: 34,
            borderRadius: 99,
            border: "1px solid var(--si-border-sec, #2a3a4a)",
            background: "var(--si-card-solid, #0c1118)",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            boxShadow: "var(--si-shadow, 0 4px 16px rgba(0,0,0,0.5))",
            userSelect: "none",
          }}
        >
          {/* Sliding Indicator Pill */}
          <span
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: tg.left,
              width: tg.w,
              borderRadius: 99,
              background: tg.bg,
              boxShadow: tg.glow,
              transition:
                "left 280ms cubic-bezier(.2,.7,.2,1), width 280ms cubic-bezier(.2,.7,.2,1), background 280ms, box-shadow 280ms",
              zIndex: 1,
            }}
          />

          {/* Market Catalyst Label */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              exitToMC();
            }}
            onMouseEnter={() => setHoverSide("mc")}
            onMouseLeave={() => setHoverSide(null)}
            style={{
              position: "relative",
              flex: 1,
              alignSelf: "stretch",
              margin: "3px 0 3px 3px",
              borderRadius: 99,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Manrope', -apple-system, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: tg.mcFg,
              background:
                hoverSide === "mc" && isSI
                  ? "rgba(74,222,128,0.18)"
                  : "transparent",
              cursor: isSI ? "pointer" : "default",
              transition: "color 260ms, background 220ms",
              zIndex: 2,
            }}
          >
            Market Catalyst
          </span>

          {/* Stock Intelligence Label */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              enterSI();
            }}
            onMouseEnter={() => setHoverSide("si")}
            onMouseLeave={() => setHoverSide(null)}
            style={{
              position: "relative",
              flex: 1.14,
              alignSelf: "stretch",
              margin: "3px 3px 3px 0",
              borderRadius: 99,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Manrope', -apple-system, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: tg.siFg,
              background:
                hoverSide === "si" && !isSI
                  ? "rgba(89,128,166,0.25)"
                  : "transparent",
              cursor: !isSI ? "pointer" : "default",
              transition: "color 260ms, background 220ms",
              zIndex: 2,
            }}
          >
            Stock Intelligence
          </span>
        </div>
      </div>
    </>
  );
}

const SWEEP_KEYFRAMES = `
        /* MC <-> SI switch: SWITCH_MS total. The veil is opaque by ~27%
           (when the route changes behind it); the label fades in, holds, and
           fades out before the veil lifts. */
        @keyframes mcSweep {
          0% { transform: translate3d(-60vw, 0, 0); opacity: 0; }
          15% { opacity: 0.9; }
          75% { opacity: 0.9; }
          100% { transform: translate3d(60vw, 0, 0); opacity: 0; }
        }
        @keyframes mcLbl {
          0%, 14% { opacity: 0; }
          34% { opacity: 1; }
          66% { opacity: 1; }
          84%, 100% { opacity: 0; }
        }
        @keyframes mcVeil {
          0% { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
          26% { opacity: 1; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
          76% { opacity: 1; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
          100% { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
        }
`;

export function SISweepOverlay() {
  // useActiveSwitch's server snapshot is null, so this never renders during
  // SSR/hydration — no separate "mounted" flag needed for the portal.
  const sw = useActiveSwitch();
  if (!sw || typeof document === "undefined") return null;
  // Keyed by the switch so a remounted shell resumes the same run.
  return <SweepLayer key={sw.key} sw={sw} />;
}

function SweepLayer({ sw }: { sw: ActiveSwitch }) {
  // The route change remounts the whole shell mid-transition; a negative delay
  // resumes the animation at the right point instead of restarting it.
  const [elapsed] = useState(() => Math.min(SWITCH_MS, Math.max(0, Date.now() - sw.startedAt)));
  const activeSweep = sw;
  const anim = (name: string) =>
    `${name} ${SWITCH_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) -${elapsed}ms forwards`;

  return createPortal(
    <div
      key={activeSweep.key}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 999999,
      }}
    >
      <style>{SWEEP_KEYFRAMES}</style>
      {/* Backdrop Veil with Frosted Glass Shield */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            activeSweep.to === "SI"
              ? "rgba(8,11,16,0.92)"
              : "rgba(6,8,9,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          animation: anim("mcVeil"),
          opacity: 0,
          willChange: "opacity, backdrop-filter",
        }}
      />

      {/* Sweeping Light Wave Beam */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "50vw",
          background: `linear-gradient(90deg, transparent 0%, ${
            activeSweep.to === "SI"
              ? "rgba(127,168,208,0.12) 30%, rgba(127,168,208,0.48) 50%, rgba(127,168,208,0.12) 70%"
              : "rgba(74,222,128,0.12) 30%, rgba(74,222,128,0.42) 50%, rgba(74,222,128,0.12) 70%"
          }, transparent 100%)`,
          animation: anim("mcSweep"),
          opacity: 0,
          willChange: "transform, opacity",
          transform: "translate3d(-60vw, 0, 0)",
        }}
      />

      {/* Centered Target Label */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "44%",
          transform: "translateY(-50%)",
          textAlign: "center",
          fontFamily:
            activeSweep.to === "SI"
              ? "'Barlow Condensed', sans-serif"
              : "'Manrope', sans-serif",
          fontSize: activeSweep.to === "SI" ? 34 : 38,
          fontWeight: activeSweep.to === "SI" ? 700 : 800,
          letterSpacing: activeSweep.to === "SI" ? "0.22em" : "-0.02em",
          color:
            activeSweep.to === "SI"
              ? "rgba(169,198,227,0.96)"
              : "rgba(255,255,255,0.96)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          animation: anim("mcLbl"),
          opacity: 0,
          willChange: "transform, opacity",
        }}
      >
        {activeSweep.to === "SI" ? (
          "STOCK INTELLIGENCE"
        ) : (
          <span>
            Market&nbsp;
            <span style={{ color: "#4ade80" }}>Catalyst</span>
          </span>
        )}
      </div>
    </div>,
    document.body
  );
}

