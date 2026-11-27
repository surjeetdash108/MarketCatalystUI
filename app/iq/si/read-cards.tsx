"use client";

import { useState, type ReactNode } from "react";
import { sentences } from "./read-text";

const NUMBER_RE = /([+\-−–]\d[\d,]*(?:\.\d+)?%)|(\$\d[\d,]*(?:\.\d+)?|\d+(?:\.\d+)?(?:%|×)|\d+\/99|RSI \d+)/g;

/** Signed percentages go green or red; other figures (prices, multiples, ratings) go blue, so the numbers stand out of a sentence. */
export function highlightNumbers(text: string | null | undefined): ReactNode[] {
  return (text ?? "").split(NUMBER_RE).map((part, i) => {
    if (i % 3 === 1 && part) {
      return (
        <span key={i} style={{ color: part.startsWith("+") ? "var(--up, #16a34a)" : "var(--down, #dc2626)", fontWeight: 700 }}>
          {part}
        </span>
      );
    }
    if (i % 3 === 2 && part) {
      return (
        <span key={i} style={{ color: "#4fb3ff", fontWeight: 700 }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

const SIGNED_PCT_RE = /((?<![\w.])[+\-−–]\d[\d,]*(?:\.\d+)?%)/g;

/** Only signed percentages are tinted (green up, red down); the rest of the sentence stays as written. */
export function highlightSignedPercents(text: string | null | undefined): ReactNode[] {
  return (text ?? "").split(SIGNED_PCT_RE).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} style={{ color: part.startsWith("+") ? "var(--up, #16a34a)" : "var(--down, #dc2626)", fontWeight: 700 }}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** Small info button (the design's "i" icon) that shows how a card is calculated on hover, focus or tap. */
export function InfoTip({ lines, align = "left" }: { lines: [string, string][]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", marginLeft: 10, verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="How this is calculated"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid var(--si-accent-light, #a9c6e3)",
          background: "transparent",
          color: "var(--si-accent-light, #a9c6e3)",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          fontSize: 15,
          fontWeight: 600,
          fontStyle: "normal",
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <svg width={10} height={10} viewBox="0 0 12 12" aria-hidden="true" style={{ display: "block" }}>
          <circle cx="7" cy="2.3" r="1.15" fill="currentColor" />
          <path d="M6.5 4.9 L5.3 9.1 Q5.1 10.1 6 10.1 Q6.9 10.1 7.6 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          /* The screen lowercases any element with an inline letter-spacing outside 0.00-0.05em (this one has 0),
             which turned "Trend: Bullish if price is above both the 50 and 200 DMA" into "trend: bullish if ... dma".
             data-tc keeps the text as written. */
          data-tc
          style={{
            position: "absolute",
            top: 26,
            ...(align === "right" ? { right: -8 } : { left: -8 }),
            zIndex: 20,
            width: 300,
            whiteSpace: "normal",
            padding: "12px 14px",
            border: "1px solid var(--si-border-sec, #2e343d)",
            background: "var(--si-card, #14171c)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            letterSpacing: 0,
            textTransform: "none",
            textAlign: "left",
          }}
        >
          {lines.map(([label, body], i) => (
            // An all-capitals label (TREND, MOMENTUM, ...) opens a group of rules: leave a gap above it.
            <span key={label} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, lineHeight: 1.45, color: "var(--si-text-hi, #e8eef4)", marginTop: i > 0 && label === label.toUpperCase() ? 6 : 0 }}>
              <b style={{ color: "var(--si-accent-light, #a9c6e3)" }}>{label}</b> {body}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Overview card: a short plain-English read as bullet sentences, with an OPEN button to the full tab. */
export function ReadCard({ title, text, onOpen, info }: { title: string; text: string; onOpen: () => void; info?: [string, string][] }) {
  return (
    <div
      style={{
        border: "1px solid var(--si-border, #1c2733)",
        background: "var(--si-card, rgba(12, 17, 24, 0.9))",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent, #5980a6)" }}>
          {title}
          {info && <InfoTip lines={info} />}
        </span>
        <button
          type="button"
          onClick={onOpen}
          style={{
            height: 24,
            padding: "0 9px",
            border: "1px solid var(--si-border-sec, #2a3a4a)",
            background: "transparent",
            color: "var(--si-accent-light, #a9c6e3)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.12em",
            cursor: "pointer",
          }}
        >
          OPEN ▸
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sentences(text).map((line, i) => (
          <div key={i} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 500, color: "var(--si-text-hi, #e8eef4)", display: "flex", gap: 10, lineHeight: 1.5 }}>
            <span style={{ color: "var(--si-accent, #1d4ed8)", fontWeight: 700 }}>▸</span>
            <span>{highlightNumbers(line)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
