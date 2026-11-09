// Browser test: a Free user opens the dashboard with SUBSCRIPTIONS_ENABLED on.
// Expect ZERO 403 responses in the network log and exactly three widget lock
// cards (Insider & Institutional, Analyst Actions, Portfolio Pulse), each
// "Available on Starter".
//
// Not part of `npm test` (needs a browser and a running stack):
//   1. Auth + Firestore emulators (demo project), backend with BILLING_PROVIDER=fake
//      and SUBSCRIPTIONS_ENABLED=true, UI dev server pointed at both.
//   2. APP_URL=http://localhost:3000 AUTH_EMULATOR=http://127.0.0.1:19499 \
//      PLAYWRIGHT_MODULE=<path to playwright/index.mjs> node tests/e2e/dashboard-free-user.e2e.mjs
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const APP = process.env.APP_URL ?? "http://localhost:3000";
const email = `free-${Date.now()}@example.com`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on("dialog", (d) => d.accept());
  const log = [];
  page.on("response", (r) => log.push({ status: r.status(), url: r.url(), method: r.request().method() }));

  // Free signup (no plan chosen) lands on the dashboard.
  await page.goto(`${APP}/auth/signup`, { timeout: 120_000 });
  await page.waitForSelector('[data-testid="plan-free"][aria-checked="true"]', { timeout: 120_000 });
  await page.fill("#profile-name", "Free Dashboard");
  await page.fill("#profile-email", email);
  await page.fill("#password", "free-pass-123");
  await page.fill("#confirm-password", "free-pass-123");
  await page.check("#terms-checkbox");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 120_000 });

  // Fresh load of the dashboard; wait for the network to settle.
  log.length = 0;
  await page.goto(`${APP}/dashboard`, { timeout: 120_000 });
  await page.waitForSelector('[data-testid="locked-feature"][data-variant="widget"]', { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 120_000 });
  await page.waitForTimeout(3000);

  const forbidden = log.filter((x) => x.status === 403);
  const cards = await page.$$eval('[data-testid="locked-feature"][data-variant="widget"]', (els) =>
    els.map((e) => ({ entitlement: e.getAttribute("data-entitlement"), text: e.textContent })),
  );
  const called = (frag) => log.filter((x) => x.url.includes(frag)).map((x) => `${x.method} ${x.status}`);
  console.log(JSON.stringify({
    responses: log.length,
    forbidden,
    lockCards: cards,
    calls: {
      "insider-transactions": called("/market-data/insider-transactions"),
      "analyst-actions": called("/market-data/analyst-actions"),
      recaps: called("/market-data/recaps"),
      "earnings-announcements": called("/market-data/earnings-announcements"),
    },
  }, null, 2));
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT, fullPage: true });

  assert.deepEqual(forbidden, [], "a Free user's dashboard must make no 403 calls");
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((c) => c.entitlement).sort(), ["ownership", "portfolio", "workspaces"]);
  for (const c of cards) assert.match(c.text, /Available on Starter/);
  assert.deepEqual(called("/market-data/insider-transactions"), []);
  assert.deepEqual(called("/market-data/analyst-actions"), []);
  assert.deepEqual(log.filter((x) => new URL(x.url).pathname === "/api/portfolio"), []);
  assert.ok(called("/market-data/recaps").some((s) => s.endsWith(" 200")), "recaps fetched (Free)");
  assert.ok(called("/market-data/earnings-announcements").some((s) => s.endsWith(" 200")), "earnings announcements fetched (Free)");
  console.log("PASS: zero 403s, three lock cards");
} finally {
  await browser.close();
}
