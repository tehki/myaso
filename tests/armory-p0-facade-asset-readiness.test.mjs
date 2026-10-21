import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {prepareRedLionSourceArt,createRedLionArtGatedWorldPainter,RED_LION_SOURCE_DIMENSIONS} from "../src/browser/red-lion-original-art-readiness.mjs";
const origin="http://127.0.0.1:4999";
const paths=Object.fromEntries(["day","dusk","roof"].map(n=>
 [n,"/original/red_lion_"+n+".webp"]));
const fake=src=>{
 const key=Object.keys(paths).find(k=>src===paths[k]);
 return{complete:true,naturalWidth:RED_LION_SOURCE_DIMENSIONS[key].width,
  naturalHeight:RED_LION_SOURCE_DIMENSIONS[key].height,
  currentSrc:origin+src};
};
const load=async src=>fake(src);
const renderCalls=[];
function makeRenderer(options){
 renderCalls.push(options);
 return{replacedBuildingIds:Object.freeze([...options.replacedBuildingIds])};
}
const validator=()=>["red-lion"];

test("P0 original art set must finish all 3 decoded images before allowing World placeholder replacement",async()=>{
 const art=await prepareRedLionSourceArt({paths,loadImage:load,origin});
 assert.equal(art.status,"ready");
 assert.equal(art.placeholderMustRemain,false);
 assert.equal(art.replacementAllowed,true);
 assert.equal(art.acceptedForGameplay,false);
 assert.ok(Object.isFrozen(art));
 const d=createRedLionArtGatedWorldPainter({art,createRenderer:makeRenderer,worldReplacementValidator:validator});
 assert.equal(d.paintFacadeAllowed,true);
 assert.equal(d.fallbackDefaultPlaceholder,false);
 assert.deepEqual(d.painter.replacedBuildingIds,["red-lion"]);
 assert.equal(renderCalls.at(-1).worldReplacementValidator,validator);
 assert.equal(d.approvedForRelease,false);
});

test("P0 an actual rejected image decode preserves original World placeholder, never partial art",async()=>{
 for(const bad of ["day","dusk","roof"]){
  const art=await prepareRedLionSourceArt({paths,origin,loadImage:async p=>{
   if(p===paths[bad])throw Error("real image 503/rejected decode");
   return fake(p);
  }});
  assert.equal(art.status,"unavailable");
  assert.equal(art.placeholderMustRemain,true);
  const decision=createRedLionArtGatedWorldPainter({art,createRenderer:makeRenderer,
   worldReplacementValidator:validator});
  assert.equal(decision.paintFacadeAllowed,false);
  assert.deepEqual(decision.painter.replacedBuildingIds,[]);
 }
});

test("P0 incomplete image or wrong source pixel dimensions do not authorize placeholder removal",async()=>{
 for(const bad of [
  {complete:false},
  {naturalWidth:99},
  {naturalHeight:99},
  {currentSrc:"https://evil.invalid/original/red_lion_day.webp"},
  {currentSrc:origin+"/original/red_lion_roof.webp"},
  {currentSrc:origin+"/original/red_lion_day.webp?stale=1"}
 ]){
  const art=await prepareRedLionSourceArt({paths,origin,
   loadImage:async path=>path===paths.day?{...fake(path),...bad}:fake(path)});
  assert.equal(art.status,"unavailable");
 }
});

test("P0 missing/invalid loader and art/World validator fail closed",async()=>{
 assert.equal((await prepareRedLionSourceArt()).status,"unavailable");
 assert.equal((await prepareRedLionSourceArt({paths,origin})).status,"unavailable");
 assert.equal((await prepareRedLionSourceArt({paths:{...paths,day:""},origin,loadImage:load})).status,"unavailable");
 for(const invalid of [
  {createRenderer:makeRenderer,worldReplacementValidator:null},
  {createRenderer:null,worldReplacementValidator:validator},
  {createRenderer:makeRenderer,worldReplacementValidator:validator,options:{replacedBuildingIds:["red-lion"]}},
  {createRenderer:makeRenderer,worldReplacementValidator:validator,options:{worldReplacementValidator:validator}}
 ]){
  assert.throws(()=>createRedLionArtGatedWorldPainter(invalid));
 }
});

test("P0 a dishonest World/Graphics 3C renderer cannot claim it retained a missing placeholder",()=>{
 const art={status:"unavailable",placeholderMustRemain:true,replacementAllowed:false};
 assert.throws(()=>createRedLionArtGatedWorldPainter({
  art,createRenderer:()=>({replacedBuildingIds:["red-lion"]}),
  worldReplacementValidator:validator
 }));
});

test("P0 browser screenshots and real HTTP 503 facade missing data preserve exact unchanged original placeholder",()=>{
 const path=new URL("../assets/environment/greyhaven/armory-p0/facade-fallback-review/",import.meta.url);
 const report=JSON.parse(readFileSync(new URL("original_red_lion_art_ready_or_placeholder.json",path),"utf8"));
 assert.deepEqual(Object.keys(report.heads),["world","threeC","threeB"]);
 assert.equal(report.heads.world,"3178b9aad8757ceb3594ff04b9e3099dced6b729");
 assert.equal(report.heads.threeC,"efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac");
 assert.equal(report.heads.threeB,"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5");
 assert.equal(report.trials.length,6);
 for(const engine of ["chrome","firefox"]){
  const group=report.trials.filter(x=>x.engine===engine);
  assert.deepEqual(group.map(x=>x.situation),["normal","fail-day","fail-roof"]);
  for(const x of group){
   assert.deepEqual(x.pageErrors,[]);
   assert.equal(x.data.ready,true);
   assert.equal(x.data.gameRendererIntegrated,false);
   assert.equal(x.data.releaseApproved,false);
   assert.equal(x.data.originalAssetsMutated,false);
   assert.equal(x.data.lowEndChromiumIssueResolved,false);
   const screenshot=readFileSync(new URL(x.screenshot,path));
   assert.equal(screenshot.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok(screenshot.length>20000);
   if(x.situation==="normal"){
    assert.equal(x.simulatedFailure,false);
    assert.equal(x.data.artReady,true);
    assert.equal(x.data.replacementApplied,true);
    assert.ok(x.data.originalFacadePixelsDifferentFromPlaceholder>10000);
    assert.deepEqual(x.data.replacedBuildingIds,["red-lion"]);
    assert.deepEqual(x.httpErrors,[]);
   }else{
    assert.equal(x.simulatedFailure,true);
    assert.equal(x.data.artReady,false);
    assert.equal(x.data.replacementApplied,false);
    assert.equal(x.data.fallbackDefaultPlaceholder,true);
    assert.equal(x.data.fallbackPixelsIdenticalToOriginal,true);
    assert.equal(x.data.originalFacadePixelsDifferentFromPlaceholder,0);
    assert.deepEqual(x.data.replacedBuildingIds,[]);
    assert.equal(x.httpErrors.filter(e=>e.status===503).length,1);
   }
  }
 }
 assert.equal(report.liveGame,false);
 assert.equal(report.actualLowEndTest,false);
 assert.equal(report.productionApproved,false);
});

test("P0 QA HTTP fault is isolated; no deployed app, true gameplay or original World source modification",()=>{
 const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const page=read("web/armory-p0-facade-failclosed-review.mjs");
 const runner=read("tools/art/verify_p0_real_facade_http_failure.mjs");
 assert.match(page,/prepareRedLionSourceArt/);
 assert.match(page,/createRedLionArtGatedWorldPainter/);
 assert.match(page,/normalizeWorldBuildingReplacementIds/);
 assert.match(runner,/res\.writeHead\(503/);
 assert.match(runner,/mode\.current==="fail-roof"/);
 assert.doesNotMatch(read("web/online-game.mjs"),/createRedLionArtGatedWorldPainter/);
 assert.doesNotMatch(page,/TryPickup|WebSocket|XMLHttpRequest/);
});
