import { describe, it } from "node:test";
import assert from "node:assert";
import { isRecentAnalystAction, filterRecentAnalystActions } from "./analyst-cutoff";

describe("Item 6: 12-month rolling cutoff for analyst actions", () => {
  // Reference evaluation time: 2026-10-27T12:00:00Z
  const evalNow = Date.parse("2026-10-27T12:00:00Z");

  it("keeps actions within 12 months (365 days) in the default view", () => {
    // 2026 actions are recent
    assert.strictEqual(isRecentAnalystAction("2026-10-20", evalNow), true);
    assert.strictEqual(isRecentAnalystAction("2026-05-15", evalNow), true);
    assert.strictEqual(isRecentAnalystAction("2025-11-03", evalNow), true); // ~358 days ago
  });

  it("filters out stale actions older than 12 months (OPBK, ELMD, MSEX, JJSF, NGS dated early/mid 2025)", () => {
    // Stale actions older than 365 days (e.g. OPBK KBW from 2025-10-26, mid-2025, or early 2025)
    assert.strictEqual(isRecentAnalystAction("2025-10-26", evalNow), false); // 366 days ago
    assert.strictEqual(isRecentAnalystAction("2025-05-10", evalNow), false);
    assert.strictEqual(isRecentAnalystAction("2025-01-15", evalNow), false);
    assert.strictEqual(isRecentAnalystAction("2024-11-20", evalNow), false);
  });

  it("handles null, undefined, and malformed dates safely", () => {
    assert.strictEqual(isRecentAnalystAction(null, evalNow), false);
    assert.strictEqual(isRecentAnalystAction(undefined, evalNow), false);
    assert.strictEqual(isRecentAnalystAction("not-a-date", evalNow), false);
  });

  it("partitions a stock's action history into recent and older", () => {
    const actions = [
      { id: "1", date: "2026-08-10", firm: "Morgan Stanley" },
      { id: "2", date: "2026-02-14", firm: "Goldman Sachs" },
      { id: "3", date: "2025-05-20", firm: "KBW" },          // >12mo
      { id: "4", date: "2024-10-01", firm: "Baird" },        // >12mo
    ];
    const { recent, older } = filterRecentAnalystActions(actions, evalNow);
    assert.strictEqual(recent.length, 2);
    assert.deepStrictEqual(recent.map(r => r.id), ["1", "2"]);
    assert.strictEqual(older.length, 2);
    assert.deepStrictEqual(older.map(r => r.id), ["3", "4"]);
  });
});
