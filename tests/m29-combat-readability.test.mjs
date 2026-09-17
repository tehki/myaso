import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION, blockSpatialPresentation, combatActionHint, combatLifePresentation, combatOverlayPresentation, createCombatReadabilityTracker, guardBreakSpatialPresentation, opponentRecoveryPresentation, parrySpatialPresentation } from "../src/browser/combat-readability.mjs";

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

test("dodge evidence survives dodge recovery until authoritative attack recovery", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 88), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2), null);
  const event = tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 92), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
});

test("buffered dodge evidence is invalidated by authoritative damage", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  tracker.observe(state(fighter(2, 66, 100, COMBAT_ACTION.dodgeRecovery, 88), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  assert.equal(tracker.observe(state(fighter(2, 66, 100, COMBAT_ACTION.dodgeRecovery, 92), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2), null);
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

test("zero-guard stun exposes a spatial guard-break tell", () => {
  assert.deepEqual(guardBreakSpatialPresentation(fighter(2, 100, 0, COMBAT_ACTION.stunned)), { visible: true, state: "guard-broken" });
  assert.deepEqual(guardBreakSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.stunned)), { visible: false, state: "" });
  assert.deepEqual(guardBreakSpatialPresentation(fighter(2, 100, 0, COMBAT_ACTION.block)), { visible: false, state: "" });
});

test("authoritative block exposes its replicated facing as a spatial tell", () => {
  assert.deepEqual(blockSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.block, 0, 0, 1.25)), { visible: true, state: "blocking", facing: 1.25 });
  assert.deepEqual(blockSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.idle, 0, 0, 1.25)), { visible: false, state: "", facing: 0 });
  assert.deepEqual(blockSpatialPresentation({ ...fighter(2, 100, 100, COMBAT_ACTION.block), facing: Number.NaN }), { visible: false, state: "", facing: 0 });
});

test("positive-guard stun exposes a mutually exclusive spatial parry tell", () => {
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.stunned)), { visible: true, state: "parried" });
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 1, COMBAT_ACTION.stunned)), { visible: true, state: "parried" });
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 0, COMBAT_ACTION.stunned)), { visible: false, state: "" });
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.block)), { visible: false, state: "" });
  assert.equal(guardBreakSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.stunned)).visible, false);
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

test("authoritative opponent recovery exposes a bounded punish cue", () => {
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.attackRecovery)), {
    visible: true, state: "attack-recovery", label: "PUNISH", detail: "Attack recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery)), {
    visible: true, state: "dodge-recovery", label: "PUNISH", detail: "Dodge recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2)), { visible: false, state: "", label: "", detail: "" });
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
