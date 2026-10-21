#!/usr/bin/env node
// A2.32: genuine source-art entrance-side actor occlusion risk review, Chrome + Firefox, with independent exact-sha 3A & 3C source.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2]&&process.argv[3]&&process.argv[4],
 "args: pinned3C pinnedKnight pinnedAdult outputDir");
const c3=resolve(process.argv[2]),knights=resolve(process.argv[3]),
 adults=resolve(process.argv[4]),out=resolve(process.argv[5]||join(root,".a232-browser"));
const heads={c3:"8e85584b6007b38e1a00155b77473e92b0afec6a",
 knights:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
 adults:"91f1c2c4737b8f0275bb22bfbca4acc1501daa00"};
for(const [p,dir] of [[heads.c3,c3],[heads.knights,knights],[heads.adults,adults]])
 assert.equal(execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),p);
const permitted=new Set([
 "web/greyhaven-a231-composite-browser.html","web/greyhaven-a231-composite-browser.mjs",
 "src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/a231-review/greyhaven_a231_lighting_handoff.json",
 "assets/environment/greyhaven/a231-review/red_lion_a231_day_dimensional.webp",
 "assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp",
 "assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp"]);
const paths={
 "/__a231_3c__/greyhaven-atmosphere.mjs":join(c3,"src/browser/greyhaven-atmosphere.mjs"),
 "/__a231_3c__/authored-maps.mjs":join(c3,"src/world/authored-maps.mjs"),
 "/__a231_knights__/silver_idle.webp":join(knights,"web/assets/knights/silver_idle.webp"),
 "/__a231_knights__/asset-build-report.json":join(knights,"web/assets/knights/asset-build-report.json"),
 "/__a231_adults__/adult-masculine_idle.webp":join(adults,"web/assets/adults/adult-masculine_idle.webp"),
 "/__a231_adults__/adult-masculine_idle.json":join(adults,"web/assets/adults/adult-masculine_idle.json")};
const hash=async p=>createHash("sha256").update(await readFile(p)).digest("hex");
assert.equal(await hash(paths["/__a231_knights__/silver_idle.webp"]),
 "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
assert.equal(await hash(paths["/__a231_adults__/adult-masculine_idle.webp"]),
 "ba1918e5dd3fb4d00738d18ab4f708b6c54789ac09893bd06aed9eac2a65aa8b");
const alpha=JSON.parse(await readFile(join(root,"assets/environment/greyhaven/a232-review/greyhaven_a232_threshold_actor_alpha_report.json"),"utf8"));
assert.equal(alpha.sourceFacadeAlphaHazard.count,69);
const rawSources=Object.fromEntries(await Promise.all(
 ["/__a231_3c__/greyhaven-atmosphere.mjs","/__a231_3c__/authored-maps.mjs"].map(async p=>[p,await hash(paths[p])])
));
const types={".mjs":"text/javascript; charset=utf-8",".json":"application/json",".html":"text/html; charset=utf-8",".webp":"image/webp"};
const server=createServer(async(request,response)=>{
 try{
  const p=decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);
  let file=paths[p];
  if(!file){
   const value=resolve(root,"."+p);
   const rel=relative(root,value).replaceAll("\\","/");
   if(permitted.has(rel))file=value;
  }
  if(!file||!existsSync(file)){response.writeHead(404);response.end("not found");return;}
  const data=await readFile(file);
  response.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream",
    "Cache-Control":"no-store"});response.end(data);
 }catch(e){response.writeHead(500);response.end("local art server failed");}
});
await mkdir(out,{recursive:true});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const uri="http://127.0.0.1:"+server.address().port+"/web/greyhaven-a231-composite-browser.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const results=[];

try{
 for(const name of ["chrome","firefox"]){
  let browser;
  try{
   const options={headless:true,
    executablePath:name==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(name==="chrome")options.args=["--no-sandbox","--disable-gpu-sandbox"];
   else {options.browser="firefox";options.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(options);
   const page=await browser.newPage();
   const errors=[];
   page.on("pageerror",err=>errors.push(err.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:1420,height:975,deviceScaleFactor:1});
   await page.goto(uri,{waitUntil:"networkidle0"});
   try { await page.waitForFunction(()=>window.__a231Review?.()?.ready,{timeout:15000}); }
   catch(error){ console.log('A231_PAGE_DIAGNOSTIC='+JSON.stringify({engine:name,errors,status:await page.$eval('#status',el=>el.textContent)})); throw error; }
   const captures=[];
   for(const [dx,dy,depth,label] of [[-25,0,"front","west-front"],[-25,0,"behind","west-behind"],
      [25,0,"front","east-front"],[25,0,"behind","east-behind"]]){
    const state=await page.evaluate(async({dx,dy,depth})=>{
     for(const [id,value] of Object.entries({dx,dy,depth})){
      const e=document.getElementById(id);e.value=String(value);
      e.dispatchEvent(new Event("input",{bubbles:true}));
     }
     await new Promise(resolve=>requestAnimationFrame(resolve));
     return window.__a231Review();
    },{dx,dy,depth});
    assert.equal(state.ready,true);
    assert.deepEqual([state.dx,state.dy],[dx,dy]);
    assert.equal(state.depth,depth);
    assert.equal(state.single3CSourceVersion,"3c-p24-1");
    assert.equal(state.redLion3CLightCount,1);
    assert.equal(state.facade3BApertureNoRadialGlow,true);
    assert.deepEqual(state.fixtureWorldXY,[4365,4045]);
    assert.deepEqual(state.poolWorldXY,[4365,4069]);
    assert.deepEqual(state.artDoor,[4365,4075]);
    assert.deepEqual(state.authoredWorldEntrance,[4365,4060]);
    assert.equal(state.cachedChunks,2);
    assert.ok(state.playerXYErrorPx<.001);
    assert.equal(state.realGameDrawOrderValidated,false);
    assert.equal(state.engineScreenshotOnly,true);
    assert.equal(state.productionApproved,false);
    assert.equal(state.adultPreviewProductionApproved,false);
    const fname="greyhaven_a232_"+name+"_"+label+".png";
    const predicted=alpha.cases.find(c=>c.sprite==="silver-knight"&&c.scenario===(dx===-25?"west-threshold":"east-threshold"));
    assert.equal(predicted.changedAlphaPixelsUnderActor,dx===-25?32:37);
    await page.screenshot({path:join(out,fname),fullPage:true});
    captures.push({name:fname,state,expectedSourceOverlapPixels:predicted.changedAlphaPixelsUnderActor});
   }
   assert.deepEqual(errors,[]);
   results.push({engine:name,version:await browser.version(),captures,errors,
    scenarioCount:captures.length,sourceAlphaThresholdOnly:true,
    actualWorldClientFPSMeasured:false,networkGameplayValidated:false,productionApproved:false});
  }finally{await browser?.close();}
 }
 const report={milestone:"Blood & Iron A2.32 original threshold occlusion-source alpha risk, genuine Chrome and Firefox",
  sources:heads,sourceJsHashes:rawSources,originalKnightAuthentic:true,adultPreviewStillDraft:true,
  reviews:results,screenshots:results.reduce((n,x)=>n+x.captures.length,0),
  predictedThresholdSourceAlpha:alpha.sourceFacadeAlphaHazard,
  rendererAndServerDepthNotValidated:true,
  artworkReviewOnly:true,staticThreeCLightingFromSource:true,
  worldChunkRendererIntegrated:false,dynamicDayNightImplemented:false,
  liveCombatOcclusionValidated:false,fullMultiplayerFPSMeasured:false,
  productionApproved:false};
 await writeFile(join(out,"greyhaven_a232_native_alpha_overlap_browser_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("A232_NATIVE="+JSON.stringify(results.map(x=>({engine:x.engine,version:x.version,
  screenshots:x.captures.length,errors:x.errors,overlaps:x.captures.map(v=>v.expectedSourceOverlapPixels)}))));
}finally{await new Promise(resolve=>server.close(resolve));}
