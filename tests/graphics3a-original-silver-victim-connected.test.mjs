import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {qualifyOriginalSilverVictimKnockdown}
  from "../scripts/graphics3a-original-silver-knockdown-receipt.mjs";
import {createKnightSpriteRenderer,knightClip}
  from "../web/knight-sprites.mjs";
const names=["chrome","firefox","chrome2"];
const make=()=>{
 const ids=[1,2,3];
 const results=names.map((browser,i)=>({
   browser,m153AttackerId:1,m153KnockedDownId:2,m153BystanderId:3,
   acceptance:{playerNetId:ids[i],serverTick:100,
     ownActionTransitions:i===1?[{action:COMBAT_ACTION.knockdown,serverTick:30}]:
     [{action:COMBAT_ACTION.idle,serverTick:20}]}
 }));
 const nativeClients=names.map((engine,i)=>({engine,netId:ids[i],
   probeInstalled:true,serverConnected:true,
   draws:[{sourceFile:"silver_knockdown.webp",frame:0,direction:i,
      epochMs:1792672654500},
    {sourceFile:"silver_knockdown.webp",frame:3,direction:i,
      epochMs:1792672654620}]}));
 const sourceReceipt={realAuthoritativeThreePlayerKickKnockdown:true,
   realSilverV3SourceAllThreeBrowsers:true,nonDamagingKick:true,
   attackerServerId:1,knockedDownServerId:2,bystanderServerId:3};
 return {results,nativeClients,sourceReceipt};
};
const fail=(message,mutate)=>{const x=make();mutate(x);
 assert.throws(()=>qualifyOriginalSilverVictimKnockdown(x),new RegExp(message))};
test("original victim source is observed by THREE distinct real M153-connected browsers only after authoritative server knockdown",()=>{
 const v=qualifyOriginalSilverVictimKnockdown(make());
 assert.equal(v.verifiedRealThreePlayerOriginalSilverVictimReaction,true);
 assert.equal(v.originalSilverVictimSourceInAllNativeBrowsers,true);
 assert.deepEqual(v.observations.map(x=>x.serverId),[1,2,3]);
 assert.ok(v.observations.every(x=>x.distinctSourceFrames===2));
 for(const flag of ["full360MsEveryFrameObserved","realWorldSoleContactValidated",
   "damageReceiptValidated","exactKickCollisionPointValidated",
   "playerOperatedSmokePassed","preAlphaEnabled","productionReleaseApproved"])
   assert.equal(v[flag],false,flag);
});
test("reject wrong victim, missing authoritative server proof, forged IDs and disconnected browsers",()=>{
 fail("previously qualified",x=>x.sourceReceipt.realAuthoritativeThreePlayerKickKnockdown=false);
 fail("server identities disagree",x=>x.sourceReceipt.knockedDownServerId=3);
 fail("server-issued knockdown",x=>x.results[1].acceptance.ownActionTransitions=[]);
 fail("non-victim",x=>x.results[0].acceptance.ownActionTransitions=[{action:COMBAT_ACTION.knockdown}]);
 fail("authoritative browser",x=>x.results[1].acceptance.serverTick=0);
 fail("independently connected",x=>x.nativeClients[2].serverConnected=false);
 fail("independently connected",x=>x.nativeClients[0].netId=4);
});
test("reject original Silver source spoof, missing remote render, invalid crop/direction/clock, frozen frame",()=>{
 fail("original Silver victim WebP",x=>x.nativeClients[2].draws=[]);
 fail("counterfeit",x=>x.nativeClients[1].draws[0].sourceFile="silver_kick_v3.webp");
 fail("invalid native Canvas",x=>x.nativeClients[1].draws[1].frame=8);
 fail("invalid native Canvas",x=>x.nativeClients[1].draws[1].direction=-1);
 fail("invalid native Canvas",x=>x.nativeClients[1].draws[1].epochMs=NaN);
 fail("actually animate",x=>x.nativeClients[0].draws[1].frame=0);
});
test("new original victim source atlas is byte-exact Blender render; default client never opts in",()=>{
 const root=new URL("../",import.meta.url);
 const bytes=p=>readFileSync(new URL(p,root));
 const source=bytes("docs/art/silver-victim-knockdown-360ms/original_silver_knockdown_360ms_8way.webp");
 const installed=bytes("web/assets/knights/silver_knockdown.webp");
 const sha=x=>createHash("sha256").update(x).digest("hex");
 const meta=JSON.parse(bytes("docs/art/silver-victim-knockdown-360ms/original_silver_knockdown_source_manifest.json"));
 assert.equal(sha(installed),sha(source));
 assert.equal(sha(installed),meta.realSourceAtlasSha256);
 assert.notEqual(sha(installed),sha(bytes("web/assets/knights/silver_kick_v3.webp")));
 assert.equal(installed.subarray(8,12).toString("ascii"),"WEBP");
 const loaded=[];
 class FakeImage {set src(v){const name=new URL(v).pathname.split("/").at(-1);
   loaded.push(name);this.naturalWidth=name==="silver_knockdown.webp"?1280:160*8;
   this.naturalHeight=1280;this.onload?.()}}
 createKnightSpriteRenderer({ImageCtor:FakeImage,assetBase:new URL("https://qa.invalid/knights/")});
 assert.ok(!loaded.includes("silver_knockdown.webp"));
 assert.throws(()=>createKnightSpriteRenderer({ImageCtor:FakeImage,
   sourceKnockdownPreview:true}),/requires original V3/);
 loaded.length=0;
 createKnightSpriteRenderer({ImageCtor:FakeImage,
   assetBase:new URL("https://qa.invalid/knights/"),
   sourceKnockdownPreview:true,sourceKickPreview:true,sourceKickVariant:"v3"});
 assert.ok(loaded.includes("silver_knockdown.webp"));
 assert.equal(knightClip(COMBAT_ACTION.knockdown,"player"),null);
 assert.equal(knightClip(COMBAT_ACTION.knockdown,"npc",0,false,true,true),null);
 assert.equal(knightClip(COMBAT_ACTION.knockdown,"player",0,false,true,true),"silver_knockdown");
 assert.notEqual(knightClip(COMBAT_ACTION.kickActive,"player",0,false,true,true),"silver_knockdown");
});
test("native THREE-browser test stays behind fourth QA flag and never changes Combat truth",()=>{
 const root=new URL("../",import.meta.url);
 const text=p=>readFileSync(new URL(p,root),"utf8");
 const flight=text("scripts/pvp_browser_flight_runner.mjs");
 const game=text("web/online-game.mjs");
 assert.match(game,/knightKnockdownSource/);
 assert.match(flight,/MYASO_GRAPHICS3A_ORIGINAL_VICTIM_FLIGHT/);
 assert.match(flight,/!spartanV3KnockdownFlight/);
 assert.match(flight,/url.searchParams.set\("knightKnockdownSource", "1"\)/);
 assert.match(flight,/src.endsWith\("\/silver_knockdown\.webp"\)/);
 assert.match(flight,/GRAPHICS3A_ORIGINAL_SILVER_VICTIM_REAL_KNOCKDOWN/);
 assert.match(flight,/qualifyOriginalSilverVictimKnockdown/);
 assert.doesNotMatch(flight,/setMock.*knockdown/i);
});
