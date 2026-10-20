// D9 OFFLINE build-time travel corridors; no runtime A* or server authority.
// Deterministic collision-certified polylines connect authored expedition stages.
// Run node scripts/generate-world-trails.mjs [--check].
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import { MOONVALE_LANDMARKS } from "../src/world/landmark-discovery.mjs";
import { MOONVALE_FIELD_SITES } from "../src/world/field-survey.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";
import { MOONVALE_EXPEDITIONS } from "../src/world/local-expeditions.mjs";

const output=fileURLToPath(new URL("../src/world/certified-trails.mjs",import.meta.url));
const STEP=32, WIDTH=257, LIMIT=WIDTH*WIDTH;
const nodes=new Map([...MOONVALE_LANDMARKS,...MOONVALE_FIELD_SITES].map(s=>[s.id,s]));
const walk=(x,y)=>isAuthoredPreviewWalkable(MAP_IDS.overworld,x,y);
const neighbours=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
const gridKey=(x,y)=>y*WIDTH+x;
const xy=id=>({x:(id%WIDTH)*STEP,y:Math.floor(id/WIDTH)*STEP});
const edgeOK=(a,b)=>{
  if(!walk(a.x,a.y)||!walk(b.x,b.y))return false;
  const d=Math.hypot(a.x-b.x,a.y-b.y),n=Math.max(1,Math.ceil(d/4));
  for(let i=1;i<n;i++){const t=i/n;if(!walk(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}
  return true;
};
class Heap {
  data=[];
  push(v){const a=this.data;let i=a.length;a.push(v);while(i>0){const j=(i-1)>>1;if(a[j].f<v.f || (a[j].f===v.f&&a[j].id<=v.id))break;a[i]=a[j];i=j;}a[i]=v;}
  pop(){const a=this.data,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&(a[j+1].f<a[j].f||(a[j+1].f===a[j].f&&a[j+1].id<a[j].id)))j++;if(last.f<a[j].f||(last.f===a[j].f&&last.id<=a[j].id))break;a[i]=a[j];i=j;}a[i]=last;}return first;}
  get size(){return this.data.length;}
}
const roundGrid=(point)=>{
  const cx=Math.round(point.x/STEP),cy=Math.round(point.y/STEP);
  const attempts=[];
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const x=cx+dx,y=cy+dy;
    if(x<=0||y<=0||x>=WIDTH-1||y>=WIDTH-1)continue;
    const p={x:x*STEP,y:y*STEP};
    const dist=Math.hypot(point.x-p.x,point.y-p.y);
    if(edgeOK(point,p))attempts.push({id:gridKey(x,y),dist});
  }
  attempts.sort((a,b)=>a.dist-b.dist || a.id-b.id);
  if(!attempts.length)throw Error("No walkable start/end grid snap: "+JSON.stringify(point));
  return attempts[0].id;
};
function pathBetween(start,end){
  if(!walk(start.x,start.y)||!walk(end.x,end.y))throw Error("Blocked trail endpoint");
  if(edgeOK(start,end))return [[start.x,start.y],[end.x,end.y]];
  const sid=roundGrid(start),tid=roundGrid(end);
  const heap=new Heap(),g=new Float64Array(LIMIT),prev=new Int32Array(LIMIT),closed=new Uint8Array(LIMIT);
  g.fill(Infinity);prev.fill(-1);g[sid]=0;
  const target=xy(tid);
  const h=p=>Math.hypot(target.x-p.x,target.y-p.y);
  heap.push({id:sid,f:h(xy(sid))});
  let expanded=0;
  while(heap.size){
    const cur=heap.pop(),i=cur.id;
    if(closed[i])continue;
    closed[i]=1;expanded++;
    if(i===tid)break;
    if(expanded>LIMIT)throw Error("Unbounded travel search");
    const a=xy(i);
    for(const [dx,dy] of neighbours){
      const nx=a.x/STEP+dx,ny=a.y/STEP+dy;
      if(nx<=0||ny<=0||nx>=WIDTH-1||ny>=WIDTH-1)continue;
      const j=gridKey(nx,ny);
      if(closed[j])continue;
      const b={x:nx*STEP,y:ny*STEP};
      if(!edgeOK(a,b))continue;
      const ng=g[i]+Math.hypot(dx,dy)*STEP;
      if(ng>=g[j]-1e-9)continue;
      g[j]=ng;prev[j]=i;heap.push({id:j,f:ng+h(b)});
    }
  }
  if(!closed[tid])throw Error("No collision-safe corridor between "+JSON.stringify(start)+" and "+JSON.stringify(end));
  const raw=[];
  for(let id=tid;id!==sid;id=prev[id]){
    if(id<0||raw.length>LIMIT)throw Error("Malformed A* reconstruction");
    const p=xy(id);raw.push([p.x,p.y]);
  }
  raw.push([xy(sid).x,xy(sid).y]);raw.reverse();
  const points=[[start.x,start.y],...raw,[end.x,end.y]];
  // Use furthest visible point: deterministic static corridor simplification.
  const out=[points[0]];
  let cur=0;
  while(cur<points.length-1){
    let far=cur+1;
    for(let j=points.length-1;j>cur+1;j--)
      if(edgeOK({x:points[cur][0],y:points[cur][1]},{x:points[j][0],y:points[j][1]})){far=j;break;}
    out.push(points[far]);cur=far;
  }
  for(let i=1;i<out.length;i++){
    if(!edgeOK({x:out[i-1][0],y:out[i-1][1]},
      {x:out[i][0],y:out[i][1]}))throw Error("Post-simplification collision!");
  }
  return out;
}
const pairs=[];
const seen=new Set();
for(const route of MOONVALE_EXPEDITIONS){
  for(let i=1;i<route.steps.length;i++){
    const from=route.steps[i-1].site.id,to=route.steps[i].site.id,key=from+"->"+to;
    if(!seen.has(key)){seen.add(key);pairs.push({from,to});}
  }
}
const trails=pairs.map(pair=>{
  const a=nodes.get(pair.from),b=nodes.get(pair.to);
  const path=pathBetween(a,b);
  return {from:pair.from,to:pair.to,points:path};
});
const payload=JSON.stringify(trails,null,2);
const content=`// D9 AUTOGENERATED from scripts/generate-world-trails.mjs.
// All segments are D2 collision-checked at <=4 world-unit intervals.
// These are fixed preview-only expedition corridors, not server navigation.
// Do not edit directly; regenerate and review diff.
export const CERTIFIED_TRAILS_VERSION = 1;
export const CERTIFIED_TRAIL_SAMPLE_UNITS = 4;
export const CERTIFIED_TRAILS = Object.freeze(${payload}.map(item => Object.freeze({from:item.from,to:item.to,points:Object.freeze(item.points.map(pair=>Object.freeze(pair)))})));
`;
if(process.argv.includes("--check")){
  if(readFileSync(output,"utf8").replace(/\r\n/g,"\n")!==content){
    console.error("D9 certified trail fixture out of sync");process.exitCode=1;
  }else console.log("D9 certified corridors match: "+trails.length+" ordered legs, "+trails.reduce((n,t)=>n+t.points.length,0)+" points");
}else{
  writeFileSync(output,content);
  for(const item of trails)console.log(item.from+" -> "+item.to+": "+item.points.length+" points");
}
