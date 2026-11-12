"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { apiDelete, apiDownload, apiGet, apiPost } from "../../iq/backend";
import { errorBody } from "../../iq/billing/api";
import { formatMoney, longDate } from "../../iq/billing/catalog";
import { Button, Modal, Notice, pill } from "../../iq/billing/ui";
import { escapeHtml } from "../admin-metrics";
import { ADMIN_EMAIL } from "../admin-email";

interface Row { uid: string; name: string | null; email: string | null; planId: string; planName: string; interval: string | null; status: string; startedAt: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; promoCode: string | null; retentionUsed: boolean; mrrMinor: number; staff: boolean; legacyPro?: boolean; test?: boolean }
interface Promo { id: string; code: string; percentOff: number | null; amountOff: number | null; duration: string; durationInMonths: number | null; appliesToPlans: string[]; appliesToIntervals: string[]; expiresAt: string | null; maxRedemptions: number | null; timesRedeemed: number; firstTimeOnly: boolean; active: boolean }
interface Audit { actor: string; method: string; path: string; outcome: string; at: string }

const input: React.CSSProperties = { height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-hi)", padding: "0 8px" };

/** /admin/billing — subscribers, promo codes and the audit log. Admin account only. */
export function AdminBilling() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"subscribers" | "staff" | "promos" | "abandoned" | "audit">("subscribers");
  useEffect(() => {
    void firebaseAuth.authStateReady().then(() => setAllowed((firebaseAuth.currentUser?.email ?? "").toLowerCase() === ADMIN_EMAIL));
  }, []);
  if (allowed === null) return null;
  if (!allowed) return <Notice tone="error" testId="admin-denied">Admin account only.</Notice>;
  return (
    <div className="iq-root" data-theme="dark" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "24px 0" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }} data-testid="admin-billing">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h2 style={{ margin: 0, color: "var(--text-hi)" }}>Billing</h2>
        <div style={{ marginLeft: 16, display: "flex", gap: 6 }}>
          {(["subscribers", "staff", "promos", "audit"] as const).map((t) => (
            <button key={t} type="button" style={pill(tab === t)} onClick={() => setTab(t)} data-testid={`tab-${t}`}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
          <button type="button" style={pill(tab === "abandoned")} onClick={() => setTab("abandoned")} data-testid="tab-abandoned">Didn&apos;t finish signing up</button>
        </div>
        <a href="/admin" style={{ marginLeft: "auto", fontSize: ".8rem" }}>← Admin console</a>
      </div>
      <TestClock />
      {tab === "subscribers" && <Subscribers />}
      {tab === "staff" && <StaffAccess />}
      {tab === "promos" && <Promos />}
      {tab === "abandoned" && <AbandonedCheckouts />}
      {tab === "audit" && <AuditLog />}
    </div>
    </div>
  );
}

function TestClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    apiGet<{ now: string }>("/api/billing/fake/clock").then((r) => setNow(r.now)).catch(() => setNow(null));
  }, []);
  if (!now) return null; // only with the fake provider
  const advance = async (days: number) => setNow((await apiPost<{ now: string }>("/api/billing/fake/clock/advance", { days })).now);
  return (
    <Notice tone="warn" testId="test-clock">
      Fake billing provider · simulated time {new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC{" "}
      {[1, 7, 31, 366].map((d) => (
        <button key={d} type="button" className="btn" style={{ marginLeft: 6 }} onClick={() => void advance(d)}>+{d}d</button>
      ))}
    </Notice>
  );
}

function Subscribers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [f, setF] = useState({ q: "", plan: "", status: "", interval: "", cancelAtPeriodEnd: "", promo: "", staff: "" });
  const [counts, setCounts] = useState<{ subscriberCount: number; staffCount: number; testCount: number }>({ subscriberCount: 0, staffCount: 0, testCount: 0 });
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const load = useCallback(async () => {
    const r = await apiGet<{ subscribers: Row[]; totalMrrMinor: number; subscriberCount: number; staffCount: number; testCount?: number }>(`/api/admin/billing/subscribers${query ? `?${query}` : ""}`);
    setRows(r.subscribers);
    setTotal(r.totalMrrMinor);
    setCounts({ subscriberCount: r.subscriberCount ?? 0, staffCount: r.staffCount ?? 0, testCount: r.testCount ?? 0 });
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
  const sel = (k: keyof typeof f, opts: string[]) => (
    <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={input} aria-label={k}>
      <option value="">{k}: all</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <>
    <div className="card" data-testid="subscribers">
      <div className="card-b" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search name or email" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} style={{ ...input, width: 220 }} data-testid="sub-search" />
        {sel("plan", ["starter", "pro", "elite"])}
        {sel("status", ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED", "EXPIRED", "NONE"])}
        {sel("interval", ["monthly", "annual"])}
        {sel("cancelAtPeriodEnd", ["true", "false"])}
        {sel("staff", ["true", "false"])}
        <input placeholder="Promo code" value={f.promo} onChange={(e) => setF({ ...f, promo: e.target.value })} style={{ ...input, width: 120 }} />
        <Button kind="secondary" testId="sub-csv" onClick={() => void apiDownload(`/api/admin/billing/subscribers?${query ? `${query}&` : ""}format=csv`, "subscribers.csv")}>Export CSV</Button>
        <span style={{ marginLeft: "auto", fontSize: ".82rem" }} data-testid="sub-mrr">{rows.length} shown · {counts.subscriberCount} paying (staff and test excluded){counts.testCount ? ` · ${counts.testCount} test` : ""} · MRR {formatMoney(total)}</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>{["Name", "Email", "Plan", "Interval", "Status", "Start", "Period end", "Cancels", "Promo", "Retention", "MRR"].map((h) => <th key={h} style={{ textAlign: "left" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid} onClick={() => void apiGet<Record<string, unknown>>(`/api/admin/billing/subscribers/${r.uid}`).then(setDetail)} style={{ cursor: "pointer" }}>
                <td>{r.name ?? "—"}{r.staff && <span data-testid="staff-badge" style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 99, fontSize: ".64rem", fontWeight: 700, background: "var(--brand-dim)", color: "var(--brand-2)", border: "1px solid var(--brand)" }}>Staff</span>}{r.legacyPro && <span data-testid="legacy-pro-badge" title="Pre-billing manual Pro grant: Pro for 90 days at launch, then normal plans" style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 99, fontSize: ".64rem", fontWeight: 700, background: "var(--surface-3)", color: "var(--warn)", border: "1px solid var(--warn)" }}>Legacy Pro</span>}{r.test && <TestBadge />}</td><td>{r.email ?? "—"}</td><td>{r.planName}</td><td>{r.interval ?? "—"}</td><td>{r.status.toLowerCase()}</td>
                <td>{r.startedAt ? longDate(r.startedAt) : "—"}</td><td>{r.currentPeriodEnd ? longDate(r.currentPeriodEnd) : "—"}</td>
                <td>{r.cancelAtPeriodEnd ? "yes" : ""}</td><td>{r.promoCode ?? ""}</td><td>{r.retentionUsed ? "used" : ""}</td><td style={{ textAlign: "right" }}>{r.mrrMinor ? formatMoney(r.mrrMinor) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
      {detail && (
        <Modal title={`${String(detail.name ?? detail.email ?? detail.uid)}`} onClose={() => setDetail(null)} testId="sub-detail">
          <div style={{ fontSize: ".8rem" }}>{String(detail.planName)} · {String(detail.status).toLowerCase()} · MRR {formatMoney(Number(detail.mrrMinor ?? 0))}</div>
          {detail.creditBalance != null && Number(detail.creditBalance) > 0 && (
            <div data-testid="sub-credit-balance" style={{ fontSize: ".8rem", color: "var(--brand-2)", fontWeight: 600 }}>
              Account credit balance: {formatMoney(Number(detail.creditBalance))}
            </div>
          )}
          <SubscriberContact detail={detail} onRefunded={() => void apiGet<Record<string, unknown>>(`/api/admin/billing/subscribers/${String(detail.uid)}`).then(setDetail).then(load)} />
          <b>Invoices</b>
          {(detail.invoices as Array<Record<string, unknown>>).map((i) => (
            <div key={String(i.paymentId)} style={{ fontSize: ".78rem", borderBottom: "1px solid var(--border-soft)", paddingBottom: 4 }}>
              <div>{longDate(String(i.paymentDate))} · {String(i.planName)} · {formatMoney(Number(i.amount))} · {String(i.paymentStatus)}</div>
              {Array.isArray(i.lines) && i.lines.length > 0 && (
                <div data-testid={`admin-invoice-lines-${String(i.paymentId)}`} style={{ paddingLeft: 8, fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                  {(i.lines as Array<{ description?: string; amount?: number; proration?: boolean }>).map((l, lIdx) => (
                    <div key={lIdx}>↳ {l.description ?? "Line"}: {formatMoney(Number(l.amount ?? 0))}{l.proration ? " (prorated)" : ""}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <b>Plan history</b>
          <table className="tbl" data-testid="admin-timeline" style={{ fontSize: ".78rem" }}>
            <tbody>
              {((detail.timeline ?? []) as Array<{ at: string; title: string; detail: string | null; amount: number | null; currency: string | null }>).map((e, k) => (
                <tr key={k}>
                  <td style={{ whiteSpace: "nowrap" }}>{when(e.at)}</td>
                  <td style={{ color: "var(--text-hi)" }}>{e.title}{e.detail ? <div style={{ color: "var(--text-dim-solid)" }}>{e.detail}</div> : null}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{e.amount == null ? "" : e.amount < 0 ? `−${formatMoney(-e.amount, e.currency ?? "USD")}` : formatMoney(e.amount, e.currency ?? "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <b>Entitlements</b>
          <div style={{ fontSize: ".74rem" }}>{Object.entries(detail.entitlements as Record<string, boolean>).filter(([, v]) => v).map(([k]) => escapeHtml(k)).join(", ")}</div>
        </Modal>
      )}
    </>
  );
}

function Promos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [form, setForm] = useState({ code: "", type: "percent", value: "10", duration: "once", months: "3", plans: [] as string[], intervals: [] as string[], expiresAt: "", maxRedemptions: "", firstTimeOnly: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<{ code: string; rows: Array<Record<string, unknown>> } | null>(null);
  const load = useCallback(async () => setPromos((await apiGet<{ promos: Promo[] }>("/api/admin/billing/promos")).promos), []);
  useEffect(() => {
    void load();
  }, [load]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  async function create() {
    setMsg(null);
    try {
      await apiPost("/api/admin/billing/promos", {
        code: form.code,
        ...(form.type === "percent" ? { percentOff: Number(form.value) } : { amountOff: Math.round(Number(form.value) * 100) }),
        duration: form.duration,
        ...(form.duration === "repeating" ? { durationInMonths: Number(form.months) } : {}),
        appliesToPlans: form.plans,
        appliesToIntervals: form.intervals,
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
        ...(form.maxRedemptions ? { maxRedemptions: Number(form.maxRedemptions) } : {}),
        firstTimeOnly: form.firstTimeOnly,
      });
      setMsg(`Created ${form.code.toUpperCase()}.`);
      setForm({ ...form, code: "" });
      await load();
    } catch (e) {
      setMsg(errorBody(e).message ?? "Could not create the code.");
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="promos">
      <div className="card">
        <div className="card-h"><h3>New promo code</h3></div>
        <div className="card-b" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: ".8rem" }}>
          <input placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} style={{ ...input, width: 130 }} data-testid="promo-code" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={input}><option value="percent">% off</option><option value="fixed">$ off</option></select>
          <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ ...input, width: 70 }} aria-label="value" />
          <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} style={input} aria-label="duration"><option value="once">once</option><option value="repeating">N months</option><option value="forever">forever</option></select>
          {form.duration === "repeating" && <input value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} style={{ ...input, width: 50 }} aria-label="months" />}
          {["starter", "pro", "elite"].map((p) => <label key={p}><input type="checkbox" checked={form.plans.includes(p)} onChange={() => setForm({ ...form, plans: toggle(form.plans, p) })} /> {p}</label>)}
          {["monthly", "annual"].map((i) => <label key={i}><input type="checkbox" checked={form.intervals.includes(i)} onChange={() => setForm({ ...form, intervals: toggle(form.intervals, i) })} /> {i}</label>)}
          <label>expires <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} style={input} /></label>
          <input placeholder="max uses" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} style={{ ...input, width: 80 }} />
          <label><input type="checkbox" checked={form.firstTimeOnly} onChange={(e) => setForm({ ...form, firstTimeOnly: e.target.checked })} /> first-time customers only</label>
          <Button testId="promo-create" onClick={() => void create()} disabled={!form.code}>Create</Button>
          {msg && <span data-testid="promo-msg">{msg}</span>}
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>{["Code", "Discount", "Duration", "Plans", "Intervals", "Expires", "Used", "First-time", "Status", ""].map((h) => <th key={h} style={{ textAlign: "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.code}</b></td>
                  <td>{p.percentOff != null ? `${p.percentOff}%` : formatMoney(p.amountOff ?? 0)}</td>
                  <td>{p.duration === "repeating" ? `${p.durationInMonths} months` : p.duration}</td>
                  <td>{p.appliesToPlans.join(", ") || "all"}</td><td>{p.appliesToIntervals.join(", ") || "both"}</td>
                  <td>{p.expiresAt ? longDate(p.expiresAt) : "—"}</td>
                  <td><button type="button" className="btn" onClick={() => void apiGet<{ redemptions: Array<Record<string, unknown>> }>(`/api/admin/billing/promos/${p.id}/redemptions`).then((r) => setRedemptions({ code: p.code, rows: r.redemptions }))}>{p.timesRedeemed}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}</button></td>
                  <td>{p.firstTimeOnly ? "yes" : ""}</td>
                  <td>{p.active ? "active" : "inactive"}</td>
                  <td>{p.active && <button type="button" className="btn" data-testid={`deactivate-${p.code}`} onClick={() => void apiPost(`/api/admin/billing/promos/${p.id}/deactivate`).then(load)}>Deactivate</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {redemptions && (
        <Modal title={`Redemptions of ${redemptions.code}`} onClose={() => setRedemptions(null)} testId="redemptions">
          {redemptions.rows.length === 0 && <div>None yet.</div>}
          {redemptions.rows.map((r) => <div key={String(r.id)} style={{ fontSize: ".8rem" }}>{longDate(String(r.redeemedAt))} · {String(r.uid)} · {String(r.planId)} ({String(r.interval)})</div>)}
        </Modal>
      )}
    </div>
  );
}

function AuditLog() {
  const [rows, setRows] = useState<Audit[]>([]);
  useEffect(() => {
    apiGet<{ audit: Audit[] }>("/api/admin/billing/audit").then((r) => setRows(r.audit)).catch(() => setRows([]));
  }, []);
  return (
    <div className="card" data-testid="audit">
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>{["When", "Who", "Action", "Outcome"].map((h) => <th key={h} style={{ textAlign: "left" }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{new Date(r.at).toISOString().slice(0, 16).replace("T", " ")}</td><td>{r.actor}</td><td>{r.method} {r.path}</td><td>{r.outcome}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Phone (masked except the last 4; reveal is audited), renewal consent, billing region and the refund action. */
function SubscriberContact({ detail, onRefunded }: { detail: Record<string, unknown>; onRefunded: () => void }) {
  const uid = String(detail.uid);
  const [phone, setPhone] = useState<string | null>(null);
  const [refund, setRefund] = useState<{ eligible: boolean; amount?: number; currency?: string; reason?: string } | null | "off">(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    apiGet<{ eligible: boolean; amount?: number; currency?: string; reason?: string }>(`/api/admin/billing/subscribers/${uid}/refund`)
      .then(setRefund)
      .catch((e) => setRefund(errorBody(e).status === 404 ? "off" : null));
  }, [uid]);
  const consent = detail.consent as Record<string, unknown> | null;
  const region = detail.billingRegion as Record<string, unknown> | null;
  return (
    <div data-testid="sub-contact" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: ".78rem" }}>
      <div>
        <b>Mobile</b>{" "}
        <span data-testid="sub-phone">{phone ?? (detail.phoneMasked as string | null) ?? "—"}</span>{" "}
        {detail.phoneMasked && !phone ? (
          <button type="button" className="btn" data-testid="sub-phone-reveal" onClick={() => void apiPost<{ phone: string | null }>(`/api/admin/billing/subscribers/${uid}/phone/reveal`).then((r) => setPhone(r.phone))}>Reveal (audited)</button>
        ) : null}
      </div>
      {region && <div><b>Billing region</b> {[region.postalCode, region.state, region.country].filter(Boolean).join(", ")}</div>}
      <div data-testid="sub-consent">
        <b>Renewal consent</b>{" "}
        {consent ? `${longDate(String(consent.acceptedAt))} · v${String(consent.version)} · ${String(consent.planId)} ${String(consent.interval)} at ${formatMoney(Number(consent.price), String(consent.currency ?? "USD"))} · IP ${String(consent.ip ?? "—")}` : "—"}
      </div>
      {refund !== "off" && refund?.eligible && (
        <div>
          <Button kind="danger" testId="sub-refund" onClick={() => void apiPost<{ amount: number }>(`/api/admin/billing/subscribers/${uid}/refund`).then((r) => { setMsg(`Refunded ${formatMoney(r.amount)}; the plan has ended.`); onRefunded(); }).catch((e) => setMsg(errorBody(e).message ?? "Refund failed."))}>
            Refund {formatMoney(Number(refund.amount ?? 0), refund.currency ?? "USD")} and end the plan
          </Button>
        </div>
      )}
      {msg && <Notice testId="sub-refund-msg">{msg}</Notice>}
    </div>
  );
}

/** The staff allowlist (config/staff_access): full access, never billed, not admin. Every change is audited. */
function StaffAccess() {
  const [emails, setEmails] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => apiGet<{ emails: string[] }>("/api/admin/staff-access").then((r) => setEmails(r.emails)), []);
  useEffect(() => {
    void load();
  }, [load]);
  const add = async () => {
    setErr(null);
    try {
      setEmails((await apiPost<{ emails: string[] }>("/api/admin/staff-access", { email })).emails);
      setEmail("");
    } catch (e) {
      setErr(errorBody(e).message ?? "Couldn't add.");
    }
  };
  const remove = async (e: string) => setEmails((await apiDelete<{ emails: string[] }>(`/api/admin/staff-access/${encodeURIComponent(e)}`)).emails);
  return (
    <div className="card" data-testid="staff-access">
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
          Staff get every feature and are never billed. Access needs a verified email (Google, or a verified email/password account). Staff is not admin. Changes take effect at the user&apos;s next sign-in or token refresh, and are recorded in the audit log.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, width: 280 }} data-testid="staff-email" />
          <Button testId="staff-add" onClick={() => void add()} disabled={!email.trim()}>Add</Button>
        </div>
        {err && <Notice tone="error">{err}</Notice>}
        <table className="tbl" data-testid="staff-list">
          <thead><tr><th style={{ textAlign: "left" }}>Email</th><th /></tr></thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e}><td>{e}</td><td style={{ textAlign: "right" }}><Button kind="danger" testId={`staff-remove-${e}`} onClick={() => void remove(e)}>Remove</Button></td></tr>
            ))}
            {!emails.length && <tr><td colSpan={2} style={{ color: "var(--text-dim-solid)" }}>No staff accounts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Stripe test mode (livemode:false): never counted in MRR, revenue or subscribers; purgeable. */
export function TestBadge() {
  return (
    <span data-testid="test-badge" title="Stripe test mode: no real charge; excluded from MRR, revenue and counts" style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 99, fontSize: ".64rem", fontWeight: 700, background: "var(--surface-3)", color: "var(--text-dim-solid)", border: "1px dashed var(--border)" }}>
      Test
    </span>
  );
}

interface FunnelDropOff {
  uid: string;
  email: string | null;
  name: string | null;
  planId: string | null;
  interval: string | null;
  step: string;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  attempts: number;
  signedUpAt: string | null;
}
interface FunnelNoPlan {
  uid: string;
  email: string | null;
  name: string | null;
  signedUpAt: string | null;
  introEndsAt: string | null;
}

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

/**
 * People who tried to sign up but didn't: who reached the payment page and
 * stopped (plan, attempts, first/last time), and who created an account but
 * never chose a plan. Subscribers and staff are excluded by the backend.
 */
function AbandonedCheckouts() {
  const [dropOffs, setDropOffs] = useState<FunnelDropOff[]>([]);
  const [noPlan, setNoPlan] = useState<FunnelNoPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ checkoutAbandoned?: FunnelDropOff[]; signedUpNoPlan?: FunnelNoPlan[] }>("/api/admin/billing/abandoned")
      .then((r) => {
        setDropOffs(r.checkoutAbandoned ?? []);
        setNoPlan(r.signedUpNoPlan ?? []);
      })
      .catch(() => {
        setDropOffs([]);
        setNoPlan([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const who = (x: { email: string | null; name: string | null; uid: string }) => (
    <td>
      <div style={{ fontWeight: 600, color: "var(--text-hi)" }}>{x.name || x.email || x.uid}</div>
      <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{x.name ? x.email : x.uid}</div>
    </td>
  );

  return (
    <div className="card" data-testid="abandoned-checkouts">
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Reached the payment page, didn&apos;t subscribe ({dropOffs.length})</h3>
              <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", marginBottom: 8 }}>The plan they picked last, how many times they opened the payment page, and when.</div>
              <table className="tbl" data-testid="abandoned-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Person</th>
                    <th style={{ textAlign: "left" }}>Plan</th>
                    <th style={{ textAlign: "left" }}>Signed up</th>
                    <th style={{ textAlign: "left" }}>First attempt</th>
                    <th style={{ textAlign: "left" }}>Last attempt</th>
                    <th style={{ textAlign: "right" }}>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {dropOffs.map((l) => (
                    <tr key={l.uid} data-testid="dropoff-row">
                      {who(l)}
                      <td style={{ textTransform: "capitalize" }}>{l.planId ?? "—"}{l.interval ? ` · ${l.interval}` : ""}</td>
                      <td>{when(l.signedUpAt)}</td>
                      <td>{when(l.firstAttemptAt)}</td>
                      <td>{when(l.lastAttemptAt)}</td>
                      <td style={{ textAlign: "right" }}>{l.attempts}</td>
                    </tr>
                  ))}
                  {!dropOffs.length && (
                    <tr><td colSpan={6} style={{ color: "var(--text-dim-solid)", textAlign: "center", padding: "20px 0" }}>Nobody right now.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Signed up, never chose a plan ({noPlan.length})</h3>
              <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", marginBottom: 8 }}>Accounts with no subscription that never opened the payment page.</div>
              <table className="tbl" data-testid="noplan-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Person</th>
                    <th style={{ textAlign: "left" }}>Signed up</th>
                    <th style={{ textAlign: "left" }}>Intro ends</th>
                  </tr>
                </thead>
                <tbody>
                  {noPlan.map((u) => (
                    <tr key={u.uid} data-testid="noplan-row">
                      {who(u)}
                      <td>{when(u.signedUpAt)}</td>
                      <td>{when(u.introEndsAt)}</td>
                    </tr>
                  ))}
                  {!noPlan.length && (
                    <tr><td colSpan={3} style={{ color: "var(--text-dim-solid)", textAlign: "center", padding: "20px 0" }}>Nobody right now.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
