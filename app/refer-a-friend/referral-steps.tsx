import type { ReactNode } from "react";

/** The three "how it works" cards on Refer a Friend. */
export const REFERRAL_STEPS: Array<{
  step: number;
  icon: "link" | "gift" | "card";
  title: string;
  highlight?: string;
  body: string;
  footnote?: string;
}> = [
  {
    step: 1,
    icon: "link",
    title: "Share your link",
    body: "Send it to friends. Your code is applied automatically when they sign up.",
  },
  {
    step: 2,
    icon: "gift",
    title: "They get ",
    highlight: "$25 credit",
    body: "After their first payment for Starter, Pro or Elite, $25 comes off their next bill.",
    footnote: "New customers only.",
  },
  {
    step: 3,
    icon: "card",
    title: "You get ",
    highlight: "$25 credit",
    body: "Once their first paid charge goes through (after any free trial), $25 comes off your next bill.",
  },
];

const GREEN = "#4ade80";

function Icon({ name }: { name: "link" | "gift" | "card" }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: GREEN, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "link")
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    );
  if (name === "gift")
    return (
      <svg {...common}>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13" />
        <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h4" />
    </svg>
  );
}

function StepCard({ s }: { s: (typeof REFERRAL_STEPS)[number] }): ReactNode {
  return (
    <div
      data-testid={`referral-step-${s.step}`}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "26px 24px",
        borderRadius: 22,
        background: "#14181d",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        minHeight: 260,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(74, 222, 128, 0.12)", display: "grid", placeItems: "center" }}>
          <Icon name={s.icon} />
        </div>
        <span style={{ fontSize: ".78rem", fontWeight: 700, letterSpacing: ".14em", color: "rgba(255, 255, 255, 0.55)" }}>STEP {s.step}</span>
      </div>
      <h3 style={{ margin: "0 0 14px", fontSize: "1.3rem", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>
        {s.title}
        {s.highlight && <span style={{ color: GREEN }}>{s.highlight}</span>}
      </h3>
      <p style={{ margin: 0, fontSize: ".92rem", color: "rgba(255, 255, 255, 0.62)", lineHeight: 1.6 }}>{s.body}</p>
      {s.footnote && (
        <p style={{ margin: "auto 0 0", paddingTop: 20, fontSize: ".8rem", color: "rgba(255, 255, 255, 0.5)" }}>{s.footnote}</p>
      )}
    </div>
  );
}

export function ReferralSteps() {
  return (
    <div
      data-testid="referral-steps"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 28 }}
    >
      {REFERRAL_STEPS.map((s) => (
        <StepCard key={s.step} s={s} />
      ))}
    </div>
  );
}
