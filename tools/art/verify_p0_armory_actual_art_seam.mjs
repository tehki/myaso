// Graphics 3C P0 — strict, zero-item cross-branch World #493 ↔ Graphics 3B #500 art seam.
// Source fixtures are immutable, but NOT server-issued item IDs; no sword is
// rendered without committed-world-item input, and no pickup is ever requested.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {MAP_IDS,getAuthoredMap} from "../../src/world/authored-maps.mjs";
import {createGreyhavenLightingPlan} from "../../src/browser/greyhaven-atmosphere.mjs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../../src/browser/arena-viewport.mjs";

const [worldDir,artDir,outArg="assets/environment/greyhaven/3c-p31-source-art-review"]=process.argv.slice(2);
const worldSha=process.env.WORLD_ALPHA_EXPECTED_HEAD;
const artSha=process.env.GRAPHICS_3B_EXPECTED_HEAD;
function pinned(dir,sha,label){
  if(!dir||!sha||!/^[0-9a-f]{40}$/i.test(sha))throw Error("Exact "+label+" checkout and SHA are mandatory");
  const r=spawnSync("git",["-C",resolve(dir),"rev-parse","HEAD"],{encoding:"utf8"});
  if(r.status!==0||r.stdout.trim()!==sha)throw Error(label+" source SHA mismatch "+r.stdout.trim());
}
pinned(worldDir,worldSha,"World #493");
pinned(artDir,artSha,"Graphics #500");
const w=await import(pathToFileURL(join(resolve(worldDir),"src/world/alpha-armory.mjs")).href);
const a=await import(pathToFileURL(join(resolve(artDir),"src/browser/armory-rack-visual.mjs")).href);
const m=await import(pathToFileURL(join(resolve(worldDir),"src/world/authored-maps.mjs")).href);
const map=getAuthoredMap(MAP_IDS.overworld);
assert.equal(JSON.stringify(map),JSON.stringify(m.getAuthoredMap(m.MAP_IDS.overworld)),"World #493 map changed");
assert.equal(w.validateWorldAlphaArmoryLayout(),true);
assert.equal(w.WORLD_ALPHA_ARMORY.buildingId,"smith");
assert.equal(w.WORLD_ALPHA_ARMORY.requiresZoneTransfer,false);
const b=map.buildings.find(x=>x.id==="smith");
assert.ok(b);
assert.deepEqual(a.ARMORY_RACK_ART.authoredBuilding,{x:b.x,y:b.y,w:b.w,h:b.h});
const sockets=w.WORLD_ALPHA_SWORD_RACK_SOCKETS;
assert.equal(sockets.length,4);
const worldRack=w.WORLD_ALPHA_ARMORY;
// Critical missing authoritative interface must be declared, never guessed.
const hasOrigin=worldRack.origin && Number.isFinite(worldRack.origin.x)&&Number.isFinite(worldRack.origin.y);
const hasVersion=typeof worldRack.version==="string"&&worldRack.version.length>0;
const hasZone=typeof worldRack.zoneId==="string"&&worldRack.zoneId.length>0;
const adapted=sockets.map(s=>({id:s.socketId,worldX:s.x,worldY:s.y}));
assert.equal(new Set(adapted.map(s=>s.id)).size,4);
// Deliberate failing live call: no World-approved origin/zone/version.
assert.throws(()=>a.createBlacksmithRackVisualPlan({
  building:b,
  rack:{buildingId:"smith",sockets:adapted},
  committedWorldItems:[],
  camera:{x:3800,y:4050},width:1100,height:688
}),RangeError,"3B fail closed on absent authoritative rack context");
// QA-only art layout argument, NEVER authoritative server/world coordinates.
const qaOnlyRack={
  buildingId:"smith",sockets:adapted,
  version:"GRAPHICS_QA_NOT_WORLD_APPROVED",
  zoneId:"GRAPHICS_QA_NOT_SERVER_ZONE",
  origin:{x:sockets.reduce((n,s)=>n+s.x,0)/sockets.length,
    y:sockets[0].y}
};
const plan=a.createBlacksmithRackVisualPlan({
  building:b,rack:qaOnlyRack,committedWorldItems:[],
  camera:{x:3800,y:4050},width:1100,height:688,zoom:ARENA_VIEW_ZOOM
});
assert.equal(plan.count,0);
assert.equal(plan.swords.length,0);
assert.equal(plan.serverOwnershipUnchanged,true);
assert.equal(plan.canApprovePickup,false);
assert.equal(plan.productionApproved,false);
assert.equal(a.hitTestVisibleSwordAlpha(plan,{x:550,y:330},()=>255),null);
const artBase=join(resolve(artDir),"assets/environment/greyhaven/armory-p0");
const hashes={};
for(const [key,filename,declared] of [
  ["rack","armory_rack.webp",a.ARMORY_RACK_ART.rackSha256],
  ["sword","armory_sword.webp",a.ARMORY_RACK_ART.swordSha256]
]){
  const bytes=await readFile(join(artBase,filename));
  const sha=createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha,declared,"actual original 3B WebP file must match declared source");
  hashes[key]={sha256:sha,bytes:bytes.length};
}
const camera={x:3800,y:4050},screen={width:1100,height:688,zoom:ARENA_VIEW_ZOOM};
const projected=sockets.map(s=>({
  socketId:s.socketId,
  worldAnchor:{x:s.x,y:s.y},
  screenAnchor:projectArenaPoint(s.x,s.y,camera.x,camera.y,screen.width,screen.height,screen.zoom),
  theoreticalSwordSpriteBounds:{
    x:projectArenaPoint(s.x,s.y,camera.x,camera.y,screen.width,screen.height,screen.zoom).x-a.ARMORY_RACK_ART.swordSize.w/2,
    y:projectArenaPoint(s.x,s.y,camera.x,camera.y,screen.width,screen.height,screen.zoom).y-a.ARMORY_RACK_ART.swordSize.h,
    width:a.ARMORY_RACK_ART.swordSize.w,
    height:a.ARMORY_RACK_ART.swordSize.h
  }
}));
const gap=projected[1].screenAnchor.x-projected[0].screenAnchor.x;
const theoreticalRectangleOverlap=a.ARMORY_RACK_ART.swordSize.w-gap;
assert.ok(gap>0&&theoreticalRectangleOverlap>0);
const light=createGreyhavenLightingPlan(map,{x:3584,y:3584,width:512,height:512}).find(x=>x.id==="smith");
assert.ok(light);
const report={
  status:"NON_AUTHORITATIVE_GRAPHICS_QA_ONLY",
  pinnedWorldCommit:worldSha,pinnedGraphics3BCommit:artSha,
  graphics3CHead:process.env.GRAPHICS_3C_EXPECTED_HEAD||"unverified",
  originalAssetHashes:hashes,
  worldContractMissing:{rackOrigin:!hasOrigin,authoritativeRackVersion:!hasVersion,serverZoneId:!hasZone},
  presentationAdapterOnly:{
    source:"World fixture objects mapped id/socketId, worldX/x, worldY/y",
    origin:"Arithmetic four-anchor midpoint FOR QA ONLY; NOT World-approved",
    zone:"ART QA NOT SERVER ZONE",version:"ART QA NOT WORLD REVISION"
  },
  sampleCamera:camera,screen,projected,
  swordSourcePixels:a.ARMORY_RACK_ART.swordSize,
  adjacentSwordScreenSpacingPx:gap,
  adjacentTransparentRectangleOverlapPx:theoreticalRectangleOverlap,
  alphaActualOverlapPixels: "MUST MEASURE FROM ACTUAL SOURCE IMAGE; NOT DERIVED FROM BOUNDING BOX",
  zeroAuthoritativeCommittedItemsPlan:{rackVisibleAsStaticArt:true,swordCount:plan.swords.length,
    alphaHitReturnsNull:true,mayApprovePickup:plan.canApprovePickup},
  graphics3CBlacksmithFixture:{x:light.x,y:light.fixtureY},
  finalGamePickValidated:false,actualItemsRendered:false,actualServerPickupValidated:false,
  integrationGate:"BLOCKED until World/Core supply authoritative rack origin/zone/revision & Core/Items snapshots; UI chooses true sword alpha with real browser"
};
const out=resolve(outArg);await mkdir(out,{recursive:true});
await writeFile(join(out,"world493_3b500_3c_art_seam.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:report.status,worldContractMissing:report.worldContractMissing,
  assetSha256:hashes,swordCount:plan.swords.length,spriteBoxOverlapPx:theoreticalRectangleOverlap,
  pickups:report.actualServerPickupValidated},null,2));
