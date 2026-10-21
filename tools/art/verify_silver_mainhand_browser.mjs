#!/usr/bin/env node
// Source-real original Silver/3B sword art proof. No live server or receipts.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {extname,resolve,relative,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".silver-hand-evidence"));
await mkdir(out,{recursive:true});
const mimes={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".json":"application/json",
 ".webp":"image/webp",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,"http://localhost");
  const file=resolve(root,"."+decodeURIComponent(url.pathname));
  const rel=relative(root,file);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(file)){
   res.writeHead(404);res.end("Not Found");return;
  }
  res.writeHead(200,{"content-type":mimes[extname(file)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(await readFile(file));
 }catch{res.writeHead(500);res.end("Invalid source");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 browser=await puppeteer.launch({browser:engine,headless:true,
  executablePath:process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1400,height:900,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push(r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
   "/web/silver-mainhand-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_HELD_SWORD_QA__?.().ready,{timeout:20000});
 const frames={silver_idle:4,silver_walk:8,silver_sprint:8,silver_jump:6,silver_roll:8};
 const cases=[];
 for(const [clip,n] of Object.entries(frames)){
  for(let frame=0;frame<n;frame++){
   for(const receipt of ["committed","pending"]){
    const info=await page.evaluate(({clip,frame,receipt})=>{
     const c=document.querySelector("#clip");
     if(c.value!==clip){c.value=clip;c.dispatchEvent(new Event("change",{bubbles:true}));}
     const r=document.querySelector("#receipt");
     if(r.value!==receipt){r.value=receipt;r.dispatchEvent(new Event("change",{bubbles:true}));}
     const f=document.querySelector("#frame");
     f.value=String(frame);f.dispatchEvent(new Event("input",{bubbles:true}));
     return window.__GRAPHICS3A_HELD_SWORD_QA__();
    },{clip,frame,receipt});
    assert.equal(info.ready,true);
    assert.equal(info.sourceAtlases,5);
    assert.deepEqual(info.swordSourcePx,[42,115]);
    assert.equal(info.data.length,16);
    assert.equal(info.clip,clip);
    assert.equal(info.frame,frame);
    assert.equal(info.receipt,receipt);
    assert.equal(info.realServer,false);
    assert.equal(info.authenticatedItems,false);
    assert.equal(info.humanVisualApproved,false);
    for(let d=0;d<8;d++){
     const unarmed=info.data[d*2],held=info.data[d*2+1];
     assert.equal(unarmed.direction,d);
     assert.equal(held.direction,d);
     assert.equal(unarmed.heldSword,false);
     assert.equal(held.heldSword,receipt==="committed"&&!["silver_jump","silver_roll"].includes(clip));
     assert.equal(held.itemId,receipt==="committed"&&!["silver_jump","silver_roll"].includes(clip)?"ART-QA-ONLY-NO-CANONICAL-ID":null);
    }
    cases.push({clip,frame,receipt,held:info.data.filter(x=>x.heldSword).length});
   }
  }
 }
 const shots=[];
 for(const [clip,frame,receipt] of [
  ["silver_idle",0,"committed"],["silver_walk",3,"committed"],
  ["silver_roll",4,"committed"],["silver_idle",0,"pending"]]){
  await page.evaluate(({clip,frame,receipt})=>{
   const c=document.querySelector("#clip"),f=document.querySelector("#frame"),
       r=document.querySelector("#receipt");
   if(c.value!==clip){c.value=clip;c.dispatchEvent(new Event("change",{bubbles:true}));}
   r.value=receipt;r.dispatchEvent(new Event("change",{bubbles:true}));
   f.value=String(frame);f.dispatchEvent(new Event("input",{bubbles:true}));
  },{clip,frame,receipt});
  const shot="silver_mainhand_"+engine+"_"+clip+"_"+receipt+".png";
  await page.screenshot({path:join(out,shot),fullPage:true});
  shots.push(shot);
 }
 assert.deepEqual(errors,[]);
 const report={engine,browser:await browser.version(),source: "Graphics 3A original Silver and 3B pinned sword",
  clipCount:5,directionCount:8,validatedCases:cases.length,validatedFacingSlots:cases.length*8,
  screenshots:shots,errors,realServer:false,actualItems:false,
  assertedLiveReceipt:false,approved:false,
  cases};
 await writeFile(join(out,"silver_mainhand_"+engine+".json"),JSON.stringify(report,null,2)+"\n");
 console.log("SILVER_MAINHAND_BROWSER="+JSON.stringify({
  engine,browser:report.browser,cases:cases.length,facings:cases.length*8,
  screenshots:shots.length,errors:errors.length,actualServer:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}