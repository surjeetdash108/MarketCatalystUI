import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combineLenses, lensSources, lensTitle, toggleLens, DEFAULT_LENS } from "./insider-lens";

const row = (t: string) => ({ t });
const ts = (rows: { t: string }[]) => rows.map(r => r.t);

describe("toggleLens", () => {
  it("starts on Most notable, and picking a narrower lens replaces it", () => {
    assert.deepEqual(toggleLens([DEFAULT_LENS], "ibuy"), ["ibuy"]);
  });
  it("adds more lenses in the order they were picked", () => {
    assert.deepEqual(toggleLens(["ibuy"], "acc"), ["ibuy", "acc"]);
    assert.deepEqual(toggleLens(["ibuy", "acc"], "cluster"), ["ibuy", "acc", "cluster"]);
  });
  it("clicking an on lens turns it off", () => {
    assert.deepEqual(toggleLens(["ibuy", "acc"], "ibuy"), ["acc"]);
  });
  it("turning off the last lens goes back to Most notable, never to nothing", () => {
    assert.deepEqual(toggleLens(["acc"], "acc"), [DEFAULT_LENS]);
  });
  it("Most notable lists everything, so picking it clears the others", () => {
    assert.deepEqual(toggleLens(["ibuy", "acc"], DEFAULT_LENS), [DEFAULT_LENS]);
  });
});

describe("combineLenses", () => {
  // Each lens is already ranked by its own measure.
  const ibuy = [row("A"), row("B"), row("C")];
  const acc = [row("C"), row("D"), row("A")];
  const isell = [row("E"), row("F")];

  it("one lens is returned as is", () => {
    const r = combineLenses([ibuy], "any");
    assert.deepEqual(ts(r.rows), ["A", "B", "C"]);
    assert.equal(r.via.get("B"), 0);
  });

  it("any: every stock on either lens, the ones on both first", () => {
    const r = combineLenses([ibuy, acc], "any");
    // A and C are on both lenses. A ranks first on the first lens, C second.
    assert.deepEqual(ts(r.rows), ["A", "C", "B", "D"]);
  });

  it("any: a stock only on the second lens still shows, with that lens as its source", () => {
    const r = combineLenses([ibuy, acc], "any");
    assert.equal(r.via.get("B"), 0);
    assert.equal(r.via.get("D"), 1);
    assert.equal(r.via.get("A"), 0, "on both: the first-picked lens wins");
  });

  it("any with opposite lenses (buying + selling) shows both sides", () => {
    const r = combineLenses([ibuy, isell], "any");
    assert.deepEqual(ts(r.rows).sort(), ["A", "B", "C", "E", "F"]);
  });

  it("all: only stocks on every lens, in the first lens's order", () => {
    const r = combineLenses([ibuy, acc], "all");
    assert.deepEqual(ts(r.rows), ["A", "C"]);
    assert.equal(r.via.get("C"), 0);
  });

  it("all with lenses that cannot overlap is empty, not an error", () => {
    assert.deepEqual(combineLenses([ibuy, isell], "all").rows, []);
  });

  it("all across three lenses needs a stock on every one", () => {
    const third = [row("A"), row("Z")];
    assert.deepEqual(ts(combineLenses([ibuy, acc, third], "all").rows), ["A"]);
    assert.deepEqual(ts(combineLenses([ibuy, acc, third], "any").rows)[0], "A", "on three lenses ranks first");
  });

  it("no lenses gives no rows", () => {
    assert.deepEqual(combineLenses([], "any").rows, []);
  });

  it("does not change the lists it is given", () => {
    const a = [row("A"), row("B")];
    const b = [row("B"), row("C")];
    combineLenses([a, b], "any");
    combineLenses([a, b], "all");
    assert.deepEqual(ts(a), ["A", "B"]);
    assert.deepEqual(ts(b), ["B", "C"]);
  });
});

describe("lensTitle / lensSources", () => {
  it("titles: one label, two joined, more are counted", () => {
    assert.equal(lensTitle(["Insider buying"]), "Insider buying");
    assert.equal(lensTitle(["Insider buying", "Cluster buys"]), "Insider buying + Cluster buys");
    assert.equal(lensTitle(["Insider buying", "Cluster buys", "Funds accumulating"]), "Insider buying + 2 more");
  });
  it("sources: each part once, in order", () => {
    assert.equal(lensSources(["FORM 4"]), "FORM 4");
    assert.equal(lensSources(["FORM 4", "13F"]), "FORM 4 + 13F");
    assert.equal(lensSources(["FORM 4", "FORM 4"]), "FORM 4");
    assert.equal(lensSources(["13F", "FORM 4 + 13F"]), "13F + FORM 4");
  });
});
