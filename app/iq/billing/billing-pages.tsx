"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../backend";
import { refreshEntitlements, useEntitlements } from "../hooks/useEntitlements";
import { billingSummary, checkoutStatus, errorBody, fetchPlans } from "./api";
import { formatMoney, longDate } from "./catalog";
import { planChangeLines, takePlanChange, type PlanChangeSummary } from "./plan-change-summary";
import { checkoutPath, currentIntent } from "./plan-intent";
import { Button, Notice, PREVIEW_BANNER, TEST_MODE_BANNER, pill } from "./ui";

const qs = (k: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(k));

/** /billing/start (old links) → the one purchase page, /checkout, with the same plan. */
export function BillingStart() {
  useEffect(() => {
    void fetchPlans()
      .then(({ plans }) => {
        const intent = currentIntent(window.location.search, plans.map((p) => p.id));
        window.location.replace(intent ? checkoutPath(intent) : "/manage-plan");
      })
      .catch(() => window.location.replace("/manage-plan"));
  }, []);
  return null;
}

import { OnboardingStepper } from "./onboarding-stepper";
import { ConfettiCanvas } from "./confetti";

/** /billing/success — polls until the event handler has activated the plan. */
export function BillingSuccess() {
  const { data: ent } = useEntitlements();
  const isPlanChange = ["upgraded", "upgrade"].includes(qs("session") ?? "");
  const [change, setChange] = useState<PlanChangeSummary | null>(null);
  const [view, setView] = useState<{ phase: "waiting" | "active" | "slow" | "error"; planId?: string }>({ phase: "waiting" });
  useEffect(() => {
    const session = qs("session");
    if (!session) {
      setView({ phase: "error" });
      return;
    }
    if (session === "upgraded" || session === "upgrade") {
      // A plan change: confirm it with the server (the plan, or the scheduled
      // switch, is really there) before saying so.
      const plan = qs("plan") || undefined;
      const summary = takePlanChange();
      setChange(summary);
      let tries = 0;
      let stopped = false;
      const check = async () => {
        if (stopped) return;
        tries++;
        try {
          const s = await billingSummary();
          const done =
            summary?.kind === "scheduled"
              ? s.scheduledChange?.planId === plan
              : s.planId === plan;
          if (done) {
            await refreshEntitlements();
            setView({ phase: "active", planId: plan });
            return;
          }
        } catch {
          /* keep checking */
        }
        if (tries >= 20) setView({ phase: "slow" });
        else setTimeout(() => void check(), 1500);
      };
      void check();
      return () => {
        stopped = true;
      };
    }
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      tries++;
      try {
        const s = await checkoutStatus(session);
        if (s.active) {
          await refreshEntitlements();
          setView({ phase: "active", planId: s.planId });
          return;
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 20) setView({ phase: "slow" });
      else setTimeout(() => void tick(), 1500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, []);
  return (
    <div className="iq-root" data-theme="dark" style={{ minHeight: "100vh", padding: "40px 16px", background: "var(--bg, #08090a)" }}>
      {view.phase === "active" && <ConfettiCanvas />}
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        {/* First purchase only (a plan change is a single payment step, not onboarding);
            all three steps show as done once the plan is active. */}
        {!isPlanChange && <OnboardingStepper currentStep={view.phase === "active" ? 4 : 3} />}

        <div className="card col-12" data-testid="billing-success" style={{ margin: "0 auto" }}>
          <div className="card-b" style={{ padding: 36, display: "flex", flexDirection: "column", gap: 18, textAlign: "center", alignItems: "center" }}>
            {ent?.checkoutPreview && <Notice tone="warn" testId="success-preview-banner">{PREVIEW_BANNER}</Notice>}
            
            {view.phase === "waiting" && (
              <div data-testid="success-waiting" style={{ color: "var(--text-dim-solid)", fontSize: "1rem", padding: "20px 0" }}>
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚡</div>
                Payment received. Activating your plan…
              </div>
            )}

            {view.phase === "active" && (
              <>
                <div style={{ fontSize: "2.8rem", lineHeight: 1 }}>🎉</div>
                <h1 style={{ margin: 0, color: "var(--text-hi)", fontSize: "1.6rem", fontWeight: 800 }} data-testid="success-active">
                  Congratulations!
                </h1>
                <p style={{ margin: 0, color: "var(--brand-2, #10b981)", fontSize: "1.1rem", fontWeight: 700 }}>
                  {isPlanChange && change?.kind === "scheduled"
                    ? `Your ${change.toPlanName} plan starts on ${change.effectiveAt ? longDate(change.effectiveAt) : "the end of your current period"}`
                    : `Your ${change?.toPlanName ?? (view.planId ? view.planId.charAt(0).toUpperCase() + view.planId.slice(1) : "new")} Plan is Activated`}
                </p>
                {isPlanChange && change ? (
                  <div data-testid="change-confirmation" style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 460, fontSize: ".9rem", color: "var(--text)", lineHeight: 1.5 }}>
                    {planChangeLines(change, (n) => formatMoney(n, change.currency), longDate).map((l) => (
                      <p key={l} style={{ margin: 0 }}>{l}</p>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".9rem", maxWidth: 420, lineHeight: 1.5 }}>
                    Your plan is active. Everything it includes is ready to use.
                  </p>
                )}
                <p data-testid="success-email" style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".8rem" }}>
                  We&apos;ve emailed you a confirmation. You can see every change in Settings → Plan → Purchase history.
                </p>
                <Link
                  href="/dashboard"
                  style={{
                    marginTop: 10,
                    padding: "13px 36px",
                    borderRadius: 99,
                    background: "var(--brand, #10b981)",
                    color: "#05210f",
                    fontWeight: 800,
                    fontSize: "1rem",
                    textDecoration: "none",
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  Explore the platform →
                </Link>
              </>
            )}

            {view.phase === "slow" && (
              <Notice tone="warn">
                Payment received; activation is taking slightly longer than usual. We&apos;ll email you when it&apos;s ready — refresh this page in a minute.
              </Notice>
            )}

            {view.phase === "error" && (
              <Notice tone="error">
                This page needs a valid checkout session. <Link href="/manage-plan" style={{ color: "inherit", textDecoration: "underline" }}>Back to Manage Plan</Link>
              </Notice>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FakeSession { id: string; planId: string; interval: string; amountDueToday: number; currency: string; discount: { code?: string | null } | null; status: string; cancelUrl: string; testCards: Record<string, string> }
const CARD_LABELS: Record<string, string> = { success: "Succeeds", decline: "Declined", insufficient_funds: "Insufficient funds", requires_3ds: "3-D Secure required", renewal_failure: "Succeeds now, fails on renewal" };

/** /billing/checkout — the fake provider's hosted checkout page (dev/staging only). */
export function FakeCheckout() {
  const [s, setS] = useState<FakeSession | null>(null);
  const [card, setCard] = useState("success");
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const id = qs("session");
  useEffect(() => {
    if (id) apiGet<FakeSession>(`/api/billing/fake/checkout/${id}`).then(setS).catch((e) => setMsg({ tone: "error", text: errorBody(e).message ?? "Checkout not found." }));
  }, [id]);
  async function pay() {
    setMsg(null);
    const r = await apiPost<{ status: string; code?: string; actionId?: string; redirectUrl?: string }>(`/api/billing/fake/checkout/${id}/complete`, { card });
    if (r.status === "complete" && r.redirectUrl) window.location.href = r.redirectUrl;
    else if (r.status === "requires_action" && r.actionId) setAction(r.actionId);
    else setMsg({ tone: "error", text: `Payment failed: ${r.code?.replace(/_/g, " ")}. Try another card.` });
  }
  async function confirm(approve: boolean) {
    const r = await apiPost<{ status: string; redirectUrl?: string; code?: string }>(`/api/billing/fake/actions/${action}`, { approve });
    setAction(null);
    if (r.status === "complete" && r.redirectUrl) window.location.href = r.redirectUrl;
    else setMsg({ tone: "error", text: "Authentication failed. Your card was not charged." });
  }
  return (
    <div className="card col-12" data-testid="fake-checkout" style={{ maxWidth: 520, margin: "32px auto" }}>
      <div className="card-b" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <Notice tone="warn">{TEST_MODE_BANNER}</Notice>
        {s && (
          <>
            <div style={{ fontSize: "1.05rem", color: "var(--text-hi)" }}>MarketCatalyst <b>{s.planId}</b> · {s.interval}</div>
            <div data-testid="fake-amount">Due today: <b>{formatMoney(s.amountDueToday, s.currency)}</b>{s.discount?.code ? ` (code ${s.discount.code})` : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(s.testCards).map(([k, num]) => (
                <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".82rem" }}>
                  <input type="radio" name="card" checked={card === k} onChange={() => setCard(k)} /> <code>{num}</code> — {CARD_LABELS[k]}
                </label>
              ))}
            </div>
            {action ? (
              <div data-testid="fake-3ds" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Notice>Your bank asks you to confirm this payment (3-D Secure).</Notice>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button testId="fake-3ds-approve" onClick={() => void confirm(true)}>Complete authentication</Button>
                  <Button kind="danger" onClick={() => void confirm(false)}>Fail authentication</Button>
                </div>
              </div>
            ) : (
              <Button testId="fake-pay" onClick={() => void pay()}>Pay {formatMoney(s.amountDueToday, s.currency)}</Button>
            )}
            <a href={s.cancelUrl} style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Cancel and go back</a>
          </>
        )}
        {msg && <Notice tone={msg.tone} testId="fake-message">{msg.text}</Notice>}
      </div>
    </div>
  );
}

/** /billing/portal — the fake provider's customer portal: card updates only. */
export function FakePortal() {
  const [p, setP] = useState<{ id: string; returnUrl: string; card: string | null } | null>(null);
  const [card, setCard] = useState("success");
  const [msg, setMsg] = useState<string | null>(null);
  const id = qs("session");
  useEffect(() => {
    if (id) apiGet<{ id: string; returnUrl: string; card: string | null }>(`/api/billing/fake/portal/${id}`).then(setP).catch(() => setMsg("Portal session not found."));
  }, [id]);
  async function save() {
    const r = await apiPost<{ retried: number; paid: number }>(`/api/billing/fake/portal/${id}/card`, { card });
    setMsg(r.retried ? (r.paid ? "Card updated and your overdue invoice was paid." : "Card updated, but the overdue invoice still failed.") : "Card updated.");
  }
  return (
    <div className="card col-12" data-testid="fake-portal" style={{ maxWidth: 520, margin: "32px auto" }}>
      <div className="card-b" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <Notice tone="warn">{TEST_MODE_BANNER}</Notice>
        <h3 style={{ margin: 0 }}>Update payment method</h3>
        {p && <div style={{ fontSize: ".82rem" }}>Current card behaviour: <b>{p.card ? CARD_LABELS[p.card] : "none"}</b></div>}
        <div role="group" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.keys(CARD_LABELS).map((k) => (
            <button key={k} type="button" style={pill(card === k)} onClick={() => setCard(k)}>{CARD_LABELS[k]}</button>
          ))}
        </div>
        <Button testId="portal-save" onClick={() => void save()}>Save card</Button>
        {msg && <Notice>{msg}</Notice>}
        {p && <a href={p.returnUrl}>Back to Manage Plan</a>}
        <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>Plan changes and cancellation are on the Manage Plan page.</div>
      </div>
    </div>
  );
}
