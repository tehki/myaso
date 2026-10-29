import test from "node:test";
import assert from "node:assert/strict";
import { createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";

test("Space after a genuine LMB charging admission retains idle-chord costs and never leaks Light",()=>{
  for(const [budget,expected,cost] of [[8,"idle",0],[19,"jump",14],[40,"jump_attack_windup",26]]) {
    const fighter=createFighter({id:"1",x:200,y:200});
    const world=createWorld({width:8192,height:600,fighters:[fighter]});
    for(let tick=0; tick<400 && fighter.stamina>budget; tick++)
      stepWorld(world,{"1":{moveX:1,run:true}},1000/60);
    assert.ok(fighter.stamina<=budget);
    stepWorld(world,{"1":{attack:true,heavyAttack:true}},1000/60);
    assert.equal(fighter.action,"heavy_attack_windup");
    const before=fighter.stamina;
    stepWorld(world,{"1":{attack:true,jump:true}},1000/60);
    assert.equal(fighter.action,expected,`original charging chord at${before} stamina`);
    assert.ok(Math.abs(fighter.stamina-(before-cost))<0.01);
    assert.equal(fighter.hp,100);assert.equal(fighter.guard,100);
  }
});
