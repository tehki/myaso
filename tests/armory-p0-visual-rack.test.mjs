import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARMORY_RACK_ART,createBlacksmithRackVisualPlan,hitTestVisibleSwordAlpha} from "../src/browser/armory-rack-visual.mjs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p).toString("utf8"));
const digest=p=>createHash("sha256").update(read(p)).digest("hex");
const base="assets/environment/greyhaven/armory-p0/";
const source=json(base+"armory_p0_asset_proof.json");
const building={id:"smith",x:3710,y:3850,w:182,h:162};
const sockets=["W2","W1","E1","E2"].map((id,i)=>({
 id,worldX:4000+(i-1.5)*48,worldY:3956
}));
const rack={buildingId:"smith",version:"art-only-no-world-approval-v0",
 zoneId:"VISUAL-DEMO-ONLY",origin:{x:4000,y:4000},sockets};
const items=sockets.map((v,i)=>({itemId:"ART-DEMO-NO-SERVER-"+i,
 socketId:v.id,visualKind:"sword",location:"rack",zoneId:rack.zoneId,revision:i}));
const create=(overrides={})=>createBlacksmithRackVisualPlan({
 building,rack,committedWorldItems:items,camera:{x:4000,y:4000},...overrides
});

test("P0 source is actual editable Blender rack and separate alpha sword images, not a weapon menu",()=>{
 assert.equal(source.visualOnly,true);
 assert.equal(source.realGameIntegrated,false);
 assert.equal(source.canonicalItemIdsAssigned,false);
 assert.equal(source.socketWorldCoordinatesApproved,false);
 assert.equal(source.productionApproved,false);
 assert.ok(source.sourceScene.rackMeshCount>=20);
 assert.ok(source.sourceScene.swordMeshCount>=5);
 assert.equal(digest(base+source.sourceScene.file),source.sourceScene.sha256);
 assert.ok(read(base+source.sourceScene.file).length>10000);
 assert.equal(ARMORY_RACK_ART.rackSha256,source.assets.rack.sha256);
 assert.equal(ARMORY_RACK_ART.swordSha256,source.assets.sword.sha256);
 for(const [key,size] of [["rack",[240,166]],["sword",[42,115]]]){
  const v=source.assets[key];
  assert.deepEqual(v.pixels,size);
  assert.equal(v.losslessRGBA,true);
  assert.equal(digest(base+v.file),v.sha256);
  assert.equal(digest(base+v.sourcePng),v.sourceSha256);
  assert.ok(v.visibleAlphaPixels>200);
  const png=read(base+v.sourcePng);
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),size[0]);
  assert.equal(png.readUInt32BE(20),size[1]);
 }
 assert.ok(digest(base+source.artOnlyMontage).length===64);
 assert.deepEqual(ARMORY_RACK_ART.authoredBuilding,{x:building.x,y:building.y,w:building.w,h:building.h});
 assert.equal(ARMORY_RACK_ART.actualWorldIntegration,false);
 assert.equal(ARMORY_RACK_ART.productionApproved,false);
});

test("P0 blacksmith rack projectArenaPoint sprites only for passed server-present items",()=>{
 assert.equal(ARENA_VIEW_ZOOM,.84);
 const original=structuredClone(items);
 const p=create();
 assert.equal(p.count,4);
 assert.equal(p.worldSocketCount,4);
 assert.equal(p.rackVersion,rack.version);
 assert.equal(p.zoneId,rack.zoneId);
 assert.equal(p.serverOwnershipUnchanged,true);
 assert.equal(p.canApprovePickup,false);
 assert.equal(p.canSuppressCombat,false);
 assert.equal(p.gameRendererIntegrated,false);
 assert.equal(p.productionApproved,false);
 assert.equal(p.rack.asset,ARMORY_RACK_ART.rackSource);
 assert.deepEqual([p.rack.x,p.rack.y,p.rack.width,p.rack.height],[200,154,240,166]);
 assert.deepEqual(p.swords.map(x=>x.id),items.map(x=>x.itemId));
 for(let i=0;i<items.length;i++){
  const pixel=projectArenaPoint(sockets[i].worldX,sockets[i].worldY,4000,4000,640,640);
  assert.deepEqual([p.swords[i].x,p.swords[i].y],[pixel.x-21,pixel.y-115]);
  assert.equal(p.swords[i].asset,ARMORY_RACK_ART.swordSource);
  assert.equal(p.swords[i].revision,items[i].revision);
 }
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.swords)&&Object.isFrozen(p.swords[0]));
 assert.deepEqual(items,original);
 const empty=create({committedWorldItems:[]});
 assert.equal(empty.count,0);
 assert.deepEqual(empty.swords,[]);
 const moved=create({camera:{x:4020,y:4010}});
 assert.ok(Math.abs(moved.swords[0].x-(p.swords[0].x-16.8))<1e-8);
 assert.ok(Math.abs(moved.swords[0].y-(p.swords[0].y-8.4))<1e-8);
});

test("P0 World and canonical item identity fail closed, no invented sockets, IDs or permission",()=>{
 const invalid=[
  {rack:undefined},
  {rack:{...rack,sockets:[]}},
  {rack:{...rack,sockets:[...sockets.slice(0,3),sockets[0]]}},
  {rack:{...rack,origin:{x:NaN,y:4000}}},
  {rack:{...rack,zoneId:""}},
  {building:{...building,id:"red-lion"}},
  {building:{...building,x:3711}},
  {camera:{x:Infinity,y:4000}},
  {zoom:1.5},
  {committedWorldItems:undefined},
  {committedWorldItems:[{...items[0],itemId:""}]},
  {committedWorldItems:[{...items[0],visualKind:"hat"}]},
  {committedWorldItems:[{...items[0],location:"equipped"}]},
  {committedWorldItems:[{...items[0],revision:-1}]},
  {committedWorldItems:[{...items[0],zoneId:"some-other-zone"}]},
  {committedWorldItems:[{...items[0],socketId:"not-world-approved"}]},
  {committedWorldItems:[items[0],{...items[1],itemId:items[0].itemId}]},
  {committedWorldItems:[items[0],{...items[1],socketId:items[0].socketId}]}
 ];
 for(const bad of invalid)assert.throws(()=>create(bad));
 // Numeric canonical IDs are rejected, preserving opaque 128-bit identity.
 assert.throws(()=>create({committedWorldItems:[{...items[0],itemId:Number.MAX_SAFE_INTEGER}]}));
});

test("P0 alpha-hit test selects sword pixels only, never rack/transparent bounding box or attack success",()=>{
 const p=create();
 const s=p.swords[0];
 const tip={x:s.x+21,y:s.y+50};
 const alpha=(asset,x,y)=>(asset===ARMORY_RACK_ART.swordSource && x>=15&&x<=25&&y>=10&&y<=107)?255:0;
 const candidate=hitTestVisibleSwordAlpha(p,tip,alpha);
 assert.ok(candidate);
 assert.equal(candidate.itemId,items[0].itemId);
 assert.equal(candidate.socketId,s.socketId);
 assert.equal(candidate.revision,s.revision);
 assert.equal(candidate.alpha,255);
 assert.deepEqual(candidate.sourcePixel,{x:21,y:50});
 assert.equal(candidate.visualCandidateOnly,true);
 assert.equal(candidate.serverPickupCommitted,false);
 assert.equal(candidate.maySuppressCombat,false);
 assert.ok(Object.isFrozen(candidate));
 assert.equal(hitTestVisibleSwordAlpha(p,{x:s.x+1,y:s.y+1},alpha),null);
 assert.equal(hitTestVisibleSwordAlpha(p,{x:p.rack.x+10,y:p.rack.y+40},alpha),null);
 assert.equal(hitTestVisibleSwordAlpha(create({committedWorldItems:[]}),tip,alpha),null);
 assert.equal(hitTestVisibleSwordAlpha(p,tip,()=>32),null);
 assert.ok(hitTestVisibleSwordAlpha(p,tip,()=>64));
 assert.equal(hitTestVisibleSwordAlpha(p,tip,()=>64,{minAlpha:65}),null);
});
