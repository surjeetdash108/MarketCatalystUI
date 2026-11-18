import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeNews, newsCursor, sinceParam } from "./news-merge";
import type { NewsArticleDoc } from "../types/news";

const art = (id: string, publishedAt: string, extra: Partial<NewsArticleDoc> = {}) =>
  ({ id, publishedAt, updatedAt: publishedAt, ticker: "NVDA", headline: id, ...extra }) as NewsArticleDoc;

test("newsCursor is null for an empty list", () => {
  assert.equal(newsCursor([]), null);
});

test("newsCursor follows createdAt, ignoring an updatedAt the job re-stamped", () => {
  const list = [
    art("a", "2026-11-18T09:00:00.000Z", { createdAt: "2026-11-18T09:00:00.000Z" }),
    // old article the job just re-stamped: updatedAt is newer, createdAt is not
    art("b", "2026-11-10T00:00:00.000Z", { createdAt: "2026-11-10T00:00:00.000Z", updatedAt: "2026-11-18T12:00:00.000Z" }),
  ];
  assert.equal(newsCursor(list), "2026-11-18T09:00:00.000Z");
});

test("newsCursor falls back to updatedAt for docs with no createdAt", () => {
  assert.equal(newsCursor([art("a", "2026-11-10T00:00:00.000Z", { updatedAt: "2026-11-18T12:00:00.000Z" })]), "2026-11-18T12:00:00.000Z");
});

test("sinceParam is null with nothing held (full load)", () => {
  assert.equal(sinceParam([], Date.now()), null);
});

test("sinceParam re-asks for the newest batch while it is under 3 minutes old", () => {
  const created = "2026-11-18T10:00:00.000Z";
  const list = [art("a", created, { createdAt: created })];
  const now = Date.parse(created) + 60_000;
  assert.equal(sinceParam(list, now), "2026-11-18T09:59:59.999Z");
});

test("sinceParam sends the plain cursor once the batch has settled", () => {
  const created = "2026-11-18T10:00:00.000Z";
  const list = [art("a", created, { createdAt: created })];
  assert.equal(sinceParam(list, Date.parse(created) + 10 * 60_000), created);
});

test("mergeNews returns the same array for an empty batch", () => {
  const cur = [art("a", "2026-11-18T09:00:00.000Z")];
  assert.equal(mergeNews(cur, []), cur);
});

test("mergeNews returns the same array when it is re-sent articles it already holds unchanged", () => {
  const cur = [art("a", "2026-11-18T09:00:00.000Z")];
  assert.equal(mergeNews(cur, [art("a", "2026-11-18T09:00:00.000Z")]), cur);
});

test("mergeNews adds new articles newest-published first", () => {
  const cur = [art("a", "2026-11-18T09:00:00.000Z")];
  const out = mergeNews(cur, [art("b", "2026-11-18T10:00:00.000Z")]);
  assert.deepEqual(out.map((x) => x.id), ["b", "a"]);
});

test("mergeNews replaces an article that came back changed instead of duplicating it", () => {
  const cur = [art("a", "2026-11-18T09:00:00.000Z", { sentiment: null })];
  const out = mergeNews(cur, [art("a", "2026-11-18T09:00:00.000Z", { updatedAt: "2026-11-18T10:00:00.000Z", sentiment: "positive" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].sentiment, "positive");
});
