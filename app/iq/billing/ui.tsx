"use client";

import type { CSSProperties, ReactNode } from "react";

/** Small shared pieces for billing screens, in the app's existing visual language. */
export const pill = (active: boolean): CSSProperties => ({
  padding: "6px 14px", borderRadius: 99, fontSize: ".78rem", fontWeight: 600, cursor: "pointer",
  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
  background: active ? "var(--brand-dim)" : "var(--surface-2)",
  color: active ? "var(--brand-2)" : "var(--text)",
});

export function Button({ children, onClick, kind = "primary", disabled, testId, style }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean; testId?: string; style?: CSSProperties }) {
  const base: CSSProperties = {
    padding: "9px 18px", borderRadius: 99, fontSize: ".82rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1, border: "1px solid transparent", fontFamily: "var(--f-body)",
  };
  const kinds: Record<string, CSSProperties> = {
    primary: { background: "var(--brand)", color: "#fff" },
    secondary: { background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)" },
    danger: { background: "var(--surface-2)", color: "var(--down)", borderColor: "var(--down)" },
  };
  return (
    <button type="button" data-testid={testId} disabled={disabled} onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}>
      {children}
    </button>
  );
}

export function Notice({ tone = "info", children, testId }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode; testId?: string }) {
  const colors: Record<string, string> = { info: "var(--brand)", warn: "var(--warn)", error: "var(--down)", ok: "var(--up)" };
  return (
    <div data-testid={testId} role={tone === "error" ? "alert" : "status"} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${colors[tone]}`, background: "var(--surface-2)", color: "var(--text)", fontSize: ".82rem", lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose, testId }: { title: string; children: ReactNode; onClose?: () => void; testId?: string }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} data-testid={testId} style={{ height: "fit-content", maxHeight: "min(560px,90vh)", maxWidth: 520 }}>
        <div className="drawer-h">
          <div style={{ flex: 1, fontWeight: 700, fontSize: "1.05rem", color: "var(--text-hi)" }}>{title}</div>
          {onClose && <button className="closebtn" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="drawer-b" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      </div>
    </>
  );
}

export const TEST_MODE_BANNER = "TEST MODE — simulated by the fake billing provider. No real card is charged.";
