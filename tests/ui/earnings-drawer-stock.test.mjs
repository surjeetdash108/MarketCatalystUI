// Dashboard → Earnings today → click a stock: the same wide popover Movers
// opens, with the full stock screen first, then the EPS line and the
// "Open … in Market Catalyst / Stock Intelligence" buttons.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const shell = fs.readFileSync(new URL("../../app/iq/shell.tsx", import.meta.url), "utf8");
const d = shell.slice(shell.indexOf("function EarningsDrawer("), shell.indexOf("\n}\n", shell.indexOf("function EarningsDrawer(")));

describe("Earnings today popover shows the stock", () => {
  it("is the wide popover, like Movers", () => assert.match(d, /<div className="drawer open wide">/));
  it("the stock screen comes before the EPS line and both Open buttons", () => {
    const embed = d.indexOf("<StockScreenEmbed initialSym={sym} />");
    assert.ok(embed > 0, "StockScreenEmbed");
    assert.ok(embed < d.indexOf("EPS · actual vs est"));
    assert.ok(embed < d.indexOf("in Market Catalyst →"));
    assert.ok(embed < d.indexOf("in Stock Intelligence →"));
  });
});
