import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const base="assets/environment/greyhaven/armory-p0/";
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p).toString("utf8"));
const report=json(base+"armory_p0_native_alpha_browser_report.json");
const proof=json(base+"armory_p0_asset_proof.json");

test("P0 real Chrome/Firefox click separately rendered original sword opaque pixels only",()=>{
 assert.equal(proof.assets.sword.losslessRGBA,true);
 assert.equal(proof.assets.sword.visibleAlphaPixels,1082);
 assert.equal(report.sourceArtBlender,true);
 assert.equal(report.browsers.length,2);
 for(const kind of ["chrome","firefox"]){
  const b=report.browsers.find(x=>x.engine===kind);
  assert.ok(b);
  assert.match(b.version,kind==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(b.errors,[]);
  assert.equal(b.totalDrawn,4);
  assert.deepEqual(b.opaquePixel,{x:19,y:20});
  assert.equal(b.clickedSourceItem,"DEMO-SWORD-NOT-SERVER-0");
  assert.equal(b.transparentClickIgnored,true);
  assert.equal(b.candidateCount,1);
  assert.equal(b.networkPickupEvents,0);
  assert.equal(b.combatAttackEvents,0);
  assert.equal(b.actualServerItemIds,false);
  assert.equal(b.worldSocketCoordinatesApproved,false);
  assert.equal(b.gameRendererIntegrated,false);
  assert.equal(b.productionApproved,false);
  for(const filename of b.screenshots){
   const png=read(base+filename);
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(png.readUInt32BE(16),1160);
   assert.ok(png.length>45000);
  }
 }
});

test("P0 review does not silently claim real four-player authoritative sword pickup",()=>{
 for(const k of ["actualWorldSockets","canonicalItemIdentity","realCoreItemPickup",
  "realCombatInputArbitration","realFourPlayerScene",
  "actualOnlineGameIntegration","productionApproved"])
   assert.equal(report[k],false);
 const viewer=read("web/armory-p0-rack-review.mjs").toString("utf8");
 const html=read("web/armory-p0-rack-review.html").toString("utf8");
 const harness=read("tools/art/verify_armory_p0_browser.mjs").toString("utf8");
 assert.match(viewer,/hitTestVisibleSwordAlpha/);
 assert.match(viewer,/serverPickupCommitted:false/);
 assert.match(viewer,/ART-ONLY-NO-APPROVAL/);
 assert.match(html,/NO SERVER · NO WORLD SOCKETS APPROVED/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/webDriverBiDi/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest|TryPickup/);
 assert.doesNotMatch(read("web/online-game.mjs").toString("utf8"),/armory-rack-visual/);
});
