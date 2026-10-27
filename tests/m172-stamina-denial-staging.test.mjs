import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { COMBAT } from "../src/combat/model.mjs";
import { COMBAT_ACTION, staminaDenialPresentation } from "../src/browser/combat-readability.mjs";
import { isTickNewer32 } from "../src/browser/reconciliation.mjs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const phase = source.slice(source.indexOf("async function runM172AirborneDenialPhase"),
  source.indexOf("async function runM173JumpAttackChordDenialPhase"));

test("M172 drains the historical 23 -> 9 setup to leave confirmation regeneration headroom", async () => {
  const start = phase.indexOf("  const setupStaminaExclusiveMax");
  const end = phase.indexOf("  const staminaBeforeJump", start);
  let observations = 0;
  const holds = [];
  const ready = await vm.runInNewContext("(async()=>{" + phase.slice(start, end) + "return ready;})()", {
    COMBAT, COMBAT_ACTION, attacker: {}, attackerElementId: "arena", awayKey: "a", awayOffset: -200,
    milestone: "M172", sleep: async () => {},
    readUiEvidence: async () => ({acceptance: {authoritativeStamina: observations++ === 0 ? 23 : 16,
      ownActionTransitions: [{action: COMBAT_ACTION.idle}]}}),
    performArenaRunHold: async (...args) => holds.push(args),
    waitForAttacker: () => { throw Error("unexpected regeneration branch"); },
  });
  assert.equal(ready.acceptance.authoritativeStamina, 16);
  assert.equal(holds.length, 1, "23 stamina is no longer accepted as ready");
});

test("M172 requires current ordinary Jump, rather than an earlier airborne observation", () => {
  const start = phase.indexOf("    (state) => {", phase.indexOf("const airborne ="));
  const end = phase.indexOf("    700,", start);
  const predicate = vm.runInNewContext("(" + phase.slice(start, end).trim().replace(/,$/, "") + ")", {
    COMBAT, COMBAT_ACTION, jumpActionOffset: 0,
  });
  const state = actions => ({acceptance: {authoritativeStamina: 5,
    ownActionTransitions: actions.map(action => ({action}))}});
  assert.equal(predicate(state([COMBAT_ACTION.jump])), true);
  assert.equal(predicate(state([COMBAT_ACTION.jump, COMBAT_ACTION.idle])), false);
  assert.match(phase, /await performArenaM221GuardBreakClick\(attacker, 5\)/);
  const chord = source.slice(source.indexOf("async function runM173JumpAttackChordDenialPhase"));
  assert.match(chord, /await performArenaPreAimedJumpAttackChord\(attacker, 90\)/);
});

const client = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const confirmation = client.slice(client.indexOf("function staminaActionAccepted("),
  client.indexOf("function updateMouse("));
function confirm({stamina, action = COMBAT_ACTION.jump, processed = 356, submitted = 356}) {
  const stages = [], messages = [];
  const context = vm.createContext({
    COMBAT_ACTION, staminaDenialPresentation, isTickNewer32,
    pendingStaminaDenial: {action: "jump-attack", baselineStamina: 9,
      submittedClientTick: submitted, presentation: staminaDenialPresentation("jump-attack", 9)},
    networkClient: {processedClientTick: processed}, authoritativeStamina: stamina,
    own: {action, stamina}, performance: {now: () => 100},
    combatMessage: "", combatMessageUntil: 0,
    recordStaminaDenialStage: (stage, details) => stages.push({stage, ...details}),
    setStatus: text => messages.push(text), showCombatFeedback: () => {},
  });
  vm.runInContext(confirmation + "confirmStaminaDenial(own);", context);
  return {stages, messages};
}

test("delayed confirmation at 12 stamina cannot fabricate a denial from the stale 9 baseline", () => {
  const result = confirm({stamina: 12, action: COMBAT_ACTION.idle, processed: 366});
  assert.deepEqual(result.stages.map(s => s.stage), ["confirmed-not-stamina"]);
  assert.equal(result.messages.length, 0);
});

test("only a processed low-stamina snapshot shows denial; accepted action never does", () => {
  assert.equal(confirm({stamina: 5, processed: 355}).stages.length, 0);
  assert.deepEqual(confirm({stamina: 5}).stages.map(s => s.stage), ["confirmed-rejected", "shown"]);
  const accepted = confirm({stamina: 5, action: COMBAT_ACTION.jumpAttackWindup});
  assert.deepEqual(accepted.stages.map(s => s.stage), ["confirmed-accepted"]);
  assert.equal(accepted.messages.length, 0);
});
