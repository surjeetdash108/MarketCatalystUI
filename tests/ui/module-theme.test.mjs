// Light mode for Strategy Lab and Money Flow: every colour reads a theme
// variable, the light palette is readable, and both headers carry the switch.
// Run: node --test tests/ui/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THEME_HEX, THEME_RGB, MODULE_THEME_CSS, lightOf, contrast, isAccent } from "../../app/iq/theme/module-theme.js";

const FILES = ["sl/lab-controller.jsx", "sl/lab-panels.jsx", "sl/lab-view.jsx", "sl/strategy-lab-screen.tsx", "sl/lab-mobile.js",
  "screens/money-flow.tsx", "money-flow/chart-svg.tsx", "money-flow/full-chart.tsx", "money-flow/engine.ts"];
const src = Object.fromEntries(FILES.map((f) => [f, fs.readFileSync(new URL("../../app/iq/" + f, import.meta.url), "utf8")]));

describe("Strategy Lab and Money Flow follow the app theme", () => {
  it("no literal colour is left (logo tiles stay white on purpose)", () => {
    for (const [f, s] of Object.entries(src)) {
      const left = [...s.matchAll(/(?<![\w&-])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?!\w)/g)].filter((m) => !/background:\s*["']?$/.test(s.slice(Math.max(0, m.index - 14), m.index)));
      assert.deepEqual(left.map((m) => m[0]), [], f);
      assert.doesNotMatch(s, /rgba\(\s*(8,\s*9,\s*10|4,\s*5,\s*6|11,\s*13,\s*14|255,\s*255,\s*255|230,\s*235,\s*232)\s*,/, f + ": a dark-theme neutral with alpha");
    }
  });
  it("SVG colours are set in style, not as attributes (var() is only certain to work in CSS)", () => {
    for (const [f, s] of Object.entries(src)) if (/\.(t|j)sx$/.test(f)) assert.doesNotMatch(s, /\s(fill|stroke|stopColor|floodColor)=["{]/, f);
    const toggle = fs.readFileSync(new URL("../../app/iq/theme/theme-toggle.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(toggle, /\s(fill|stroke)=["{]/);
  });
  it("every variable the code reads is defined for both themes", () => {
    for (const [f, s] of Object.entries(src)) {
      for (const [, h] of s.matchAll(/var\(--th-([0-9a-f]{6})\)/g)) assert.ok(THEME_HEX.includes(h), `${f}: --th-${h}`);
      for (const [, h] of s.matchAll(/var\(--thr-([0-9a-f]{6})\)/g)) assert.ok(THEME_RGB.includes(h), `${f}: --thr-${h}`);
    }
    assert.match(MODULE_THEME_CSS, /^\.iq-root\{[^}]*--th-08090a:#08090a;/, "dark = the original colours");
    for (const h of THEME_HEX) assert.ok(MODULE_THEME_CSS.split("}")[0].includes(`--th-${h}:#${h};`), `dark --th-${h}`);
    assert.match(MODULE_THEME_CSS, /\.iq-root\[data-theme="light"\]\{[^}]*--th-08090a:#ffffff;/);
  });
  it("light palette: the page is white, body text near black, muted text still readable, accents readable on white", () => {
    assert.equal(lightOf("#08090a"), "#ffffff");
    assert.ok(contrast(lightOf("#e6ebe8"), "#ffffff") >= 12, "body text");
    assert.ok(contrast(lightOf("#7a8481"), "#ffffff") >= 4.5, "muted labels");
    for (const h of ["#c9a24a", "#3ddc84", "#f0565a", "#f0d68c"]) {
      assert.ok(isAccent(h), h);
      const c = contrast(lightOf(h), "#ffffff");
      assert.ok(c >= 4.5 && c <= 5, `${h} → ${lightOf(h)} contrast ${c.toFixed(2)}`);
    }
    // a surface just above the dark page sits just below white; a border a little further
    assert.ok(contrast(lightOf("#0d0f10"), "#ffffff") < contrast(lightOf("#1a1f21"), "#ffffff"));
  });
  it("both module headers carry the dark / light switch", () => {
    assert.match(src["sl/strategy-lab-screen.tsx"], /<ModuleThemeToggle \/>/);
    assert.match(src["screens/money-flow.tsx"], /<ModuleThemeToggle \/>/);
    const toggle = fs.readFileSync(new URL("../../app/iq/theme/theme-toggle.tsx", import.meta.url), "utf8");
    assert.match(toggle, /setTheme\(isLight \? "dark" : "light"\)/);
    assert.match(toggle, /<style>\{MODULE_THEME_CSS\}<\/style>/);
  });
  it("the shell's page behind both modules follows the theme", () => {
    const shell = fs.readFileSync(new URL("../../app/iq/shell.tsx", import.meta.url), "utf8");
    assert.equal((shell.match(/background: "var\(--th-08090a, #08090a\)"/g) || []).length, 2);
  });
});
