"use client";

import { useEffect, useState } from "react";
import { refreshEntitlements } from "../hooks/useEntitlements";
import { applyChange, errorBody, previewChange, type ChangePreview } from "./api";
import { formatMoney, longDate, type BillingInterval } from "./catalog";
import { handleStripeAction } from "./checkout/stripe-payment-form";
import { rememberPlanChange } from "./plan-change-summary";
import { switchPreviewLines } from "./plan-switch";
import { Modal, Notice } from "./ui";

/**
 * Switching plans: a pop-up with when the new plan starts and what's charged,
 * "Are you sure you want to switch?", and only on Yes the change is applied
 * (card on file; Yes is the renewal consent shown below).
 */
export function PlanSwitchDialog(props: {
  planId: string;
  planName: string;
  fromPlanName: string | null;
  interval: BillingInterval;
  currency: string;
  onClose: () => void;
}) {
  const { planId, planName, interval, currency, onClose } = props;
  const [cp, setCp] = useState<ChangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const money = (n: number) => formatMoney(n, currency);

  useEffect(() => {
    let live = true;
    previewChange({ planId, interval })
      .then((p) => live && setCp(p))
      .catch((e) => live && setError(errorBody(e).message ?? "Couldn't load the details of this change."));
    return () => {
      live = false;
    };
  }, [planId, interval]);

  async function confirm() {
    if (!cp) return;
    setBusy(true);
    setError(null);
    try {
      const res = await applyChange({
        planId,
        interval,
        prorationDate: cp.prorationDate,
        ...(cp.kind === "upgrade" ? { expectedAmountDue: cp.amountDueNow } : {}),
        ...(cp.kind === "downgrade" ? { expectedCredit: cp.creditToBalance } : {}),
        consent: { accepted: true, version: cp.consent?.version ?? "" },
      });
      if (res.status === "requires_action" && res.clientSecret) {
        const action = await handleStripeAction(res.clientSecret);
        if (!action.ok) {
          setError(action.message);
          return;
        }
      }
      await refreshEntitlements();
      rememberPlanChange({
        kind: cp.kind,
        planId,
        fromPlanName: cp.breakdown?.fromPlanName ?? props.fromPlanName,
        toPlanName: planName,
        interval,
        chargedNow: res.status === "applied" ? res.amountCharged : cp.amountDueNow,
        credit: cp.kind === "downgrade" ? cp.creditToBalance : 0,
        effectiveAt: cp.kind === "scheduled" ? cp.effectiveAt : null,
        nextRenewalAmount: cp.nextRenewalAmount,
        nextRenewalDate: cp.nextRenewalDate,
        currency,
      });
      window.location.replace(`/billing/success?session=upgraded&plan=${encodeURIComponent(planId)}`);
    } catch (e) {
      const b = errorBody(e);
      if (b.code === "preview_stale") {
        try {
          setCp(await previewChange({ planId, interval }));
        } catch {
          /* keep the old preview */
        }
        setError("The amount changed since this opened. Review the new amount and confirm again.");
        return;
      }
      setError(b.message ?? "Unable to change your plan. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Switch to ${planName}`} onClose={busy ? undefined : onClose} testId="plan-switch-dialog">
      {!cp && !error && <div style={{ color: "var(--text-dim-solid)" }}>Loading the details…</div>}
      {cp && (
        <>
          <div data-testid="plan-switch-lines" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: ".9rem", lineHeight: 1.5 }}>
            {switchPreviewLines(cp, { from: cp.breakdown?.fromPlanName ?? props.fromPlanName, to: planName }, money, longDate).map((l) => (
              <p key={l} style={{ margin: 0 }}>{l}</p>
            ))}
          </div>
          {cp.consent?.text && (
            <p style={{ margin: 0, fontSize: ".74rem", color: "var(--text-dim-solid)", lineHeight: 1.5 }}>
              By choosing Yes: {cp.consent.text}
            </p>
          )}
          <div style={{ fontWeight: 700, color: "var(--text-hi)" }}>Are you sure you want to switch?</div>
        </>
      )}
      {error && <Notice tone="error" testId="plan-switch-error">{error}</Notice>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="co-cta" data-testid="plan-switch-yes" disabled={!cp || busy} onClick={() => void confirm()}>
          {busy ? "Switching…" : "Yes, switch"}
        </button>
        <button className="co-cta" data-testid="plan-switch-no" disabled={busy} style={{ background: "var(--surface-2)", color: "var(--text)" }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
