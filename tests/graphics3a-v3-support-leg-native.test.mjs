import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createKnightSpriteRenderer} from "../web/knight-sprites.mjs";
import {selectAuthenticV3LightCapture} from "../scripts/graphics3a-v3-light-capture-truth.mjs";
import {summarizeSpartanV3RealKnockdown} from "../scripts/graphics3a-v3-real-knockdown-receipt.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const sha=b=>createHash("sha256").update(b).digest("hex");
const study=JSON.parse(read("docs/art/silver-spartan-v3-support-leg-fill/support_leg_fill_manifest.json"));
const saved=[];
class QAImage{
 constructor(){this.naturalWidth=1280;this.naturalHeight=1280;}
 set src(x){saved.push(x);}
 get src(){return saved.at(-1);}
}
const build=x=>createKnightSpriteRenderer({ImageCtor:QAImage,...x});
test("original Silver V3 support-leg true Blender atlas is byte-exact; all other source art unchanged",()=>{
 assert.equal(sha(read("web/assets/knights/silver_kick_v3_support.webp")),study.newAtlasSha256);
 assert.equal(study.newAtlasSha256,"c99c392a067494fff7416c6040422d2ff2bbf196ddfc3086d6fda3acd8790158");
 assert.equal(sha(read("docs/art/silver-spartan-v3-support-leg-fill/silver_spartan_v3_support_leg_fill_8way.webp")),study.newAtlasSha256);
 assert.equal(sha(read("web/assets/knights/silver_kick_v3_lit.webp")),study.baseAtlasSha256);
 assert.equal(sha(read("web/assets/knights/silver_knockdown.webp")),"5b3af4e2124a6b1315d0c14396eaaf3815fcf6af21d0662592d9e448e39f7bc9");
 assert.equal(study.all64SourceAlphaIdentical,true);
 assert.deepEqual(study.authoritativePhasesMs,[90,70,220]);
 assert.equal(study.ownerArtApproved,false);
 assert.equal(study.noGameplayOrPhysicsOrCombatChange,true);
});
test("six explicit source flags prevent V3-support-leg activation in default/old V3 and former lighting study",()=>{
 saved.length=0;build({});
 assert.ok(!saved.some(x=>x.endsWith("/silver_kick_v3_support.webp")));
 assert.throws(()=>build({sourceKickVariant:"v3leg"}),/opt-in/);
 assert.throws(()=>build({sourceKickVariant:"v3leg",sourceKickPreview:true,sourceKickLightStudy:true}),/opt-in/);
 assert.throws(()=>build({sourceKickVariant:"v3leg",sourceKickPreview:true,sourceKickSupportLegStudy:true}),/opt-in/);
 saved.length=0;build({sourceKickPreview:true,sourceKickVariant:"v3lit",sourceKickLightStudy:true});
 assert.ok(saved.some(x=>x.endsWith("/silver_kick_v3_lit.webp")));
 assert.ok(!saved.some(x=>x.endsWith("/silver_kick_v3_support.webp")));
 saved.length=0;
 build({sourceKickPreview:true,sourceKickVariant:"v3leg",sourceKickLightStudy:true,
   sourceKickSupportLegStudy:true,sourceKnockdownPreview:true});
 assert.ok(saved.some(x=>x.endsWith("/silver_kick_v3_support.webp")));
 assert.ok(saved.some(x=>x.endsWith("/silver_knockdown.webp")));
});
test("real source-only capture remains fail closed and rejects spoofed old lighting",()=>{
 const capture={png:"data:image/png;base64,iVBORw0KGgoAAAANS",frame:3,direction:2,epochMs:1000};
 const draws=[{frame:3,direction:2,epochMs:1000,sourceFile:"silver_kick_v3_support.webp"}];
 const value=selectAuthenticV3LightCapture({browser:"chrome",draws,captures:{active:capture},
   sourceFile:"silver_kick_v3_support.webp"});
 assert.equal(value.phase,"active");
 assert.throws(()=>selectAuthenticV3LightCapture({browser:"chrome",draws,captures:{active:capture}}),/not supported/);
 assert.throws(()=>selectAuthenticV3LightCapture({browser:"chrome",draws,captures:{active:capture},
   sourceFile:"forged.webp"}),/Unapproved/);
 assert.throws(()=>selectAuthenticV3LightCapture({browser:"chrome",draws:[],
   captures:{active:capture},sourceFile:"silver_kick_v3_support.webp"}),/not supported/);
});
test("new leg evidence requires authoritative real M153 and separately enabled old V3 light gates",()=>{
 const run=read("scripts/pvp_browser_flight_runner.mjs").toString();
 const game=read("web/online-game.mjs").toString();
 const src=read("scripts/graphics3a-v3-real-knockdown-receipt.mjs").toString();
 assert.match(run,/MYASO_GRAPHICS3A_V3_SUPPORT_LEG_NATIVE_FLIGHT/);
 assert.match(run,/spartanV3SupportLegNativeFlight && !spartanV3LightNativeFlight/);
 assert.match(run,/!spartanV3KnockdownFlight \|\| !originalSilverVictimKnockdownFlight/);
 assert.match(run,/!silverVictimNativePng \|\| !groundedOriginalSilverV2Flight/);
 assert.match(run,/GRAPHICS3A_SPARTAN_V3_SUPPORT_LEG_REAL_THREE_BROWSER_PNG/);
 assert.match(run,/expectedSourceFile:"silver_kick_v3_support\.webp"/);
 assert.match(run,/newAtlasSha256/);
 assert.match(run,/capturedSourcePhase/);
 assert.match(game,/knightKickV3SupportLeg/);
 assert.match(src,/silver_kick_v3_support\.webp/);
 assert.doesNotMatch(run,/mockAction.*kick/);
});
