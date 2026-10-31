import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const flight=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const native=readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs",import.meta.url),"utf8");
const begin=flight.indexOf("async function runOnlineUiJumpAttackWhiffPunishFlight(");
const end=flight.indexOf("\nasync function ",begin+50);
assert.ok(begin>=0 && end>begin);
const m140=flight.slice(begin,end);

test("M140 original defender pre-aim precedes genuine JumpAttack; recovery cue directly dispatches physical LMB",async()=>{
 const preaim=m140.indexOf("await aimArena(defender, defenderElementId, punishOffset)");
 const chord=m140.indexOf("await performArenaJumpAttackChord(");
 const cue=m140.indexOf("recoveryEvidence = defenderResult");
 const dispatch=m140.indexOf('await webdriver(defender.base, "POST"',cue);
 const firstReadAfter=m140.indexOf("await readUiEvidence(defender)",cue);
 assert.ok(preaim>0 && preaim<chord && chord<cue && cue<dispatch);
 assert.ok(firstReadAfter<0 || firstReadAfter>dispatch,
  "no remote browser read between visible cue and physical punish click");
 const nativeClick=m140.slice(dispatch,m140.indexOf("\n  let evidence",dispatch));
 assert.deepEqual([...nativeClick.matchAll(/type: "(pointerDown|pointerUp)"/g)].map(x=>x[1]),
  ["pointerDown","pointerUp"]);
 assert.doesNotMatch(nativeClick,/pointerMove|dispatchEvent\(|sleep\(/);
 assert.match(nativeClick,/duration: 35/);
 assert.match(m140,/punishDown\.epochMs - recoveryCue\.epochMs > 180/);
 assert.match(m140,/attackerResult\.playerHp === 66 && defenderResult\.opponentHp === 66/);
 assert.match(m140,/punishDown\.epochMs < attackerRecovery\.epochMs/);
});

test("Firefox original post-Space Idle deadline still strictly 8 seconds, with no retry-to-green",()=>{
 assert.match(native,/stage:"post-Space original World Idle 8s"/);
 assert.match(native,/\},8000\);\s*\} catch \(error\)/);
 assert.match(native,/COMBAT4_SPACE_IDLE_ORIGINAL_WORLD_FIRST_RED/);
 assert.match(native,/firstRed\.originalWorld=readAuthoritativeWorld\(\)/);
 assert.match(native,/throw error;\s*\}\s*const beforeNormal=/);
});
