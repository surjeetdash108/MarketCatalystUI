import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { displayStatus, hasListed, isNonCommonListing, listingKind } from "./ipo-rows";

const today = "2026-11-24";

describe("IPO rows", () => {
  it("a 'pending' deal that trades shows as listed", () => {
    // FMBM: stored pending on 19 Nov, trading at $46.25.
    const fmbm = { symbol: "FMBM", date: "2026-11-19", status: "pending", currentPrice: null };
    assert.equal(hasListed(fmbm, 46.25, today), true);
    assert.equal(displayStatus(fmbm, 46.25, today), "history");
  });

  it("keeps pending until it trades, and never lists a future date", () => {
    assert.equal(displayStatus({ symbol: "ABC", date: "2026-11-19", status: "pending" }, null, today), "pending");
    assert.equal(hasListed({ symbol: "ABC", date: "2026-11-30", status: "pending" }, 10, today), false);
  });

  it("withdrawn stays withdrawn", () => {
    assert.equal(displayStatus({ symbol: "X", date: "2026-11-01", status: "withdrawn" }, 5, today), "withdrawn");
  });

  it("spots ETFs, warrants and units by type, symbol or name", () => {
    assert.equal(listingKind({ symbol: "CCHP", securityType: "ETF" }), "ETF");
    assert.equal(listingKind({ symbol: "GMIX", name: "BlackRock ETF Trust" }), "ETF");
    assert.equal(listingKind({ symbol: "ENVXW" }), "Warrant");
    assert.equal(listingKind({ symbol: "KACQU", securityType: "SP" }), "Unit");
    assert.equal(listingKind({ symbol: "FBLLU" }), "Unit");
    assert.equal(listingKind({ symbol: "ANT", securityType: "CS" }), null);
    assert.equal(isNonCommonListing({ symbol: "FMBM" }), false);
    assert.equal(isNonCommonListing({ symbol: "ENVXW" }), true);
  });
});
