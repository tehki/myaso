import test from "node:test";
import assert from "node:assert/strict";
import {qualifyPrealphaSilverConnectedClients} from "../scripts/graphics3a-prealpha-silver-connected-receipt.mjs";
import {readFileSync} from "node:fs";
const draw=(clip,epochMs,x,y,sourceFrame=0,facing=0)=>({
  clip,sourceFrame,facing,epochMs,x,y
});
function sample(engine,serverPlayerId){
  const draws=[];
  for(let i=0;i<9;i++){
    const t=1000+i*90;
    draws.push(draw("silver_idle",t,130+i,230,i%4,i%8));
    draws.push(draw("silver_idle",t+7,280,310,i%4,(i+2)%8));
  }
  draws.push(draw("silver_walk",1950,150,230,1,2));
  draws.push(draw("silver_sprint",1960,280,315,2,2));
  return {engine,serverPlayerId,serverTick:1472,realConnected:true,
    mockedState:false,knightsFlag:true,draws};
}
const cases=()=>[sample("chrome",1),sample("firefox",2)];
const reject=(message,mutate)=>{
  const data=cases();mutate(data);
  assert.throws(()=>qualifyPrealphaSilverConnectedClients(data),new RegExp(message));
};
test("only 2 independent server humans with actual Chrome and Firefox Silver canvas frames qualify",()=>{
  const receipt=qualifyPrealphaSilverConnectedClients(cases());
  assert.equal(receipt.authoritativeConnectedTwoPlayerSilver,true);
  assert.equal(receipt.sourceOnly,false);
  assert.equal(receipt.genuineWASDMovementObserved,true);
  assert.deepEqual(receipt.players.map(x=>x.serverPlayerId),[1,2]);
  assert.equal(receipt.fourPlayerProven,false);
  assert.equal(receipt.arenaFloorContactProven,false);
  assert.equal(receipt.actualGreyhavenCityProven,false);
  assert.equal(receipt.combatHitReceiptProven,false);
  assert.equal(receipt.ownerSpartanKickIncluded,false);
  assert.equal(receipt.productionReleaseApproved,false);
});
test("offline fake actor states, same ID, invalid tick, missing Knight opt-in fail closed",()=>{
  reject("server-issued",a=>a[0].serverPlayerId=0);
  reject("server-issued",a=>a[1].serverTick=0);
  reject("identities not independent",a=>a[1].serverPlayerId=1);
  reject("real connected",a=>a[0].realConnected=false);
  reject("real connected",a=>a[0].mockedState=true);
  reject("real connected",a=>a[0].knightsFlag=false);
  reject("two real",a=>a.splice(1));
  reject("separate browsers",a=>a[1].engine="chrome");
  reject("real Chrome",a=>a[1].engine="mock");
});
test("no two simultaneous humans or missing W3C WASD animations are disallowed",()=>{
  reject("concurrently",a=>a[1].draws=a[1].draws.map(x=>({...x,x:100,y:100})));
  reject("movement",a=>a[0].draws=a[0].draws.filter(x=>x.clip==="silver_idle"));
  reject("never rendered",a=>a[1].draws=[]);
});
test("no fake source sprites, impossible frames or missing actual transformed coordinates",()=>{
  reject("counterfeit",a=>a[0].draws[0].clip="sentinel_idle");
  reject("source frame",a=>a[0].draws[0].sourceFrame=9);
  reject("source facing",a=>a[0].draws[0].facing=-2);
  reject("Canvas transform",a=>a[0].draws[0].x=NaN);
  reject("Canvas transform",a=>a[0].draws[0].epochMs=Infinity);
});
test("real browser harness opt-in cannot run on ordinary M47 or default clients",()=>{
  const code=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  assert.match(code,/MYASO_GRAPHICS3A_PREALPHA_SILVER_FLIGHT/);
  assert.match(code,/prealphaSilverFlight && scenario !== "uiidentity"/);
  assert.match(code,/if \(prealphaSilverFlight\) url\.searchParams\.set\("knights", "1"\)/);
  assert.match(code,/GRAPHICS3A_PREALPHA_CONNECTED_TWO_SILVER/);
  assert.match(code,/qualifyPrealphaSilverConnectedClients/);
});
