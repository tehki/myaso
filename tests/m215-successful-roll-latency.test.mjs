import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeM215SuccessfulRollLatency } from "../scripts/m215-successful-roll-latency.mjs";

const entry = (phase, input, action, cue, nextWheelT = Infinity) => ({
  browser: "chrome2",
  phase,
  sameBrowserClock: true,
  wheel: { deltaY: -120, epochMs: input, t: input / 10 },
  observedAction: { epochMs: action, serverTick: 357 },
  eventTransitions: [
    { t: input / 10 - 15, text: "Dodging - use the movement to reset spacing." },
    { t: cue, text: "Dodging - use the movement to reset spacing." },
  ],
  nextWheelT,
});

test("M215 summarizes successful genuine wheel to observed authority and browser cue", () => {
  const result = summarizeM215SuccessfulRollLatency([
    entry("opening", 100, 125, 18),
    entry("suppression", 200, 230, 27),
    entry("verification", 300, 340, 38),
  ]);
  assert.equal(result.sampleCount, 3);
  assert.deepEqual(result.wheelToObservedAction, {
    samples: 3, missing: 0, minMs: 25, p50Ms: 30, p95Ms: 40, maxMs: 40,
  });
  assert.deepEqual(result.wheelToVisibleCue, {
    samples: 3, missing: 0, minMs: 7, p50Ms: 8, p95Ms: 8, maxMs: 8,
  });
  assert.deepEqual(result.observations.map(x => x.serverTick), [357, 357, 357]);
});

test("M215 rejects earlier cue, future cue belonging to next wheel, and inverted action", () => {
  const result = summarizeM215SuccessfulRollLatency([
    entry("suppression", 200, 190, 27, 25),
    entry("invalid", 300, 320, 38, 34),
    { ...entry("unsynced", 400, 430, 50), sameBrowserClock: false },
    { ...entry("nonwheel", 500, 530, 58), wheel: {deltaY: 120, epochMs: 500, t: 50}},
  ]);
  assert.equal(result.wheelToObservedAction.samples, 1);
  assert.equal(result.wheelToVisibleCue.samples, 0);
  assert.equal(result.wheelToVisibleCue.missing, 4);
  assert.equal(result.wheelToVisibleCue.p95Ms, null);
});

test("M215 missing/empty samples yield explicit unknowns, never fictitious zero", () => {
  assert.equal(summarizeM215SuccessfulRollLatency([]).wheelToVisibleCue.p50Ms, null);
  const x = summarizeM215SuccessfulRollLatency([null]);
  assert.equal(x.wheelToObservedAction.samples, 0);
  assert.equal(x.wheelToObservedAction.missing, 1);
});

test("M215 logs only AFTER all unchanged strict M162 authority, recovery and HP gates", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const part = source.slice(source.indexOf("async function runOnlineUiBoundedRollKnockdownFlight("),
    source.indexOf("async function runOnlineUiBoundedKickKnockdownFlight("));
  assert.ok(part.includes("summarizeM215SuccessfulRollLatency(["));
  const log = part.indexOf('console.log("M215_SUCCESSFUL_ROLL_LATENCY "');
  assert.ok(log > part.indexOf("post-recovery roll did not create a fresh clean knockdown"));
  assert.ok(log > part.indexOf("suppression roll appears to have refreshed or re-caught"));
  assert.ok(log > part.indexOf("control-only sequence changed health/guard"));
  assert.ok(part.includes("observedAction: openerDodge"));
  assert.ok(part.includes("observedAction: suppressedDodge"));
  assert.ok(part.includes("observedAction: verificationDodge"));
  assert.ok(part.includes("nextWheelT: verifyWheels[0].t"));
  assert.ok(part.includes("openerWheels.length !== 1 || suppressorWheels.length !== 1"));
  assert.ok(part.includes("verifyWheels.length !== 1"));
});
