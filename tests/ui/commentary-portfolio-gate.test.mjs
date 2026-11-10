// Commentary's "My names" tab must not call /api/portfolio for users whose plan
// lacks Portfolio (Starter): no request, no 403 — a small lock line instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app/iq/screens/commentary.tsx", import.meta.url), "utf8");

test("checks entitlements before calling /api/portfolio", () => {
  assert.match(src, /const portfolioGate = featureDecision\(useEntitlements\(\), "portfolio"\)\.kind;/);
  assert.match(src, /if \(portfolioGate === "loading"\) return;/);
  assert.match(src, /portfolioGate === "allow"\s*\?\s*apiGet<\{ holdings: HoldingDoc\[\] \}>\("\/api\/portfolio"\)/);
  assert.equal((src.match(/"\/api\/portfolio"/g) ?? []).length, 1);
});

test("non-entitled users see a small lock line instead", () => {
  assert.match(src, /portfolioLocked\s*\?\s*<span className="pill" data-testid="portfolio-lock-line"[^>]*>Watchlist · 🔒 portfolio on Starter<\/span>/);
});
