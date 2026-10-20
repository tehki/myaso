#!/usr/bin/env node
// Actual Chrome/Firefox acceptance of the original Graphics 3A adult A0 atlases.
// Localhost and standalone preview only; no networked server, inventory or gameplay changes.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".a0-browser-local"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try {
  const u=new URL(req.url,"http://localhost");
  const abs=resolve(root,"."+decodeURIComponent(u.pathname));
  const rel=relative(root,abs);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(abs)){
   res.writeHead(404);res.end("not found");return;
  }
  res.writeHead(200,{"content-type":mime[extname(abs)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(await readFile(abs));
 }catch{res.writeHead(500);res.end("local QA error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await pp.launch({browser:process.env.ADULT_QA_BROWSER||"chrome",headless:true,
  executablePath:process.env.ADULT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1200,height:900,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
 "/web/adult-body-a0-preview.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__ADULT_A0_PREVIEW__?.().loaded===2,{timeout:30000});
 const states=[];
 for(const body of ["adult-masculine","adult-feminine"]){
  for(let direction=0;direction<8;direction++){
   const state=await page.evaluate(({body,direction})=>{
    const bs=document.querySelector("#body"),ds=document.querySelector("#direction");
    bs.value=body;ds.value=String(direction);
    bs.dispatchEvent(new Event("change"));ds.dispatchEvent(new Event("change"));
    return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>
      resolve(window.__ADULT_A0_PREVIEW__()))));
   },{body,direction});
   assert.equal(state.selected,body);
   assert.equal(state.direction,direction);
   assert.deepEqual(state.equipment,["base-body"]);
   assert.deepEqual(state.drawSize,[96,96]);
   assert.deepEqual(state.atlasSize,[640,1280]);
   assert.deepEqual(state.errors,[]);
   states.push({body,direction,loaded:state.loaded,frame:state.frame});
  }
 }
 assert.deepEqual(errors,[]);
 await page.screenshot({path:join(out,"adult_body_a0_browser.png"),fullPage:true});
 const report={browser:await browser.version(),states,errors,
  directionalSamples:states.length,atlases:2,sourceFrames:160,
  actualGameNetworked:false,modelRealismApproved:false,productionEnabled:false};
 await writeFile(join(out,"adult_body_a0_browser.json"),JSON.stringify(report,null,2)+"\n");
 console.log("ADULT_A0_BROWSER="+JSON.stringify({browser:report.browser,
  scenarios:states.length,atlases:2,pageErrors:errors.length}));
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
