import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  SNAPSHOT_MAX_AGE_MS,
  boardFromSavedDoc,
  decodeGzBase64,
  newerBoard,
  sessionRunning,
  snapshotUsable,
} from "./board-source";

const THU_10_ET = Date.parse("2026-11-19T15:00:00Z");
const SAT_10_ET = Date.parse("2026-11-21T15:00:00Z");
const MIN = 60_000;
const gz = (o: unknown) => gzipSync(Buffer.from(JSON.stringify(o))).toString("base64");

describe("Money Flow saved board: freshness (same rule as the backend)", () => {
  it("session runs weekdays 09:30–16:30 ET", () => {
    assert.equal(sessionRunning(THU_10_ET), true);
    assert.equal(sessionRunning(Date.parse("2026-11-19T14:00:00Z")), false);
    assert.equal(sessionRunning(SAT_10_ET), false);
  });
  it("in the session a saved board is trusted up to 10 minutes; off-hours the last build stands up to 4 days", () => {
    assert.equal(snapshotUsable(THU_10_ET - SNAPSHOT_MAX_AGE_MS, THU_10_ET), true);
    assert.equal(snapshotUsable(THU_10_ET - SNAPSHOT_MAX_AGE_MS - MIN, THU_10_ET), false);
    assert.equal(snapshotUsable(Date.parse("2026-11-20T21:20:00Z"), SAT_10_ET), true);
    assert.equal(snapshotUsable(SAT_10_ET - 5 * 24 * 60 * MIN, SAT_10_ET), false);
  });
  it("matches the backend's limits", () => {
    const be = readFileSync(
      new URL("../../../../MarketCatalystBackEnd/src/live/money-flow/money-flow-snapshot.ts", import.meta.url),
      "utf8",
    );
    assert.match(be, /SNAPSHOT_MAX_AGE_MS = 10 \* 60_000/);
    assert.match(be, /SNAPSHOT_OFFHOURS_MAX_AGE_MS = 4 \* 24 \* 60 \* 60_000/);
  });
});

describe("Money Flow saved board: decoding the Firestore document", () => {
  const board = { asOf: new Date(THU_10_ET - MIN).toISOString(), sessionDate: "2026-11-19", gainers: [{ t: "NVDA" }] };
  it("unzips base64 gzip JSON", async () => {
    assert.deepEqual(await decodeGzBase64(gz(board)), board);
  });
  it("returns the board for a fresh document, null for a stale, wrong-schema or empty one", async () => {
    const doc = { schema: 1, gz: gz(board), builtAt: THU_10_ET - MIN };
    assert.deepEqual(await boardFromSavedDoc(doc, THU_10_ET), board);
    assert.equal(await boardFromSavedDoc({ ...doc, builtAt: THU_10_ET - 30 * MIN }, THU_10_ET), null);
    assert.equal(await boardFromSavedDoc({ ...doc, schema: 2 }, THU_10_ET), null);
    assert.equal(await boardFromSavedDoc(null, THU_10_ET), null);
  });
});

describe("Money Flow saved board: the newest board wins", () => {
  const a = { asOf: "2026-11-19T15:00:00.000Z", id: "a" };
  const b = { asOf: "2026-11-19T15:01:00.000Z", id: "b" };
  it("picks the later asOf, keeps the current one on a tie or an unparseable asOf", () => {
    assert.equal(newerBoard(a, b), b);
    assert.equal(newerBoard(b, a), b);
    assert.equal(newerBoard(a, { ...a, id: "same" }), a);
    assert.equal(newerBoard(a, { asOf: "nope" }), a);
    assert.equal(newerBoard(null, a), a);
  });
});

describe("Money Flow screen wiring", () => {
  const src = readFileSync(new URL("../screens/money-flow.tsx", import.meta.url), "utf8");
  it("reads the board through useMoneyFlowBoard, not a direct 15 s poll of /live/money-flow", () => {
    assert.match(src, /useMoneyFlowBoard<MoneyFlowBoard>\(\)/);
    assert.doesNotMatch(src, /useApiResource<MoneyFlowBoard>\("\/live\/money-flow"/);
  });
  it("shows live quote prices on the tiles during the session", () => {
    assert.match(src, /mkt\.phase === "open"[\s\S]{0,200}liveQuotes\.get\(stock\.t\)/);
  });
  it("still calls /live/money-flow once per open (usage stats, entitlement, fallback)", () => {
    const hook = readFileSync(new URL("./useMoneyFlowBoard.ts", import.meta.url), "utf8");
    assert.match(hook, /apiGet<T>\("\/live\/money-flow"\)/);
  });
});

describe("Stock Intelligence home", () => {
  it("asks for no bars until a stock is picked (no NVDA default)", () => {
    const si = readFileSync(new URL("../si/stock-intelligence.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(si, /currentTicker \|\| "NVDA"/);
  });
});
