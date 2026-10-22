import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {summarizeSpartanV3ConnectedKickFlight} from "../scripts/graphics3a-spartan-v3-source-receipt.mjs";
import {createKnightSpriteRenderer,knightKickSourceFrame} from "../web/knight-sprites.mjs";

const actions=[
 {action:COMBAT_ACTION.kickWindup,epochMs:1000},
 {action:COMBAT_ACTION.kickActive,epochMs:1090},
 {action:COMBAT_ACTION.kickRecovery,epochMs:1160},
];
const sample=(frame,epochMs)=>({frame,direction:2,epochMs,sourceFile:"silver_kick_v3.webp"});
const fixture=()=>({
 attackerTransitions:structuredClone(actions),
 defenderTransitions:structuredClone(actions),
 clients:[
  {engine:"chrome",netId:1,probeInstalled:true,serverConnected:true,
   draws:[sample(0,1005),sample(2,1080),sample(3,1100),sample(4,1150),sample(5,1180)]},
  {engine:"firefox",netId:2,probeInstalled:true,serverConnected:true,
   draws:[sample(0,1010),sample(4,1140),sample(7,1280)]}
 ]});
const reject=(rx,mutate)=>{
 const data=fixture();mutate(data);
 assert.throws(()=>summarizeSpartanV3ConnectedKickFlight(data),new RegExp(rx));
};
test("V3 requires original Blender source in BOTH real separately connected Chrome and Firefox, inherits strict M133 authority",()=>{
 const x=summarizeSpartanV3ConnectedKickFlight(fixture());
 assert.equal(x.verifiedRealConnectedServer,true);
 assert.equal(x.authenticOriginalSilverV3AtlasBothBrowsers,true);
 assert.deepEqual(x.authenticServerNetIds,[1,2]);
 assert.equal(x.sourceVersion,"contact-recoil-v3");
 for(const key of ["actualServerHitReceiptValidated","inPreAlpha","reviewedWorldSoleContact",
   "fourIndependentHumanOperators","ownerApprovedGameplay","productionReleaseApproved"])assert.equal(x[key],false);
});
test("fail closed on prior V2, spoofed source, duplicate IDs, unconfirmed server, fabricated action phases or browser identity",()=>{
 reject("V2/unknown",x=>x.clients[1].draws[0].sourceFile="silver_kick.webp");
 reject("V2/unknown",x=>delete x.clients[0].draws[0].sourceFile);
 reject("Chrome and Firefox",x=>x.clients[1].engine="chrome2");
 reject("server-authorized identities",x=>x.clients[1].netId=1);
 reject("mocked/disconnected",x=>x.clients[0].serverConnected=false);
 reject("ordered",x=>x.defenderTransitions=x.defenderTransitions.filter(t=>t.action!==COMBAT_ACTION.kickActive));
 reject("out-of-range",x=>x.clients[1].draws[0].frame=8);
 reject("real windup",x=>x.clients[1].draws=x.clients[1].draws.filter(f=>f.frame!==0));
 reject("real recovery",x=>x.clients[0].draws=x.clients[0].draws.filter(f=>f.frame<5));
});
test("original exact V3 WebP is byte-for-byte the Blender-authored SHA asset, distinct from V2",()=>{
 const base=new URL("../",import.meta.url);
 const asset=readFileSync(new URL("web/assets/knights/silver_kick_v3.webp",base));
 const source=readFileSync(new URL("docs/art/silver-spartan-contact-recoil-v3/silver_spartan_contact_recoil_v3_p0.webp",base));
 const v2=readFileSync(new URL("web/assets/knights/silver_kick.webp",base));
 const hash=x=>createHash("sha256").update(x).digest("hex");
 const manifest=JSON.parse(readFileSync(new URL("docs/art/silver-spartan-contact-recoil-v3/spartan_contact_recoil_v3_art_manifest.json",base)));
 assert.equal(asset.subarray(0,4).toString("ascii"),"RIFF");
 assert.equal(hash(asset),hash(source));
 assert.equal(hash(asset),manifest.newOriginalSpartanV3KickAtlasSha256);
 assert.notEqual(hash(asset),hash(v2));
 assert.ok(asset.length>200000);
});
test("V3 sprite must require opt-in variant, never start kick or forge a server phase",()=>{
 const loaded=[];
 class FakeImage{
  set src(s) {
   loaded.push(new URL(s).pathname.split("/").at(-1));
   const name=loaded.at(-1);
   this.naturalWidth=name==="silver_kick_v3.webp"?1280:640;
   this.naturalHeight=1280;
   this.onload?.();
  }
 }
 const args={ImageCtor:FakeImage,assetBase:new URL("https://qa.invalid/knights/")};
 createKnightSpriteRenderer(args);
 assert.ok(!loaded.includes("silver_kick_v3.webp"));
 assert.throws(()=>createKnightSpriteRenderer({...args,sourceKickVariant:"v3"}),/requires opt-in/);
 assert.throws(()=>createKnightSpriteRenderer({...args,sourceKickPreview:true,sourceKickVariant:"V3"}),/requires opt-in/);
 loaded.length=0;
 createKnightSpriteRenderer({...args,sourceKickPreview:true,sourceKickVariant:"v3"});
 assert.ok(loaded.includes("silver_kick_v3.webp"));
 assert.ok(!loaded.includes("silver_kick.webp"));
 assert.equal(knightKickSourceFrame(COMBAT_ACTION.idle,120),null);
 assert.ok(knightKickSourceFrame(COMBAT_ACTION.kickWindup,89.9)<=2);
 assert.ok(knightKickSourceFrame(COMBAT_ACTION.kickActive,69.9)<=4);
 assert.ok(knightKickSourceFrame(COMBAT_ACTION.kickRecovery,219.9)>=5);
});
test("live server flight uses triple opt-in, real WebDriver Canvas V3 source only and new strict receipt",()=>{
 const root=new URL("../",import.meta.url);
 const game=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 const flight=readFileSync(new URL("scripts/pvp_browser_flight_runner.mjs",root),"utf8");
 assert.match(game,/knightQuery.get\("knightKickV3"\) === "1"/);
 assert.match(game,/knightQuery.get\("knightKickSource"\) === "1"/);
 assert.match(flight,/MYASO_GRAPHICS3A_SPARTAN_V3_FLIGHT/);
 assert.match(flight,/if \(spartanV3Flight && !spartanFlight\)/);
 assert.match(flight,/url.searchParams.set\("knightKickV3", "1"\)/);
 assert.match(flight,/sourceFile:src.split\("\/"\).at\(-1\)/);
 assert.match(flight,/GRAPHICS3A_SPARTAN_V3_CONNECTED_KICK_FLIGHT/);
 assert.doesNotMatch(flight,/setMock.*kick/i);
});
