/**
 * Moon Games Graphics 3B — P0 actual completed Canvas presentation seam.
 * Draw the original source rack, then 0..4 separately committed World swords.
 * A successful return proves this particular Canvas call completed, NOT that
 * the server authenticated its input, the full game rendered or a pickup won.
 */
import {ARMORY_RACK_ART} from "./armory-rack-visual.mjs";
import {ARMORY_SWORD_ALPHA_SPEC} from "./armory-sword-alpha-sampler.mjs";

export const ARMORY_PRESENTED_FRAME_CONTRACT=Object.freeze({
 buildingId:"smith",
 layer:"world-owned-outdoor-rack-art-over-terrain",
 rackFirst:true,
 actorDepthOwnedBy:"World9-and-GraphicsOrchestrator",
 itemAuthorityOwnedBy:"Core8B-and-Items2B",
 inputGestureOwnedBy:"UI10-and-Combat4",
 actualMultiplayerIntegrated:false,
 productionApproved:false,
});

function validImage(image,source,width,height) {
 if(!image || image.complete!==true ||
   image.naturalWidth!==width||image.naturalHeight!==height)
   return false;
 const url=image.currentSrc||image.src;
 if(typeof url!=="string"||!url)return false;
 try{
  const resolved=new URL(url,typeof location!=="undefined"?
    location.href:"http://localhost/");
  return resolved.pathname===source && resolved.search==="" &&
   resolved.hash==="" && (typeof location==="undefined"||
     resolved.origin===location.origin);
 }catch{return false;}
}
function finiteGeometry(sprite,asset) {
 return sprite && sprite.renderOnly===true && sprite.asset===asset &&
  Number.isFinite(sprite.x)&&Number.isFinite(sprite.y) &&
  sprite.width>0&&sprite.height>0&&
  Number.isFinite(sprite.width)&&Number.isFinite(sprite.height);
}

/**
 * plan must be built from authentic World-owned socket layout AND
 * caller-supplied committed Core/Items on-rack snapshot. This painter
 * cannot verify that provenance; it does NOT fetch, mint or validate item IDs.
 * Caller owns canvas transform, actor depth and full-frame ordering.
 *
 * Throws BEFORE painting if asset, plan or Canvas inputs are inconsistent.
 * If Canvas.drawImage itself throws, no successful presented-frame marker
 * is returned. The caller must not install pending UI hit state in that case.
 */
export function paintArmoryRackPresentedFrame({
  ctx,plan,rackImage,swordImage,alphaSampler,frameId,
}={}) {
 if(!ctx||typeof ctx.drawImage!=="function"||
   typeof ctx.save!=="function"||typeof ctx.restore!=="function")
   throw new TypeError("Canvas 2D presentation context required");
 if(!Number.isSafeInteger(frameId)||frameId<0)
   throw new RangeError("Actual presented-frame ID required");
 if(!validImage(rackImage,ARMORY_RACK_ART.rackSource,
    ARMORY_RACK_ART.rackSize.w,ARMORY_RACK_ART.rackSize.h)||
   !validImage(swordImage,ARMORY_RACK_ART.swordSource,
    ARMORY_RACK_ART.swordSize.w,ARMORY_RACK_ART.swordSize.h))
   throw new TypeError("Expected loaded original Blender rack/sword WebPs");
 if(!alphaSampler||alphaSampler.asset!==ARMORY_SWORD_ALPHA_SPEC.source||
   alphaSampler.width!==ARMORY_SWORD_ALPHA_SPEC.width||
   alphaSampler.height!==ARMORY_SWORD_ALPHA_SPEC.height||
   typeof alphaSampler.sampleAlpha!=="function"||
   alphaSampler.presentationOnly!==true)
   throw new TypeError("Original image alpha sampler required");
 if(!plan||plan.buildingId!=="smith"||
   plan.serverOwnershipUnchanged!==true||
   plan.canApprovePickup!==false||
   plan.canSuppressCombat!==false||
   plan.gameRendererIntegrated!==false||
   plan.productionApproved!==false||
   !Array.isArray(plan.swords)||plan.swords.length>4||
   plan.count!==plan.swords.length||
   !finiteGeometry(plan.rack,ARMORY_RACK_ART.rackSource)||
   plan.rack.kind!=="rack"||
   !Number.isSafeInteger(plan.worldSocketCount)||plan.worldSocketCount!==4)
   throw new RangeError("Invalid or nonvisual-only armory render plan");
 const ids=new Set(),sockets=new Set();
 for(const sword of plan.swords){
  if(!finiteGeometry(sword,ARMORY_RACK_ART.swordSource)||
    sword.kind!=="sword"||sword.width!==ARMORY_RACK_ART.swordSize.w||
    sword.height!==ARMORY_RACK_ART.swordSize.h||
    sword.sourceWidth!==ARMORY_SWORD_ALPHA_SPEC.width||
    sword.sourceHeight!==ARMORY_SWORD_ALPHA_SPEC.height||
    typeof sword.id!=="string"||sword.id.length<1||sword.id.length>160||
    typeof sword.socketId!=="string"||!sword.socketId||
    !Number.isSafeInteger(sword.revision)||sword.revision<0||
    ids.has(sword.id)||sockets.has(sword.socketId))
    throw new RangeError("Invalid, duplicate or resized source sword sprite");
  ids.add(sword.id);sockets.add(sword.socketId);
 }
 ctx.save();
 try{
  ctx.drawImage(rackImage,plan.rack.x,plan.rack.y,
    plan.rack.width,plan.rack.height);
  // Keep previously planned relative actor/sprite ordering. No sorting on
  // a fabricated equipped/held property or local optimistic pickup state.
  for(const sword of plan.swords)
   ctx.drawImage(swordImage,sword.x,sword.y,sword.width,sword.height);
 }finally{ctx.restore();}
 return Object.freeze({
  plan,frameId,lastPresentedFrameId:frameId,
  sampleAlpha:alphaSampler.sampleAlpha,
  drawnRackCount:1,
  drawnSwordCount:plan.swords.length,
  sourceBlenderSprites:true,
  presentedCanvasCallCompleted:true,
  actualGameFrameCompleted:false,
  serverItemsAuthenticatedByPainter:false,
  validCombatTargetAuthorized:false,
  playerActorDepthResolved:false,
  productionApproved:false,
 });
}
