// D15: preview-only map pins for the next unread D14 chronicle clues.
// Presentation of already authored D13 locations; not route planning,
// authoritative map discovery, quest credit, NPC AI, or world persistence.
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";
import { MOONVALE_ROADSIDE_LORE } from "./roadside-lore.mjs";
import { MOONVALE_CHRONICLE_THREADS } from "./chronicle-threads.mjs";

export const CHRONICLE_ATLAS_VERSION = 1;
export const CHRONICLE_ATLAS_COLOR = "#d4a4f6";
export const CHRONICLE_ATLAS_MARKER_SIZE = 4;

const SITES_BY_ID = new Map(MOONVALE_ROADSIDE_LORE.map(site => [site.id, site]));

// Project a read-only D13 journal onto two D14 story threads, showing only
// each thread's earliest remaining clue. The record never contains the
// hidden synthesis or another chapter's unread narrative passage.
export function localChronicleAtlasMarkers(journal) {
  if (!(journal instanceof Set)) return Object.freeze([]);
  const markers=[];
  for (const thread of MOONVALE_CHRONICLE_THREADS) {
    for (const siteId of thread.siteIds) {
      if (journal.has(siteId)) continue;
      const site=SITES_BY_ID.get(siteId);
      if (!site) break; // Unexpected manifest mismatch: fail closed.
      markers.push(Object.freeze({
        threadId:thread.id,threadTitle:thread.title,
        siteId:site.id,siteName:site.name,
        mapId:site.mapId,x:site.x,y:site.y,clue:site.clue,
      }));
      break;
    }
  }
  return Object.freeze(markers);
}

// Paints at most two tiny violet diamonds on the existing opt-in sketch.
// The actual player marker must remain visible when standing on a clue:
// omit markers within 24 world units of the player's current position.
// No lines are drawn, as locations aren't collision-certified routes.
export function drawLocalChronicleAtlas(ctx,mapId,x,y,journal,size=248) {
  const map=getAuthoredMap(mapId);
  if(!ctx || typeof ctx.save!=="function" || typeof ctx.restore!=="function" ||
    typeof ctx.beginPath!=="function" || typeof ctx.moveTo!=="function" ||
    typeof ctx.lineTo!=="function" || typeof ctx.closePath!=="function" ||
    typeof ctx.fill!=="function" || !map || mapId!==MAP_IDS.overworld ||
    !Number.isFinite(x) || !Number.isFinite(y) ||
    !Number.isFinite(size) || size<128 || size>512 ||
    x<0 || y<0 || x>map.width || y>map.height) return 0;
  const scale=(size-24)/Math.max(map.width,map.height);
  const pos=v=>12+v*scale;
  let count=0;
  const markers=localChronicleAtlasMarkers(journal);
  if(!markers.length) return 0;
  ctx.save();
  try {
    ctx.fillStyle=CHRONICLE_ATLAS_COLOR;
    for (const marker of markers) {
      if(marker.mapId!==mapId || !Number.isFinite(marker.x) ||
        !Number.isFinite(marker.y) || marker.x<0 || marker.y<0 ||
        marker.x>map.width || marker.y>map.height ||
        Math.hypot(marker.x-x,marker.y-y)<24) continue;
      const px=pos(marker.x),py=pos(marker.y),r=CHRONICLE_ATLAS_MARKER_SIZE;
      ctx.beginPath();
      ctx.moveTo(px,py-r);ctx.lineTo(px+r,py);
      ctx.lineTo(px,py+r);ctx.lineTo(px-r,py);
      ctx.closePath();ctx.fill();count++;
    }
  } finally {
    ctx.restore();
  }
  return count;
}
