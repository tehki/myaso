import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  awaitM41AuthoritativeLight, dispatchM41NativeParryOnLightOnset,
} from "../scripts/m41-authoritative-light-onset.mjs";

const proof = "M201_AUTH_ACTION tick=300 fighter=1 from=9 to=1\n";

test("M41 accepts ONLY the real server light state for the requested actor", async () => {
  let clock = 0;
  let text = "M201_AUTH_ACTION tick=290 fighter=2 from=0 to=1\n";
  const result = await awaitM41AuthoritativeLight({
    readOutput: () => text, afterOffset: 0, fighterId: 1,
    now: () => clock, sleep: async ms => {
      clock += ms;
      if (clock >= 12) text += proof;
    },
  });
  assert.equal(result.serverTick, 300);
  assert.equal(result.observedAfterMs, 12);
});

test("M41 schedules exactly one native Firefox wheel only after trusted server light", async () => {
  let clock = 0;
  let output = "";
  const events = [];
  const actual = await dispatchM41NativeParryOnLightOnset({
    readOutput: () => output, afterOffset: 0, fighterId: 1,
    now: () => clock,
    sleep: async ms => {
      clock += ms;
      events.push("wait:" + ms);
      if (clock >= 8 && !output) output = proof;
    },
    sendAttack: () => { events.push("chrome-real-short-gesture"); },
    sendWheel: () => { events.push("firefox-real-wheel"); },
  });
  assert.equal(actual.serverTick, 300);
  assert.equal(actual.wheelAfterLightMs, 0);
  assert.deepEqual(events, [
    "chrome-real-short-gesture", "wait:4", "wait:4", "firefox-real-wheel",
  ]);
});

test("M41 never sends blind Firefox input on wrong-actor log or timeout", async () => {
  let now = 0;
  let wheels = 0;
  await assert.rejects(() => dispatchM41NativeParryOnLightOnset({
    readOutput: () => "M201_AUTH_ACTION tick=300 fighter=99 from=9 to=1\n",
    afterOffset: 0, fighterId: 1,
    now: () => now, sleep: async ms => { now += ms; },
    sendAttack: () => {}, sendWheel: () => { wheels++; },
  }), /no real authoritative light windup/);
  assert.equal(wheels, 0);
});

test("M41 rejects W3C attack failure and never retries failed Firefox wheel", async () => {
  let now = 0;
  let wheels = 0;
  await assert.rejects(() => dispatchM41NativeParryOnLightOnset({
    readOutput: () => "", afterOffset: 0, fighterId: 1,
    now: () => now, sleep: async ms => { now += ms; },
    sendAttack: () => { throw Error("Chrome W3C rejected"); },
    sendWheel: () => { wheels++; },
  }), /Chrome W3C rejected/);
  assert.equal(wheels, 0);
  await assert.rejects(() => dispatchM41NativeParryOnLightOnset({
    readOutput: () => proof, afterOffset: 0, fighterId: 1,
    sleep: async () => {},
    sendAttack: () => {},
    sendWheel: () => { wheels++; throw Error("Firefox W3C rejected"); },
  }), /Firefox W3C rejected/);
  assert.equal(wheels, 1);
});

test("M41 strict parameters prohibit arbitrary input replay/timing", async () => {
  for (const ms of [-1, 31, 100, NaN, Infinity]) {
    await assert.rejects(() => dispatchM41NativeParryOnLightOnset({
      readOutput: () => proof, afterOffset: 0, fighterId: 1,
      sendAttack: () => {}, sendWheel: () => {}, wheelAfterLightMs: ms,
    }), TypeError);
  }
  await assert.rejects(() => awaitM41AuthoritativeLight({
    readOutput: null, afterOffset: 0, fighterId: 1,
  }), TypeError);
});

test("M41 still runs genuine Chrome W3C, Firefox wheel and strict 34HP/-38 guard rejection", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const segment = source.slice(source.indexOf("async function runOnlineUiParryFlight("),
    source.indexOf("async function runOnlineUiParryPunishFfaFocusFlight("));
  assert.match(segment, /if \(scenario === "uiparrytell"\)/);
  assert.match(segment, /await dispatchM41NativeParryOnLightOnset\(\{/);
  assert.match(segment, /readOutput: m201ServerOutput, afterOffset: m41AuthLogStart/);
  assert.match(segment, /fighterId: attackerReady\.playerNetId/);
  assert.match(segment, /sendAttack: \(\) => performArenaAttackHold\(attacker, attackerElementId, attackOffset, 35\)/);
  assert.match(segment, /sendWheel: \(\) => setArenaBlock\(defender, defenderElementId, true\)/);
  assert.match(segment, /M33 genuine short-click parry resolved unexpectedly/);
  assert.match(segment, /if \(!pristine\)/);
  assert.match(segment, /M41_M33_CAUSAL_TRACE/);
  const raster = source.slice(source.indexOf("async function runOnlineUiParryTellFlight("),
    source.indexOf("async function runOnlineUiBlockFacingTellFlight("));
  assert.match(raster, /if \(observerMax < 24\)/);
  assert.match(raster, /if \(localMax !== 0\)/);
});
