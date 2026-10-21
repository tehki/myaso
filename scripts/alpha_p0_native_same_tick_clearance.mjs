// Core 8A acceptance ONLY: a SINGLE authoritative native snapshot tick,
// not four independently sampled end positions, must hold four non-overlapping
// radius-18 actors near four distinct empty World rack sockets.
// Core 8C owns live collision and epoch; this code NEVER mutates players/items.
import {
  nativeRackArrived,nativeRackWithinProposedReach,proposedNativeRackReachPoint
} from "./alpha_p0_rack_walk_math.mjs";

export function assessNativeSameTickRackClearance(views,slots,phase){
  const fail=(reason,more={})=>Object.freeze({
    ok:false,phase,reason,...more,
    realPhysicalSwordsProven:false,releaseApproval:false,
  });
  const after=phase==="after-replacement";
  if(phase!=="initial"&&!after)return fail("unreviewed scene phase");
  const ids=after?[1,3,4,5]:[1,2,3,4];
  const socketIndex=new Map([[1,0],[3,2],[4,3],[after?5:2,1]]);
  if(!Array.isArray(views)||views.length!==4||!Array.isArray(slots)
    ||slots.length!==4||slots.some(s=>!s||!Number.isFinite(s.x)
      ||!Number.isFinite(s.y)))return fail("four exact original World fixtures required");
  const viewerIds=new Set();
  for(const view of views){
    if(!ids.includes(view?.id)||viewerIds.has(view.id)
      ||!Number.isSafeInteger(view.tick)||view.tick<1
      ||!Array.isArray(view.fighters)||view.fighters.length!==4
      ||!Array.isArray(view.scoreboard))
      return fail("missing, stale or duplicate real browser snapshot");
    viewerIds.add(view.id);
    const actualIds=view.fighters.map(p=>p?.netId).sort((a,b)=>a-b);
    if(actualIds.some((id,i)=>id!==ids[i])
      ||ids.some(id=>!view.scoreboard.some(row=>typeof row==="string"
        &&row.startsWith("#"+id)))
      ||(after&&view.scoreboard.some(row=>typeof row==="string"
        &&/^#2(?:\D|$)/.test(row))))
      return fail("missing actor, ghost fighter or stale scoreboard");
  }
  // A single real Rust snapshot frame contains all four fighter positions at
  // one server tick. Individual player arrival logs from different ticks do NOT.
  const sample=views.reduce((a,b)=>b.tick>a.tick?b:a);
  const positions=new Map();
  for(const p of sample.fighters){
    const slot=slots[socketIndex.get(p.netId)];
    if(![p.x,p.y].every(Number.isFinite)||!slot
      ||!nativeRackArrived(p,proposedNativeRackReachPoint(slot))
      ||!nativeRackWithinProposedReach(p,slot))
      return fail("actual same-tick fighter not near its exact original rack",
        {serverTick:sample.tick,playerId:p.netId});
    positions.set(p.netId,p);
  }
  // Replication consistency protects this single-frame proof from a wildly
  // stale or conflicting second browser. It is not a distributed tick fence.
  let maxObserverDrift=0;
  for(const view of views){
    for(const p of view.fighters){
      const ref=positions.get(p?.netId);
      if(!ref||![p.x,p.y].every(Number.isFinite))
        return fail("observer missing finite server-replicated fighter",
          {serverTick:sample.tick,observerId:view.id});
      const drift=Math.hypot(p.x-ref.x,p.y-ref.y);
      if(drift>8)return fail("independent browser replication diverges",
        {serverTick:sample.tick,observerId:view.id,playerId:p.netId,drift});
      maxObserverDrift=Math.max(maxObserverDrift,drift);
    }
  }
  const pairs=[];
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
    const a=ids[i],b=ids[j];
    const p=positions.get(a),q=positions.get(b);
    const distance=Math.hypot(p.x-q.x,p.y-q.y);
    pairs.push({a,b,distance,minimum:36,clear:distance>=36});
  }
  const overlaps=pairs.filter(p=>!p.clear);
  return Object.freeze({
    ok:overlaps.length===0,
    phase,sourceViewerId:sample.id,serverTick:sample.tick,
    actualActors:ids,assumedActorRadius:18,minimumCenterDistance:36,
    peerObserverCount:4,maxObserverDrift,pairs,
    reason:overlaps.length?"simultaneous same-tick actor overlap":"clear",
    realPhysicalSwordsProven:false,releaseApproval:false,
  });
}
