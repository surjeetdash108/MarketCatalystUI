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

/** Small "i" button that shows how a card is calculated on hover, focus or tap. */
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
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid var(--si-accent-light, #a9c6e3)",
          background: "transparent",
          color: "var(--si-accent-light, #a9c6e3)",
          fontFamily: "'Manrope', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          fontStyle: "italic",
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
        }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: 26,
            ...(align === "right" ? { right: -8 } : { left: -8 }),
            zIndex: 20,
            width: 300,
            whiteSpace: "normal",
            padding: "12px 14px",
            border: "1px solid var(--si-border-sec, #2a3a4a)",
            background: "var(--si-card, #0c1118)",
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
