// Every plan change (upgrade, lower plan, annual → monthly, in or out of the
// trial) is paid like a first purchase on the checkout page: card + billing
// address + renewal consent every time, and the page says when the new plan
// starts. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../../app/iq/billing/checkout/checkout-page.tsx", import.meta.url), "utf8");
const view = page.slice(page.indexOf('if (phase === "upgrade" && plan && changePrev) {'), page.indexOf('if (phase !== "checkout" || !plan) {'));
const confirm = page.slice(page.indexOf("async function handleChangeConfirm()"), page.indexOf("const close = () =>"));

test("the card and billing address form is shown for every change — not only when something is charged now", () => {
  assert.doesNotMatch(page, /needsCard/);
  assert.match(view, /const PayForm = adapter\?\.Form;/);
  assert.match(view, /<PayForm onChange=\{onPayment\}[^>]*purpose="planChange" \/>/);
  assert.match(view, />Card and billing address</);
});

test("confirm stays disabled until card, billing address and the renewal consent are complete", () => {
  assert.match(view, /const canConfirm = !busy && !!PayForm && payment\.ready && !!payment\.address && consent && !!cp\.consent\?\.version;/);
  assert.match(view, /data-testid="change-consent-box"/);
  assert.match(view, /<ConsentText text=\{cp\.consent\?\.text/);
});

test("the change sends the entered card, the billing address and the consent", () => {
  assert.match(confirm, /if \(adapter\?\.createPaymentMethod\) \{/);
  assert.doesNotMatch(confirm, /amountDueNow > 0 && adapter\?\.createPaymentMethod/);
  assert.match(confirm, /billing: \{ name: a\.name, address: \{ line1: a\.line1, line2: a\.line2, city: a\.city, state: a\.state, postalCode: a\.postalCode, country: a\.country \} \}/);
  assert.match(confirm, /consent: \{ accepted: consent, version: changePrev\.consent\?\.version \?\? "" \}/);
});

test("the page clearly says when the new plan starts (today, or the date a scheduled change takes effect)", () => {
  assert.match(view, /data-testid="change-starts"/);
  assert.match(view, /scheduled \? `\$\{plan\.name\} starts on \$\{longDate\(startsAt\)\}` : `\$\{plan\.name\} starts today, \$\{longDate\(startsAt\)\}`/);
  assert.match(view, /Nothing is charged today\. On \$\{longDate\(startsAt\)\} the card below is charged/);
  assert.match(view, /You're in your free trial, so nothing is charged today\. The card below is charged/);
});

test("titles say 'Switch to <plan>'; a scheduled change's button says 'Switch to <plan> from <date>'", () => {
  assert.match(view, /const title = `Switch to \$\{plan\.name\} \(\$\{cadenceLabel\}\)`;/);
  assert.match(view, /\? `Switch to \$\{plan\.name\} from \$\{longDate\(startsAt\)\}`/);
  assert.doesNotMatch(view, /`Upgrade to \$\{plan\.name\}|`Change to \$\{plan\.name\}|`Schedule /);
});

test("confirmation: 'Your <plan> Plan is Activated', or 'Your <plan> plan starts on <date>' for a scheduled switch", () => {
  const pages = fs.readFileSync(new URL("../../app/iq/billing/billing-pages.tsx", import.meta.url), "utf8");
  assert.match(pages, /`Your \$\{change\.toPlanName\} plan starts on \$\{change\.effectiveAt \? longDate\(change\.effectiveAt\)/);
  assert.match(pages, /Plan is Activated`/);
  assert.doesNotMatch(pages, /is scheduled`/);
});
