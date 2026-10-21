#!/usr/bin/env node
// Standalone native Chrome/Firefox Graphics 3A A2 idle/walk/run/roll source-atlas QA.
// Not a networked game, foot-contact or combat timing test.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".a2-browser-local"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html;charset=utf-8",".mjs":"text/javascript;charset=utf-8",
 ".js":"text/javascript;charset=utf-8",".webp":"image/webp",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try{
  const uri=new URL(req.url,"http://localhost");
  const abs=resolve(root,"."+decodeURIComponent(uri.pathname)),rel=relative(root,abs);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(abs)){
   res.writeHead(404);res.end("not found");return;
  }
  res.writeHead(200,{"content-type":mime[extname(abs)]||"application/octet-stream","cache-control":"no-store"});
  res.end(await readFile(abs));
 }catch{res.writeHead(500);res.end("local QA error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await puppeteer.launch({browser:process.env.ADULT_QA_BROWSER||"chrome",headless:true,
  executablePath:process.env.ADULT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1200,height:900,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/adult-body-a2-preview.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__ADULT_A2_PREVIEW__?.().loaded===8,{timeout:30000});
 const results=[];
 for(const body of ["adult-masculine","adult-feminine"]){
  for(const clip of ["idle","walk","run","roll"]){
   for(let direction=0;direction<8;direction++){
    const state=await page.evaluate(({body,clip,direction})=>{
     for(const [id,value] of [["body",body],["clip",clip],["direction",String(direction)]]){
      const element=document.getElementById(id);element.value=value;
      element.dispatchEvent(new Event("change",{bubbles:true}));
     }
     return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>
      done(window.__ADULT_A2_PREVIEW__()))));
    },{body,clip,direction});
    assert.equal(state.body,body);assert.equal(state.clip,clip);
    assert.equal(state.direction,direction);assert.equal(state.loaded,8);
    assert.deepEqual(state.errors,[]);
    assert.deepEqual(state.layering,["base-body"]);
    assert.deepEqual(state.source,[160,160]);assert.deepEqual(state.destination,clip==="roll"?[134,134]:[96,96]);
    assert.equal(state.rollMs,350);assert.equal(state.spritesDrawn,2,"source frames must actually draw for both bodies");
    assert.equal(state.onlineGameplay,false);assert.equal(state.inventoryGranted,false);
    results.push({body,clip,direction,frame:state.frame});
   }
  }
 }
 assert.deepEqual(errors,[]);
 await page.screenshot({path:join(out,"adult_roll_a2.png"),fullPage:true});
 const report={browser:await browser.version(),cases:results.length,
  casesPassed:results.length,atlasCount:8,pageErrors:errors,
  results,actualMultiplayer:false,footContactProven:false,productionActive:false};
 await writeFile(join(out,"adult_roll_a2.json"),JSON.stringify(report,null,2)+"\n");
 console.log("ADULT_A2_BROWSER="+JSON.stringify({browser:report.browser,
  cases:report.cases,atlasCount:report.atlasCount,errors:errors.length}));
} finally {
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
