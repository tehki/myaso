import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const base=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,base));
const digest=p=>createHash("sha256").update(read(p)).digest("hex");
const report=json("assets/environment/greyhaven/armory-p0/world-ui-review/armory_p0_world493_ui503_native_report.json");
function json(p){return JSON.parse(read(p).toString("utf8"));}
const artifactPrefix="assets/environment/greyhaven/armory-p0/world-ui-review/";

test("P0 three-source native review pins actual World and hardened UI heads, not locally imitated gesture code",()=>{
 assert.equal(report.sourceHeads.world,"07060f981b8a1dac89184b621b6893dd970a08ae");
 assert.equal(report.sourceHeads.ui,"8d500d8ddeb4058f15dbc704bf78d685d1ca31ef");
 assert.equal(report.sourceHeads.graphicsParent,"2a11b923591a682bbae3cffe6d9f70b0d2036de8");
 assert.equal(report.allSourcesUnchanged,true);
 assert.deepEqual(report.externalSourceHashes,{
  "/__world493__/src/world/alpha-armory.mjs":"305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf",
  "/__world493__/src/world/authored-maps.mjs":"21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144",
  "/__world493__/src/browser/authored-world-renderer.mjs":"db5274b9ad3ea8e28f4a2ef44358cfed247d0625785dc353577a3ee6d136f9e9",
  "/__ui503__/src/browser/alpha-sword-gesture.mjs":"a8b6a85fe17b1cab6ab1f2033002c1fb0526b287fb81a234264df1cb288b081c",
  "/__ui503__/src/browser/sword-canvas-pointer.mjs":"cc4b60779cc744a66ccf4ca20be1b6243c8ee935a86a795ed425c3b6f796efd6"
 });
 for(const [path,sha] of Object.entries(report.graphicsSourceHashes))
  assert.equal(digest(path),sha);
});

test("P0 strict Chrome/Firefox native W3C pointer events + actual WebP alpha and stale interaction rules",()=>{
 assert.equal(report.screenshots,4);
 assert.equal(report.browserResults.length,2);
 for(const engine of ["chrome","firefox"]){
  const e=report.browserResults.find(x=>x.engine===engine);
  assert.ok(e);
  assert.match(e.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(e.errors,[]);
  assert.deepEqual(e.initial.sourceWorldSocketPositions,[
   [3740,4038],[3780,4038],[3820,4038],[3860,4038]
  ]);
  assert.equal(e.initial.swordCount,4);
  assert.equal(e.initial.originalWorldImported,true);
  assert.equal(e.initial.originalUiGestureImported,true);
  assert.equal(e.initial.serverAuthenticatedItems,false);
  assert.equal(e.afterOpaque.combatFallback,0);
  assert.deepEqual(e.afterOpaque.visualIntents,["ART-ONLY-NO-SERVER-0"]);
  assert.equal(e.afterClear.combatFallback,1);
  assert.equal(e.afterClear.visualIntents.length,1);
  assert.equal(e.afterDrag.cancelled,1);
  assert.equal(e.afterDrag.combatFallback,1);
  assert.equal(e.afterRevision.cancelled,2);
  assert.equal(e.afterItemRemoval.cancelled,3);
  assert.equal(e.afterItemRemoval.swordCount,3);
  assert.deepEqual(e.afterDpr2.visualIntents,[
   "ART-ONLY-NO-SERVER-0","ART-ONLY-NO-SERVER-0"
  ]);
  assert.equal(e.afterDpr2.cancelled,3);
  assert.equal(e.afterDpr2.combatFallback,1);
  assert.equal(e.deviceScaleFactor,2);
  assert.ok(e.cssCanvasWidth<=390);
  assert.equal(e.realInputEvents,12);
  assert.ok(e.afterDpr2.browserPointerEvents.every(x=>/^(down|up):mouse:/.test(x)));
  for(const field of ["outside","mismatch","transparent","frame"])
   assert.deepEqual(e.adversarial[field],{handled:false,itemId:null});
  assert.equal(e.adversarial.sourceTransparentAlpha,0);
  assert.equal(e.genuineGameCombat,false);
  assert.equal(e.serverNetworkMessages,0);
  assert.equal(e.authoritativeItemOwnership,false);
  assert.equal(e.productionApproved,false);
  for(const imageName of e.screenshots){
   const image=read(artifactPrefix+imageName);
   assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok([1140,780].includes(image.readUInt32BE(16)));
   assert.ok(image.length>45000);
  }
 }
});

test("P0 reviewer is opt-in; never creates a second Combat LMB handler, item writer or live game linkage",()=>{
 for(const k of ["realGameClientExecuted","realServerTryPickup",
 "combatHandlerExecuted","productionApproved"])assert.equal(report[k],false);
 assert.equal(report.realMultiplayerUsers,0);
 const src=read("web/armory-p0-world493-ui-review.mjs").toString("utf8");
 const tool=read("tools/art/verify_armory_world493_ui503.mjs").toString("utf8");
 assert.match(src,/from "\/__ui503__\/src\/browser\/alpha-sword-gesture\.mjs"/);
 assert.match(src,/from "\/__ui503__\/src\/browser\/sword-canvas-pointer\.mjs"/);
 assert.match(src,/createWorld493RackArtPlan/);
 assert.match(src,/ART-ONLY-NO-SERVER/);
 assert.match(src,/combatHandlerActuallyCalled:false/);
 assert.doesNotMatch(src,/WebSocket|TryPickup|localStorage|XMLHttpRequest/);
 assert.match(tool,/merge-base/);
 assert.match(tool,/readHash/);
 assert.match(tool,/127\.0\.0\.1/);
 assert.match(tool,/webDriverBiDi/);
 assert.doesNotMatch(read("web/online-game.mjs").toString("utf8"),/armory-p0-world493-ui-review/);
});
