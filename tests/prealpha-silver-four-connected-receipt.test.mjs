import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {qualifyPrealphaFourSilverClients} from "../scripts/graphics3a-prealpha-four-silver-receipt.mjs";
const engines=["chrome","firefox","chrome2","chrome3"];
const base=()=>engines.map((engine,index)=>({
 engine,serverPlayerId:index+1,serverTick:1200+index,
 connected:true,mockedState:false,rosterIds:[1,2,3,4],
 draws:Array.from({length:9},(_,tick)=>Array.from({length:4},(_,actor)=>({
  clip:tick===8&&actor===0?"silver_walk":"silver_idle",
  sourceFrame:tick===8&&actor===0?1:tick%4,
  facing:actor,x:actor*120+tick*2,y:actor*40+12,
  epochMs:1792640000000+tick*120+actor*4,
 }))).flat(),
}));
const fail=(rx,mutate)=>{
 const v=base();mutate(v);
 assert.throws(()=>qualifyPrealphaFourSilverClients(v),new RegExp(rx));
};
test("four distinct server identities and original Silver simultaneous renderer observations",()=>{
 const r=qualifyPrealphaFourSilverClients(base());
 assert.equal(r.realAuthoritativeFourBrowserSilver,true);
 assert.equal(r.genuineFourHumanBrowserSessions,true);
 assert.deepEqual(r.serverPlayerIds,[1,2,3,4]);
 assert.equal(r.observedPerClient.length,4);
 assert.ok(r.observedPerClient.every(x=>x.fourSilverBuckets>=3));
 assert.ok(r.observedPerClient.every(x=>x.originalWalkOrSprintDraws>=1));
 for(const key of ["fourIndependentHumanOperators","serverImpactReceiptProven",
  "fullRollAndJumpFourWayProven","exactServerActionTimingProven",
  "ownerSpartanKickIncluded","actualGreyhavenWorldProven",
  "productionReleaseApproved"])assert.equal(r[key],false,key);
});
test("cannot fake 4 connected human browsers with duplicates, NPC or missing server tick",()=>{
 fail("exactly four",a=>a.pop());
 fail("connected roster",a=>a[0].connected=false);
 fail("connected roster",a=>a[0].mockedState=true);
 fail("connected roster",a=>a[2].engine="sentinel");
 fail("authoritative",a=>a[1].serverTick=0);
 fail("authoritative",a=>a[0].serverPlayerId=0);
 fail("duplicate",a=>a[3].serverPlayerId=1);
 fail("not converged",a=>a[0].rosterIds.pop());
 fail("roster mismatch",a=>a[1].rosterIds=[1,2,3,9]);
});
test("four bodies must actually render together on each client, not one duplicated actor",()=>{
 fail("four distinct simultaneous",a=>a[3].draws.forEach(x=>{x.x=0;x.y=0;}));
 fail("four distinct simultaneous",a=>a[1].draws.forEach(x=>{x.x=Math.floor(x.x/120)*5;x.y=0;}));
 fail("Silver native draw samples",a=>a[1].draws=[]);
 fail("movement",a=>a[2].draws=a[2].draws.filter(x=>x.clip==="silver_idle"));
});
test("fake source art, impossible frames, invalid directions or timestamps cannot pass",()=>{
 fail("counterfeit",a=>a[0].draws[0].clip="sentinel_walk");
 fail("frame or facing",a=>a[0].draws[0].sourceFrame=4);
 fail("frame or facing",a=>a[2].draws[0].facing=8);
 fail("Canvas transform",a=>a[0].draws[0].x=Infinity);
 fail("Canvas transform",a=>a[1].draws[0].epochMs=NaN);
});
test("four-client flight is opt-in; existing strict M47 two-client and M159 4-player combat preserved",()=>{
 const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 assert.match(src,/MYASO_GRAPHICS3A_PREALPHA_FOUR_FLIGHT/);
 assert.match(src,/prealphaSilverFourFlight && \(!prealphaSilverFlight/);
 assert.match(src,/if\(prealphaSilverFourFlight\)/);
 assert.match(src,/runOnlineUiFourSilverFlight\(sessions\)/);
 assert.match(src,/GRAPHICS3A_PREALPHA_CONNECTED_FOUR_SILVER/);
 assert.match(src,/runOnlineUiIdentityFlight\(sessions\)/);
 assert.match(src,/runOnlineUiMultiKnockdownFfaHitFlight/);
});
