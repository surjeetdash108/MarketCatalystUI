import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const alp = fs.readFileSync(new URL("../../app/iq/screens/alpha-signals.tsx", import.meta.url), "utf8");

describe("Alpha Signals Top Pick Modal - View Full Chart button", () => {
  it("renders View Full Chart button directly to the left of Stock Intelligence button in modal footer", () => {
    assert.match(
      alp,
      /onViewFullChart\s*&&\s*<button[^>]*className="alp-btn ghost"[^>]*onClick=\{onViewFullChart\}>View Full Chart<\/button>\s*\}\s*<button[^>]*className="alp-btn"[^>]*onClick=\{onExplore\}>Stock Intelligence →<\/button>/,
      "Modal footer must have View Full Chart button to the left of Stock Intelligence button"
    );
  });

  it("calls openStockDetail with pick ticker and list of pick tickers", () => {
    assert.match(
      alp,
      /onViewFullChart=\{[^}]*openStockDetail\(pick\.c\.ticker,\s*picks\.map\(p\s*=>\s*p\.c\.ticker\)\)[^}]*\}/,
      "View Full Chart must call openStockDetail with pick ticker and pick tickers list"
    );
  });
});
