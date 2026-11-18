import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { trialLeft } from "./summary-card";

// "6 days free" at checkout read like a fresh 6-day trial; it's what's left of the 7.
test("checkout says how many MORE days are free", () => {
  assert.equal(trialLeft(6), "6 more days free");
  assert.equal(trialLeft(1), "1 more day free");
  const src = readFileSync(new URL("./summary-card.tsx", import.meta.url), "utf8");
  assert.equal(src.match(/\{trialLeft\(trial\.days\)\}/g)?.length, 3);
  assert.doesNotMatch(src, /\{trial\.days\} \{trial\.days === 1 \? "day" : "days"\} free/);
});
