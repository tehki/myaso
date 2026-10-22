import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../assets/environment/greyhaven/armory-p0/late-draw-fallback-review/",import.meta.url);
test("actual source-pinned Chrome and Firefox correctly recover after partially painted Red Lion facade",()=>{
 const report=JSON.parse(readFileSync(new URL("original_red_lion_art_ready_or_placeholder.json",root),"utf8"));
 assert.deepEqual(report.heads,{
  world:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
  threeC:"efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac",
  threeB:"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5"
 });
 assert.equal(report.trials.length,8);
 for(const engine of ["chrome","firefox"]){
  const conditions=report.trials.filter(x=>x.engine===engine);
  assert.deepEqual(conditions.map(x=>x.situation),["normal","fail-day","fail-roof","fail-draw"]);
  for(const x of conditions){
   assert.deepEqual(x.pageErrors,[]);
   assert.equal(x.data.ready,true);
   assert.equal(x.data.gameRendererIntegrated,false);
   assert.equal(x.data.originalAssetsMutated,false);
   assert.equal(x.data.releaseApproved,false);
   assert.equal(x.data.stagingScratchOnly,true);
   const screenshot=readFileSync(new URL(x.screenshot,root));
   assert.equal(screenshot.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok(screenshot.length>20000);
   if(x.situation==="normal"){
    assert.equal(x.data.artReady,true);
    assert.equal(x.data.recoveredLateDrawError,false);
    assert.equal(x.data.replacementApplied,true);
    assert.deepEqual(x.data.replacedBuildingIds,["red-lion"]);
    assert.ok(x.data.originalFacadePixelsDifferentFromPlaceholder>10000);
    assert.deepEqual(x.httpErrors,[]);
   }else{
    assert.equal(x.data.replacementApplied,false);
    assert.equal(x.data.fallbackDefaultPlaceholder,true);
    assert.equal(x.data.fallbackPixelsIdenticalToOriginal,true);
    assert.equal(x.data.originalFacadePixelsDifferentFromPlaceholder,0);
    assert.deepEqual(x.data.replacedBuildingIds,[]);
    if(x.situation==="fail-draw"){
     assert.equal(x.data.artReady,true);
     assert.equal(x.data.actualBrowserImageDecode,true);
     assert.equal(x.data.recoveredLateDrawError,true);
     assert.equal(x.data.injectedCanvasFailure,true);
     assert.deepEqual(x.httpErrors,[]);
    }else{
     assert.equal(x.data.artReady,false);
     assert.equal(x.data.recoveredLateDrawError,false);
     assert.equal(x.httpErrors.filter(e=>e.status===503).length,1);
    }
   }
  }
 }
 assert.equal(report.liveGame,false);
 assert.equal(report.productionApproved,false);
});
