import test from "node:test";
import assert from "node:assert/strict";
import { dispatchM107NativeDodge } from "../scripts/m107-native-dodge-plan.mjs";

test("M107 delayed heavy/S acknowledgements cannot postpone its sole native wheel", async () => {
  let resolveHeavy, resolvePerpendicular, clock = 0;
  const calls = [];
  const flight = dispatchM107NativeDodge({
    sendHeavyDown: () => { calls.push("E-down"); return new Promise(resolve => { resolveHeavy = resolve; }); },
    sendPerpendicularDown: () => { calls.push("S-down"); return new Promise(resolve => { resolvePerpendicular = resolve; }); },
    awaitWindup: () => { calls.push("server-windup"); return { serverTick: 266 }; },
    sleep: async ms => { clock += ms; }, now: () => clock,
    sendWheel: () => { calls.push("native-wheel:" + clock); },
    sendPerpendicularUp: () => { calls.push("S-up"); },
    sendHeavyUp: () => { calls.push("E-up"); },
  });
  await new Promise(setImmediate);
  assert.ok(calls.includes("native-wheel:170"));
  let finished = false; flight.then(() => { finished = true; });
  assert.equal(finished, false, "both native acknowledgements remain mandatory");
  clock = 475; resolveHeavy(); resolvePerpendicular();
  const result = await flight;
  assert.equal(result.windup.serverTick, 266);
  assert.equal(result.wheelIssuedAfterObservedMs, 170);
  assert.equal(calls.filter(call => call.startsWith("native-wheel:")).length, 1);
  assert.deepEqual(calls.slice(-2), ["S-up", "E-up"]);
});

test("M107 failed native input never passes and both controls are released", async () => {
  for (const failing of ["heavy", "perpendicular", "wheel", "proof"]) {
    const releases = [];
    const fail = name => { if (failing === name) throw new Error(name + " failed"); };
    await assert.rejects(() => dispatchM107NativeDodge({
      sendHeavyDown: () => fail("heavy"), sendPerpendicularDown: () => fail("perpendicular"),
      awaitWindup: () => { fail("proof"); return { serverTick: 266 }; },
      sleep: async () => {}, now: () => 0, sendWheel: () => fail("wheel"),
      sendPerpendicularUp: () => { releases.push("S-up"); },
      sendHeavyUp: () => { releases.push("E-up"); },
    }), new RegExp(failing + " failed"));
    assert.deepEqual(releases, ["S-up", "E-up"]);
  }
});
