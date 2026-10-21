import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadOriginalBlacksmithRackPreview} from "../src/browser/armory-optin-live-rack.mjs";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS,validateWorldAlphaArmoryLayout} from "../src/world/alpha-armory.mjs";
import {nextNativeWalkPulse,nativeRackArrived} from "../scripts/alpha_p0_rack_walk_math.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const canvas=()=>({
 width:0,height:0,getContext:()=>({
  drawImage(){},
  getImageData(){
   const d=new Uint8ClampedArray(42*115*4);
   for(let y=8;y<=92;y++)for(let x=10;x<=30;x++)d[(y*42+x)*4+3]=255;
   return {data:d};
  }
 })
});
const drawCtx=()=>({drawImage(){},save(){},restore(){}});
const load=async src=>{
 const sword=src.endsWith("armory_sword.webp");
 return {complete:true,naturalWidth:sword?42:240,naturalHeight:sword?115:166,
  currentSrc:"http://localhost"+src};
};

test("P0 authoritative World #521 has four independent 50-unit south physical source approaches, no invented stations",()=>{
 assert.equal(validateWorldAlphaArmoryLayout(),true);
 assert.equal(WORLD_ALPHA_SWORD_RACK_SOCKETS.length,4);
 assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>s.approach),
  [{x:3740,y:4088},{x:3780,y:4088},{x:3820,y:4088},{x:3860,y:4088}]);
 assert.ok(WORLD_ALPHA_SWORD_RACK_SOCKETS.every(s=>s.approach.x===s.x&&s.approach.y-s.y===50));
});
test("P0 source-projected 240x166 real Blender rack is entirely within each of four game camera views at original World approach",async()=>{
 const review=await loadOriginalBlacksmithRackPreview({imageLoader:load,alphaCanvasFactory:canvas});
 for(const slot of WORLD_ALPHA_SWORD_RACK_SOCKETS){
  const s=review.draw({ctx:drawCtx(),camera:slot.approach,width:640,height:640,zoom:.84});
  assert.equal(s.drawnRackCount,1);
  assert.equal(s.drawnSwordCount,0);
  assert.equal(s.originalWorldSockets,4);
  assert.equal(s.rackFullyWithinViewport,true);
  assert.equal(s.rackIntersectsViewport,true);
  assert.ok(s.rackScreenRect.x>=0&&s.rackScreenRect.x+s.rackScreenRect.width<=640);
  assert.ok(s.rackScreenRect.y>=0&&s.rackScreenRect.y+s.rackScreenRect.height<=640);
  assert.equal(s.rackScreenRect.width,240);
  assert.equal(s.rackScreenRect.height,166);
  assert.equal(s.canonicalItemFeedConnected,false);
 }
 const far=review.draw({ctx:drawCtx(),camera:{x:6000,y:6000},width:640,height:640,zoom:.84});
 assert.equal(far.rackIntersectsViewport,false);
 assert.equal(far.rackFullyWithinViewport,false);
});
test("P0 reuse exact Core8A pure bounded west-first rack walk math without client moving authoritative actor state",()=>{
 assert.equal(nextNativeWalkPulse(4000,3800).key,"negative");
 assert.ok(nextNativeWalkPulse(4000,3800).holdMs<=550);
 assert.equal(nextNativeWalkPulse(3790,3800).done,true);
 assert.equal(nativeRackArrived({x:3744,y:4084},{x:3740,y:4088}),true);
 assert.equal(nativeRackArrived({x:3914,y:4020},{x:3860,y:4088}),false);
});
test("P0 true four-browser route waits for independently observed real replicated Rust coordinates and original projected rack",()=>{
 const script=read("scripts/alpha_p0_four_native_rack_at_approaches.mjs");
 assert.match(script,/WORLD_ALPHA_SWORD_RACK_SOCKETS/);
 assert.match(script,/nextNativeWalkPulse/);
 assert.match(script,/nativeRackArrived/);
 assert.match(script,/realW3cPulse/);
 assert.match(script,/GRAPHICS3B_P0_AUTHENTIC_W3C_BROWSER_STARTED/);
 assert.match(script,/65000/);
 assert.match(script,/realW3cWalkAxis/);
 assert.match(script,/w3cVerticalPulses/);
 assert.match(script,/originalWorldApproach:slot\.approach/);
 assert.match(script,/rackFullyWithinViewport===true/);
 assert.match(script,/fourServerFighters\(v\)/);
 assert.match(script,/observedReplicatedFighters/);
 assert.match(script,/W3C.*keyUp|keyUp.*W3C|type:"keyUp"/);
 assert.match(script,/GRAPHICS3B_P0_FOUR_REAL_RENDERED_RACK_APPROACH_PASS/);
 assert.doesNotMatch(script,/mockServer|fakeServer|setPlayerPosition|teleport|ART-ONLY-NO-SERVER|\bTryPickup\s*\(/);
 const client=read("web/online-game.mjs");
 assert.match(client,/observedReplicatedFighters:networkClient\?\.state/);
 assert.match(client,/rackFullyWithinViewport:armoryRackReview\?\.status/);
 assert.match(client,/params\.get\("armoryart"\) === "1"/);
 assert.match(client,/localhost","127\.0\.0\.1"/);
});
test("P0 strict separate CI does not change generic four-browser, combat, default game or trust source",()=>{
 const workflow=read(".github/workflows/graphics3b-p0-real-rack-approaches.yml");
 assert.match(workflow,/node scripts\/alpha_p0_four_native_rack_at_approaches\.mjs/);
 assert.match(workflow,/cargo build --locked --manifest-path server\/Cargo\.toml --bin myaso-server/);
 assert.match(workflow,/node --test tests\/armory-optin-live-rack\.test\.mjs/);
 assert.doesNotMatch(workflow,/continue-on-error: true[\s\S]*?name: Four REAL WebDriver/);
 const script=read("scripts/alpha_p0_four_native_rack_at_approaches.mjs");
 assert.match(script,/sourceAuthoredWorldRenderer:true/);
 assert.match(script,/serverTryPickup===false/);
 assert.match(script,/realRustAuthority:true/);
 const original=read("scripts/alpha_p0_four_native_armory_rack_preview.mjs");
 assert.doesNotMatch(original,/fourRealBrowserOriginalRackApproaches/);
});
