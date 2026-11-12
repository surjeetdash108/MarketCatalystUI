"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firebaseAuth } from "../../../firebase";
import { refreshEntitlements } from "../../hooks/useEntitlements";
import {
  applyChange,
  billingSummary,
  errorBody,
  fetchPlans,
  previewChange,
  previewCheckout,
  previewPromo,
  startCheckout,
  type BillingSummary,
  type ChangePreview,
  type CheckoutPreview,
} from "../api";
import { formatMoney, longDate, type BillingInterval, type CatalogPlan } from "../catalog";
import { EmailCodeStep } from "../email-code-step";
import { currentIntent, isOnboarding, saveIntent } from "../plan-intent";
import { rememberPlanChange } from "../plan-change-summary";
import { Notice, PREVIEW_BANNER, TEST_MODE_BANNER } from "../ui";
import { paymentAdapterFor } from "./adapters";
import { notConnectedAdapter } from "./not-connected-form";
import { handleStripeAction, setStripeCheckoutContext } from "./stripe-payment-form";
import { fieldStyle, labelStyle } from "./address-fields";
import { canComplete, cadence, exitPath } from "./model";
import type { PaymentAdapter, PaymentFormValue, PaymentResult } from "./payment-form";
import { ConsentText, SummaryCard } from "./summary-card";
import { LegalModal } from "../../../auth/legal/legal-modal";
import { OnboardingStepper } from "../onboarding-stepper";
import "./checkout.css";

type Phase = "loading" | "soon" | "staff" | "verify" | "checkout" | "upgrade";
const LIVE = ["ACTIVE", "TRIALING", "PAST_DUE"];
const FROM_KEY = "mc:checkout-from";

export function CheckoutPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [inPreview, setInPreview] = useState(false);
  const [plan, setPlan] = useState<CatalogPlan | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [existingSub, setExistingSub] = useState<BillingSummary | null>(null);
  const [changePrev, setChangePrev] = useState<ChangePreview | null>(null);
  // The billing period is chosen on the plans page; checkout is the payment step.
  const [step] = useState<1 | 2>(2);
  const [onboarding, setOnboarding] = useState(false);
  const [adapter, setAdapter] = useState<PaymentAdapter | null>(null);
  const [serverPreview, setPreview] = useState<CheckoutPreview | null>(null);
  const [promoOpen, setPromoOpen] = useState(true);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentFormValue>({ ready: false, address: null });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const exitTo = useRef("/dashboard");
  // Only the server's preview for THIS plan and interval is shown or agreed to;
  // while it loads (or after a switch) there is none, so the purchase waits.
  const preview =
    serverPreview && plan && serverPreview.planId === plan.id && serverPreview.interval === interval
      ? serverPreview
      : null;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const stored = sessionStorage.getItem(FROM_KEY);
        exitTo.current = stored ?? exitPath(document.referrer, window.location.origin);
        if (!stored) sessionStorage.setItem(FROM_KEY, exitTo.current);
      } catch {
        exitTo.current = exitPath(document.referrer, window.location.origin);
      }
      setOnboarding(isOnboarding(window.location.search));
      await firebaseAuth.authStateReady();
      const { plans, paidPlansAvailable } = await fetchPlans();
      const intent = currentIntent(window.location.search, plans.map((p) => p.id));
      const chosen = intent ? plans.find((p) => p.id === intent.planId && Object.keys(p.prices ?? {}).length > 0) : null;
      if (!intent || !chosen) return window.location.replace("/manage-plan");
      saveIntent(intent);
      const user = firebaseAuth.currentUser;
      if (!user) return window.location.replace(`/auth/signup?plan=${intent.planId}&interval=${intent.interval}`);
      if (!live) return;
      setPlan(chosen);
      setInterval(intent.interval);
      if (intent.promoCode) {
        setPromoCode(intent.promoCode);
        setPromoInput(intent.promoCode);
        setPromoOpen(true);
      }
      const ent = await refreshEntitlements();
      const preview = ent?.staff === true && ent.checkoutPreview === true;
      if (live) setInPreview(preview);
      const s = await billingSummary();
      if (s.interval && s.source !== "launch_trial" && LIVE.includes(s.status)) {
        if (s.planId === intent.planId && s.interval === intent.interval) {
          return window.location.replace(`/manage-plan?plan=${intent.planId}&interval=${intent.interval}`);
        }
        setExistingSub(s);
        // A plan change is one payment step (no onboarding): the card is entered here.
        setAdapter(paymentAdapterFor(s.provider));
        try {
          const cp = await previewChange({ planId: intent.planId, interval: intent.interval });
          setChangePrev(cp);
          if (live) setPhase("upgrade");
          return;
        } catch (e) {
          console.warn("previewChange failed:", e);
        }
      }
      setAdapter(paymentAdapterFor(s.provider) ?? (preview ? notConnectedAdapter : null));
      if (!live) return;
      setPhase(user.emailVerified ? "checkout" : "verify");
    })().catch(() => live && setError("Couldn't load checkout. Refresh to try again."));
    return () => {
      live = false;
    };
  }, []);

  const region = useMemo(() => {
    const a = payment.address;
    return a && a.country ? { country: a.country, state: a.state, postalCode: a.postalCode } : undefined;
  }, [payment.address]);

  useEffect(() => {
    if (phase !== "checkout" || !plan) return;
    let live = true;
    const t = window.setTimeout(() => {
      previewCheckout({ planId: plan.id, interval, ...(promoCode ? { promoCode } : {}), ...(region && (region.country !== "US" || region.state) ? { region } : {}) })
        .then((p) => live && p.planId === plan.id && p.interval === interval && setPreview(p))
        .catch((e) => {
          if (!live) return;
          const b = errorBody(e);
          if (b.code === "promo_invalid") {
            setPromoCode(null);
            setPromoError(b.message ?? "That code isn't valid.");
            return;
          }
          setError(b.message ?? "Couldn't load your order summary. Refresh to try again.");
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [phase, plan, interval, promoCode, region]);

  const onPayment = useCallback((v: PaymentFormValue) => setPayment(v), []);

  async function applyPromo() {
    if (!plan || !promoInput.trim()) return;
    setPromoError(null);
    try {
      await previewPromo({ code: promoInput.trim(), planId: plan.id, interval });
      setPromoCode(promoInput.trim());
    } catch (e) {
      setPromoError(errorBody(e).message ?? "That code isn't valid.");
    }
  }

  async function finish(r: PaymentResult, sessionId: string) {
    if (r.status === "succeeded") {
      try {
        sessionStorage.removeItem(FROM_KEY);
      } catch {
        /* ignore */
      }
      saveIntent(null);
      window.location.href = `/billing/success?session=${encodeURIComponent(sessionId)}`;
      return;
    }
    if (r.status === "requires_action") {
      setAction(r.actionId);
      return;
    }
    setError(r.message);
  }

  const session = useRef<string | null>(null);
  async function complete() {
    if (!plan || !adapter || !payment.address) return;
    setBusy(true);
    setError(null);
    try {
      // Provider-side validation first (Stripe: elements.submit()), before anything is created.
      if (adapter.prepare) {
        const ok = await adapter.prepare();
        if (!ok.ok) {
          setError(ok.message);
          return;
        }
      }
      const a = payment.address;
      const co = await startCheckout({
        planId: plan.id,
        interval,
        ...(promoCode ? { promoCode } : {}),
        consent: { accepted: consent, version: preview?.consent?.version ?? "" },
        marketingOptIn: false,
        billing: { name: a.name, address: { line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country } },
      });
      session.current = co.sessionId;
      setStripeCheckoutContext({
        address: a,
        phone: null,
        email: firebaseAuth.currentUser?.email ?? null,
      });
      await finish(await adapter.confirm(co.sessionId, co.payment.clientSecret ?? null), co.sessionId);
    } catch (e) {
      setError(errorBody(e).message ?? "The payment didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveAction(approve: boolean) {
    if (!action || !adapter?.completeAction || !session.current) return;
    setBusy(true);
    const id = action;
    setAction(null);
    try {
      await finish(await adapter.completeAction(id, approve), session.current);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Confirms a plan change from Manage Plan. Upgrade: the card entered in the
   * payment step is charged for exactly the previewed amount (never a card on
   * file). Downgrade: applies now; the previewed credit goes to the account.
   * Annual → monthly: scheduled for the end of the annual period.
   */
  async function handleChangeConfirm() {
    if (!plan || !changePrev) return;
    setBusy(true);
    setError(null);
    try {
      let paymentMethodId: string | undefined;
      if (changePrev.kind === "upgrade" && adapter?.createPaymentMethod) {
        const pm = await adapter.createPaymentMethod();
        if (!pm.ok) {
          setError(pm.message);
          return;
        }
        paymentMethodId = pm.id;
      }
      const res = await applyChange({
        planId: plan.id,
        interval,
        prorationDate: changePrev.prorationDate,
        ...(changePrev.kind === "upgrade" ? { expectedAmountDue: changePrev.amountDueNow } : {}),
        ...(changePrev.kind === "downgrade" ? { expectedCredit: changePrev.creditToBalance } : {}),
        ...(paymentMethodId ? { paymentMethodId } : {}),
      });
      if (res.status === "requires_action" && res.clientSecret) {
        const ok = await handleStripeAction(res.clientSecret);
        if (!ok) {
          setError("Your bank could not confirm the payment. Try again or use another card.");
          return;
        }
      }
      await refreshEntitlements();
      rememberPlanChange({
        kind: changePrev.kind,
        planId: plan.id,
        fromPlanName: changePrev.breakdown?.fromPlanName ?? null,
        toPlanName: plan.name,
        interval,
        chargedNow: res.status === "applied" ? res.amountCharged : changePrev.amountDueNow,
        credit: changePrev.kind === "downgrade" ? changePrev.creditToBalance : 0,
        effectiveAt: changePrev.kind === "scheduled" ? changePrev.effectiveAt : null,
        nextRenewalAmount: changePrev.nextRenewalAmount,
        nextRenewalDate: changePrev.nextRenewalDate,
        currency: plan.currency,
      });
      window.location.replace(`/billing/success?session=upgraded&plan=${encodeURIComponent(plan.id)}`);
    } catch (e) {
      const b = errorBody(e);
      if (b.code === "preview_stale") {
        try {
          setChangePrev(await previewChange({ planId: plan.id, interval }));
        } catch {
          /* keep the old preview; the message below explains */
        }
        setError("The amount changed since this page opened. Review the new amount and confirm again.");
        return;
      }
      setError(b.message ?? "Unable to change your plan. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    try {
      sessionStorage.removeItem(FROM_KEY);
    } catch {
      /* ignore */
    }
    window.location.href = exitTo.current;
  };

  const header = (
    <div className="co-top">
      {phase === "checkout" && plan ? (
        <Link className="co-iconbtn" aria-label="Back to the plans" data-testid="co-back" href={`/choose-plan?plan=${plan.id}&interval=${interval}${onboarding ? "&onboarding=1" : ""}`}>←</Link>
      ) : (
        <span style={{ width: 36 }} />
      )}
      <h1>Checkout</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="co-iconbtn" aria-label="Close checkout" data-testid="co-close" onClick={close}>✕</button>
      </div>
    </div>
  );

  if (phase === "upgrade" && plan && changePrev) {
    const cp = changePrev;
    const bd = cp.breakdown;
    const money = (n: number) => formatMoney(n, plan.currency);
    const cadenceLabel = interval === "annual" ? "Annual" : "Monthly";
    const needsCard = cp.kind === "upgrade" && !!adapter?.createPaymentMethod;
    const PayForm = needsCard ? adapter?.Form : undefined;
    const canConfirm = !busy && (!needsCard || payment.ready);
    const title =
      cp.kind === "upgrade"
        ? `Upgrade to ${plan.name} (${cadenceLabel})`
        : cp.kind === "downgrade"
          ? `Change to ${plan.name} (${cadenceLabel})`
          : `Switch to ${plan.name} (${cadenceLabel})`;
    const cta =
      cp.kind === "upgrade"
        ? `Pay ${money(cp.amountDueNow)} & upgrade to ${plan.name}`
        : cp.kind === "downgrade"
          ? `Confirm change to ${plan.name}`
          : `Schedule switch to ${plan.name}`;
    const row = (label: string, value: string, testId: string, tone?: "up" | "down") => (
      <div data-testid={testId} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: ".9rem" }}>
        <span style={{ color: "var(--text-dim-solid)" }}>{label}</span>
        <span style={{ fontWeight: 700, color: tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text-hi)", whiteSpace: "nowrap" }}>{value}</span>
      </div>
    );

    return (
      <div className="iq-root co-page" data-theme="dark" data-testid="checkout-upgrade-page">
        {header}
        <div style={{ maxWidth: 680, margin: "24px auto", padding: "0 16px" }}>
          {error && <div style={{ marginBottom: 16 }}><Notice tone="error" testId="co-change-error">{error}</Notice></div>}
          <div className="co-card" style={{ padding: "28px 24px" }}>
            <h2 className="co-title" style={{ margin: "0 0 18px", fontSize: "1.35rem" }}>{title}</h2>

            {bd ? (
              <div data-testid="change-breakdown" style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {row(`${bd.fromPlanName}: ${longDate(bd.periodStart)} to today`, money(bd.usedOnCurrent), "bd-used")}
                {row(`${bd.toPlanName}: today to ${longDate(cp.nextRenewalDate || bd.periodEnd)}`, money(bd.newPlanCharge), "bd-new")}
                {row(`Already paid for ${bd.fromPlanName}`, `−${money(bd.alreadyPaid)}`, "bd-paid")}
                <div style={{ height: 1, background: "rgba(255, 255, 255, 0.1)" }} />
                {cp.kind === "upgrade"
                  ? row("Charged now", money(cp.amountDueNow), "bd-charged")
                  : row("Credit to your account", money(cp.creditToBalance), "bd-credit", "up")}
                {cp.kind === "downgrade" && (
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Used automatically on your next invoice(s), not refunded to your card.</div>
                )}
              </div>
            ) : (
              <div data-testid="change-scheduled" style={{ fontSize: ".9rem", marginBottom: 20 }}>
                Takes effect on <b>{longDate(cp.effectiveAt)}</b>, at the end of your current period. Nothing is charged today.
              </div>
            )}

            <div style={{ fontSize: ".84rem", color: "var(--text)", marginBottom: 20 }} data-testid="change-next">
              {cp.kind === "downgrade"
                ? `Next invoice: ${money(cp.nextInvoiceAfterCredit)} on ${longDate(cp.nextRenewalDate)} (${money(cp.nextRenewalAmount)} less your account credit).`
                : `Then ${money(cp.nextRenewalAmount)}${interval === "annual" ? "/year" : "/month"} from ${longDate(cp.nextRenewalDate)}. Cancel or switch anytime in Manage Plan.`}
            </div>

            {PayForm && (
              <div data-testid="change-payment" style={{ marginBottom: 20 }}>
                <span style={{ ...labelStyle, marginBottom: 10 }}>Payment</span>
                <PayForm onChange={onPayment} disabled={busy} amount={cp.amountDueNow} currency={plan.currency} purpose="planChange" />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button type="button" className="co-cta" data-testid="change-confirm" onClick={() => void handleChangeConfirm()} disabled={!canConfirm}>
                {busy ? "Processing…" : cta}
              </button>
              <button type="button" onClick={close} style={{ background: "transparent", border: "none", color: "var(--text-dim-solid)", fontSize: ".85rem", cursor: "pointer", padding: "8px", textDecoration: "underline" }}>
                Cancel and return
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase !== "checkout" || !plan) {
    return (
      <div className="iq-root co-page" data-theme="dark">
        {header}
        <div style={{ maxWidth: 520, margin: "24px auto", padding: "0 16px" }}>
          {inPreview && <Notice tone="warn" testId="co-preview-banner">{PREVIEW_BANNER}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {phase === "soon" && plan && (
            <div className="co-card" data-testid="co-soon">
              <h2 className="co-title">{plan.name} is launching soon</h2>
              <p className="co-sub">Paid plans aren&apos;t available yet. You have full access until then — we&apos;ll keep your choice.</p>
              <p style={{ marginTop: 14 }}><Link href="/dashboard" style={{ color: "var(--brand-2)" }}>Go to your dashboard</Link></p>
            </div>
          )}
          {phase === "staff" && (
            <div className="co-card" data-testid="co-staff">
              <h2 className="co-title">You have staff access</h2>
              <p className="co-sub">Staff accounts get every feature and are never billed. There&apos;s nothing to buy.</p>
              <p style={{ marginTop: 14 }}><Link href="/dashboard" style={{ color: "var(--brand-2)" }}>Go to your dashboard</Link></p>
            </div>
          )}
          {phase === "verify" && (
            <div className="co-card">
              <EmailCodeStep title="Verify your email to continue" onVerified={() => setPhase("checkout")} />
            </div>
          )}
        </div>
      </div>
    );
  }

  const money = (n: number) => formatMoney(n, plan.currency);
  const c = cadence(interval);
  // The server's preview (with its consent version) must have arrived: the
  // placeholder summary shown while it loads cannot be agreed to.
  const ready = canComplete({ consent, address: payment.address, paymentReady: payment.ready && !!preview?.consent?.version, busy });
  const Form = adapter?.Form;

  return (
    <div className="iq-root co-page" data-theme="dark" data-testid="checkout-page">
      {header}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}>
        {onboarding && <OnboardingStepper currentStep={3} />}
      </div>
      {inPreview && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}><Notice tone="warn" testId="co-preview-banner">{PREVIEW_BANNER}</Notice></div>
      )}
      {adapter?.provider === "fake" && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}><Notice tone="warn" testId="test-mode">{TEST_MODE_BANNER}</Notice></div>
      )}
      <div className="co-wrap">
        <div className="co-main">
          {(
            <div className="co-card" data-testid="co-step2">
              <p className="co-sub" style={{ margin: "0 0 14px" }}>
                <b style={{ color: "var(--text-hi)" }}>{plan.name}</b> · {interval === "annual" ? "Annual" : "Monthly"} ·{" "}
                <Link href={`/choose-plan?plan=${plan.id}&interval=${interval}${onboarding ? "&onboarding=1" : ""}`} className="co-link" data-testid="co-change-plan">Change plan</Link>
              </p>
              {Form ? (
                <Form onChange={onPayment} disabled={busy} amount={preview?.trial ? 0 : (preview?.total ?? plan.prices[interval]?.amount ?? 0)} currency={plan.currency} />
              ) : (
                <Notice tone="warn">Payments aren&apos;t available right now.</Notice>
              )}
            </div>
          )}
        </div>
        <aside className="co-side">
          <SummaryCard
            plan={plan}
            interval={interval}
            step={step}
            preview={preview}
            promoSlot={
              <div>
                {!promoOpen && !preview?.promo ? (
                  <button className="co-link" data-testid="promo-toggle" onClick={() => setPromoOpen(true)}>Got a promo code?</button>
                ) : preview?.promo ? (
                  <div className="co-row" data-testid="promo-applied">
                    <span>Code <b>{preview.promo.code}</b> — {preview.promo.description}</span>
                    <button className="co-link" onClick={() => { setPromoCode(null); setPromoInput(""); }}>Remove</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input data-testid="promo-input" style={fieldStyle} placeholder="Promo code (optional)" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} />
                    <button className="co-iconbtn" style={{ width: "auto", padding: "0 14px", fontWeight: 700 }} data-testid="promo-apply" onClick={() => void applyPromo()}>Apply</button>
                  </div>
                )}
                {promoError && <div data-testid="promo-error" style={{ marginTop: 6, fontSize: ".76rem", color: "var(--down)" }}>{promoError}</div>}
              </div>
            }
            consentSlot={
              <label className="co-check" data-testid="consent">
                <input type="checkbox" data-testid="consent-box" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  <ConsentText
                    text={
                      preview?.consent?.text ?? "Loading the renewal terms…"
                    }
                    onOpen={setLegal}
                  /> <span style={{ color: "#ef4444" }}>*</span>
                </span>
              </label>
            }
            action={
              <>
                {error && <Notice tone="error" testId="co-error">{error}</Notice>}
                {(
                  <>
                    <button className="co-cta" data-testid="co-complete" disabled={!ready} onClick={() => void complete()}>
                      {busy
                        ? "Processing…"
                        : preview?.trial
                          ? `Start your ${preview.trial.days} day free trial`
                          : `Pay ${money(preview?.dueToday ?? preview?.total ?? plan.prices[interval]?.amount ?? 0)} and start ${plan.name}`}
                    </button>
                    {!busy && (!payment.ready || !preview?.consent?.version) && (
                      <div data-testid="co-helper" style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", textAlign: "center", marginTop: 4 }}>
                        {!payment.ready ? "Complete card details and billing address to continue" : "Loading your order summary…"}
                      </div>
                    )}
                  </>
                )}
                {step === 2 && <p style={{ margin: 0, fontSize: ".72rem", color: "var(--text-dim-solid)", textAlign: "center" }}>Renews {c.word} until you cancel.</p>}
              </>
            }
          />
        </aside>
      </div>
      {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}
      {action && (
        <>
          <div className="scrim" />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Confirm with your bank" data-testid="co-3ds" style={{ height: "fit-content", maxWidth: 420 }}>
            <div className="drawer-h"><div style={{ flex: 1, fontWeight: 700, color: "var(--text-hi)" }}>Confirm with your bank</div></div>
            <div className="drawer-b" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: ".86rem" }}>Your bank asks you to confirm this payment (3-D Secure, simulated).</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="co-cta" data-testid="co-3ds-approve" onClick={() => void resolveAction(true)}>Confirm</button>
                <button className="co-cta" style={{ background: "var(--surface-2)", color: "var(--text)" }} data-testid="co-3ds-fail" onClick={() => void resolveAction(false)}>Fail</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
