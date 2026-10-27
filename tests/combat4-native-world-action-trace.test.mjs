import assert from "node:assert/strict";
import {test} from "node:test";
import {hasOriginalWorldActionTransition as has, classifyOriginalWorldJumpAttackEntry as classifyJump} from "../src/combat/original-world-action-trace.mjs";
test("real server Action Jump 15 never impersonates Light 1",()=>{
 const log="M201_AUTH_ACTION tick=722 fighter=1 from=0 to=15\nM201_AUTH_ACTION tick=738 fighter=1 from=15 to=16\nM201_AUTH_ACTION tick=744 fighter=1 from=16 to=17\n";
 assert.equal(has(log,1,0,15),true);
 assert.equal(has(log,1,15,16),true);
 assert.equal(has(log,1,16,17),true);
 assert.equal(has(log,1,0,1),false);
 assert.equal(has(log,2,0,15),false);
});
test("a truly separate ordinary Light is still a mandatory failure",()=>{
 const log="M201_AUTH_ACTION tick=741 fighter=1 from=0 to=1\n";
 assert.equal(has(log,1,0,1),true);
 assert.equal(has(log,1,0,15),false);
});
test("no substring, partial actor or leading fake World journal lines",()=>{
 assert.equal(has("M201_AUTH_ACTION tick=2 fighter=11 from=0 to=1",1,0,1),false);
 assert.equal(has("noise M201_AUTH_ACTION tick=2 fighter=1 from=0 to=1",1,0,1),false);
 assert.equal(has("M201_AUTH_ACTION tick=2 fighter=1 from=0 to=10",1,0,1),false);
});

test("separate original World ticks remain strong Jump→Windup evidence",()=>{
 const log="M201_AUTH_ACTION tick=690 fighter=1 from=0 to=15\n"
    +"M201_AUTH_ACTION tick=696 fighter=1 from=15 to=16\n";
 assert.equal(classifyJump(log,1,{startingStamina:100,observedStamina:74}),
  "separate-original-world-ticks");
});
test("real Firefox 2-player World compresses Jump and attack between observer ticks",()=>{
 const log="M201_AUTH_GESTURE_ACTION tick=1376 fighter=1 source=0 gesture=1 sequence=1 eventAction=5 status=1 from=0 to=0\n"
   +"M201_AUTH_ACTION tick=1380 fighter=1 from=0 to=16\n"
   +"M201_AUTH_GESTURE_ACTION tick=1383 fighter=1 source=0 gesture=1 sequence=2 eventAction=3 status=1 from=16 to=16\n"
   +"M201_AUTH_ACTION tick=1387 fighter=1 from=16 to=17\n"
   +"M201_AUTH_HIT tick=1387 attacker=1 target=2 damage=42 hp=58\n"
   +"M201_AUTH_ACTION tick=1394 fighter=1 from=17 to=18\n";
 assert.equal(classifyJump(log,1,{startingStamina:100,observedStamina:74}),
   "compressed-sampled-world-ticks-authenticated");
 assert.equal(classifyJump(log,2,{startingStamina:100,observedStamina:74}),null);
 assert.equal(classifyJump(log,1,{startingStamina:100,observedStamina:86}),null,
   "only jump stamina (14), lacking attack stamina (12), cannot qualify");
 assert.equal(classifyJump(log,1,{startingStamina:100,observedStamina:100}),null);
 assert.equal(classifyJump(log.replace("status=1","status=3"),1,{
   startingStamina:100,observedStamina:74}),null,"rejected action cannot qualify");
 assert.equal(classifyJump(log.replace("source=0","source=1"),1,{
   startingStamina:100,observedStamina:74}),null,"retired KeyE source cannot qualify");
});
test("World observer 0→16 without authenticated source0 cannot pass on stamina alone",()=>{
 const log="M201_AUTH_ACTION tick=7 fighter=1 from=0 to=16\n";
 assert.equal(classifyJump(log,1,{startingStamina:100,observedStamina:74}),null);
 assert.equal(classifyJump(log,1,{startingStamina:100,observedStamina:0}),null);
});
