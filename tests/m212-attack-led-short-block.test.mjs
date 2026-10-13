import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchM212AttackLedShortBlock } from "../scripts/m212-attack-led-short-block.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test("M212 slow Chrome down ACK still precedes one real wheel then release", async () => {
  const down = deferred();
  const lead = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    sendAttackDown: () => { events.push("down"); return down.promise; },
    sendWheel: () => { events.push("wheel"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: ms => { events.push("lead:" + ms); return lead.promise; },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["down"]);
  time = 203;
  down.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(events, ["down", "lead:55", "wheel"]);
  time = 258;
  lead.resolve();
  const result = await flight;
  assert.deepEqual(events, ["down", "lead:55", "wheel", "up"]);
  assert.equal(result.attackDownAckMs, 203);
  assert.equal(result.wheelHeadStartMs, 55);
  assert.equal(result.attackUpDispatchMs, 258);
});

test("M212 slow real Firefox wheel ACK does not create an extra wheel or attack", async () => {
  const wheel = deferred();
  const events = [];
  const flight = dispatchM212AttackLedShortBlock({
    sendAttackDown: () => { events.push("down"); },
    sendWheel: () => { events.push("wheel"); return wheel.promise; },
    sendAttackUp: () => { events.push("up"); },
    sleep: () => Promise.resolve(),
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["down", "wheel", "up"]);
  wheel.resolve();
  await flight;
  assert.deepEqual(events, ["down", "wheel", "up"]);
});

test("M212 failed Chrome down never dispatches Firefox wheel or release", async () => {
  const events = [];
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendAttackDown: () => { events.push("down"); throw Error("Chrome down rejected"); },
    sendWheel: () => { events.push("wheel"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: () => Promise.resolve(),
  }), /Chrome down rejected/);
  assert.deepEqual(events, ["down"]);
});

test("M212 failed Firefox wheel still releases held Chrome button once, then fails", async () => {
  const events = [];
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendAttackDown: () => { events.push("down"); },
    sendWheel: () => { events.push("wheel"); throw Error("Firefox wheel failed"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: () => Promise.resolve(),
  }), /Firefox wheel failed/);
  assert.deepEqual(events, ["down", "wheel", "up"]);
});

test("M212 failed Chrome release fails closed and never retries", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendAttackDown: () => {},
    sendWheel: () => {},
    sendAttackUp: () => { ups++; throw Error("Chrome up failed"); },
    sleep: () => Promise.resolve(),
  }), /Chrome up failed/);
  assert.equal(ups, 1);
});

test("M212 refuses missing callbacks or invalid head-start plans", async () => {
  for (const overrides of [{ sendWheel: null }, { sendAttackDown: null },
    { sendAttackUp: null }, { sleep: null }, { wheelHeadStartMs: -1 },
    { wheelHeadStartMs: Infinity }, { wheelHeadStartMs: 126 }]) {
    await assert.rejects(() => dispatchM212AttackLedShortBlock({
      sendAttackDown: () => {}, sendWheel: () => {}, sendAttackUp: () => {},
      sleep: () => Promise.resolve(), ...overrides,
    }), TypeError);
  }
});

test("M212 runner preserves genuine down/wheel/up and strict no-parry, no-HP guard", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const segment = source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(segment.includes("dispatchM212AttackLedShortBlock({"));
  assert.ok(segment.includes("sendAttackDown: () => setArenaAttackButton(attacker, true)"));
  assert.ok(segment.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(segment.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  assert.ok(segment.includes('feedbackTransitions.includes("parried")'));
  assert.ok(segment.includes("defenderState?.playerHp !== 100"));
  assert.ok(segment.includes("defenderResult.playerGuard !== 0"));
  assert.ok(segment.includes("defenderResult.playerHp !== 100"));
});
