import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";

test("M143 samples through complete 450ms recovery without relaxing focus assertions", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf('const milestone = "M143 jump recovery FFA focus"');
  const end = runner.indexOf('const milestone = "M144 simultaneous recovery', start);
  const m143 = runner.slice(start, end >= 0 ? end : start + 19000);
  assert.ok(start >= 0, "M143 original real-browser scenario must exist");
  assert.match(m143, /const jumpLifecycleObserveMs = COMBAT\.jumpAttack\.windupMs\s*\+ COMBAT\.jumpAttack\.activeMs \+ COMBAT\.jumpAttack\.recoveryMs \+ 300/);
  assert.match(m143, /nearestReturnIndex <= punishIndex/);
  assert.match(m143, /recoveryCleared < 0/);
  assert.doesNotMatch(m143, /sampleUiEvidenceWhileActive\(entries, 720, 8\)/);
});

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
