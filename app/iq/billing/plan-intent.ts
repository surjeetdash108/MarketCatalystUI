import type { BillingInterval } from "./catalog";

/**
 * The plan a visitor chose on the marketing site (?plan=&interval=), kept in
 * sessionStorage so it survives the Google sign-in redirect. Invalid values
 * mean "no preselection" — never a guess.
 */
export interface PlanIntent {
  planId: string;
  interval: BillingInterval;
  /** Optional promo code typed at signup; validated server-side before checkout. */
  promoCode?: string;
}

export const INTENT_KEY = "mc:plan-intent";

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Validates ?plan=&interval= against the plan ids the catalog actually offers. */
export function parsePlanParams(search: string, knownPlanIds: string[]): PlanIntent | null {
  const q = new URLSearchParams(search);
  const planId = (q.get("plan") ?? "").trim().toLowerCase();
  const rawInterval = (q.get("interval") ?? "").trim().toLowerCase();
  if (!planId || !knownPlanIds.includes(planId)) return null;
  // No interval → annual (the website shows annual prices by default).
  if (rawInterval !== "" && rawInterval !== "monthly" && rawInterval !== "annual") return null;
  const interval: BillingInterval = rawInterval === "monthly" ? "monthly" : "annual";
  return { planId, interval };
}

export function saveIntent(intent: PlanIntent | null, store: Store | null = safeSession()): void {
  try {
    if (!store) return;
    if (intent) store.setItem(INTENT_KEY, JSON.stringify(intent));
    else store.removeItem(INTENT_KEY);
  } catch {
    /* storage blocked: the URL params still work on this page */
  }
}

export function loadIntent(knownPlanIds: string[], store: Store | null = safeSession()): PlanIntent | null {
  try {
    const raw = store?.getItem(INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PlanIntent>;
    if (!v || typeof v.planId !== "string" || !knownPlanIds.includes(v.planId) || (v.interval !== "monthly" && v.interval !== "annual")) return null;
    const promo = typeof v.promoCode === "string" ? v.promoCode.trim().slice(0, 40) : "";
    return { planId: v.planId, interval: v.interval, ...(promo ? { promoCode: promo } : {}) };
  } catch {
    return null;
  }
}

export function clearIntent(store: Store | null = safeSession()): void {
  saveIntent(null, store);
}

/** Where a signed-in visitor with an intent goes: Manage Plan with that plan selected. */
export function managePlanPath(intent: PlanIntent | null): string {
  return intent ? `/manage-plan?plan=${encodeURIComponent(intent.planId)}&interval=${intent.interval}` : "/manage-plan";
}

function safeSession(): Store | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Where a just-created account goes: /billing/start (confirm price, then
 * checkout) when a paid plan was chosen, otherwise `fallback`.
 */
export function afterSignupPath(fallback: string, store: Store | null = safeSession()): string {
  try {
    const raw = store?.getItem(INTENT_KEY);
    return raw ? "/billing/start" : fallback;
  } catch {
    return fallback;
  }
}

/** Where an existing account that just signed in goes when it arrived with a plan. */
export function afterLoginPath(fallback: string, store: Store | null = safeSession()): string {
  try {
    const raw = store?.getItem(INTENT_KEY);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as PlanIntent;
    return managePlanPath({ planId: v.planId, interval: v.interval });
  } catch {
    return fallback;
  }
}
