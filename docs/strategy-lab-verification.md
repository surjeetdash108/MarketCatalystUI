# Strategy Lab (standalone `/sl`) — verification (re-run after the fixes)

Run on 2026-10-30, branch `feat/strategy-lab-hardening` in both repos, uncommitted.

**How it was checked**
- **Engine and parser:** `node --test tests/strategy-lab/*.mjs`.
- **Browser:** Playwright drove the real `StrategyLab` component, on real FMP data, through a local server that serves the Lab endpoints via the backend's own `StrategyLabService` and `FmpService` (`tests/strategy-lab/e2e/`). The production endpoints need a signed-in user, so this local server stands in for them. That route has no auth, so auth itself isn't exercised.
- **Evidence:** screenshots and `e2e-results.json` are in `tests/strategy-lab/shots/`.

## Results

| Check | Result | Evidence |
|---|---|---|
| **A. Fake data** | | |
| A1 `STATIC_RESULTS`, `if (true)`, `vSample`, sample array, `0.91`, `fct`/`tcn`/`wnz`, `PX0` | PASS | No matches in `app/iq/sl/*`. |
| A2 Synthetic chart / "example data" leftovers | PASS | The chart modal and `chartData` are gone. The report's price chart is built from real bars sliced to the test window (`lab-controller.jsx`, `reportVm`). |
| A3 `labAlert` toast | PASS | Removed, together with step 4 (`labS4`, `matches`). "See today's matches" returns to the Signal-sorted results (e2e "Step 4 matches"). |
| A4 Hard-coded metric literals | PASS | The `SPY` array and the hard-coded sample tables are gone. All numbers come from `computeRow`, `summarize` or `runRules`. |
| A5 Automation behind a flag, off; no fake "Test order sent" | PASS | `app/iq/sl/flags.js` reads `NEXT_PUBLIC_STRATEGY_LAB_AUTOMATION === "true"`, so it's off by default. `canAuto` and `auOpen` are gated on it. No order or test-order code exists. `docs/strategy-lab-automation-todo.md` is written. e2e U9 PASS. |
| A6 No FMP key in the browser | PASS | Every fetch goes through `apiGet('/live/strategy-lab/…')`. `localStorage` holds only the saved-strategy offline cache (`mc_lab_saved_v2`) and a migration marker. |
| **B. Engine** (`verify.engine.test.mjs` 24/24, `engine.test.mjs` 27/27) | | |
| E1–E13 | PASS | Unchanged from the first audit. Calendar CAGR exact; weekly √52; 5-min CAGR null with exposure 0.349; ATR within 2e-16 of the reference; 20k 1-min bars in a median 9.7 ms. |
| **C. Parser** | | |
| R1–R9 | PASS | As before. New: "…on the 15 min chart" sets the timeframe instead of leaving text untranslated (`engine.test.mjs`). |
| **D. Config consistency** | | |
| D1 One `valCfg()` | PASS | `lab-config.js` `valCfg()` = exit-plan engine + costs + tf + years or days. The controller uses it for the run (`runValidate`), the report (`reportVm`), chart levels, the stale signature (`sigOf`) and Save/Edit (`savedCfgOf`). |
| D2 Same keys everywhere | PASS | Exit-plan rows, the variance heat-map (`varianceCells`, which writes `stopM/stop/stopA/tpM/tp/tpR`) and the edit modal all go through `setCfg` with the exit-plan keys. Step 2 is deleted. |
| D3 AI risk exact | PASS | `riskToCfg` maps exact values, with no snapping and no forced 8%. e2e chip 4 ("8% stop") shows "Stop 8%". |
| D4 Saved round-trip | PASS | e2e: 15-min, 2× ATR stop, 2R, 10 bps, 2M → reload → Saved: settings restored, and Edit shows them identically. |
| D5 Update, not duplicate; account API | PASS | Saving twice gives 1 document (`POST /live/strategy-lab/saved/:id`, upsert). It loads via `GET saved`; `localStorage` is only the offline cache; old `mc_lab_saved_v1` entries migrate once. |
| D6 Chart B&H over the test window | PASS | The chart uses `bars.slice(r.start)`, labelled "test window only". |
| D7 Compare-all only valid strategies, behind a button | PASS | Only strategies where `checkRules(spec, tf)` is empty are included; skipped ones are counted. Took 152 ms after clicking. |
| D8 `mom`/`pead` blocked | PASS | e2e: Run is disabled and "Needs a multi-stock universe" is shown; there is no Automate button. |
| D9 Library fixes | PASS | Tab renamed "Library". `hi52`/`pead` texts no longer claim a trailing or fixed stop; `power` mentions the EMA(9) exit; `f_vwap` rules gain `Low ≤ VWAP` and `Close > VWAP`; the gap strategies note the next-morning fill. |
| **E. Browser end-to-end** | | |
| U1 Chips → rules; "Not translated" gate | PASS | All 4 chips built rules and ran (`U1-chip*.png`). The gate disables Run until the note is dismissed or the rules are edited (`blockedOf`). None of the 4 chips produced untranslated text. |
| U2 Progress, meta line, summary over all stocks | PASS | Meta line: "Daily · 5Y · as of Oct 29, 2026 · 0 unavailable · 0 insufficient history". The summary has all 8 tiles. Progress reads "Tested n / 50 stocks". |
| U3 Full sortable table | PASS | Columns: Signal, Stock, Price, CAGR, B&H CAGR, Excess, Sharpe, Max DD, Win %, Trades. 50 rows. Sorting by Sharpe gives descending order. 50/50 live prices. |
| U4 Row → report; CAGR equals row; Export JSON | PASS | PLTR: row +24.9% = report +24.9%. Sections present. Exported `parameters` carry the rules, `cfg` (stop 0, tp null, costBps 5) and period `{years:5}` (`U4-evidence.json`). |
| U5 Turtle → Stop None → stale → re-run | PASS | Ran with 8%, switched to None, the stale banner appeared (`U5-stale.png`), re-ran, and the trade log has no "Stop loss". |
| U6 Weekly 3Y, 1-hour 30D, ORB 5-min | PASS | Weekly 3Y: 50 rows. 1-hour 1M: 50 rows. ORB: Daily and Weekly disabled; 5-min 21D: 50 rows. |
| U7 Back / dead controls | PASS | "← Back to Strategy Lab" keeps the run. Step 2, step 4, the scan panel, Ask mode and the chart modal are removed. Every remaining button was exercised. |
| U8 Data blocked (500) | PASS | "Price data unavailable…" is shown, with 0 numbers in the panel (`U8-error.png`). |
| U9 Automation hidden | PASS | No Automate button and no badges. |
| U10 Contradicting copy | PASS | No "Long · Daily · 100% invested", "last 5 years" or "daily bars". The report header comes from the actual settings. |
| **F. Speed** (real FMP data; "cold" = first fetch of that span) | | |
| F1 50-stock daily 5Y | PASS | Cold: 2.9–3.5 s, mostly fetching bars. Warm: 85–190 ms. |
| F2 50-stock 5-min 21D | PASS | Cold: 8.1 s (intraday paging on the server). Warm: 210 ms. 1-hour 30D: 5.4 s cold. |
| F3 Report open | PASS | 50 ms. |
| F4 Long tasks | PASS | The PerformanceObserver recorded none. Backtests run in a module Web Worker (`lab-worker.js`, emitted as its own chunk); variance and compare-all are behind buttons and memoised. |
| F5 Requests per run | PASS | 5 bars requests per daily run (10 symbols each) plus 1 quote request. The same span is cached, so a warm re-run makes 0 bars requests. |
| **G. Scope** | | |
| G1 No SI files | PASS | `git status` shows no `app/iq/si/` path. `module-switcher.tsx` (re-enables the Lab tab) is someone else's uncommitted change. |
| G2 SI tests | N/A | No SI tests exist in either repo. |
| **H. Build health** | | |
| UI | PASS | `tsc` 0; `next build` 0; eslint on `app/iq/sl` and `tests/strategy-lab` has 0 errors and 1 warning (`<img>` in `lab-panels.jsx`; the generated view already had them). |
| Backend | PASS | `tsc` 0; `nest build` 0; jest 741/742. The one failure, `ticker-period-analysis.job.spec`, is date-dependent and also fails without these changes. Lint on every touched file equals its baseline, and the new spec has 0 problems. |

## Verdict

**Functional.** Every check passes in a real browser on real FMP data.

What still needs your action, in order:
1. **Deploy.** The backend needs the new endpoints (`universe`, daily `days`, `saved`); the UI then works without the precomputed `lab_*` collections.
2. **Commit.** `app/iq/module-switcher.tsx` (re-enabling the nav tab) is someone else's uncommitted change, so decide whether to ship it.
3. **Signed-in check.** Run the walkthrough once against production with a signed-in account; the local route doesn't exercise auth.
