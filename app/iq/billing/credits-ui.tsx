"use client";

/**
 * Market Catalyst credits on the payment screens: the opt-in "use my credits"
 * choice (never applied on its own) and the warning shown before a switch that
 * leaves unused value behind (it becomes credits, never a refund).
 */

/** How much of `available` a payment of `charge` would use. */
export function creditsToUse(available: number, charge: number): number {
  return Math.max(0, Math.min(available, charge));
}

export function UseCreditsChoice(props: {
  available: number;
  /** What the credits would come off (today's charge, or the new plan's first charge). */
  charge: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  money: (n: number) => string;
  /** "today" or a date phrase such as "your first Pro payment". */
  appliesTo: string;
}) {
  const { available, charge, checked, onChange, money, appliesTo } = props;
  if (available <= 0 || charge <= 0) return null;
  const use = creditsToUse(available, charge);
  return (
    <label className="co-check" data-testid="use-credits" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <input type="checkbox" data-testid="use-credits-box" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Use my Market Catalyst credits ({money(available)} available).
        {checked ? ` ${money(use)} comes off ${appliesTo}.` : ""}
      </span>
    </label>
  );
}

/** The "are you sure" step when a switch leaves unused value behind. */
export function LeftoverCreditsWarning(props: {
  amount: number;
  money: (n: number) => string;
  onContinue: () => void;
  onBack: () => void;
  busy?: boolean;
}) {
  const { amount, money, onContinue, onBack, busy } = props;
  return (
    <div data-testid="leftover-credits-warning" role="alertdialog" aria-label="Unused value goes to credits" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--warn)", background: "var(--warn-dim)" }}>
      <div style={{ fontWeight: 700, color: "var(--text-hi)" }}>
        {money(amount)} will be added to your Market Catalyst credits
      </div>
      <div style={{ fontSize: ".86rem", lineHeight: 1.5 }}>
        Your current plan has unused time worth more than today&apos;s charge. That difference isn&apos;t refunded: it&apos;s kept as
        Market Catalyst credits. Credits are never used on their own: you can choose to use them to reduce a future payment
        at checkout, when you switch plan, or from Manage Plan.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="co-cta" data-testid="leftover-continue" disabled={busy} onClick={onContinue}>
          {busy ? "Switching…" : "Continue and switch"}
        </button>
        <button className="co-cta" data-testid="leftover-back" disabled={busy} style={{ background: "var(--surface-2)", color: "var(--text)" }} onClick={onBack}>
          Go back
        </button>
      </div>
    </div>
  );
}
