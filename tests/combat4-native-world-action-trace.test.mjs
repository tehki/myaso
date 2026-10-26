import assert from "node:assert/strict";
import {test} from "node:test";
import {hasOriginalWorldActionTransition as has} from "../src/combat/original-world-action-trace.mjs";
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
