#!/usr/bin/env node
// P0 Graphics 3B read-only cross-department QA against original World #493.
// Requires exact isolated World checkout; no mocked socket coordinates.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2],"Expected independently pinned World #493 checkout");
const world=resolve(process.argv[2]);
const out=resolve(process.argv[3]||join(repo,".world493-native"));
const head="07060f981b8a1dac89184b621b6893dd970a08ae";
assert.equal(execFileSync("git",["-C",world,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),head);
const xref={
 "/__world493__/src/world/alpha-armory.mjs":join(world,"src/world/alpha-armory.mjs"),
 "/__world493__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/__world493__/src/browser/authored-world-renderer.mjs":join(world,"src/browser/authored-world-renderer.mjs"),
};
const hash=async p=>createHash("sha256").update(await readFile(p)).digest("hex");
const hashes=Object.fromEntries(await Promise.all(Object.entries(xref).map(async([url,p])=>[url,await hash(p)])));
const allowed=new Set([
 "web/armory-p0-world493-review.html","web/armory-p0-world493-review.mjs",
 "src/browser/armory-rack-visual.mjs","src/browser/armory-world493-visual-bridge.mjs",
 "src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp"
]);
const mime={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let path=xref[pathname];
  if(!path){path=resolve(repo,"."+pathname);
    if(!allowed.has(relative(repo,path).replaceAll("\\","/"))){
      res.writeHead(404);res.end("Not found");return;
    }
  }
  const bytes=await readFile(path);
  res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream",
   "Cache-Control":"no-store"});res.end(bytes);
 }catch(e){res.writeHead(500);res.end("Source fixture failed");}
});
await mkdir(out,{recursive:true});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-world493-review.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const results=[];
try{
 for(const name of ["chrome","firefox"]){
  let browser;
  try{
   const options={headless:true,executablePath:name==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(name==="chrome")options.args=["--no-sandbox","--disable-gpu-sandbox"];
   else{options.browser="firefox";options.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(options);
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:1100,height:880,deviceScaleFactor:1});
   await page.goto(url,{waitUntil:"networkidle0"});
   try{await page.waitForFunction(()=>window.__world493ArmoryReview?.()?.ready,{timeout:18000});}
   catch(e){console.log("WORLD493_DIAG="+JSON.stringify({name,errors,status:await page.$eval("#status",x=>x.textContent)}));throw e;}
   const prior=await page.evaluate(()=>window.__world493ArmoryReview());
   assert.deepEqual(prior.officialSwordAnchors,[[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
   assert.deepEqual(prior.officialSocketIds,["greyhaven-rack-1","greyhaven-rack-2","greyhaven-rack-3","greyhaven-rack-4"]);
   assert.equal(prior.realWorldTerrainRenderer,true);
   assert.equal(prior.renderedSwords,4);
   assert.equal(prior.authenticatedServerItems,false);
   assert.equal(prior.productionApproved,false);
   assert.ok(prior.cachedTiles>0&&prior.cachedTiles<=24);
   const first=prior.swordRects.find(x=>x.id==="ART-ONLY-NO-SERVER-0");
   const box=await page.$eval("#scene",el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};});
   const point=(x,y)=>({x:box.x+x*box.width/640,y:box.y+y*box.height/640});
   // Real pointer target in original sword WebP at alpha=159 (source QA).
   const opaque=point(first.x+20.5,first.y+13.5);
   const untouched="armory_world493_"+name+"_four_swords.png";
   await page.screenshot({path:join(out,untouched),fullPage:true});
   await page.mouse.click(opaque.x,opaque.y);
   const hit=await page.evaluate(()=>window.__world493ArmoryReview());
   assert.equal(hit.lastCandidate,first.id);
   assert.equal(hit.clicks,1);
   const transparent=point(first.x+0.5,first.y+0.5);
   await page.mouse.click(transparent.x,transparent.y);
   const after=await page.evaluate(()=>window.__world493ArmoryReview());
   assert.equal(after.clicks,1);
   assert.equal(after.lastCandidate,null);
   const click="armory_world493_"+name+"_transparent_rejected.png";
   await page.screenshot({path:join(out,click),fullPage:true});
   assert.deepEqual(errors,[]);
   results.push({engine:name,version:await browser.version(),errors,
      initial:prior,opaqueClick:hit.lastCandidate,afterTransparent:after.lastCandidate,
      expectedSourcePixel:{x:20,y:13},
      screenshots:[untouched,click],
      fullWorldSourceRendererInvoked:true,
      claimedServerItemPickups:0,claimedCombatSuppression:0,realGameRendered:false});
  }finally{await browser?.close();}
 }
 const report={milestone:"P0 Graphics 3B exact source World493 + Blender rack Chrome/Firefox",
  pinnedWorldHead:head,sourceFileHashes:hashes,browsers:results,
  originalWorldSourcesUnmodified:true,socketsFromOriginalWorldModule:true,
  canonicalItemIdsPresent:false,serverCollisionAttested:false,
  onlineGameIntegration:false,realFourPlayers:false,productionApproved:false};
 await writeFile(join(out,"armory_p0_world493_native_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("WORLD493_BROWSER="+JSON.stringify(results.map(x=>({engine:x.engine,version:x.version,
  cached:x.initial.cachedTiles,clicked:x.opaqueClick,
  transparentResult:x.afterTransparent,images:x.screenshots,errors:x.errors}))));
}finally{await new Promise(ok=>server.close(ok));}
