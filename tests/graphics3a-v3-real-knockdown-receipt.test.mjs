import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {summarizeSpartanV3RealKnockdown} from "../scripts/graphics3a-v3-real-knockdown-receipt.mjs";
const make=()=>{
 const ids=[1,2,3],names=["chrome","firefox","chrome2"];
 const actions=[
   {action:COMBAT_ACTION.kickWindup,epochMs:1000,serverTick:20},
   {action:COMBAT_ACTION.kickActive,epochMs:1090,serverTick:25},
   {action:COMBAT_ACTION.kickRecovery,epochMs:1160,serverTick:29}];
 const results=names.map((browser,i)=>({
   browser, m153AttackerId:1,m153KnockedDownId:2,m153BystanderId:3,
   m153KickAttempt:1,playerHp:100,playerGuard:100,
   acceptance:{playerNetId:ids[i],serverTick:100,
     ownActionTransitions: i===0?structuredClone(actions):
       i===1?[{action:COMBAT_ACTION.knockdown,epochMs:1150,serverTick:27}]:
       [{action:COMBAT_ACTION.idle,epochMs:1050,serverTick:21}]},
   focusTransitions: i===0?[{label:"KNOCKDOWN #2",epochMs:1170}]:[]
 }));
 const draw=(frame,epochMs)=>({sourceFile:"silver_kick_v3.webp",frame,direction:2,epochMs});
 const clients=names.map((engine,i)=>({engine,netId:ids[i],probeInstalled:true,
   serverConnected:true,draws:[draw(0,1001),draw(3,1101),draw(5,1170)]}));
 return {results,clients};
};
test("M153 three actual authoritative fighters, real knockdown and original V3 WebP prove source+outcome together",()=>{
 const v=summarizeSpartanV3RealKnockdown(make());
 assert.equal(v.realAuthoritativeThreePlayerKickKnockdown,true);
 assert.equal(v.realSilverV3SourceAllThreeBrowsers,true);
 assert.equal(v.knockedDownServerId,2);
 assert.equal(v.browsers.length,3);
 assert.equal(v.browsers[0].counts.active,1);
 assert.equal(v.nonDamagingKick,true);
 assert.equal(v.authoritativeDamageReceiptValidated,false);
 assert.equal(v.worldBootSoleContactValidated,false);
 assert.equal(v.exactServerKickCollisionPointValidated,false);
 assert.equal(v.humanOperatedPlayers,false);
 assert.equal(v.preAlphaEnabled,false);
 assert.equal(v.productionDeploymentApproved,false);
});
const fail=(reason,change)=>{
 const x=make();change(x);assert.throws(()=>summarizeSpartanV3RealKnockdown(x),new RegExp(reason));
};
test("reject fake network identity, bogus successful M153, missing true server knockdown or modified vitals",()=>{
 fail("distinct",x=>x.results[2].m153BystanderId=2);
 fail("successful",x=>x.results[0].m153KickAttempt=0);
 fail("identities",x=>x.results[1].acceptance.playerNetId=4);
 fail("kick windup",x=>x.results[0].acceptance.ownActionTransitions.splice(0,1));
 fail("victim",x=>x.results[1].acceptance.ownActionTransitions=[]);
 fail("focus cue",x=>x.results[0].focusTransitions=[]);
 fail("no HP",x=>x.results[1].playerHp=66);
 fail("server connected",x=>x.clients[2].serverConnected=false);
});
test("reject V2 substitution, synthetic source frames, source absence in spectator and missing true V3 contact",()=>{
 fail("V2",x=>x.clients[0].draws[0].sourceFile="silver_kick.webp");
 fail("crop",x=>x.clients[1].draws[0].frame=8);
 fail("windup",x=>x.clients[2].draws=x.clients[2].draws.slice(1));
 fail("must paint original",x=>x.clients[2].draws=[]);
 fail("kicker",x=>x.clients[0].draws=x.clients[0].draws.filter(s=>s.frame!==3));
});
test("M153 existing combat scenario is gated only on isolated opt-in and source observer remains passive",()=>{
 const file=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 assert.match(file,/MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT/);
 assert.match(file,/scenario !== "uikickknockdownffa"/);
 assert.match(file,/if \(spartanV3KnockdownFlight\)/);
 assert.match(file,/GRAPHICS3A_SPARTAN_V3_REAL_KNOCKDOWN/);
 assert.match(file,/summarizeSpartanV3RealKnockdown\(\{results,clients\}\)/);
 assert.match(file,/url.searchParams.set\("knightKickV3", "1"\)/);
 assert.doesNotMatch(file,/mockAction.*kick/);
});
