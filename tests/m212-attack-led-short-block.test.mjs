import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchM212AttackLedShortBlock } from "../scripts/m212-attack-led-short-block.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test("M212 waits for a slow real Chrome pointer release before one Firefox block wheel", async () => {
  const attack = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    sendAttack: () => { events.push("chrome-click-start"); return attack.promise; },
    sendWheel: () => { events.push("firefox-wheel"); time = 240; },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["chrome-click-start"]);
  time = 203;
  attack.resolve();
  const result = await flight;
  assert.deepEqual(events, ["chrome-click-start", "firefox-wheel"]);
  assert.equal(result.attackAckMs, 203);
  assert.equal(result.wheelDispatchMs, 203);
  assert.equal(result.wheelAckMs, 240);
});

test("M212 does not send Firefox wheel after rejected Chrome W3C input", async () => {
  let wheels = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendAttack: () => Promise.reject(new Error("Chrome W3C rejected")),
    sendWheel: () => { wheels += 1; },
  }), /Chrome W3C rejected/);
  assert.equal(wheels, 0);
});

test("M212 treats genuine Firefox wheel failure as fatal, never replaying Chrome", async () => {
  let attacks = 0, wheels = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendAttack: () => { attacks += 1; },
    sendWheel: () => { wheels += 1; throw new Error("Firefox wheel failed"); },
  }), /Firefox wheel failed/);
  assert.equal(attacks, 1);
  assert.equal(wheels, 1);
});

test("M212 rejects missing or synthetic W3C dispatch callbacks", async () => {
  for (const option of [{}, { sendAttack: () => {} }, { sendWheel: () => {} },
    { sendAttack: "fake", sendWheel: () => {} }]) {
    await assert.rejects(() => dispatchM212AttackLedShortBlock(option), TypeError);
  }
});

test("M212 M194 runner preserves genuine inputs and original fail-closed guard proof", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const segment = source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(segment.includes("dispatchM212AttackLedShortBlock({"));
  assert.ok(segment.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(segment.includes("attacker, m198Plan.clicksPerWheel, 0"));
  assert.ok(segment.includes('feedbackTransitions.includes("parried")'));
  assert.ok(segment.includes("defenderState?.playerHp !== 100"));
  assert.ok(segment.includes("defenderResult.playerGuard !== 0"));
  assert.ok(segment.includes("defenderResult.playerHp !== 100"));
});
