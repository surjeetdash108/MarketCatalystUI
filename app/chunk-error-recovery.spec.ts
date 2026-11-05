import test from "node:test";
import assert from "node:assert/strict";
import { isChunkLoadError, reloadForChunkError } from "./chunk-error-recovery";

test("Chunk Error Recovery & Screen Refresh", async (t) => {
  await t.test("recognizes exact screenshot error: Loading chunk 2983 failed", () => {
    const screenshotMsg =
      "Loading chunk 2983 failed.\n(missing: https://app.marketcatalyst.ai/_next/static/chunks/2983-e861ad53e29f3d38.js)";
    const err = new Error(screenshotMsg);
    err.name = "ChunkLoadError";

    assert.equal(isChunkLoadError(err), true);
    assert.equal(isChunkLoadError({ message: screenshotMsg }), true);
  });

  await t.test("recognizes CSS chunk load errors", () => {
    const err = new Error("Loading CSS chunk 892 failed.");
    assert.equal(isChunkLoadError(err), true);
  });

  await t.test("recognizes dynamic module import failures", () => {
    assert.equal(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://app.marketcatalyst.ai/app.js")),
      true
    );
    assert.equal(isChunkLoadError(new Error("Importing a module script failed.")), true);
    assert.equal(isChunkLoadError(new Error("error loading dynamically imported module")), true);
  });

  await t.test("recognizes chunk 404 from stack or message", () => {
    const err = new Error("404 Not Found");
    (err as any).stack = "Error at https://app.marketcatalyst.ai/_next/static/chunks/2983.js:1:1";
    assert.equal(isChunkLoadError(err), true);
  });

  await t.test("recognizes nested cause chunk errors", () => {
    const cause = new Error("Loading chunk 440 failed.");
    const outer = new Error("Component render failure", { cause });
    assert.equal(isChunkLoadError(outer), true);
  });

  await t.test("does not false-positive on normal application errors", () => {
    assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')")), false);
    assert.equal(isChunkLoadError(new Error("NetworkError when attempting to fetch resource.")), false);
    assert.equal(isChunkLoadError(null), false);
  });

  await t.test("reloadForChunkError triggers reload and honors 15s loop guard", () => {
    let reloads = 0;
    const reloadFn = () => {
      reloads++;
    };

    // First call: reloads
    const first = reloadForChunkError(reloadFn);
    assert.equal(first, true);
    assert.equal(reloads, 1);

    // Immediate second call: suppressed by 15s loop guard
    const second = reloadForChunkError(reloadFn);
    assert.equal(second, false);
    assert.equal(reloads, 1);
  });

  await t.test("recognizes missing chunk URLs in error message or stack", () => {
    const errorWithUrl = new Error("net::ERR_ABORTED 404 at https://app.marketcatalyst.ai/_next/static/chunks/2983-e861ad53e29f3d38.js");
    assert.equal(isChunkLoadError(errorWithUrl), true);
  });
});
