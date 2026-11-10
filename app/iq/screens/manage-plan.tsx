"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDownload, apiPost } from "../backend";
import { refreshEntitlements, useEntitlements } from "../hooks/useEntitlements";
import {
  acceptRetention,
  applyChange,
  billingSummary,
  cancelPlan,
  errorBody,
  fetchPlans,
  keepCurrentPlan,
  listHistory,
  listInvoices,
  openPortal,
  previewChange,
  resumePlan,
  refundEligibility,
  requestRefund,
  retentionOffer,
  type RefundEligibility,
  type BillingSummary,
  type ChangePreview,
  type HistoryRow,
  type InvoiceRow,
  type RetentionOffer,
} from "../billing/api";
import { displayPrice, formatMoney, INTERVALS, isPaid, longDate, type BillingInterval, type CatalogPlan } from "../billing/catalog";
import { checkoutPath, parsePlanParams } from "../billing/plan-intent";
import { Button, Modal, Notice, PREVIEW_BANNER, pill } from "../billing/ui";
import { ManagePlanSoon } from "./manage-plan-soon";
import { REFUND_POLICY } from "../billing/refund-policy.generated";
import { ContactCard, StaffPlan } from "./manage-plan-extras";
import { handleStripeAction } from "../billing/checkout/stripe-payment-form";

/**
 * Manage Plan. While paid plans are unavailable it is the honest
 * "launching soon" screen; once subscriptions are live it is the billing
 * screen: plan cards, upgrade/downgrade with a preview, cancel (behind the
 * retention offer), resume, invoices, history and card updates.
 */
export function ManagePlanScreen() {
  const { data: ent } = useEntitlements();
  if (!ent) return null;
  // Staff see "Staff access" — except in the staff checkout preview, where the
  // plan picker opens for them (Stripe test mode, no real charges).
  if (ent.staff && !ent.checkoutPreview) return <StaffPlan />;
  if (!ent.paidPlansAvailable) return <ManagePlanSoon />;
  return <BillingScreen preview={ent.checkoutPreview === true} />;
}

type Dialog =
  | { kind: "preview"; preview: ChangePreview; plan: CatalogPlan }
  | { kind: "action"; actionId: string; amountDue: number }
  | { kind: "retention"; offer: RetentionOffer }
  | { kind: "confirm-cancel" }
  | { kind: "confirm-refund"; amount: number; currency: string }
  | { kind: "done"; title: string; text: string };

const LIVE = ["ACTIVE", "TRIALING", "PAST_DUE"];

export function BillingScreen({ preview = false }: { preview?: boolean } = {}) {
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState<RefundEligibility | null>(null);

  const reload = useCallback(async () => {
    const [{ plans: p }, s, inv, hist] = await Promise.all([fetchPlans(), billingSummary(), listInvoices(), listHistory()]);
    // The refund button exists only while REFUND_WINDOW_DAYS > 0 (the endpoint is 404 otherwise).
    if (REFUND_POLICY.enabled) setRefund(await refundEligibility().catch(() => null));
    setPlans(p);
    setSummary(s);
    setInvoices(inv);
    setHistory(hist);
    return { p, s };
  }, []);

  useEffect(() => {
    void reload().then(({ p, s }) => {
      const intent = typeof window !== "undefined" ? parsePlanParams(window.location.search, p.map((x) => x.id)) : null;
      if (intent) {
        setSelected(intent.planId);
        setInterval(intent.interval);
      } else if (s.interval) setInterval(s.interval);
    });
  }, [reload]);

  if (!summary) return null;
  const subscribed = !!summary.interval && summary.source !== "launch_trial" && LIVE.includes(summary.status);
  const current = plans.find((p) => p.id === summary.planId);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errorBody(e).message ?? "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function afterChange(title: string, text: string) {
    await refreshEntitlements();
    await reload();
    setDialog({ kind: "done", title, text });
  }

  async function choose(plan: CatalogPlan) {
    if (!subscribed) {
      // New subscription: the one purchase page (billing period, payment, consent).
      window.location.href = checkoutPath({ planId: plan.id, interval });
      return;
    }
    const preview = await run(() => previewChange({ planId: plan.id, interval }));
    if (preview) setDialog({ kind: "preview", preview, plan });
  }

  async function confirmChange(preview: ChangePreview, plan: CatalogPlan) {
    const r = await run(() => applyChange({ planId: plan.id, interval: preview.interval, ...(preview.kind === "upgrade" ? { expectedAmountDue: preview.amountDueNow, prorationDate: preview.prorationDate } : {}) }));
    if (!r) return;
    if (r.status === "requires_action" && r.clientSecret) {
      // Stripe: the bank's 3-D Secure challenge for the prorated invoice; the plan changes once paid.
      const ok = await handleStripeAction(r.clientSecret);
      if (ok) return afterChange(`You're on ${plan.name}`, "Payment confirmed. The new features are available now.");
      setError("Authentication failed. Your plan has not changed.");
      return;
    }
    if (r.status === "requires_action") return setDialog({ kind: "action", actionId: r.actionId, amountDue: r.amountDue });
    if (r.status === "scheduled") return afterChange("Change scheduled", `You keep ${current?.name ?? "your plan"} until ${longDate(r.effectiveAt)}, then move to ${plan.name}.`);
    return afterChange(`You're on ${plan.name}`, `Charged ${formatMoney(r.amountCharged)} today (prorated). The new features are available now.`);
  }

  async function confirmAction(actionId: string, approve: boolean) {
    const r = await run(() => apiPost<{ status: string }>(`/api/billing/fake/actions/${actionId}`, { approve }));
    if (r?.status === "complete") return afterChange("Payment confirmed", "Your plan has changed.");
    setDialog(null);
    setError("Authentication failed. Your plan has not changed.");
  }

  async function startCancel() {
    const r = await run(() => retentionOffer());
    if (!r) return;
    setDialog(r.eligible ? { kind: "retention", offer: r.offer } : { kind: "confirm-cancel" });
  }

  async function doCancel() {
    const r = await run(() => cancelPlan());
    if (r) await afterChange("Your plan is cancelled", `You keep full access until ${longDate(r.endsAt)}, then your account moves to Free. No further charges.`);
  }

  async function keepWithDiscount() {
    const r = await run(() => acceptRetention());
    if (r) await afterChange("Discount applied", `${r.description}. Your subscription stays active.`);
  }

  async function confirmRefund() {
    const r = await run(() => requestRefund());
    if (r) await afterChange("Refund on its way", `We've refunded ${formatMoney(r.amount, r.currency)}. Your plan has ended and you're on Free.`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Manage Plan</div>
          <div className="page-sub">Your plan, billing and invoices</div>
        </div>
      </div>
      <div className="dash" data-testid="billing-screen" style={{ maxWidth: 980, gap: 14, gridTemplateColumns: "1fr" }}>
        {preview && <div className="col-12"><Notice tone="warn" testId="billing-preview-banner">{PREVIEW_BANNER}</Notice></div>}
        <div className="card col-12">
          <div className="card-h"><h3>Current plan</h3></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div data-testid="current-plan" style={{ fontSize: "1.05rem", color: "var(--text-hi)" }}>
              <b>{summary.planName}</b>
              {summary.interval ? ` · ${summary.interval === "annual" ? "Annual" : "Monthly"}` : ""}
              {summary.source === "launch_trial" ? " · launch trial" : ""}
            </div>
            {summary.renewsAt && <div data-testid="renews">Renews on {longDate(summary.renewsAt)}{summary.nextCharge ? ` for ${formatMoney(summary.nextCharge.amount, summary.nextCharge.currency)}` : ""}.</div>}
            {summary.endsAt && <Notice tone="warn" testId="ends">Your plan ends on {longDate(summary.endsAt)}. You keep full access until then, then move to Free.</Notice>}
            {summary.source === "launch_trial" && summary.currentPeriodEnd && <Notice testId="trial">You have {summary.planName} free until {longDate(summary.currentPeriodEnd)}. Choose a plan to keep it.</Notice>}
            {summary.inGrace && <Notice tone="error" testId="grace">Your last payment failed. You keep access until {longDate(summary.graceEndsAt)} while we retry — update your card to avoid losing it.</Notice>}
            {summary.scheduledChange && (
              <Notice testId="scheduled">
                Changing to <b>{plans.find((p) => p.id === summary.scheduledChange?.planId)?.name ?? summary.scheduledChange.planId}</b> ({summary.scheduledChange.interval}) on {longDate(summary.scheduledChange.effectiveAt)}.{" "}
                <Button kind="secondary" testId="keep-plan" onClick={() => void run(() => keepCurrentPlan()).then((r) => r && afterChange("Plan kept", `You stay on ${current?.name}.`))}>Keep my current plan</Button>
              </Notice>
            )}
            {summary.discount && <div data-testid="discount">Discount: {summary.discount.source === "retention" ? "Retention offer" : summary.discount.code} — {summary.discount.description}{summary.discount.endsAt ? ` (until ${longDate(summary.discount.endsAt)})` : ""}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {subscribed && !summary.cancelAtPeriodEnd && <Button kind="danger" testId="cancel" onClick={() => void startCancel()} disabled={busy}>Cancel subscription</Button>}
              {subscribed && summary.cancelAtPeriodEnd && <Button testId="resume" onClick={() => void run(() => resumePlan()).then((r) => r && afterChange("Plan resumed", `Your plan renews on ${longDate(r.renewsAt)}.`))}>Resume subscription</Button>}
              {REFUND_POLICY.enabled && refund?.eligible && (
                <Button kind="secondary" testId="request-refund" disabled={busy} onClick={() => refund.eligible && setDialog({ kind: "confirm-refund", amount: refund.amount, currency: refund.currency })}>Request refund</Button>
              )}
              {summary.hasBillingAccount && <Button kind="secondary" testId="update-card" onClick={() => void run(() => openPortal()).then((r) => r && (window.location.href = r.url))}>Update card</Button>}
            </div>
          </div>
        </div>

        {error && <Notice tone="error" testId="billing-error">{error}</Notice>}

        <ContactCard />

        <div className="card col-12">
          <div className="card-h">
            <h3>Plans</h3>
            <div role="group" aria-label="Billing period" style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {INTERVALS.map((i) => (
                <button key={i} type="button" aria-pressed={interval === i} style={pill(interval === i)} onClick={() => setInterval(i)}>{i === "monthly" ? "Monthly" : "Annual"}</button>
              ))}
            </div>
          </div>
          <div className="card-b" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {plans.map((p) => {
              const price = isPaid(p) ? displayPrice(p, interval) : null;
              const isCurrent = summary.planId === p.id && (!isPaid(p) || summary.interval === interval) && (subscribed || !isPaid(p));
              const rankCur = current?.sortOrder ?? 0;
              let label = `Choose ${p.name}`;
              if (subscribed) {
                if (p.id === summary.planId) label = interval === "annual" ? "Switch to annual" : "Switch to monthly";
                else label = p.sortOrder > rankCur ? `Upgrade to ${p.name}` : `Downgrade to ${p.name}`;
              }
              return (
                <div key={p.id} data-testid={`card-${p.id}`} aria-current={isCurrent} className="card" style={{ border: `2px solid ${selected === p.id ? "var(--brand)" : "var(--border)"}`, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b style={{ color: "var(--text-hi)" }}>{p.name}</b>
                    {isCurrent && <span style={{ fontSize: ".66rem", fontWeight: 700, color: "var(--brand-2)" }}>YOUR PLAN</span>}
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{price ? `${price.perMonth}/mo` : formatMoney(0, p.currency)}</div>
                  <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                    {price ? price.billed : "Free forever"}
                    {price?.savingPct ? ` · save ${price.savingPct}%` : ""}
                  </div>
                  <div style={{ fontSize: ".76rem", color: "var(--text)" }}>{p.description}</div>
                  {isPaid(p) && !isCurrent && (
                    <Button testId={`choose-${p.id}`} onClick={() => { setSelected(p.id); void choose(p); }} disabled={busy}>{label}</Button>
                  )}
                  {!isPaid(p) && subscribed && !summary.cancelAtPeriodEnd && (
                    <Button kind="secondary" testId="choose-free" onClick={() => void startCancel()}>Move to Free</Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card col-12">
          <div className="card-h"><h3>Invoices</h3></div>
          <div className="tbl-wrap">
            <table className="tbl" data-testid="invoices">
              <thead><tr><th style={{ textAlign: "left" }}>Date</th><th style={{ textAlign: "left" }}>Plan</th><th>Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {invoices.length === 0 && <tr><td colSpan={5} style={{ color: "var(--text-dim-solid)" }}>No invoices yet.</td></tr>}
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>{longDate(i.date)}</td>
                    <td>{i.planName} · {i.interval}{i.reason === "subscription_update" ? " (prorated change)" : ""}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(i.amount, i.currency)}{i.discountAmount ? ` (−${formatMoney(i.discountAmount)})` : ""}{i.creditApplied ? ` (credit −${formatMoney(i.creditApplied)})` : ""}</td>
                    <td style={{ textAlign: "center" }}>{i.status.toLowerCase()}</td>
                    <td><button type="button" className="btn" onClick={() => void apiDownload(i.documentPath, `invoice-${i.number}.html`)}>Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card col-12">
          <div className="card-h"><h3>Plan history</h3></div>
          <div className="card-b" data-testid="history" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: ".8rem" }}>
            {history.length === 0 && <div style={{ color: "var(--text-dim-solid)" }}>No changes yet.</div>}
            {history.map((h, idx) => (
              <div key={idx}>{longDate(h.at)} — {h.type.replace(/_/g, " ")}{describe(h.to)}</div>
            ))}
          </div>
        </div>
      </div>

      {dialog?.kind === "preview" && (
        <Modal title={dialog.preview.kind === "upgrade" ? `Upgrade to ${dialog.plan.name}` : `Downgrade to ${dialog.plan.name}`} onClose={() => setDialog(null)} testId="preview-dialog">
          {dialog.preview.kind === "upgrade" ? (
            <div data-testid="preview-amount">You'll be charged <b>{formatMoney(dialog.preview.amountDueNow, dialog.preview.currency)}</b> today (prorated). Then {formatMoney(dialog.preview.nextRenewalAmount, dialog.preview.currency)} on {longDate(dialog.preview.nextRenewalDate)}.</div>
          ) : (
            <div data-testid="preview-amount">No charge today. You keep {current?.name} until {longDate(dialog.preview.effectiveAt)}, then move to {dialog.plan.name} at {formatMoney(dialog.preview.nextRenewalAmount, dialog.preview.currency)}.</div>
          )}
          {dialog.preview.cancelsPendingDowngrade && <Notice>This replaces your scheduled downgrade.</Notice>}
          {dialog.preview.resumesCancelledPlan && <Notice>This also resumes your cancelled plan.</Notice>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button testId="confirm-change" onClick={() => void confirmChange(dialog.preview, dialog.plan)} disabled={busy}>Confirm</Button>
            <Button kind="secondary" onClick={() => setDialog(null)}>Back</Button>
          </div>
        </Modal>
      )}
      {dialog?.kind === "action" && (
        <Modal title="Confirm your payment" testId="action-dialog">
          <div>Your bank needs you to confirm {formatMoney(dialog.amountDue)}.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button testId="action-approve" onClick={() => void confirmAction(dialog.actionId, true)}>Complete authentication</Button>
            <Button kind="danger" onClick={() => void confirmAction(dialog.actionId, false)}>Fail authentication</Button>
          </div>
        </Modal>
      )}
      {dialog?.kind === "retention" && (
        <RetentionChoice offer={dialog.offer} busy={busy} onKeep={() => void keepWithDiscount()} onCancel={() => void doCancel()} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "confirm-refund" && (
        <Modal title="Request a refund?" onClose={() => setDialog(null)} testId="refund-dialog">
          <div>{REFUND_POLICY.managePlanLine}</div>
          <div>You&apos;ll get {formatMoney(dialog.amount, dialog.currency)} back and your account moves to Free right away.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button kind="danger" testId="refund-confirm" onClick={() => void confirmRefund()} disabled={busy}>Refund and end my plan</Button>
            <Button kind="secondary" onClick={() => setDialog(null)}>Keep my plan</Button>
          </div>
        </Modal>
      )}
      {dialog?.kind === "confirm-cancel" && (
        <Modal title="Cancel your plan?" onClose={() => setDialog(null)} testId="cancel-dialog">
          <div>You keep full access until {longDate(summary.currentPeriodEnd)}, then your account moves to Free. No further charges.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button kind="danger" testId="cancel-confirm" onClick={() => void doCancel()} disabled={busy}>Cancel my plan</Button>
            <Button kind="secondary" onClick={() => setDialog(null)}>Keep my plan</Button>
          </div>
        </Modal>
      )}
      {dialog?.kind === "done" && (
        <Modal title={dialog.title} onClose={() => setDialog(null)} testId="done-dialog">
          <div data-testid="done-text">{dialog.text}</div>
          <Button onClick={() => setDialog(null)}>OK</Button>
        </Modal>
      )}
    </>
  );
}

function describe(to: unknown): string {
  if (!to || typeof to !== "object") return "";
  const t = to as Record<string, unknown>;
  if (t.planId) return `: ${String(t.planId)}${t.interval ? ` (${String(t.interval)})` : ""}`;
  if (t.endsAt) return `: ends ${longDate(String(t.endsAt))}`;
  if (t.renewsAt) return `: renews ${longDate(String(t.renewsAt))}`;
  if (t.source) return `: ${String(t.source)}`;
  return "";
}

/**
 * The retention offer: ONE screen, two equally prominent choices (same
 * component, same style, same width). Cancel goes straight to cancellation.
 */
export function RetentionChoice({ offer, busy, onKeep, onCancel, onClose }: { offer: RetentionOffer; busy: boolean; onKeep: () => void; onCancel: () => void; onClose?: () => void }) {
  const equal = { width: "100%" };
  return (
    <Modal title="Before you go" onClose={onClose} testId="retention-dialog">
      <div data-testid="retention-headline" style={{ fontSize: "1rem", color: "var(--text-hi)", fontWeight: 600 }}>{offer.headline}</div>
      <div data-testid="retention-description">{offer.description}.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Button testId="retention-keep" onClick={onKeep} disabled={busy} style={equal}>Keep my plan at 50% off</Button>
        <Button testId="retention-cancel" onClick={onCancel} disabled={busy} style={equal}>Cancel my plan</Button>
      </div>
    </Modal>
  );
}
