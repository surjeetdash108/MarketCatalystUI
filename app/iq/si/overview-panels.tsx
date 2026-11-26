"use client";

import type { ReactNode } from "react";
import { highlightNumbers } from "./read-cards";

/**
 * The panels that open beside the Overview's left menu (Fundamentals, Technicals, Why it moved,
 * Why it could move). Each is a short read; none links away to a full tab, as in the design.
 */

const MUTED = "var(--si-text-mid, #93a1af)";
const HI = "var(--si-text-hi, #e8eef4)";
const UP = "var(--ov-up, #5ee08a)";
const DN = "var(--ov-dn, #f07a7a)";

export function PanelCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--si-border, #232830)",
        borderRadius: 8,
        background: "var(--si-card, rgba(20, 23, 28, 0.9))",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>{children}</div>
    </div>
  );
}

const lead = (text: string) => <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: HI }}>{highlightNumbers(text)}</p>;

export type ReadRow = { title: string; value: string; tone: "good" | "bad" | "warn" | "neutral"; note?: string };

const rowColor = (tone: ReadRow["tone"]) => (tone === "good" ? UP : tone === "bad" ? DN : tone === "warn" ? "var(--ov-warn, #e6b94f)" : MUTED);

/** A one-sentence read, then the facts behind it (title, value, and a note under them). */
export function ReadPanel({ text, rows }: { text: string; rows?: ReadRow[] }) {
  return (
    <PanelCard>
      {lead(text)}
      {rows && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r) => (
            <div
              key={r.title}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 10, alignItems: "baseline", padding: "9px 0", borderTop: "1px solid var(--si-border, #232830)" }}
            >
              <span style={{ fontSize: 15.5, fontWeight: 600, color: HI }}>{r.title}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: rowColor(r.tone), whiteSpace: "pre" }}>{r.value}</span>
              {r.note && <span style={{ gridColumn: "1 / 3", fontSize: 14, lineHeight: 1.45, color: MUTED, marginTop: 2 }}>{r.note}</span>}
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

const move = (pct: number) => `${pct >= 0 ? "▲" : "▼"} ${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`;

/** The last five sessions: the move, then what the daily bars and headlines say about it. */
export function MovedPanel({ pct, text, bullets }: { pct: number | null; text: string; bullets: ReactNode[] }) {
  return (
    <PanelCard>
      <div style={{ border: "1px solid var(--si-border, #232830)", borderRadius: 6, background: "var(--si-card-sec, #0f1216)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: MUTED }} data-caps>
          LAST 5 SESSIONS
        </span>
        <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: pct == null ? MUTED : pct >= 0 ? UP : DN }}>{pct == null ? "—" : move(pct)}</span>
      </div>
      {lead(text)}
      {bullets.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.5, color: HI }}>
              <span style={{ color: "var(--si-accent, #5980a6)", fontWeight: 700 }}>{"▸"}</span>
              <span>{typeof b === "string" ? highlightNumbers(b) : b}</span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

export type NextEvent = { date: string; days: string; n: string; txt?: string };
type Check = [string, string];

function CheckColumn({ title, color, glyph, items }: { title: string; color: string; glyph: string; items: Check[] }) {
  return (
    <div style={{ border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, borderRadius: 8, background: "var(--si-card-sec, #0f1216)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>
        {glyph} {title}
      </span>
      {items.length === 0 ? (
        <span style={{ fontSize: 15, color: MUTED }}>Nothing stands out yet.</span>
      ) : (
        items.map(([name, detail]) => (
          <div key={name} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: HI }}>{name}</span>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: MUTED }}>{highlightNumbers(detail)}</span>
          </div>
        ))
      )}
    </div>
  );
}

/** The next dated event, then what would push the stock up and what would pull it down. */
export function CouldPanel({ next, up, down }: { next: NextEvent | null; up: Check[]; down: Check[] }) {
  return (
    <PanelCard>
      {next ? (
        <div style={{ border: "1px solid var(--si-border, #232830)", borderRadius: 6, background: "var(--si-card-sec, #0f1216)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12.5, letterSpacing: "0.1em", color: MUTED }} data-caps>
            NEXT EVENT {"·"} {next.date} {"·"} {next.days}
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, color: HI }}>{next.n}</span>
          {next.txt && <span style={{ fontSize: 15.5, lineHeight: 1.45, color: MUTED }}>{next.txt}</span>}
        </div>
      ) : (
        <div style={{ fontSize: 16, color: MUTED }}>No dated event on the calendar yet.</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, alignItems: "stretch" }}>
        <CheckColumn title="What could push it up" color={UP} glyph={"▲"} items={up} />
        <CheckColumn title="What could pull it down" color={DN} glyph={"▼"} items={down} />
      </div>
    </PanelCard>
  );
}
