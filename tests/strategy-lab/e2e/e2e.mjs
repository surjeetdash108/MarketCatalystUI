// Strategy Lab end-to-end walkthrough on real FMP data (local harness :4400 → backend services).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000/sl-harness";
const SHOTS = "/Users/likhithkumarkukkadapu/MarketCatalyst/MarketCatalystUI/tests/strategy-lab/shots";
fs.mkdirSync(SHOTS, { recursive: true });
const out = { results: [], errors: [] };
const rec = (id, pass, detail) => { out.results.push({ id, pass, detail }); console.log((pass ? "PASS " : "FAIL ") + id + " — " + detail); };
const xp = (s) => "xpath=" + s;
const segBtn = (row, label) => xp(`(//span[normalize-space()='${row}']/following-sibling::div//button[normalize-space()='${label}'])[last()]`);
const riskBtn = (row, label) => xp(`(//span[normalize-space()='${row}']/following-sibling::span//button[normalize-space()='${label}'])[last()]`);

const browser = await chromium.launch({ executablePath: process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell" });
const ctx = await browser.newContext({ viewport: { width: 1480, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).slice(0, 200)));
let reqs = [];
page.on("request", (r) => { if (r.url().includes(":4400/")) reqs.push(r.url().replace("http://localhost:4400", "")); });

async function fresh() {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.addInitScript(() => {
    window.__longTasks = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longTasks.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: true }); } catch { /* unsupported */ }
  });
  await page.reload({ waitUntil: "networkidle" });
}
async function waitRun(scope, timeout = 240000) {
  const t0 = Date.now();
  await page.waitForFunction(() => /Tested \d+ \/ \d+ stocks/.test(document.body.innerText) || /stocks tested/.test(document.body.innerText) || /unavailable|Price data unavailable/.test(document.body.innerText), null, { timeout });
  await page.waitForFunction(() => !/Tested \d+ \/ \d+ stocks/.test(document.body.innerText), null, { timeout });
  return Date.now() - t0;
}
const bodyText = () => page.evaluate(() => document.body.innerText);

// ── U1/U2/U3/U4 chips ─────────────────────────────────────────────────────
const CHIPS = [
  "Buy when RSI(2) is below 10 and close is above the 200-day SMA, exit when close crosses above the 5-day SMA",
  "Buy breakouts above the 52-week high on 1.5x average volume, exit below the 20-day SMA",
  "Buy when MACD crosses above its signal line and RSI(14) is under 70, exit when RSI is above 75",
  "Buy when the 20-day EMA crosses above the 50-day EMA, hold 30 days, 8% stop",
];
await fresh();
const timings = {};
for (let i = 0; i < CHIPS.length; i++) {
  if (i) await fresh();
  reqs = [];
  const t0 = Date.now();
  await page.click(`button:has-text("${CHIPS[i].slice(0, 40)}")`);
  await page.waitForFunction(() => /ENTRY/i.test(document.body.innerText) && /Backtest results/i.test(document.body.innerText), null, { timeout: 30000 });
  const txt0 = await bodyText();
  const nt = /Not translated:/.test(txt0);
  let runDisabled = null;
  if (nt) runDisabled = await page.locator('button:has-text("Run backtest")').first().isDisabled();
  if (nt) await page.click('button:has-text("Dismiss")');
  if (nt) await page.click('button:has-text("Run backtest")');
  const ms = await waitRun();
  const txt = await bodyText();
  const meta = (txt.match(/(Daily|Weekly|[0-9]+-min|1-hour|4-hour) · [^\n]*insufficient history/) || [""])[0];
  timings["chip" + (i + 1)] = Date.now() - t0;
  await page.screenshot({ path: `${SHOTS}/U1-chip${i + 1}.png`, fullPage: false });
  const sumOk = ["TESTED", "PROFITABLE", "BEAT B&H", "MEDIAN", "MEDIAN SHARPE", "MEDIAN MAX DD", "WIN RATE", "TRADES"].every((k) => txt.includes(k));
  const rowCount = await page.locator("tbody tr").count();
  const barsReq = reqs.filter((r) => r.startsWith("/live/strategy-lab/bars")).length;
  rec("U1 chip " + (i + 1), /ENTRY/.test(txt) && (!nt || runDisabled === true), `rules shown; not-translated=${nt}${nt ? `, Run disabled before dismiss=${runDisabled}` : ""}; run ${ms} ms`);
  rec("U2 chip " + (i + 1), !!meta && sumOk, `meta="${meta}" summary tiles=${sumOk} rows=${rowCount} bars requests=${barsReq}`);
  if (i === 0) {
    // U3: columns + sorting (live quotes load right after the run)
    await page.waitForFunction(() => [...document.querySelectorAll("tbody tr td:nth-child(3)")].some((td) => /\d/.test(td.innerText)), null, { timeout: 20000 }).catch(() => {});
    const head = await page.locator("thead th").allInnerTexts();
    const before = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();
    await page.click('th:has-text("Sharpe")');
    const sh = (await page.locator("tbody tr td:nth-child(7)").allInnerTexts()).map((s) => parseFloat(s.replace("−", "-")));
    const sortedDesc = sh.every((v, k) => k === 0 || isNaN(v) || isNaN(sh[k - 1]) || sh[k - 1] >= v);
    const prices = await page.locator("tbody tr td:nth-child(3)").allInnerTexts();
    rec("U3", /signal/i.test(head.join("|")) && /price/i.test(head.join("|")) && sortedDesc && rowCount > 40, `cols=${head.map((h) => h.replace(/\s*[↓↑]/, "")).join(",")}; ${rowCount} rows; sharpe sorted desc=${sortedDesc}; live prices=${prices.filter((p) => p !== "—").length}/${prices.length}; first rows before sort=${before.slice(0, 3).join(" ").replace(/\n/g, " ")}`);
    // U4: open first row, compare CAGR, export evidence
    const row = page.locator("tbody tr").first();
    const rowT = (await row.locator("td:nth-child(2)").innerText()).split(/\s+/)[0];
    const rowCagr = (await row.locator("td:nth-child(4)").innerText()).trim();
    const t1 = Date.now();
    await row.click();
    await page.waitForFunction(() => /Growth of \$10,000/i.test(document.body.innerText), null, { timeout: 60000 });
    const repMs = Date.now() - t1;
    timings.reportOpen = repMs;
    const rtxt = await bodyText();
    const repCagr = (rtxt.match(/CAGR\n([^\n]+)/) || [])[1];
    await page.screenshot({ path: `${SHOTS}/U4-report.png`, fullPage: true });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export JSON")')]);
    const ev = JSON.parse(fs.readFileSync(await dl.path(), "utf-8"));
    const sections = ["Growth of $10,000", "Year by year", "Trade log", "Price chart", "Evidence"].every((s) => rtxt.toLowerCase().includes(s.toLowerCase()));
    const rulesOk = JSON.stringify(ev.parameters.rules.entry).includes('"rsi"') && ev.parameters.cfg && ev.parameters.cfg.costBps === 5 && ev.parameters.timeframe === "d";
    rec("U4", repCagr === rowCagr && sections && rulesOk, `${rowT}: row CAGR ${rowCagr} vs report CAGR ${repCagr}; sections=${sections}; evidence params rules+cfg ok=${rulesOk} (stop=${ev.parameters.cfg.stop}, tp=${ev.parameters.cfg.tp}, period=${JSON.stringify(ev.parameters.period)}); opened in ${repMs} ms`);
    fs.writeFileSync(`${SHOTS}/U4-evidence.json`, JSON.stringify(ev.parameters, null, 2));
    // U7: back
    await page.click('button:has-text("Back to Strategy Lab")');
    await page.waitForFunction(() => /Backtest results/i.test(document.body.innerText) && !/Growth of \$10,000/.test(document.body.innerText));
    rec("U7 back", true, "← Back to Strategy Lab returns to the results with the run intact");
    // Re-run warm
    const tw = Date.now();
    await page.click('button:has-text("Re-run backtest")');
    await waitRun();
    timings.chip1Warm = Date.now() - tw;
  }
}
const lt1 = await page.evaluate(() => window.__longTasks || []);

// ── U5 Library → Turtle 20-Day ────────────────────────────────────────────
await fresh();
reqs = [];
await page.click('button:has-text("Turtle 20-Day Breakout")');
await page.click(riskBtn("Stop", "8%"));
await page.click('button:has-text("Run backtest")');
const turtleMs = await waitRun();
timings.turtleDaily5Y = turtleMs;
let t = await bodyText();
const meta5 = (t.match(/Daily · 5Y · as of [^\n]+/) || [""])[0];
await page.click(riskBtn("Stop", "None"));
await page.waitForTimeout(300);
t = await bodyText();
const stale = /Rules changed since this run/.test(t);
await page.screenshot({ path: `${SHOTS}/U5-stale.png` });
await page.click('button:has-text("Re-run"):near(:text("Rules changed since this run"))');
await waitRun();
await page.locator("tbody tr").first().click();
await page.waitForFunction(() => /Trade log/i.test(document.body.innerText), null, { timeout: 60000 });
t = await bodyText();
const tl = t.toLowerCase(), tradeLog = t.slice(tl.indexOf("trade log"), tl.indexOf("variance test"));
await page.screenshot({ path: `${SHOTS}/U5-report.png`, fullPage: true });
rec("U5", stale && !/Stop loss/.test(tradeLog) && /Exit: Close < Lowest close\(10\)|Still open/.test(tradeLog), `run ${turtleMs} ms, meta="${meta5}"; stale banner=${stale}; trade log has "Stop loss"=${/Stop loss/.test(tradeLog)}`);
// Variance + compare (explicit buttons)
const tv = Date.now(); await page.click('button:has-text("Run variance test")'); await page.waitForSelector('text=Click a cell to apply'); const varMs = Date.now() - tv;
const tc = Date.now(); await page.click('button:has-text("Compare all strategies")'); await page.waitForFunction(() => /Turtle 55-Day/i.test(document.body.innerText.split(/Compare strategies/i)[1] || ""), null, { timeout: 60000 }); const cmpMs = Date.now() - tc;
rec("D7/F4 batches", true, `variance ${varMs} ms, compare-all ${cmpMs} ms, both behind buttons`);
await page.click('button:has-text("See today\'s matches")');
await page.waitForTimeout(500);
t = await bodyText();
rec("Step 4 matches", /Backtest results/i.test(t) && !/Growth of \$10,000/i.test(t), "“See today's matches” returns to the Signal-sorted results");

// ── U6 timeframes ─────────────────────────────────────────────────────────
await page.click(segBtn("Candle", "Weekly")); await page.click(segBtn("Period", "3Y"));
await page.click('button:has-text("Run backtest"), button:has-text("Re-run backtest"), button:has-text("Re-run")');
const wkMs = await waitRun(); t = await bodyText();
const wkMeta = (t.match(/Weekly · 3Y · as of [^\n]+/) || [""])[0], wkRows = await page.locator("tbody tr").count();
await page.screenshot({ path: `${SHOTS}/U6-weekly3y.png` });
await page.click(segBtn("Candle", "1-hour")); await page.click(segBtn("Period", "1M"));
await page.click('button:has-text("Run backtest"), button:has-text("Re-run backtest"), button:has-text("Re-run")');
const hMs = await waitRun(); t = await bodyText();
const hMeta = (t.match(/1-hour · 1M · as of [^\n]+/) || [""])[0], hRows = await page.locator("tbody tr").count();
await page.screenshot({ path: `${SHOTS}/U6-1h30d.png` });
timings.weekly3Y = wkMs; timings.hour30D = hMs;
await fresh();
await page.click('button:has-text("30-Min Opening Range Breakout")');
const dDis = await page.locator(segBtn("Candle", "Daily")).isDisabled(), wDis = await page.locator(segBtn("Candle", "Weekly")).isDisabled();
await page.click('button:has-text("Run backtest")');
const orbMs = await waitRun(); t = await bodyText();
const orbMeta = (t.match(/5-min · [^\n]+insufficient history/) || [""])[0], orbRows = await page.locator("tbody tr").count();
timings.orb5m21D = orbMs;
await page.screenshot({ path: `${SHOTS}/U6-orb.png` });
rec("U6", !!wkMeta && wkRows > 0 && !!hMeta && hRows > 0 && dDis && wDis, `weekly 3Y: ${wkRows} rows "${wkMeta}" (${wkMs} ms); 1-hour 30D: ${hRows} rows "${hMeta}" (${hMs} ms); ORB daily/weekly disabled=${dDis}/${wDis}; ORB 5-min 21D: ${orbRows} rows "${orbMeta}" (${orbMs} ms)`);

// ── D8 mom / pead ─────────────────────────────────────────────────────────
await page.click('button:has-text("12-1 Momentum Rotation")');
const momDis = await page.locator('button:has-text("Run backtest")').first().isDisabled();
t = await bodyText();
rec("D8", momDis && /Needs a multi-stock universe/.test(t) && !(await page.locator('button:has-text("Automate")').count()), `mom Run disabled=${momDis}; reason shown=${/Needs a multi-stock universe/.test(t)}`);

// ── Save / reload / edit (D4/D5) ──────────────────────────────────────────
await fresh();
await page.fill('input[placeholder^="e.g. buy when price breaks"]', "buy when the 9 bar ema crosses above the 21 bar ema on the 15 min chart, exit when the 9 bar ema crosses below the 21 bar ema");
await page.click('button:has-text("Build & test")');
await page.waitForFunction(() => /Backtest results/i.test(document.body.innerText), null, { timeout: 30000 });
await page.click(riskBtn("Stop", "2× ATR")); await page.click(riskBtn("Target", "2R")); await page.click(segBtn("Costs", "10 bps")); await page.click(segBtn("Period", "2M"));
await page.click('button:has-text("Save strategy")'); await page.waitForTimeout(800);
await page.click('button:has-text("Update saved strategy")'); await page.waitForTimeout(800);
const savedList = await (await fetch("http://localhost:4400/live/strategy-lab/saved")).json();
await page.reload({ waitUntil: "networkidle" });
await page.click('button:has-text("Saved")');
await page.click('button:has-text("Your strategy")');
t = await bodyText();
const restored = /Stop 2× ATR\(14\) below entry · target 2R/.test(t) && (await page.locator(segBtn("Costs", "10 bps")).getAttribute("style") || "").includes("46, 38, 20") && (await page.locator(segBtn("Candle", "15-min")).getAttribute("style") || "").includes("46, 38, 20");
await page.click('button:has-text("Edit")');
t = await bodyText();
const editOk = /Edit rules & settings/i.test(t) && /Stop 2× ATR\(14\) below entry · target 2R/.test(t);
await page.screenshot({ path: `${SHOTS}/D4-edit.png` });
await page.click('button:has-text("Save & run backtest")');
const svMs = await waitRun();
rec("D4/D5", savedList.strategies.length === 1 && restored && editOk, `saved via account API: ${savedList.strategies.length} doc after saving twice (cfg=${JSON.stringify(savedList.strategies[0] && savedList.strategies[0].cfg)}); after reload settings restored=${restored}; edit shows identical=${editOk}; Save & run ${svMs} ms`);

// ── U8 data blocked ───────────────────────────────────────────────────────
await fetch("http://localhost:4400/__fail?on=1");
await fresh();
await page.click('button:has-text("Golden Cross")');
await page.click('button:has-text("Run backtest")');
await waitRun();
t = await bodyText();
const panel = t.slice(t.toUpperCase().indexOf("BACKTEST RESULTS"));
const nums = (panel.match(/[+−-]\d+\.\d%/g) || []).length;
await page.screenshot({ path: `${SHOTS}/U8-error.png` });
rec("U8", /Price data unavailable/.test(panel) && nums === 0 && (await page.locator("tbody tr").count()) === 0, `error shown=${/Price data unavailable/.test(panel)}; percent numbers in panel=${nums}`);
await fetch("http://localhost:4400/__fail?on=0");

// ── U9 / U10 ──────────────────────────────────────────────────────────────
t = await bodyText();
rec("U9", !/Automate/.test(t) && !/PENDING|AUTOMATED/.test(t), "no Automate button / badges with the flag off");
const bad = ["Long · Daily · 100% invested", "LAST 5 YEARS", "last 5 years", "daily bars"].filter((s) => t.includes(s));
rec("U10", bad.length === 0, bad.length ? "found: " + bad.join(", ") : "no hard-coded period / candle copy");

out.timings = timings;
out.longTasks = lt1;
out.consoleErrors = [...new Set(consoleErrors)];
fs.writeFileSync(`${SHOTS}/e2e-results.json`, JSON.stringify(out, null, 2));
console.log("TIMINGS", JSON.stringify(timings));
console.log("LONGTASKS(ms)", JSON.stringify(lt1));
console.log("CONSOLE ERRORS", JSON.stringify(out.consoleErrors));
await browser.close();
