"use client";

import type { ReactNode } from "react";
import type { CheckoutPreview } from "../api";
import { formatMoney, type BillingInterval, type CatalogPlan } from "../catalog";
import { REFUND_POLICY } from "../refund-policy.generated";
import { cadence } from "./model";

/** Turns "Terms of Use" / "Privacy Policy" in the consent sentence into links (opening the legal modal). */
export function ConsentText({ text, onOpen }: { text: string; onOpen: (doc: "terms" | "privacy") => void }) {
  const parts: ReactNode[] = [];
  let rest = text;
  for (const [label, doc] of [["Terms of Use", "terms"], ["Privacy Policy", "privacy"]] as const) {
    const i = rest.indexOf(label);
    if (i < 0) continue;
    parts.push(
      rest.slice(0, i),
      <a key={label} href={`#${doc}`} data-testid={`consent-${doc}`} onClick={(e) => { e.preventDefault(); onOpen(doc); }}>{label}</a>,
    );
    rest = rest.slice(i + label.length);
  }
  parts.push(rest);
  return <>{parts}</>;
}

/** "November 19, 2026" */
function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "November 20, 2026 at 3:00 PM" in the buyer's own time zone (trials end to the hour). */
export function trialEnd(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

/** The free-trial box, shown above the card number field. */
export function TrialBox({ trial }: { trial: { days: number; endsAt: string } | null | undefined }) {
  if (!trial) return null;
  return (
    <div className="co-box" data-testid="trial-box" style={{ background: "rgba(34, 197, 94, 0.08)", borderColor: "rgba(34, 197, 94, 0.25)", marginBottom: 14 }}>
      <h4 style={{ color: "var(--brand-2)" }}>🎁 {trial.days} {trial.days === 1 ? "day" : "days"} free</h4>
      Cancel for free before <b>{trialEnd(trial.endsAt)}</b>.
    </div>
  );
}

/**
 * The order summary on the payment page. Everything comes from the server's
 * preview: the price, discount and tax of the first charge; whether there is a
 * free trial, when it ends, what is due today and when the first charge is.
 */
export function SummaryCard(props: {
  plan: CatalogPlan;
  interval: BillingInterval;
  step: 1 | 2;
  preview: CheckoutPreview | null;
  promoSlot?: ReactNode;
  consentSlot?: ReactNode;
  action: ReactNode;
}) {
  const { plan, interval, step, preview } = props;
  const price = plan.prices[interval]?.amount ?? 0;
  const c = cadence(interval);
  const money = (n: number) => formatMoney(n, plan.currency);
  const trial = preview?.trial ?? null;
  const taxKnown = !!preview && !preview.taxPending;
  const firstCharge = preview?.firstCharge?.amount ?? preview?.total ?? price;
  const dueToday = trial ? 0 : (preview?.dueToday ?? preview?.total ?? price);

  return (
    <div className="co-card" data-testid="summary-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-dim-solid)" }}>Summary</div>
        <div className="co-row" style={{ marginTop: 8 }}>
          <span><b style={{ color: "var(--text-hi)" }}>{plan.name}</b> · {interval === "annual" ? "Annual" : "Monthly"}</span>
          <span data-testid="summary-price">{money(price)}/{c.unit}</span>
        </div>
      </div>
      {step === 2 && props.promoSlot}
      <div>
        <div className="co-row"><span>Subtotal</span><span data-testid="summary-subtotal">{money(preview?.subtotal ?? price)}</span></div>
        {!!preview?.discount && (
          <div className="co-row" style={{ color: "var(--up)" }}><span>Discount{preview.promo ? ` (${preview.promo.code})` : ""}</span><span data-testid="summary-discount">−{money(preview.discount)}</span></div>
        )}
        <div className="co-row">
          <span>{preview?.taxLabel ?? "Tax"}</span>
          <span data-testid="summary-tax">{taxKnown ? money(preview!.tax) : "Added after you enter your address"}</span>
        </div>
        {trial && (
          <div className="co-row" style={{ color: "var(--brand-2)" }} data-testid="summary-trial">
            <span>{trial.days}-day free trial</span>
            <span>−{money(firstCharge)}</span>
          </div>
        )}
        <div className="co-row total"><span>Due today</span><span data-testid="summary-total">{money(dueToday)}{!trial && !taxKnown ? " + tax" : ""}</span></div>
      </div>
      {step === 2 && (
        <>
          <div className="co-box" data-testid="next-payment">
            <h4>{trial ? "First charge" : "Charged today"}</h4>
            {trial
              ? `${money(firstCharge)}${taxKnown ? "" : " plus any applicable tax"} on ${day(trial.endsAt)}, then ${money(preview?.renewalAmount ?? price)} every ${c.unit} until you cancel.`
              : `${money(dueToday)}${taxKnown ? "" : " plus any applicable tax"} today, then ${money(preview?.renewalAmount ?? price)} every ${c.unit} from ${day(preview?.renewsAt)} until you cancel.`}
          </div>
          <div className="co-box" data-testid="how-it-works">
            <h4>How your subscription works</h4>
            <ul>
              {trial ? (
                <>
                  <li>{trial.days} days free — nothing is charged today.</li>
                  <li>Cancel for free before {trialEnd(trial.endsAt)}.</li>
                  <li>Then it renews at the full price every {c.unit} until you cancel.</li>
                </>
              ) : (
                <>
                  <li>Renews at the full price every {c.unit} until you cancel.</li>
                  <li>Cancel anytime in Manage Plan and keep access until the end of the period.</li>
                  <li data-testid="refund-line">{REFUND_POLICY.checkoutLine}</li>
                </>
              )}
            </ul>
          </div>
        </>
      )}
      {step === 2 && props.consentSlot}
      {props.action}
    </div>
  );
}
