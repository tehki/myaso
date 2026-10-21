#!/usr/bin/env node
// Actual native Chrome/Firefox source-art preview proof. No gameplay or auth.
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const dest=resolve(process.argv[2]||join(root,".rig-grip-native"));
await mkdir(dest,{recursive:true});
const types={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  const file=resolve(root,"."+decodeURIComponent(url.pathname));
  const rel=relative(root,file);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(file)){
   res.writeHead(404);res.end("Missing source");return;
  }
  res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream",
  "cache-control":"no-store"});res.end(await readFile(file));
 }catch{res.writeHead(500);res.end("bad file request");}
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
 await page.setViewport({width:1330,height:850,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/silver-rig-grip-a3-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_GRIP_QA__?.().ready,{timeout:35000});
 const state=await page.evaluate(()=>window.__GRAPHICS3A_GRIP_QA__());
 assert.deepEqual(state.imagePixels,[1792,1792]);
 assert.equal(state.visualRollMs,350);
 assert.equal(state.sourceOnly,true);
 assert.equal(state.humanApproved,false);
 assert.equal(state.realGameplay,false);
 await page.click("#toggle");
 let tested=0;
 for(let frame=0;frame<8;frame++){
  for(let dir=0;dir<8;dir++){
   const actual=await page.evaluate(({frame,dir})=>{
    const slider=document.getElementById("frame"),facing=document.getElementById("facing");
    slider.value=String(frame);slider.dispatchEvent(new Event("input",{bubbles:true}));
    facing.value=String(dir);facing.dispatchEvent(new Event("change",{bubbles:true}));
    return window.__GRAPHICS3A_GRIP_QA__();
   },{frame,dir});
   assert.equal(actual.frame,frame);
   assert.equal(actual.directions,8);
   assert.equal(actual.visualRollMs,350);
   tested++;
  }
 }
 const shots=[];
 for(const frame of [0,3,5,7]){
  await page.evaluate(frame=>{
   const slider=document.getElementById("frame"),facing=document.getElementById("facing");
   slider.value=String(frame);slider.dispatchEvent(new Event("input",{bubbles:true}));
   facing.value="-1";facing.dispatchEvent(new Event("change",{bubbles:true}));
  },frame);
  const name="silver_rig_grip_"+engine+"_frame"+frame+".png";
  await page.screenshot({path:join(dest,name),fullPage:true});
  shots.push(name);
 }
 assert.deepEqual(errors,[]);
 const result={engine,browser:await browser.version(),checks:tested,
  renderedAtlasKinds:2,directions:8,frames:8,loopMs:350,
  sourceOnly:true,actualGreyhaven:false,authenticatedItem:false,
  humanVisualApproved:false,errors,screenshots:shots};
 await writeFile(join(dest,"silver_rig_grip_"+engine+".json"),
  JSON.stringify(result,null,2)+"\n");
 console.log("NATIVE_RIG_GRIP="+JSON.stringify({engine,browser:result.browser,
   checks:tested,screenshots:shots.length,errors:errors.length,realGame:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}