// D18: build-time preview portal contract / two-zone reachability audit.
// This is NOT a multiplayer zone transfer, network permission, movement
// command, NPC navigation, dynamic obstacle check or player entitlement.
import {pathToFileURL} from "node:url";
import {resolve as resolvePath} from "node:path";
import {MAP_IDS,AUTHORED_MAPS,previewPortalDestination} from "../src/world/authored-maps.mjs";
import {isAuthoredPreviewWalkable} from "../src/world/authored-preview-collision.mjs";
import {auditAuthoredConnectivity} from "./audit-world-connectivity.mjs";

export const WORLD_PORTAL_AUDIT_VERSION=1;
export const PREVIEW_PORTAL_ORIGINS=Object.freeze({
  [MAP_IDS.overworld]:Object.freeze({x:4365,y:4150}),
  [MAP_IDS.tavern]:Object.freeze({x:390,y:480}),
});
export const PREVIEW_PORTAL_GRID_STEPS=Object.freeze({
  [MAP_IDS.overworld]:32,[MAP_IDS.tavern]:20,
});
const frozenResult=(errors,checks=[])=>{
  errors.sort((a,b)=>a.code.localeCompare(b.code)||a.detail.localeCompare(b.detail));
  return Object.freeze({
    version:WORLD_PORTAL_AUDIT_VERSION,
    ok:errors.length===0,
    checks:Object.freeze(checks.sort((a,b)=>a.mapId.localeCompare(b.mapId))
      .map(v=>Object.freeze(v))),
    errors:Object.freeze(errors.map(e=>Object.freeze(e))),
  });
};

// Input overrides support *tests only*. Canonical usage always audits the
// authored maps and D2 collision with D17's conservative static flood fill.
export function auditPreviewPortals({
  maps=AUTHORED_MAPS,
  origins=PREVIEW_PORTAL_ORIGINS,
  gridSteps=PREVIEW_PORTAL_GRID_STEPS,
  walkable=(mapId,x,y)=>isAuthoredPreviewWalkable(mapId,x,y),
}={}) {
  const errors=[],note=(code,detail)=>errors.push({code,detail});
  const names=[MAP_IDS.overworld,MAP_IDS.tavern];
  if(!maps||typeof maps!=="object"||typeof walkable!=="function")
    throw new TypeError("D18 invalid portal audit input");
  const byId=new Map();
  for(const mapId of names){
    const map=maps[mapId];
    if(!map||map.id!==mapId||!Array.isArray(map.portals)||
      map.portals.length<1||map.portals.length>8){
      note("INVALID_MAP",mapId);continue;
    }
    for(const portal of map.portals){
      const id=portal?.id;
      if(typeof id!=="string"||!/^[a-z0-9-]+$/.test(id)){
        note("INVALID_PORTAL_ID",mapId);continue;
      }
      if(byId.has(id))note("DUPLICATE_PORTAL",id);
      byId.set(id,{mapId,portal});
      if(!Number.isFinite(portal.x)||!Number.isFinite(portal.y)||
        !Number.isFinite(portal.radius)||portal.radius<=0||portal.radius>100||
        portal.x<=18||portal.y<=18||
        portal.x>=map.width-18||portal.y>=map.height-18)
        note("INVALID_PORTAL_GEOMETRY",id);
      else if(!walkable(mapId,portal.x,portal.y))
        note("BLOCKED_PORTAL",id);
      if(!names.includes(portal.targetMap)||typeof portal.targetPortal!=="string")
        note("UNKNOWN_PORTAL_DESTINATION",id);
    }
  }
  for(const {mapId,portal} of byId.values()){
    const entry=byId.get(portal.targetPortal);
    if(!entry || entry.mapId!==portal.targetMap){
      note("MISSING_RECIPROCAL_PORTAL",portal.id);continue;
    }
    if(entry.portal.targetMap!==mapId||entry.portal.targetPortal!==portal.id)
      note("NONRECIPROCAL_PORTAL",portal.id);
  }
  if(errors.length)return frozenResult(errors);

  const checks=[];
  for(const mapId of names){
    const map=maps[mapId],origin=origins?.[mapId],step=gridSteps?.[mapId];
    if(!Number.isInteger(map.width)||!Number.isInteger(map.height)||
      !Number.isInteger(step)||step<8||step>64||
      map.width%step!==0||map.height%step!==0||
      !origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.y)){
      note("INVALID_CONNECTIVITY_CONFIG",mapId);continue;
    }
    const targets=[];
    for(const portal of map.portals){
      targets.push({id:"trigger:"+portal.id,x:portal.x,y:portal.y});
    }
    for(const [sourceId,sourceMap] of names.map(n=>[n,maps[n]])){
      for(const portal of sourceMap.portals){
        if(portal.targetMap!==mapId)continue;
        const destination=map.portals.find(p=>p.id===portal.targetPortal);
        const landing={
          x:destination.x,
          y:destination.y+(map.kind==="outdoor"?68:-70),
        };
        if(!Number.isFinite(landing.x)||!Number.isFinite(landing.y)||
          !walkable(mapId,landing.x,landing.y)){
          note("BLOCKED_PORTAL_LANDING",sourceId+":"+portal.id);continue;
        }
        if(maps===AUTHORED_MAPS){
          const canonical=previewPortalDestination(sourceId,portal.id);
          if(!canonical||canonical.mapId!==mapId||
            canonical.x!==landing.x||canonical.y!==landing.y)
            note("PORTAL_HELPER_DRIFT",sourceId+":"+portal.id);
        }
        targets.push({id:"landing:"+portal.id,x:landing.x,y:landing.y});
      }
    }
    // All portal trigger/landing positions must be connected to the spawn
    // *within their own zone*. The cross-zone transfer itself is conceptual
    // here; the live server is not authorized by a passing build-time audit.
    try{
      const report=auditAuthoredConnectivity({
        width:map.width,height:map.height,step,origin,targets,
        walkable:(x,y)=>walkable(mapId,x,y),
      });
      for(const id of report.unreachable)note("UNREACHABLE_PORTAL_POINT",mapId+":"+id);
      checks.push({mapId,points:targets.length,reachable:report.reachable.length,
        gridCells:report.totalGridCells,visitedCells:report.visitedGridCells});
    }catch(e){
      note("PORTAL_ZONE_TRAVERSAL_ERROR",mapId+":"+String(e.message));
    }
  }
  return frozenResult(errors,checks);
}

if(process.argv[1]&&pathToFileURL(resolvePath(process.argv[1])).href===import.meta.url){
  const report=auditPreviewPortals();
  if(report.ok){
    console.log("World portal audit PASS: "+report.checks.length+
      " reciprocal zones; "+report.checks.reduce((n,c)=>n+c.points,0)+
      " spawn-reachable trigger/landing points.");
  }else{
    console.error("World portal audit FAIL: "+report.errors.length+" problem(s):");
    for(const e of report.errors)console.error("  "+e.code+": "+e.detail);
    process.exitCode=1;
  }
}
