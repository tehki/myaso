import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const rel="assets/environment/greyhaven/armory-p0/four-silver-review/";
const read=p=>readFileSync(new URL(p,root));
const proof=JSON.parse(read(rel+"armory_four_original_silvers_source_report.json").toString("utf8"));
test("P0 four illustrative Silver players use unchanged genuine 3A and World #521 original source, not T1 remote NPC",()=>{
 assert.equal(proof.sourceHeads.world,"3178b9aad8757ceb3594ff04b9e3099dced6b729");
 assert.equal(proof.sourceHeads.knight,"c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(proof.sourceHeads.graphicsAncestor,"755b778cdc328b5ffc3a676824c03d6a1b75a2c9");
 assert.equal(proof.originalSourceHashes["/__knight326__/web/assets/knights/silver_idle.webp"],
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.equal(proof.originalSourceHashes["/__knight326__/web/knight-sprites.mjs"],
  "1a3489220df7fbfa614f986148915e1a89e26a3e215f204386a49b77fa53c4cd");
 assert.equal(proof.originalSourceHashes["/__knight326__/src/browser/combat-readability.mjs"],
  "8d868c947fdfe9dc73488819448909c85f1fcbd86c74024931527146cbf4390c");
 assert.equal(proof.originalSourceHashes["/__knight326__/src/combat/model.mjs"],
  "881e01d92a47665a08ba76521e7c615ef4b21de47b28335dcd88ade62d359d01");
 assert.equal(proof.originalSourceHashes["/__world521__/src/world/alpha-armory.mjs"],
  "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf");
 assert.equal(proof.originalSourceHashes["/__world521__/src/browser/authored-world-renderer.mjs"],
  "2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a");
 assert.equal(proof.browsers.length,2);
});

test("P0 original 120% Silver idle at four World approach stands has measured 51 pairwise silhouette pixels, zero sword occlusion in both native browsers",()=>{
 for(const engine of ["chrome","firefox"]){
  const browser=proof.browsers.find(x=>x.engine===engine);
  assert.ok(browser);
  assert.match(browser.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(browser.errors,[]);
  const d=browser.sourceOutput;
  assert.equal(d.ready,true);
  assert.equal(d.actualSourceWorldRenderer,true);
  assert.equal(d.originalSourceSilverAtlas,true);
  assert.equal(d.originalBlenderSwords,true);
  assert.equal(d.sourceKnightScale,1.2);
  assert.equal(d.sourceKnightsCount,4);
  assert.equal(d.sourceSwordCount,4);
  assert.equal(d.worldTilesCached,6);
  assert.deepEqual(d.actualWorldApproaches,[
   [3740,4088],[3780,4088],[3820,4088],[3860,4088]
  ]);
  assert.equal(d.silverPairIntersections.length,6);
  assert.deepEqual(d.silverPairIntersections.map(x=>x.opaqueOverlapPixels),[18,0,0,16,0,17]);
  assert.equal(d.totalPairwiseSilverOpaqueOverlapPixels,51);
  assert.deepEqual(d.swordVisibility.map(x=>x.sourceCandidateAlphaPixels),
   [1019,1007,1004,1031]);
  assert.deepEqual(d.swordVisibility.map(x=>x.obscuredByAnySilverOpaquePixels),
   [0,0,0,0]);
  assert.ok(d.swordVisibility.every(x=>x.stillUnobscuredCandidatePixels>1000));
  assert.equal(d.swordUiPointerArbitrationIntegrated,false);
  assert.equal(d.serverPlayersAuthenticated,false);
  assert.equal(d.serverItemPresenceAuthenticated,false);
  assert.equal(d.realFourPlayerGameplay,false);
  assert.equal(d.productionApproved,false);
  const png=read(rel+browser.screenshot);
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),1120);
  assert.ok(png.length>50000);
  assert.equal(browser.actualGameplayActors,false);
  assert.equal(browser.actualGameplayPickup,false);
  assert.equal(browser.playerToSwordHitPriorityApproved,false);
 }
});

test("P0 static Silver + sword visual preview cannot be mistaken for live connected multiplayer proof",()=>{
 assert.equal(proof.realFourPlayersConnected,false);
 assert.equal(proof.realGameInput,false);
 assert.equal(proof.gameplayOcclusionResolved,false);
 assert.equal(proof.productionApproved,false);
 const review=read("web/armory-p0-four-silver-visual.mjs").toString("utf8");
 const runner=read("tools/art/verify_armory_four_silver_actors.mjs").toString("utf8");
 const html=read("web/armory-p0-four-silver-visual.html").toString("utf8");
 assert.match(review,/from "\/__knight326__\/web\/knight-sprites\.mjs"/);
 assert.match(review,/KNIGHT_PRESENTATION_SCALE/);
 assert.match(review,/projectArenaPoint/);
 assert.match(review,/paintArmoryRackPresentedFrame/);
 assert.match(review,/ART-ONLY-NO-SERVER/);
 assert.doesNotMatch(review,/t1_walk\.webp|WebSocket|TryPickup|XMLHttpRequest/);
 assert.match(html,/NOT four connected real players/);
 assert.match(runner,/--disable-gpu-sandbox/);
 assert.match(runner,/webDriverBiDi/);
 assert.match(runner,/127\.0\.0\.1/);
 assert.doesNotMatch(read("web/online-game.mjs").toString("utf8"),/armory-p0-four-silver-visual/);
});
