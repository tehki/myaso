import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GREYHAVEN_ALPHA_FOUNDATION as a,validateGreyhavenAlphaFoundation}
  from "../src/world/greyhaven-alpha-foundation.mjs";
import {WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS as solids}
  from "../src/world/alpha-solid-geometry.mjs";

function blocked(start,end,radius=18){
  return solids.some(s=>{
    let lo=0,hi=1;
    for(const [axis,min,max] of [["x",s.min_x-radius,s.max_x+radius],
                                  ["y",s.min_y-radius,s.max_y+radius]]){
      const delta=end[axis]-start[axis];
      if(delta===0){if(start[axis]<min||start[axis]>max)return false;continue;}
      const p=(min-start[axis])/delta,q=(max-start[axis])/delta;
      lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
      if(lo>hi)return false;
    }
    return lo<=hi;
  });
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test("one canonical original World9 Greyhaven Red Lion/Smith and visual-only portal",()=>{
  const {map,lion,smith,view}=validateGreyhavenAlphaFoundation();
  assert.equal(a.mapId,map.id);assert.equal(a.staticLayoutId,"moonvale-greyhaven-v10-solids-v1");
  assert.deepEqual(a.spawns[0],map.spawn);
  assert.deepEqual(a.landmarks.redLionDoor,lion.entrance);
  assert.equal(view.visualDepthY,4075);assert.equal(view.interactionPortal.y,4075);
  assert.equal(smith.entrance,undefined);
  assert.equal(a.hasPortalAuthority,false);assert.equal(a.hasItemAuthority,false);
  assert.equal(a.serverStaticCollisionMode,"explicit-loopback-only-opt-in");
  assert.equal(a.serverStaticCollisionActiveByDefault,false);
});
test("four original Rust spawns and the authored landmark promenade are clear of ALL 23 pinned solids",()=>{
  assert.equal(a.spawns.length,4);
  for(const s of a.spawns)assert.equal(blocked(s,s),false,"spawn intersects static AABB");
  for(let i=0;i<a.spawns.length;i++)for(let j=i+1;j<a.spawns.length;j++)
    assert.ok(distance(a.spawns[i],a.spawns[j])>=36);
  for(let i=1;i<a.route.length;i++)
    assert.equal(blocked(a.route[i-1],a.route[i]),false,"static world route segment "+i);
  for(const [label,p] of Object.entries(a.landmarks)){
    if(label==="redLionDoor")continue; // door visual anchor is NOT physical actor stand
    assert.equal(blocked(p,p),false,label+" obstructed");
  }
  assert.ok(distance(a.landmarks.redLionDoor,a.landmarks.redLionWalkableApproach)<=24);
  assert.equal(blocked(a.landmarks.redLionDoor,a.landmarks.redLionDoor),true,
    "original Red Lion door anchor is inside 18-radius collider clearance; never teleport there");
});
test("source opt-in is gated in BOTH original Rust admission and actual browser; no protocol change",()=>{
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const rust=readFileSync(new URL("../server/src/greyhaven_alpha.rs",import.meta.url),"utf8");
  assert.match(server,/MYASO_WORLD9_GREYHAVEN_ALPHA/);
  assert.match(server,/bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(server,/greyhaven_alpha::free_spawn\(&state\.world\)/);
  assert.match(server,/configure_greyhaven_alpha_runtime\(&mut state\.world, greyhaven_alpha\)/);
  assert.match(server,/world\.enable_greyhaven_static_collisions\(\)/);
  assert.match(server,/state\.world\.add_player_at\(player_id, x, y, 0\.0\)/);
  assert.match(server,/state\.world\.add_player\(player_id\)/);
  assert.match(browser,/params\.get\("world"\) === "1"/);
  assert.match(browser,/params\.get\("greyhaven"\) === "1"/);
  assert.match(browser,/!params\.has\("scenario"\)/);
  assert.match(browser,/new URL\(params\.get\("server"\)\)\.hostname/);
  assert.match(browser,/greyhavenPreview\.renderer\.draw\(ctx/);
  assert.match(browser,/greyhavenPreview = null;/);
  assert.match(browser,/__MYASO_WORLD9_ALPHA_REVIEW__/);
  assert.match(browser,/networkClient.state.values\(\)/);
  assert.match(rust,/pub fn free_spawn\(world: &World\)/);
  // No new packet format, synthetic actor position, item or combat.
  assert.doesNotMatch(browser,/local\.[xy]\s*=\s*greyhaven/i);
});
