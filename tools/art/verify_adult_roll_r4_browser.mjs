#!/usr/bin/env node
// Graphics 3A R4 authoritative *browser preview* evidence, not live game QA.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".r4-browser-evidence"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",
 ".webp":"image/webp",".gif":"image/gif",".json":"application/json",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,"http://localhost"),file=resolve(root,"."+decodeURIComponent(u.pathname));
  const rel=relative(root,file);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(file)){res.writeHead(404);res.end("not found");return;}
  res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream",
    "cache-control":"no-store"});res.end(await readFile(file));
 }catch{res.writeHead(500);res.end("invalid review request");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const engine=process.env.ADULT_QA_BROWSER||"chrome";
 browser=await pp.launch({browser:engine,headless:true,
  executablePath:process.env.ADULT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1430,height:1150,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/adult-roll-r4-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_R4__?.().ready,{timeout:40000});
 await page.click("#r4-toggle");
 const cells=[];
 for(let direction=0;direction<8;direction++){
  for(let frame=0;frame<8;frame++){
   const info=await page.evaluate(async({direction,frame})=>{
    const d=document.getElementById("r4-dir");
    d.value=String(direction);d.dispatchEvent(new Event("change",{bubbles:true}));
    const f=document.getElementById("r4-frame");
    f.value=String(frame);f.dispatchEvent(new Event("input",{bubbles:true}));
    await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
    return window.__GRAPHICS3A_R4__();
   },{direction,frame});
   assert.equal(info.ready,true);
   assert.equal(info.files,5);
   assert.equal(info.frame,frame);
   assert.equal(info.loopMs,350);
   assert.equal(info.directions,8);
   assert.equal(info.authoritativeGameplay,false);
   assert.equal(info.groundContactVerified,false);
   assert.equal(info.humanVisualApproval,false);
   assert.deepEqual(info.errors,[]);
   cells.push({direction,frame});
  }
 }
 const shots=[];
 for(const fr of [0,3,7]){
  await page.evaluate(async fr=>{
   const p=document.getElementById("r4-dir");p.value="2";p.dispatchEvent(new Event("change",{bubbles:true}));
   const f=document.getElementById("r4-frame");f.value=String(fr);f.dispatchEvent(new Event("input",{bubbles:true}));
   await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
  },fr);
  const filename="r4_"+engine+"_frame"+fr+".png";
  await page.screenshot({path:join(out,filename),fullPage:true});
  shots.push(filename);
 }
 assert.deepEqual(errors,[]);
 const result={engine,browser:await browser.version(),tested:cells.length,
  expectedFrameSlots:64,views:5,directions:8,frameSlots:8,loopMs:350,
  screenshots:shots,errors,onlyOfflineReview:true,
  verifiedLiveGame:false,humanApproved:false,productionReady:false,
  cases:cells};
 await writeFile(join(out,"r4_"+engine+".json"),JSON.stringify(result,null,2)+"\n");
 console.log("GRAPHICS_R4_BROWSER="+JSON.stringify({
  engine,browser:result.browser,cases:result.tested,screenshots:shots.length,
  errors:errors.length,actualGame:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
