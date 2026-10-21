import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { observeM54NativeThreat } from "../scripts/m54-native-threat-observation.mjs";

test("M54 victim observation starts before a delayed attacker acknowledgement", async () => {
  let acknowledge, sampled = false, read = false, clock = 0;
  const states = [{ browser: "actual-victim" }];
  const flight = observeM54NativeThreat({
    attack: () => new Promise(resolve => { acknowledge = resolve; }),
    sampleVictim: async () => { sampled = true; clock = 20; },
    readAll: () => { read = true; return states; }, now: () => clock,
  });
  await new Promise(setImmediate);
  assert.equal(sampled, true, "native command ACK cannot delay the only observation window");
  assert.equal(read, false, "the final proof still waits for native acknowledgement");
  clock = 500; acknowledge();
  const result = await flight;
  assert.equal(result.states, states);
  assert.equal(result.timing.samplingStartedEpochMs, 0);
  assert.equal(result.timing.attackAckEpochMs, 500);
});

test("M54 a failed native action cannot become successful observed evidence", async () => {
  let read = false;
  await assert.rejects(() => observeM54NativeThreat({
    attack: () => { throw new Error("native click failed"); },
    sampleVictim: async () => {}, readAll: () => { read = true; },
  }), /native click failed/);
  assert.equal(read, false);
});

test("M54 retains real rendered phases, victim-only sampling and all original vitals gates", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const flight = source.slice(source.indexOf("async function runOnlineUiThreatAwarenessFlight("),
    source.indexOf("async function runOnlineUiMultiThreatFlight("));
  assert.match(flight, /sampleVictim: \(\{ nativeStatus \}\) => sampleUiEvidenceDuringNative\(center, nativeStatus, 420\)/);
  assert.match(flight, /attack: \(\) => performArenaAttack\(left, leftArena, 200\)/);
  assert.match(flight, /if \(!sawWindup \|\| !sawStrike\)/);
  assert.match(flight, /centerState\.playerHp !== 66/);
  assert.match(flight, /Number\.isSafeInteger\(centerState\.acceptance\?\.serverTick\)/);
  assert.match(flight, /centerState\.acceptance\.serverTick < proof\.hit\.tick/);
  assert.match(flight, /downs\.length !== 1 \|\| ups\.length !== 1/);
  assert.doesNotMatch(flight, /attempt < 3|retry \$\{/);
  assert.match(flight, /leftState\.playerHp !== 100 \|\| rightState\.playerHp !== 100/);
  assert.match(flight, /if \(leftFalsePositive \|\| rightFalsePositive\)/);
  assert.doesNotMatch(flight, /dispatchEvent\(|new WheelEvent|forceParry|fakeGuard/);
});
