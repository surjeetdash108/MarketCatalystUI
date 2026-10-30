# Strategy Lab browser walkthrough (real data, local)

The Lab's endpoints need a signed-in user, so the walkthrough drives the real
component against a local server that serves the same endpoints through the
backend's own `StrategyLabService` / `FmpService` (real FMP data, no auth).

1. `cp tests/strategy-lab/e2e/lab-harness.ts.txt ../MarketCatalystBackEnd/scripts/_lab-harness.ts`
   and run it: `cd ../MarketCatalystBackEnd && npx ts-node -P tsconfig.json scripts/_lab-harness.ts` (port 4400).
2. `mkdir -p app/sl-harness && cp tests/strategy-lab/e2e/harness-page.tsx.txt app/sl-harness/page.tsx`,
   then `npx next dev --webpack` (`.env.local` points the app at localhost:4400).
3. `node tests/strategy-lab/e2e/e2e.mjs` (needs `playwright`; set BASE in the script to the dev port).
   Screenshots and `e2e-results.json` land in `tests/strategy-lab/shots/`.
4. Delete `app/sl-harness` and the backend script afterwards — neither ships.
