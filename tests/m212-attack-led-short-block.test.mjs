import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchM212AttackLedShortBlock } from "../scripts/m212-attack-led-short-block.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test("M212 true wheel fires 25ms before one Chrome down and one up", async () => {
  const wheelLead = deferred();
  const clickHold = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    sendWheel: () => { events.push("wheel"); },
    sendAttackDown: () => { events.push("down"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: ms => {
      events.push("pause:" + ms);
      return ms === 25 ? wheelLead.promise : clickHold.promise;
    },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel", "pause:25"]);
  time = 25;
  wheelLead.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel", "pause:25", "down", "pause:10"]);
  time = 35;
  clickHold.resolve();
  const result = await flight;
  assert.deepEqual(events, ["wheel", "pause:25", "down", "pause:10", "up"]);
  assert.equal(result.attackDownDispatchMs, 25);
  assert.equal(result.attackUpDispatchMs, 35);
  assert.equal(result.wheelHeadStartMs, 25);
});

test("M212 late wheel ACK does not create duplicate Chrome or Firefox inputs", async () => {
  const wheel = deferred();
  const events = [];
  const flight = dispatchM212AttackLedShortBlock({
    sendWheel: () => { events.push("wheel"); return wheel.promise; },
    sendAttackDown: () => { events.push("down"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: () => Promise.resolve(),
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel", "down", "up"]);
  wheel.resolve();
  await flight;
  assert.deepEqual(events, ["wheel", "down", "up"]);
});

test("M212 early Firefox failure prevents Chrome down/up", async () => {
  let down = 0, up = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => { throw Error("Firefox rejected"); },
    sendAttackDown: () => { down++; },
    sendAttackUp: () => { up++; },
    sleep: () => Promise.resolve(),
  }), /Firefox rejected/);
  assert.equal(down, 0);
  assert.equal(up, 0);
});

test("M212 late Firefox wheel failure still releases Chrome once then fails", async () => {
  const wheel = deferred();
  const events = [];
  const flight = dispatchM212AttackLedShortBlock({
    sendWheel: () => { events.push("wheel"); return wheel.promise; },
    sendAttackDown: () => { events.push("down"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: () => Promise.resolve(),
  });
  await new Promise(setImmediate);
  wheel.reject(Error("Late Firefox wheel rejected"));
  await assert.rejects(flight, /Late Firefox wheel rejected/);
  assert.deepEqual(events, ["wheel", "down", "up"]);
});

test("M212 Chrome down failure is fatal and never sends a mouse up", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => {},
    sendAttackDown: () => { throw Error("Chrome down failed"); },
    sendAttackUp: () => { ups++; },
    sleep: () => Promise.resolve(),
  }), /Chrome down failed/);
  assert.equal(ups, 0);
});

test("M212 Chrome release failure fails closed with one mouse up", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => {},
    sendAttackDown: () => {},
    sendAttackUp: () => { ups++; throw Error("Chrome up failed"); },
    sleep: () => Promise.resolve(),
  }), /Chrome up failed/);
  assert.equal(ups, 1);
});

test("M212 rejects missing W3C callbacks and unbounded input timing", async () => {
  for (const overrides of [{ sendWheel: null }, { sendAttackDown: null },
    { sendAttackUp: null }, { sleep: null }, { wheelHeadStartMs: -1 },
    { wheelHeadStartMs: Infinity }, { wheelHeadStartMs: 126 },
    { clickHoldMs: -1 }, { clickHoldMs: 101 }]) {
    await assert.rejects(() => dispatchM212AttackLedShortBlock({
      sendWheel: () => {}, sendAttackDown: () => {}, sendAttackUp: () => {},
      sleep: () => Promise.resolve(), ...overrides,
    }), TypeError);
  }
});

test("M212 runner preserves true wheel/down/up and original no-parry/no-HP guards", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const segment = source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(segment.includes("dispatchM212AttackLedShortBlock({"));
  assert.ok(segment.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(segment.includes("sendAttackDown: () => setArenaAttackButton(attacker, true)"));
  assert.ok(segment.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  assert.ok(segment.includes('feedbackTransitions.includes("parried")'));
  assert.ok(segment.includes("defenderState?.playerHp !== 100"));
  assert.ok(segment.includes("defenderResult.playerGuard !== 0"));
  assert.ok(segment.includes("defenderResult.playerHp !== 100"));
});
