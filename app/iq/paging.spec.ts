// Paged lists (Live Feed → Intraday commentary): 50 per page, First / Prev /
// Next / Last, and a page that runs past the end (filters shrank the list)
// snaps back to the last real page.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pageWindow, FEED_PAGE_SIZE } from "./paging";

describe("pageWindow", () => {
  it("50 per page", () => assert.equal(FEED_PAGE_SIZE, 50));
  it("first page of 137 stories: 1–50, 3 pages, no Prev / First", () => {
    assert.deepEqual(pageWindow(137, 0), { page: 0, pages: 3, from: 0, to: 50, hasPrev: false, hasNext: true });
  });
  it("last page holds the remainder", () => {
    assert.deepEqual(pageWindow(137, 2), { page: 2, pages: 3, from: 100, to: 137, hasPrev: true, hasNext: false });
  });
  it("a page past the end (the list shrank) snaps to the last page; an empty list is one empty page", () => {
    assert.equal(pageWindow(30, 4).page, 0);
    assert.deepEqual(pageWindow(0, 2), { page: 0, pages: 1, from: 0, to: 0, hasPrev: false, hasNext: false });
  });
});
