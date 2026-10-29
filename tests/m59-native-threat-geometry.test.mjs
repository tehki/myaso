import test from "node:test";
import assert from "node:assert/strict";
import { planM59ThreatGeometry } from "../scripts/m59-native-threat-geometry.mjs";
import {createFighter,createWorld,stepWorld} from "../src/combat/model.mjs";

const state=(gap)=>[{netId:1,x:200-gap,y:200},{netId:2,x:200,y:200},{netId:3,x:200+gap,y:200}];
test("historical260ms inward staging can put attackers in each other's Light reach",()=>{
  const plan=planM59ThreatGeometry(state(41),1,2,3);
  assert.equal(plan.ready,false);
  assert.deepEqual(plan.moves.map(m=>m.key),["a","d"]);
});
test("replicated62px staging preserves both threats and bounds native corrections",()=>{
  assert.equal(planM59ThreatGeometry(state(62),1,2,3).ready,true);
  const plan=planM59ThreatGeometry(state(96),1,2,3);
  assert.deepEqual(plan.moves.map(m=>m.key),["d","a"]);
  assert.ok(plan.moves.every(m=>m.ms>=15&&m.ms<=140));
  assert.throws(()=>planM59ThreatGeometry([],1,2,3));
});
test("simultaneous and one-tick-staggered genuine Light actions hit center twice without clipping attackers",()=>{
  for(const gap of [58,62,66])for(const stagger of [0,1,2]) {
    const world=createWorld({fighters:[
      createFighter({id:"left",x:200-gap,y:200}),
      createFighter({id:"center",x:200,y:200}),
      createFighter({id:"right",x:200+gap,y:200,facing:Math.PI}),
    ]});
    let simultaneousStrike=false;
    for(let tick=0;tick<40;tick++) {
      stepWorld(world,{left:{attack:tick===0,aimX:200,aimY:200},
        right:{attack:tick===stagger,aimX:200,aimY:200}},1000/60);
      if(world.fighters[0].action==="attack_active"&&world.fighters[2].action==="attack_active")simultaneousStrike=true;
    }
    assert.equal(simultaneousStrike,true);
    assert.equal(world.fighters[1].hp,32);
    assert.equal(world.fighters[0].hp,100);assert.equal(world.fighters[2].hp,100);
  }
});
