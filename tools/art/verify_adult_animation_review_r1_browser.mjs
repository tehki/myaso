#!/usr/bin/env node
// R1 authentic Chrome/Firefox capture of non-production adult animation preview.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".animation-review-r1"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".webp":"image/webp",
 ".json":"application/json",".gif":"image/gif",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const uri=new URL(req.url,"http://localhost");
  const path=resolve(root,"."+decodeURIComponent(uri.pathname)),rel=relative(root,path);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(path)){
   res.writeHead(404);res.end("not found");return;
  }
  res.writeHead(200,{"content-type":mime[extname(path)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(await readFile(path));
 }catch{res.writeHead(500);res.end("QA server error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const browserType=process.env.ADULT_QA_BROWSER||"chrome";
 browser=await pp.launch({browser:browserType,headless:true,
  executablePath:process.env.ADULT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1540,height:1080,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 const url="http://127.0.0.1:"+server.address().port+"/web/adult-animation-review-r1.html";
 await page.goto(url,{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__ADULT_ANIMATION_REVIEW_R1__?.()?.ready,
  {timeout:45000});
 // Pause actual running page; test every clip, all eight directions and three
 // manually scrubbed source phases. Animating GIF evidence is separately built.
 await page.click("#toggle");
 const captures=[],results=[];
 for(const [clip,count] of [["idle",4],["walk",4],["run",4],["roll",8]]){
  for(let direction=0;direction<8;direction++){
   const keyFrames=[0,Math.floor(count/2),count-1];
   for(const frame of keyFrames){
    const s=await page.evaluate(async({clip,direction,frame})=>{
     const set=(id,value)=>{
      const el=document.getElementById(id);el.value=String(value);
      el.dispatchEvent(new Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}));
     };
     set("clip",clip);set("direction",direction);set("scrub",frame);
     await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
     return window.__ADULT_ANIMATION_REVIEW_R1__();
    },{clip,direction,frame});
    assert.equal(s.ready,true);
    assert.equal(s.loaded,14);
    assert.deepEqual(s.errors,[]);
    assert.equal(s.clip,clip);
    assert.equal(s.direction,direction);
    assert.equal(s.frame,frame);
    assert.equal(s.gridDraws,24,"3 real original atlases by 8 facings must draw");
    assert.equal(s.compareDraws,12,"2 original adults × 6 reference action states");
    assert.equal(s.actualKnightAtlasesLoaded,true);
    assert.equal(s.actualWorldSpritesLoaded,true);
    assert.equal(s.neutralPreview,true);
    assert.equal(s.worldReferenceComposite,true);
    assert.equal(s.actualNetworkedGame,false);
    assert.equal(s.gameplayFootContactProven,false);
    assert.equal(s.approvedForRelease,false);
    results.push({clip,direction,frame});
   }
  }
  await page.evaluate(async({clip})=>{
   const select=document.getElementById("clip");
   select.value=clip;select.dispatchEvent(new Event("change"));
   const d=document.getElementById("direction");d.value="0";d.dispatchEvent(new Event("change"));
   const scrub=document.getElementById("scrub");scrub.value="0";scrub.dispatchEvent(new Event("input"));
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
  },{clip});
  const shot=join(out,"adult_review_"+browserType+"_"+clip+".png");
  await page.screenshot({path:shot,fullPage:true});
  captures.push(shot.split(/[\\/]/).at(-1));
 }
 for(const frame of [3,7]){
  await page.evaluate(async frame=>{
   const e=document.getElementById("scrub");e.value=String(frame);
   e.dispatchEvent(new Event("input"));
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
  },frame);
  const shot=join(out,"adult_review_"+browserType+"_roll_frame"+frame+".png");
  await page.screenshot({path:shot,fullPage:true});
  captures.push(shot.split(/[\\/]/).at(-1));
 }
 assert.deepEqual(errors,[]);
 const report={
  browser:await browser.version(),browserType,actualSourcesLoaded:14,
  adultBodies:2,clips:["idle","walk","run","roll"],directions:8,
  tested:results.length,passes:results.length,
  captures,failures:errors,realSilverKnightReference:true,
  realGreyhavenReferenceFromUnmergedGraphicsPR:true,
  actualGameRuntime:false,gameplayFootContact:false,
  humanVisualApproval:false,releaseAllowed:false,
  testScenarios:results,
 };
 await writeFile(join(out,"adult_review_"+browserType+".json"),
  JSON.stringify(report,null,2)+"\n");
 console.log("ADULT_REVIEW_R1_BROWSER="+JSON.stringify({
  browser:report.browser,tested:report.tested,captures:captures.length,
  errors:errors.length,gameRuntimeVerified:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
