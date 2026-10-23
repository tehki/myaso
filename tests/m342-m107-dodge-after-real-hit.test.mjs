import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION as A, createCombatReadabilityTracker } from "../src/browser/combat-readability.mjs";

const defender = (hp, action, guard = 100) =>
  ({ netId: 2, hp, guard, action, x: 80, y: 0, facing: Math.PI });
const attacker = (action) =>
  ({ netId: 1, hp: 100, guard: 100, action, x: 0, y: 0, facing: 0 });
const view = (def, atk) => new Map([[def.netId, def], [atk.netId, atk]]);
const see = (tracker, hp, defAction, atkAction, ownId = 2, guard = 100) =>
  tracker.observe(view(defender(hp, defAction, guard), attacker(atkAction)), ownId);

test("M342 M107 real 46HP heavy hit before late roll must NEVER become dodge-success", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 100, A.idle, A.heavyAttackWindup);
  const hit = see(tracker, 54, A.idle, A.heavyAttackActive);
  assert.equal(hit?.feedback, "damage-taken");
  assert.equal(hit?.text, "Hit taken - 46 HP.");
  assert.equal(see(tracker, 54, A.dodge, A.heavyAttackActive), null);
  const recovery = see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery);
  assert.notEqual(recovery?.feedback, "dodge-success",
    "late accepted roll cannot retroactively evade damage already applied by World");
});

test("M342 actual opponent 46HP hit before late roll must NEVER become dodge-evaded", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 100, A.idle, A.heavyAttackWindup, 1);
  assert.equal(see(tracker, 54, A.idle, A.heavyAttackActive, 1)?.feedback, "hit-confirm");
  see(tracker, 54, A.dodge, A.heavyAttackActive, 1);
  const recovery = see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery, 1);
  assert.notEqual(recovery?.feedback, "dodge-evaded");
});

test("M342 same attack guard damage before late roll is NOT a clean dodge", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 100, A.block, A.attackWindup);
  assert.equal(see(tracker, 100, A.block, A.attackActive, 2, 62)?.feedback, "guard-pressure");
  see(tracker, 100, A.dodge, A.attackActive, 2, 62);
  const recovery = see(tracker, 100, A.dodgeRecovery, A.attackRecovery, 2, 62);
  assert.notEqual(recovery?.feedback, "dodge-success");
});

test("M342 previously injured defender at 54HP CAN evade a NEW heavy attack", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 54, A.idle, A.idle);
  see(tracker, 54, A.dodge, A.heavyAttackWindup);
  see(tracker, 54, A.dodgeRecovery, A.heavyAttackActive);
  const event = see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery);
  assert.equal(event?.feedback, "dodge-success");
  assert.equal(event?.text, "Dodge! Strike avoided.");
});

test("M342 a genuinely new commitment clears only previous attack's consumed-hit state", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 100, A.idle, A.heavyAttackWindup);
  see(tracker, 54, A.idle, A.heavyAttackActive);
  see(tracker, 54, A.dodge, A.heavyAttackActive);
  assert.notEqual(see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery)?.feedback, "dodge-success");
  see(tracker, 54, A.idle, A.idle);
  see(tracker, 54, A.dodge, A.heavyAttackWindup);
  see(tracker, 54, A.dodgeRecovery, A.heavyAttackActive);
  assert.equal(see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery)?.feedback, "dodge-success");
});

test("M342 if HP falls in the SAME authoritative snapshot as late roll, report damage not evasion", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 100, A.idle, A.heavyAttackWindup);
  const impact = see(tracker, 54, A.dodge, A.heavyAttackActive);
  assert.equal(impact?.feedback, "damage-taken");
  assert.notEqual(see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery)?.feedback, "dodge-success");
});

test("M342 resetting for new authenticated life cannot retain prior consumed attack", () => {
  const tracker = createCombatReadabilityTracker();
  see(tracker, 100, A.idle, A.heavyAttackWindup);
  see(tracker, 54, A.idle, A.heavyAttackActive);
  tracker.reset();
  see(tracker, 54, A.dodge, A.heavyAttackWindup);
  see(tracker, 54, A.dodgeRecovery, A.heavyAttackActive);
  assert.equal(see(tracker, 54, A.dodgeRecovery, A.heavyAttackRecovery)?.feedback, "dodge-success");
});