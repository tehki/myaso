#!/usr/bin/env node
// Actual native Chrome/Firefox browser proof of source-only first-party Pre-Alpha
// Silver Knight WebPs. NO synthetic evidence is labeled real game-server PvP.
import {createServer} from "node:http";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {extname,resolve,relative,join} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]??join(root,".prealpha-silver-native-browser"));
await mkdir(out,{recursive:true});
const mime={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",".webp":"image/webp"};
const server=createServer(async(request,response)=>{
 try{
   const u=new URL(request.url,"http://127.0.0.1");
   const path=resolve(root,"."+decodeURIComponent(u.pathname));
   const safe=relative(root,path);
   if(safe.startsWith("..")||safe.startsWith("/")||safe.startsWith("\\")||!existsSync(path)){
     response.writeHead(404);response.end("Not found");return;
   }
   response.writeHead(200,{"content-type":mime[extname(path)]||"application/octet-stream",
     "cache-control":"no-store"});response.end(await readFile(path));
 }catch(e){response.writeHead(500);response.end("Internal error");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try {
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 browser=await pp.launch({browser:engine,headless:true,
   executablePath:process.env.KNIGHT_QA_EXECUTABLE,
   args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1280,height:740,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+": "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
   "/tests/fixtures/prealpha-silver-source-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_PREALPHA_SOURCE_QA__?.ready(),{timeout:25000});
 const clips={idle:"silver_idle",walk:"silver_walk",sprint:"silver_sprint",
   roll:"silver_roll",jump:"silver_jump"};
 const reports=[],images=[];
 for(const [clip,expected] of Object.entries(clips)){
   const r=await page.evaluate(clip=>
      window.__GRAPHICS3A_PREALPHA_SOURCE_QA__.run(clip),clip);
   assert.equal(r.trueServer,false);assert.equal(r.authenticatedPlayers,false);
   assert.equal(r.realGreyhaven,false);
   assert.deepEqual(r.atlasLoaded.sort(),Object.values(clips).sort());
   assert.equal(r.observed.length,8);
   for(let i=0;i<8;i++){
     const shot=r.observed[i];
     assert.equal(shot.d,i);assert.equal(shot.drew,true);
     assert.equal(shot.draws.length,1);
     assert.equal(shot.draws[0].source,expected+".webp");
     assert.equal(shot.draws[0].direction,i);
     assert.ok(shot.draws[0].frame>=0 && shot.draws[0].frame<(expected==="silver_idle"?4:expected==="silver_jump"?6:8));
   }
   const screenshot="prealpha_silver_"+engine+"_"+clip+"_8way.png";
   await page.screenshot({path:join(out,screenshot),fullPage:true});
   images.push(screenshot);reports.push({clip,source:expected,directions:8});
 }
 const unsupported=[12,13,14,1,2,3,22,23,24,6,25,9,8];
 for(const action of unsupported){
   const r=await page.evaluate(a=>
      window.__GRAPHICS3A_PREALPHA_SOURCE_QA__.unsupported(a),action);
   assert.equal(r.ok,false,"unsupported Combat action must keep truthful fallback: "+action);
   assert.equal(r.draws.length,0);
 }
 const npc=await page.evaluate(()=>
   window.__GRAPHICS3A_PREALPHA_SOURCE_QA__.unsupported(0,"npc"));
 assert.equal(npc.ok,false);assert.equal(npc.draws.length,0);
 assert.deepEqual(errors,[]);
 const results={browser:await browser.version(),engine,clips:reports,
   sourceCellChecks:40,unsupportedFallbackChecks:unsupported.length,
   npcRejected:true,realGameServer:false,realMultiplayer:false,
   authPlayers:false,sourceApprovedSpartanKickIncluded:false,
   screenCaptures:images,pageErrors:errors};
 await writeFile(join(out,"prealpha_silver_"+engine+"_native_source.json"),
   JSON.stringify(results,null,2)+"\n");
 console.log("PREALPHA_SILVER_NATIVE_SOURCE_QA "+JSON.stringify({
  browser:results.browser,sourceCellChecks:40,
  unsupportedFallbackChecks:unsupported.length,screenCaptures:images.length,
  pageErrors:0,realServer:false}));
}finally {
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
