import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const sha=p=>createHash("sha256").update(read(p)).digest("hex");
test("only isolated V2 original art QA branch installs byte-identical authored Blender WebP, not original V1",()=>{
 const src="docs/art/silver-victim-grounded-v2-360ms/original_silver_knockdown_grounded_v2_360ms_8way.webp";
 assert.equal(sha(src),"5b3af4e2124a6b1315d0c14396eaaf3815fcf6af21d0662592d9e448e39f7bc9");
 assert.equal(sha("web/assets/knights/silver_knockdown.webp"),sha(src));
 assert.equal(sha("docs/art/silver-victim-knockdown-360ms/original_silver_knockdown_360ms_8way.webp"),
   "3df3f16e3007cd030027fca95d008331e1d6ba06bef8e9925a821558ba1cf872");
 assert.notEqual(sha(src),sha("docs/art/silver-victim-knockdown-360ms/original_silver_knockdown_360ms_8way.webp"));
 assert.notEqual(sha(src),sha("web/assets/knights/silver_kick_v3.webp"));
});
test("strict true 3-browser V2 live screenshot gate refuses fake server, wrong source or absent actual low-pose PNG",()=>{
 const s=read("scripts/pvp_browser_flight_runner.mjs").toString("utf8");
 assert.match(s,/MYASO_GRAPHICS3A_GROUNDED_V2_FLIGHT/);
 assert.match(s,/groundedOriginalSilverV2Flight && \(!silverVictimNativePng/);
 assert.match(s,/!originalSilverVictimKnockdownFlight \|\| scenario !== "uikickknockdownffa"/);
 assert.match(s,/qualifyOriginalSilverVictimKnockdown/);
 assert.match(s,/captureOriginalSilverVictimNativePngs/);
 assert.match(s,/src.endsWith\("\/silver_knockdown.webp"\)/);
 assert.match(s,/originalSourceFrame:observed.frame/);
 assert.match(s,/queueMicrotask/);
 assert.match(s,/realSilverSourceAllBrowsers:true/);
 assert.match(s,/GRAPHICS3A_GROUNDED_V2_REAL_KNOCKDOWN_PNG/);
 assert.match(s,/actualGreyhavenFloorValidated:false/);
 assert.match(s,/genuine 22-bone V2 grounded source atlas checksum mismatch/);
});
test("normal live game still defaults to NO original victim knockdown and no rust physics changes",()=>{
 const src=read("web/online-game.mjs").toString("utf8");
 const render=read("web/knight-sprites.mjs").toString("utf8");
 assert.match(src,/knightQuery.get\("knightKnockdownSource"\) === "1"/);
 assert.match(render,/if \(sourceKnockdownPreview/);
 assert.match(render,/if \(sourceKnockdownPreview && action === COMBAT_ACTION.knockdown\)/);
 assert.ok(!src.includes("groundedOriginalSilverV2Flight"));
});
test("source rig plane is proven ONLY in original Blender coordinates, not actual Greyhaven terrain",()=>{
 const manifest=JSON.parse(read("docs/art/silver-victim-grounded-v2-360ms/original_silver_knockdown_source_manifest.json"));
 assert.ok(manifest.sourceFloorMaxDeviation<.025);
 assert.equal(manifest.actorRootTranslationChanged,false);
 assert.equal(manifest.worldFloorBootSoleValidated,false);
 assert.equal(manifest.impactMeshCollisionValidated,false);
});
