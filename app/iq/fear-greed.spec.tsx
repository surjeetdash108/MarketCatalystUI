import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FG_ZONES, fgZone, fgPastReadings } from "./fear-greed";
import { FearGreedGauge, FearGreedPanel } from "./fear-greed-gauge";

describe("fgZone", () => {
  it("uses the backend's cut-offs: < 25, < 45, <= 55, <= 75", () => {
    const at = (v: number) => fgZone(v).label;
    assert.equal(at(0), "Extreme Fear");
    assert.equal(at(24), "Extreme Fear");
    assert.equal(at(25), "Fear");
    assert.equal(at(44), "Fear");
    assert.equal(at(45), "Neutral");
    assert.equal(at(55), "Neutral");
    assert.equal(at(56), "Greed");
    assert.equal(at(75), "Greed");
    assert.equal(at(76), "Extreme Greed");
    assert.equal(at(100), "Extreme Greed");
  });
  it("the five zones tile 0-100 with no gap", () => {
    assert.equal(FG_ZONES[0].from, 0);
    assert.equal(FG_ZONES[FG_ZONES.length - 1].to, 100);
    for (let i = 1; i < FG_ZONES.length; i++) assert.equal(FG_ZONES[i].from, FG_ZONES[i - 1].to);
  });
});

// The real readings around 27 Nov 2026 (27 Nov was the live reading; the 26th was a holiday).
const HISTORY = [
  { id: "2025-11-26", value: 43 },
  { id: "2026-10-27", value: 29 },
  { id: "2026-11-20", value: 3 },
  { id: "2026-11-23", value: 29 },
  { id: "2026-11-24", value: 19 },
  { id: "2026-11-25", value: 29 },
];

describe("fgPastReadings", () => {
  it("previous close, 1 week, 1 month and 1 year ago from the stored history", () => {
    const rows = fgPastReadings(HISTORY, "2026-11-27");
    assert.deepEqual(rows.map(r => [r.label, r.date, r.value]), [
      ["Previous close", "2026-11-25", 29],
      ["1 week ago", "2026-11-20", 3],
      ["1 month ago", "2026-10-27", 29],
      ["1 year ago", "2025-11-26", 43],
    ]);
  });
  it("the previous close is strictly before the current reading's date, never the reading itself", () => {
    const rows = fgPastReadings([...HISTORY, { id: "2026-11-27", value: 33 }], "2026-11-27");
    assert.equal(rows[0].date, "2026-11-25");
  });
  it("takes the nearest earlier session when the exact day has no reading", () => {
    // 1 week before Mon 23 Nov is Mon 16 Nov: a session before it stands in.
    const rows = fgPastReadings([{ id: "2026-11-13", value: 10 }, { id: "2026-11-20", value: 3 }], "2026-11-23");
    assert.deepEqual(rows.find(r => r.label === "1 week ago"), { label: "1 week ago", date: "2026-11-13", value: 10 });
  });
  it("leaves a row out when the nearest reading is too far back, rather than guessing", () => {
    const rows = fgPastReadings([{ id: "2026-11-25", value: 29 }], "2026-11-27");
    assert.deepEqual(rows.map(r => r.label), ["Previous close"]);
  });
  it("a month back clamps to the shorter month (31 Mar - 1 month is 28 Feb)", () => {
    const rows = fgPastReadings([{ id: "2027-02-28", value: 40 }], "2027-03-31");
    assert.deepEqual(rows.find(r => r.label === "1 month ago"), { label: "1 month ago", date: "2027-02-28", value: 40 });
  });
  it("nothing without a date, with a bad date, or with no history; bad rows are ignored", () => {
    assert.deepEqual(fgPastReadings(HISTORY, null), []);
    assert.deepEqual(fgPastReadings(HISTORY, "27 Nov"), []);
    assert.deepEqual(fgPastReadings([], "2026-11-27"), []);
    const rows = fgPastReadings([{ id: "2026-11-25", value: undefined }, { id: "bad", value: 5 }, { id: "2026-11-25", value: 29.4 }], "2026-11-27");
    assert.deepEqual(rows.map(r => r.value), [29]);
  });
});

describe("FearGreedGauge", () => {
  const html = (v: number) => renderToStaticMarkup(createElement(FearGreedGauge, { value: v, id: "t" }));
  it("shows the number and names the zone for assistive tech", () => {
    const h = html(33);
    assert.match(h, /aria-label="Fear and Greed index 33, Fear"/);
    assert.match(h, />33</);
  });
  it("lights exactly one zone: the one the value is in", () => {
    // The lit zone has a coloured outline; the other four have none.
    assert.equal((html(33).match(/stroke="#FB923C"/g) ?? []).length, 1);
    assert.equal((html(22).match(/stroke="#F87171"/g) ?? []).length, 1);
    assert.equal((html(90).match(/stroke="#4ADE80"/g) ?? []).length, 1);
  });
  it("copes with the ends of the scale", () => {
    assert.match(html(0), /Extreme Fear/);
    assert.match(html(100), /Extreme Greed/);
  });
});

describe("FearGreedPanel", () => {
  it("lists each past reading with its zone name and number", () => {
    const h = renderToStaticMarkup(createElement(FearGreedPanel, { value: 33, past: fgPastReadings(HISTORY, "2026-11-27"), id: "p" }));
    for (const label of ["Previous close", "1 week ago", "1 month ago", "1 year ago"]) assert.match(h, new RegExp(label));
    assert.match(h, /Extreme Fear/); // the week-ago reading of 3
  });
  it("is just the gauge when there are no past readings", () => {
    const h = renderToStaticMarkup(createElement(FearGreedPanel, { value: 33, past: [], id: "p" }));
    assert.doesNotMatch(h, /fg-past/);
    assert.match(h, /fg-cnn-gauge/);
  });
});
