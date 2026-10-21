// Graphics 3C P0: authored Blacksmith scene must not fabricate physical swords.
// Alpha world-item IDs, rack sockets, LOS and authoritative pickup are owned by
// World, Core and Items. This only checks 3C's cosmetic ground/light separation.
import assert from "node:assert/strict";
import test from "node:test";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {createGreyhavenTerrainPlan} from "../src/browser/greyhaven-terrain-materials.mjs";
import {createGreyhavenLightingPlan} from "../src/browser/greyhaven-atmosphere.mjs";

const map=getAuthoredMap(MAP_IDS.overworld);
const smith=map.buildings.find(building=>building.id==="smith");

test("P0 Greyhaven Blacksmith is a real authored building, not a created pickup zone",()=>{
  assert.ok(smith,"World #336 Blacksmith is the candidate armory");
  assert.equal(smith.name,"Blacksmith");
  assert.deepEqual([smith.x,smith.y,smith.w,smith.h],[3710,3850,182,162],
    "World must explicitly coordinate a changed armory geometry");
  assert.ok(map.city.x<=smith.x && map.city.y<=smith.y);
  assert.ok(smith.x+smith.w<=map.city.x+map.city.w);
  assert.ok(smith.y+smith.h<=map.city.y+map.city.h);
  // Important: this World #336 source has no racks, four canonical items,
  // server collision or authoritative smith portal. Do not fake them here.
  assert.equal(smith.entrance,undefined);
  assert.equal(smith.portal,undefined);
});

test("P0 terrain never places decorative samples inside Blacksmith footprint",()=>{
  const unchanged=JSON.stringify(map);
  let observed=0;
  for(let ty=3584;ty<=4096;ty+=512)
    for(let tx=3584;tx<=4096;tx+=512){
      const sample=createGreyhavenTerrainPlan(map,{x:tx,y:ty,width:512,height:512});
      for(const p of [...sample.pavers,...sample.grass,...sample.soil]){
        assert.ok(!(p.x>=smith.x && p.x<=smith.x+smith.w &&
            p.y>=smith.y && p.y<=smith.y+smith.h),
          "3C may not draw cosmetic ground detail over Blacksmith floor");
        observed++;
      }
    }
  assert.ok(observed>0,"nearby authored Greyhaven streets still receive art");
  assert.equal(JSON.stringify(map),unchanged,"renderer input must be immutable");
});

test("P0 Blacksmith light fixture is cosmetic; it does not create a rack item",()=>{
  const tile={x:3584,y:3584,width:512,height:512};
  const lights=createGreyhavenLightingPlan(map,tile);
  const smithLamp=lights.find(x=>x.id==="smith");
  assert.ok(smithLamp,"smith approach remains readable in existing lighting");
  assert.equal(smithLamp.fixtureY,smith.y+smith.h-5);
  assert.equal(smithLamp.poolY,smith.y+smith.h+19);
  assert.ok(lights.length<=5);
  assert.deepEqual(createGreyhavenLightingPlan(map,tile),lights);
  assert.equal("itemId" in smithLamp,false,"decorative light cannot be pickup target");
  assert.equal("rackSwordId" in smithLamp,false,"no local sword ownership state");
});
