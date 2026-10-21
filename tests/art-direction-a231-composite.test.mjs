import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const root=new URL("../",import.meta.url);
const asset="assets/environment/greyhaven/";
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p).toString("utf8"));
const sha=p=>createHash("sha256").update(read(p)).digest("hex");
const plan=json(asset+"a231-review/greyhaven_a231_lighting_handoff.json");
const browsers=json(asset+"a231-review/greyhaven_a231_native_composite_report.json");
const a230=json(asset+"a230-review/greyhaven_a230_material_validation.json");
const a226=json(asset+"a226-review/greyhaven_a226_weathering_report.json");

test("A2.31 owner-required precise 3B door vs authored World/3C lantern handoff",()=>{
 assert.deepEqual(plan.building,{id:"red-lion",x:4240,y:3880,w:250,h:170,
  authoredWorldEntrance:[4365,4060],visualArtDoor:[4365,4075]});
 assert.deepEqual(plan.graphics3C.fixtureWorldXY,[4365,4045]);
 assert.deepEqual(plan.graphics3C.poolWorldXY,[4365,4069]);
 assert.equal(plan.graphics3C.radiusWorldUnits,108);
 assert.equal(plan.graphics3C.chunkWorldUnits,512);
 assert.equal(plan.graphics3C.lightingPlanVersion,"3c-p24-1");
 assert.equal(plan.graphics3C.sourceHead,browsers.sources.c3);
 assert.equal(ARENA_VIEW_ZOOM,.84);
 assert.deepEqual(plan.material.croppedPixels,[228,297]);
 assert.deepEqual(plan.material.drawOffsetFromDoorPixels,[-114,-269]);
 const d=projectArenaPoint(4365,4045,4365,4075,640,640);
 assert.equal(d.x,320);
 assert.equal(d.y,294.8);
 assert.equal(plan.dynamicDayNightProtocol,false);
 assert.equal(plan.actualWorldRendererIntegrated,false);
 assert.equal(plan.serverPortalOrCollisionChanged,false);
 assert.equal(plan.approvedForProduction,false);
});

test("A2.31 one actual 3C outdoor radial source, no duplicated 3B radial facade halo",()=>{
 const m=plan.material;
 assert.equal(m.extraRadialFacadeGlow,false);
 assert.equal(m.duskWindowGlowIsBoundedToGlass,true);
 assert.equal(m.alphaIdenticalBetweenDayDusk,true);
 assert.equal(m.apertures.length,2);
 for(const ap of m.apertures){
  assert.ok(ap.roi[0]>=245&&ap.roi[2]<=388);
  assert.ok(ap.roi[1]>=255&&ap.roi[3]<=285);
 }
 assert.equal(sha(asset+"a231-review/"+m.day.file),m.day.sha256);
 assert.equal(sha(asset+"a231-review/"+m.dusk.file),m.dusk.sha256);
 assert.notEqual(m.day.sha256,m.dusk.sha256);
 assert.equal(m.day.sha256,a230.baseWebp.sha256);
 assert.equal(m.roof.sha256,a226.newRoofSha256);
 assert.deepEqual(read(asset+"a231-review/"+m.roof.file),
  read(asset+"a230-review/red_lion_a230_roof_unchanged.webp"));
 assert.equal(sha(asset+"a231-review/"+m.roof.file),m.roof.sha256);
 assert.equal(m.roofByteIdenticalToA226,true);
 const painter=read("tools/art/build_red_lion_a231_facade_material.py").toString("utf8");
 assert.match(painter,/putalpha\(base\.getchannel\("A"\)\)/);
 assert.doesNotMatch(painter,/GaussianBlur|ImageFilter\.GaussianBlur|bpy\.ops\.wm\.save/);
});

test("A2.31 Art Director A2.30 alpha risk is quantified and inspectable",()=>{
 const risk=plan.a230AlphaRisk;
 assert.equal(risk.changedPixels,69);
 assert.equal(risk.addedFromFullyTransparent,51);
 assert.equal(risk.removedToFullyTransparent,0);
 assert.equal(risk.partiallyChanged,18);
 assert.equal(risk.fullChangedPixelCoordinates.length,69);
 assert.equal(new Set(risk.fullChangedPixelCoordinates.map(v=>v.join(","))).size,69);
 assert.equal(risk.overallBoundsUnchanged,true);
 const overlay=read(asset+"a231-review/"+risk.overlay);
 assert.ok(overlay.length>40000);
 assert.equal(overlay.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(overlay.readUInt32BE(16),1300);
 assert.equal(overlay.readUInt32BE(20),690);
 // No claim that 69 edge differences are automatically collision-safe.
 assert.equal(browsers.liveCombatOcclusionValidated,false);
});

test("A2.31 genuine pinned 3C + authentic 3A character and local source composition",()=>{
 assert.equal(browsers.sources.c3,"8e85584b6007b38e1a00155b77473e92b0afec6a");
 assert.equal(browsers.sources.knights,"c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(browsers.sources.adults,"91f1c2c4737b8f0275bb22bfbca4acc1501daa00");
 assert.equal(Object.keys(browsers.sourceJsHashes).length,2);
 assert.equal(browsers.staticThreeCLightingFromSource,true);
 assert.equal(browsers.originalKnightAuthentic,true);
 assert.equal(browsers.adultPreviewStillDraft,true);
 assert.equal(browsers.screenshots,6);
 assert.equal(browsers.reviews.length,2);
 for(const engine of ["chrome","firefox"]){
  const r=browsers.reviews.find(x=>x.engine===engine);
  assert.ok(r);
  assert.match(r.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.equal(r.captures.length,3);
  assert.deepEqual(r.errors,[]);
  assert.equal(r.cameraSamples,40);
  for(const metric of ["p50CanvasDayMs","p95CanvasDayMs","p50CanvasDuskMs","p95CanvasDuskMs"]){
   assert.ok(Number.isFinite(r[metric])&&r[metric]>=0&&r[metric]<500);
  }
  assert.equal(r.coldChunksMs.length,2);
  for(const c of r.captures){
   const s=c.state;
   assert.equal(s.ready,true);
   assert.equal(s.redLion3CLightCount,1);
   assert.equal(s.single3CSourceVersion,plan.graphics3C.lightingPlanVersion);
   assert.equal(s.facade3BApertureNoRadialGlow,true);
   assert.deepEqual(s.fixtureWorldXY,[4365,4045]);
   assert.deepEqual(s.poolWorldXY,[4365,4069]);
   assert.deepEqual(s.artDoor,[4365,4075]);
   assert.deepEqual(s.authoredWorldEntrance,[4365,4060]);
   assert.equal(s.cachedChunks,2);
   assert.equal(s.chunkWorldUnits,512);
   assert.equal(s.alphaHazardPixelCount,69);
   assert.equal(s.source3CHead,browsers.sources.c3);
   assert.equal(s.sourceAdultHead,browsers.sources.adults);
   assert.equal(s.sourceKnightHead,browsers.sources.knights);
   assert.ok(s.playerXYErrorPx<.001);
   assert.equal(s.productionApproved,false);
   assert.equal(s.realGameDrawOrderValidated,false);
   assert.equal(s.serverPortalOrCollisionValidated,false);
   assert.equal(s.liveGameFPSMeasured,false);
   const image=read(asset+"a231-review/"+c.name);
   assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(image.readUInt32BE(16),1420);
   assert.ok(image.length>50000);
  }
  assert.equal(r.actualWorldClientFPSMeasured,false);
  assert.equal(r.networkGameplayValidated,false);
 }
 for(const key of ["worldChunkRendererIntegrated","dynamicDayNightImplemented",
  "fullMultiplayerFPSMeasured","productionApproved","liveCombatOcclusionValidated"])
  assert.equal(browsers[key],false);
 const viewer=read("web/greyhaven-a231-composite-browser.mjs").toString("utf8");
 const harness=read("tools/art/verify_greyhaven_a231_composite.mjs").toString("utf8");
 assert.match(viewer,/paintGreyhavenLightingPools/);
 assert.match(viewer,/paintGreyhavenLightingFixtures/);
 assert.match(viewer,/projectArenaPoint/);
 assert.match(viewer,/__a231_adults__/);
 assert.match(harness,/webDriverBiDi/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
});
