import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {test} from "node:test";
import {authoritativeWindupHudHint} from "../src/browser/authoritative-windup-hud.mjs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";

const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
function actualFunction(name,next){
 const start=source.indexOf("function "+name+"(");
 const end=source.indexOf("\nfunction "+next+"(",start+15);
 assert.ok(start>=0&&end>start);
 return source.slice(start,end);
}
function fixture(){
 const writes=[];
 let current="Attack committed - your windup is readable.";
 const actor={action:COMBAT_ACTION.idle,hp:100};
 const env={
   COMBAT_ACTION, authoritativeWindupHudHint,
   networkClient:{playerNetId:1},lastWorldStatusAction:null,lastWorldStatusActorId:null,
   combatMessage:"Parried - your commitment was read.",combatMessageUntil:1980,
   hudCache:{status:current},
   eventText:{set textContent(t){current=t;writes.push(t);},get textContent(){return current;}},
   performance:{now:()=>1500},
   recordAcceptanceState(){},observeThreatCommitment(){},
   fighterMatchPresentation(){return {visible:false};},
   matchOver:false,releaseInputs(){},
   remoteDamage:{observe(){}},remoteActionAudio:{observe(){}},
   audio:{play(){}},combatReadability:{observe(){return null;}},
 };
 runInNewContext(actualFunction("setStatus","createArenaLayer")+"\n"
   +actualFunction("observeCombatState","observeThreatCommitment")
   +"\nthis.actualWorldObserver=observeCombatState;",env);
 return {
  env,writes,
  event(action,id=1){actor.action=action;return new Map([[id,{...actor}]]);},
  feed(action,id=1){env.actualWorldObserver(this.event(action,id));},
 };
}
test("two genuine original World LightWindups refresh duplicate HUD cue once each, even during old parry banner",()=>{
 const f=fixture();
 f.feed(COMBAT_ACTION.idle);
 f.feed(COMBAT_ACTION.attackWindup);
 f.feed(COMBAT_ACTION.attackWindup);
 assert.deepEqual(f.writes,["Attack committed - your windup is readable."]);
 f.feed(COMBAT_ACTION.attackActive);
 f.feed(COMBAT_ACTION.attackRecovery);
 f.feed(COMBAT_ACTION.idle);
 f.feed(COMBAT_ACTION.attackWindup);
 assert.deepEqual(f.writes,[
  "Attack committed - your windup is readable.",
  "Attack committed - your windup is readable.",
 ]);
 assert.equal(f.env.combatMessage,"Parried - your commitment was read.",
  "existing previous feedback is neither forged nor cleared");
});
test("stale Windup snapshots and other actors cannot replay status edges",()=>{
 const f=fixture();
 f.feed(COMBAT_ACTION.attackWindup);
 f.feed(COMBAT_ACTION.attackWindup);
 f.feed(COMBAT_ACTION.attackWindup);
 assert.equal(f.writes.length,1);
 f.feed(COMBAT_ACTION.idle);
 f.env.actualWorldObserver(new Map([[1,{action:COMBAT_ACTION.idle,hp:100}],
   [2,{action:COMBAT_ACTION.attackWindup,hp:100}]]));
 assert.equal(f.writes.length,1);
});
test("actual HUD string identity stays deduplicated for ordinary non-World updates",()=>{
 const f=fixture();
 f.env.setStatus("Attack committed - your windup is readable.");
 assert.equal(f.writes.length,0);
 f.env.setStatus("Blocking - keep the threat in front of you.");
 f.env.setStatus("Blocking - keep the threat in front of you.");
 assert.equal(f.writes.length,1);
});
