import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs",import.meta.url),"utf8");
function parse(lines){
 const begin=source.indexOf("  const admissions=()=>");
 const end=source.indexOf("  const hits=()=>",begin);
 assert.ok(begin>=0&&end>begin);
 return JSON.parse(JSON.stringify(vm.runInNewContext(source.slice(begin,end)+"admissions();",{
  worldLines:()=>lines,attackerId:1,
 })));
}
const press="M201_AUTH_GESTURE_ACTION tick=1359 fighter=1 source=0 gesture=1 sequence=1 eventAction=1 status=1 from=0 to=1";
const upgrade="M201_AUTH_GESTURE_ACTION tick=1359 fighter=1 source=0 gesture=1 sequence=2 eventAction=2 status=1 from=1 to=9";
test("native held-LMB proof retains actual ordered same-World-tick PRESS and UPGRADE mutations",()=>{
 const rows=parse([press,upgrade]);
 assert.deepEqual(rows.map(r=>[r.index,r.tick,r.sequence,r.from,r.to]),[[0,1359,1,0,1],[1,1359,2,1,9]]);
 assert.equal(new Set(rows.map(r=>r.gesture)).size,1);
});
test("sampled Idle to Heavy, ACK text, foreign actor and malformed admission cannot fabricate transient light",()=>{
 assert.deepEqual(parse(["M201_AUTH_ACTION tick=1360 fighter=1 from=0 to=9",
  "ACK source=0 sequence=1 status=1",press.replace("fighter=1","fighter=2"),upgrade+" forged"]),[]);
 const replay=parse([upgrade.replace("status=1 from=1 to=9","status=2 from=9 to=9")]);
 assert.equal(replay[0].status,2);assert.equal(replay[0].from,9);assert.equal(replay[0].to,9);
 assert.equal(replay.filter(r=>r.status===1&&r.from===1&&r.to===9).length,0);
});
test("held proof rejects reordered, wrong-gesture, stale-sequence, late and duplicate World mutations",()=>{
 const begin=source.indexOf('   assert.ok(upgrade.heavy.index>');
 const end=source.indexOf('   await sleeps(460)',begin);
 const code=source.slice(begin,end);
 const rows=parse([press,upgrade]);
 const validate=(light,heavy)=>vm.runInNewContext(code,{assert,upgrade:{light,heavy}});
 validate(rows[0],rows[1]);
 for(const patch of [{index:0},{gesture:2},{sequence:1},{tick:1358},{tick:1368}])
  assert.throws(()=>validate(rows[0],{...rows[1],...patch}));
 const countsBegin=source.indexOf('   assert.equal(admitted.filter(');
 const countsEnd=source.indexOf('   assert.equal(actions()',countsBegin);
 const counts=source.slice(countsBegin,countsEnd);
 vm.runInNewContext(counts,{assert,admitted:rows});
 assert.throws(()=>vm.runInNewContext(counts,{assert,admitted:[...rows,rows[1]]}));
 assert.throws(()=>vm.runInNewContext(counts,{assert,admitted:[rows[0]]}));
});
test("ACK correlation retains actual server tick, gesture and sequence identity",()=>{
 const begin=source.indexOf('   for(const receipt of accepted){');
 const end=source.indexOf('   assert.ok(heavyActive.tick>=releaseReceipt.serverTick',begin);
 const code=source.slice(begin,end);
 const admitted=parse([press,upgrade]);
 const accepted=admitted.map(e=>({action:e.eventAction,sequence:e.sequence,gestureId:e.gesture,serverTick:e.tick}));
 vm.runInNewContext(code,{assert,admitted,accepted});
 for(const patch of [{serverTick:1360},{gestureId:9},{sequence:8}])
  assert.throws(()=>vm.runInNewContext(code,{assert,admitted,accepted:[{...accepted[0],...patch},accepted[1]]}));
});
