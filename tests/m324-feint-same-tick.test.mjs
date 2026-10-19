import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = runner.indexOf("async function performArenaFeint(");
const end = runner.indexOf("\nasync function ", start + 20);
const gesture = runner.slice(start, end);

function actions(device) {
  const id = device === "pointer" ? 'id: `mouse-${session.name}`' : 'id: `wheel-${session.name}`';
  const at = gesture.indexOf(id);
  assert.ok(at > 0, `Missing ${device} W3C source`);
  const from = gesture.indexOf("actions: [", at);
  const to = gesture.indexOf("\n          ]", from);
  assert.ok(from > at && to > from);
  const source = gesture.slice(from, to);
  return { source, types: [...source.matchAll(/type: "([^"]+)"/g)].map(m => m[1]) };
}

test("M324 native LMB release and wheel-back share exactly one W3C tick", () => {
  const p = actions("pointer");
  const w = actions("wheel");
  assert.deepEqual(p.types, ["pointerMove", "pointerDown", "pause", "pointerUp"]);
  assert.deepEqual(w.types, ["pause", "pause", "pause", "scroll"]);
  assert.equal(p.types.indexOf("pointerUp"), w.types.indexOf("scroll"));
  assert.match(p.source, /pause", duration: 20 },\s*{ type: "pointerUp"/);
  assert.match(w.source, /pause", duration: 20 },\s*{ type: "scroll"/);
  assert.doesNotMatch(gesture, /dispatchEvent\(|window\.__MYASO/);
});

test("M324 leaves authoritative feint window, stamina, victim HP gate and no-contact guard unchanged", () => {
  const at = runner.indexOf("async function runOnlineUiFeintFlight(");
  const end = runner.indexOf("\nasync function ", at + 20);
  const flight = runner.slice(at, end);
  for (const required of [
    "await performArenaFeint(attacker, attackerElementId, attackOffset)",
    "attackerResult.opponentHp !== 100",
    "defenderResult.playerHp !== 100",
    '!attemptDefender.feedbackTransitions.includes("damage-taken")',
    "M117 feint attempt",
  ]) assert.ok(flight.includes(required), required);
  const model = readFileSync(new URL("../src/combat/model.mjs", import.meta.url), "utf8");
  assert.match(model, /lightWindowMs: 70/);
  assert.match(model, /staminaCost: 12/);
});
