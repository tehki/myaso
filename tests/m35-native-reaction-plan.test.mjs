import test from "node:test";
import assert from "node:assert/strict";
import { planM35NativeReaction } from "../scripts/m35-native-reaction-plan.mjs";

test("fast calibration cannot exclude the earlier real cue when the next native wheel is slower",()=>{
  assert.deepEqual(planM35NativeReaction(4),{allowHeavy:true,lightReactionMs:17,heavyReactionMs:50});
});
test("preserved native 50/76ms late inputs use the earlier original charging cue with bounded pacing",()=>{
  assert.deepEqual(planM35NativeReaction(50),{allowHeavy:true,lightReactionMs:17,heavyReactionMs:50});
  assert.deepEqual(planM35NativeReaction(76),{allowHeavy:true,lightReactionMs:17,heavyReactionMs:50});
  for(const ms of [34,50,76,113]){
    const plan=planM35NativeReaction(ms);
    assert.equal(plan.heavyReactionMs,50,
      "calibration cannot move the current wheel earlier or later");
  }
});
test("first-red93ms calibration cannot subtract away reaction when the next wheel arrives in25ms",()=>{
  const plan=planM35NativeReaction(93);
  // Preserved first-red: World charging747, Light750, Block751, contact758.
  // At least two extra ticks move the SAME native wheel inside Parry125.
  assert.ok(plan.heavyReactionMs >= 17 + 2 * (1000/60) - 1);
  assert.ok(25 + plan.heavyReactionMs < 11 * (1000/60),
    "retain delivery headroom before actual original Light contact");
});
test("missing or unbounded calibration cannot select a defensive cue",()=>{
  for(const ms of [NaN,Infinity,-1,400,undefined])assert.throws(()=>planM35NativeReaction(ms),TypeError);
});
