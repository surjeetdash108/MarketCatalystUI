"use client";

import { useEffect, useState } from "react";
import { refreshEntitlements } from "../hooks/useEntitlements";
import { applyChange, errorBody, previewChange, type ChangePreview } from "./api";
import { formatMoney, longDate, type BillingInterval } from "./catalog";
import { handleStripeAction } from "./checkout/stripe-payment-form";
import { rememberPlanChange } from "./plan-change-summary";
import { switchPreviewLines } from "./plan-switch";
import { Modal, Notice } from "./ui";
import { LeftoverCreditsWarning, UseCreditsChoice, creditsToUse } from "./credits-ui";

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
  const [useCredits, setUseCredits] = useState(false);
  const [warnLeftover, setWarnLeftover] = useState(false);
  // The renewal consent is a tick box the member checks before switching.
  const [agreed, setAgreed] = useState(false);
  const money = (n: number) => formatMoney(n, currency);
  // Credits come off a real charge: today's (switch now, outside the trial) or
  // the new plan's first charge (switch at renewal).
  const creditCharge = !cp
    ? 0
    : cp.kind === "scheduled"
      ? cp.nextRenewalAmount
      : cp.kind === "upgrade" && !cp.trialEndsAt
        ? cp.amountDueNow
        : 0;
  const creditsUsed = useCredits ? creditsToUse(cp?.creditsAvailable ?? 0, creditCharge) : 0;
  const leftover = cp?.leftoverToCredits ?? 0;

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
        consent: { accepted: agreed, version: cp.consent?.version ?? "" },
        ...(creditsUsed > 0 ? { useCredits: true } : {}),
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
            <label data-testid="plan-switch-consent" style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: ".8rem", lineHeight: 1.5, color: "var(--text)", cursor: "pointer" }}>
              <input
                type="checkbox"
                data-testid="plan-switch-consent-box"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, flex: "none", accentColor: "#4ade80" }}
              />
              <span>{cp.consent.text}</span>
            </label>
          )}
          <UseCreditsChoice
            available={cp.creditsAvailable ?? 0}
            charge={creditCharge}
            checked={useCredits}
            onChange={setUseCredits}
            money={money}
            appliesTo={cp.kind === "scheduled" ? `your first ${planName} payment` : "today's charge"}
          />
          {creditsUsed > 0 && cp.kind !== "scheduled" && (
            <div data-testid="plan-switch-after-credits" style={{ fontSize: ".9rem" }}>
              Charged today after credits: <b>{money(Math.max(0, cp.amountDueNow - creditsUsed))}</b>
            </div>
          )}
          {!warnLeftover && <div style={{ fontWeight: 700, color: "var(--text-hi)" }}>Are you sure you want to switch?</div>}
        </>
      )}
      {error && <Notice tone="error" testId="plan-switch-error">{error}</Notice>}
      {warnLeftover ? (
        <LeftoverCreditsWarning amount={leftover} money={money} busy={busy} onContinue={() => void confirm()} onBack={() => setWarnLeftover(false)} />
      ) : (
        <button
          type="button"
          data-testid="plan-switch-yes"
          disabled={!cp || busy || !agreed}
          onClick={() => (leftover > 0 ? setWarnLeftover(true) : void confirm())}
          style={{
            width: "100%",
            padding: "13px 18px",
            borderRadius: 99,
            border: 0,
            // Market Catalyst green, the same as the module switcher and the main CTAs.
            background: "#4ade80",
            color: "#05210f",
            fontWeight: 800,
            fontSize: ".95rem",
            cursor: !cp || busy || !agreed ? "not-allowed" : "pointer",
            opacity: !cp || busy || !agreed ? 0.55 : 1,
            boxShadow: "0 0 18px rgba(74,222,128,0.35)",
          }}
        >
          {busy ? "Switching…" : `Yes, switch to ${planName}`}
        </button>
      )}
    </Modal>
  );
}
