/**
 * Moon Games Graphics 3B — first-playable Blacksmith physical rack attachment.
 *
 * INPUT IS PRESENTATION DATA ONLY: World owns approved rack sockets; Core and
 * Items own item identity and authoritative committed on-rack presence.
 * Never use these coordinates or a hit result to approve a server pickup.
 */
import {projectArenaPoint, ARENA_VIEW_ZOOM} from "./arena-viewport.mjs";

export const ARMORY_RACK_ART = Object.freeze({
  buildingId:"smith",
  authoredBuilding:Object.freeze({x:3710,y:3850,w:182,h:162}),
  rackSource:"/assets/environment/greyhaven/armory-p0/armory_rack.webp",
  rackSha256:"83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8",
  swordSource:"/assets/environment/greyhaven/armory-p0/armory_sword.webp",
  swordSha256:"795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31",
  rackSize:Object.freeze({w:240,h:166}),
  swordSize:Object.freeze({w:42,h:115}),
  interactionPolicy:"visible-sword-alpha-only",
  coordinateOwnership:"World9-approved-world-sockets-required",
  itemOwnership:"Core8B-Items2B-single-authoritative-writer",
  clickArbitrationOwnership:"UI10-Combat4",
  actualWorldIntegration:false,
  realMultiplayerValidated:false,
  productionApproved:false
});

function validPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x>=0 && point.y>=0 && point.x<=8192 && point.y<=8192;
}
function str(value) {
  return typeof value==="string" && value.length>0 && value.length<=160;
}
function immutableSprite(kind,asset,id,point,origin,screen) {
  const x=screen.x-asset.w/2, y=screen.y-asset.h;
  return Object.freeze({kind,id,worldXY:Object.freeze({x:point.x,y:point.y}),
    worldRackOrigin:origin,asset:kind==="rack"?ARMORY_RACK_ART.rackSource:ARMORY_RACK_ART.swordSource,
    x,y,width:asset.w,height:asset.h,sourceWidth:asset.w,sourceHeight:asset.h,
    renderOnly:true});
}

/**
 * Caller passes genuine World-authored fixed rack sockets and the *latest
 * committed server snapshot* world-items. Visual planner does not own either.
 * No sockets or items -> no implied swords; no fabricated IDs or menu targets.
 *
 * @returns immutable plan of one wooden rack and 0..4 rendered swords
 */
export function createBlacksmithRackVisualPlan({
  building, rack, committedWorldItems, camera, width=640,height=640,
  zoom=ARENA_VIEW_ZOOM
}={}) {
  const b=ARMORY_RACK_ART.authoredBuilding;
  if(!building || building.id!==ARMORY_RACK_ART.buildingId ||
    building.x!==b.x||building.y!==b.y||building.w!==b.w||building.h!==b.h)
    throw new RangeError("Blacksmith authored building identity or footprint drift");
  if(!rack || rack.buildingId!=="smith" || !str(rack.version) ||
    !str(rack.zoneId) || !validPoint(rack.origin) ||
    !Array.isArray(rack.sockets) || rack.sockets.length!==4)
    throw new RangeError("Four World-owned armory rack sockets and origin required");
  if(!Array.isArray(committedWorldItems))
    throw new TypeError("Committed World item snapshot array required");
  if(!validPoint(camera) || !Number.isFinite(width)||!Number.isFinite(height)||
     width<=0||height<=0||!Number.isFinite(zoom)||zoom<=0||zoom>1)
    throw new RangeError("Invalid render camera or viewport");

  const sockets=new Map();
  for(const socket of rack.sockets){
    if(!socket || !str(socket.id) || !validPoint({x:socket.worldX,y:socket.worldY}) ||
      sockets.has(socket.id))
      throw new RangeError("Invalid or duplicate World rack socket");
    sockets.set(socket.id,Object.freeze({id:socket.id,x:socket.worldX,y:socket.worldY}));
  }
  const itemIds=new Set(),usedSockets=new Set(),sprites=[];
  for(const item of committedWorldItems){
    if(!item || !str(item.itemId) || !str(item.socketId) ||
      item.visualKind!=="sword" || item.location!=="rack" ||
      !str(item.zoneId) || item.zoneId!==rack.zoneId ||
      !Number.isSafeInteger(item.revision) || item.revision<0 ||
      itemIds.has(item.itemId)||usedSockets.has(item.socketId)||
      !sockets.has(item.socketId))
      throw new RangeError("Unverified or conflicting server-present rack item");
    itemIds.add(item.itemId);usedSockets.add(item.socketId);
    const pos=sockets.get(item.socketId);
    const pt=projectArenaPoint(pos.x,pos.y,camera.x,camera.y,width,height,zoom);
    const source=immutableSprite("sword",ARMORY_RACK_ART.swordSize,item.itemId,
      pos,Object.freeze({x:rack.origin.x,y:rack.origin.y}),pt);
    sprites.push(Object.freeze({...source,socketId:item.socketId,revision:item.revision}));
  }
  sprites.sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id));
  const pp=projectArenaPoint(rack.origin.x,rack.origin.y,camera.x,camera.y,width,height,zoom);
  const background=immutableSprite("rack",ARMORY_RACK_ART.rackSize,"smith-rack",
    rack.origin,Object.freeze({x:rack.origin.x,y:rack.origin.y}),pp);
  return Object.freeze({
    buildingId:"smith",rackVersion:rack.version,zoneId:rack.zoneId,
    rack:background,swords:Object.freeze(sprites),
    count:sprites.length,worldSocketCount:sockets.size,
    pointerTargetPolicy:ARMORY_RACK_ART.interactionPolicy,
    serverOwnershipUnchanged:true,
    canApprovePickup:false,canSuppressCombat:false,
    authoritativeWorldSocketsNotDefinedHere:true,
    gameRendererIntegrated:false,productionApproved:false
  });
}

/**
 * Given a source RGBA-alpha sampler for the *actual sword image*, return only
 * the opaque-pixel candidate under a pointer; no menu/counter/rack hit boxes.
 * All gesture arbitration and authenticated TryPickup remain outside 3B.
 */
export function hitTestVisibleSwordAlpha(plan,pointer,sampleAlpha,{minAlpha=64}={}) {
  if(!plan || !Array.isArray(plan.swords)||!validPoint(pointer)||
    typeof sampleAlpha!=="function"||!Number.isInteger(minAlpha)||
    minAlpha<1||minAlpha>255) return null;
  for(let i=plan.swords.length-1;i>=0;i--){
    const s=plan.swords[i];
    if(pointer.x<s.x||pointer.y<s.y||pointer.x>=s.x+s.width||
       pointer.y>=s.y+s.height)continue;
    const u=Math.floor((pointer.x-s.x)*s.sourceWidth/s.width);
    const v=Math.floor((pointer.y-s.y)*s.sourceHeight/s.height);
    const alpha=sampleAlpha(s.asset,u,v);
    if(!Number.isFinite(alpha)||alpha<minAlpha)continue;
    return Object.freeze({itemId:s.id,socketId:s.socketId,revision:s.revision,
      sourcePixel:Object.freeze({x:u,y:v}),alpha,visualCandidateOnly:true,
      serverPickupCommitted:false,maySuppressCombat:false});
  }
  return null;
}
