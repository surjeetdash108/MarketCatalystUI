// The profile dropdown is rendered through a portal (document.body), so it is not
// inside the avatar wrapper. The outside-click handler must treat a press inside
// the portaled menu as "inside", otherwise the menu closes on mousedown and
// Logout / Settings / My Profile never receive their click. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const src = read("app/iq/profile-menu.tsx");

test("portaled profile menu has its own ref", () => {
  assert.match(src, /const menuRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(src, /className="profile-dropdown"[\s\S]{0,80}ref=\{menuRef\}/);
  assert.match(src, /createPortal\(/);
});

test("outside-click handler ignores presses inside the portaled menu", () => {
  const handler = src.match(/const onDown = \(e: MouseEvent\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
  assert.match(handler, /wrapRef\.current\?\.contains\(t\)/);
  assert.match(handler, /menuRef\.current\?\.contains\(t\)/);
});

test("every product shows the same profile menu (MC, SI, Money Flow, Strategy Lab)", () => {
  for (const f of [
    "app/iq/shell.tsx",
    "app/iq/si/stock-intelligence.tsx",
    "app/iq/screens/money-flow.tsx",
    "app/iq/sl/strategy-lab-screen.tsx",
  ]) {
    assert.match(read(f), /import \{ ProfileMenu \} from "\.\.?\/profile-menu";/, f);
    assert.match(read(f), /<ProfileMenu \/>/, f);
  }
  // Both SI headers: the landing search and the stock view.
  assert.equal(read("app/iq/si/stock-intelligence.tsx").match(/<ProfileMenu \/>/g)?.length, 2);
  // One menu definition — the shell no longer carries its own copy.
  assert.doesNotMatch(read("app/iq/shell.tsx"), /className="profile-dropdown"/);
});
