import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMBAT_ACTION, ownCombatReadinessPresentation } from "../src/browser/combat-readability.mjs";

function own(action, hp = 100) {
  return { netId: 7, hp, guard: 100, stamina: 100, action };
}

const phases = [
  { state: "windup", label: "WINDUP", actions: [
    "attackWindup", "attackLeftWindup", "attackRightWindup",
    "heavyAttackWindup", "runningAttackWindup", "jumpAttackWindup", "kickWindup",
  ] },
  { state: "active", label: "STRIKING", actions: [
    "attackActive", "attackLeftActive", "attackRightActive",
    "heavyAttackActive", "runningAttackActive", "jumpAttackActive", "kickActive",
  ] },
  { state: "recovery", label: "RECOVERING", actions: [
    "attackRecovery", "attackLeftRecovery", "attackRightRecovery",
    "heavyAttackRecovery", "runningAttackRecovery", "jumpAttackRecovery",
    "kickRecovery", "feintRecovery",
  ] },
  { state: "ready", label: "READY", actions: ["idle"] },
  { state: "block", label: "BLOCKING", actions: ["block"] },
  { state: "evade", label: "ROLLING", actions: ["dodge"] },
  { state: "recovery", label: "ROLL RECOVERY", actions: ["dodgeRecovery"] },
  { state: "airborne", label: "AIRBORNE", actions: ["jump"] },
  { state: "locked", label: "STUNNED", actions: ["stunned"] },
  { state: "locked", label: "KNOCKED DOWN", actions: ["knockdown"] },
];

test("M196 readiness maps every living authoritative combat phase without inventing a parry", () => {
  const names = [];
  for (const phase of phases) {
    for (const name of phase.actions) {
      names.push(name);
      const result = ownCombatReadinessPresentation(own(COMBAT_ACTION[name]));
      assert.equal(result.visible, true, name);
      assert.equal(result.state, phase.state, name);
      assert.equal(result.label, phase.label, name);
      assert.ok(result.detail.length > 0, name);
      assert.notEqual(result.label, "PARRY SUCCESS", name);
    }
  }
  assert.deepEqual(new Set(names), new Set(
    Object.keys(COMBAT_ACTION).filter(name => name !== "dead"),
  ));
});

test("M196 readiness is suppressed before snapshot authority, on death, and on invalid actions", () => {
  const hidden = { visible: false, state: "", label: "", detail: "" };
  assert.deepEqual(ownCombatReadinessPresentation(null), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(undefined), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(own(COMBAT_ACTION.dead)), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(own(COMBAT_ACTION.idle, 0)), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(own(COMBAT_ACTION.block, -1)), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(own(COMBAT_ACTION.stunned, NaN)), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(own(1001)), hidden);
  assert.deepEqual(ownCombatReadinessPresentation(own(1.4)), hidden);
  assert.deepEqual(ownCombatReadinessPresentation({ action: COMBAT_ACTION.idle }), hidden);
});

test("M196 readiness is read-only, independent of local input, and does not mutate snapshot state", () => {
  const fighter = Object.freeze(own(COMBAT_ACTION.block));
  const before = JSON.stringify(fighter);
  const block = ownCombatReadinessPresentation(fighter);
  assert.equal(block.label, "BLOCKING");
  assert.match(block.detail, /facing matters/);
  assert.equal(JSON.stringify(fighter), before);
  assert.equal(ownCombatReadinessPresentation(Object.freeze(own(COMBAT_ACTION.idle))).label, "READY");
  assert.equal(ownCombatReadinessPresentation(Object.freeze(own(COMBAT_ACTION.stunned))).label, "STUNNED");
});

test("M196 HUD starts hidden and renders solely from snapshot-owned player state", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");
  assert.match(html, /id="own-readiness"[^>]*hidden/);
  assert.match(html, /id="own-readiness-label"/);
  assert.match(html, /id="own-readiness-detail"/);
  assert.match(css, /\.readiness-cue\[hidden\]/);
  assert.match(js, /const own = ownId \? networkClient\.state\.get\(ownId\) : null;/);
  assert.match(js, /updateOwnReadiness\(own\)/);
  assert.match(js, /ownCombatReadinessPresentation\(own\)/);
  assert.doesNotMatch(js, /updateOwnReadiness\(currentInput\)/);
});
