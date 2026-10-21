import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {COMBAT} from "../src/combat/model.mjs";
import {KNIGHT_CLIPS,knightClip,knightDirectionIndex} from "../web/knight-sprites.mjs";
import {SILVER_KNIGHT_ACTION_GAPS,auditKnightCoverage,
 renderKnightGapMarkdown} from "../tools/art/knight_action_gap_matrix.mjs";
const expectedAuth=new Set(["idle","dodge","dodgeRecovery","jump"]);
const all=Object.entries(COMBAT_ACTION);
test("all 31 main Combat numeric action codes exactly included once (P0 owner directive #542)",()=>{
 assert.equal(all.length,31);
 const metrics=auditKnightCoverage();
 assert.deepEqual(metrics,{total:31,authored:4,missing:27,kickAndDashMissing:4});
 assert.deepEqual(SILVER_KNIGHT_ACTION_GAPS.map(x=>x.id),Array.from({length:31},(_,i)=>i));
 for(const [name,id] of all){
  const hit=SILVER_KNIGHT_ACTION_GAPS[id];
  assert.equal(hit.name,name);
  assert.equal(hit.id,id);
  assert.ok(hit.ms!==null,"Need source phase budget for "+name);
  assert.equal(Boolean(hit.clip),expectedAuth.has(name),name);
  assert.equal(hit.directions,hit.clip?8:0);
  assert.equal(hit.classification,hit.clip?"AUTHORED":"MISSING / FALLBACK");
  assert.equal(knightClip(id,"player"),hit.clip);
 }
});
test("all Silver missing kick/dash and attack states stay truthful fallback, including unknown values",()=>{
 for(const r of SILVER_KNIGHT_ACTION_GAPS){
  if(r.classification!=="MISSING / FALLBACK")continue;
  assert.equal(knightClip(r.id,"player"),null,r.name+" must not be painted idle/sprint");
 }
 for(const missing of [-1,31,1000,NaN,null,undefined]){
  assert.equal(knightClip(missing,"player"),null,String(missing));
 }
 for(const name of ["kickWindup","kickActive","kickRecovery","dash"]){
  const row=SILVER_KNIGHT_ACTION_GAPS.find(x=>x.name===name);
  assert.ok(row);
  assert.equal(row.priority,"P0-FIRST");
  assert.equal(row.clip,null);
 }
});
test("actual 8-direction artwork and correct phases are separated from server timestamps",()=>{
 assert.equal(KNIGHT_CLIPS.silver_idle,4);
 assert.equal(KNIGHT_CLIPS.silver_walk,8);
 assert.equal(KNIGHT_CLIPS.silver_sprint,8);
 assert.equal(KNIGHT_CLIPS.silver_jump,6);
 assert.equal(KNIGHT_CLIPS.silver_roll,8);
 for(let i=0;i<8;i++){
  const facing=Math.PI/2+i*Math.PI/4;
  assert.equal(knightDirectionIndex(facing),i);
 }
 const at=name=>SILVER_KNIGHT_ACTION_GAPS.find(x=>x.name===name);
 assert.equal(at("dash").ms,COMBAT.dash.durationMs);
 assert.deepEqual(["kickWindup","kickActive","kickRecovery"].map(n=>at(n).ms),
  [COMBAT.kick.windupMs,COMBAT.kick.activeMs,COMBAT.kick.recoveryMs]);
 assert.deepEqual(["dodge","dodgeRecovery"].map(n=>at(n).ms),
  [170,180]);
 assert.equal(at("jump").ms,COMBAT.jump.durationMs);
});
test("human Silver and NPC Sentinel are different explicitly verified roles",()=>{
 assert.equal(knightClip(COMBAT_ACTION.idle,"player",0,false),"silver_idle");
 assert.equal(knightClip(COMBAT_ACTION.idle,"player",200,true),"silver_walk");
 assert.equal(knightClip(COMBAT_ACTION.idle,"player",300,true),"silver_sprint");
 assert.equal(knightClip(COMBAT_ACTION.idle,"npc"),"t1_walk");
 assert.equal(knightClip(COMBAT_ACTION.block,"npc"),"t1_block");
 assert.equal(knightClip(COMBAT_ACTION.attackActive,"npc"),"t1_attack");
 assert.equal(knightClip(COMBAT_ACTION.block,"player"),null);
 assert.equal(knightClip(COMBAT_ACTION.dash,"player"),null);
});
test("committed source matrix is deterministic and equals generated 31-row audit",()=>{
 const committed=readFileSync(new URL("../docs/art/GRAPHICS3A_P0_KNIGHT_ACTION_GAP_MATRIX.md",import.meta.url),"utf8");
 const generated=renderKnightGapMarkdown();
 assert.equal(committed.replaceAll("\r\n","\n"),generated);
 const rows=committed.split("\n").filter(x=>/^\| (?:\d|\d\d) \|/.test(x));
 assert.equal(rows.length,31);
 assert.match(committed,/Pickup\/reach\/grip/);
 assert.match(committed,/P0/);
 assert.match(committed,/27\/31/);
});
