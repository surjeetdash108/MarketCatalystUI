"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDownload } from "../backend";
import { refreshEntitlements, useEntitlements } from "../hooks/useEntitlements";
import {
  acceptRetention,
  billingSummary,
  cancelPlan,
  errorBody,
  fetchPlans,
  keepCurrentPlan,
  listTimeline,
  listInvoices,
  openPortal,
  resumePlan,
  retentionOffer,
  syncClaims,
  type BillingSummary,
  type TimelineEntry,
  type InvoiceRow,
  type RetentionOffer,
} from "../billing/api";
import { displayPrice, formatMoney, INTERVALS, isPaid, longDate, type BillingInterval, type CatalogPlan } from "../billing/catalog";
import { checkoutPath, parsePlanParams } from "../billing/plan-intent";
import { Button, Modal, Notice, PREVIEW_BANNER, pill } from "../billing/ui";
import { ManagePlanSoon } from "./manage-plan-soon";
import { StaffPlan } from "./manage-plan-extras";

/**
 * Manage Plan. While paid plans are unavailable it is the honest
 * "launching soon" screen; once subscriptions are live it is the billing
 * screen: plan cards, upgrade/downgrade with a preview, cancel (behind the
 * retention offer), resume, invoices, history and card updates.
 */
export function ManagePlanScreen() {
  const { data: ent, loading: entLoading } = useEntitlements();
  if (!ent) {
    if (entLoading) {
      return (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim-solid)" }}>
          <div
            style={{
              display: "inline-block",
              width: 24,
              height: 24,
              border: "2px solid rgba(255,255,255,0.15)",
              borderTopColor: "var(--brand, #22c55e)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ marginTop: 12, fontSize: ".85rem" }}>Loading subscription status…</p>
        </div>
      );
    }
    return <BillingScreen preview={false} />;
  }
  if (ent.staff && !ent.checkoutPreview) return <StaffPlan />;
  return <BillingScreen preview={ent.checkoutPreview === true} />;
}

type Dialog =
  | { kind: "retention"; offer: RetentionOffer }
  | { kind: "confirm-cancel" }
  | { kind: "done"; title: string; text: string };

const LIVE = ["ACTIVE", "TRIALING", "PAST_DUE"];

export function BillingScreen({ preview = false }: { preview?: boolean } = {}) {
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [{ plans: p }, s, inv, hist] = await Promise.all([
        fetchPlans(),
        billingSummary().catch((e) => {
          console.warn("billingSummary failed:", e);
          return null;
        }),
        listInvoices().catch(() => []),
        listTimeline().catch(() => []),
      ]);
      setPlans(p);
      setSummary(s);
      setInvoices(inv);
      setTimeline(hist);
      return { p, s };
    } catch (err) {
      console.error("reload failed:", err);
      setError("Unable to load billing data. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().then((res) => {
      if (!res) return;
      const { p, s } = res;
      const intent = typeof window !== "undefined" ? parsePlanParams(window.location.search, p.map((x) => x.id)) : null;
      if (intent) {
        setSelected(intent.planId);
        setInterval(intent.interval);
      } else if (s?.interval) setInterval(s.interval);
    });
  }, [reload]);

  if (loading && !summary) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim-solid)" }}>
        <div
          style={{
            display: "inline-block",
            width: 24,
            height: 24,
            border: "2px solid rgba(255,255,255,0.15)",
            borderTopColor: "var(--brand, #22c55e)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ marginTop: 12, fontSize: ".85rem" }}>Loading plans and subscription…</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
        {error && <Notice tone="error">{error}</Notice>}
        <p style={{ color: "var(--text-dim-solid)", marginTop: 16 }}>Unable to load your subscription summary.</p>
        <Button onClick={() => void reload()} style={{ marginTop: 12 }}>Retry</Button>
      </div>
    );
  }
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
    await syncClaims().catch(() => {});
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
    // Subscribers change plan on the checkout page: one payment step with the breakdown.
    window.location.href = checkoutPath({ planId: plan.id, interval });
  }

  async function startCancel() {
    const r = await run(() => retentionOffer());
    if (!r) return;
    setDialog(r.eligible ? { kind: "retention", offer: r.offer } : { kind: "confirm-cancel" });
  }

  async function doCancel() {
    const r = await run(() => cancelPlan());
    if (r) await afterChange("Your plan is cancelled", `You keep full access until ${longDate(r.endsAt)}, then your plan ends. No further charges.`);
  }

  async function keepWithDiscount() {
    const r = await run(() => acceptRetention());
    if (r) await afterChange("Thank you for trusting us", "Enjoy 50% off for the next 2 months.");
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
              <b>{subscribed ? summary.planName : "No plan"}</b>
              {subscribed && summary.interval ? (summary.interval === "annual" ? " · Annual" : " · Monthly") : ""}
              {summary.source === "launch_trial" ? " · launch trial" : ""}
            </div>
            {!subscribed && (
              <p style={{ margin: 0, fontSize: ".86rem", color: "var(--text-dim-solid)" }}>
                You do not have an active paid subscription. Select a plan below to get full access.
              </p>
            )}
            {summary.creditBalance > 0 && (
              <div data-testid="credit-balance" style={{ fontSize: ".88rem", color: "var(--text)" }}>Credits available: {formatMoney(summary.creditBalance, summary.nextCharge?.currency ?? "USD")}</div>
            )}
            {subscribed && summary.status === "TRIALING" && summary.currentPeriodEnd && !summary.endsAt && (
              <Notice testId="trial-active">Free trial until {longDate(summary.currentPeriodEnd)}. Cancel for free in your trial period.</Notice>
            )}
            {summary.renewsAt && <div data-testid="renews">Renews on {longDate(summary.renewsAt)}{summary.nextCharge ? ` for ${formatMoney(summary.nextCharge.amount, summary.nextCharge.currency)}` : ""}.</div>}
            {summary.endsAt && <Notice tone="warn" testId="ends">Your plan ends on {longDate(summary.endsAt)}. You keep full access until then.</Notice>}
            {summary.source === "launch_trial" && summary.currentPeriodEnd && <Notice testId="trial">You have complimentary {summary.planName} until {longDate(summary.currentPeriodEnd)}. Choose a plan to keep it.</Notice>}
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
              {subscribed && summary.hasBillingAccount && <Button kind="secondary" testId="update-card" onClick={() => void run(() => openPortal()).then((r) => r && (window.location.href = r.url))}>Update payment method</Button>}
            </div>
          </div>
        </div>

        {error && <Notice tone="error" testId="billing-error">{error}</Notice>}

        {subscribed && (
          <div className="card col-12" style={{ background: "linear-gradient(135deg, rgba(74, 222, 128, 0.08) 0%, rgba(34, 197, 94, 0.03) 100%)", border: "1px solid var(--brand-line, rgba(74, 222, 128, 0.3))" }}>
            <div className="card-b" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.2rem" }}>🎁</span>
                  <h4 style={{ margin: 0, color: "#fff", fontSize: "1rem", fontWeight: 700 }}>Refer a Friend &amp; Earn Referral Credits</h4>
                </div>
                <p style={{ margin: 0, fontSize: ".84rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  Give your friends credits off their subscription and get credits automatically deducted from your next monthly renewal.
                </p>
              </div>
              <a
                href="/refer-a-friend"
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  background: "var(--brand, #4ADE80)",
                  color: "var(--on-brand, #07080A)",
                  fontWeight: 800,
                  fontSize: ".84rem",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(74, 222, 128, 0.25)",
                }}
              >
                Get Referral Link →
              </a>
            </div>
          </div>
        )}

        <div className="card col-12">
          <div className="card-h">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Plans</h3>
              <span style={{ fontSize: ".84rem", color: "var(--text-dim-solid)", fontWeight: 500 }}>(Cancel anytime, no questions asked)</span>
            </div>
            <div role="group" aria-label="Billing period" style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {INTERVALS.map((i) => (
                <button key={i} type="button" aria-pressed={interval === i} style={pill(interval === i)} onClick={() => setInterval(i)}>{i === "monthly" ? "Monthly" : "Annual"}</button>
              ))}
            </div>
          </div>
          <div className="card-b" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {plans.filter(isPaid).map((p) => {
              const price = displayPrice(p, interval);
              const isCurrent = summary.planId === p.id && summary.interval === interval && subscribed;
              const rankCur = current?.sortOrder ?? 0;
              let label = `Choose ${p.name}`;
              if (subscribed) {
                if (p.id === summary.planId) label = interval === "annual" ? "Switch to annual" : "Switch to monthly";
                else label = `Switch to ${p.name}`;
              }
              return (
                <div key={p.id} data-testid={`card-${p.id}`} aria-current={isCurrent} className="card" style={{ border: `2px solid ${selected === p.id ? "var(--brand)" : "var(--border)"}`, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b style={{ color: "var(--text-hi)" }}>{p.name}</b>
                    {isCurrent && <span style={{ fontSize: ".66rem", fontWeight: 700, color: "var(--brand-2)" }}>YOUR PLAN</span>}
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{price ? `${price.perMonth}/mo` : formatMoney(0, p.currency)}</div>
                  <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                    {price ? price.billed : "—"}
                    {price?.savingPct ? ` · save ${price.savingPct}%` : ""}
                  </div>
                  <div style={{ fontSize: ".76rem", color: "var(--text)" }}>{p.description}</div>
                  {!isCurrent && (
                    <Button testId={`choose-${p.id}`} onClick={() => { setSelected(p.id); void choose(p); }} disabled={busy}>{label}</Button>
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
                    <td>
                      <div>{i.planName} · {i.interval}{i.reason === "subscription_update" ? " (prorated change)" : ""}</div>
                      {Array.isArray(i.lines) && i.lines.length > 0 && (
                        <div data-testid={`invoice-lines-${i.id}`} style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2, fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                          {i.lines.map((l, lIdx) => (
                            <div key={lIdx}>
                              • {l.description}: {formatMoney(l.amount, i.currency)}{l.proration ? " (prorated)" : ""}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{formatMoney(i.amount, i.currency)}{i.discountAmount ? ` (−${formatMoney(i.discountAmount)})` : ""}{i.creditApplied ? ` (credit −${formatMoney(i.creditApplied)})` : ""}</td>
                    <td style={{ textAlign: "center" }}>{i.status.toLowerCase()}</td>
                    <td><button type="button" className="btn" onClick={() => void apiDownload(i.documentPath, `invoice-${i.number}.html`)}>Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card col-12" id="history">
          <div className="card-h"><h3>Purchase history</h3></div>
          <div className="card-b" data-testid="history">
            {timeline.length === 0 ? (
              <div style={{ color: "var(--text-dim-solid)", fontSize: ".84rem" }}>No changes yet.</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl" data-testid="history-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Date &amp; time</th>
                      <th style={{ textAlign: "left" }}>What happened</th>
                      <th style={{ textAlign: "left" }}>Details</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((e, idx) => (
                      <tr key={`${e.at}-${idx}`} data-testid={`history-row-${e.kind}`}>
                        <td style={{ whiteSpace: "nowrap" }}>{dateTime(e.at)}</td>
                        <td style={{ color: "var(--text-hi)", fontWeight: 600 }}>{e.title}</td>
                        <td style={{ color: "var(--text-dim-solid)" }}>{e.detail ?? ""}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", color: e.amount != null && e.amount < 0 ? "var(--up)" : "var(--text)" }}>
                          {e.amount == null ? "" : e.amount < 0 ? `−${formatMoney(-e.amount, e.currency ?? "USD")}` : formatMoney(e.amount, e.currency ?? "USD")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {dialog?.kind === "retention" && (
        <RetentionChoice offer={dialog.offer} busy={busy} onKeep={() => void keepWithDiscount()} onCancel={() => void doCancel()} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "confirm-cancel" && (
        <Modal title="Cancel your plan?" onClose={() => setDialog(null)} testId="cancel-dialog">
          <div>You keep full access until {longDate(summary.currentPeriodEnd)}, then your plan ends. No further charges.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button testId="cancel-keep" onClick={() => setDialog(null)}>Keep my plan</Button>
            <Button kind="danger" testId="cancel-confirm" onClick={() => void doCancel()} disabled={busy}>Cancel my plan</Button>
          </div>
        </Modal>
      )}
      {dialog?.kind === "done" && (
        <Modal title={dialog.title} onClose={() => setDialog(null)} testId="done-dialog">
          <div data-testid="done-text">{dialog.text}</div>
          <div data-testid="done-email" style={{ fontSize: ".8rem", color: "var(--text-dim-solid)" }}>We&apos;ve emailed you a confirmation. It&apos;s also in your plan history below.</div>
          <Button onClick={() => setDialog(null)}>OK</Button>
        </Modal>
      )}
    </>
  );
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
        <Button testId="retention-keep" onClick={onKeep} disabled={busy} style={equal}>Keep my plan at 50%</Button>
        <Button kind="danger" testId="retention-cancel" onClick={onCancel} disabled={busy} style={equal}>Cancel my plan</Button>
      </div>
    </Modal>
  );
}

/** "Nov 12, 2026, 3:04 PM" in the viewer's time zone. */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
