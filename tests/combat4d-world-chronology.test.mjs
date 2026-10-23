import test from "node:test";
import assert from "node:assert/strict";
import { classifyGuardBreakPunishWorld } from "../scripts/combat4d-world-chronology.mjs";

// Reproduced, never a passing fixture: exact authoritative ticks from
// Combat 4D PR #940 CI https://github.com/tehki/myaso/actions/runs/40037749411.
const firstRed = [
  "M201_AUTH_ACTION tick=1497 fighter=2 from=6 to=7",
  "M201_AUTH_BREAK tick=1497 attacker=1 target=2",
  "M201_AUTH_ACTION tick=1548 fighter=2 from=7 to=0",
  "M201_AUTH_ACTION tick=1552 fighter=1 from=1 to=2",
  "M201_AUTH_HIT tick=1552 attacker=1 target=2 damage=34 hp=66",
].join("\n");
const secondRed = [
  "M201_AUTH_ACTION tick=367 fighter=2 from=6 to=7",
  "M201_AUTH_BREAK tick=367 attacker=1 target=2",
  "M201_AUTH_ACTION tick=418 fighter=2 from=7 to=0",
  "M201_AUTH_ACTION tick=419 fighter=1 from=1 to=2",
  "M201_AUTH_HIT tick=419 attacker=1 target=2 damage=34 hp=66",
].join("\n");

test("M111 first real CI attempt is AFTER_STUN by 4 server ticks", () => {
  const result = classifyGuardBreakPunishWorld(firstRed);
  assert.equal(result.status, "AFTER_STUN");
  assert.equal(result.exitToHitTicks, 4);
  assert.equal(result.breakTick, 1497);
});
test("M111 second real CI attempt is AFTER_STUN by 1 server tick", () => {
  const result = classifyGuardBreakPunishWorld(secondRed);
  assert.equal(result.status, "AFTER_STUN");
  assert.equal(result.exitToHitTicks, 1);
});
test("copied M320 JSON diagnostics cannot counterfeit another World event", () => {
  const result = classifyGuardBreakPunishWorld(firstRed + '\nM320_GUARD_BREAK_AUTH_TRACE {"tickLines":["M201_AUTH_BREAK tick=1497 attacker=1 target=2"]}');
  assert.equal(result.status, "AFTER_STUN");
});
test("negative controls fail closed for incomplete, forged, duplicated and unordered evidence", () => {
  for (const bad of [
    "",
    firstRed.replace(/M201_AUTH_HIT[^\n]*/, ""),
    firstRed.replace("attacker=1 target=2 damage=34", "attacker=3 target=2 damage=34"),
    firstRed.replace("damage=34 hp=66", "damage=46 hp=54"),
    firstRed + "\nM201_AUTH_BREAK tick=1553 attacker=1 target=2",
    firstRed.replace("M201_AUTH_ACTION tick=1548 fighter=2 from=7 to=0\n", ""),
    firstRed.split("\n").reverse().join("\n"),
  ]) {
    assert.equal(classifyGuardBreakPunishWorld(bad).status, "INDETERMINATE");
  }
});
test("synthetic parser control recognizes a genuine in-stun tick sequence, not release evidence", () => {
  const control = [
    "M201_AUTH_ACTION tick=10 fighter=2 from=6 to=7",
    "M201_AUTH_BREAK tick=10 attacker=1 target=2",
    "M201_AUTH_HIT tick=11 attacker=1 target=2 damage=34 hp=66",
    "M201_AUTH_ACTION tick=12 fighter=2 from=7 to=0",
  ].join("\n");
  assert.equal(classifyGuardBreakPunishWorld(control).status, "WITHIN_STUN");
});
