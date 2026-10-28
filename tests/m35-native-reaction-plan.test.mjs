import test from "node:test";
import assert from "node:assert/strict";
import { planM35NativeReaction } from "../scripts/m35-native-reaction-plan.mjs";

test("fast native ingress retains released-Light cue and one World tick of reaction",()=>{
  assert.deepEqual(planM35NativeReaction(4),{allowHeavy:false,lightReactionMs:17,heavyReactionMs:65});
});
test("preserved native 50/76ms late inputs use the earlier original charging cue with bounded pacing",()=>{
  assert.deepEqual(planM35NativeReaction(50),{allowHeavy:true,lightReactionMs:17,heavyReactionMs:19});
  assert.deepEqual(planM35NativeReaction(76),{allowHeavy:true,lightReactionMs:17,heavyReactionMs:17});
  for(const ms of [34,50,76,113]){
    const plan=planM35NativeReaction(ms);
    assert.ok(ms+plan.heavyReactionMs >= 35+2*1000/60,
      "earlier charging cue cannot demand Block before the short release plus two original World ticks");
  }
});
test("missing or unbounded calibration cannot select a defensive cue",()=>{
  for(const ms of [NaN,Infinity,-1,400,undefined])assert.throws(()=>planM35NativeReaction(ms),TypeError);
});
