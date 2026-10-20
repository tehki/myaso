// D16: deterministic build-time authoring audit for Moonvale's OFFLINE world.
// This is not a live game service, movement authority, economy ledger,
// quest grant, persistence mechanism or a replacement for Combat/Physics CI.
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { MAP_IDS,getAuthoredMap } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";
import { MOONVALE_LANDMARKS } from "../src/world/landmark-discovery.mjs";
import { FIELD_SURVEY_REACH,MOONVALE_FIELD_SITES } from "../src/world/field-survey.mjs";
import { ROADSIDE_LORE_REACH,MOONVALE_ROADSIDE_LORE } from "../src/world/roadside-lore.mjs";
import { MOONVALE_EXPEDITIONS } from "../src/world/local-expeditions.mjs";
import { CERTIFIED_TRAILS,CERTIFIED_TRAIL_SAMPLE_UNITS } from "../src/world/certified-trails.mjs";
import { MOONVALE_CHRONICLE_THREADS } from "../src/world/chronicle-threads.mjs";

export const WORLD_AUTHORING_AUDIT_VERSION=1;
const world=getAuthoredMap(MAP_IDS.overworld);
const key=(a,b)=>a+" -> "+b;
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const idOK=id=>typeof id==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const frozen=o=>Object.isFrozen(o);

// All collections can be overridden for tests or offline authoring. No source
// manifest is mutated by the auditor; diagnostics have stable codes/order.
export function auditMoonvaleAuthoring({
  landmarks=MOONVALE_LANDMARKS,
  fields=MOONVALE_FIELD_SITES,
  lore=MOONVALE_ROADSIDE_LORE,
  expeditions=MOONVALE_EXPEDITIONS,
  trails=CERTIFIED_TRAILS,
  threads=MOONVALE_CHRONICLE_THREADS,
}={}) {
  const errors=[];
  const issue=(code,detail)=>errors.push(Object.freeze({code,detail}));
  // D16 baseline floors: adding world content is welcome, but accidentally
  // deleting an established manifest must require a deliberate audit update.
  const floors=[
    ["landmarks",landmarks,4],["fields",fields,8],["lore",lore,6],
    ["expeditions",expeditions,3],["trails",trails,7],["threads",threads,2],
  ];
  for(const [name,list,min] of floors){
    if(!Array.isArray(list)||list.length<min)
      issue("MANIFEST_SHRINK",name+": expected at least "+min);
  }
  const lists=[["landmark",landmarks],["field",fields],["lore",lore]];
  const all=new Map(),byKind=new Map();
  for (const [kind,sites] of lists) {
    const owned=new Map();byKind.set(kind,owned);
    for (const [i,site] of sites.entries()) {
      const label=kind+"["+i+"]";
      if(!idOK(site?.id)){issue("INVALID_ID",label);continue;}
      if(all.has(site.id))issue("DUPLICATE_SITE",site.id);
      all.set(site.id,site);
      owned.set(site.id,site);
      if(site.mapId!==MAP_IDS.overworld || !finite(site.x) || !finite(site.y) ||
        site.x<18 || site.y<18 || site.x>world.width-18 ||
        site.y>world.height-18 ||
        !isAuthoredPreviewWalkable(site.mapId,site.x,site.y))
        issue("BLOCKED_SITE",site.id);
      if(kind==="landmark"&&(!finite(site.radius)||site.radius<=0||site.radius>200))
        issue("INVALID_REACH",site.id);
      if(kind!=="landmark"&&(
        typeof site.clue!=="string"||site.clue.length<20))
        issue("INVALID_CLUE",site.id);
      if(!frozen(site))issue("MUTABLE_SITE",site.id);
    }
    if(!frozen(sites))issue("MUTABLE_MANIFEST",kind);
  }
  const nearest=(sites,x,y,reach)=>{
    let chosen=null,closest=reach*reach;
    for (const site of sites) {
      if(!finite(site?.x)||!finite(site?.y))continue;
      const d=(site.x-x)**2+(site.y-y)**2;
      if(d<=closest&&(chosen===null||d<closest)){
        chosen=site;closest=d;
      }
    }
    return chosen?Object.freeze({site:chosen,distance2:closest}):null;
  };
  function fTarget(x,y) {
    const field=nearest(fields,x,y,FIELD_SURVEY_REACH);
    const story=nearest(lore,x,y,ROADSIDE_LORE_REACH);
    return story&&(!field||story.distance2<field.distance2)?
      {kind:"lore",site:story.site}:{kind:"field",site:field?.site??null};
  }
  for (const [kind,sites] of [["field",fields],["lore",lore]]) {
    for (const site of sites) {
      if(!idOK(site?.id)||!finite(site.x)||!finite(site.y))continue;
      const target=fTarget(site.x,site.y);
      if(target.kind!==kind||target.site?.id!==site.id)
        issue("SHADOWED_F_INTERACTION",site.id+" by "+String(target.site?.id));
    }
  }
  const legs=new Set(),routeIds=new Set();
  for(const [i,route] of expeditions.entries()) {
    if(!idOK(route?.id) || routeIds.has(route.id))
      issue("INVALID_ROUTE",String(route?.id??i));
    routeIds.add(route?.id);
    if(!Array.isArray(route?.steps)||route.steps.length<2) {
      issue("INVALID_STEPS",String(route?.id??i));continue;
    }
    for(const [j,step] of route.steps.entries()){
      const expected=step?.action==="visit"?byKind.get("landmark").get(step?.site?.id):
        step?.action==="inspect"?byKind.get("field").get(step?.site?.id):null;
      if(!expected || step.site!==expected)
        issue("BAD_ROUTE_REFERENCE",String(route.id)+"/"+j);
      if(j===0)continue;
      const from=route.steps[j-1]?.site?.id,to=step?.site?.id;
      if(idOK(from)&&idOK(to))legs.add(key(from,to));
      if(from===to)issue("DUPLICATE_MILESTONE",String(route.id)+"/"+j);
    }
    if(!frozen(route)||!frozen(route.steps))issue("MUTABLE_ROUTE",String(route.id));
  }
  if(!frozen(expeditions))issue("MUTABLE_MANIFEST","expeditions");

  const trailKeys=new Set();
  for(const [i,trail] of trails.entries()){
    const name=key(trail?.from,trail?.to);
    if(trailKeys.has(name))issue("DUPLICATE_TRAIL",name);
    trailKeys.add(name);
    if(!legs.has(name))issue("ORPHAN_TRAIL",name);
    const from=all.get(trail?.from),to=all.get(trail?.to);
    const points=trail?.points;
    if(!from||!to||!Array.isArray(points)||points.length<2||points.length>64){
      issue("INVALID_TRAIL",String(i)+":"+name);continue;
    }
    for(const [j,point] of points.entries()){
      if(!Array.isArray(point)||point.length!==2||
        !finite(point[0])||!finite(point[1])){
        issue("INVALID_WAYPOINT",name+"/"+j);continue;
      }
      if(!isAuthoredPreviewWalkable(MAP_IDS.overworld,point[0],point[1]))
        issue("BLOCKED_WAYPOINT",name+"/"+j);
    }
    const first=points[0],last=points.at(-1);
    if(first?.[0]!==from.x||first?.[1]!==from.y ||
      last?.[0]!==to.x||last?.[1]!==to.y)
      issue("TRAIL_ENDPOINT_DRIFT",name);
    for(let j=1;j<points.length;j++){
      const a=points[j-1],b=points[j];
      if(!Array.isArray(a)||!Array.isArray(b)||
        ![...a,...b].every(finite))continue;
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(!(length>0)){issue("ZERO_LENGTH_SEGMENT",name+"/"+j);continue;}
      const count=Math.ceil(length/CERTIFIED_TRAIL_SAMPLE_UNITS);
      for(let k=1;k<count;k++){
        const t=k/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
        if(!isAuthoredPreviewWalkable(MAP_IDS.overworld,x,y)){
          issue("BLOCKED_TRAIL_SEGMENT",name+"/"+j);break;
        }
      }
    }
    if(!frozen(trail)||!frozen(points)||points.some(p=>!frozen(p)))
      issue("MUTABLE_TRAIL",name);
  }
  for(const leg of legs)if(!trailKeys.has(leg))issue("MISSING_TRAIL",leg);
  if(!frozen(trails))issue("MUTABLE_MANIFEST","trails");

  const storyIds=new Set(),threadIds=new Set();
  for(const [i,thread] of threads.entries()){
    if(!idOK(thread?.id)||threadIds.has(thread.id))issue("INVALID_THREAD",String(thread?.id??i));
    threadIds.add(thread?.id);
    if(!Array.isArray(thread?.siteIds)||thread.siteIds.length!==3){
      issue("INVALID_THREAD_SITES",String(thread?.id??i));continue;
    }
    for(const id of thread.siteIds){
      if(storyIds.has(id))issue("DUPLICATE_STORY_SITE",String(id));
      storyIds.add(id);
      if(!byKind.get("lore").has(id))issue("UNKNOWN_STORY_SITE",String(id));
    }
    if(!frozen(thread)||!frozen(thread.siteIds))
      issue("MUTABLE_THREAD",String(thread.id));
  }
  for(const site of lore)if(!storyIds.has(site.id))issue("UNLINKED_LORE",site.id);
  if(!frozen(threads))issue("MUTABLE_MANIFEST","threads");

  errors.sort((a,b)=>a.code.localeCompare(b.code)||a.detail.localeCompare(b.detail));
  return Object.freeze({
    version:WORLD_AUTHORING_AUDIT_VERSION,
    counts:Object.freeze({
      landmarks:landmarks.length,fields:fields.length,lore:lore.length,
      routes:expeditions.length,certifiedLegs:trails.length,threads:threads.length,
    }),
    ok:errors.length===0,
    errors:Object.freeze(errors),
  });
}

if(process.argv[1]&&pathToFileURL(resolvePath(process.argv[1])).href===import.meta.url){
  const r=auditMoonvaleAuthoring();
  if(r.ok){
    console.log("World authoring audit PASS: "+r.counts.landmarks+" landmarks, "+
      r.counts.fields+" field sites, "+r.counts.lore+" lore sites, "+
      r.counts.routes+" expeditions, "+r.counts.certifiedLegs+
      " certified legs, "+r.counts.threads+" story threads.");
  }else{
    console.error("World authoring audit FAILED: "+r.errors.length+" invariant(s).");
    for(const e of r.errors)console.error("  "+e.code+": "+e.detail);
    process.exitCode=1;
  }
}
