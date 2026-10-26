import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";

test("M147 owner-approved jump recovery is 450ms in JS and original 60Hz Rust World", () => {
  const rust = readFileSync(new URL("../server/src/simulation.rs", import.meta.url), "utf8");
  assert.equal(COMBAT.jumpAttack.recoveryMs, 450);
  assert.match(rust, /const JUMP_ATTACK_RECOVERY_MS: f32 = 450\.0;/);
  assert.match(rust, /fighter\.set_action\(Action::JumpAttackRecovery, JUMP_ATTACK_RECOVERY_MS\)/);
});

test("M147 change preserves original attack and parry balance", () => {
  assert.equal(COMBAT.attack.windupMs, 135);
  assert.equal(COMBAT.attack.damage, 34);
  assert.equal(COMBAT.heavyAttack.windupMs, 320);
  assert.equal(COMBAT.heavyAttack.damage, 46);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.jumpAttack.windupMs, 105);
  assert.equal(COMBAT.jumpAttack.activeMs, 105);
  assert.equal(COMBAT.jumpAttack.damage, 42);
});
