import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createBarsPrefetcher } from "./prefetch-bars";

// Logic & UI #6: ~30 HTTP 401s on /live/bars?interval=1m when leaving Money
// Flow. The tile prefetch used the browser's bare fetch(), which carries no
// Firebase ID token, so every request was rejected by FirebaseAuthGuard.
describe("Money Flow 1m bar prefetch", () => {
  it("goes through the signed-in API client, never a bare fetch()", () => {
    const src = readFileSync(new URL("../screens/money-flow.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(src, /\bfetch\(`\/live\/bars/);
    assert.match(src, /prefetchBars\(/);
  });

  it("reads each ticker once per window, with the caller's abort signal", async () => {
    const calls: Array<{ path: string; signal?: AbortSignal }> = [];
    let t = 1_000_000;
    const pf = createBarsPrefetcher((path, opts) => { calls.push({ path, signal: opts.signal }); return Promise.resolve(); }, () => t, 60_000);
    const ac = new AbortController();
    pf(["NEM", "TGT"], ac.signal);
    pf(["NEM", "TGT", "RCL"], ac.signal); // board refresh: only the new name
    assert.deepEqual(calls.map(c => c.path), [
      "/live/bars?ticker=NEM&interval=1m",
      "/live/bars?ticker=TGT&interval=1m",
      "/live/bars?ticker=RCL&interval=1m",
    ]);
    assert.ok(calls.every(c => c.signal === ac.signal));
    t += 61_000;
    pf(["NEM"], ac.signal);
    assert.equal(calls.length, 4);
  });

  it("a failed or aborted read is swallowed and retried next round", async () => {
    let n = 0;
    const pf = createBarsPrefetcher(() => { n++; return Promise.reject(new Error("aborted")); }, () => 5, 60_000);
    pf(["HUM"], new AbortController().signal);
    await new Promise(r => setTimeout(r, 0));
    pf(["HUM"], new AbortController().signal);
    assert.equal(n, 2);
  });
});
