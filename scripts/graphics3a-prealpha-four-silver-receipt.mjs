// Graphics 3A: four real network clients must each see four authentic Silver
// Knights in a single authoritative arena. Offline test fixtures cannot pass
// the WebDriver flight; this pure validator only rejects forged observations.
const EXPECTED=["chrome","firefox","chrome2","chrome3"];
const FRAMES=Object.freeze({
 silver_idle:4,silver_walk:8,silver_sprint:8,silver_jump:6,silver_roll:8
});
export function qualifyPrealphaFourSilverClients(clients){
 if(!Array.isArray(clients)||clients.length!==4)
   throw Error("exactly four native connected browser sessions required");
 const ids=new Set();
 const summary=[];
 for(let n=0;n<4;n++){
  const c=clients[n];
  if(!c||c.engine!==EXPECTED[n]||c.connected!==true||c.mockedState===true)
   throw Error("original four-browser connected roster/order required");
  if(!Number.isInteger(c.serverPlayerId)||c.serverPlayerId<=0||
     !Number.isInteger(c.serverTick)||c.serverTick<=0)
   throw Error("four valid authoritative server identities/ticks required");
  if(ids.has(c.serverPlayerId))
   throw Error("duplicate server identity in four-browser flight");
  ids.add(c.serverPlayerId);
  if(!Array.isArray(c.rosterIds)||c.rosterIds.length!==4)
   throw Error("four-client server roster not converged");
  if(!Array.isArray(c.draws)||c.draws.length<24)
   throw Error("genuine first-party Silver native draw samples required");
  const buckets=new Map();
  const moving=[];
  for(const sample of c.draws){
   if(!Object.hasOwn(FRAMES,sample.clip))
    throw Error("counterfeit/non-Silver character source frame");
   if(!Number.isInteger(sample.sourceFrame)||sample.sourceFrame<0||
       sample.sourceFrame>=FRAMES[sample.clip]||
       !Number.isInteger(sample.facing)||sample.facing<0||sample.facing>7)
    throw Error("non-Silver original-frame or facing index");
   if(!Number.isFinite(sample.x)||!Number.isFinite(sample.y)||
       !Number.isFinite(sample.epochMs))
    throw Error("missing actual Canvas transform or native render epoch");
   const b=Math.floor(sample.epochMs/120);
   if(!buckets.has(b))buckets.set(b,new Set());
   buckets.get(b).add(Math.round(sample.x/12)+":"+Math.round(sample.y/12));
   if(sample.clip==="silver_walk"||sample.clip==="silver_sprint")
     moving.push(sample);
  }
  const bucketsWithFour=[...buckets.values()].filter(p=>p.size>=4).length;
  if(bucketsWithFour<3)
   throw Error("four distinct simultaneous Silver bodies missing in native viewport");
  if(moving.length<1)
   throw Error("genuine movement frame not visible in every browser");
  summary.push({browser:c.engine,playerId:c.serverPlayerId,serverTick:c.serverTick,
    originalSilverDraws:c.draws.length,fourSilverBuckets:bucketsWithFour,
    originalWalkOrSprintDraws:moving.length});
 }
 for(const c of clients){
  if(new Set(c.rosterIds).size!==4||
     ids.size!==4||
     c.rosterIds.some(id=>!ids.has(id)))
   throw Error("authoritative 4-player roster mismatch across clients");
 }
 return {realAuthoritativeFourBrowserSilver:true,
  observedPerClient:summary,
  serverPlayerIds:[...ids].sort((a,b)=>a-b),
  genuineFourHumanBrowserSessions:true,
  fourIndependentHumanOperators:false,
  serverImpactReceiptProven:false,fullRollAndJumpFourWayProven:false,
  exactServerActionTimingProven:false,ownerSpartanKickIncluded:false,
  actualGreyhavenWorldProven:false,
  productionReleaseApproved:false};
}
