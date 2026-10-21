#!/usr/bin/env node
// Genuine Windows Chrome/Firefox rendered SOURCE ART only; no game sessions.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".kick-grounding-browser"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".webp":"image/webp",
 ".json":"application/json",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const address=new URL(req.url,"http://localhost");
  const path=resolve(root,"."+decodeURIComponent(address.pathname));
  const rel=relative(root,path);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(path)){
   res.writeHead(404);res.end("Missing first-party asset");return;
  }
  res.writeHead(200,{"content-type":mime[extname(path)]||"application/octet-stream",
  "cache-control":"no-store"});res.end(await readFile(path));
 }catch{res.writeHead(500);res.end("Invalid request");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await pp.launch({browser:engine,headless:true,
  executablePath:process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1400,height:910,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
 "/web/silver-kick-grounding-p0-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_GROUNDED_KICK_QA__?.().ready,{timeout:25000});
 await page.click("#play");
 let checks=0;
 for(let frame=0;frame<8;frame++){
  for(let facing=0;facing<8;facing++){
   const state=await page.evaluate(frame=>{
    const slider=document.getElementById("frame");
    slider.value=String(frame);
    slider.dispatchEvent(new Event("input",{bubbles:true}));
    return window.__GRAPHICS3A_GROUNDED_KICK_QA__();
   },frame);
   assert.equal(state.frame,frame);
   assert.equal(state.directions,8);
   assert.deepEqual(state.atlasBytes,[1280,1280]);
   assert.equal(state.durationMs,380);
   assert.equal(state.renderedCharacterPixelsByFacing.length,8);
   assert.ok(state.renderedCharacterPixelsByFacing[facing][0]>65,
     "Baseline Silver source pixels must be drawn at all eight directions");
   assert.ok(state.renderedCharacterPixelsByFacing[facing][1]>65,
     "Corrected source pixels must be drawn at all eight directions");
   assert.equal(state.realGreyhaven,false);
   assert.equal(state.humanApproved,false);
   assert.equal(state.realCombat,false);
   checks++;
  }
 }
 const shots=[];
 for(const frame of [0,2,4,7]){
  await page.evaluate(frame=>{
   const slider=document.getElementById("frame");
   slider.value=String(frame);
   slider.dispatchEvent(new Event("input",{bubbles:true}));
  },frame);
  const file="silver_grounded_kick_"+engine+"_frame"+frame+".png";
  await page.screenshot({path:join(out,file),fullPage:true});
  shots.push(file);
 }
 assert.deepEqual(errors,[]);
 const report={engine,browser:await browser.version(),checks,frameCount:8,
  allFacings:8,originalFirstPartyWebP:true,neutralStudioOnly:true,
  realGameplay:false,humanApproved:false,errors,screenshots:shots};
 await writeFile(join(out,"silver_grounded_kick_"+engine+".json"),
  JSON.stringify(report,null,2)+"\n");
 console.log("SOURCE_GROUNDED_KICK_BROWSER="+JSON.stringify({
  engine,browser:report.browser,checks,screenshots:shots.length,errors:errors.length}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
