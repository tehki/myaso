import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION, combatActionHint, combatLifePresentation, combatOverlayPresentation, createCombatReadabilityTracker } from "../src/browser/combat-readability.mjs";

function fighter(netId, hp = 100, guard = 100, action = COMBAT_ACTION.idle, x = 0, y = 0, facing = 0) {
  return { netId, hp, guard, action, x, y, facing };
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
  assert.equal(event.feedback, "guard-pressure");
  assert.match(event.text, /guard -38/);
});

test("authoritative opponent block emits block-confirm feedback", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1), fighter(2, 100, 62, COMBAT_ACTION.block)), 1);
  assert.equal(event.kind, "block");
  assert.equal(event.feedback, "block-confirm");
  assert.match(event.text, /Opponent blocked/);
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

test("authoritative threatening strike avoided by own dodge emits dodge-success", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  const event = tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 88), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
  assert.equal(event.text, "Dodge! Strike avoided.");
});

test("authoritative threatening strike evaded by opponent emits dodge-evaded", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0), fighter(2, 100, 100, COMBAT_ACTION.dodge, 80)), 1);
  const event = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0), fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 88)), 1);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-evaded");
});

test("out-of-range attack recovery is not falsely credited to dodge", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 120), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 128), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2), null);
});

test("zero-guard stun is prioritized as a guard break", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 38, COMBAT_ACTION.block), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 0, COMBAT_ACTION.stunned), fighter(2)), 1);
  assert.equal(event.kind, "guardBreak");
  assert.equal(event.feedback, "guard-broken");
});

test("authoritative opponent guard break emits punish confirmation", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2, 100, 38, COMBAT_ACTION.block)), 1);
  const event = tracker.observe(state(fighter(1), fighter(2, 100, 0, COMBAT_ACTION.stunned)), 1);
  assert.equal(event.kind, "guardBreak");
  assert.equal(event.feedback, "guard-break-confirm");
  assert.match(event.text, /Opponent guard broken/);
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

test("authoritative stun owns a temporary punish overlay", () => {
  assert.deepEqual(combatOverlayPresentation(fighter(1, 100, 100, COMBAT_ACTION.stunned)), {
    visible: true,
    state: "stunned",
    title: "STUNNED",
    detail: "Punish window open.",
  });
  assert.deepEqual(combatOverlayPresentation(fighter(1)), { visible: false, state: "", title: "", detail: "" });
});

test("authoritative death owns the persistent life presentation", () => {
  assert.deepEqual(combatLifePresentation(fighter(1, 0, 100, COMBAT_ACTION.dead)), {
    visible: true,
    title: "DEFEATED",
    detail: "Respawning…",
  });
  assert.deepEqual(combatLifePresentation(fighter(1)), { visible: false, title: "", detail: "" });
});
