import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// Logic #1: every "i" was titled "How the Emergence Score is calculated",
// including the intraday ones that open "How the Intraday score works".
describe("each 'i' is named for the explainer it opens", () => {
  const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
  it("intraday cards and the intraday strip say Intraday", () => {
    assert.equal(src.match(/<InfoDot onOpen=\{onInfo\} title=\{INTRADAY_INFO\} \/>/g)?.length, 2);
    assert.equal(src.match(/<InfoDot onOpen=\{onInfo\} title=\{INTRADAY_SHORT_INFO\} \/>/g)?.length, 2);
    assert.match(src, /title=\{bear \? INTRADAY_SHORT_INFO : INTRADAY_INFO\}/);
  });
});
