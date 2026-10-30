import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = runner.indexOf("async function runOnlineUiJumpAttackBufferFlight(entries)");
const end = runner.indexOf("\nasync function ", start + 30);
const flight = runner.slice(start, end);

test("M137 late-recovery native chord is targeted INSIDE unchanged World buffer", () => {
  assert.ok(start > 0 && end > start, "real acceptance function must exist");
  assert.match(flight, /COMBAT\.attack\.recoveryMs - COMBAT\.inputBuffer\.jumpAttackWindowMs \+ 20/);
  const targetedMs = COMBAT.attack.recoveryMs - COMBAT.inputBuffer.jumpAttackWindowMs + 20;
  const remainingMs = COMBAT.attack.recoveryMs - targetedMs;
  assert.equal(COMBAT.inputBuffer.jumpAttackWindowMs, 90);
  assert.ok(targetedMs >= 0);
  assert.ok(remainingMs > 0 && remainingMs < COMBAT.inputBuffer.jumpAttackWindowMs);
  assert.equal(remainingMs, 70);
  assert.match(flight, /await performArenaJumpAttackChord\(attacker, attackerElementId, attackOffset, 90\)/);
});

test("M137 still rejects extra Lights, plain jumps, missing World phases and fabricated contact", () => {
  assert.match(flight, /entry\.action === COMBAT_ACTION\.jumpAttackWindup/);
  assert.match(flight, /entry\.action === COMBAT_ACTION\.jumpAttackActive/);
  assert.match(flight, /entry\.action === COMBAT_ACTION\.jumpAttackRecovery/);
  assert.match(flight, /lightRecoveryIndex >= 0/);
  assert.match(flight, /ownSequence\.complete/);
  assert.match(flight, /focusSequence\.complete/);
  assert.match(flight, /plainJumpAfterRecovery/);
  assert.match(flight, /M137 did not resolve exactly one 34 HP light plus one 42 HP jump attack/);
  assert.match(flight, /M137 recovery jump-attack flight accidentally resolved as parry/);
  assert.match(flight, /jumpDowns\.length !== 1 \|\| jumpUps\.length !== 1/);
  assert.match(flight, /Math\.abs\(jumpDown\.epochMs - attackDown\.epochMs\) > 60/);
});
