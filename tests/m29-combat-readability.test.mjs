import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION, combatActionHint, combatLifePresentation, createCombatReadabilityTracker } from "../src/browser/combat-readability.mjs";

function fighter(netId, hp = 100, guard = 100, action = COMBAT_ACTION.idle) {
  return { netId, hp, guard, action };
}

function state(own, peer) {
  return new Map([[own.netId, own], [peer.netId, peer]]);
}

test("authoritative HP loss becomes a readable hit message", () => {
  const tracker = createCombatReadabilityTracker();
  assert.equal(tracker.observe(state(fighter(1), fighter(2)), 1), null);
  const event = tracker.observe(state(fighter(1, 66), fighter(2)), 1);
  assert.equal(event.kind, "hit");
  assert.equal(event.feedback, "damage-taken");
  assert.match(event.text, /Hit taken/);
});

test("authoritative opponent HP loss emits hit-confirm feedback", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1), fighter(2, 66)), 1);
  assert.equal(event.kind, "hit");
  assert.equal(event.feedback, "hit-confirm");
  assert.match(event.text, /Opponent hit/);
});

test("guard-only loss is explained as a block instead of damage", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 62, COMBAT_ACTION.block), fighter(2)), 1);
  assert.equal(event.kind, "block");
  assert.match(event.text, /guard -38/);
});

test("cost-free block plus attacker stun is described as a parry", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.block), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.block), fighter(2, 100, 100, COMBAT_ACTION.stunned)), 1);
  assert.equal(event.kind, "parry");
  assert.equal(event.feedback, "parry-success");
  assert.match(event.text, /Parry!/);
});

test("being parried emits a distinct authoritative feedback cue", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2, 100, 100, COMBAT_ACTION.block)), 1);
  const event = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.stunned), fighter(2, 100, 100, COMBAT_ACTION.block)), 1);
  assert.equal(event.kind, "parry");
  assert.equal(event.feedback, "parried");
  assert.match(event.text, /Parried/);
});

test("zero-guard stun is prioritized as a guard break", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 38, COMBAT_ACTION.block), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 0, COMBAT_ACTION.stunned), fighter(2)), 1);
  assert.equal(event.kind, "guardBreak");
});

test("death and full-vitals idle transition are readable", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 32), fighter(2)), 1);
  const death = tracker.observe(state(fighter(1, 0, 100, COMBAT_ACTION.dead), fighter(2)), 1);
  assert.equal(death.kind, "death");
  const respawn = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.idle), fighter(2)), 1);
  assert.equal(respawn.kind, "respawn");
});

test("authoritative action hints explain commitment windows", () => {
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.attackWindup)), /windup/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.attackRecovery)), /Recovery/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.block)), /Blocking/);
  assert.equal(combatActionHint(fighter(1)), null);
});

test("authoritative death owns the persistent life presentation", () => {
  assert.deepEqual(combatLifePresentation(fighter(1, 0, 100, COMBAT_ACTION.dead)), {
    visible: true,
    title: "DEFEATED",
    detail: "Respawning…",
  });
  assert.deepEqual(combatLifePresentation(fighter(1)), { visible: false, title: "", detail: "" });
});
