import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveLogo, peekLogoObjectUrl } from "./logo-store";

// Minimal in-memory stand-ins for the browser APIs the album uses.
class FakeCache {
  entries = new Map<string, Response>();
  lastMatchOptions: unknown;
  async match(req: string | Request, opts?: unknown) {
    this.lastMatchOptions = opts;
    const hit = this.entries.get(typeof req === "string" ? req : req.url);
    return hit ? hit.clone() : undefined;
  }
  async put(req: string, res: Response) {
    this.entries.set(req, res);
  }
  async keys() {
    return [...this.entries.keys()].map((u) => ({ url: u }) as Request);
  }
  async delete(req: Request | string) {
    return this.entries.delete(typeof req === "string" ? req : req.url);
  }
}

const g = globalThis as Record<string, unknown>;
let store: FakeCache;
let fetchCalls: string[];
let nextFetch: () => Response | Promise<Response>;
const saved: Record<string, unknown> = {};

beforeEach(() => {
  store = new FakeCache();
  fetchCalls = [];
  for (const k of ["window", "caches", "fetch"]) saved[k] = g[k];
  g.window = {};
  g.caches = { open: async () => store, keys: async () => [], delete: async () => true };
  g.fetch = async (url: string) => {
    fetchCalls.push(url);
    return nextFetch();
  };
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => "blob:fake/" + Math.random();
});

afterEach(() => {
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete g[k];
    else g[k] = saved[k];
  }
});

const png = () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), { status: 200 });

describe("logo album", () => {
  it("fetches once, stores it, and later loads come from storage with cookies ignored (ignoreVary)", async () => {
    nextFetch = png;
    const url = "/live/logo?ticker=AAA&v=t1";
    const first = await resolveLogo(url, "t1");
    assert.equal(first.kind, "blob");
    assert.equal(fetchCalls.length, 1);
    assert.ok(store.entries.has(url));
    assert.equal(peekLogoObjectUrl(url), first.kind === "blob" ? first.url : "");

    // Simulate a fresh page load: the in-session memory is gone, the album is not.
    const url2 = "/live/logo?ticker=AAA&v=t1b";
    store.entries.set(url2, store.entries.get(url)!.clone());
    const second = await resolveLogo(url2, "t1");
    assert.equal(second.kind, "blob");
    assert.equal(fetchCalls.length, 1, "no network request for a stored logo");
    assert.deepEqual(store.lastMatchOptions, { ignoreVary: true });
  });

  it("a 204 means 'no logo' and nothing is stored", async () => {
    nextFetch = () => new Response(null, { status: 204 });
    const url = "/live/logo?ticker=NOLOGO&v=t2";
    const r = await resolveLogo(url, "t2");
    assert.equal(r.kind, "missing");
    assert.equal(store.entries.size, 0);
  });

  it("falls back to the plain <img src> on a server error, a network error, or without Cache Storage", async () => {
    nextFetch = () => new Response("boom", { status: 500 });
    assert.equal((await resolveLogo("/live/logo?ticker=E1&v=t3", "t3")).kind, "direct");

    nextFetch = () => Promise.reject(new TypeError("offline"));
    assert.equal((await resolveLogo("/live/logo?ticker=E2&v=t3", "t3")).kind, "direct");

    delete g.caches;
    assert.equal((await resolveLogo("/live/logo?ticker=E3&v=t3", "t3")).kind, "direct");
  });

  it("concurrent callers share one request", async () => {
    nextFetch = png;
    const url = "/live/logo?ticker=SHARED&v=t4";
    const [a, b, c] = await Promise.all([resolveLogo(url, "t4"), resolveLogo(url, "t4"), resolveLogo(url, "t4")]);
    assert.equal(fetchCalls.length, 1);
    assert.equal(a.kind, "blob");
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
  });

  it("an entry older than a day is shown immediately and refreshed once in the background", async () => {
    nextFetch = png;
    const url = "/live/logo?ticker=OLD&v=t5";
    const twoDaysAgo = String(Date.now() - 2 * 24 * 60 * 60 * 1000);
    store.entries.set(
      url,
      new Response(new Blob([new Uint8Array([9])], { type: "image/png" }), {
        headers: { "Content-Type": "image/png", "x-mc-cached-at": twoDaysAgo },
      }),
    );
    const r = await resolveLogo(url, "t5");
    assert.equal(r.kind, "blob");
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(fetchCalls.length, 1, "one background refresh");
    assert.ok(Number(store.entries.get(url)!.headers.get("x-mc-cached-at")) > Number(twoDaysAgo));
  });
});
