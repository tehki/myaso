import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M159 real W3C short release precedes remote knockdown-reaim and strict M209 server proof", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiMultiKnockdownFfaHitFlight(");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  const roll = flight.indexOf("await scrollArenaWheel(roller, rollerElementId, -120, 0)");
  const tap = flight.indexOf("planM159GenuinePunishTap(`mouse-${punisher.name}`)");
  const secondary = flight.indexOf("const secondState = await readUiEvidence(secondVictim)", tap);
  const reaim = flight.indexOf("await aimArenaForExclusiveAuthoritativeTarget(", secondary);
  const verifier = flight.indexOf("verifyM209DualKnockdownServerPunish(m201ServerOutput()", reaim);
  assert.ok(roll > 0 && tap > roll && secondary > tap && reaim > secondary && verifier > reaim,
    "one authentic W3C tap must commit before second knockdown reaim and server proof");
  assert.equal(flight.match(/planM159GenuinePunishTap\(/g)?.length, 1);
  assert.equal(flight.match(/await setArenaAttackButton\(punisher, (?:true|false)\)/g)?.length ?? 0, 0,
    "two-request pointer presses are forbidden in M159");
  assert.ok(source.includes('import { planM159GenuinePunishTap } from "./m159-genuine-punish-tap.mjs";'));
  assert.ok(flight.includes("punishDowns.length !== 1 || punishUps.length !== 1"));
  assert.ok(flight.includes("punishUp.epochMs - punishDown.epochMs >= 320"));
  assert.ok(flight.includes("provenance.firstKnockdown.epochMs - 40"));
  assert.ok(flight.includes("firstState?.playerHp === 66"));
  assert.ok(flight.includes("secondState?.playerHp === 100"));
  assert.ok(flight.includes("windupReaim"));
  assert.ok(flight.includes("M209_SERVER_DUAL_KNOCKDOWN_PUNISH"));
  assert.ok(flight.includes("currentFirst?.playerHp === 66"));
  assert.ok(flight.includes("currentSecond?.playerHp === 100"));
});
