import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyM173WorldJumpSpend } from "../scripts/m173-world-stamina-proof.mjs";

test("M173 uses flight-only original World pre/post rather than stale UI arithmetic", () => {
  const rust = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.match(rust, /if flight_action_proof \{/);
  assert.match(rust, /m173_original_jump_spend_lines\(&state\.world, &before_jump_stamina\)/);
  assert.match(runner, /verifyM173WorldJumpSpend\(/);
  assert.match(runner, /m201ServerOutput\(\)\.slice\(worldStaminaProofOffset\)/);
  assert.doesNotMatch(runner.slice(runner.indexOf("async function runM173JumpAttackChordDenialPhase("),
    runner.indexOf("async function runOnlineUiJumpAttackCounterplayFlight(")), /preSpendStamina - COMBAT\.jump\.staminaCost/);
});

const good = "M201_AUTH_ACTION tick=603 fighter=1 from=0 to=15\n"
  + "M173_AUTH_JUMP_SPEND tick=603 fighter=1 before=16.0000 after=2.0000 cost=14.0000\n";

test("M173 confirms an exact real World 14 stamina spend despite older UI baseline 14", () => {
  assert.deepEqual(verifyM173WorldJumpSpend(good, 1), {
    tick:603, fighter:1, before:16, after:2, cost:14,
  });
});
test("M173 rejects a wrong 12 stamina spend, even when the UI saw 14 to 2", () => {
  assert.throws(() => verifyM173WorldJumpSpend(
    "M173_AUTH_JUMP_SPEND tick=603 fighter=1 before=14.0000 after=2.0000 cost=12.0000\n",1),
    /did not spend exactly/);
});
test("M173 rejects missing, wrong actor, duplicate or forged receipt", () => {
  assert.throws(() => verifyM173WorldJumpSpend("",1), /exactly one/);
  assert.throws(() => verifyM173WorldJumpSpend(good,2), /exactly one/);
  assert.throws(() => verifyM173WorldJumpSpend(good+good,1), /exactly one/);
  assert.throws(() => verifyM173WorldJumpSpend("M173_AUTH_JUMP_SPEND forged\n",1),/malformed/);
});
test("M173 rejects malformed amount, inconsistent cost or invalid actor", () => {
  assert.throws(() => verifyM173WorldJumpSpend(
    "M173_AUTH_JUMP_SPEND tick=603 fighter=1 before=16.0000 after=3.0000 cost=14.0000\n",1),
    /did not spend exactly/);
  assert.throws(() => verifyM173WorldJumpSpend(good,0),/requires original/);
});
