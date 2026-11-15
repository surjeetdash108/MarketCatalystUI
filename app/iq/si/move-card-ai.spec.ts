import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAiCards, moveCardPath, usableAiCard, wantsAiCard } from "./move-card-ai";
import type { MajorSixMonthEvent } from "./types";

const ev = (o: Partial<MajorSixMonthEvent> = {}): MajorSixMonthEvent => ({
  num: 8,
  date: "Nov 10",
  iso: "2026-11-10",
  prevIso: "2026-11-09",
  label: "Why Nvidia Stock Is Getting Punished Today",
  category: "Corporate",
  mv: -5.47,
  details: "Rule-based details.",
  fr: 0.97,
  card: true,
  ...o,
});
const ai = { available: true, heading: "Nvidia shares tumble as CEO affair and chip-smuggling probes surface", summary: "Investors reacted to multiple investigations, including the board's probe into the CEO." };

describe("wantsAiCard", () => {
  it("cards under the chart take AI text; pins without a card, earnings cards and cards without a day do not", () => {
    assert.equal(wantsAiCard(ev()), true);
    assert.equal(wantsAiCard(ev({ card: false })), false);
    assert.equal(wantsAiCard(ev({ category: "Earnings" })), false);
    assert.equal(wantsAiCard(ev({ iso: undefined })), false);
  });
});

describe("moveCardPath", () => {
  it("asks for the trading day, the previous session, the move and the company name", () => {
    const path = moveCardPath("nvda", "NVIDIA Corporation", ev())!;
    assert.ok(path.startsWith("/live/move-explanation?"));
    const q = new URLSearchParams(path.split("?")[1]);
    assert.equal(q.get("ticker"), "NVDA");
    assert.equal(q.get("date"), "2026-11-10");
    assert.equal(q.get("prevDate"), "2026-11-09");
    assert.equal(q.get("move"), "-5.47");
    assert.equal(q.get("name"), "NVIDIA Corporation");
  });
  it("leaves out what is missing and returns null for cards that take no AI text", () => {
    const q = new URLSearchParams(moveCardPath("KO", undefined, ev({ prevIso: undefined }))!.split("?")[1]);
    assert.equal(q.has("prevDate"), false);
    assert.equal(q.has("name"), false);
    assert.equal(moveCardPath("NVDA", "x", ev({ category: "Earnings" })), null);
  });
});

describe("usableAiCard", () => {
  it("needs an available answer with a real heading and summary", () => {
    assert.equal(usableAiCard(ai), true);
    assert.equal(usableAiCard({ available: false }), false);
    assert.equal(usableAiCard({ ...ai, heading: "Short" }), false);
    assert.equal(usableAiCard({ ...ai, summary: "Too short." }), false);
    assert.equal(usableAiCard(null), false);
    assert.equal(usableAiCard(undefined), false);
  });
});

describe("applyAiCards", () => {
  it("swaps in the AI heading and summary for the matching day, keeping everything else", () => {
    const [out] = applyAiCards([ev()], { "2026-11-10": ai });
    assert.equal(out.label, ai.heading);
    assert.equal(out.details, ai.summary);
    assert.equal(out.mv, -5.47);
    assert.equal(out.category, "Corporate");
    assert.equal(out.num, 8);
  });
  it("keeps the rule-based text when there is no usable AI answer for that day", () => {
    const events = [ev(), ev({ num: 9, iso: "2026-11-12", date: "Nov 12", label: "Other" })];
    const out = applyAiCards(events, { "2026-11-10": { available: false }, "2026-11-12": undefined });
    assert.deepEqual(out, events);
  });
  it("never rewrites earnings cards or pins without a card", () => {
    const earn = ev({ category: "Earnings", label: "NVIDIA Corporation Q2 2027 earnings · EPS beat" });
    const pin = ev({ card: false, iso: "2026-11-12" });
    const out = applyAiCards([earn, pin], { "2026-11-10": ai, "2026-11-12": ai });
    assert.equal(out[0].label, earn.label);
    assert.equal(out[1].label, pin.label);
  });
  it("does not change the input", () => {
    const events = [ev()];
    applyAiCards(events, { "2026-11-10": ai });
    assert.equal(events[0].label, "Why Nvidia Stock Is Getting Punished Today");
  });
});
