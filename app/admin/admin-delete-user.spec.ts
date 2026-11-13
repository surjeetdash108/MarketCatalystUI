import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const consoleHtml = readFileSync(new URL("../../public/admin/console.html", import.meta.url), "utf8");
const parent = readFileSync(new URL("./admin-console.tsx", import.meta.url), "utf8");

test("the user drawer has Delete user, confirmed by typing the email", () => {
  assert.match(consoleHtml, /onclick="admDeleteUser\('\$\{u\.id\}'\)">Delete user<\/button>/);
  assert.match(consoleHtml, /typed\.trim\(\)\.toLowerCase\(\)!==String\(u\.email\)\.toLowerCase\(\)/);
  assert.match(consoleHtml, /parent\.postMessage\(\{ type:'admin:userDelete', uid:id \}, location\.origin\)/);
});

test("the parent deletes only for the console iframe, via the admin API", () => {
  const i = parent.indexOf('d.type === "admin:userDelete"');
  assert.ok(i > 0);
  const block = parent.slice(i, i + 1200);
  assert.match(block, /e\.source !== iframeRef\.current\?\.contentWindow \|\| e\.origin !== window\.location\.origin/);
  assert.match(block, /apiDelete<[^>]*>\(`\/api\/admin\/users\/\$\{encodeURIComponent\(uid\)\}`\)/);
});
