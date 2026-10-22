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
  "814924be535fcda9503bf013b600a60f249692e3"
 ])assert.ok(runner.includes(sha));
 assert.match(runner,/execFileSync\("git"/);
 assert.match(runner,/assert\.equal\(await sha\(absolute\),expected/);
 assert.match(runner,/red_lion_a232_art_report\.json/);
 assert.match(runner,/changedAlphaPixels,0/);
 assert.match(runner,/roofByteIdentical,true/);
});
test("genuine A2.32 source images and preserved source A2.31 roof are hash pinned",()=>{
 for(const expected of [
  "5f37136750909c499e5bfc93597af92b44723f2d4b3b117d83ea7c7eb0ab2610",
  "3011a1db7fe92014639bec749357e21c7196d33c03d650460779a52b07bba3ea",
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
