// The live streams require a signed stream ticket (backend StreamTicketGuard).
// Every EventSource on /live/stream or /live/tape/stream must go through
// subscribeAuthedStream, which fetches the ticket; a raw subscribeStream on
// those paths would be refused with 401 and silently fall back to polling.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("../../app/", import.meta.url).pathname;
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(d.name) && !/\.spec\./.test(d.name) ? [p] : [];
  });
}

describe("live streams are opened with a stream ticket", () => {
  const all = files(root).map((f) => [path.relative(root, f), fs.readFileSync(f, "utf8")]);
  it("no code opens /live/stream or /live/tape/stream without subscribeAuthedStream", () => {
    const raw = all.filter(([, s]) => /(subscribeStream|new EventSource)\([^)]*\/live\/(tape\/)?stream/.test(s)).map(([f]) => f);
    assert.deepEqual(raw, []);
  });
  it("the tape and per-ticker hooks use subscribeAuthedStream", () => {
    const get = (f) => all.find(([p]) => p === f)[1];
    assert.match(get("iq/hooks/useTapeStream.ts"), /subscribeAuthedStream\("\/live\/tape\/stream"/);
    assert.match(get("iq/hooks/useLiveTick.ts"), /subscribeAuthedStream\(`\/live\/stream\?ticker=/);
  });
  it("tickets come from POST /api/stream-ticket", () => {
    assert.match(all.find(([p]) => p === "iq/hooks/shared-event-source.ts")[1], /apiPost<TicketResponse>\("\/api\/stream-ticket"\)/);
  });
});
