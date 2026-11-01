import { describe, it } from "node:test";
import assert from "node:assert";
import { retryDelayMs } from "./retry-policy";

// The error shapes app/iq/backend.ts produces: BackendApiError(status, body)
// for HTTP failures, Error("Request timed out: <path>") when the 20 s timer fires.
const http = (status: number) => Object.assign(new Error(`HTTP ${status}`), { name: "BackendApiError", status });

describe("retryDelayMs", () => {
  it("retries a timeout twice, then gives up", () => {
    const t = new Error("Request timed out: /live/financials?ticker=KR");
    assert.deepStrictEqual([retryDelayMs(t, 0), retryDelayMs(t, 1), retryDelayMs(t, 2)], [1500, 4000, null]);
  });
  it("retries 5xx and 429, not other 4xx", () => {
    assert.strictEqual(retryDelayMs(http(503), 0), 1500);
    assert.strictEqual(retryDelayMs(http(429), 0), 1500);
    assert.strictEqual(retryDelayMs(http(404), 0), null);
    assert.strictEqual(retryDelayMs(http(401), 0), null);
  });
  it("never retries a superseded (aborted) request", () => {
    assert.strictEqual(retryDelayMs(Object.assign(new Error("x"), { name: "AbortError" }), 0), null);
  });
});
