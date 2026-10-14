import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isM224AuthoritativeDodgeResolved as resolved } from "../src/browser/m224-dodge-completion.mjs";

const good = Object.freeze({
  firstDodgeEvadeAt: null,
  attackerKnockdownSeen: true,
  defenderDodgeSeen: true,
  minDefenderHp: 100,
  minDefenderGuard: 100,
});

test("M224 accepts authoritative damage-free roll collision counter without iframe overlap", () => {
  assert.equal(resolved(good), true);
  assert.equal(resolved({...good, attackerKnockdownSeen:false, firstDodgeEvadeAt:40}), true);
});

test("M224 refuses dodge action alone, spurious knockdown and missing overlap", () => {
  assert.equal(resolved({...good, attackerKnockdownSeen:false}), false);
  assert.equal(resolved({...good, defenderDodgeSeen:false}), false);
  assert.equal(resolved({...good, attackerKnockdownSeen:false, firstDodgeEvadeAt:-5}), false);
  assert.equal(resolved({...good, attackerKnockdownSeen:false, firstDodgeEvadeAt:NaN}), false);
});

test("M224 refuses genuine roll counter after any HP or guard leakage", () => {
  for (const hp of [99, 54, 0, undefined]) {
    assert.equal(resolved({...good,minDefenderHp:hp}), false);
  }
  for (const guard of [99, 0, undefined]) {
    assert.equal(resolved({...good,minDefenderGuard:guard}), false);
  }
});

test("M224 real PvP browser flight uses helper, not fake DOM or relaxed end gate", () => {
  const flight=readFileSync(new URL("../web/pvp-flight.mjs",import.meta.url),"utf8");
  const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  assert.ok(flight.includes("isM224AuthoritativeDodgeResolved({"));
  assert.ok(flight.includes("attackerKnockdownSeen: attackerIsOwn ? ownKnockdownSeen : peerKnockdownSeen"));
  assert.ok(flight.includes("defenderDodgeSeen: attackerIsOwn ? peerDodgeSeen : ownDodgeSeen"));
  assert.ok(flight.includes("minDefenderHp: defenderHp"));
  assert.ok(flight.includes("minDefenderGuard: defenderGuard"));
  assert.ok(runner.includes('result.minDefenderHp !== 100 || result.minDefenderGuard !== 100'));
  assert.ok(runner.includes('(!result.dodgeOverlapSeen && !rollCounter)'));
});
