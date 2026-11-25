import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePulse, parsePulseInline, pulsePlainText } from "./pulse-rich";

describe("Pulse rich text", () => {
  it("the JPMorgan post: a summary paragraph, then bullets with italic labels (was one run-on line)", () => {
    const text = [
      "JPMorgan expects annual AI capital spending to nearly double.",
      "",
      "* *Spending Plateau:* Annual AI data center spending is projected to peak.",
      "* *Financing:* Constraints increasingly limit the pace.",
    ].join("\n");
    const blocks = parsePulse(text);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].k, "p");
    assert.equal(blocks[1].k, "ul");
    if (blocks[1].k !== "ul") return;
    assert.equal(blocks[1].items.length, 2);
    assert.deepEqual(blocks[1].items[0][0], { k: "i", c: [{ k: "text", t: "Spending Plateau:" }] });
  });

  it("bold, italic and links", () => {
    assert.deepEqual(parsePulseInline("**NVDA** up *after hours* [read](https://example.com/a) https://x.com/b."), [
      { k: "b", c: [{ k: "text", t: "NVDA" }] },
      { k: "text", t: " up " },
      { k: "i", c: [{ k: "text", t: "after hours" }] },
      { k: "text", t: " " },
      { k: "link", href: "https://example.com/a", c: [{ k: "text", t: "read" }] },
      { k: "text", t: " " },
      { k: "link", href: "https://x.com/b", c: [{ k: "text", t: "https://x.com/b" }] },
      { k: "text", t: "." },
    ]);
  });

  it("a stray asterisk in prose and non-web links stay plain text", () => {
    assert.deepEqual(parsePulseInline("3 * 4 = 12"), [{ k: "text", t: "3 * 4 = 12" }]);
    assert.deepEqual(parsePulseInline("[x](javascript:alert(1))"), [{ k: "text", t: "[x](javascript:alert(1))" }]);
  });

  it("numbered lists, line breaks inside a paragraph, and old plain posts", () => {
    const blocks = parsePulse("Top movers:\nas of 10:30\n1. NVDA\n2) AMD");
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].k === "p" && blocks[0].lines.length, 2);
    assert.equal(blocks[1].k === "ol" && blocks[1].items.length, 2);
    assert.deepEqual(parsePulse("Plain old post."), [{ k: "p", lines: [[{ k: "text", t: "Plain old post." }]] }]);
  });

  it("plain text drops markers and hidden link targets (for the search count)", () => {
    assert.equal(pulsePlainText("**Big** move\n\n* [Story](https://a.com/x)"), "Big move\n\nStory");
  });
});
