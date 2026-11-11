"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firebaseAuth } from "../../../firebase";
import { refreshEntitlements } from "../../hooks/useEntitlements";
import { billingSummary, errorBody, fetchPlans, previewCheckout, previewPromo, startCheckout, type CheckoutPreview } from "../api";
import { formatMoney, type BillingInterval, type CatalogPlan } from "../catalog";
import { EmailCodeStep } from "../email-code-step";
import { currentIntent, saveIntent } from "../plan-intent";
import { Notice, PREVIEW_BANNER, TEST_MODE_BANNER } from "../ui";
import { paymentAdapterFor } from "./adapters";
import { notConnectedAdapter } from "./not-connected-form";
import { fieldStyle, labelStyle } from "./address-fields";
import { annualOffer, canComplete, cadence, exitPath, type BillingAddress } from "./model";
import type { PaymentAdapter, PaymentFormValue, PaymentResult } from "./payment-form";
import { DEFAULT_DIAL_COUNTRY, DIAL_COUNTRIES, phonePlaceholder, toE164 } from "./phone";
import { ConsentText, SummaryCard } from "./summary-card";
import { LegalModal } from "../../../auth/legal/legal-modal";
import { OnboardingStepper } from "../onboarding-stepper";
import "./checkout.css";

type Phase = "loading" | "soon" | "staff" | "verify" | "checkout";
const LIVE = ["ACTIVE", "TRIALING", "PAST_DUE"];
const FROM_KEY = "mc:checkout-from";

export function CheckoutPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [inPreview, setInPreview] = useState(false);
  const [plan, setPlan] = useState<CatalogPlan | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [step, setStep] = useState<1 | 2>(1);
  const [adapter, setAdapter] = useState<PaymentAdapter | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentFormValue>({ ready: false, address: null });
  const [dialIso, setDialIso] = useState(DEFAULT_DIAL_COUNTRY);
  const [national, setNational] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const exitTo = useRef("/dashboard");

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
        // Existing subscribers change plans with the preview/confirm flow in Manage Plan.
        return window.location.replace(`/manage-plan?plan=${intent.planId}&interval=${intent.interval}`);
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
    const cNow = cadence(interval);
    setPreview((curr) => curr ?? {
      planId: plan.id,
      interval,
      currency: plan.currency,
      subtotal: plan.prices[interval]?.amount ?? 0,
      discount: 0,
      tax: 0,
      total: plan.id === "starter" ? 0 : plan.prices[interval]?.amount ?? 0,
      taxLabel: null,
      taxPending: false,
      promo: null,
      renewsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      renewalAmount: plan.prices[interval]?.amount ?? 0,
      consent: {
        version: "v1",
        text: plan.id === "starter"
          ? `I agree that my Starter 7-day free trial renews ${cNow.word} at ${formatMoney(plan.prices[interval]?.amount ?? 0, plan.currency)} after 7 days until I cancel. I agree to the Terms of Use and have read the Privacy Policy.`
          : `I agree that my ${plan.name} plan renews ${cNow.word} at the price shown until I cancel. I agree to the Terms of Use and have read the Privacy Policy.`,
      },
      refundPolicy: { enabled: true, windowDays: 14, checkoutLine: "Cancel anytime in Manage Plan." },
    });
    const t = window.setTimeout(() => {
      previewCheckout({ planId: plan.id, interval, ...(promoCode ? { promoCode } : {}), ...(region && (region.country !== "US" || region.state) ? { region } : {}) })
        .then((p) => live && setPreview(p))
        .catch((e) => {
          if (!live) return;
          const b = errorBody(e);
          if (b.code === "promo_invalid") {
            setPromoCode(null);
            setPromoError(b.message ?? "That code isn't valid.");
          }
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [phase, plan, interval, promoCode, region]);

  const onPayment = useCallback((v: PaymentFormValue) => setPayment(v), []);
  const dial = DIAL_COUNTRIES.find((d) => d.iso === dialIso)?.dial ?? "+1";
  const phoneE164 = toE164(dial, national);

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
    if (!plan || !adapter || !payment.address || !phoneE164) return;
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
        consent: { accepted: consent, version: preview?.consent?.version ?? "v1" },
        phone: phoneE164,
        marketingOptIn: optIn,
        billing: { name: a.name, address: { line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country } },
      });
      session.current = co.sessionId;
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
      {phase === "checkout" && step === 2 ? (
        <button className="co-iconbtn" aria-label="Back to billing period" data-testid="co-back" onClick={() => setStep(1)}>←</button>
      ) : (
        <span style={{ width: 36 }} />
      )}
      <h1>Checkout</h1>
      <button className="co-iconbtn" aria-label="Close checkout" data-testid="co-close" onClick={close}>✕</button>
    </div>
  );

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

  const annual = annualOffer(plan);
  const money = (n: number) => formatMoney(n, plan.currency);
  const c = cadence(interval);
  const ready = canComplete({ consent, phoneE164, address: payment.address, paymentReady: payment.ready && !!preview, busy });
  const Form = adapter?.Form;

  return (
    <div className="iq-root co-page" data-theme="dark" data-testid="checkout-page">
      {header}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}>
        <OnboardingStepper currentStep={2} />
      </div>
      {inPreview && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}><Notice tone="warn" testId="co-preview-banner">{PREVIEW_BANNER}</Notice></div>
      )}
      {adapter?.provider === "fake" && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}><Notice tone="warn" testId="test-mode">{TEST_MODE_BANNER}</Notice></div>
      )}
      <div className="co-wrap">
        <div className="co-main">
          {step === 1 ? (
            <div className="co-card" data-testid="co-step1">
              <h2 className="co-title">{plan.name} plan</h2>
              <p className="co-sub" style={{ marginBottom: 16 }}>
                Choose your billing period. <Link href="/manage-plan" className="co-link" data-testid="co-change-plan">Change plan</Link>
              </p>
              <div role="radiogroup" aria-label="Billing period" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {annual && (
                  <button type="button" role="radio" aria-checked={interval === "annual"} data-testid="co-annual" className={`co-radio${interval === "annual" ? " on" : ""}`} onClick={() => setInterval("annual")}>
                    <span className="co-dot" />
                    <span style={{ flex: 1 }}>
                      <b style={{ color: "var(--text-hi)" }}>Annual</b><span className="co-badge">Best value</span>
                      <div style={{ marginTop: 4, fontSize: ".86rem" }}>{money(annual.perYear)}/year · {money(annual.perMonth)}/month</div>
                      {annual.saveVsMonthly > 0 && <div style={{ marginTop: 2, fontSize: ".78rem", color: "var(--up)" }}>Save {money(annual.saveVsMonthly)} compared with monthly</div>}
                    </span>
                  </button>
                )}
                {plan.prices.monthly && (
                  <button type="button" role="radio" aria-checked={interval === "monthly"} data-testid="co-monthly" className={`co-radio${interval === "monthly" ? " on" : ""}`} onClick={() => setInterval("monthly")}>
                    <span className="co-dot" />
                    <span style={{ flex: 1 }}>
                      <b style={{ color: "var(--text-hi)" }}>Monthly</b>
                      <div style={{ marginTop: 4, fontSize: ".86rem" }}>{money(plan.prices.monthly.amount)}/month</div>
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="co-card" data-testid="co-step2">
              <h2 className="co-title" style={{ fontSize: "1.15rem", marginBottom: 6 }}>
                {plan.id === "starter" ? "Start your 7 day free trial" : `Subscribe to ${plan.name}`}
              </h2>
              <p className="co-sub" style={{ marginBottom: 14, fontSize: ".84rem" }}>
                {plan.id === "starter"
                  ? "Add your card to begin. You are not charged today ($0 due today). Cancel anytime during your 7-day trial and pay nothing."
                  : `Pay securely with Stripe. ${plan.name} is charged today and renews ${c.word}. Cancel anytime in Manage Plan.`}
              </p>
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                <label>
                  <span style={labelStyle}>
                    Mobile number <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <div className="co-phone">
                    <select aria-label="Country code" data-testid="phone-country" style={fieldStyle} value={dialIso} onChange={(e) => setDialIso(e.target.value)}>
                      {DIAL_COUNTRIES.map((d) => <option key={d.iso} value={d.iso}>{d.iso} {d.dial}</option>)}
                    </select>
                    <input data-testid="phone-input" style={fieldStyle} type="tel" autoComplete="tel-national" inputMode="tel" placeholder={phonePlaceholder(dialIso)} value={national} onChange={(e) => setNational(e.target.value)} aria-invalid={national !== "" && !phoneE164} />
                  </div>
                  {national !== "" && !phoneE164 && <span data-testid="phone-error" style={{ fontSize: ".74rem", color: "var(--down)" }}>Enter a valid mobile number.</span>}
                </label>
                <label className="co-check" style={{ marginTop: 10 }}>
                  <input type="checkbox" data-testid="optin" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                  <span>Text me product updates (optional)</span>
                </label>
              </div>
              {Form ? (
                <Form onChange={onPayment} disabled={busy} amount={preview?.total ?? (plan.id === "starter" ? 0 : plan.prices[interval]?.amount ?? 0)} currency={plan.currency} />
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
                      preview?.consent?.text ??
                      (plan.id === "starter"
                        ? `I agree that my Starter 7-day free trial renews ${c.word} at ${money(plan.prices[interval]?.amount ?? 0)} after 7 days until I cancel. I agree to the Terms of Use and have read the Privacy Policy.`
                        : `I agree that my ${plan.name} plan renews ${c.word} at the price shown until I cancel. I agree to the Terms of Use and have read the Privacy Policy.`)
                    }
                    onOpen={setLegal}
                  /> <span style={{ color: "#ef4444" }}>*</span>
                </span>
              </label>
            }
            action={
              <>
                {error && <Notice tone="error" testId="co-error">{error}</Notice>}
                {step === 1 ? (
                  <button className="co-cta" data-testid="co-next" onClick={() => setStep(2)}>Next</button>
                ) : (
                  <>
                    <button className="co-cta" data-testid="co-complete" disabled={!ready} onClick={() => void complete()}>
                      {busy ? "Processing…" : plan.id === "starter" ? "Start my 7 day free trial" : `Pay ${money(preview?.total ?? plan.prices[interval]?.amount ?? 0)} and start ${plan.name}`}
                    </button>
                    {!ready && (
                      <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", textAlign: "center", marginTop: 4 }}>
                        {!phoneE164
                          ? "Enter a valid mobile number to continue"
                          : !payment.ready
                            ? "Complete card details and billing address to continue"
                            : !consent
                              ? "Tick the agreement checkbox above to continue"
                              : "Complete required fields to continue"}
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
