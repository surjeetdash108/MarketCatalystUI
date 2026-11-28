// The Stock Intelligence screen CSS (app/iq/si/si-redesign-css.ts) turns every element whose inline style has a
// `letter-spacing` outside 0.00-0.05em, or an `uppercase`, into lowercase text (the design's all-caps labels are
// shown as "Status", "Mode"...). Text written in proper case inside such an element is wrecked by it: "Trend:
// Bullish if price is above the 50 and 200 DMA" showed as "trend: bullish ... 200 dma", "1M" as "1m", a ticker as
// "nvda". Such text must carry data-tc (or data-caps), which switches the lowercasing off.
// This reads the components' source and fails on any such element that has lower-case letters in its own text.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../app/iq/si");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx") && !/\.spec\./.test(f));

const SAFE_SPACING = /^0\.0[0-5]em$/;
const attrOf = (el, name) => el.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.text === name);
const opted = (el) => !!attrOf(el, "data-tc") || !!attrOf(el, "data-caps");

/** The literal values a style property can take (both branches of a ternary); numbers as React prints them. */
function literals(n) {
  if (!n) return [];
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return [n.text];
  if (ts.isNumericLiteral(n)) return [Number(n.text) === 0 ? "0" : `${n.text}px`];
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return [`-${n.operand.text}px`];
  if (ts.isConditionalExpression(n)) return [...literals(n.whenTrue), ...literals(n.whenFalse)];
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) return literals(n.expression);
  return ["<dynamic>"];
}

function violations(file) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const consts = new Map();
  (function find(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      const init = ts.isAsExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (ts.isObjectLiteralExpression(init)) consts.set(n.name.text, init);
    }
    ts.forEachChild(n, find);
  })(sf);

  const props = (obj, depth = 0) => {
    const out = {};
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) out[p.name.text] = literals(p.initializer);
      else if (ts.isSpreadAssignment(p) && depth < 3) {
        const e = p.expression;
        if (ts.isIdentifier(e) && consts.has(e.text)) Object.assign(out, props(consts.get(e.text), depth + 1));
        else if (ts.isObjectLiteralExpression(e)) Object.assign(out, props(e, depth + 1));
      }
    }
    return out;
  };
  /** Does the screen CSS lowercase this element? */
  const lowercased = (el) => {
    const a = attrOf(el, "style");
    const e = a?.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : null;
    const obj = e && ts.isObjectLiteralExpression(e) ? e : e && ts.isIdentifier(e) ? consts.get(e.text) : null;
    if (!obj) return false;
    const p = props(obj);
    return (p.letterSpacing || []).some((v) => !SAFE_SPACING.test(v)) || (p.textTransform || []).some((v) => /uppercase/.test(v));
  };

  /** Text written in the element itself and in children that do not opt out, as the string literals and JSX text. */
  const ownText = (n, out) => {
    if (ts.isJsxText(n)) out.push(n.text);
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    else if (ts.isJsxElement(n) && opted(n.openingElement)) return;
    else if (ts.isJsxAttribute(n)) return;
    else ts.forEachChild(n, (c) => ownText(c, out));
  };

  const found = [];
  (function walk(n) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const el = ts.isJsxElement(n) ? n.openingElement : n;
      if (lowercased(el) && !opted(el) && ts.isJsxElement(n)) {
        const out = [];
        n.children.forEach((c) => ownText(c, out));
        const shown = out.join("").replace(/&[a-z]+;|&#\d+;/gi, " ").replace(/\s+/g, " ").trim();
        if (/[a-z]/.test(shown)) found.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}  "${shown.slice(0, 70)}"`);
      }
    }
    ts.forEachChild(n, walk);
  })(sf);
  return found;
}

describe("Stock Intelligence: text the screen would lowercase", () => {
  it("no element with mixed-case text is lowercased (add data-tc, or write the label in capitals)", () => {
    const all = files.flatMap(violations);
    assert.deepEqual(all, [], `These elements are lowercased by si-redesign-css.ts but hold text with lowercase letters:\n${all.join("\n")}`);
  });
  it("the info tooltip bubble keeps its capitals", () => {
    const src = fs.readFileSync(path.join(dir, "read-cards.tsx"), "utf8");
    assert.match(src, /role="tooltip"[\s\S]{0,400}?\bdata-tc\b[\s\S]{0,40}?style=/);
  });
});
