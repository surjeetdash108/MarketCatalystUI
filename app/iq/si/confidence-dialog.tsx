"use client";

import { useEffect } from "react";

/**
 * "How MC Confidence is calculated": opens from the Overview's ring and from any signal-score row.
 * It lists this stock's own category scores, the weights actually applied and the total, from the
 * same engine run the numbers on the Overview come from.
 */
export function ConfidenceDialog({ conf, band, lines, onClose }: { conf: number | null; band: string | null; lines: [string, string][]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(4, 7, 11, 0.66)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How MC Confidence is calculated"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          border: "1px solid var(--si-border-sec, #2e343d)",
          borderRadius: 10,
          background: "var(--si-card-solid, #14171c)",
          boxShadow: "0 22px 56px rgba(0,0,0,0.65)",
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>How MC Confidence is calculated</span>
            {conf != null && (
              <span style={{ fontSize: 16, color: "var(--si-text-mid, #93a1af)" }}>
                {conf} out of 100{band ? ` · ${band}` : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: "1px solid var(--si-border-sec, #2e343d)", background: "transparent", color: "var(--si-text-hi, #e8eef4)", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
          >
            {"×"}
          </button>
        </div>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(120px, auto) 1fr", columnGap: 18, rowGap: 10 }}>
          {lines.map(([label, text]) => (
            <div key={label} style={{ display: "contents" }}>
              <dt style={{ fontSize: 15, fontWeight: 700, color: "var(--si-text-hi, #e8eef4)" }}>{label}</dt>
              <dd style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--si-text-mid, #93a1af)" }}>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
