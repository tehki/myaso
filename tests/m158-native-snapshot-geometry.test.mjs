import test from "node:test";
import assert from "node:assert/strict";
import { createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";
import { M158_NATIVE_GEOMETRY as geometry } from "../scripts/m158-native-geometry.mjs";
import { fighterKnockdownPunishNetId, COMBAT_ACTION } from "../src/browser/combat-readability.mjs";

function snapshots({secondaryDx, secondaryDy, rollerDx, rollerDy}, errors = [0,0,0,0], retreat = false) {
  const [ex, ey, erx, ery] = errors;
  const world = createWorld({fighters:[
    createFighter({id:"1", x:200+rollerDx+erx, y:200+rollerDy+ery}),
    createFighter({id:"2", x:200, y:200}),
    createFighter({id:"3", x:200+secondaryDx+ex, y:200+secondaryDy+ey}),
  ]});
  const rows = [];
  for(let tick=1; tick<=55; tick++) {
    stepWorld(world, {"1":{dodge:tick===1,moveX:retreat && tick>=12 && tick<=26 ? -1 : 0,
      aimX:900,aimY:200+rollerDy+ery}},1000/60);
    const state = new Map(world.fighters.map(f => [Number(f.id), {
      ...f, netId:Number(f.id), action:f.action === "knockdown" ? COMBAT_ACTION.knockdown : COMBAT_ACTION.idle,
    }]));
    for(const f of world.fighters) { assert.equal(f.hp,100); assert.equal(f.guard,100); }
    rows.push({tick, focus:fighterKnockdownPunishNetId(state,1)});
  }
  return rows;
}

test("original short M158 handoff disappears when its sole secondary snapshot is skipped",()=>{
  const old=snapshots({secondaryDx:34,secondaryDy:24,rollerDx:-62,rollerDy:0});
  const sampled=old.filter(r=>r.tick%3===0);
  const secondary=sampled.filter(r=>r.focus===3);
  assert.ok(secondary.length<=2);
  // Retain exact observed failure: one missing snapshot can leave only#2.
  const phase= [0,1,2].map(p=>old.filter(r=>r.tick%3===p)).find(rows=>rows.filter(r=>r.focus===3).length===1);
  assert.ok(phase);
  assert.ok(phase.some(r=>r.focus===2));
  const dropped=phase.find(r=>r.focus===3);
  assert.equal(phase.filter(r=>r!==dropped).some(r=>r.focus===3),false);
});

test("staged real roll retains ordered focus after any one missing snapshot throughout unchanged±5px tolerance",()=>{
  for(const ex of [-5,0,5])for(const ey of [-5,0,5])
    for(const erx of [-5,0,5])for(const ery of [-5,0,5]) {
      const rows=snapshots(geometry,[ex,ey,erx,ery],true);
      for(const phase of [0,1,2]) {
        const sampled=rows.filter(r=>r.tick%3===phase);
        const primary=sampled.findIndex(r=>r.focus===2);
        const secondary=sampled.filter((r,i)=>i>primary&&r.focus===3);
        assert.ok(primary>=0);
        assert.ok(secondary.length>=2,"one dropped20Hz snapshot cannot erase the actual secondary state");
        assert.ok(sampled.some(r=>r.tick>=25 && r.tick<=32 && r.focus===2),
          "real retreat restores primary as nearest before recovery");
        assert.equal(sampled.at(-1).focus,0);
      }
    }
});
