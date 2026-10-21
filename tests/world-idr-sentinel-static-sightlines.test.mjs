// World Department 9 — IDR #655 static authoring evidence ONLY.
// No identity, witnessing, liveness, authoritative LOS or NPC spawning.
import test from "node:test";
import assert from "node:assert/strict";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {
  WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS,
  WORLD_ALPHA_SOLIDS_LAYOUT_ID,
} from "../src/world/alpha-solid-geometry.mjs";
import {WORLD_ALPHA_SPAWN_COORDINATES,WORLD_ALPHA_SWORD_RACK_SOCKETS}
  from "../src/world/alpha-armory.mjs";

const solids=WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS;
const radius=18,staticProbeRadius=0.25;
const point=(x,y)=>Object.freeze({x,y});
const witness=point(3908,4072); // proposed stationary Sentinel, OFF by default
const hiddenNorth=point(3800,3810); // north of the ORIGINAL Smith solid
const distant=point(4250,4260); // possible off-route Sentinel, NOT SPAWNED
const subject=point(3860,4068); // nominal World #639 closer sword approach
const closeCornerEast=point(3911,3992),closeCornerSouth=point(3872,4031);

// Exact original 23 authored AABBs; swept AABB check deliberately
// conservative. Positive static ray DOES NOT certify complete Physics LOS.
function hitsStatic(a,b,r){
  return solids.some(s=>{
    let enter=0,leave=1;
    for(const [axis,low,high] of [
      ["x",s.min_x-r,s.max_x+r],["y",s.min_y-r,s.max_y+r],
    ]){
      const d=b[axis]-a[axis];
      if(d===0){if(a[axis]<low||a[axis]>high)return false;continue;}
      const t0=(low-a[axis])/d,t1=(high-a[axis])/d;
      enter=Math.max(enter,Math.min(t0,t1));
      leave=Math.min(leave,Math.max(t0,t1));
      if(enter>leave)return false;
    }
    return enter<=leave;
  });
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function distancePointToSegment(p,a,b){
  const vx=b.x-a.x,vy=b.y-a.y;
  const den=vx*vx+vy*vy;
  if(den===0)return distance(p,a);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/den));
  return Math.hypot(p.x-(a.x+vx*t),p.y-(a.y+vy*t));
}

test("IDR World review preserves original immutable Greyhaven source/zone and safe proposed anchor points",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  assert.equal(map?.id,"moonvale-overworld");
  assert.equal(map?.city?.id,"greyhaven");
  assert.equal(WORLD_ALPHA_SOLIDS_LAYOUT_ID,"moonvale-greyhaven-v10-solids-v1");
  assert.equal(solids.length,23);
  assert.equal(map.buildings.length,15);
  assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>[s.x,s.y]),
    [[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
  for(const [name,p] of Object.entries({witness,hiddenNorth,distant,subject,
    closeCornerEast,closeCornerSouth})){
    assert.ok(p.x-radius>=map.city.x&&p.x+radius<=map.city.x+map.city.w&&
      p.y-radius>=map.city.y&&p.y+radius<=map.city.y+map.city.h,name+" outside city");
    assert.equal(hitsStatic(p,p,radius),false,name+" overlaps an original solid");
  }
});

test("IDR World static LOS has near-positive and named-Smith through-wall negative",()=>{
  const smith=solids.find(s=>s.id==="building:smith");
  assert.ok(smith);
  assert.deepEqual([smith.min_x,smith.min_y,smith.max_x,smith.max_y],
    [3710,3850,3892,4012]);
  assert.ok(distance(witness,subject)<56);
  assert.equal(hitsStatic(witness,subject,staticProbeRadius),false,
    "southern Blacksmith witness must have positive static LOS");
  assert.equal(hitsStatic(hiddenNorth,subject,staticProbeRadius),true,
    "north-side observer must NOT see through the original Smith building");
  // Real actor centers can each be unblocked and within nominal 56 range,
  // yet a corner's 1-unit solid sliver occludes their line of sight.
  const closeReach=distance(closeCornerEast,closeCornerSouth);
  assert.ok(closeReach>radius*2&&closeReach<56);
  assert.equal(hitsStatic(closeCornerEast,closeCornerSouth,staticProbeRadius),true,
    "range alone cannot override static occlusion, even near a corner");
  assert.equal(hitsStatic(closeCornerSouth,closeCornerEast,staticProbeRadius),true);
});

test("IDR Sentinel review points do not obstruct exact four P0 west-first corridors at nominal positions",()=>{
  const anchors=[witness,hiddenNorth,distant];
  assert.deepEqual(WORLD_ALPHA_SPAWN_COORDINATES.map(s=>[s.x,s.y]),
    [[4110,4160],[4206,4160],[4110,4256],[4206,4256]]);
  for(const [i,socket] of WORLD_ALPHA_SWORD_RACK_SOCKETS.entries()){
    const start=WORLD_ALPHA_SPAWN_COORDINATES[i];
    const west=point(socket.x,start.y);
    const oldStand=socket.approach;
    const candidate=point(socket.x,4068);
    for(const [a,b] of [[start,west],[west,oldStand],[oldStand,candidate]]){
      assert.equal(hitsStatic(a,b,radius),false,
        "original World radius18 corridor obstructed at socket "+(i+1));
      for(const [j,anchor] of anchors.entries()){
        const d=distancePointToSegment(anchor,a,b);
        assert.ok(d>2*radius,
          "optional Sentinel "+j+" would nominally obstruct P0 route "+(i+1)+", distance "+d);
      }
    }
  }
  // These are measured *positions* only. Core8C must still enforce dynamic
  // occupancy, NPC movement, liveness, zone/epoch and complete same-tick LOS.
});
