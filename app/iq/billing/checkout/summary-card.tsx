"use client";

import { useMemo, type ReactNode } from "react";
import type { CheckoutPreview } from "../api";
import { formatMoney, type BillingInterval, type CatalogPlan } from "../catalog";
import { REFUND_POLICY } from "../refund-policy.generated";
import { cadence, renewalLine } from "./model";

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
  const isStarter = plan.id === "starter";
  const price = plan.prices[interval]?.amount ?? 0;
  const c = cadence(interval);
  const money = (n: number) => formatMoney(n, plan.currency);
  const dueToday = isStarter ? 0 : step === 2 && preview ? preview.total : price;

  const trialEndStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }, []);

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
        {step === 2 && !isStarter && (
          <div className="co-row">
            <span>{preview?.taxLabel ?? "Tax"}</span>
            <span data-testid="summary-tax">{!preview || preview.taxPending ? "Added after you enter your address" : money(preview.tax)}</span>
          </div>
        )}
        {isStarter && (
          <div className="co-row" style={{ color: "var(--brand-2)" }}>
            <span>Free trial (7 days)</span>
            <span>−{money(preview?.subtotal ?? price)}</span>
          </div>
        )}
        <div className="co-row total"><span>Total due today</span><span data-testid="summary-total">{money(dueToday)}{step === 1 && !isStarter ? " + tax" : ""}</span></div>
      </div>
      {step === 2 && (
        <>
          {isStarter ? (
            <div className="co-box" data-testid="trial-box" style={{ background: "rgba(34, 197, 94, 0.08)", borderColor: "rgba(34, 197, 94, 0.25)" }}>
              <h4 style={{ color: "var(--brand-2)" }}>🎁 7 days free</h4>
              Your trial ends on {trialEndStr}. Cancel before then and you will not be charged.
            </div>
          ) : (
            <div className="co-box plain" data-testid="no-trial-box">
              <h4>ℹ️ Charged today</h4>
              No free trial on {plan.name}. You are charged today. (Want to try first? Starter includes a 7-day free trial).
            </div>
          )}
          {preview && (
            <div className="co-box" data-testid="next-payment">
              <h4>Next payment</h4>
              {isStarter
                ? `Renews on ${trialEndStr} at ${money(preview.renewalAmount || price)} plus any applicable tax.`
                : `${renewalLine(preview.renewsAt, money(preview.renewalAmount))} plus any applicable tax.`}
            </div>
          )}
          <div className="co-box" data-testid="how-it-works">
            <h4>How your subscription works</h4>
            <ul>
              {isStarter ? (
                <>
                  <li>7 days completely free. $0.00 charged today.</li>
                  <li>Cancel anytime before the trial ends in Manage Plan and you will not be charged.</li>
                  <li>After 7 days, renews at the regular price every {c.unit} until you cancel.</li>
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
