import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
// Immutable real original native Rust World events: exact #968 focused
// https://github.com/tehki/myaso/actions/runs/40047686818
// and protected https://github.com/tehki/myaso/actions/runs/40047686878.
// Both exits occurred BEFORE 34HP on the same 60Hz tick.
test("M111 real same-tick stun exit BEFORE original 34HP HIT is AFTER_STUN", () => {
  for (const [breakTick, exitTick] of [[1623, 1674], [293, 344]]) {
    const actual = [
      `M201_AUTH_ACTION tick=${breakTick} fighter=2 from=6 to=7`,
      `M201_AUTH_BREAK tick=${breakTick} attacker=1 target=2`,
      `M201_AUTH_ACTION tick=${exitTick} fighter=2 from=7 to=0`,
      `M201_AUTH_ACTION tick=${exitTick} fighter=1 from=1 to=2`,
      `M201_AUTH_HIT tick=${exitTick} attacker=1 target=2 damage=34 hp=66`,
    ].join("\n");
    const result = classifyGuardBreakPunishWorld(actual);
    assert.equal(result.status, "AFTER_STUN");
    assert.equal(result.exitToHitTicks, 0);
    assert.equal(result.breakTick, breakTick);
  }
});
test("M111 same-tick original HIT BEFORE exit qualifies only with server event order", () => {
  const within = [
    "M201_AUTH_ACTION tick=10 fighter=2 from=6 to=7",
    "M201_AUTH_BREAK tick=10 attacker=1 target=2",
    "M201_AUTH_ACTION tick=61 fighter=1 from=1 to=2",
    "M201_AUTH_HIT tick=61 attacker=1 target=2 damage=34 hp=66",
    "M201_AUTH_ACTION tick=61 fighter=2 from=7 to=0",
  ].join("\n");
  const result = classifyGuardBreakPunishWorld(within);
  assert.equal(result.status, "WITHIN_STUN");
  assert.equal(result.exitToHitTicks, 0);
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


test("M111 genuine native scenario must fail closed on original 60Hz World post-stun hits", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiHeavyGuardBreakPunishFlight(");
  const end = source.indexOf("\nasync function ", start + 40);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(source, /import \{ classifyGuardBreakPunishWorld \} from "\.\/combat4d-world-chronology\.mjs";/);
  assert.match(body, /classifyGuardBreakPunishWorld\(m201ServerOutput\(\)\)/);
  assert.match(body, /originalWorld\.status !== "WITHIN_STUN"/);
  // The formerly direct Key E attack is now a genuine held-and-released LMB.
  // Require physical source0 proof, a hold beyond READY320 and the original
  // heavy active/recovery+60ms floor before the one genuine W3C punish click.
  assert.match(source, /const M110_LMB_HEAVY_HOLD_MS = 450;/);
  assert.match(source, /const heavyPulse = performM110NativeHeldLmb\(attacker, attackerElementId, attackOffset\)/);
  assert.match(body, /const firstClickTargetMs = M110_LMB_HEAVY_HOLD_MS\s*\+ COMBAT\.heavyAttack\.activeMs\s*\+ COMBAT\.heavyAttack\.recoveryMs\s*\+ 60/);
  assert.doesNotMatch(body, /trustedSecondKeyEDownEpoch/);
  assert.match(body, /performArenaAttackBurst\(attacker, 1, initialPauseMs, 0\)/);
  assert.match(body, /hitDuringStun/);
});
