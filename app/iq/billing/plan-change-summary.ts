"use client";

/**
 * What a plan change did, handed from the payment step to the confirmation
 * page (sessionStorage, this tab only). The confirmation page still verifies
 * the change with the server before showing it.
 */
export interface PlanChangeSummary {
  kind: "upgrade" | "downgrade" | "scheduled";
  planId: string;
  fromPlanName: string | null;
  toPlanName: string;
  interval: "monthly" | "annual";
  chargedNow: number;
  credit: number;
  effectiveAt: string | null;
  nextRenewalAmount: number;
  nextRenewalDate: string;
  currency: string;
}

const KEY = "mc:last-plan-change";

export function rememberPlanChange(c: PlanChangeSummary): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable: the page falls back to a generic confirmation */
  }
}

export function takePlanChange(): PlanChangeSummary | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as PlanChangeSummary) : null;
  } catch {
    return null;
  }
}

/** The lines of the confirmation, in plain words. */
export function planChangeLines(c: PlanChangeSummary, money: (n: number) => string, date: (iso: string) => string): string[] {
  const cadence = c.interval === "annual" ? "Annual" : "Monthly";
  const per = c.interval === "annual" ? "year" : "month";
  if (c.kind === "scheduled")
    return [
      `Your ${c.toPlanName} (${cadence}) plan starts on ${c.effectiveAt ? date(c.effectiveAt) : "the end of your current period"}.`,
      `You keep ${c.fromPlanName ?? "your current plan"} until then. Nothing is charged today.`,
      `Then ${money(c.nextRenewalAmount)} every ${per}.`,
    ];
  if (c.kind === "downgrade")
    return [
      `You're now on ${c.toPlanName} (${cadence}).`,
      `${money(c.credit)} was credited to your account for the unused part of ${c.fromPlanName ?? "your previous plan"}. It's used automatically on your next invoice(s) and isn't refunded to your card.`,
      `Next renewal: ${money(c.nextRenewalAmount)} on ${date(c.nextRenewalDate)}.`,
    ];
  return [
    `You're now on ${c.toPlanName} (${cadence}). The new features are available now.`,
    c.chargedNow > 0 ? `Charged today: ${money(c.chargedNow)} (prorated).` : "Nothing was charged today.",
    `Next renewal: ${money(c.nextRenewalAmount)} on ${date(c.nextRenewalDate)}.`,
  ];
}
