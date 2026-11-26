// W-10 (26 Nov 2026 audit): the FAQ renamed "Portfolio Pulse" to "Portfolio";
// the signup page still listed the old name. Run: node --test tests/ui/
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

it("signup lists the workspace as Portfolio", () => {
  const src = fs.readFileSync(new URL("../../app/auth/auth-layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /Portfolio Pulse/);
  assert.match(src, /label: "Portfolio"/);
});
