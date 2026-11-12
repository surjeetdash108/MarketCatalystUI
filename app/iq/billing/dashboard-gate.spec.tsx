// Dashboard widgets for Free users: the three Starter widgets (Insider &
// Institutional, Analyst Actions, Portfolio Pulse) check entitlements BEFORE fetching and show a
// lock card; recaps and earnings announcements are Free and always fetched.
// The browser-level proof (zero 403s, three lock cards) is
// tests/e2e/dashboard-free-user.e2e.mjs against a local stack.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { LockedFeature } from "../entitlement-gate";
import { featureDecision, type Entitlements } from "../hooks/useEntitlements";

const base: Entitlements = {
  subscriptionsEnabled: true, paidPlansAvailable: true, provider: "fake", planId: "free", planName: "Free", status: "NONE",
  interval: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, inGrace: false, graceEndsAt: null,
  entitlements: { ownership: false, workspaces: false, news: true },
  requiredPlan: { ownership: "starter", workspaces: "starter", news: null }, hidden: [], limits: { watchlistTickers: 5 },
};

describe("featureDecision (fetch only when allowed)", () => {
  it("Free with the flag on: Starter widgets are locked with the plan that has them", () => {
    assert.deepEqual(featureDecision({ data: base, error: false }, "ownership"), { kind: "locked", requiredPlan: "starter" });
    assert.deepEqual(featureDecision({ data: base, error: false }, "workspaces"), { kind: "locked", requiredPlan: "starter" });
  });
  it("Starter, or anyone while the flag is off: allowed", () => {
    const starter = { ...base, planId: "starter", entitlements: { ownership: true, workspaces: true } };
    assert.equal(featureDecision({ data: starter, error: false }, "ownership").kind, "allow");
    assert.equal(featureDecision({ data: { ...base, subscriptionsEnabled: false }, error: false }, "ownership").kind, "allow");
  });
  it("while entitlements load: no fetch yet; if they cannot load at all: fail open (backend still enforces)", () => {
    assert.equal(featureDecision({ data: null, error: false }, "ownership").kind, "loading");
    assert.equal(featureDecision({ data: null, error: true }, "ownership").kind, "allow");
  });
});

describe("widget lock card", () => {
  it("says 'Available on Starter' and links Upgrade to the Starter plan", () => {
    const html = renderToStaticMarkup(<LockedFeature entitlement="ownership" requiredPlan="starter" variant="widget" />);
    assert.match(html, /data-testid="locked-feature"/);
    assert.match(html, /data-variant="widget"/);
    assert.match(html, />Available on Starter</);
    assert.match(html, /href="\/checkout\?plan=starter&amp;interval=annual"[^>]*>Upgrade to Starter</);
  });
});

describe("dashboard wiring", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "app/iq/screens/dashboard.tsx"), "utf8");
  const fetchOf = (endpoint: string) => src.split("\n").filter((l) => l.includes("useApiList") && l.includes(`/market-data/${endpoint}`));

  for (const [endpoint, allowed, key] of [["insider-transactions", "insiderAllowed", "ownership"], ["analyst-actions", "analystAllowed", "workspaces"]] as const) {
    it(`${endpoint}: fetched only when '${key}' is allowed, and its widget sits in an EntitlementGate`, () => {
      const lines = fetchOf(endpoint);
      assert.equal(lines.length, 1);
      assert.match(lines[0], new RegExp(`useApiList<[^>]+>\\(${allowed} \\? "/market-data/${endpoint}`));
      assert.match(src, new RegExp(`const ${allowed} = featureDecision\\(entitlementState, "${key}"\\)\\.kind === "allow"`));
      assert.match(src, new RegExp(`<EntitlementGate entitlement="${key}" variant="widget">`));
    });
  }

  for (const endpoint of ["recaps", "earnings-announcements"]) {
    it(`${endpoint} is Free: always fetched, no gate`, () => {
      const lines = fetchOf(endpoint);
      assert.equal(lines.length, 1);
      assert.match(lines[0], new RegExp(`useApiList<[^>]+>\\("/market-data/${endpoint}"\\)`));
    });
  }

  it("Portfolio Pulse (Starter): /api/portfolio fetched only when 'portfolio' is allowed, widget gated", () => {
    const lines = src.split("\n").filter((l) => l.includes('"/api/portfolio"'));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /uid && portfolioAllowed \? "\/api\/portfolio"/);
    assert.match(src, /const portfolioAllowed = featureDecision\(entitlementState, "portfolio"\)\.kind === "allow"/);
    assert.match(src, /<EntitlementGate entitlement="portfolio" variant="widget">/);
  });

  it("exactly three widget gates on the dashboard (the Starter widgets)", () => {
    assert.deepEqual(
      [...src.matchAll(/<EntitlementGate entitlement="([a-zA-Z]+)" variant="widget">/g)].map((m) => m[1]).sort(),
      ["ownership", "portfolio", "workspaces"],
    );
  });
});
