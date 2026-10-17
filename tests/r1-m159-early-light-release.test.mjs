import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M159 real light releases before slow remote knockdown-reaim, preserves M209 actual server overlap", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiMultiKnockdownFfaHitFlight(");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  const down = flight.indexOf("await setArenaAttackButton(punisher, true)");
  const hold = flight.indexOf("await sleep(40)", down);
  const up = flight.indexOf("await setArenaAttackButton(punisher, false)", hold);
  const secondary = flight.indexOf("const secondState = await readUiEvidence(secondVictim)", up);
  const reaim = flight.indexOf("await aimArenaForExclusiveAuthoritativeTarget(", secondary);
  const verifier = flight.indexOf("verifyM209DualKnockdownServerPunish(m201ServerOutput()", reaim);
  assert.ok(down > 0 && hold > down && up > hold && secondary > up && reaim > secondary && verifier > reaim);
  assert.equal(flight.match(/await setArenaAttackButton\(punisher, true\)/g)?.length, 1);
  assert.equal(flight.match(/await setArenaAttackButton\(punisher, false\)/g)?.length, 1);
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
