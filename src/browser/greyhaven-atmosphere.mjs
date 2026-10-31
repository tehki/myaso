// Graphics 3C P2.4 — purely cosmetic, static Greyhaven practical lighting.
// These decorative art marks cannot illuminate gameplay objects, grant vision,
// alter physics/collision or introduce a client-controlled day/night clock.
const TAU = Math.PI * 2;
const FIXTURE_IDS = Object.freeze(["red-lion","smith","market","chapel","townhouse-b"]);
const MAX_LIGHTS_PER_TILE = 5;
export const GREYHAVEN_LIGHTING_VERSION = "3c-p24-1";
export const GREYHAVEN_DAY_DUSK_VERSION = "3c-p1-day-dusk-1";

// Uniform, subtle dusk ambience across the outdoor world. Applying the
// same low-opacity wash to each cached tile avoids a visible city-rectangle
// seam and keeps roads, trees and facades in one consistent time-of-day.
export function paintGreyhavenDuskWash(ctx,map,tile) {
  if(map?.kind!=="outdoor"||
    ![map.width,map.height,tile?.x,tile?.y,tile?.width,tile?.height].every(Number.isFinite)||
    map.width<=0||map.height<=0||tile.width<=0||tile.height<=0||
    tile.width>512||tile.height>512)return 0;
  const x=Math.max(tile.x,0),y=Math.max(tile.y,0);
  const right=Math.min(tile.x+tile.width,map.width);
  const bottom=Math.min(tile.y+tile.height,map.height);
  if(right<=x||bottom<=y)return 0;
  ctx.fillStyle="rgba(23,26,35,.14)";
  ctx.fillRect(x,y,right-x,bottom-y);
  return 1;
}

// Anchors follow the authored facade; no duplicated building positions.
// Glow overlaps neighboring 512-unit tiles with the SAME world coordinates.
function footprintIntersects(tile,x,y,radius) {
  return x+radius>=tile.x && x-radius<=tile.x+tile.width
    && y+radius>=tile.y && y-radius<=tile.y+tile.height;
}

export function createGreyhavenLightingPlan(map,tile) {
  if(map?.kind!=="outdoor"||map?.city?.id!=="greyhaven"||!tile||
    ![tile.x,tile.y,tile.width,tile.height].every(Number.isFinite)||
    tile.width<=0||tile.height<=0||tile.width>512||tile.height>512)return [];

  const lights=[];
  for(const id of FIXTURE_IDS){
    const b=map.buildings?.find(item=>item.id===id);
    if(!b||!Number.isFinite(b.x)||!Number.isFinite(b.y)||
      !Number.isFinite(b.w)||!Number.isFinite(b.h)||b.w<=0||b.h<=0)continue;
    const x=b.entrance?.x ?? b.x+b.w*.5;
    const fixtureY=b.y+b.h-5;
    const poolY=b.y+b.h+19;
    const radius=id==="red-lion"?108:id==="market"?95:77;
    if(x<map.city.x||x>map.city.x+map.city.w||
      poolY<map.city.y||poolY>map.city.y+map.city.h)continue;
    if(!footprintIntersects(tile,x,poolY,radius+8) &&
      !footprintIntersects(tile,x,fixtureY,14))continue;
    lights.push({id,x,fixtureY,poolY,radius});
    if(lights.length>=MAX_LIGHTS_PER_TILE)break;
  }
  return lights;
}

export function paintGreyhavenLightingPools(ctx,map,tile) {
  const lights=createGreyhavenLightingPlan(map,tile);
  // The real 2D Canvas implements gradients. Unit-test and non-Canvas art
  // probes can still inspect the deterministic plan without drawing glows.
  if(typeof ctx.createRadialGradient!=="function")return 0;
  for(const light of lights){
    if(!footprintIntersects(tile,light.x,light.poolY,light.radius))continue;
    const g=ctx.createRadialGradient(light.x,light.poolY,3,
      light.x,light.poolY,light.radius);
    g.addColorStop(0,"rgba(255,207,117,.27)");
    g.addColorStop(.36,"rgba(246,177,91,.14)");
    g.addColorStop(1,"rgba(225,137,66,0)");
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.arc(light.x,light.poolY,light.radius,0,TAU);
    ctx.fill();
  }
  return lights.length;
}

export function paintGreyhavenLightingFixtures(ctx,map,tile,{lit=true}={}) {
  const lights=createGreyhavenLightingPlan(map,tile);
  for(const {x,fixtureY} of lights){
    if(!footprintIntersects(tile,x,fixtureY,15))continue;
    // A deliberately small south-facade sconce, not an obstructing lamppost.
    ctx.strokeStyle="#40382b";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x-10,fixtureY-8);
    ctx.lineTo(x-4,fixtureY-8);
    ctx.lineTo(x,fixtureY-5);
    ctx.stroke();
    ctx.fillStyle="#493d2f";
    ctx.fillRect(x-5,fixtureY-9,10,12);
    ctx.fillStyle=lit?"#f3bd68":"#817867";
    ctx.fillRect(x-3,fixtureY-7,6,8);
    if(lit){
      ctx.fillStyle="#ffe1a0";
      ctx.fillRect(x-1,fixtureY-6,2,4);
      ctx.fillStyle="rgba(250,208,122,.22)";
      ctx.beginPath();
      ctx.arc(x,fixtureY-3,10,0,TAU);
      ctx.fill();
    }
  }
  return lights.length;
}
