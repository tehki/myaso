/**
 * Graphics 3A — First Playable P0 read-only, server-equipment-dependent
 * Silver Knight sword overlay proposal. NOT integrated with live online-game.
 *
 * The caller MUST supply an authenticated, committed Core/Items snapshot and
 * the exact frame/clip actually drawn by the Knight renderer. This function
 * cannot authenticate a snapshot or approve pickups. If a future wire/schema
 * disagrees, adapt at the Core interface, never infer equipment from remote,
 * local, attack type, actor art, or visible rack click.
 *
 * Reuses original Graphics 3B sword only after its PR #500 is integrated.
 */
import { knightPresentationRect,KNIGHT_CLIPS,KNIGHT_DIRECTIONS } from "../../web/knight-sprites.mjs";

export const SILVER_MAINHAND_REVIEW = Object.freeze({
  contract:"read-only-provisional-presentation-input-v1",
  swordArt:"/assets/environment/greyhaven/armory-p0/armory_sword.webp",
  swordSourceSha256:"795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31",
  handSource:"mixamorig:RightHand",
  clipSource:"original 22-bone owner-supplied Silver GLB plus original A3 roll GLB",
  anchorTableSource:"/assets/knights/silver_hand_anchors_p0.json",
  sourceFrameSize:160,
  authoredSwordSourcePx:Object.freeze({width:42,height:115}),
  hasAuthoritativeItemStream:false,
  gameplayIntegrated:false,
  humanVisualApproved:false,
  npcPilotEnabled:false,
  altersDamageOrMovement:false
});
const ANGLES=Object.freeze([2.55,2.8,3.05,3.2,3.25,3.05,2.8,2.55]);
// Visual acceptance HOLD: owner-approved roll timing doesn't yet prove a
// reliable sword grip through inversion or jump. Never render a floating sword
// in those clips. Equipment truth remains Core/Items-owned during these poses.
const VALID_CLIPS=new Set(["silver_idle","silver_walk","silver_sprint"]);
const validId=x=>typeof x==="string"&&x.length>0&&x.length<=160&&x.trim()===x&&!/[\x00-\x1f]/.test(x);
const natural=x=>Number.isSafeInteger(x)&&x>=0;
const verifiedSnapshot=(snapshot,actorKey)=>{
  if(!snapshot||typeof snapshot!=="object"||snapshot.provenance!=="core-items-committed-snapshot"||
    !validId(actorKey)||snapshot.actorKey!==actorKey||
    !natural(snapshot.snapshotRevision)||!natural(snapshot.serverTick)) return null;
  const hand=snapshot.mainHand;
  // No pending, predicted, clicked, optimistic or client-equipment state.
  if(!hand||typeof hand!=="object"||hand.slot!=="MainHand"||
    hand.location!=="equipped"||hand.visualKind!=="sword"||
    !validId(hand.itemId)||hand.ownerActorKey!==actorKey||
    !natural(hand.revision)||!natural(hand.committedSequence)||
    hand.committedSequence===0)return null;
  return hand;
};
/** Pure read-only draw plan. Null means DO NOT draw a held sword.
 *
 * `snapshot.provenance` is an integration metadata label only, **not**
 * a security credential. Only Core may supply this snapshot from a trusted
 * decoder/outbox; client-provided JSON must never be accepted as authority.
 */
export function planSilverCommittedSword({
  actorKind,actorKey,equipmentSnapshot,clip,frame,direction,
  anchors,presentationScale=1.2
}={}){
  if(actorKind!=="player"||!VALID_CLIPS.has(clip)||!Number.isInteger(frame)||
     frame<0||frame>=KNIGHT_CLIPS[clip]||!Number.isInteger(direction)||
     direction<0||direction>=KNIGHT_DIRECTIONS.length)return null;
  const item=verifiedSnapshot(equipmentSnapshot,actorKey);
  if(!item)return null;
  const rows=anchors?.anchors?.[clip];
  if(!Array.isArray(rows)||rows.length!==8)return null;
  const cells=rows[direction];
  if(!Array.isArray(cells)||cells.length!==KNIGHT_CLIPS[clip])return null;
  const point=cells[frame];
  if(!Array.isArray(point)||point.length!==2||
     !point.every(n=>Number.isFinite(n)&&n>=-30&&n<=190))return null;
  const rect=knightPresentationRect(clip==="silver_roll",presentationScale);
  const wristX=rect.x+point[0]/160*rect.width;
  const wristY=rect.y+point[1]/160*rect.height;
  // Size ratio derived from the real 42x115 authored sword. Original source
  // is a vertical rack sword, so the in-hand angular rest pose requires human
  // art approval, especially for inverted roll and northern occlusion.
  const width=Math.round(rect.width*.16);
  const height=Math.round(width*115/42);
  return Object.freeze({
    asset:SILVER_MAINHAND_REVIEW.swordArt,
    assetSha256:SILVER_MAINHAND_REVIEW.swordSourceSha256,
    itemId:item.itemId,itemRevision:item.revision,
    equipmentRevision:equipmentSnapshot.snapshotRevision,
    serverTick:equipmentSnapshot.serverTick,
    clip,frame,direction,
    wristX,wristY,width,height,angle:ANGLES[direction],
    swordPivot:Object.freeze({x:.5,y:.87}),
    drawOrder:direction>=3&&direction<=5?"behind-knight":"in-front-of-knight",
    origin:"derived-original-Blender-RightHand-review-approximation",
    sourceOnly:true,realGameValidated:false,
    authoritativeEquipmentNotValidatedHere:true,
    mayApprovePickup:false,mayMutateInventory:false
  });
}
/** Caller controls under/over character pass; renderer never writes state. */
export function drawSilverCommittedSword(ctx,image,plan){
  if(!plan||!image||image.naturalWidth!==42||image.naturalHeight!==115||
    typeof ctx?.drawImage!=="function")return false;
  ctx.save();
  ctx.translate(plan.wristX,plan.wristY);
  ctx.rotate(plan.angle);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(image,
    -plan.width*plan.swordPivot.x,-plan.height*plan.swordPivot.y,
    plan.width,plan.height);
  ctx.restore();
  return true;
}
