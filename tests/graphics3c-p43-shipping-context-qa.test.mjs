import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const prefix="assets/environment/greyhaven/3c-p43-canvas-context-qa/";
const reports=["first-run-windows.json","repeat-run-windows.json"];
test("P43 probe pins original online opaque target and separates timed contexts from readbacks",()=>{
 const code=readFileSync(new URL("tools/art/probe_p43_shipping_canvas_context_browser.mjs",root),"utf8");
 assert.match(code,/const ctx = canvas.getContext/);
 assert.match(code,/alpha: false/);
 assert.match(code,/willReadFrequently:true/);
 assert.match(code,/getImageData\(0,0,width,height\)/);
 assert.match(code,/cacheCap:24/);
 assert.match(code,/buildLimit:3/);
 assert.match(code,/phase:"timing"/);
 assert.match(code,/phase:"pixel"/);
 assert.match(code,/P43_BROWSER_ENGINE/);
 assert.match(code,/completeTwoBrowserMatrix:selectedEngines.length===2/);
 assert.match(code,/selectedEngines.every/);
 assert.doesNotMatch(readFileSync(new URL("web/online-game.mjs",root),"utf8"),/probe_p43_shipping_canvas_context_browser/);
});
for(const file of reports){
 test("P43 actual Chrome+Firefox native context result provenance: "+file,()=>{
  const r=JSON.parse(readFileSync(new URL(prefix+file,root),"utf8"));
  assert.equal(r.noSourceEdits,true);
  assert.equal(r.onlineGameContextPinned,true);
  assert.equal(r.gameClientRunning,false);
  assert.equal(r.sources.gfx3cParent,"b52a787ecb1958b885c4c96fbef737a8e45d7599");
  assert.equal(r.sources.world,"3178b9aad8757ceb3594ff04b9e3099dced6b729");
  assert.deepEqual(r.runs.map(x=>x.engine),["chrome","firefox"]);
  const kinds=["shipping-opaque","opaque-readfrequent","prior-qa-transparent-readfrequent","default-transparent"];
  for(const run of r.runs){
   assert.deepEqual(run.errors,[]);
   assert.equal(run.results.filter(x=>x.phase==="pixel").length,6);
   assert.equal(run.results.filter(x=>x.phase==="timing").length,16);
   for(const zoom of [.84,1]){
    const pixel=run.results.filter(x=>x.phase==="pixel"&&x.zoom===zoom);
    assert.deepEqual(pixel.map(x=>x.name),kinds.slice(1));
    assert.ok(pixel.every(x=>x.frames===16&&x.differingBytes>=0&&x.differingFrames>=0));
    const timing=run.results.filter(x=>x.phase==="timing"&&x.zoom===zoom);
    assert.equal(timing.length,8);
    for(let trial=0;trial<2;trial++){
     const group=timing.filter(x=>x.trial===trial);
     assert.deepEqual(group.map(x=>x.name),trial===0?kinds:[...kinds].reverse());
     for(const x of group){
      assert.equal(x.frames,48);
      assert.ok(x.created<=24);
      assert.ok(x.warmFrames>0);
      assert.ok(Number.isFinite(x.warmTotalMs)&&x.warmTotalMs>=0);
      assert.ok(Number.isFinite(x.warmP95Ms));
      assert.equal(x.samples.length,48);
      assert.ok(x.samples.every(s=>s.coldTiles<=3&&s.cached<=24));
     }
    }
   }
   const mismatch=run.results.find(x=>x.phase==="pixel"&&x.zoom===.84&&x.name==="prior-qa-transparent-readfrequent");
   assert.ok(mismatch.differingBytes>1000,"Transparent profiling context must not be mislabeled as shipping opaque parity");
  }
 });
}
