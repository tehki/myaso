#!/usr/bin/env node
// Native Chrome and Firefox verification of actual Knight game-client renderer
// with intentionally SIMULATED snapshot inputs: not authoritative PvP proof.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".silver-optin-mock-qa"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  const file=resolve(root,"."+decodeURIComponent(url.pathname));
  const rel=relative(root,file);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(file)){
   res.writeHead(404);res.end("Not found");return;
  }
  res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(await readFile(file));
 }catch(error){res.writeHead(500);res.end("Invalid path");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await pp.launch({browser:engine,headless:true,executablePath:process.env.KNIGHT_QA_EXECUTABLE,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1200,height:860,deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+":"+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
   "/web/silver-spartan-optin-game-render-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_SPARTAN_OPTIN_CLIENT_QA__?.ready(),{timeout:25000});
 const reports=[];
 for(let stage=0;stage<5;stage++){
  for(let direction=0;direction<8;direction++){
   const status=await page.evaluate(({stage,direction})=>
     window.__GRAPHICS3A_SPARTAN_OPTIN_CLIENT_QA__.run(stage,direction),{stage,direction});
   assert.equal(status.stage,stage);
   assert.equal(status.direction,direction);
   assert.equal(status.ready,true);
   assert.equal(status.realServer,false);
   assert.equal(status.realGreyhaven,false);
   assert.equal(status.simulatedAuthoritativeStates,true);
   assert.equal(status.actorCount,2);
   for(let actor=0;actor<2;actor++){
    const sample=status.results[actor];
    assert.equal(sample.id,actor+1);
    const action=stage===0?12:stage===1?(actor===0?12:13)
      :stage===2?(actor===0?13:14):stage===3?14:(actor===0?8:0);
    const allowed=action===12?[0,1,2]:action===13?[3,4]:action===14?[5,6,7]:[];
    assert.equal(sample.kickFrames.length,allowed.length?1:0);
    for(const frame of sample.kickFrames)assert.ok(allowed.includes(frame),
      "stage "+stage+" action "+action+" may only draw its source phase");
    for(const facing of sample.directions)assert.equal(facing,direction);
   }
   assert.equal(status.kickDrawCount,stage===4?0:2);
   reports.push({stage,direction,frames:status.results.map(x=>x.kickFrames)});
  }
 }
 const screenshots=[];
 for(const [stage,direction] of [[0,0],[1,2],[2,4],[3,6],[4,0]]){
  await page.evaluate(({stage,direction})=>
    window.__GRAPHICS3A_SPARTAN_OPTIN_CLIENT_QA__.run(stage,direction),{stage,direction});
  const file="silver_optin_mock_"+engine+"_stage"+stage+"_dir"+direction+".png";
  await page.screenshot({path:join(out,file),fullPage:true});screenshots.push(file);
 }
 assert.deepEqual(errors,[]);
 const result={browser:await browser.version(),engine,checks:reports.length,stages:5,
  originalGameSpriteRenderer:true,actualFirstPartyWebP:true,actorCount:2,
  simulatedSnapshotInputs:true,realServer:false,realPvP:false,realGreyhaven:false,
  pageErrors:errors,images:screenshots,sourcePhaseChecks:reports};
 await writeFile(join(out,"silver_optin_mock_"+engine+".json"),JSON.stringify(result,null,2)+"\n");
 console.log("SILVER_OPTIN_BROWSER_RENDER_QA "+JSON.stringify({
  engine,browser:result.browser,checks:reports.length,actors:2,
  screenshots:screenshots.length,errors:errors.length,realServer:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
