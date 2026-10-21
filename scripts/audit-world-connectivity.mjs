// D17 World & Gameplay: BUILD-TIME, conservative walkability connectivity.
// One deterministic flood fill on the existing D2 static preview geometry.
// NOT an online movement pathfinder, teleport, safety guarantee, quest ledger,
// Physics replacement, multiplayer zone graph or production runtime module.
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { MAP_IDS,getAuthoredMap } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";
import { MOONVALE_LANDMARKS } from "../src/world/landmark-discovery.mjs";
import { MOONVALE_FIELD_SITES } from "../src/world/field-survey.mjs";
import { MOONVALE_ROADSIDE_LORE } from "../src/world/roadside-lore.mjs";

export const WORLD_CONNECTIVITY_AUDIT_VERSION=1;
export const WORLD_CONNECTIVITY_STEP=32;
export const WORLD_CONNECTIVITY_SAMPLE_STEP=4;
export const WORLD_CONNECTIVITY_SNAP_RADIUS=2;
const STEPS=Object.freeze([[0,-1],[1,0],[0,1],[-1,0]]);
const DEFAULT_SPAWN=Object.freeze({x:4365,y:4150});

// Stable input and outputs; synthetic maps and collision providers are allowed
// *only* so tests can prove disconnected islands and closed bridges are caught.
// Map validity of each authored target is independently checked by D16.
export function auditAuthoredConnectivity({
  width=getAuthoredMap(MAP_IDS.overworld).width,
  height=getAuthoredMap(MAP_IDS.overworld).height,
  origin=DEFAULT_SPAWN,
  targets=[...MOONVALE_LANDMARKS,...MOONVALE_FIELD_SITES,...MOONVALE_ROADSIDE_LORE],
  walkable=(x,y)=>isAuthoredPreviewWalkable(MAP_IDS.overworld,x,y),
  step=WORLD_CONNECTIVITY_STEP,
}={}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||
     width<step*4||height<step*4||width>8192||height>8192||
     !Number.isInteger(step)||step<8||step>64||
     width%step!==0||height%step!==0||
     typeof walkable!=="function"||!Array.isArray(targets)||targets.length>64)
    throw new RangeError("D17 invalid or unbounded connectivity model");
  const cols=width/step+1,rows=height/step+1,size=cols*rows;
  const index=(gx,gy)=>gy*cols+gx;
  const node=id=>({x:(id%cols)*step,y:Math.floor(id/cols)*step});
  const valid=(gx,gy)=>gx>=1&&gy>=1&&gx<cols-1&&gy<rows-1;
  const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
    p.x>=0&&p.y>=0&&p.x<=width&&p.y<=height;
  const positions=new Int8Array(size);
  const occupied=(gx,gy)=>{
    if(!valid(gx,gy))return false;
    const id=index(gx,gy),cached=positions[id];
    if(cached)return cached===1;
    const clear=Boolean(walkable(gx*step,gy*step));
    positions[id]=clear?1:2;return clear;
  };
  const connection=(a,b)=>{
    if(!walkable(a.x,a.y)||!walkable(b.x,b.y))return false;
    const distance=Math.hypot(b.x-a.x,b.y-a.y);
    if(!Number.isFinite(distance)||distance>Math.max(2*step*Math.SQRT2,step*4))return false;
    const count=Math.max(1,Math.ceil(distance/WORLD_CONNECTIVITY_SAMPLE_STEP));
    for(let k=1;k<count;k++){
      const t=k/count;
      if(!walkable(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;
    }
    return true;
  };
  const snappable=p=>{
    if(!finitePoint(p)||!walkable(p.x,p.y))return [];
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step),result=[];
    for(let dy=-WORLD_CONNECTIVITY_SNAP_RADIUS;dy<=WORLD_CONNECTIVITY_SNAP_RADIUS;dy++){
      for(let dx=-WORLD_CONNECTIVITY_SNAP_RADIUS;dx<=WORLD_CONNECTIVITY_SNAP_RADIUS;dx++){
        const gx=cx+dx,gy=cy+dy;
        if(!occupied(gx,gy))continue;
        const id=index(gx,gy),pos=node(id);
        if(connection(p,pos))result.push(id);
      }
    }
    return result.sort((a,b)=>a-b);
  };
  if(!finitePoint(origin)||!walkable(origin.x,origin.y))
    throw new Error("D17 blocked origin");
  const origins=snappable(origin);
  if(!origins.length)throw new Error("D17 origin has no swept-clear grid anchor");
  const reachable=new Uint8Array(size),queue=new Int32Array(size);
  let head=0,tail=0;
  for(const id of origins)if(!reachable[id]){
    reachable[id]=1;queue[tail++]=id;
  }
  // Orthogonal conservative grid; no corner-cutting. Each accepted edge is
  // sampled at 4 world units or less against the D2 18-unit avatar model.
  while(head<tail){
    const current=queue[head++],gx=current%cols,gy=Math.floor(current/cols),a=node(current);
    for(const [dx,dy] of STEPS){
      const nx=gx+dx,ny=gy+dy;
      if(!occupied(nx,ny))continue;
      const adjacent=index(nx,ny);
      if(reachable[adjacent]||!connection(a,node(adjacent)))continue;
      reachable[adjacent]=1;
      queue[tail++]=adjacent;
    }
  }
  const missing=[],connected=[];
  for(const site of targets){
    const ids=snappable(site);
    const ok=ids.some(id=>Boolean(reachable[id]));
    if(ok)connected.push(String(site.id));
    else missing.push(String(site?.id??"<invalid>"));
  }
  missing.sort();connected.sort();
  return Object.freeze({
    version:WORLD_CONNECTIVITY_AUDIT_VERSION,
    step,sampleStep:WORLD_CONNECTIVITY_SAMPLE_STEP,
    examined:targets.length,
    visitedGridCells:tail,
    totalGridCells:size,
    reachable:Object.freeze(connected),
    unreachable:Object.freeze(missing),
    ok:missing.length===0,
  });
}

if(process.argv[1]&&pathToFileURL(resolvePath(process.argv[1])).href===import.meta.url){
  const report=auditAuthoredConnectivity();
  if(report.ok){
    console.log("World connectivity audit PASS: "+report.examined+" authored sites connected to Greyhaven, "+
      report.visitedGridCells+"/"+report.totalGridCells+" swept-sampled cells.");
  }else{
    console.error("World connectivity audit FAIL: "+report.unreachable.length+" isolated sites:");
    for(const id of report.unreachable)console.error("  UNREACHABLE_SITE: "+id);
    process.exitCode=1;
  }
}
