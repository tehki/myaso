import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M331 genuine wheel is issued before real LMB release after pointerDOWN", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function performArenaFeint(");
  const end = source.indexOf("\nasync function ", start + 25);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  const pointer = flight.slice(flight.indexOf('id: `mouse-${session.name}`'), flight.indexOf('id: `wheel-${session.name}`'));
  const wheel = flight.slice(flight.indexOf('id: `wheel-${session.name}`'), flight.indexOf("\n      ],\n    });", flight.indexOf('id: `wheel-${session.name}`')));
  const types = input => [...input.matchAll(/\\{ type: "(pointerMove|pointerDown|pointerUp|pause|scroll)"/g)].map(x => x[1]);
  assert.deepEqual(types(pointer), ["pointerMove", "pointerDown", "pause", "pause", "pointerUp"]);
  assert.deepEqual(types(wheel), ["pause", "pause", "scroll", "pause", "pause"]);
  assert.match(pointer, /pointerDown", button: 0 },\\s*{ type: "pause", duration: 0 },\\s*{ type: "pause", duration: 20 },\\s*{ type: "pointerUp"/);
  assert.match(wheel, /deltaY: 120[^\\n]*},\\s*{ type: "pause", duration: 20 }/);
  assert.doesNotMatch(pointer.slice(pointer.indexOf('{ type: "pointerUp"')), /{ type: "pause"/);
  assert.ok(!wheel.includes("duration: 85"));
  assert.ok(flight.includes('type: "pointer"') && flight.includes('type: "wheel"'));
  assert.ok(!flight.includes("dispatchEvent("));
});
test("M117/M170/M171 still reject genuine 34HP feint miss and preserve 70ms server-feint limit", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiFeintFlight(");
  const end = source.indexOf("\nasync function ", start + 25);
  const flight = source.slice(start, end);
  assert.ok(flight.includes("await performArenaFeint(attacker, attackerElementId, attackOffset)"));
  assert.ok(flight.includes("await performArenaFeint(attacker, attackerElementId, awayOffset)"));
  assert.ok(flight.includes("attackerResult.opponentHp !== 100"));
  assert.ok(flight.includes("defenderResult.playerHp !== 100"));
  assert.ok(flight.includes('!attemptDefender.feedbackTransitions.includes("damage-taken")'));
  assert.ok(flight.includes("cleanRemoteObservationMiss && !cleanGestureLatchMiss"));
  assert.ok(flight.includes("exhaustedWheelBack.epochMs - exhaustedLightUp.epochMs > 80"));
  assert.ok(flight.includes("COMBAT.feint.staminaCost"));
  const model = readFileSync(new URL("../src/combat/model.mjs", import.meta.url), "utf8");
  assert.ok(model.includes("lightWindowMs: 70"));
  assert.ok(model.includes("staminaCost: 12"));
});
