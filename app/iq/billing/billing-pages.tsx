"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../backend";
import { refreshEntitlements, useEntitlements } from "../hooks/useEntitlements";
import { checkoutStatus, errorBody, fetchPlans } from "./api";
import { formatMoney } from "./catalog";
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

/** /billing/success — polls until the event handler has activated the plan. */
export function BillingSuccess() {
  const { data: ent } = useEntitlements();
  const [view, setView] = useState<{ phase: "waiting" | "active" | "slow" | "error"; planId?: string }>({ phase: "waiting" });
  useEffect(() => {
    const session = qs("session");
    if (!session) {
      setView({ phase: "error" });
      return;
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
    <div className="card col-12" data-testid="billing-success" style={{ maxWidth: 520, margin: "32px auto" }}>
      <div className="card-b" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {ent?.checkoutPreview && <Notice tone="warn" testId="success-preview-banner">{PREVIEW_BANNER}</Notice>}
        {view.phase === "waiting" && <div data-testid="success-waiting">Payment received. Activating your plan…</div>}
        {view.phase === "active" && (
          <>
            <h2 style={{ margin: 0, color: "var(--text-hi)" }} data-testid="success-active">You're on {view.planId ? view.planId.charAt(0).toUpperCase() + view.planId.slice(1) : "your new plan"}</h2>
            <div>Your new features are ready.</div>
            <Link href="/dashboard">Go to your dashboard</Link>
          </>
        )}
        {view.phase === "slow" && <Notice tone="warn">Payment received; activation is taking longer than usual. We'll email you when it's ready — refresh this page in a minute.</Notice>}
        {view.phase === "error" && <Notice tone="error">This page needs a checkout session. <Link href="/manage-plan">Back to Manage Plan</Link></Notice>}
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
