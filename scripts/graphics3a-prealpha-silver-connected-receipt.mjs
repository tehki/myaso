// Graphics 3A: fail-closed evidence from TWO real connected online players.
// This validator never treats simulated source reviews as authenticated gameplay.
const frameCount=Object.freeze({
  silver_idle:4,silver_walk:8,silver_sprint:8,
  silver_roll:8,silver_jump:6,
});
export function qualifyPrealphaSilverConnectedClients(clients) {
  if(!Array.isArray(clients)||clients.length!==2) throw new Error("two real browser clients required");
  const distinct=new Set();
  const result=[];
  for(const c of clients) {
    if(!c || (c.engine!=="chrome"&&c.engine!=="firefox"))
      throw new Error("real Chrome+Firefox browser engine required");
    if(!Number.isInteger(c.serverPlayerId)||c.serverPlayerId<=0
      ||!Number.isInteger(c.serverTick)||c.serverTick<=0)
      throw new Error("server-issued player ID and authoritative tick required");
    if(c.realConnected!==true || c.mockedState===true || c.knightsFlag!==true)
      throw new Error("real connected native Silver renderer required");
    if(distinct.has(c.serverPlayerId))throw new Error("server identities not independent");
    distinct.add(c.serverPlayerId);
    if(!Array.isArray(c.draws)||c.draws.length<12)
      throw new Error("native browser Silver source atlas never rendered");
    let sawMovement=false;
    const buckets=new Map();
    for(const draw of c.draws) {
      if(!Object.hasOwn(frameCount,draw.clip))
        throw new Error("unknown or counterfeit Knight clip");
      if(!Number.isInteger(draw.sourceFrame)||draw.sourceFrame<0
        ||draw.sourceFrame>=frameCount[draw.clip])
        throw new Error("invalid Silver source frame");
      if(!Number.isInteger(draw.facing)||draw.facing<0||draw.facing>7)
        throw new Error("invalid eight-direction source facing");
      if(!Number.isFinite(draw.x)||!Number.isFinite(draw.y)
        ||!Number.isFinite(draw.epochMs))
        throw new Error("missing real Canvas transform and time");
      if(draw.clip==="silver_walk"||draw.clip==="silver_sprint")sawMovement=true;
      const bucket=Math.floor(draw.epochMs/90);
      const records=buckets.get(bucket)||[];
      records.push(draw);buckets.set(bucket,records);
    }
    const simultaneous=[...buckets.values()].filter(bucket=>{
      const positions=new Set(bucket.map(o=>[Math.round(o.x/12),Math.round(o.y/12)].join(":")));
      return positions.size>=2;
    }).length;
    if(simultaneous<3)
      throw new Error("both human Silver bodies never concurrently painted in arena");
    if(!sawMovement)throw new Error("real WASD movement did not animate Silver walk/sprint");
    result.push({browser:c.engine,serverPlayerId:c.serverPlayerId,
      serverTick:c.serverTick,sourceDraws:c.draws.length,concurrentBuckets:simultaneous,
      movementVisible:true});
  }
  if(new Set(result.map(r=>r.browser)).size!==2)
    throw new Error("Chrome and Firefox must be separate browsers");
  return {
    authoritativeConnectedTwoPlayerSilver:true,sourceOnly:false,
    genuineWASDMovementObserved:true,players:result,
    fourPlayerProven:false,arenaFloorContactProven:false,
    actualGreyhavenCityProven:false,combatHitReceiptProven:false,
    ownerSpartanKickIncluded:false,productionReleaseApproved:false
  };
}
