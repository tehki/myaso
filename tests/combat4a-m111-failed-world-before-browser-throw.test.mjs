import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyGuardBreakPunishWorld } from "../scripts/combat4d-world-chronology.mjs";

// Immutable genuine original Rust 60Hz World lines from M111 native
// https://github.com/tehki/myaso/actions/runs/40092029788
// job 120866504448, first genuine Chrome/Firefox trial, preserved RED.
// The 34HP hit happened AFTER Stunned7→Idle0, not merely after HUD closure.
const realAfterStun = [
  "M201_AUTH_ACTION tick=1010 fighter=1 from=9 to=10",
  "M201_AUTH_ACTION tick=1010 fighter=2 from=6 to=7",
  "M201_AUTH_BREAK tick=1010 attacker=1 target=2",
  "M201_AUTH_ACTION tick=1017 fighter=1 from=10 to=11",
  "M201_AUTH_ACTION tick=1043 fighter=1 from=11 to=0",
  "M201_AUTH_ACTION tick=1061 fighter=2 from=7 to=0",
  "M201_AUTH_ACTION tick=1067 fighter=1 from=0 to=9",
  "M201_AUTH_ACTION tick=1069 fighter=1 from=9 to=1",
  "M201_AUTH_ACTION tick=1077 fighter=1 from=1 to=2",
  "M201_AUTH_HIT tick=1077 attacker=1 target=2 damage=34 hp=66",
].join("\n");

const realWithinStun = [
  "M201_AUTH_ACTION tick=353 fighter=2 from=6 to=7",
  "M201_AUTH_BREAK tick=353 attacker=1 target=2",
  "M201_AUTH_ACTION tick=397 fighter=1 from=1 to=2",
  "M201_AUTH_HIT tick=397 attacker=1 target=2 damage=34 hp=66",
  "M201_AUTH_ACTION tick=404 fighter=2 from=7 to=0",
].join("\n");

test("M111 actual first native 34HP was 16 server ticks AFTER STUNNED exit; never qualify HUD", () => {
  const proof = classifyGuardBreakPunishWorld(realAfterStun);
  assert.equal(proof.status, "AFTER_STUN");
  assert.equal(proof.breakTick, 1010);
  assert.equal(proof.stunnedExitTick, 1061);
  assert.equal(proof.hitTick, 1077);
  assert.equal(proof.exitToHitTicks, 16);
});
test("M111 actual second native 34HP was 7 ticks WITHIN STUNNED, independently", () => {
  const proof = classifyGuardBreakPunishWorld(realWithinStun);
  assert.equal(proof.status, "WITHIN_STUN");
  assert.equal(proof.breakTick, 353);
  assert.equal(proof.hitTick, 397);
  assert.equal(proof.stunnedExitTick, 404);
  assert.equal(proof.exitToHitTicks, -7);
});
test("M111 rejected-browser path exposes immutable World tick verdict BEFORE unchanged throw", () => {
  const src = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = src.indexOf("async function runOnlineUiHeavyGuardBreakPunishFlight(");
  const end = src.indexOf("\nasync function ", start + 50);
  assert.ok(start >= 0 && end > start);
  const body = src.slice(start, end);
  const predicate = body.indexOf("if (!hitDuringStun) {");
  const classification = body.indexOf("const failedOriginalWorld = classifyGuardBreakPunishWorld(m201ServerOutput())", predicate);
  const audit = body.indexOf("M111_FAILED_BROWSER_WORLD_CHRONOLOGY", classification);
  const originalThrow = body.indexOf("throw new Error(`M111 timestamped browser evidence placed", audit);
  assert.ok(predicate > 0 && classification > predicate && audit > classification && originalThrow > audit,
    "a rejected browser trial must emit read-only World chronology but retain original strict rejection");
  const failedBlock = body.slice(predicate, originalThrow);
  assert.doesNotMatch(failedBlock, /(?:networkClient\.sendInput|dispatchEvent|performArenaAttackBurst)\s*\(/);
  assert.match(body, /if \(originalWorld\.status !== "WITHIN_STUN"\)/,
    "successful browser gate still needs original fail-closed World timing check");
  assert.match(body, /const firstClickTargetMs = COMBAT\.heavyAttack\.windupMs\s*\+ COMBAT\.heavyAttack\.activeMs \+ COMBAT\.heavyAttack\.recoveryMs \+ 60/);
});
