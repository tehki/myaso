import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
const root=new URL("../",import.meta.url);
const prefix="assets/environment/greyhaven/armory-p0/world521-review/";
const read=path=>readFileSync(new URL(path,root));
const report=JSON.parse(read(prefix+"armory_p0_world521_ui503_native_report.json").toString("utf8"));
const world={
 "src/world/alpha-solid-geometry.mjs":"e49fe3e3937849f3b46c5539ab0361025fc510db201695a7dbaaad69bf895ddf",
 "assets/world/greyhaven-alpha-solids-v1.json":"186c9f6966749f25c26840dd26bd53771daf677ffe486702afcaa4a054482ebe"
};
test("P0 integrated World #521 source checkout, original 3B Blender+UI code head checks remain exact",()=>{
 assert.equal(report.consolidatedWorld521Candidate,true);
 assert.equal(report.sourceHeads.world,"3178b9aad8757ceb3594ff04b9e3099dced6b729");
 assert.equal(report.sourceHeads.ui,"8d500d8ddeb4058f15dbc704bf78d685d1ca31ef");
 assert.equal(report.sourceHeads.graphicsParent,"2a11b923591a682bbae3cffe6d9f70b0d2036de8");
 assert.equal(report.allSourcesUnchanged,true);
 assert.deepEqual(report.consolidatedSourceHashes,world);
 assert.equal(report.externalSourceHashes["/__world493__/src/world/alpha-armory.mjs"],
  "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf");
 assert.equal(report.externalSourceHashes["/__world493__/src/world/authored-maps.mjs"],
  "21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144");
 assert.equal(report.externalSourceHashes["/__world493__/src/browser/authored-world-renderer.mjs"],
  "2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a");
 assert.equal(report.externalSourceHashes["/__world493__/src/world/building-presentation.mjs"],
  "c2e2ad0350fbc5d0c8408a48a151c280b4cc85500c53f4b8e705b21e97147e33");
 assert.equal(report.externalSourceHashes["/__ui503__/src/browser/alpha-sword-gesture.mjs"],
  "a8b6a85fe17b1cab6ab1f2033002c1fb0526b287fb81a234264df1cb288b081c");
 assert.equal(report.graphicsSourceHashes["assets/environment/greyhaven/armory-p0/armory_sword.webp"],
  ARMORY_RACK_ART.swordSha256);
 assert.equal(report.graphicsSourceHashes["assets/environment/greyhaven/armory-p0/armory_rack.webp"],
  ARMORY_RACK_ART.rackSha256);
});

test("P0 real Chrome + Firefox World #521 preserve Blacksmith while opt-in Red Lion placeholder changes",()=>{
 assert.equal(report.browserResults.length,2);
 assert.equal(report.screenshots,4);
 for(const engine of ["chrome","firefox"]){
  const b=report.browserResults.find(x=>x.engine===engine);
  assert.ok(b);
  assert.match(b.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(b.errors,[]);
  assert.equal(b.initial.worldHead,report.sourceHeads.world);
  assert.deepEqual(b.initial.sourceWorldSocketPositions,[[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
  assert.equal(b.initial.originalWorldImported,true);
  assert.equal(b.initial.originalUiGestureImported,true);
  assert.equal(b.initial.sourcePaintCompleted,true);
  assert.equal(b.initial.drawnRackCount,1);
  assert.equal(b.initial.drawnSwordCount,4);
  assert.equal(b.initial.swordCount,4);
  const w=b.world521BuildingPresentationCheck;
  assert.ok(w);
  assert.equal(w.smithReplacementForbidden,true);
  assert.ok(w.redLionVisibleDifferencePixels>10000);
  assert.equal(w.blacksmithPixelsChangedByRedLionReplacement,0);
  assert.equal(w.observedGameRendererIntegration,false);
  assert.equal(w.productionApproved,false);
  assert.equal(b.maskOverlap.maxOverlap,0);
  assert.equal(b.allSwordClicks.length,8);
  for(const mode of ["scaled-dpr2","desktop"]){
   assert.deepEqual(b.allSwordClicks.filter(x=>x.mode===mode).map(x=>x.itemId),
    ["ART-ONLY-NO-SERVER-0","ART-ONLY-NO-SERVER-1",
      "ART-ONLY-NO-SERVER-2","ART-ONLY-NO-SERVER-3"]);
  }
  assert.equal(b.afterAllFourSourcePixelClicks.visualIntents.length,10);
  assert.equal(b.afterAllFourSourcePixelClicks.combatFallback,1);
  assert.equal(b.afterAllFourSourcePixelClicks.cancelled,3);
  assert.equal(b.afterAllFourSourcePixelClicks.actualServerEvents,0);
  assert.equal(b.afterAllFourSourcePixelClicks.combatHandlerActuallyCalled,false);
  for(const file of b.screenshots){
   assert.match(file,/world521/);
   const png=read(prefix+file);
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok(png.length>45000);
  }
 }
});

test("P0 consolidated World/UI/browser proof is explicitly NOT real server geometry, clients, Combat or equip",()=>{
 assert.equal(report.realGameClientExecuted,false);
 assert.equal(report.realMultiplayerUsers,0);
 assert.equal(report.realServerTryPickup,false);
 assert.equal(report.combatHandlerExecuted,false);
 assert.equal(report.productionApproved,false);
 const web=read("web/armory-p0-world493-ui-review.mjs").toString("utf8");
 const runner=read("tools/art/verify_armory_world493_ui503.mjs").toString("utf8");
 assert.match(web,/__expectedPinnedWorldHead/);
 assert.match(web,/paintArmoryRackPresentedFrame/);
 assert.match(runner,/Only two explicitly reviewed original World source heads permitted/);
 assert.match(runner,/consolidatedWorld521Candidate/);
 assert.match(runner,/smithReplacementForbidden/);
 assert.match(runner,/blacksmithPixelsChangedByRedLionReplacement/);
 assert.doesNotMatch(web,/WebSocket|TryPickup|XMLHttpRequest/);
 assert.doesNotMatch(read("web/online-game.mjs").toString("utf8"),/paintArmoryRackPresentedFrame/);
});
