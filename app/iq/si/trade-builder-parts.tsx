"use client";

import { useEffect } from "react";
import { CATS_T, DN, STEEL, UP, thesisWeights } from "./data";

/** The one-sentence explanations under the three Trade Builder steps, and what happens after a run. */
const STEP_HELP: [string, string, string][] = [
  [
    "01",
    "Direction",
    "Bullish builds a long trade, bearish a short. A bearish run flips every driver score, so a high number always means the evidence backs the side you picked.",
  ],
  [
    "02",
    "Horizon",
    "How long you expect to hold, from 1 to 9 months. The horizon decides which drivers matter most: short trades lean on price action and catalysts, long trades on the business and its valuation.",
  ],
  [
    "03",
    "Mode",
    "Normal uses the engine's own weights, fixed. Advanced lets you drag each weight and set your own price target, so you can test your view against the engine's.",
  ],
];

const AFTER_RUN: [string, string][] = [
  ["What you do", "Review your score, target and invalidation, adjust them in Advanced mode, then save."],
  ["Where it is saved", "In the Trade Tracker, as a row in the Tracked Trades list on the left."],
  ["View, change or delete", "Click a row to view it, Edit in Trade Builder to change it, Delete to remove it."],
];

/** Below the three steps: what each step means (the step still to do is brightest), and what happens after Run. */
export function TradeBuilderGuide({ done }: { done: boolean[] }) {
  const current = done.findIndex((d) => !d);
  return (
    <div style={{ maxWidth: 780, width: "100%", margin: "0 auto 40px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {STEP_HELP.map(([num, title, body], i) => (
          <div key={num} style={{ padding: "4px 2px", opacity: done[i] ? 0.4 : i === current ? 1 : 0.75, transition: "opacity 220ms ease" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "var(--si-accent, #5980a6)" }}>{num}</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.1em", color: "var(--si-text-hi, #ffffff)" }}>{title.toUpperCase()}</span>
            </div>
            <div style={{ height: 1, background: "var(--si-border, #1c2733)", margin: "8px 0" }} />
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-hi, #ffffff)", opacity: 0.85, lineHeight: 1.55 }}>{body}</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 18 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-accent, #5980a6)" }}>
          AFTER YOU RUN THE STRATEGY
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 12 }}>
          {AFTER_RUN.map(([title, body]) => (
            <div key={title}>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--si-text-hi, #ffffff)" }}>{title}</div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "var(--si-text-hi, #ffffff)", opacity: 0.85, lineHeight: 1.55, marginTop: 4 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type BreakdownDriver = { name: string; val: unknown; ev: number };
export type BreakdownCategory = { k: string; label: string; w: number; score: number; pts: number; ds: BreakdownDriver[] };

/** Score breakdown: one row per weighted category (weight x score = points); a row opens to its drivers. */
export function ConfidenceBreakdown({
  cats,
  colorFor,
  open,
  onToggle,
}: {
  cats: BreakdownCategory[];
  colorFor: (score: number) => string;
  open: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const rows = cats.filter((c) => c.ds.length > 0 && c.w > 0);
  const num = { textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 } as const;
  const head = { textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--si-text-hi, #ffffff)", opacity: 0.7 } as const;
  const grid = "minmax(0,1fr) 58px 52px 58px 14px";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--si-border, #1c2733)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--si-accent-light, #a9c6e3)" }}>SCORE BREAKDOWN</span>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--si-text-hi, #ffffff)", opacity: 0.75 }}>
          weight × score = points · points add up to the trade confidence · click a row for its drivers
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-hi, #ffffff)" }}>No driver has data yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10, padding: "2px 0 6px" }}>
            <span style={{ ...head, textAlign: "left" }}>DRIVER</span>
            <span style={head}>WEIGHT</span>
            <span style={head}>SCORE</span>
            <span style={head}>POINTS</span>
            <span />
          </div>
          {rows.map((c) => (
            <div key={c.k} style={{ borderBottom: "1px solid #141d27" }}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={!!open[c.k]}
                onClick={() => onToggle(c.k)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(c.k);
                  }
                }}
                style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", gap: 10, padding: "24px 0", cursor: "pointer" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--si-text-hi, #ffffff)" }}>{c.label}</div>
                  <div style={{ height: 4, background: "#1c2733", marginTop: 5 }}>
                    <div style={{ height: 4, width: `${Math.max(0, Math.min(100, c.score))}%`, background: colorFor(c.score) }} />
                  </div>
                </div>
                <span style={{ ...num, color: "var(--si-text-hi, #ffffff)" }}>{Math.round(c.w)}%</span>
                <span style={{ ...num, color: colorFor(c.score) }}>{Math.round(c.score)}</span>
                <span style={{ ...num, color: "var(--si-text-hi, #ffffff)" }}>{c.pts.toFixed(1)}</span>
                <span style={{ transform: open[c.k] ? "rotate(180deg)" : "none", transition: "transform 200ms", color: "var(--si-accent, #5980a6)", fontSize: 12 }}>▼</span>
              </div>
              {open[c.k] && (
                <div style={{ display: "flex", flexDirection: "column", margin: "2px 0 8px 0", borderLeft: "1px solid var(--si-border-sec, #2a3a4a)", paddingLeft: 12 }}>
                  {c.ds.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--si-text-hi, #ffffff)" }}>{d.name}</div>
                        {d.val != null && String(d.val) !== "" && (
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--si-text-hi, #ffffff)", opacity: 0.7, marginTop: 1 }}>{String(d.val)}</div>
                        )}
                      </div>
                      <div style={{ width: "clamp(36px,18%,90px)", flex: "none", height: 4, background: "#1c2733" }}>
                        <div style={{ height: 4, width: `${Math.max(0, Math.min(100, d.ev))}%`, background: colorFor(d.ev) }} />
                      </div>
                      <span style={{ width: 26, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: colorFor(d.ev) }}>{Math.round(d.ev)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SCORE_BANDS: [string, string, string, string][] = [
  ["75 – 100", "HIGH CONVICTION", UP, "Most categories line up behind the trade. The engine sees a strong case for this direction over the horizon."],
  ["60 – 74", "CONSTRUCTIVE", STEEL, "The weight of evidence supports the trade, with a few weaker spots. A workable setup, not a standout."],
  ["45 – 59", "MIXED", "#f5b031", "Evidence is split between for and against. No clear edge, so size small or wait for more confirmation."],
  ["0 – 44", "WEAK", DN, "More evidence is against the trade than for it. The engine does not back this direction at this horizon."],
];

/** Dialog that walks through how the trade confidence is built, using this run's own numbers. */
export function ConfidenceExplainer({
  cats,
  conf,
  hz,
  bull,
  custom,
  onClose,
}: {
  cats: BreakdownCategory[];
  conf: number | null;
  hz: string;
  bull: boolean;
  custom: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const top = cats.filter((c) => c.ds.length > 0 && c.w > 0).sort((a, b) => b.pts - a.pts)[0];
  const body = { fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--si-text-hi, #ffffff)", lineHeight: 1.55 } as const;
  const step = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--si-accent-light, #a9c6e3)", marginTop: 4 } as const;
  const th = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--si-text-hi, #ffffff)", opacity: 0.7, textAlign: "right", padding: "3px 0" } as const;
  const shownHz = hz === "12M" ? "9M" : hz;
  const dir = bull ? "Bull" : "Bear";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 7, 11, 0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How the trade confidence is calculated"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          border: "1px solid var(--si-border-sec, #2a3a4a)",
          background: "var(--si-card, #0c1118)",
          boxShadow: "0 22px 56px rgba(0,0,0,0.65), 0 0 0 1px rgba(127,168,208,0.12)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--si-accent-light, #a9c6e3)" }}>
            HOW THE TRADE CONFIDENCE IS CALCULATED
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 26, height: 26, border: "1px solid var(--si-border-sec, #2a3a4a)", background: "transparent", color: "var(--si-text-hi, #ffffff)", fontSize: 16, lineHeight: 1, cursor: "pointer", flex: "none" }}>
            ×
          </button>
        </div>

        <div style={step}>1 · EACH DRIVER GETS A SCORE</div>
        <div style={body}>
          Every driver (revenue growth, trend vs moving averages, forward P/E and so on) is scored 0–100 from its own data. 50 is neutral, higher supports a long. For a bearish trade each score is flipped (100 − score), so a high number always means &quot;supports this trade&quot;.
        </div>

        <div style={step}>2 · DRIVERS ROLL UP INTO 7 CATEGORIES</div>
        <div style={body}>A category&apos;s score is the plain average of its drivers. Click a row in the Score Breakdown to see them.</div>

        <div style={step}>3 · ENGINE WEIGHTS</div>
        <div style={body}>
          The weights say how much each category matters, and they depend on the horizon: short trades lean on price action and catalysts, long trades on the business and valuation. They always add up to 100%.
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 380 }}>
            <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", gap: 4 }}>
              <span style={{ ...th, textAlign: "left" }}>HORIZON</span>
              {CATS_T.map(([k]) => (
                <span key={k} style={th}>{k}</span>
              ))}
            </div>
            {["1M", "3M", "6M", "9M"].map((h) => {
              const w = thesisWeights(dir, h);
              const mine = h === shownHz;
              return (
                <div key={h} style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", gap: 4, padding: "3px 0", borderTop: "1px solid #141d27", background: mine ? "rgba(89,128,166,0.16)" : "transparent" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: mine ? "var(--si-accent-light, #a9c6e3)" : "#ffffff" }}>{h}</span>
                  {CATS_T.map(([k]) => (
                    <span key={k} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: mine ? 700 : 500, color: "var(--si-text-hi, #ffffff)", textAlign: "right" }}>{w[k]}%</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ ...body, fontSize: 12, opacity: 0.8 }}>
          Showing {bull ? "bullish" : "bearish"} weights; your {shownHz} row is highlighted. A bearish trade moves 5 points each from Business and Technical to Valuation and Macro. If a category has no data it is left out and the rest are rescaled to 100%.
          {custom ? " You are using custom weights from Advanced mode, rescaled to 100%." : ""}
        </div>

        <div style={step}>4 · POINTS AND CONFIDENCE</div>
        <div style={body}>
          Points = weight × score ÷ 100.
          {top ? ` For example ${top.label}: ${Math.round(top.w)}% × ${Math.round(top.score)} = ${top.pts.toFixed(1)} points.` : ""} The points of all categories added together are the trade confidence
          {conf != null ? ` (${conf} here)` : ""}.
        </div>

        <div style={step}>5 · WHAT THE SCORE MEANS</div>
        <div style={body}>The label on the confidence box comes from the score alone:</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {SCORE_BANDS.map(([range, label, color, text]) => {
            const now =
              conf != null &&
              ((label === "HIGH CONVICTION" && conf >= 75) ||
                (label === "CONSTRUCTIVE" && conf >= 60 && conf < 75) ||
                (label === "MIXED" && conf >= 45 && conf < 60) ||
                (label === "WEAK" && conf < 45));
            return (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "74px 150px minmax(0,1fr)", gap: 12, alignItems: "baseline", padding: "7px 8px", borderTop: "1px solid #141d27", background: now ? "rgba(89,128,166,0.16)" : "transparent" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "var(--si-text-hi, #ffffff)" }}>{range}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: "0.08em", color }}>
                  {label}
                  {now ? " ◄ now" : ""}
                </span>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: "var(--si-text-hi, #ffffff)", opacity: 0.85, lineHeight: 1.45 }}>{text}</span>
              </div>
            );
          })}
        </div>

        <div style={step}>6 · WHAT THE SCORE CHANGES IN THE PLAN</div>
        <div style={body}>
          At a score of 50 the target and invalidation sit at their measured levels. A higher score reaches further for the target (up to 1.4× the distance) and gives the stop a little more room (up to 1.2×); a lower score pulls both in (down to 0.6× and 0.8×). In Trade Tracker a score under 45 marks the trade At risk and under 30 Invalidated.
        </div>
      </div>
    </div>
  );
}
