#!/usr/bin/env node
// UI+Graphics true-browser pointer acceptance; ART-ONLY fixture, no server pickup.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,relative,extname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const files=new Set([
 "web/armory-p0-rack-review.html","web/armory-p0-rack-review.mjs",
 "src/browser/arena-viewport.mjs","src/browser/armory-rack-visual.mjs",
 "src/browser/sword-canvas-pointer.mjs","src/browser/alpha-sword-gesture.mjs",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp"
]);
const server=createServer(async(req,res)=>{
 try{
  const p=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  if(p==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const rel=relative(root,resolve(root,"."+p)).replaceAll("\\","/");
  if(!files.has(rel)){res.writeHead(404);res.end();return;}
  const b=await readFile(resolve(root,rel));
  res.writeHead(200,{"Content-Type":{".mjs":"text/javascript",".html":"text/html",
    ".webp":"image/webp"}[extname(rel)],"Cache-Control":"no-store"});res.end(b);
 }catch{res.writeHead(500);res.end("Preview QA error");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const firefox=process.env.UI_TEST_BROWSER==="firefox";
 const opts={headless:true,executablePath:process.env.UI_BROWSER_EXECUTABLE||
  (firefox?"firefox":"chromium")};
 if(firefox){opts.browser="firefox";opts.protocol="webDriverBiDi";}
 else opts.args=["--no-sandbox","--disable-gpu-sandbox"];
 browser=await puppeteer.launch(opts);
 const page=await browser.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push(r.status()+" "+r.url());});
 await page.setViewport({width:1160,height:910,deviceScaleFactor:2});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/armory-p0-rack-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__armoryReview?.()?.ready);
 const fixture=await page.evaluate(async()=>{
  const {ARMORY_RACK_ART,createBlacksmithRackVisualPlan,hitTestVisibleSwordAlpha}=
    await import("/src/browser/armory-rack-visual.mjs");
  const {createAlphaSwordGestureGate}=
    await import("/src/browser/alpha-sword-gesture.mjs");
  const {swordPointerCanvasPoint}=
    await import("/src/browser/sword-canvas-pointer.mjs");
  const canvas=document.getElementById("armory"),vis=window.__armoryReview();
  const rack={buildingId:"smith",version:"ART-ONLY-NO-APPROVAL",
   zoneId:"ART-DEMO-NO-SERVER",origin:{x:4000,y:4000},
   sockets:[-72,-24,24,72].map((dx,i)=>({
    id:"PREVIEW-SOCKET-"+i,worldX:4000+dx,worldY:3956}))};
  const plan=createBlacksmithRackVisualPlan({
   building:{id:"smith",x:3710,y:3850,w:182,h:162},rack,
   committedWorldItems:rack.sockets.map((socket,i)=>({
    itemId:"DEMO-SWORD-NOT-SERVER-"+i,socketId:socket.id,
    zoneId:rack.zoneId,visualKind:"sword",location:"rack",revision:0})),
   camera:{x:4000,y:4000}});
  if(plan.count!==4||plan.swords.length!==vis.swordRects.length||
   plan.swords.some((s,i)=>s.id!==vis.swordRects[i].itemId||
    s.x!==vis.swordRects[i].x||s.y!==vis.swordRects[i].y))
   throw Error("Displayed source pixel plan mismatch");
  const img=new Image();img.src=ARMORY_RACK_ART.swordSource;await img.decode();
  const src=document.createElement("canvas");src.width=42;src.height=115;
  const ctx=src.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,42,115).data;
  const alpha=(asset,u,v)=>
    asset===ARMORY_RACK_ART.swordSource&&Number.isSafeInteger(u)&&
    Number.isSafeInteger(v)&&u>=0&&u<42&&v>=0&&v<115?
    pixels[(v*42+u)*4+3]:NaN;
  const gate=createAlphaSwordGestureGate(hitTestVisibleSwordAlpha);
  const scene={plan,frameId:1,lastPresentedFrameId:1,sampleAlpha:alpha};
  const traces=[];
  function input(e,phase){
   const pos=swordPointerCanvasPoint(e,canvas);
   const intent={button:e.button,pointerId:e.pointerId,
    x:pos?.x??NaN,y:pos?.y??NaN};
   const r=phase==="down"?gate.down(intent,scene):gate.up(intent,scene);
   traces.push({phase,handled:r.handled,itemId:r.itemId,isTrusted:e.isTrusted});
  }
  canvas.addEventListener("pointerdown",e=>input(e,"down"),true);
  window.addEventListener("pointerup",e=>input(e,"up"),true);
  window.__uiSourceAudit=()=>({traces:[...traces],realServerItems:false});
  window.__uiSourceStale=()=>{scene.lastPresentedFrameId=0;};
  window.__uiSourceRestore=()=>{scene.lastPresentedFrameId=scene.frameId;};
  return {first:vis.swordRects[0],third:vis.swordRects[2],
    opaque:vis.swordAlphaTestPixel};
 });
 const click=async(x,y)=>{
  const r=await page.$eval("#armory",el=>{
   const b=el.getBoundingClientRect();return {left:b.left,top:b.top,
    width:b.width,height:b.height};});
  await page.mouse.move(r.left+x*r.width/640,r.top+y*r.height/640);
  await page.mouse.down();await page.mouse.up();
 };
 const s=fixture.first,x=s.x+fixture.opaque.x+.5,
  y=s.y+fixture.opaque.y+.5;
 await click(x,y);
 let a=await page.evaluate(()=>window.__uiSourceAudit());
 assert.deepEqual(a.traces.map(z=>z.handled),[true,true]);
 assert.equal(a.traces[1].itemId,s.itemId);
 assert.ok(a.traces.every(z=>z.isTrusted===true));
 await click(s.x+1,s.y+1);
 a=await page.evaluate(()=>window.__uiSourceAudit());
 assert.deepEqual(a.traces.slice(2).map(z=>z.handled),[false,false]);
 await page.evaluate(()=>{document.getElementById("armory").style.width="490px";});
 await click(x,y);
 a=await page.evaluate(()=>window.__uiSourceAudit());
 assert.equal(a.traces[5].itemId,s.itemId);
 await page.evaluate(()=>window.__uiSourceStale());
 await click(x,y);
 a=await page.evaluate(()=>window.__uiSourceAudit());
 assert.deepEqual(a.traces.slice(6).map(z=>z.handled),[false,false]);
 // A genuine pressed LMB gesture started on one sword cannot retarget to
 // another sword while held: it must consume the gesture without an item.
 await page.evaluate(()=>window.__uiSourceRestore());
 const rect=await page.$eval("#armory",el=>{
  const b=el.getBoundingClientRect();return {left:b.left,top:b.top,
   width:b.width,height:b.height};});
 const px=sx=>rect.left+sx*rect.width/640;
 const py=sy=>rect.top+sy*rect.height/640;
 await page.mouse.move(px(x),py(y));
 await page.mouse.down();
 const third=fixture.third,tx=third.x+fixture.opaque.x+.5,
  ty=third.y+fixture.opaque.y+.5;
 await page.mouse.move(px(tx),py(ty),{steps:6});
 await page.mouse.up();
 a=await page.evaluate(()=>window.__uiSourceAudit());
 assert.deepEqual(a.traces.slice(8).map(z=>z.handled),[true,true]);
 assert.equal(a.traces[9].itemId,null,"drag must never change sword target");
 // A fresh genuine down/up, by contrast, may select the now-visible third.
 await click(tx,ty);
 a=await page.evaluate(()=>window.__uiSourceAudit());
 assert.deepEqual(a.traces.slice(10).map(z=>z.handled),[true,true]);
 assert.equal(a.traces[11].itemId,third.itemId);
 assert.ok(a.traces.every(z=>z.isTrusted));
 const art=await page.evaluate(()=>window.__armoryReview());
 assert.equal(art.serverConnected,false);
 assert.equal(art.serverPickupCommitted,false);
 assert.equal(art.pickupRequestCount,0);
 assert.equal(art.attackCount,0);
 assert.deepEqual(errors,[]);
 console.log("UI_P0_NATIVE_ALPHA_SOURCE_PASS "+JSON.stringify({
  browser:firefox?"firefox":"chrome",events:a.traces.length,
  truePointerEvents:true,opaque:true,transparentDenied:true,cssResize:true,
  dpr:2,staleFrameDenied:true,realServerItems:false,pickup:false,
  combatMutation:false,errors
 }));
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
