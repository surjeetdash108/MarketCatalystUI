import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("content editor console (Blogs + Content pipeline only)", () => {
  it("an editor email lands on /admin after sign-in; everyone else keeps their home", async () => {
    process.env.NEXT_PUBLIC_ADMIN_EDITOR_EMAILS = " Editor@Example.com ,";
    const m = await import(`./admin-email.ts?editor=${Date.now()}`);
    assert.equal(m.isEditorEmail("editor@example.com"), true);
    assert.equal(m.isAdminEmail("editor@example.com"), false);
    assert.equal(m.postLoginPath("editor@example.com"), "/admin");
    assert.equal(m.postLoginPath("someone@example.com"), "/dashboard");
    assert.equal(m.postLoginPath(m.ADMIN_EMAIL), "/admin");
  });

  it("both sign-in paths send a console account to /admin", () => {
    assert.match(read("../auth/login/login-form.tsx"), /if \(isConsoleEmail\(email\)\) \{/);
    assert.match(read("../auth/auth-utils.ts"), /if \(isConsoleEmail\(userCredential\.user\.email\)\) \{/);
  });

  it("the console page opens the editor console only when the backend says role 'editor'", () => {
    const src = read("./admin-console.tsx");
    assert.match(src, /apiGet<\{ role\?: string \| null \}>\("\/api\/admin\/whoami"\)/);
    assert.match(src, /me\?\.role === "editor"/);
    assert.match(src, /\} else if \(user && \(await editorRole\(\)\)\) \{/);
  });

  it("the editor dataset carries no users, plans or analytics", async () => {
    const { editorDataset } = await import("./admin-console");
    const d = editorDataset();
    assert.equal(d.role, "editor");
    assert.deepEqual([d.users, d.plans, d.featureAdoption, d.apiHealth], [[], [], [], null]);
  });

  it("console.html keeps only Blogs and Content pipeline for an editor", () => {
    const html = read("../../public/admin/console.html");
    assert.match(html, /const EDITOR = !IS_DEMO && REAL && REAL\.role === 'editor';/);
    assert.match(html, /const EDITOR_VIEWS = \['blogs','content'\];/);
    assert.match(html, /const KNOWN_VIEWS = EDITOR \? EDITOR_VIEWS : \[/);
    assert.match(html, /if \(!KNOWN_VIEWS\.includes\(name\)\) name = HOME_VIEW;/);
    assert.match(html, /if\(!EDITOR_VIEWS\.includes\(n\.dataset\.view\)\) n\.remove\(\);/);
  });
});
