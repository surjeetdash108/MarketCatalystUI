import type { ChangePreview } from "./api";

/**
 * What the "switch plan" pop-up says before the member confirms: when the new
 * plan starts, what's charged now (to the card on file) and what's next.
 */
export function switchPreviewLines(
  cp: Pick<ChangePreview, "kind" | "interval" | "amountDueNow" | "creditToBalance" | "effectiveAt" | "startsAt" | "nextRenewalAmount" | "nextRenewalDate" | "trialEndsAt">,
  names: { from: string | null; to: string },
  money: (n: number) => string,
  date: (iso: string) => string,
): string[] {
  const cadence = cp.interval === "annual" ? "Annual" : "Monthly";
  const per = cp.interval === "annual" ? "year" : "month";
  const from = names.from ?? "your current plan";
  if (cp.kind === "scheduled")
    return [
      `Your ${names.to} (${cadence}) plan starts on ${date(cp.effectiveAt || cp.startsAt)}.`,
      `You keep ${from} until then. Nothing is charged today.`,
      `From then: ${money(cp.nextRenewalAmount)} every ${per}, charged to your card on file.`,
    ];
  if (cp.trialEndsAt)
    return [
      `You switch to ${names.to} (${cadence}) now.`,
      "You're still in your free trial, so nothing is charged today.",
      `Your first charge is ${money(cp.nextRenewalAmount)} on ${date(cp.trialEndsAt)}, then every ${per}.`,
    ];
  if (cp.kind === "downgrade")
    return [
      `You switch to ${names.to} (${cadence}) now.`,
      `${money(cp.creditToBalance)} is credited to your account for the unused part of ${from}; it's used on your next invoice(s).`,
      `Next renewal: ${money(cp.nextRenewalAmount)} on ${date(cp.nextRenewalDate)}.`,
    ];
  return [
    `You switch to ${names.to} (${cadence}) now. The new features are available right away.`,
    cp.amountDueNow > 0
      ? `Charged today: ${money(cp.amountDueNow)} (prorated), to your card on file.`
      : "Nothing is charged today.",
    `Next renewal: ${money(cp.nextRenewalAmount)} on ${date(cp.nextRenewalDate)}.`,
  ];
}
