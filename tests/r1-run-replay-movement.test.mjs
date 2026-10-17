import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPredictionHistory, reconcilePrediction } from "../src/browser/reconciliation.mjs";
import { COMBAT } from "../src/combat/model.mjs";

test("ACK replay preserves real sprint/jump/kick instead of silently turning sprint into a walk", () => {
  const history=createPredictionHistory({maxEntries:16});
  history.push(20,{moveX:1,moveY:0,facing:0,run:true,kick:true,jump:true});
  history.push(21,{moveX:1,moveY:0,facing:0,run:true});
  const [first,second]=history.snapshot();
  assert.equal(first.run,true);
  assert.equal(first.kick,true);
  assert.equal(first.jump,true);
  assert.equal(second.run,true);
  assert.equal(second.kick,false);
  assert.equal(second.jump,false);
  const local={x:100,y:10};
  const result=reconcilePrediction({
    history,processedClientTick:20,authoritativeState:{x:100,y:10},
    restoreAuthoritative(o){local.x=o.x;local.y=o.y;},
    replayInput(input){
      local.x+=COMBAT.moveSpeed*(input.run?COMBAT.stamina.runMoveMultiplier:1)/60;
    },
  });
  assert.deepEqual(result,{discarded:1,replayed:1});
  assert.ok(Math.abs(local.x-100-COMBAT.moveSpeed*COMBAT.stamina.runMoveMultiplier/60)<1e-6);
  assert.deepEqual(history.snapshot().map(x=>x.tick),[21]);
});

test("interrupted sprint and ordinary walking preserve per-input decisions across rebase",()=>{
 const history=createPredictionHistory();
 history.push(1,{moveX:1,run:true});
 history.push(2,{moveX:1,run:true});
 history.push(3,{moveX:1,run:false});
 const walk=COMBAT.moveSpeed/60;
 const sprint=walk*COMBAT.stamina.runMoveMultiplier;
 let x=0;
 reconcilePrediction({history,processedClientTick:1,authoritativeState:{x:0},
  restoreAuthoritative(o){x=o.x;},
  replayInput(input){x+=input.run?sprint:walk;}});
 assert.ok(Math.abs(x-(sprint+walk))<1e-6);
});

test("WAN sprint replay remains client-only and does not alter authoritative packets",()=>{
 const client=readFileSync(new URL("../web/authoritative-client.mjs",import.meta.url),"utf8");
 const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const input=readFileSync(new URL("../src/browser/reconciliation.mjs",import.meta.url),"utf8");
 assert.match(client,/run: Boolean\(sample\.run\)/);
 assert.match(client,/predictionHistory\.push\(normalized\.tick, normalized\)/);
 assert.match(input,/run: Boolean\(input\.run\)/);
 assert.match(online,/replayInput\(entry\) \{ predictMovement\(entry, 1000 \/ NETWORK\.inputSendHz\); \}/);
});
