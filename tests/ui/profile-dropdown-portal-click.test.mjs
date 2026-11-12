// The profile dropdown is rendered through a portal (document.body), so it is not
// inside the avatar wrapper. The outside-click handler must treat a press inside
// the portaled menu as "inside", otherwise the menu closes on mousedown and
// Logout / Settings / My Profile never receive their click. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app/iq/shell.tsx", import.meta.url), "utf8");

test("portaled profile menu has its own ref", () => {
  assert.match(src, /const profileMenuPortalRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(src, /<div className="profile-dropdown" ref=\{profileMenuPortalRef\}/);
});

test("outside-click handler ignores presses inside the portaled menu", () => {
  const handler = src.match(/function handleOutsideClick\(e: MouseEvent\) \{[\s\S]*?\n    \}/)?.[0] ?? "";
  assert.match(handler, /profileDropdownRef\.current\?\.contains\(target\)/);
  assert.match(handler, /profileMenuPortalRef\.current\?\.contains\(target\)/);
});
