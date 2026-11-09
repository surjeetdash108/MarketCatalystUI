import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SLUG_ENTITLEMENT, entitlementForSlug } from "./entitlement-gate";
import { ENTITLEMENTS } from "../admin/entitlement-catalog";
import { menuItems } from "../dashboard/menu-items";

describe("SLUG_ENTITLEMENT", () => {
  it("only names screens that exist in the menu", () => {
    // Plus the two screens with their own routes: /money-flow and /sl.
    const slugs = new Set<string>([...menuItems.map((m) => m.slug), "money-flow", "sl"]);
    for (const s of Object.keys(SLUG_ENTITLEMENT)) assert.ok(slugs.has(s), `unknown screen slug ${s}`);
  });
  it("only uses catalog keys that are sellable (not staff-only, not unbuilt)", () => {
    const byKey = new Map(ENTITLEMENTS.map((e) => [e.key, e]));
    for (const [slug, key] of Object.entries(SLUG_ENTITLEMENT)) {
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
    assert.equal(entitlementForSlug("stock"), null);
    assert.equal(entitlementForSlug("no-such-screen"), null);
  });
});
