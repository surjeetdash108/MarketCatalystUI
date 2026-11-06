// Logos are cached by browsers for 7 days ("immutable"). After the backend
// stopped serving white-on-transparent logos (ALNY), the URL carries a version
// so browsers fetch the corrected image instead of the cached white one.
// Run: node --test tests/ui/
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const utils = fs.readFileSync(new URL("../../app/iq/utils.tsx", import.meta.url), "utf8");
it("the logo URL carries a cache version", () => {
  assert.match(utils, /const LOGO_VERSION = "\d+";/);
  assert.match(utils, /backendUrl\(`\/live\/logo\?ticker=\$\{encodeURIComponent\(s\)\}&v=\$\{LOGO_VERSION\}`\)/);
});
