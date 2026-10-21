#!/usr/bin/env node
// Native Chrome/Firefox first-party Silver ORIGINAL-source 8-direction motion QA.
// No live game, no real Combat snapshots, no real Greyhaven ground or pickup.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".native-kick-dash-p0"));
await mkdir(out,{recursive:true});
const type={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json",
 ".png":"image/png",".gif":"image/gif"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  const full=resolve(root,"."+decodeURIComponent(url.pathname));
  const rel=relative(root,full);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(full)){
   res.writeHead(404);res.end("Missing QA art");return;
  }
  res.writeHead(200,{"content-type":type[extname(full)]||"application/octet-stream",
    "cache-control":"no-store"});res.end(await readFile(full));
 }catch {res.writeHead(500);res.end("Invalid asset request");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 browser=await pp.launch({browser:engine,headless:true,
   executablePath:process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
   args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1400,height:1030,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/silver-kick-dash-p0-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_KICK_DASH_QA__?.().ready,{timeout:25000});
 const config={silver_kick_p0:380,silver_dash_p0:140};
 await page.click("#toggle");
 const checks=[];
 for(const [clip,ms] of Object.entries(config)){
  for(let phase=0;phase<8;phase++){
   for(let facing=0;facing<8;facing++){
    const state=await page.evaluate(({clip,phase})=>{
     const c=document.querySelector("#clip");
     if(c.value!==clip){c.value=clip;c.dispatchEvent(new Event("change",{bubbles:true}));}
     const f=document.querySelector("#frame");
     f.value=String(phase);f.dispatchEvent(new Event("input",{bubbles:true}));
     return window.__GRAPHICS3A_KICK_DASH_QA__();
    },{clip,phase});
    assert.equal(state.clip,clip);
    assert.equal(state.frame,phase);
    assert.equal(state.loopMs,ms);
    assert.equal(state.visualApproved,false);
    assert.equal(state.realGame,false);
    assert.equal(state.hasRealItemReceipt,false);
    assert.equal(state.originalGround,false);
    assert.equal(state.atlases.length,4);
    for(const a of state.atlases)assert.deepEqual(a.pixels,
      [a.name==="silver_idle"?640:1280,1280]);
    checks.push({clip,phase,facing});
   }
  }
 }
 const shots=[];
 for(const [clip,frame] of [["silver_kick_p0",0],["silver_kick_p0",2],
                            ["silver_kick_p0",4],["silver_dash_p0",2],
                            ["silver_dash_p0",4],["silver_dash_p0",6]]){
  await page.evaluate(({clip,frame})=>{
   const a=document.querySelector("#clip"),b=document.querySelector("#frame");
   a.value=clip;a.dispatchEvent(new Event("change",{bubbles:true}));
   b.value=String(frame);b.dispatchEvent(new Event("input",{bubbles:true}));
  },{clip,frame});
  const name="silver_p0_"+engine+"_"+clip+"_frame"+frame+".png";
  await page.screenshot({path:join(out,name),fullPage:true});
  shots.push(name);
 }
 assert.deepEqual(errors,[]);
 const report={engine,browser:await browser.version(),checks:checks.length,
  directions:8,sourceFramesPerAction:8,actions:2,
  realGameplay:false,actualGreyhaven:false,humanVisualApproval:false,
  errors,screenshots:shots};
 await writeFile(join(out,"silver_kick_dash_"+engine+".json"),
  JSON.stringify(report,null,2)+"\n");
 console.log("GRAPHICS3A_P0_REAL_BROWSER="+JSON.stringify({
  engine,browser:report.browser,checks:checks.length,
  screenshots:shots.length,errors:errors.length,authenticatedGame:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
