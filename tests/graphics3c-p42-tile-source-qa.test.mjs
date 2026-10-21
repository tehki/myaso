import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const code=readFileSync(new URL("tools/art/probe_p42_tile_source_qa.mjs",root),"utf8");
const prefix="assets/environment/greyhaven/3c-p42-tile-source-qa/";
test("P42 uses pinned source and original World, no online game entry",()=>{
 assert.match(code,/433d6151d5148b3a4c38300df14cffa19e3aa003/);
 assert.match(code,/3178b9aad8757ceb3594ff04b9e3099dced6b729/);
 assert.match(code,/transferToImageBitmap\(\)/);
 assert.match(code,/getImageData\(0,0,width,height\)/);
 assert.match(code,/new OffscreenCanvas\(512,512\)/);
 assert.match(code,/cacheCap:24/);
 assert.match(code,/buildLimit:3/);
 assert.doesNotMatch(readFileSync(new URL("web/online-game.mjs",root),"utf8"),/probe_p42_tile_source_qa/);
});
for(const name of ["p42_tile_source_comparison_windows.json","p42_tile_source_comparison_windows_repeat.json"]){
 test("P42 exact RGBA proof, native Chrome+Firefox: "+name,()=>{
  const report=JSON.parse(readFileSync(new URL(prefix+name,root),"utf8"));
  assert.equal(report.noShippedChanges,true);
  assert.equal(report.graphicsHead,"433d6151d5148b3a4c38300df14cffa19e3aa003");
  assert.equal(report.worldHead,"3178b9aad8757ceb3594ff04b9e3099dced6b729");
  assert.deepEqual(report.runs.map(r=>r.engine),["chrome","firefox"]);
  for(const run of report.runs){
   assert.deepEqual(run.errors,[]);
   assert.equal(run.offscreenSupported,true);
   assert.equal(run.results.length,6);
   assert.deepEqual(run.results.map(r=>r.name),["offscreen","bitmap","offscreen","bitmap","offscreen","bitmap"]);
   assert.deepEqual(run.results.map(r=>r.zoom),[.84,.84,1,1,1.2,1.2]);
   for(const r of run.results){
    assert.equal(r.frames,32);
    assert.equal(r.differingFrames,0);
    assert.equal(r.differingBytes,0);
    assert.equal(r.firstMismatch,null);
    assert.ok(r.cachedMax<=24&&r.coldTiles<=24);
    for(const k of ["totalBaselineMs","totalAlternativeMs","warmBaselineMs","warmAlternativeMs"])
      assert.ok(Number.isFinite(r[k])&&r[k]>=0);
   }
  }
 });
}
