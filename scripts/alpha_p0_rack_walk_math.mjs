// Pure integration-test planner: coordinate math only, NEVER creates item IDs
// or authorizes physical sword pickup. No gameplay movement authority.
export function nextNativeWalkPulse(from,to){
  if(!Number.isFinite(from)||!Number.isFinite(to))throw Error("nonfinite walk coordinates");
  const delta=to-from;
  if(Math.abs(delta)<=12)return Object.freeze({done:true,key:null,holdMs:0,distance:Math.abs(delta)});
  // Bounded genuine W3C keyboard pulse, corrected after fresh Rust position ACK.
  // Open-loop speed is only a conservative hint; authoritative server position
  // is re-read after each pulse. <=550ms prevents large speculative overshoot.
  const holdMs=Math.max(75,Math.min(550,Math.round(Math.abs(delta)*2.4)));
  return Object.freeze({done:false,key:delta<0?"negative":"positive",holdMs,distance:Math.abs(delta)});
}
export function nativeRackArrived(current,target,tolerance=18){
  return !!current&&!!target&&Number.isFinite(current.x)&&Number.isFinite(current.y)
    &&Number.isFinite(target.x)&&Number.isFinite(target.y)
    &&Number.isFinite(tolerance)&&tolerance>=0&&tolerance<=18
    &&Math.hypot(current.x-target.x,current.y-target.y)<=tolerance;
}

/** Provisional World #639 standing target, not a server-authorized item click. */
export function proposedNativeRackReachPoint(slot){
  if(!slot||!Number.isFinite(slot.x)||!Number.isFinite(slot.y)
    ||!slot.approach||slot.approach.x!==slot.x
    ||slot.approach.y-slot.y!==50)
    throw Error("unreviewed authored Blacksmith socket/stand fixture");
  return Object.freeze({x:slot.x,y:slot.y+30});
}
/** Conservative OFFLINE prototype radius only. Not current item or LOS authority. */
export function nativeRackWithinProposedReach(position,slot,limit=56){
  if(!position||!slot||![position.x,position.y,slot.x,slot.y,limit].every(Number.isFinite)
    ||limit!==56)return false;
  return Math.hypot(position.x-slot.x,position.y-slot.y)<=limit;
}

/** Read-only REAL-browser acceptance. Reject diverged Rust actor positions;
 * local protocol and item authority never consume this verifier. */
export function verifyNativeRackPeerConsensus(views,witnessed,slots){
  const fail=(why)=>{throw Error("native rack peer consensus: "+why)};
  if(!Array.isArray(views)||views.length!==4||!Array.isArray(witnessed)
    ||witnessed.length!==4||!Array.isArray(slots)||slots.length!==4)
    fail("need precisely four actors/observers/World sockets");
  const own=[];
  for(let i=0;i<4;i++){
    const w=witnessed[i],r=w?.proposedReach,s=slots[i];
    if(w?.id!==i+1||w.socketId!==s?.socketId
      ||r?.observedPosition?.netId!==i+1
      ||!Number.isSafeInteger(r.serverTick)||r.serverTick<=0
      ||!nativeRackArrived(r.observedPosition,proposedNativeRackReachPoint(s))
      ||!nativeRackWithinProposedReach(r.observedPosition,s))
      fail("invalid actual own-player end witness");
    own.push(r);
  }
  const newestOwnTick=Math.max(...own.map(x=>x.serverTick));
  const four=new Map([1,2,3,4].map(id=>[id,[]]));
  for(let i=0;i<4;i++){
    const v=views[i];
    if(v?.id!==i+1||!Number.isSafeInteger(v.tick)||v.tick<=newestOwnTick
      ||!Array.isArray(v.fighters)||v.fighters.length!==4)
      fail("invalid, stale or duplicated native browser viewer");
    const ids=new Set();
    for(const f of v.fighters){
      const id=f?.netId;
      if(!Number.isSafeInteger(id)||id<1||id>4||ids.has(id)
        ||![f.x,f.y].every(Number.isFinite))
        fail("ghost, duplicate, missing or nonfinite fighter");
      ids.add(id);
      const s=slots[id-1],p=own[id-1].observedPosition;
      if(!nativeRackArrived(f,proposedNativeRackReachPoint(s))
        ||!nativeRackWithinProposedReach(f,s)
        ||Math.hypot(f.x-p.x,f.y-p.y)>8)
        fail("remote position diverges from real W3C owner or exact sword socket "+id);
      four.get(id).push(f);
    }
    if(ids.size!==4)fail("missing actual fighter");
  }
  let maxPeerDrift=0;
  for(const [id,points] of four){
    if(points.length!==4)fail("missing fighter "+id);
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      const d=Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y);
      if(d>8)fail("browser peers disagree on fighter "+id);
      maxPeerDrift=Math.max(maxPeerDrift,d);
    }
  }
  return Object.freeze({realNativeObserverCount:4,realRustFighterCount:4,
    maxPeerDrift,worldUnitBound:8,readOnly:true,
    itemPickupApproved:false,productionApproval:false});
}

/** Genuine replacement-browser acceptance ONLY. Does not persist swords or
 * authenticate a resumed character: Rust must issue a NEW net ID. */
export function verifyNativeRackRecoveryPeerConsensus(views,slots,rejoinTick){
  const fail=(why)=>{throw Error("native rack crash recovery: "+why)};
  const ids=[1,3,4,5];
  const socketByPlayer=new Map([[1,0],[3,2],[4,3],[5,1]]);
  if(!Array.isArray(views)||views.length!==4||!Array.isArray(slots)
    ||slots.length!==4||!Number.isSafeInteger(rejoinTick)||rejoinTick<=0)
    fail("exact real four-observer/sockets/rejoin tick required");
  const positions=new Map(ids.map(id=>[id,[]]));
  for(let i=0;i<4;i++){
    const v=views[i];
    if(v?.id!==ids[i]||!Number.isSafeInteger(v.tick)
      ||v.tick<=rejoinTick||!Array.isArray(v.fighters)
      ||v.fighters.length!==4
      ||!Array.isArray(v.scoreboard))
      fail("missing, stale, duplicate or illegitimate recovery viewer");
    const seen=new Set();
    for(const fighter of v.fighters){
      const id=fighter?.netId,slot=slots[socketByPlayer.get(id)];
      if(!ids.includes(id)||seen.has(id)||!slot
        ||![fighter.x,fighter.y].every(Number.isFinite)
        ||!nativeRackArrived(fighter,proposedNativeRackReachPoint(slot))
        ||!nativeRackWithinProposedReach(fighter,slot))
        fail("stale dead player, unexpected actor or incorrect nominal rack socket");
      seen.add(id);
      positions.get(id).push(fighter);
    }
    if(seen.size!==4||v.scoreboard.some(row=>row.startsWith("#2"))
      ||ids.some(id=>!v.scoreboard.some(row=>row.startsWith("#"+id))))
      fail("stale dead-player scoreboard or missing new session");
  }
  let maxPeerDrift=0;
  for(const [id,points] of positions){
    if(points.length!==4)fail("not all browser peers saw new live fighter "+id);
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      const d=Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y);
      if(d>8)fail("inconsistent actual surviving/replacement Rust position "+id);
      maxPeerDrift=Math.max(d,maxPeerDrift);
    }
  }
  return Object.freeze({
    realBrowserViewers:4,liveIds:Object.freeze([...ids]),
    rejectedGhostPlayerId:2,issuedReplacementPlayerId:5,
    maxPeerDrift,worldUnitBound:8,
    sameHostOnly:true,liveSwordOwnershipProven:false,
    characterIdentityRecoveryProven:false,releaseApproval:false,
  });
}
