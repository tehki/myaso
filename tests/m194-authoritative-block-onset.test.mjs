import test from "node:test";
import assert from "node:assert/strict";
import { awaitM194ServerBlock } from "../scripts/m194-authoritative-block-onset.mjs";
import { dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";

test("M194 requires fresh exact-fighter idle-to-Block admission, never a cue", async () => {
  let clock = 0;
  const old = "M201_AUTH_ACTION tick=100 fighter=2 from=0 to=6\n";
  let output = old;
  const proof = await awaitM194ServerBlock({
    readOutput: () => output, afterOffset: old.length, fighterId: 2,
    now: () => clock, sleep: async ms => {
      clock += ms;
      output += clock < 8 ? "M201_AUTH_ACTION tick=185 fighter=3 from=0 to=6\n"
        : "M201_AUTH_ACTION tick=186 fighter=2 from=0 to=6\n";
    },
  });
  assert.deepEqual(proof, { fighterId: 2, serverTick: 186, observedAfterMs: 8 });
});

test("M194 missing or malformed server admission cannot certify a real block", async () => {
  let clock = 0;
  await assert.rejects(() => awaitM194ServerBlock({
    readOutput: () => "Blocking - keep the threat in front of you.\n", afterOffset: 0, fighterId: 2,
    now: () => clock, sleep: async ms => { clock += ms; }, timeoutMs: 12,
  }), /did not observe genuine server Block/);
  await assert.rejects(() => awaitM194ServerBlock({
    readOutput: () => "M201_AUTH_ACTION tick=bad\n", afterOffset: 0, fighterId: 2,
    sleep: async () => {},
  }), /malformed/);
});

test("M194 late trusted receipt cannot delay native release after server Block", async () => {
  let resolveReceipt, resolveWheel, clock = 0, ups = 0;
  const receipt = new Promise(resolve => { resolveReceipt = resolve; });
  const wheelAck = new Promise(resolve => { resolveWheel = resolve; });
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 0,
    awaitServerBlock: () => ({ fighterId: 2, serverTick: 185 }),
    now: () => clock,
    sleep: ms => ms === 190 ? new Promise(() => {}) : Promise.resolve().then(() => { clock += ms; }),
    sendAttackDown: () => { clock = 4; }, sendWheel: () => wheelAck,
    awaitTrustedWheel: () => receipt, sendAttackUp: () => { ups++; },
  });
  await new Promise(setImmediate);
  assert.equal(ups, 1, "late receipt must not extend the unchanged short-block window");
  let complete = false; flight.then(() => { complete = true; });
  assert.equal(complete, false);
  clock = 190; resolveReceipt({ trusted: true, deltaY: 120 });
  await new Promise(setImmediate);
  assert.equal(complete, false, "genuine W3C wheel ACK remains mandatory");
  resolveWheel();
  const evidence = await flight;
  assert.equal(evidence.attackUpDispatchMs, 4);
  assert.equal(evidence.serverBlockProof.serverTick, 185);
  assert.equal(ups, 1);
});

test("M194 server cue cannot waive a rejected trusted native-wheel report", async () => {
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 0,
    awaitServerBlock: () => ({ fighterId: 2, serverTick: 185 }),
    now: () => 0, sleep: ms => ms === 190 ? new Promise(() => {}) : Promise.resolve(),
    sendAttackDown: () => {}, sendWheel: () => {}, sendAttackUp: () => {},
    awaitTrustedWheel: () => ({ trusted: false, deltaY: 120 }),
  }), /trusted real Firefox wheel/);
});
