#!/usr/bin/env node
// A2.33 isolated original-source browser acceptance; never touches actual online-game.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,join,relative,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2]&&process.argv[3]&&process.argv[4],"Need pinned 3C, Knight, adult checkouts and output");
const c3=resolve(process.argv[2]),knights=resolve(process.argv[3]),
 adults=resolve(process.argv[4]),out=resolve(process.argv[5]||join(repo,".a233-browser"));
const pins={c3:"8e85584b6007b38e1a00155b77473e92b0afec6a",
 knight:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
 adult:"91f1c2c4737b8f0275bb22bfbca4acc1501daa00"};
for(const [dir,key] of [[c3,"c3"],[knights,"knight"],[adults,"adult"]])
 assert.equal(execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),pins[key]);
const sources={
 "/__a233_3c__/authored-maps.mjs":join(c3,"src/world/authored-maps.mjs"),
 "/__a233_3c__/greyhaven-atmosphere.mjs":join(c3,"src/browser/greyhaven-atmosphere.mjs"),
 "/__a233_knights__/silver_idle.webp":join(knights,"web/assets/knights/silver_idle.webp"),
 "/__a233_adults__/adult-masculine_idle.webp":join(adults,"web/assets/adults/adult-masculine_idle.webp")};
const sha=async file=>createHash("sha256").update(await readFile(file)).digest("hex");
assert.equal(await sha(sources["/__a233_knights__/silver_idle.webp"]),
 "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
assert.equal(await sha(sources["/__a233_adults__/adult-masculine_idle.webp"]),
 "ba1918e5dd3fb4d00738d18ab4f708b6c54789ac09893bd06aed9eac2a65aa8b");
const permitted=new Set([
 "web/greyhaven-a233-depth-browser.html","web/greyhaven-a233-depth-browser.mjs",
 "src/browser/arena-viewport.mjs","src/browser/red-lion-visual-depth-review.mjs",
 "assets/environment/greyhaven/a231-review/greyhaven_a231_lighting_handoff.json",
 "assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp",
 "assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp",
 "assets/environment/greyhaven/a232-review/greyhaven_a232_threshold_actor_alpha_report.json"]);
const types={".mjs":"text/javascript; charset=utf-8",".json":"application/json",".html":"text/html; charset=utf-8",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let file=sources[path];
  if(!file){
   file=resolve(repo,"."+path);
   if(!permitted.has(relative(repo,file).replaceAll("\\","/"))){res.writeHead(404);res.end();return;}
  }
  if(!existsSync(file)){res.writeHead(404);res.end();return;}
  const bytes=await readFile(file);
  res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
  res.end(bytes);
 }catch(error){res.writeHead(500);res.end("local read failure");}
});
await mkdir(out,{recursive:true});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const uri="http://127.0.0.1:"+server.address().port+"/web/greyhaven-a233-depth-browser.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const results=[];
try{
 for(const mode of ["chrome","firefox"]){
  let browser;
  try{
   const opts={headless:true,executablePath:mode==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(mode==="chrome")opts.args=["--no-sandbox","--disable-gpu-sandbox"];
   else {opts.browser="firefox";opts.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(opts);
   const page=await browser.newPage(),errors=[];
   await page.setViewport({width:1410,height:970,deviceScaleFactor:1});
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.goto(uri,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>window.__a233Review?.()?.ready,{timeout:15000});
   const cases=[];
   for(const y of [-20,0,20]){
    const result=await page.evaluate(async(y)=>{
     const ctrl=document.getElementById("northY");
     ctrl.value=String(y);ctrl.dispatchEvent(new Event("input",{bubbles:true}));
     await new Promise(requestAnimationFrame);
     const before=document.getElementById("static").getContext("2d").getImageData(240,210,180,210).data;
     const after=document.getElementById("proposed").getContext("2d").getImageData(240,210,180,210).data;
     let changed=0;
     for(let i=0;i<before.length;i+=4){
      if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++;
     }
     return {state:window.__a233Review(),changedViewportPixels:changed};
    },y);
    const state=result.state;
    assert.equal(state.ready,true);
    assert.equal(state.northY,y);
    assert.deepEqual(state.frontIds,y<0?["west","south"]:(y===0?["north","west","south"]:["west","south","north"]));
    assert.deepEqual(state.behindIds,y<0?["north"]:[]);
    assert.equal(state.thresholdAlphaHazardCount,69);
    assert.equal(state.source3CVersion,"3c-p24-1");
    assert.deepEqual(state.originalWorldEntrance,[4365,4060]);
    assert.deepEqual(state.visualDoor,[4365,4075]);
    assert.deepEqual(state.lanternXY,[4365,4045]);
    assert.equal(state.actualGameRendererIntegrated,false);
    assert.equal(state.realOcclusionValidated,false);
    assert.equal(state.serverPortalOrCollisionChanged,false);
    assert.equal(state.productionApproved,false);
    if(y<0)assert.ok(result.changedViewportPixels>0);
    else assert.equal(result.changedViewportPixels,0);
    const filename="greyhaven_a233_"+mode+"_north"+(y<0?"minus"+(-y):"plus"+y)+".png";
    await page.screenshot({path:join(out,filename),fullPage:true});
    cases.push({filename,northY:y,changedViewportPixels:result.changedViewportPixels,state});
   }
   assert.deepEqual(errors,[]);
   results.push({engine:mode,version:await browser.version(),errors,cases,originalWorldRendererUsed:false});
  }finally{await browser?.close();}
 }
 const report={milestone:"Blood & Iron A2.33 isolated source-faithful visual depth stage proposal",
  pins,results,screenshots:results.reduce((sum,v)=>sum+v.cases.length,0),
  actualOnlineGameRendererIntegrated:false,authoritativeDoorCollisionChanged:false,
  automaticRoofFadeEnabled:false,productionApproved:false};
 await writeFile(join(out,"greyhaven_a233_native_depth_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("A233="+JSON.stringify(results.map(x=>({engine:x.engine,version:x.version,
  count:x.cases.length,diffs:x.cases.map(v=>v.changedViewportPixels),errors:x.errors}))));
}finally{await new Promise(r=>server.close(r));}
