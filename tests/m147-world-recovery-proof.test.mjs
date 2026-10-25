import assert from "node:assert/strict";
import test from "node:test";
import {verifyM147WorldRecoveryProof} from "../scripts/m147-world-recovery-proof.mjs";
const ids={jumpId:1,punisherId:2,closerId:3};
// Captured EXACT027bd00e standard native trial1, job121291161130. Its legacy
// UI assertions passed, but the real HIT follows victim recovery exit.
const capturedLate1=`M201_AUTH_ACTION tick=1454 fighter=1 from=0 to=16
M201_AUTH_ACTION tick=1460 fighter=1 from=16 to=17
M201_AUTH_ACTION tick=1467 fighter=1 from=17 to=18
M201_AUTH_ACTION tick=1477 fighter=2 from=0 to=9
M201_AUTH_ACTION tick=1483 fighter=2 from=9 to=1
M201_AUTH_ACTION tick=1485 fighter=1 from=18 to=0
M201_AUTH_ACTION tick=1491 fighter=2 from=1 to=2
M201_AUTH_HIT tick=1491 attacker=2 target=1 damage=34 hp=66`;
const capturedLate2=`M201_AUTH_ACTION tick=1187 fighter=1 from=15 to=16
M201_AUTH_ACTION tick=1193 fighter=1 from=16 to=17
M201_AUTH_ACTION tick=1200 fighter=1 from=17 to=18
M201_AUTH_ACTION tick=1210 fighter=2 from=0 to=9
M201_AUTH_ACTION tick=1218 fighter=1 from=18 to=0
M201_AUTH_ACTION tick=1218 fighter=2 from=9 to=1
M201_AUTH_ACTION tick=1226 fighter=2 from=1 to=2
M201_AUTH_HIT tick=1226 attacker=2 target=1 damage=34 hp=66`;
// Unit fixture only; actual new native World qualification remains mandatory.
const inside=`M201_AUTH_ACTION tick=100 fighter=1 from=0 to=16
M201_AUTH_ACTION tick=106 fighter=1 from=16 to=17
M201_AUTH_ACTION tick=113 fighter=1 from=17 to=18
M201_AUTH_ACTION tick=117 fighter=2 from=0 to=1
M201_AUTH_ACTION tick=125 fighter=2 from=1 to=2
M201_AUTH_HIT tick=125 attacker=2 target=1 damage=34 hp=66
M201_AUTH_ACTION tick=131 fighter=1 from=18 to=0`;

test("M147 rejects both captured late-HIT legacy greens on exact027bd00e",()=>{
  for(const trace of [capturedLate1,capturedLate2])assert.throws(()=>verifyM147WorldRecoveryProof(trace,ids),/outside original recovery|not inside original recovery/);
});
test("M147 requires actual original phases and HIT strictly before victim recovery exit",()=>{
  const proof=verifyM147WorldRecoveryProof(inside,ids);
  assert.equal(proof.hit.tick,125);assert.equal(proof.jump.idle.tick,131);
  const sameExit=inside.replaceAll("tick=125","tick=131");
  assert.throws(()=>verifyM147WorldRecoveryProof(sameExit,ids),/outside original recovery/);
  assert.throws(()=>verifyM147WorldRecoveryProof(inside.replace("M201_AUTH_ACTION tick=125 fighter=2 from=1 to=2\n",""),ids),/light active/);
  assert.throws(()=>verifyM147WorldRecoveryProof("Opponent hit - 34 HP.",ids),/victim jump windup/);
});
test("M147 rejects wrong role, spectator hit, damage, duplicate HIT and duplicate actor binding",()=>{
  for(const trace of [inside.replace("attacker=2 target=1","attacker=3 target=1"),
    inside.replace("attacker=2 target=1","attacker=2 target=3"),
    inside.replace("damage=34","damage=42"),inside.replace("hp=66","hp=32"),
    inside+"\nM201_AUTH_HIT tick=132 attacker=2 target=1 damage=34 hp=32"])
    assert.throws(()=>verifyM147WorldRecoveryProof(trace,ids),/wrong attacker|exactly one/);
  assert.throws(()=>verifyM147WorldRecoveryProof(inside,{...ids,closerId:2}),/distinct/);
});
test("M147 rejects corrupted chronology and permits bounded uint32 tick rollover",()=>{
  assert.throws(()=>verifyM147WorldRecoveryProof(inside.replace("tick=125 fighter=2","tick=105 fighter=2"),ids),/unordered/);
  assert.throws(()=>verifyM147WorldRecoveryProof(inside.replace("tick=125 attacker","tick=oops attacker"),ids),/malformed/);
  const wrapped=inside.replace(/tick=(\d+)/g,(_,n)=>"tick="+((Number(n)+0xffff_ff90)>>>0));
  assert.equal(verifyM147WorldRecoveryProof(wrapped,ids).hit.tick,13);
});


test("M147 clean whiff cannot hide guard/parry contact behind regenerated final vitals",()=>{
  for(const event of ["BLOCK","PARRY","BREAK"])
    assert.throws(()=>verifyM147WorldRecoveryProof(inside+`\nM201_AUTH_${event} tick=132 attacker=1 target=3`,ids),/unexpected defense contact/);
});
