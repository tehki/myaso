#!/usr/bin/env node
/* Graphics 3B P0 strict three-way original-source real browser pointer QA.
 * Original World #493 + original UI #503 + existing Graphics #508 asset.
 * Isolated localhost fixture; NO online game, network pickup or Combat hook.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2]&&process.argv[3],"Need external World493 and UI503 exact pinned source paths");
const world=resolve(process.argv[2]),ui=resolve(process.argv[3]);
const out=resolve(process.argv[4]||join(repo,".p0-three-source-review"));
const worldHead=process.env.P0_WORLD_SOURCE_HEAD||"07060f981b8a1dac89184b621b6893dd970a08ae";
const consolidatedWorld=worldHead==="3178b9aad8757ceb3594ff04b9e3099dced6b729";
assert.ok(consolidatedWorld||worldHead==="07060f981b8a1dac89184b621b6893dd970a08ae",
 "Only two explicitly reviewed original World source heads permitted");
const heads={world:worldHead,
 ui:"8d500d8ddeb4058f15dbc704bf78d685d1ca31ef",
 graphicsParent:"2a11b923591a682bbae3cffe6d9f70b0d2036de8"};
for(const [k,dir] of [["world",world],["ui",ui]])
 assert.equal(execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),heads[k]);
// Graphics worktree may advance with additive test-only commits; require
// immutable parent ancestry and exact independent original source hashes.
execFileSync("git",["-C",repo,"merge-base","--is-ancestor",heads.graphicsParent,"HEAD"]);
const xref={
 "/__world493__/src/world/alpha-armory.mjs":join(world,"src/world/alpha-armory.mjs"),
 "/__world493__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/__world493__/src/browser/authored-world-renderer.mjs":join(world,"src/browser/authored-world-renderer.mjs"),
 "/__ui503__/src/browser/alpha-sword-gesture.mjs":join(ui,"src/browser/alpha-sword-gesture.mjs"),
 "/__ui503__/src/browser/sword-canvas-pointer.mjs":join(ui,"src/browser/sword-canvas-pointer.mjs")};
if(consolidatedWorld)xref["/__world493__/src/world/building-presentation.mjs"]=
 join(world,"src/world/building-presentation.mjs");
const readHash=async(p)=>createHash("sha256").update(await readFile(p)).digest("hex");
const fileHashes=Object.fromEntries(await Promise.all(Object.entries(xref).map(async([url,path])=>[url,await readHash(path)])));
const consolidatedSourceHashes=consolidatedWorld?{
 "src/world/alpha-solid-geometry.mjs":await readHash(join(world,"src/world/alpha-solid-geometry.mjs")),
 "assets/world/greyhaven-alpha-solids-v1.json":await readHash(join(world,"assets/world/greyhaven-alpha-solids-v1.json"))
}:null;
if(consolidatedWorld){
 assert.equal(fileHashes["/__world493__/src/world/alpha-armory.mjs"],
  "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf");
 assert.equal(fileHashes["/__world493__/src/world/authored-maps.mjs"],
  "21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144");
 assert.equal(fileHashes["/__world493__/src/browser/authored-world-renderer.mjs"],
  "2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a");
 assert.equal(fileHashes["/__world493__/src/world/building-presentation.mjs"],
  "c2e2ad0350fbc5d0c8408a48a151c280b4cc85500c53f4b8e705b21e97147e33");
 assert.equal(consolidatedSourceHashes["src/world/alpha-solid-geometry.mjs"],
  "e49fe3e3937849f3b46c5539ab0361025fc510db201695a7dbaaad69bf895ddf");
 assert.equal(consolidatedSourceHashes["assets/world/greyhaven-alpha-solids-v1.json"],
  "186c9f6966749f25c26840dd26bd53771daf677ffe486702afcaa4a054482ebe");
}
const graphicsSourceHashes={
 "src/browser/armory-rack-visual.mjs":"3eec34073d4056411df063677e4b435bafa9ad0c684bed450e8c319f91cf5fdc",
 "src/browser/armory-world493-visual-bridge.mjs":"f7862e3931a150c5b8ac2e11054183d8de12ef498ab22be5cca192f819d46f69",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp":"83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp":"795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31"};
for(const [file,sha] of Object.entries(graphicsSourceHashes))
 assert.equal(await readHash(join(repo,file)),sha);
const local=new Set([
 "web/armory-p0-world493-ui-review.html","web/armory-p0-world493-ui-review.mjs",
 "src/browser/armory-world493-visual-bridge.mjs","src/browser/armory-rack-visual.mjs",
 "src/browser/armory-sword-alpha-sampler.mjs",
 "src/browser/armory-rack-presented-frame.mjs",
 "src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp"
]);
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let path=xref[pathname];
  if(!path){path=resolve(repo,"."+pathname);
   if(!local.has(relative(repo,path).replaceAll("\\","/"))){
    res.writeHead(404);res.end("not found");return;
   }
  }
  const content=await readFile(path);
  res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream",
    "Cache-Control":"no-store"});
  res.end(content);
 }catch{res.writeHead(500);res.end("pinned fixture source read failed");}
});
await mkdir(out,{recursive:true});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-world493-ui-review.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const results=[];
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const opts={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(engine==="chrome")opts.args=["--no-sandbox","--disable-gpu-sandbox"];
   else{opts.browser="firefox";opts.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(opts);
   const page=await browser.newPage(),errors=[];
   await page.evaluateOnNewDocument(head=>{window.__expectedPinnedWorldHead=head;},heads.world);
   page.on("pageerror",x=>errors.push(x.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:1140,height:860,deviceScaleFactor:1});
   await page.goto(url,{waitUntil:"networkidle0"});
   try{await page.waitForFunction(()=>window.__p0WorldUiReview?.()?.ready,{timeout:20000});}
   catch(e){console.log("LOAD_ERROR="+JSON.stringify({engine,errors,status:await page.$eval("#status",el=>el.textContent)}));throw e;}
   const initial=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.equal(initial.worldHead,heads.world);
   if(consolidatedWorld){
    await page.evaluate(()=>{document.title="Moon Games P0 consolidated World #521 + original 3B/UI swords";
     document.querySelector("h1").textContent="World #521 consolidation / Graphics #529 / UI #503";});
    assert.equal(initial.swordCount,4);
   }
   const alphaSampler=await page.evaluate(()=>window.__alphaSamplerInfo());
   assert.equal(alphaSampler.alphaOpaquePixel,159);
   assert.equal(alphaSampler.alphaTransparentPixel,0);
   assert.equal(alphaSampler.visiblePixels,1082);
   assert.equal(alphaSampler.productionApproved,false);
   assert.equal(initial.swordCount,4);
   assert.equal(initial.sourcePaintCompleted,true);
   assert.equal(initial.drawnRackCount,1);
   assert.equal(initial.drawnSwordCount,4);
   assert.deepEqual(initial.sourceWorldSocketPositions,[[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
   assert.equal(initial.serverAuthenticatedItems,false);
   assert.equal(initial.actualServerEvents,0);
   assert.equal(initial.combatHandlerActuallyCalled,false);
   const base=await page.$eval("#scene",el=>{let b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};});
   const clientPoint=(sprite,u,v,rect=base)=>({
    x:rect.x+(sprite.x+u+.5)*rect.width/640,
    y:rect.y+(sprite.y+v+.5)*rect.height/640
   });
   const first=initial.swordRects[0];
   const p=clientPoint(first,20,13),clear=clientPoint(first,0,0);
   const img1="armory_"+(consolidatedWorld?"world521":"world493")+"_ui503_"+engine+"_initial.png";
   await page.screenshot({path:join(out,img1),fullPage:true});
   const ad=await page.evaluate(()=>JSON.parse(JSON.stringify(window.__p0WorldUiAdversarial())));
   for(const n of ["outside","mismatch","transparent","frame"])assert.equal(ad[n].handled,false);
   assert.equal(ad.sourceTransparentAlpha,0);
   await page.mouse.click(p.x,p.y);
   const afterOpaque=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.deepEqual(afterOpaque.visualIntents,["ART-ONLY-NO-SERVER-0"]);
   assert.equal(afterOpaque.combatFallback,0);
   await page.mouse.click(clear.x,clear.y);
   const afterClear=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.deepEqual(afterClear.visualIntents,["ART-ONLY-NO-SERVER-0"]);
   assert.equal(afterClear.combatFallback,1);
   // Reserve on opaque sword at down, move to transparent source pixel then
   // release; pending reservation must cancel, NEVER become an attack.
   await page.mouse.move(p.x,p.y);await page.mouse.down();
   await page.mouse.move(clear.x,clear.y);await page.mouse.up();
   const afterDrag=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.deepEqual(afterDrag.visualIntents,["ART-ONLY-NO-SERVER-0"]);
   assert.equal(afterDrag.combatFallback,1);
   assert.equal(afterDrag.cancelled,1);
   // Concurrent authoritative-looking item visual revision invalidates
   // gesture. The mutation is an ART-ONLY fixture; no server updates.
   await page.mouse.move(p.x,p.y);await page.mouse.down();
   await page.evaluate(()=>document.getElementById("revision").click());
   await page.mouse.up();
   const afterRevision=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.equal(afterRevision.cancelled,2);
   assert.equal(afterRevision.combatFallback,1);
   assert.equal(afterRevision.visualIntents.length,1);
   // Removing visible sword while holding reserve never results in attack.
   await page.mouse.down();
   await page.evaluate(()=>document.getElementById("remove").click());
   await page.mouse.up();
   const removed=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.equal(removed.swordCount,3);
   assert.equal(removed.sourcePaintCompleted,true);
   assert.equal(removed.drawnSwordCount,3);
   assert.equal(removed.cancelled,3);
   assert.equal(removed.combatFallback,1);
   await page.evaluate(()=>document.getElementById("restore").click());
   assert.equal((await page.evaluate(()=>window.__p0WorldUiReview())).swordCount,4);
   // CSS scaled 390px canvas with DPR=2; UI496 pointer conversion must still
   // identify same final 640x640 authored backing sprite pixels.
   await page.setViewport({width:390,height:780,deviceScaleFactor:2});
   const narrowed=await page.$eval("#scene",el=>{
    const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};});
   const current=await page.evaluate(()=>window.__p0WorldUiReview());
   const s=current.swordRects[0],n=clientPoint(s,20,13,narrowed);
   await page.mouse.click(n.x,n.y);
   const afterScaled=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.deepEqual(afterScaled.visualIntents,["ART-ONLY-NO-SERVER-0","ART-ONLY-NO-SERVER-0"]);
   assert.equal(afterScaled.combatFallback,1);
   assert.equal(afterScaled.cancelled,3);
   assert.ok(narrowed.width<=390);
   const img2="armory_"+(consolidatedWorld?"world521":"world493")+"_ui503_"+engine+"_dpr2.png";
   await page.screenshot({path:join(out,img2),fullPage:true});
   // First Playable demands FOUR independently clickable physical swords,
   // not merely repeated proofs on rack sword #1. Exercise each original
   // World socket and genuine Blender alpha through the hardened UI pointer
   // handler in BOTH CSS-scaled DPR2 and original 640px backing views.
   const maskOverlap=await page.evaluate(()=>window.__p0WorldUiSourceMaskOverlap());
   const stableHit=await page.evaluate(()=>window.__alphaSamplerInfo().stableSourcePixel);
   assert.equal(stableHit.radius,2);
   assert.equal(stableHit.qaLandmarkOnly,true);
   assert.equal(stableHit.expandsHitBox,false);
   assert.equal(maskOverlap.count,4);
   assert.equal(maskOverlap.pairs.length,6);
   assert.equal(maskOverlap.maxOverlap,0);
   const allSwordClicks=[];
   for(const [mode,w,h,dpr] of [["scaled-dpr2",390,780,2],["desktop",1140,860,1]]){
    await page.setViewport({width:w,height:h,deviceScaleFactor:dpr});
    const region=await page.$eval("#scene",el=>{
     const b=el.getBoundingClientRect();
     return{x:b.x,y:b.y,width:b.width,height:b.height};
    });
    const start=await page.evaluate(()=>window.__p0WorldUiReview());
    assert.equal(start.swordCount,4);
    const expectedIds=start.swordRects.map(s=>s.id);
    assert.equal(new Set(expectedIds).size,4);
    for(const [index,sword] of start.swordRects.entries()){
     const px=sword.x+stableHit.x+.5,py=sword.y+stableHit.y+.5;
     const actual=await page.evaluate(([x,y])=>window.__p0WorldUiPixelCandidate(x,y),[px,py]);
     assert.equal(actual,sword.id,"Distinct visual source candidate "+mode+" #"+index);
     const prior=await page.evaluate(()=>window.__p0WorldUiReview());
     await page.mouse.click(region.x+px*region.width/640,
                            region.y+py*region.height/640);
     const result=await page.evaluate(()=>window.__p0WorldUiReview());
     if(result.visualIntents.length!==prior.visualIntents.length+1)
       console.log("FOUR_SWORD_MISMATCH="+JSON.stringify({engine,mode,index,sword,px,py,region,
         resultBefore:{intents:prior.visualIntents.length,fallthrough:prior.combatFallback,
           cancelled:prior.cancelled,events:prior.browserPointerEvents?.slice(-4)},
         resultAfter:{intents:result.visualIntents.length,fallthrough:result.combatFallback,
           cancelled:result.cancelled,events:result.browserPointerEvents?.slice(-4),
           upHandled:result.upHandled,upCandidate:result.upCandidate,downHandled:result.downHandled}}));
     assert.equal(result.visualIntents.length,prior.visualIntents.length+1);
     assert.equal(result.visualIntents.at(-1),sword.id);
     assert.equal(result.combatFallback,1);
     assert.equal(result.cancelled,3);
     assert.equal(result.actualServerEvents,0);
     allSwordClicks.push({mode,index,itemId:sword.id,
      pointerCanvasXY:[px,py],cssWidth:region.width,
      visualIntentOnly:true,realPickupCommitted:false});
    }
    assert.deepEqual(allSwordClicks.filter(x=>x.mode===mode).map(x=>x.itemId),expectedIds);
   }
   const afterAll=await page.evaluate(()=>window.__p0WorldUiReview());
   assert.equal(afterAll.visualIntents.length,10);
   assert.equal(afterAll.combatFallback,1);
   assert.equal(afterAll.cancelled,3);
   assert.deepEqual(errors,[]);
   results.push({engine,version:await browser.version(),errors,maskOverlap,stableHit,allSwordClicks,
     world521BuildingPresentationCheck:consolidatedWorld?await page.evaluate(async()=>{
       const {createAuthoredWorldRenderer}=await import("/__world493__/src/browser/authored-world-renderer.mjs");
       const {MAP_IDS}=await import("/__world493__/src/world/authored-maps.mjs");
       const {normalizeWorldBuildingReplacementIds}=await import("/__world493__/src/world/building-presentation.mjs");
       let smithRejected=false;
       try{normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["smith"]);}
       catch{smithRejected=true;}
       const camera={x:4365,y:4075};
       function pixels(replacement,cam){
         const c=document.createElement("canvas");c.width=c.height=640;
         const cx=c.getContext("2d",{willReadFrequently:true});
         const w=createAuthoredWorldRenderer({cacheCap:24,buildLimit:8,replacedBuildingIds:replacement});
         cx.save();cx.translate(320,320);cx.scale(.84,.84);cx.translate(-320,-320);
         w.draw(cx,MAP_IDS.overworld,cam,640,640,.84);cx.restore();
         return cx.getImageData(0,0,640,640).data;
       }
       function changed(a,b){let n=0;for(let i=0;i<a.length;i+=4)
         if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;
         return n;}
       const redLionDiff=changed(pixels([],camera),pixels(["red-lion"],camera));
       const smithCamera={x:3800,y:4038};
       const smithDiff=changed(pixels([],smithCamera),pixels(["red-lion"],smithCamera));
       return{smithReplacementForbidden:smithRejected,redLionVisibleDifferencePixels:redLionDiff,
         blacksmithPixelsChangedByRedLionReplacement:smithDiff,
         observedGameRendererIntegration:false,productionApproved:false};
     }):null,
     afterAllFourSourcePixelClicks:afterAll,
     sourcePins:initial.sourceWorldSocketPositions,opaqueSourcePixel:[20,13],
     adversarial:ad,alphaSampler,initial,afterOpaque,afterClear,afterDrag,afterRevision,
     afterItemRemoval:removed,afterDpr2:afterScaled,
     cssCanvasWidth:narrowed.width,deviceScaleFactor:2,
     screenshots:[img1,img2],
     realInputEvents:afterScaled.browserPointerEvents.length,
     genuineGameCombat:false,serverNetworkMessages:0,
     authoritativeItemOwnership:false,productionApproved:false});
  }finally{await browser?.close();}
 }
 const report={milestone:consolidatedWorld?
   "Graphics 3B First Playable exact consolidated World #521 + original Blender + UI503 native pointer compatibility":
   "Graphics 3B First Playable World493+Graphics508+UI503 exact native alpha pointer compatibility",
   sourceHeads:heads,externalSourceHashes:fileHashes,graphicsSourceHashes,
   consolidatedSourceHashes,
   consolidatedWorld521Candidate:consolidatedWorld,
   browserResults:results,screenshots:results.reduce((sum,r)=>sum+r.screenshots.length,0),
   realGameClientExecuted:false,realMultiplayerUsers:0,realServerTryPickup:false,
   combatHandlerExecuted:false,allSourcesUnchanged:true,productionApproved:false};
 await writeFile(join(out,consolidatedWorld?
  "armory_p0_world521_ui503_native_report.json":
  "armory_p0_world493_ui503_native_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("WORLD_UI_NATIVE="+JSON.stringify(results.map(r=>({engine:r.engine,version:r.version,
  intents:r.afterDpr2.visualIntents.length,fallthrough:r.afterDpr2.combatFallback,
  cancellations:r.afterDpr2.cancelled,events:r.realInputEvents,errors:r.errors}))));
}finally{await new Promise(ok=>server.close(ok));}
