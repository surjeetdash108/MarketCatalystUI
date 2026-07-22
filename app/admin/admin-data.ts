import { collection, getDocs } from "firebase/firestore";
import { firebaseDb } from "../firebase";
import { TRACKED_FEATURES, FEATURE_LABEL, FEATURE_GROUP } from "../iq/feature-adoption";
import { ENTITLEMENTS } from "../iq/entitlements";

/**
 * Builds the admin console's dataset from real Firestore data.
 *
 * The console (`public/admin/console.html`) is a standalone static page that
 * renders once at module scope from a `USERS` array. Rather than rewrite ~600
 * lines of its rendering code, this produces rows in exactly that shape and
 * stages them in sessionStorage before the iframe loads — the console picks
 * them up and renders real numbers through its existing views.
 *
 * Anything genuinely unavailable is reported as 0/null rather than estimated.
 * The console's own demo generator invented watchlist counts, API calls and LTV
 * from a PRNG; carrying those forward against real users would be worse than
 * showing zero, because they would look authoritative.
 */

/**
 * Human labels for the entitlement keys, for the console's per-plan editor.
 * Kept beside the keys themselves so a new entitlement cannot ship without one.
 */
export const ENTITLEMENT_CATALOG = ENTITLEMENTS.map(e => ({
  key: e.key,
  label: e.label,
  description: e.description,
  group: e.group,
  staffOnly: e.staffOnly === true,
  unbuilt: e.unbuilt === true,
}));

const AVATAR_COLORS = [
  "#7c6cf5", "#38d6e6", "#2fe6a6", "#ffb547", "#ff5d7a", "#9d8dff", "#5bd0ff", "#ff8a5b",
];

/**
 * The single fixed admin account. One definition, imported by page.tsx, so the
 * gate and the metric exclusion can never disagree about who the admin is.
 * Mirrors ADMIN_EMAIL in the backend's deploy/env.production.yaml.
 */
export const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@marketcatalyst.ai"
).toLowerCase();

/**
 * Staff accounts are excluded from every metric.
 *
 * The admin is not a customer: counting it adds a phantom user to Total Users,
 * shifts Plan-mix percentages, drags ARPU down (it pays nothing), and changes
 * the churn denominator. With a customer base this small a single staff row
 * moves the headline numbers by 20%+, so the exclusion is not cosmetic.
 *
 * A set rather than one string so support/QA accounts can be added later
 * without touching call sites.
 */
const STAFF_EMAILS = new Set<string>([ADMIN_EMAIL]);

export function isStaffAccount(email: string | null | undefined): boolean {
  return !!email && STAFF_EMAILS.has(email.trim().toLowerCase());
}

export interface ConsoleUserRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  mrr: number;
  color: string;
  initials: string;
  country: string;
  joined: string;      // ISO — revived to Date inside the console
  lastActive: string;  // ISO
  watchlists: number;
  holdings: number;
  apiCalls: number;
  alerts: number;
  renewsIn: number | null;
  ltv: number;
}

export interface FeatureAdoptionRow {
  feature: string;
  label: string;
  /** Section heading in the admin panel (Intelligence, Charting, …). */
  group: string;
  /** Total opens across all users. */
  opens: number;
  /** Distinct users who opened it — the adoption number that matters. */
  users: number;
  lastOpened: string | null;
  /** True when the feature is tracked but has never been opened. */
  neverOpened: boolean;
}

export interface ConsolePlanRow {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  /** Entitlement key → granted. Editable from the console. */
  featureFlags: Record<string, boolean>;
  active: boolean;
  sortOrder: number;
}

export interface ConsoleDataset {
  users: ConsoleUserRow[];
  /** Full plans, so the console can render and edit per-plan entitlements. */
  plans: ConsolePlanRow[];
  /** The entitlement catalog: label, one-line description, group and the
   *  staffOnly / unbuilt markers the editor renders. Includes every key, so a
   *  plan document missing one still shows it as an off toggle. */
  entitlementCatalog: typeof ENTITLEMENT_CATALOG;
  /** Where the Monitor tab loads the backend's own ops UI from. */
  backendUrl: string | null;
  featureAdoption: FeatureAdoptionRow[];
  /** Plan display name → monthly price in MAJOR units, for the console's MRR maths. */
  price: Record<string, number>;
  generatedAt: string;
  counts: {
    users: number;
    payments: number;
    plans: number;
    /** Staff rows filtered out of every figure above — surfaced so the
     *  exclusion is auditable rather than an invisible discrepancy between
     *  the Firebase console's user count and this one. */
    excludedStaff: number;
  };
}

/** The console's status vocabulary, lower-case. */
function toConsoleStatus(status: string): string {
  switch (status) {
    case "ACTIVE": return "active";
    case "TRIALING": return "trialing";
    case "PAST_DUE": return "past_due";
    case "CANCELLED": return "canceled";
    case "EXPIRED": return "canceled";
    default: return "active"; // free users with no subscription read as active
  }
}

function initialsOf(name: string, email: string): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T23:59:59Z` : iso);
  if (Number.isNaN(t)) return null;
  const d = Math.ceil((t - Date.now()) / 86_400_000);
  return d >= 0 ? d : null;
}

/**
 * Monthly-equivalent price in major units, so a yearly plan does not overstate
 * MRR 12×.
 *
 * Rounded to 2dp: money is never displayed at full float precision, and a
 * yearly plan divided by 12 rarely lands on a clean cent — an unrounded value
 * surfaced in the console as "$166.58333333333334". Rounding here rather than
 * only at the formatter keeps every downstream sum (MRR, ARR, ARPU) on clean
 * cents too, so the totals cannot drift from what each row displays.
 */
function monthlyMajor(amountMinor: number, billingCycle: string): number {
  const major = (amountMinor ?? 0) / 100;
  const monthly =
    billingCycle === "yearly" ? major / 12 : billingCycle === "monthly" ? major : 0;
  return Math.round(monthly * 100) / 100;
}

/**
 * Adoption per feature, rolled up from the per-(feature,user) documents.
 *
 * Every TRACKED_FEATURE appears in the result even with zero opens — "which
 * features does nobody use" is the question this data exists to answer, and a
 * feature absent from the list would be invisible rather than obviously unused.
 */
function rollUpAdoption(
  docs: Array<{ feature?: string; userId?: string; openCount?: number; lastOpened?: string }>,
): FeatureAdoptionRow[] {
  const byFeature = new Map<string, { opens: number; users: Set<string>; last: string | null }>();

  for (const d of docs) {
    if (!d.feature) continue;
    const cur = byFeature.get(d.feature) ?? { opens: 0, users: new Set<string>(), last: null };
    cur.opens += typeof d.openCount === "number" ? d.openCount : 0;
    if (d.userId) cur.users.add(d.userId);
    if (d.lastOpened && (!cur.last || d.lastOpened > cur.last)) cur.last = d.lastOpened;
    byFeature.set(d.feature, cur);
  }

  // Union of tracked features and anything recorded — a feature renamed in the
  // nav would otherwise drop its historical rows silently.
  const keys = new Set<string>([
    ...TRACKED_FEATURES.map(f => f.key),
    ...byFeature.keys(),
  ]);

  return [...keys]
    .map(key => {
      const agg = byFeature.get(key);
      return {
        feature: key,
        label: FEATURE_LABEL.get(key) ?? key,
        group: FEATURE_GROUP.get(key) ?? "Other",
        opens: agg?.opens ?? 0,
        users: agg?.users.size ?? 0,
        lastOpened: agg?.last ?? null,
        neverOpened: !agg || agg.opens === 0,
      };
    })
    .sort((a, b) => b.opens - a.opens || a.label.localeCompare(b.label));
}

export async function buildAdminDataset(): Promise<ConsoleDataset> {
  const [userSnap, planSnap, paySnap, adoptionSnap] = await Promise.all([
    getDocs(collection(firebaseDb, "users")),
    getDocs(collection(firebaseDb, "plans")),
    getDocs(collection(firebaseDb, "payments")).catch(() => null),
    getDocs(collection(firebaseDb, "feature_adoption")).catch(() => null),
  ]);

  const plans = planSnap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as Array<{
    id: string; name?: string; amount?: number; billingCycle?: string;
  }>;
  const planById = new Map(plans.map(p => [p.id, p]));

  const price: Record<string, number> = {};
  for (const p of plans) {
    price[p.name ?? p.id] = monthlyMajor(p.amount ?? 0, p.billingCycle ?? "none");
  }

  // Lifetime value = what this user has actually paid. Not modelled or
  // projected — an empty payments collection yields 0, which is the truth.
  const paidByUser = new Map<string, number>();
  for (const d of paySnap?.docs ?? []) {
    const p = d.data() as { userId?: string; amount?: number; paymentStatus?: string };
    if (p.paymentStatus !== "SUCCESS" || !p.userId) continue;
    paidByUser.set(p.userId, (paidByUser.get(p.userId) ?? 0) + (p.amount ?? 0) / 100);
  }

  // Drop staff BEFORE any row is built, so no downstream total can accidentally
  // include them — the console derives every KPI from this one array.
  const customerDocs = userSnap.docs.filter(
    d => !isStaffAccount((d.data() as { email?: string }).email),
  );
  const excludedStaff = userSnap.size - customerDocs.length;

  const users: ConsoleUserRow[] = customerDocs.map((d, i) => {
    const u = d.data() as Record<string, any>;

    // `currentPlan` is the new field; `tier` is the legacy one already on these
    // documents. Falling back keeps pre-existing users from all showing as Free
    // before anything has written the new shape.
    const planId: string = u.currentPlan ?? u.tier ?? "free";
    const plan = planById.get(planId);
    const planLabel = plan?.name ?? (planId.charAt(0).toUpperCase() + planId.slice(1));

    const expiry: string | null = u.subscriptionExpiryDate ?? null;
    const remaining = daysUntil(expiry);
    const storedStatus: string = u.subscriptionStatus ?? "NONE";
    // Expiry beats stored status, exactly as the app's own resolver does.
    const lapsed = expiry != null && remaining == null
      && (storedStatus === "ACTIVE" || storedStatus === "TRIALING");
    const status = toConsoleStatus(lapsed ? "EXPIRED" : storedStatus);

    const isPaying = (status === "active" || status === "trialing" || status === "past_due")
      && planId !== "free";

    const name: string = u.name ?? u.displayName ?? (u.email ?? d.id).split("@")[0];
    const email: string = u.email ?? "—";

    return {
      id: d.id,
      name,
      email,
      plan: planLabel,
      status,
      mrr: isPaying ? (price[planLabel] ?? 0) : 0,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      initials: initialsOf(name, email),
      country: u.country ?? "—",
      joined: u.createdAt ?? u.joinedDate ?? new Date().toISOString(),
      lastActive: u.lastLoginAt ?? u.lastActive ?? u.createdAt ?? new Date().toISOString(),
      // Engagement metrics have no collection behind them yet (api_usage and
      // feature_adoption are empty). Zero is honest; the demo's PRNG values
      // would look like real usage.
      watchlists: 0,
      holdings: 0,
      apiCalls: 0,
      alerts: 0,
      // Days until the subscription renews. Trialing counts too — a trial
      // reaching its end date IS a renewal event, and it is the one most worth
      // seeing in advance. Null when there is no expiry date to count toward,
      // which is every free account.
      renewsIn: status === "active" || status === "trialing" ? remaining : null,
      ltv: Math.round(paidByUser.get(d.id) ?? 0),
    };
  });

  // Staff opens are excluded here too, for the same reason their subscription
  // is: an admin clicking through every screen to test would otherwise read as
  // genuine product adoption.
  const staffUids = new Set(
    userSnap.docs
      .filter(d => isStaffAccount((d.data() as { email?: string }).email))
      .map(d => d.id),
  );
  const adoptionDocs = (adoptionSnap?.docs ?? [])
    .map(d => d.data() as { feature?: string; userId?: string; openCount?: number; lastOpened?: string })
    .filter(d => !d.userId || !staffUids.has(d.userId));

  const planRows: ConsolePlanRow[] = planSnap.docs
    .map(d => {
      const p = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: (p.name as string) ?? d.id,
        amount: (p.amount as number) ?? 0,
        currency: (p.currency as string) ?? "USD",
        billingCycle: (p.billingCycle as string) ?? "none",
        // Every catalog key is present, defaulting to false — a key absent from
        // the document must render as an off toggle, not vanish from the editor.
        featureFlags: Object.fromEntries(
          ENTITLEMENT_CATALOG.map(e => [
            e.key,
            (p.featureFlags as Record<string, boolean> | undefined)?.[e.key] === true,
          ]),
        ),
        active: (p.active as boolean) ?? true,
        sortOrder: (p.sortOrder as number) ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    users,
    plans: planRows,
    entitlementCatalog: ENTITLEMENT_CATALOG,
    // Null when unset, so the Monitor tab can say "not configured" rather
    // than silently probing localhost from a production origin.
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? null,
    featureAdoption: rollUpAdoption(adoptionDocs),
    price,
    generatedAt: new Date().toISOString(),
    counts: {
      users: users.length,
      payments: paySnap?.size ?? 0,
      plans: plans.length,
      excludedStaff,
    },
  };
}

export const ADMIN_DATA_KEY = "admin:data";
