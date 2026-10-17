import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M240 arms Firefox passive windup watcher before one complete real Chrome short LMB", () => {
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url),"utf8");
  const begin=source.indexOf("async function runOnlineUiAttackIntentFlight(");
  const end=source.indexOf("\nasync function ",begin+28);
  assert.ok(begin>=0 && end>begin);
  const flight=source.slice(begin,end);
  const watcher=flight.indexOf("waitForRemoteWindupTell(entries, attacker, defender, 600, false)");
  const click=flight.indexOf("performArenaAttackHold(attacker, attackerElementId, attackOffset, 65)");
  assert.ok(watcher>=0 && click>watcher);
  assert.ok(flight.includes("const [observed] = await Promise.all(["));
  assert.ok(!flight.includes("await setArenaAttack(attacker, attackerElementId, true, attackOffset)"));
  assert.ok(!flight.includes("await setArenaAttack(attacker, attackerElementId, false, attackOffset)"));
  assert.ok(flight.includes("await stopWindupTellSampler(defender)"));
  assert.ok(flight.includes("await waitForWindupTellClear(defender, 500)"));
  assert.ok(flight.includes("const completed = await Promise.all(entries.map(readUiEvidence))"));
  assert.ok(flight.includes("windupTellMaxPixels: entry.windupTellMaxPixels"));
  assert.ok(flight.includes("attackUp.t <= attackDown.t || attackUp.t - attackDown.t >= 320"));
  assert.ok(flight.includes("defenderResult.windupTellMaxPixels < 24 || attackerResult.windupTellMaxPixels !== 0"));
  assert.ok(flight.includes("attackerResult.keys.includes"));
  assert.ok(flight.includes("attackRight ? attackDown.x >= 0.6 : attackDown.x <= 0.4"));
  const browserClick=source.slice(source.indexOf("async function performArenaAttackHold("),
    source.indexOf("\nasync function ",source.indexOf("async function performArenaAttackHold(")+28));
  assert.ok(browserClick.includes('{ type: "pointerDown", button: 0 }'));
  assert.ok(browserClick.includes('{ type: "pause", duration: boundedHoldMs }'));
  assert.ok(browserClick.includes('{ type: "pointerUp", button: 0 }'));
  assert.ok(!browserClick.includes("dispatchEvent("));
});

test("M240 keeps passive 24-pixel remote-only cue and genuine negative control", () => {
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const a=source.indexOf("async function waitForRemoteWindupTell(");
  const b=source.indexOf("\nasync function ",a+28);
  const body=source.slice(a,b);
  assert.ok(body.includes("defenderMax >= 24"));
  assert.ok(body.includes("const attackerPixels = await sampleWindupTellPixels(attacker)"));
  assert.ok(body.includes("if (attackerPixels !== 0) throw new Error"));
  assert.ok(body.includes("windupTellMaxPixels: entry.browser === attacker.name ? attackerPixels : defenderMax"));
  assert.ok(body.includes("if (!fail) return null"));
  assert.ok(body.includes("M39 remote windup boundary never appeared"));
});
