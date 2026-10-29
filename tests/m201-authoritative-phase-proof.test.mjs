import assert from "node:assert/strict";
import test from "node:test";
import { parseM201ServerProof, verifyM201ServerPunishProof } from "../scripts/m201-authoritative-phase-proof.mjs";
const trace = [
"M201_AUTH_ACTION tick=110 fighter=1 from=2 to=3",
"M201_AUTH_ACTION tick=111 fighter=2 from=6 to=7",
"M201_AUTH_BREAK tick=111 attacker=1 target=2",
"M201_AUTH_ACTION tick=124 fighter=1 from=3 to=1",
"M201_AUTH_ACTION tick=132 fighter=1 from=1 to=2",
"M201_AUTH_HIT tick=133 attacker=1 target=2 damage=34 hp=66",
"M201_AUTH_ACTION tick=137 fighter=1 from=2 to=3",
"M201_AUTH_ACTION tick=150 fighter=2 from=7 to=0"
].join("\n")+"\n";
const roles = { attackerId:1, defenderId:2, closerId:3 };
test("M201 retains server phase proof independently from browser snapshots",()=> {
 const p = verifyM201ServerPunishProof(trace, roles);
 assert.equal(p.active.tick,132);assert.equal(p.hit.tick,133);assert.equal(p.stunExit.tick,150);
});
test("M201 requires authoritative active edge",()=>assert.throws(
 ()=>verifyM201ServerPunishProof(trace.replace("M201_AUTH_ACTION tick=132 fighter=1 from=1 to=2\n",""),roles),/active/));
test("M201 rejects bad server hit and collateral",()=>{
 assert.throws(()=>verifyM201ServerPunishProof(trace.replace("hp=66","hp=32"),roles));
 assert.throws(()=>verifyM201ServerPunishProof(trace+"M201_AUTH_HIT tick=149 attacker=1 target=3 damage=34 hp=66\n",roles));
});
test("M201 validates server trace ordering and numbers",()=>{
 assert.throws(()=>parseM201ServerProof(trace+"M201_AUTH_ACTION tick=1 fighter=1 from=2 to=3\n"),/unordered/);
 assert.throws(()=>parseM201ServerProof(trace+"M201_AUTH_ACTION tick=9007199254740995 fighter=1 from=2 to=3\n"),/unsafe/);
});

test("typed admission stays separate from original World phase and exact HIT proof",()=>{
 const admission = "M201_AUTH_GESTURE_ACTION tick=123 fighter=1 source=0 gesture=4 sequence=7 eventAction=1 status=1 from=3 to=3\n";
 const mixed = trace.replace("M201_AUTH_ACTION tick=124",admission+"M201_AUTH_ACTION tick=124");
 assert.equal(verifyM201ServerPunishProof(mixed,roles).hit.hp,66);
 assert.equal(parseM201ServerProof(mixed).find(row=>row.kind==="gesture").gestureId,4);
 const fakePhase = mixed.replace("M201_AUTH_ACTION tick=132 fighter=1 from=1 to=2",
   "M201_AUTH_GESTURE_ACTION tick=132 fighter=1 source=0 gesture=4 sequence=8 eventAction=3 status=1 from=1 to=2");
 assert.throws(()=>verifyM201ServerPunishProof(fakePhase,roles),/active/);
 for(const bad of [admission.replace("source=0","source=2"),admission.replace("status=1","status=9"),
   admission.replace("sequence=7","sequence=0"),admission.replace("gesture=4","gesture=4294967296"),
   admission.replace("from=3","from=999"),admission.replace("eventAction=1","eventAction=6")]) {
   assert.throws(()=>parseM201ServerProof(bad),/malformed|invalid/);
 }
 assert.throws(()=>parseM201ServerProof(mixed+admission),/unordered/);
});
