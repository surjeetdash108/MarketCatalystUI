// Opening intro and live arrivals, Live Feed News and Pulse: one smooth motion.
// The top three drop in from the first render (not after every source loads),
// the rest fade in after them, and stories from one refresh land one by one.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const feed = read("app/iq/screens/commentary.tsx");
const pulse = read("app/iq/community-pulse.tsx");
const motion = read("app/iq/hooks/useArrivalMotion.ts");
const css = read("app/iq.css");

describe("smooth intro and arrivals", () => {
  it("Live Feed picks the top three on the first render of stories, not after the full load", () => {
    assert.match(feed, /if \(introIds === null && pw\.page === 0 && pageFeed\.length > 0\) setIntroIds\(pageFeed\.slice\(0, 3\)/);
    assert.doesNotMatch(feed, /introIds === null && feedReady/);
  });
  it("the rest of the list fades in after the top three (both screens)", () => {
    assert.match(css, /\.lfb-after \{ animation: lfb-fadein [^}]*\.55s backwards/);
    assert.match(feed, / lfb-after/);
    assert.match(pulse, / lfb-after/);
  });
  it("stories arriving together land one by one, each flash delayed to match", () => {
    assert.match(motion, /arrived\.forEach\(\(r, i\) => \{\s*const delay = i \* ARRIVAL_STAGGER_MS;/);
    assert.match(motion, /r\.style\.animationDelay = `\$\{delay\}ms`/);
    assert.match(motion, /export const ARRIVAL_STAGGER_MS = 160;/);
  });
  it("one soft motion everywhere: 14px drop, same ease", () => {
    assert.match(css, /@keyframes lfb-drop \{ from \{ opacity: 0; transform: translateY\(-14px\)/);
    assert.match(motion, /ARRIVAL_EASE = "cubic-bezier\(\.22,1,\.36,1\)"/);
  });
});
