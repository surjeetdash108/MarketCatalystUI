import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { linkSignals } from "./abort";

describe("linkSignals", () => {
  it("aborts when either the caller's signal or the timeout fires", () => {
    const a = new AbortController(), b = new AbortController();
    const s = linkSignals(a.signal, b.signal);
    assert.equal(s.aborted, false);
    a.abort();
    assert.equal(s.aborted, true);
    const c = new AbortController(), d = new AbortController();
    const s2 = linkSignals(c.signal, d.signal);
    d.abort();
    assert.equal(s2.aborted, true);
  });
  it("returns the timeout signal alone when the caller passes none", () => {
    const t = new AbortController();
    assert.equal(linkSignals(undefined, t.signal), t.signal);
  });
});
