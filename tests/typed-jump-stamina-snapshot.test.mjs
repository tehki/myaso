import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

test("actual World snapshot callbacks confirm typed feedback independently of movement reconciliation ACK",()=>{
 const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const start=source.indexOf("  onSnapshot(_result, state) {");
 const end=source.indexOf("  onKillEvent(event) {",start);
 assert.ok(start>0&&end>start);
 const observed=[],own={netId:1,hp:100,guard:100,stamina:7.1998,action:15};
 const state=new Map([[1,own]]);
 const context={networkClient:{playerNetId:1,latestServerTick:493},resolvePrivateHitActor:null,
  networkStatus:"Online",authoritativeStamina:21.1998,local:{initialized:true},
  restoreAuthoritative:()=>{throw Error("existing actor must not be replaced");},
  observeCombatState:()=>{},confirmTypedJumpStaminaDenial:actor=>observed.push(actor)};
 const callbacks=vm.runInNewContext(`({${source.slice(start,end)}})`,context);
 callbacks.onSnapshot(null,state);
 callbacks.onReliableSnapshot(null,state);
 assert.deepEqual(observed,[own,own],
  "real World state must reach the bounded typed observer even without positional onAck");
 assert.equal(context.authoritativeStamina,own.stamina);
});
