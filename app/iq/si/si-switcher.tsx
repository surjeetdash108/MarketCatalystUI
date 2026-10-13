"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSI } from "./si-context";

export function SISwitcher({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  const { isSI, enterSI, exitToMC } = useSI();
  const [hoverSide, setHoverSide] = useState<"mc" | "si" | null>(null);

  // Proportional pill geometry for MarketCatalyst (14 chars) vs StockIntelligence (17 chars)
  const tg = isSI
    ? {
        left: "calc(46.5% + 2px)",
        w: "calc(53.5% - 5px)",
        bg: "#5980a6",
        glow: "0 0 18px rgba(127,168,208,0.45)",
        mcFg: "#93a1af",
        siFg: "#ffffff",
      }
    : {
        left: "3px",
        w: "calc(46.5% - 4px)",
        bg: "#4ade80",
        glow: "0 0 18px rgba(74,222,128,0.35)",
        mcFg: "#05210f",
        siFg: "#9aa3a8",
      };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        @keyframes mcSweep {
          0% { transform: translate3d(-100vw, 0, 0); opacity: 0; }
          18% { opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translate3d(100vw, 0, 0); opacity: 0; }
        }
        @keyframes mcLbl {
          0% { opacity: 0; transform: translate3d(0, 10px, 0) scale(0.97); }
          22% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          68% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(0, -8px, 0) scale(1.02); }
        }
        @keyframes mcVeil {
          0% { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
          22% { opacity: 1; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
          68% { opacity: 1; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
          100% { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
        }
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
          title="Switch between MarketCatalyst and StockIntelligence"
          style={{
            position: "relative",
            width: 284,
            height: 34,
            borderRadius: 99,
            border: "1px solid #2a3a4a",
            background: "#0c1118",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
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
                "left 320ms cubic-bezier(.2,.7,.2,1), width 320ms cubic-bezier(.2,.7,.2,1), background 320ms, box-shadow 320ms",
              zIndex: 1,
            }}
          />

          {/* MarketCatalyst Label */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (isSI) exitToMC();
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
              transition: "color 300ms, background 250ms",
              zIndex: 2,
            }}
          >
            MarketCatalyst
          </span>

          {/* StockIntelligence Label */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (!isSI) enterSI();
            }}
            onMouseEnter={() => setHoverSide("si")}
            onMouseLeave={() => setHoverSide(null)}
            style={{
              position: "relative",
              flex: 1.15,
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
              transition: "color 300ms, background 250ms",
              zIndex: 2,
            }}
          >
            StockIntelligence
          </span>
        </div>
      </div>
    </>
  );
}

export function SISweepOverlay() {
  const { sweep } = useSI();
  const [activeSweep, setActiveSweep] = useState<{
    to: "SI" | "MC";
    key: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (sweep) {
      setActiveSweep({ to: sweep.to, key: sweep.key });
      const timer = setTimeout(() => {
        setActiveSweep(null);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [sweep]);

  useEffect(() => {
    const handleStart = (e: Event) => {
      const detail = (e as CustomEvent<{ to: "SI" | "MC"; key: number }>).detail;
      if (detail) {
        setActiveSweep(detail);
        setTimeout(() => {
          setActiveSweep(null);
        }, 600);
      }
    };
    window.addEventListener("mc-sweep-start", handleStart);
    return () => window.removeEventListener("mc-sweep-start", handleStart);
  }, []);

  if (!activeSweep || !mounted || typeof document === "undefined") return null;

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
      {/* Backdrop Veil with Frosted Glass Shield */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            activeSweep.to === "SI"
              ? "rgba(8,11,16,0.95)"
              : "rgba(6,8,9,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          animation: "mcVeil 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
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
          width: "55vw",
          background: `linear-gradient(90deg, transparent 0%, ${
            activeSweep.to === "SI"
              ? "rgba(127,168,208,0.12) 30%, rgba(127,168,208,0.48) 50%, rgba(127,168,208,0.12) 70%"
              : "rgba(74,222,128,0.12) 30%, rgba(74,222,128,0.42) 50%, rgba(74,222,128,0.12) 70%"
          }, transparent 100%)`,
          animation: "mcSweep 600ms cubic-bezier(0.25, 1, 0.5, 1) forwards",
          opacity: 0,
          willChange: "transform, opacity",
          transform: "translate3d(-100vw, 0, 0)",
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
              ? "rgba(169,198,227,0.95)"
              : "rgba(255,255,255,0.95)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          animation: "mcLbl 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
          opacity: 0,
          willChange: "transform, opacity",
        }}
      >
        {activeSweep.to === "SI" ? (
          "STOCK INTELLIGENCE"
        ) : (
          <span>
            Market
            <span style={{ color: "#4ade80" }}>Catalyst</span>
          </span>
        )}
      </div>
    </div>,
    document.body
  );
}

