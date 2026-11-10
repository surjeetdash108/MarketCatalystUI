import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entitlementForSlug, groupForEntitlement } from "./entitlement-gate";
import { SCREEN_FEATURES } from "./feature-map.generated";
import { ENTITLEMENTS } from "../admin/entitlement-catalog";
import { menuItems } from "../dashboard/menu-items";

describe("SCREEN_FEATURES", () => {
  it("only names screens that exist in the menu or standalone routes", () => {
    const slugs = new Set<string>([
      ...menuItems.map((m) => m.slug),
      "money-flow",
      "sl",
      "stock",
      "si",
      "options",
      "requests",
      "filing",
      "weekly-recap",
      "notes",
      "themes",
    ]);
    for (const s of Object.keys(SCREEN_FEATURES)) {
      assert.ok(slugs.has(s), `unknown screen slug ${s}`);
    }
  });

  it("only uses catalog keys that are sellable (not staff-only, not unbuilt)", () => {
    const byKey = new Map(ENTITLEMENTS.map((e) => [e.key, e]));
    for (const [slug, key] of Object.entries(SCREEN_FEATURES)) {
      const e = byKey.get(key);
      assert.ok(e, `${slug} -> unknown key ${key}`);
      assert.ok(!e.staffOnly && !e.unbuilt, `${slug} -> ${key} is staff-only or unbuilt`);
    }
  });

  it("resolves mapped screens and fails open for unmapped ones", () => {
    assert.equal(entitlementForSlug("screener"), "screener");
    assert.equal(entitlementForSlug("analyst"), "workspaces");
    assert.equal(entitlementForSlug("money-flow"), "moneyFlow");
    assert.equal(entitlementForSlug("sl"), "strategyLab");
    assert.equal(entitlementForSlug("stock"), "stockIntelligence");
    assert.equal(entitlementForSlug("no-such-screen"), null);
  });

  it("resolves feature group names for entitlements", () => {
    assert.equal(groupForEntitlement("workspaces"), "Market Desk");
    assert.equal(groupForEntitlement("stockIntelligence"), "Stock Intelligence");
    assert.equal(groupForEntitlement("moneyFlow"), "Money Flow");
    assert.equal(groupForEntitlement("strategyLab"), "Strategy Lab");
  });
});
