// Visual-only renderer for designer-authored fixed maps.
// Loading an interior in the offline preview does not grant a network zone transfer.
import { AUTHORED_MAPS, MAP_IDS, getAuthoredMap } from "../world/authored-maps.mjs";
import { normalizeWorldBuildingReplacementIds } from "../world/building-presentation.mjs";

export const WORLD_TILE_SIZE = 512;
export const WORLD_CACHE_CAP = 24;
const TAU = Math.PI * 2;

function strokePolyline(ctx, points, width, color) {
  ctx.beginPath();
  ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
  ctx.lineJoin="round";
  ctx.lineCap="round";
  ctx.lineWidth=width;
  ctx.strokeStyle=color;
  ctx.stroke();
}

function paintTree(ctx,x,y) {
  ctx.fillStyle="rgba(23,30,21,.27)";
  ctx.beginPath();
  ctx.ellipse(x+8,y+11,24,14,.24,0,TAU);ctx.fill();
  ctx.fillStyle="#405d3b";
  ctx.beginPath();ctx.arc(x,y,24,0,TAU);ctx.fill();
  ctx.fillStyle="#65824d";
  ctx.beginPath();ctx.arc(x-5,y-6,19,0,TAU);ctx.fill();
  ctx.fillStyle="rgba(163,177,103,.29)";
  ctx.beginPath();ctx.ellipse(x-11,y-12,12,7,-.4,0,TAU);ctx.fill();
}

function paintBuilding(ctx,b) {
  // Roof covers collision-sized footprint; door points are authored separately.
  ctx.fillStyle="rgba(16,26,21,.25)";
  ctx.fillRect(b.x+12,b.y+13,b.w,b.h);
  ctx.fillStyle="#c0ad8b";
  ctx.fillRect(b.x-7,b.y-7,b.w+14,b.h+14);
  ctx.fillStyle=b.color;
  ctx.fillRect(b.x,b.y,b.w,b.h);
  ctx.strokeStyle="rgba(44,33,30,.53)";
  ctx.lineWidth=7;
  ctx.strokeRect(b.x,b.y,b.w,b.h);
  ctx.strokeStyle="rgba(232,196,143,.2)";
  ctx.lineWidth=2;
  for(let i=1;i<4;i++) {
    const y=b.y+i*b.h/4;
    ctx.beginPath();ctx.moveTo(b.x+9,y);ctx.lineTo(b.x+b.w-9,y);ctx.stroke();
  }
  ctx.fillStyle="#c8b793";
  ctx.fillRect(b.x+b.w*.22,b.y+b.h*.24,18,23);
  ctx.fillRect(b.x+b.w*.66,b.y+b.h*.24,18,23);
  if(b.entrance){
    ctx.fillStyle="#31271e";
    ctx.fillRect(b.entrance.x-20,b.y+b.h-10,40,20);
    ctx.strokeStyle="#dece9e";ctx.lineWidth=3;
    ctx.strokeRect(b.entrance.x-20,b.y+b.h-10,40,20);
  }
  if(b.kind==="tavern"){
    ctx.fillStyle="#e3cda0";ctx.font="bold 16px Georgia,serif";
    ctx.textAlign="center";ctx.fillText("RED LION",b.x+b.w/2,b.y+b.h*.58);
    ctx.fillStyle="#f1dd7d";ctx.beginPath();
    ctx.arc(b.x+b.w/2,b.y+b.h*.7,12,0,TAU);ctx.fill();
  }
}

function paintCityWalls(ctx,city) {
  const {x,y,w,h}=city;
  const verticalGapY=4180, horizontalGateX=4130;
  const wall=(ax,ay,bx,by)=>{
    strokePolyline(ctx,[[ax,ay],[bx,by]],37,"#494e46");
    strokePolyline(ctx,[[ax,ay],[bx,by]],26,"#aaa693");
    strokePolyline(ctx,[[ax,ay],[bx,by]],4,"#d5c7a7");
  };
  wall(x,y,horizontalGateX-73,y);wall(horizontalGateX+73,y,x+w,y);
  wall(x,y,x,verticalGapY-68);wall(x,verticalGapY+68,x,y+h);
  wall(x+w,y,x+w,verticalGapY-68);wall(x+w,verticalGapY+68,x+w,y+h);
  wall(x,y+h,horizontalGateX-73,y+h);wall(horizontalGateX+73,y+h,x+w,y+h);
  for(const [tx,ty] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){
    ctx.fillStyle="#77766b";ctx.fillRect(tx-34,ty-34,68,68);
    ctx.strokeStyle="#d5c7a7";ctx.lineWidth=5;ctx.strokeRect(tx-30,ty-30,60,60);
  }
  ctx.font="bold 30px Georgia,serif";ctx.fillStyle="rgba(233,222,184,.58)";
  ctx.textAlign="center";ctx.fillText(city.name,x+w/2,y+120);
}

function paintOverworld(ctx,map,replacedBuildings) {
  ctx.fillStyle="#627751";ctx.fillRect(0,0,map.width,map.height);
  // Authored agricultural plots, not generated terrain.
  for(const f of map.fields){
    ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,f.w,f.h);
    ctx.strokeStyle="rgba(49,74,39,.22)";ctx.lineWidth=8;
    for(let y=f.y+34;y<f.y+f.h;y+=45){
      ctx.beginPath();ctx.moveTo(f.x+14,y);ctx.lineTo(f.x+f.w-14,y);ctx.stroke();
    }
  }
  strokePolyline(ctx,map.river.points,map.river.width+24,"#3b5c59");
  strokePolyline(ctx,map.river.points,map.river.width,"#669b9c");
  strokePolyline(ctx,map.river.points,map.river.width*.42,"rgba(184,216,207,.25)");
  // Road layout is explicit: no per-session random placement.
  for(const road of map.roads){
    strokePolyline(ctx,road.points,road.width+15,"rgba(75,62,43,.38)");
    strokePolyline(ctx,road.points,road.width,"#b7a17d");
    strokePolyline(ctx,road.points,road.width*.58,"#c4ae8c");
  }
  for(const bridge of map.bridges){
    ctx.fillStyle="#766e5c";
    ctx.fillRect(bridge.x-bridge.w/2,bridge.y-bridge.h/2-5,bridge.w,bridge.h+10);
    ctx.fillStyle="#c3b096";
    ctx.fillRect(bridge.x-bridge.w/2,bridge.y-bridge.h/2,bridge.w,bridge.h);
    ctx.strokeStyle="rgba(84,70,55,.38)";ctx.lineWidth=3;
    for(let x=bridge.x-bridge.w/2+14;x<bridge.x+bridge.w/2;x+=21){
      ctx.beginPath();ctx.moveTo(x,bridge.y-bridge.h/2);
      ctx.lineTo(x,bridge.y+bridge.h/2);ctx.stroke();
    }
  }
  for(const grove of map.groves)
    for(const [dx,dy] of grove.trees)paintTree(ctx,grove.x+dx,grove.y+dy);
  paintCityWalls(ctx,map.city);
  // Opt-in World/Graphics contract: the exact ID's placeholder is omitted
  // at TILE BUILD TIME, never erased with an opaque rectangle over terrain.
  // All other building footprints, portals and collision stay authored.
  for(const b of map.buildings)if(!replacedBuildings.has(b.id))paintBuilding(ctx,b);
  for(const p of map.portals){
    ctx.strokeStyle="#e9cf7c";ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(p.x,p.y,17,Math.PI*.05,Math.PI*.95);ctx.stroke();
  }
  ctx.textAlign="center";ctx.fillStyle="#f4e4b9";ctx.font="bold 23px Georgia,serif";
  ctx.fillText("BRIARFORD",1390,3810);
  ctx.fillText("STONEBROOK",6490,3720);
}

function paintInterior(ctx,map) {
  ctx.fillStyle="#2c2824";ctx.fillRect(0,0,map.width,map.height);
  ctx.fillStyle="#715a43";ctx.fillRect(34,34,map.width-68,map.height-68);
  ctx.strokeStyle="#92775a";ctx.lineWidth=2;
  for(let y=50;y<map.height-34;y+=22){
    ctx.beginPath();ctx.moveTo(39,y);ctx.lineTo(map.width-39,y);ctx.stroke();
  }
  // Distinct authored room subdivisions. Doorways remain open at bottom.
  ctx.strokeStyle="#c2b18d";ctx.lineWidth=22;
  ctx.strokeRect(34,34,map.width-68,map.height-68);
  ctx.beginPath();
  ctx.moveTo(260,34);ctx.lineTo(260,210);
  ctx.moveTo(590,34);ctx.lineTo(590,210);ctx.stroke();
  ctx.fillStyle="#d7b787";ctx.fillRect(365,568,50,19);
  ctx.fillStyle="#48382c";ctx.font="bold 25px Georgia,serif";
  ctx.textAlign="center";ctx.fillText("The Red Lion Inn",390,75);
  for(const f of map.furniture){
    const table=f.kind==="table";
    if(f.kind==="rug"){ctx.fillStyle="#8b3d34";ctx.fillRect(f.x,f.y,f.w,f.h);ctx.strokeStyle="#cb9e67";ctx.lineWidth=5;ctx.strokeRect(f.x+7,f.y+7,f.w-14,f.h-14);continue;}
    if(f.kind==="fire"){
      ctx.fillStyle="#423a32";ctx.fillRect(f.x,f.y,f.w,f.h);
      ctx.fillStyle="#e07b3f";ctx.beginPath();ctx.arc(f.x+f.w/2,f.y+f.h/2,26,0,TAU);ctx.fill();
      ctx.fillStyle="#f5c977";ctx.beginPath();ctx.arc(f.x+f.w/2,f.y+f.h/2,13,0,TAU);ctx.fill();
      continue;
    }
    ctx.fillStyle="rgba(19,15,11,.3)";ctx.fillRect(f.x+7,f.y+9,f.w,f.h);
    ctx.fillStyle=table?"#a78054":"#77563b";
    ctx.fillRect(f.x,f.y,f.w,f.h);
    ctx.strokeStyle="#3c2a23";ctx.lineWidth=5;ctx.strokeRect(f.x,f.y,f.w,f.h);
    if(table){
      ctx.fillStyle="#cab188";
      for(const [dx,dy] of [[-14,18],[f.w+7,18],[-14,f.h-27],[f.w+7,f.h-27]])
        ctx.fillRect(f.x+dx,f.y+dy,9,17);
    }
  }
  // Exit is at the south wall, connected to the authored exterior tavern.
  ctx.fillStyle="#d5b283";ctx.fillRect(354,map.height-56,72,22);
  ctx.strokeStyle="#efd197";ctx.lineWidth=4;ctx.strokeRect(354,map.height-56,72,22);
}

export function visibleWorldTiles(camera,width,height,zoom,tileSize=WORLD_TILE_SIZE) {
  if (![camera?.x,camera?.y,width,height,zoom,tileSize].every(Number.isFinite)
    ||width<=0||height<=0||zoom<=0||zoom>2||tileSize<128||tileSize>2048)
    throw new RangeError("invalid world viewport");
  const left=camera.x-width/(2*zoom),top=camera.y-height/(2*zoom);
  const right=camera.x+width/(2*zoom),bottom=camera.y+height/(2*zoom);
  const tiles=[];
  for(let y=Math.floor(top/tileSize);y<=Math.floor(bottom/tileSize);y++)
    for(let x=Math.floor(left/tileSize);x<=Math.floor(right/tileSize);x++){
      if(tiles.length>=64)return tiles;
      tiles.push({x,y,key:x+":"+y});
    }
  return tiles;
}

export function createAuthoredWorldRenderer({makeCanvas=()=>document.createElement("canvas"),
  cacheCap=WORLD_CACHE_CAP,buildLimit=3,replacedBuildingIds=[]}={}) {
  if(!Number.isInteger(cacheCap)||cacheCap<1||cacheCap>64
    ||!Number.isInteger(buildLimit)||buildLimit<0||buildLimit>8)
    throw new RangeError("invalid authored world cache");
  const resolvedIds=normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,replacedBuildingIds);
  const replacedBuildings=new Set(resolvedIds);
  const cache=new Map();
  const stats={cached:0,created:0,visible:0};
  function makeTile(map,x,y){
    const texture=makeCanvas();
    texture.width=texture.height=WORLD_TILE_SIZE;
    const c=texture.getContext("2d",{alpha:false});
    if(!c)throw new Error("2D world canvas unavailable");
    c.save();c.translate(-x*WORLD_TILE_SIZE,-y*WORLD_TILE_SIZE);
    paintOverworld(c,map,replacedBuildings);c.restore();
    return texture;
  }
  return {
    stats,
    // Immutable identity for Graphics; rebuilding with new options creates a
    // new tile cache. Never change an existing cached texture's replacement.
    replacedBuildingIds:resolvedIds,
    clear(){cache.clear();stats.cached=0;},
    draw(ctx,mapId,camera,width,height,zoom){
      const map=getAuthoredMap(mapId);
      if(!map)throw new RangeError("unknown map id");
      const tiles=visibleWorldTiles(camera,width,height,zoom);
      stats.visible=tiles.length;stats.created=0;
      ctx.fillStyle=map.kind==="outdoor"?"#627751":"#29241f";
      ctx.fillRect(width/2-width/(2*zoom),height/2-height/(2*zoom),width/zoom,height/zoom);
      if(map.kind==="interior"){
        ctx.save();ctx.translate(width/2-camera.x,height/2-camera.y);
        paintInterior(ctx,map);ctx.restore();
        return;
      }
      for(const tile of tiles){
        const key=mapId+":"+tile.key;
        let texture=cache.get(key);
        if(texture){cache.delete(key);cache.set(key,texture);}
        else if(stats.created<buildLimit){
          texture=makeTile(map,tile.x,tile.y);
          cache.set(key,texture);stats.created++;
          while(cache.size>cacheCap)cache.delete(cache.keys().next().value);
        }
        const sx=width/2+tile.x*WORLD_TILE_SIZE-camera.x;
        const sy=height/2+tile.y*WORLD_TILE_SIZE-camera.y;
        if(texture)ctx.drawImage(texture,sx,sy);
      }
      stats.cached=cache.size;
    },
  };
}
