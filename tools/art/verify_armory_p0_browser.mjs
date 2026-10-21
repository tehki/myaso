#!/usr/bin/env node
/** P0 Graphics 3B Blender-source alpha-only sprite click smoke.
 * Synthetic art-fixture IDs/sockets; NEVER a real gameplay/network acceptance.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".armory-p0-review"));
const whitelist=new Set([
 "web/armory-p0-rack-review.html","web/armory-p0-rack-review.mjs",
 "src/browser/armory-rack-visual.mjs","src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp"
]);
const mime={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",
 ".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  if(path==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const file=resolve(root,"."+path),rel=relative(root,file).replaceAll("\\","/");
  if(!whitelist.has(rel)){res.writeHead(404);res.end();return;}
  const content=await readFile(file);
  res.writeHead(200,{"Cache-Control":"no-store","Content-Type":mime[extname(file)]||"application/octet-stream"});
  res.end(content);
 }catch(e){res.writeHead(500);res.end("local QA error");}
});
await mkdir(out,{recursive:true});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-rack-review.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const results=[];
try{
 for(const name of ["chrome","firefox"]){
  let browser;
  try{
   const opts={headless:true,executablePath:name==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(name==="chrome")opts.args=["--no-sandbox","--disable-gpu-sandbox"];
   else {opts.browser="firefox";opts.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(opts);
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push(r.status()+" "+r.url());});
   await page.setViewport({width:1160,height:910,deviceScaleFactor:1});
   await page.goto(url,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>window.__armoryReview?.()?.ready,{timeout:12000});
   const initial=await page.evaluate(()=>window.__armoryReview());
   assert.equal(initial.renderedSwordCount,4);
   assert.equal(initial.serverConnected,false);
   assert.equal(initial.worldSocketCoordinatesApproved,false);
   assert.equal(initial.productionApproved,false);
   const first=initial.swordRects[0],solid=initial.swordAlphaTestPixel;
   const rect=await page.$eval("#armory",e=>{
    const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
   const point=(x,y)=>({x:rect.x+x*rect.width/640,y:rect.y+y*rect.height/640});
   // Truly click actual rendered sword opaque-alpha pixel.
   const valid=point(first.x+solid.x+.5,first.y+solid.y+.5);
   await page.mouse.move(valid.x,valid.y);
   await page.waitForFunction(id=>window.__armoryReview().hoveredCandidate===id,{timeout:5000},first.itemId);
   const hover="armory_p0_"+name+"_hover.png";
   await page.screenshot({path:join(out,hover),fullPage:true});
   await page.mouse.click(valid.x,valid.y);
   const clicked=await page.evaluate(()=>window.__armoryReview());
   assert.equal(clicked.clickCandidateCount,1);
   assert.equal(clicked.clickLog[0].itemId,first.itemId);
   assert.equal(clicked.clickLog[0].serverPickupCommitted,false);
   assert.equal(clicked.attackCount,0);
   assert.equal(clicked.pickupRequestCount,0);
   assert.equal(clicked.renderedSwordCount,4);
   // Click transparent source-pixel INSIDE the sword rectangle: cannot target
   // sword merely because the bounding box encompasses transparent pixels.
   const clear=point(first.x+1,first.y+1);
   await page.mouse.click(clear.x,clear.y);
   const noHit=await page.evaluate(()=>window.__armoryReview());
   assert.equal(noHit.clickCandidateCount,1);
   // Local graphic-only item-list disappearance: not a real server commit.
   await page.click("#hideOne");
   const changed=await page.evaluate(()=>window.__armoryReview());
   assert.equal(changed.renderedSwordCount,3);
   assert.equal(changed.pickupRequestCount,0);
   assert.equal(changed.serverPickupCommitted,false);
   await page.click("#showAll");
   const restore=await page.evaluate(()=>window.__armoryReview());
   assert.equal(restore.renderedSwordCount,4);
   const restored="armory_p0_"+name+"_four_swords.png";
   await page.screenshot({path:join(out,restored),fullPage:true});
   assert.deepEqual(errors,[]);
   results.push({engine:name,version:await browser.version(),errors,
    screenshots:[hover,restored],totalDrawn:initial.renderedSwordCount,
    opaquePixel:solid,clickedSourceItem:first.itemId,transparentClickIgnored:true,
    candidateCount:clicked.clickCandidateCount,networkPickupEvents:clicked.pickupRequestCount,
    combatAttackEvents:clicked.attackCount,sourceItemRemovalPreviewOnly:true,
    actualServerItemIds:false,worldSocketCoordinatesApproved:false,
    gameRendererIntegrated:false,productionApproved:false});
  }finally{await browser?.close();}
 }
 const report={
  milestone:"Graphics 3B First Playable armory P0 — genuine Blender sword alpha click preview",
  browsers:results,sourceArtBlender:true,
  actualWorldSockets:false,canonicalItemIdentity:false,
  realCoreItemPickup:false,realCombatInputArbitration:false,
  realFourPlayerScene:false,actualOnlineGameIntegration:false,productionApproved:false
 };
 await writeFile(join(out,"armory_p0_native_alpha_browser_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("ARMORY_P0_BROWSER="+JSON.stringify(results.map(x=>({engine:x.engine,version:x.version,
   opaquePixel:x.opaquePixel,screenshots:x.screenshots,errors:x.errors}))));
}finally{await new Promise(ok=>server.close(ok));}
