import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const runner=read("tools/art/verify_p0_a232_native_world3c_ironwork.mjs");
const viewer=read("web/armory-p0-a232-original-ironwork-review.mjs");

test("original Red Lion A2.32 uses exact source-pinned three-department HEADs",()=>{
 for(const sha of [
  "3178b9aad8757ceb3594ff04b9e3099dced6b729",
  "efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac",
  "39e9ab8d23109727906cb18b4cc7cac86e425aa7",
  "75bb57abf210cb3c1c7c925067edd8a0fcda4c79"
 ])assert.ok(runner.includes(sha));
 assert.match(runner,/execFileSync\("git"/);
 assert.match(runner,/assert\.equal\(await sha\(absolute\),expected/);
 assert.match(runner,/red_lion_a232_art_report\.json/);
 assert.match(runner,/changedAlphaPixels,0/);
 assert.match(runner,/roofByteIdentical,true/);
});
test("genuine A2.32 source images and preserved source A2.31 roof are hash pinned",()=>{
 for(const expected of [
  "bdd2dcb2cb480f3631cbfe8cd4fa63ffee63699d8f17f33a520f8a3dcfd085fa",
  "af2877c68dc88bd10baa90d1e32e6171fe9bc0e2ea537ebca1f2a9c767d2a54a",
  "f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1",
  "f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0"
 ])assert.ok(runner.includes(expected));
 assert.match(viewer,/red_lion_a232_day_ironwork\.webp/);
 assert.match(viewer,/red_lion_a232_dusk_ironwork\.webp/);
 assert.match(viewer,/red_lion_a232_roof_unchanged\.webp/);
});
test("original World #521 and real Graphics3C P37 source owns art substitution",()=>{
 assert.match(viewer,/normalizeWorldBuildingReplacementIds/);
 assert.match(viewer,/createAuthoredWorldRenderer/);
 assert.match(viewer,/createRedLionArtGatedWorldPainter/);
 assert.match(viewer,/paintRedLionFrameInScratch/);
 assert.match(viewer,/MAP_IDS\.overworld/);
 assert.match(viewer,/camera=\{x:4365,y:4075\}/);
 assert.match(viewer,/point\.x-114,point\.y-269/);
 assert.match(runner,/__world521__\/src\/world\/building-presentation\.mjs/);
 assert.match(viewer,/__3cp37__\/src\/browser\/authored-world-renderer\.mjs/);
});
test("new A2.32 actual scene is compared against genuine prior A2.31 pixels",()=>{
 assert.match(viewer,/priorSourceDifferencePixels/);
 assert.match(viewer,/original A2\.31 source comparison unavailable/);
 assert.match(viewer,/changedRgb\+\+/);
 assert.match(viewer,/changedAlpha\+\+/);
 assert.match(runner,/changedRgb>100/);
 assert.match(runner,/changedAlpha,0/);
});
test("real updated Blender lower hinge physical proof pins native .blend and ten actual metal objects",()=>{
 assert.match(runner,/red_lion_a232_hinge_attachment_blender_report\.json/);
 assert.match(runner,/physicalProof\.sourceBlendSha256/);
 assert.match(runner,/physicalProof\.corrected\.lower\.strap/);
 assert.match(runner,/zCenter\(physicalProof\.corrected\.lower\.strap\)-\.96/);
 assert.match(runner,/zCenter\(physicalProof\.corrected\.upper\.strap\)-1\.88/);
 assert.match(runner,/overlap\(strap,door,1\)>\.005/);
 assert.match(runner,/overlap\(peen,strap,1\)>\.005/);
 assert.match(runner,/assert\.equal\(peens\.length,3\)/);
});
test("real World3C compares new +24cm lower hinge against prior genuine Blender A2.32 day WebP",()=>{
 assert.match(runner,/6ffc32f5f68024a02692140df9ac42af71ddbd051a9201cf3d0a9ff0ab1c6ad7/);
 assert.match(runner,/97335e668a5b6c9e6d87570df5abdb99b66bda6f0278e40821ac811405289fbd/);
 assert.match(viewer,/__3ba232_before__\/assets\/environment\/greyhaven\/a232-review/);
 assert.match(viewer,/priorHingeArtReady:true|priorHingeArtReady=false/);
 assert.match(viewer,/priorHingeDifferencePixels=Object\.freeze\(\{changedRgb,changedAlpha\}\)/);
 assert.match(viewer,/raisedLowerHingeSourceZ:\.96/);
 assert.match(viewer,/unchangedUpperHingeSourceZ:1\.88/);
 assert.match(runner,/priorHingeDifferencePixels\?\.changedRgb>25/);
 assert.match(runner,/priorHingeDifferencePixels\.changedAlpha,0/);
});
test("both real native Chrome and Firefox must fail closed on three actual error modes",()=>{
 assert.match(runner,/name==="chrome"/);
 assert.match(runner,/\["chrome",9897\],\["firefox",9898\]/);
 assert.match(runner,/chromedriver/);
 assert.match(runner,/geckodriver/);
 assert.match(runner,/originalFacad[eE]PixelsDifferentFromPlaceholder/);
 assert.match(runner,/red_lion_a232_day_ironwork\.webp/);
 assert.match(runner,/red_lion_a232_roof_unchanged\.webp/);
 assert.match(runner,/fail-draw/);
 assert.match(runner,/recoveredLateDrawError,true/);
 assert.match(runner,/assert\.equal\(trials\.length,8/);
});
test("source browser evidence never mutates the live game or claims production approval",()=>{
 assert.doesNotMatch(viewer,/setPlayerPosition|TryPickup|networkClient|scrollIntoView\(/);
 assert.doesNotMatch(runner,/setPlayerPosition|TryPickup|scrollTo\(/);
 assert.match(viewer,/gameRendererIntegrated:false/);
 assert.match(runner,/liveGameIntegration:false/);
 assert.match(runner,/realFourPlayerMultiplayer:false/);
 assert.match(runner,/noItemAuthorityOrProductionChange:true/);
 assert.match(read("web/armory-p0-a232-original-ironwork-review.html"),/Real|source-authentic|Source|original/i);
});
