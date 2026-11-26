// Live Feed News: on open, the top three stories drop in one after another
// with the green flash, the same intro as Market Catalyst Pulse.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const src = read("app/iq/screens/commentary.tsx");
const css = read("app/iq.css");

describe("Live Feed intro animation", () => {
  it("picks the top three of page 1 once, on the first full load", () => {
    assert.match(src, /if \(introIds === null && feedReady && pw\.page === 0 && pageFeed\.length > 0\) setIntroIds\(pageFeed\.slice\(0, 3\)/);
    assert.match(src, /intro=\{pw\.page === 0 && introIds \? introIds\.indexOf\(item\.id\) : -1\}/);
  });
  it("staggers them and reuses Pulse's drop-in and flash", () => {
    assert.match(src, /animationDelay: `\$\{intro \* 220\}ms`/);
    assert.match(css, /\.lfb-intro \{ animation: cpulse-drop [^}]*lfb-flash/);
  });
});
