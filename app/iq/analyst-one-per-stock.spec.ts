// Portfolio / Watchlist cards on Analyst Actions list each stock once, even when the
// stock drew several calls in the window (NVDA showed four times on prod).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { oneCallPerStock } from "./analyst-actions-engine";

const call = (id: string, t: string, score: number, dir = 1) => ({ id, t, score, dir });

describe("oneCallPerStock", () => {
  it("four calls on one stock become one entry", () => {
    const out = oneCallPerStock([call("1", "NVDA", 70), call("2", "NVDA", 82), call("3", "NVDA", 64), call("4", "NVDA", 75)]);
    assert.deepEqual(out.map(c => c.t), ["NVDA"]);
  });

  it("keeps the highest-signal call, so its direction sets the colour", () => {
    const out = oneCallPerStock([call("1", "AMD", 60, 1), call("2", "AMD", 88, -1), call("3", "AMD", 71, 1)]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "2");
    assert.equal(out[0].dir, -1);
  });

  it("lists different stocks strongest first", () => {
    const out = oneCallPerStock([call("1", "A", 50), call("2", "B", 90), call("3", "A", 55), call("4", "C", 70)]);
    assert.deepEqual(out.map(c => c.t), ["B", "C", "A"]);
  });

  it("a tie keeps the first call seen, and an empty list stays empty", () => {
    const out = oneCallPerStock([call("first", "X", 80), call("second", "X", 80)]);
    assert.equal(out[0].id, "first");
    assert.deepEqual(oneCallPerStock([]), []);
  });

  it("does not change the list it is given", () => {
    const input = [call("1", "A", 10), call("2", "A", 20)];
    oneCallPerStock(input);
    assert.equal(input.length, 2);
  });
});
