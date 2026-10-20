// D12: render an OPTIONAL D11 sampled-clear rejoin on the existing D8 map.
// Pure presentation: no route search, travel authorization, NPC interaction,
// quest credit, real-time movement, or network data. The hint is recalculated
// in the SAME 250 ms preview refresh and never persisted for later frames.
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";
import { LOCAL_REJOIN_MAX_DISTANCE } from "./local-rejoin.mjs";

export const LOCAL_REJOIN_SKETCH_VERSION = 1;
export const LOCAL_REJOIN_SKETCH_COLOR = "#67e5ee";
export const LOCAL_REJOIN_SKETCH_DASH = Object.freeze([3, 3]);

// Draw AFTER D8's sketch and D9's fixed certified corridor. If no current
// sampled-clear D11 hint exists, leave the canvas exactly as D8/D9 drew it.
// Marker means "sampled-clear in static preview", never a server-safe route.
export function drawLocalRejoinSketch(ctx, mapId, playerX, playerY, hint, size=248) {
  const map=getAuthoredMap(mapId);
  if(!ctx || typeof ctx.save!=="function" || typeof ctx.restore!=="function" ||
    typeof ctx.setLineDash!=="function" || typeof ctx.beginPath!=="function" ||
    typeof ctx.moveTo!=="function" || typeof ctx.lineTo!=="function" ||
    typeof ctx.stroke!=="function" || typeof ctx.arc!=="function" ||
    typeof ctx.fill!=="function" || !map || mapId!==MAP_IDS.overworld ||
    !Number.isFinite(size) || size<128 || size>512 ||
    !Number.isFinite(playerX) || !Number.isFinite(playerY) ||
    !hint || typeof hint!=="object" ||
    !Number.isFinite(hint.targetX) || !Number.isFinite(hint.targetY) ||
    !Number.isFinite(hint.distance) || hint.distance<=0 ||
    hint.distance>LOCAL_REJOIN_MAX_DISTANCE ||
    !Number.isInteger(hint.segmentIndex) || hint.segmentIndex<0 || hint.segmentIndex>3 ||
    typeof hint.direction!=="string" ||
    !["N","NE","E","SE","S","SW","W","NW"].includes(hint.direction)) return false;
  const length=Math.hypot(hint.targetX-playerX,hint.targetY-playerY);
  // Do not draw a hint computed for another player position/old preview tick.
  if(Math.abs(length-hint.distance)>0.001 ||
    playerX<0 || playerY<0 || playerX>map.width || playerY>map.height ||
    hint.targetX<0 || hint.targetY<0 ||
    hint.targetX>map.width || hint.targetY>map.height) return false;
  const scale=(size-24)/Math.max(map.width,map.height);
  const px=v=>12+v*scale;
  ctx.save();
  try {
    ctx.strokeStyle=LOCAL_REJOIN_SKETCH_COLOR;
    ctx.lineWidth=2.6;
    ctx.setLineDash(LOCAL_REJOIN_SKETCH_DASH);
    ctx.beginPath();ctx.moveTo(px(playerX),px(playerY));
    ctx.lineTo(px(hint.targetX),px(hint.targetY));
    ctx.stroke();
    ctx.setLineDash([]);
    // Hollow cyan ring, distinct from the amber expedition destination and
    // white player dot. No heading arrow or steering input is added.
    ctx.fillStyle="#193a3c";
    ctx.beginPath();ctx.arc(px(hint.targetX),px(hint.targetY),5,0,2*Math.PI);ctx.fill();
    ctx.strokeStyle=LOCAL_REJOIN_SKETCH_COLOR;
    ctx.lineWidth=2.3;ctx.stroke();
  } finally {
    ctx.restore();
  }
  return true;
}
