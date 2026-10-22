import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createKnightSpriteRenderer} from "../web/knight-sprites.mjs";
import {summarizeSpartanV3RealKnockdown} from "../scripts/graphics3a-v3-real-knockdown-receipt.mjs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url));
const hash=data=>createHash("sha256").update(data).digest("hex");
const v3lit=JSON.parse(read("docs/art/silver-spartan-v3-readability-study/spartan_v3_readability_study_manifest.json"));
const assets=[];
class FakeImage {
 constructor(){this.naturalWidth=1280;this.naturalHeight=1280;}
 set src(u){assets.push(u);}
 get src(){return assets.at(-1);}
}
const build=(x)=>createKnightSpriteRenderer({ImageCtor:FakeImage,...x});
test("fifth explicit V3-light opt-in never bypasses original source/variant protection",()=>{
 assets.length=0;
 build({});
 assert.ok(!assets.some(x=>x.includes("silver_kick_v3_lit.webp")));
 assert.throws(()=>build({sourceKickVariant:"v3lit"}),/opt-in/);
 assert.throws(()=>build({sourceKickPreview:true,sourceKickVariant:"v3lit"}),/opt-in/);
 assert.throws(()=>build({sourceKickLightStudy:true,sourceKickVariant:"v3lit"}),/opt-in/);
 assert.throws(()=>build({sourceKickPreview:true,sourceKickVariant:"forged",sourceKickLightStudy:true}),/opt-in/);
 assets.length=0;
 build({sourceKickPreview:true,sourceKickVariant:"v3"});
 assert.ok(assets.some(x=>x.endsWith("/silver_kick_v3.webp")));
 assert.ok(!assets.some(x=>x.endsWith("/silver_kick_v3_lit.webp")));
 assets.length=0;
 build({sourceKickPreview:true,sourceKickVariant:"v3lit",sourceKickLightStudy:true,sourceKnockdownPreview:true});
 assert.ok(assets.some(x=>x.endsWith("/silver_kick_v3_lit.webp")));
 assert.ok(assets.some(x=>x.endsWith("/silver_knockdown.webp")));
});
test("source GLB, V3 atlas, approved grounded victim stay unchanged and study hash is byte-exact",()=>{
 assert.equal(hash(read("web/assets/knights/silver_kick_v3_lit.webp")),v3lit.newStudyAtlasSha256);
 assert.equal(hash(read("web/assets/knights/silver_kick_v3.webp")),v3lit.originalV3AtlasSha256);
 assert.equal(hash(read("web/assets/knights/silver_knockdown.webp")),"5b3af4e2124a6b1315d0c14396eaaf3815fcf6af21d0662592d9e448e39f7bc9");
 assert.equal(v3lit.onlyCyclesLightingChanged,true);
 assert.equal(v3lit.allCellsIdenticalSilhouette,true);
 assert.equal(v3lit.renderedCells,64);
 assert.equal(v3lit.humanVisualApproved,false);
});
const make=()=>{
 const names=["chrome","firefox","chrome2"];
 const actions=[
  {action:COMBAT_ACTION.kickWindup,epochMs:1000,serverTick:20},
  {action:COMBAT_ACTION.kickActive,epochMs:1090,serverTick:25},
  {action:COMBAT_ACTION.kickRecovery,epochMs:1160,serverTick:29}];
 const results=names.map((browser,i)=>({browser,m153AttackerId:1,m153KnockedDownId:2,m153BystanderId:3,
  m153KickAttempt:1,playerHp:100,playerGuard:100,
  acceptance:{playerNetId:i+1,serverTick:100,ownActionTransitions:i===0?structuredClone(actions):
    i===1?[{action:COMBAT_ACTION.knockdown,epochMs:1150,serverTick:27}]:[{action:COMBAT_ACTION.idle,epochMs:1050,serverTick:21}]},
  focusTransitions:i===0?[{label:"KNOCKDOWN #2",epochMs:1170}]:[]}));
 const draws=[0,3,5].map((frame,i)=>({frame,direction:2,epochMs:1001+i*85,sourceFile:"silver_kick_v3_lit.webp"}));
 return {results,clients:names.map((engine,i)=>({engine,netId:i+1,probeInstalled:true,serverConnected:true,draws:structuredClone(draws)}))};
};
test("lighting-candidate M153 receipt is separate, explicit, fail-closed and cannot weaken original",()=>{
 const fixture=make();
 assert.throws(()=>summarizeSpartanV3RealKnockdown(fixture),/old V2 or substituted/);
 const args={...fixture,expectedSourceFile:"silver_kick_v3_lit.webp"};
 const valid=summarizeSpartanV3RealKnockdown(args);
 assert.equal(valid.realAuthoritativeThreePlayerKickKnockdown,true);
 assert.equal(valid.exactObservedSourceFile,"silver_kick_v3_lit.webp");
 assert.equal(valid.nonDamagingKick,true);
 assert.equal(valid.worldBootSoleContactValidated,false);
 assert.equal(valid.productionDeploymentApproved,false);
 const forged=make();forged.clients[2].draws[0].sourceFile="silver_kick_v3.webp";
 assert.throws(()=>summarizeSpartanV3RealKnockdown({...forged,expectedSourceFile:"silver_kick_v3_lit.webp"}),/substituted/);
 const unapproved=make();
 assert.throws(()=>summarizeSpartanV3RealKnockdown({...unapproved,expectedSourceFile:"unknown.webp"}),/unapproved/);
});
test("real native test cannot start with missing existing M153 victim/three-player QA gates",()=>{
 const file=read("scripts/pvp_browser_flight_runner.mjs").toString();
 const game=read("web/online-game.mjs").toString();
 assert.match(file,/MYASO_GRAPHICS3A_V3_LIGHT_NATIVE_FLIGHT/);
 assert.match(file,/!spartanV3KnockdownFlight \|\| !originalSilverVictimKnockdownFlight/);
 assert.match(file,/!silverVictimNativePng \|\| !groundedOriginalSilverV2Flight/);
 assert.match(file,/captureSpartanV3LightNativePngs/);
 assert.match(file,/GRAPHICS3A_SPARTAN_V3_LIGHT_REAL_THREE_BROWSER_PNG/);
 assert.match(file,/expectedSourceFile:"silver_kick_v3_lit\.webp"/);
 assert.match(game,/knightKickV3Light/);
 assert.match(game,/knightKickSource/);
 assert.doesNotMatch(file,/mockAction.*kick/);
});
