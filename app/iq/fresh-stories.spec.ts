// Live Feed "NEW" flash: only stories that arrive AFTER the first look are
// fresh, a live-wire story replaced by its synced copy is not new again (even
// when the copy has a different URL), and a bulk sync flags only the newest few.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { takeFresh, freshStoryKey, freshStoryKeys } from "./fresh-stories";

const k = (...ids: string[]) => ids.map(id => [id]);

describe("takeFresh", () => {
  it("the first look is the baseline — nothing is fresh", () => {
    const r = takeFresh(null, k("a", "b", "c"), 10);
    assert.deepEqual(r.fresh, []);
    assert.deepEqual([...r.seen].sort(), ["a", "b", "c"]);
  });

  it("a story that arrives later is fresh, once", () => {
    const first = takeFresh(null, k("b", "c"), 10);
    const second = takeFresh(first.seen, k("a", "b", "c"), 10);
    assert.deepEqual(second.fresh, ["a"]);
    const third = takeFresh(second.seen, k("a", "b", "c"), 10);
    assert.deepEqual(third.fresh, []);
  });

  it("several arrivals come back newest first (feed order)", () => {
    const first = takeFresh(null, k("z"), 10);
    assert.deepEqual(takeFresh(first.seen, k("c", "b", "a", "z"), 10).fresh, ["c", "b", "a"]);
  });

  it("a bulk sync flags only the newest `max`, and the rest are not flagged later", () => {
    const first = takeFresh(null, k("z"), 2);
    const bulk = takeFresh(first.seen, k("e", "d", "c", "b", "a", "z"), 2);
    assert.deepEqual(bulk.fresh, ["e", "d"]);
    assert.deepEqual(takeFresh(bulk.seen, k("e", "d", "c", "b", "a", "z"), 2).fresh, []);
  });

  it("does not mutate the set it was given", () => {
    const first = takeFresh(null, k("a"), 10);
    takeFresh(first.seen, k("b", "a"), 10);
    assert.deepEqual([...first.seen], ["a"]);
  });

  it("a story that leaves the feed and comes back is not fresh again", () => {
    const first = takeFresh(null, k("a", "b"), 10);
    const gone = takeFresh(first.seen, k("b"), 10);
    assert.deepEqual(takeFresh(gone.seen, k("a", "b"), 10).fresh, []);
  });

  it("a story matched by an alias key is the same story, not a new one", () => {
    const first = takeFresh(null, [["url-1", "AAPL|beats"]], 10);
    const again = takeFresh(first.seen, [["url-2", "AAPL|beats"]], 10);
    assert.deepEqual(again.fresh, []);
  });

  it("a story with no keys is ignored", () => {
    const first = takeFresh(null, k("a"), 10);
    assert.deepEqual(takeFresh(first.seen, [[], ["b"]], 10).fresh, ["b"]);
  });
});

describe("freshStoryKey / freshStoryKeys", () => {
  it("the primary key is the article URL, else the id", () => {
    assert.equal(freshStoryKey({ id: "abc", url: "https://x.com/a" }), "https://x.com/a");
    assert.equal(freshStoryKey({ id: "abc", url: "" }), "abc");
    assert.equal(freshStoryKey({ id: "abc", url: null }), "abc");
  });

  it("a wire story and its synced copy share a key even when the URLs differ", () => {
    const wire = freshStoryKeys({ id: "HSY_x", url: "https://a.com/1", ticker: "HSY", headline: "Hershey Beats" });
    const synced = freshStoryKeys({ id: "s-9", url: "https://b.com/2", ticker: "HSY", headline: "hershey beats" });
    assert.ok(wire.some(key => synced.includes(key)));
  });

  it("the primary key is first; no headline means no headline alias", () => {
    assert.deepEqual(freshStoryKeys({ id: "a", url: "u", ticker: "X", headline: "H" }), ["u", "X|h"]);
    assert.deepEqual(freshStoryKeys({ id: "a", url: "u", ticker: "X", headline: "" }), ["u"]);
    assert.deepEqual(freshStoryKeys({ id: "a", url: "u" }), ["u"]);
  });
});
