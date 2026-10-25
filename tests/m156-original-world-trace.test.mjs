import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M156 enables only existing loopback original World action/HIT evidence, preserving native conversion gates",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=source.indexOf("MYASO_FLIGHT_ACTION_PROOF:");
  const end=source.indexOf("MYASO_FLIGHT_M121_INPUT_PROOF:",start);
  const proof=source.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(proof,/scenario === "uirollknockdownffahit"/);
  assert.match(proof,/\? "1" : "0"/);
  assert.match(source,/MYASO_FLIGHT_M121_INPUT_PROOF: scenario === "uidirectionallight" \|\| scenario === "uirollknockdownffahit" \? "1" : "0"/);
  assert.match(source.slice(source.indexOf("async function startGameServer("),start),/MYASO_BIND: "127\.0\.0\.1:0"/);
  const begin=source.indexOf("async function runOnlineUiRollKnockdownFfaHitFlight(");
  const finish=source.indexOf("\nasync function ",begin+30);
  const flight=source.slice(begin,finish);
  assert.match(flight,/performArenaM221GuardBreakClick\(punisher, 5\)/);
  assert.match(flight,/punishDowns\.length !== 1 \|\| punishUps\.length !== 1/);
  assert.match(flight,/punishUp\.epochMs - punishDown\.epochMs >= 320/);
  assert.match(flight,/punishActive\.epochMs >= knockdownEndEpochMs \|\| !attackPrecedesRecovery/);
  assert.match(flight,/defenderState\.events\.includes\("Hit taken - 34 HP\."\)/);
  assert.doesNotMatch(flight,/gestureLab|EXPERIMENTAL|dispatchEvent\(/);
});
