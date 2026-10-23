import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";
import { staminaDenialPresentation } from "../src/browser/combat-readability.mjs";

// Strictly preserves original M172/M173 real-native assertions and gameplay.
// Narrowing the *physical scenario setup* to a deep low-stamina interval
// avoids falsely treating a later regened authoritative snapshot as a denial.
const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const section = (from, to) => {
  const start = runner.indexOf(from);
  const end = runner.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, "genuine runner contains strict " + from);
  return runner.slice(start, end);
};
const m172 = section("async function runM172AirborneDenialPhase(", "async function runM173JumpAttackChordDenialPhase(");
const m173 = runner.slice(runner.indexOf("async function runM173JumpAttackChordDenialPhase("));

test("Combat4A M172: original jump-only stamina is 16..19, leaving deep sub-12 airborne room", () => {
  assert.equal(COMBAT.jump.staminaCost, 14);
  assert.equal(COMBAT.jumpAttack.staminaCost, 12);
  for (const n of [16, 17, 18, 19]) {
    assert.ok(n >= COMBAT.jump.staminaCost);
    assert.ok(n - COMBAT.jump.staminaCost < COMBAT.jumpAttack.staminaCost - 4);
  }
  assert.match(m172, /stamina >= COMBAT\.jump\.staminaCost \+ 2\s*&& stamina < COMBAT\.jump\.staminaCost \+ 6/);
  assert.match(m172, /candidate\.acceptance\.authoritativeStamina\s*< COMBAT\.jump\.staminaCost \+ 6/);
  assert.match(m172, /ordinary jump with sub-conversion stamina/);
});

test("Combat4A M173: same strict 16..19 setup preserves below-26 chord fallback", () => {
  assert.match(m173, /stamina >= COMBAT\.jump\.staminaCost \+ 2\s*&& stamina < COMBAT\.jump\.staminaCost \+ 6/);
  assert.match(m173, /candidate\.acceptance\.authoritativeStamina\s*< COMBAT\.jump\.staminaCost \+ 6/);
  assert.match(m173, /performArenaJumpAttackChord\(attacker, attackerElementId, awayOffset, 90\)/);
  assert.match(m173, /confirmed low-stamina same-tick jump-attack chord denial/);
});

test("Original M167/M172 authority and 42HP gates are not waived", () => {
  assert.equal(staminaDenialPresentation("jump-attack", 12), null,
    "cannot fake low-stamina once authority confirms stamina 12");
  assert.equal(staminaDenialPresentation("jump-attack", 9)?.feedback, "stamina-denied");
  assert.match(m172, /confirmed\.authoritativeStamina >= COMBAT\.jumpAttack\.staminaCost/);
  assert.match(m172, /queuedIndex < 0 \|\| submittedIndex <= queuedIndex/);
  assert.match(m172, /processedClientTick/);
  assert.match(m172, /did not tie rejection to acknowledged sub-cost authority/);
  assert.match(m173, /did not preserve denial lifecycle ordering/);
  assert.match(runner, /M136 jump attack did not resolve as one clean 42 HP hit/);
});
