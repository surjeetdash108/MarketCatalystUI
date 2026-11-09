import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTicketCache, REFRESH_MARGIN_MS, withTicket } from "./stream-ticket";

describe("stream ticket cache", () => {
  it("reuses a ticket until shortly before it expires, then fetches a new one", async () => {
    let t = 1_000_000;
    let calls = 0;
    const cache = createTicketCache(async () => {
      calls++;
      return { ticket: `tk${calls}`, expiresAt: new Date(t + 10 * 60_000).toISOString() };
    }, () => t);
    assert.equal(await cache.get(), "tk1");
    t += 5 * 60_000;
    assert.equal(await cache.get(), "tk1");
    t += 5 * 60_000 - REFRESH_MARGIN_MS + 1;
    assert.equal(await cache.get(), "tk2");
    assert.equal(calls, 2);
  });

  it("shares one request between concurrent callers", async () => {
    let calls = 0;
    const cache = createTicketCache(async () => {
      calls++;
      return { ticket: "tk", expiresAt: new Date(Date.now() + 600_000).toISOString() };
    });
    const [a, b, c] = await Promise.all([cache.get(), cache.get(), cache.get()]);
    assert.deepEqual([a, b, c], ["tk", "tk", "tk"]);
    assert.equal(calls, 1);
  });

  it("force-refreshes after a stream was refused", async () => {
    let calls = 0;
    const cache = createTicketCache(async () => {
      calls++;
      return { ticket: `tk${calls}`, expiresAt: new Date(Date.now() + 600_000).toISOString() };
    });
    await cache.get();
    assert.equal(await cache.get(true), "tk2");
  });

  it("returns null when no ticket can be issued, so callers rely on their REST polls", async () => {
    const cache = createTicketCache(async () => { throw new Error("503"); });
    assert.equal(await cache.get(), null);
  });

  it("appends the ticket to a URL with or without a query string", () => {
    assert.equal(withTicket("https://x/live/tape/stream", "a.b"), "https://x/live/tape/stream?ticket=a.b");
    assert.equal(withTicket("https://x/live/stream?ticker=AAPL", "a+b"), "https://x/live/stream?ticker=AAPL&ticket=a%2Bb");
  });
});
