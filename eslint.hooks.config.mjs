// Hooks-order gate, run before every build (see "prebuild" in package.json).
// Next 16 no longer lints during `next build`, so a hook called after an early
// return used to ship silently and crash at runtime with React error #310
// ("Rendered more hooks than during the previous render"). This config turns
// on ONLY that rule so the gate fails for this bug class and nothing else.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const onlyRulesOfHooks = (cfg) => (cfg.rules ? { ...cfg, rules: {} } : cfg);

export default defineConfig([
  ...nextVitals.map(onlyRulesOfHooks),
  ...nextTs.map(onlyRulesOfHooks),
  { rules: { "react-hooks/rules-of-hooks": "error" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
