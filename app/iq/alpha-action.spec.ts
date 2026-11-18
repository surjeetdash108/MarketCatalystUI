import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { decideIntradayAction, type IntradayPlan, type Setup } from "./alpha-intraday";

const plan = (o: Partial<IntradayPlan>): IntradayPlan => ({ zoneLo: 51.24, zoneHi: 51.7, stop: 50.9, stopDist: 0.01, t1: null, t2: null, size: "Normal", ...o });
const long = { name: "Failed breakdown", dir: "Long", trigger: 51.19 } as unknown as Setup;
const short = { name: "Opening range breakdown", dir: "Short", trigger: 34.6 } as unknown as Setup;
const base = { coverage: 90, caps: [] as string[], minutes: 120 };

// Error 21 (FCX: price $51.97, entry $51.24–$51.70, "Building", targets "—").
describe("intraday Action follows the glossary", () => {
  it("price past the entry zone is Watch at any score", () => {
    const a = decideIntradayAction({ ...base, setup: long, internal: 60, display: 60, price: 51.97, plan: plan({}) });
    assert.equal(a.action.key, "watch");
    assert.match(a.action.why, /past the entry zone/);
  });
  it("a short well below its trigger is Watch at any score", () => {
    const a = decideIntradayAction({ ...base, setup: short, internal: 60, display: 40, price: 33.9, plan: plan({ zoneLo: 34.25, zoneHi: 34.57, stop: 34.7, stopDist: 0.01 }) });
    assert.equal(a.action.key, "watch");
  });
  it("Building inside the zone carries 1R/2R 'if triggered' from the planned entry", () => {
    const a = decideIntradayAction({ ...base, setup: long, internal: 60, display: 60, price: 51.5, plan: plan({}) });
    assert.equal(a.action.key, "alert");
    assert.ok(Math.abs((a.plan!.t1 as number) - (51.5 + (51.5 - 50.9))) < 1e-9);
    assert.equal(a.plan!.ifTriggered, true);
  });
  it("the cards show the 'Book half at 1R' footer only when there are targets", () => {
    const src = readFileSync(new URL("./screens/alpha-signals.tsx", import.meta.url), "utf8");
    assert.equal(src.match(/\{hasTargets && <small className="fn">Book half at 1R/g)?.length, 2);
  });
  it("Watch has no targets", () => {
    const a = decideIntradayAction({ ...base, setup: long, internal: 40, display: 40, price: 51.5, plan: plan({}) });
    assert.equal(a.action.key, "watch");
    assert.equal(a.plan!.t1, null);
  });
});
