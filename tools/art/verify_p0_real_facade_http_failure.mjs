import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join,extname} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv.length>=6,"Need pinned World521, 3C P37, 3B A231, out");
const [world,threeC,threeB,out]=process.argv.slice(2,6).map(x=>resolve(x));
const heads={world:"3178b9aad8757ceb3594ff04b9e3099dced6b729",threeC:"efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac",threeB:"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5"};
for(const [path,head] of [[world,heads.world],[threeC,heads.threeC],[threeB,heads.threeB]])
 assert.equal(execFileSync("git",["-C",path,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),head);
const original={
 "day":"red_lion_a231_day_dimensional.webp",
 "dusk":"red_lion_a231_dusk_dimensional.webp",
 "roof":"red_lion_a231_roof_unchanged.webp"
};
const routes={
 "/__world521__/src/world/building-presentation.mjs":join(world,"src/world/building-presentation.mjs"),
 "/__world521__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 ...Object.fromEntries(["authored-world-renderer.mjs","greyhaven-atmosphere.mjs","greyhaven-terrain-materials.mjs"].map(f=>
  ["/__3cp37__/src/browser/"+f,join(threeC,"src/browser/"+f)])),
 "/__3cp37__/src/world/authored-maps.mjs":join(threeC,"src/world/authored-maps.mjs"),
 ...Object.fromEntries(Object.values(original).map(f=>[
  "/__3ba231__/assets/environment/greyhaven/a231-review/"+f,
  join(threeB,"assets/environment/greyhaven/a231-review/"+f)])),
 ...Object.fromEntries(["armory-p0-facade-failclosed-review.html","armory-p0-facade-failclosed-review.mjs"].map(f=>
  ["/web/"+f,join(repo,"web",f)])),
 "/src/browser/red-lion-original-art-readiness.mjs":join(repo,"src/browser/red-lion-original-art-readiness.mjs"),
 "/src/browser/red-lion-atomic-frame-qa.mjs":join(repo,"src/browser/red-lion-atomic-frame-qa.mjs"),
 "/src/browser/arena-viewport.mjs":join(repo,"src/browser/arena-viewport.mjs")
};
const sha=async p=>createHash("sha256").update(await readFile(p)).digest("hex");
const sourceHashes=Object.fromEntries(await Promise.all(Object.entries(routes).map(async([k,p])=>[k,await sha(p)])));
for(const [filename,expected] of [
 ["red_lion_a231_day_dimensional.webp","f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0"],
 ["red_lion_a231_dusk_dimensional.webp","4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3"],
 ["red_lion_a231_roof_unchanged.webp","f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1"]]){
 assert.equal(sourceHashes["/__3ba231__/assets/environment/greyhaven/a231-review/"+filename],expected);
}
await mkdir(out,{recursive:true});
const mode={current:"normal"};
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,"http://localhost").pathname;
 if(!routes[path]){res.writeHead(404);res.end();return;}
 if((mode.current==="fail-day"&&path.endsWith(original.day))||
    (mode.current==="fail-roof"&&path.endsWith(original.roof))){
  res.writeHead(503,{"Cache-Control":"no-store"});res.end("QA-injected failure");return;
 }
 try{const b=await readFile(routes[path]);
  res.writeHead(200,{"Cache-Control":"no-store",
   "Content-Type":extname(path)===".mjs"?"text/javascript":extname(path)===".webp"?"image/webp":"text/html"});
  res.end(b);
 }catch{res.writeHead(500);res.end();}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-facade-failclosed-review.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL)).default;
const trials=[];
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const cfg={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(engine==="chrome")cfg.args=["--no-sandbox"];
   else{cfg.browser="firefox";cfg.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(cfg);
   for(const situation of ["normal","fail-day","fail-roof","fail-draw"]){
    mode.current=situation;
    const page=await browser.newPage(),pageErrors=[],httpErrors=[];
    try{
     page.on("pageerror",e=>pageErrors.push(e.message));
     page.on("response",r=>{if(r.status()>=400)httpErrors.push({status:r.status(),path:new URL(r.url()).pathname});});
     await page.setViewport({width:1320,height:775,deviceScaleFactor:1});
     await page.goto(url+(situation==="fail-draw"?"?lateCanvasFault=1":""),{waitUntil:"networkidle0",timeout:18000});
     await page.waitForFunction(()=>window.__redLionFallbackReview?.ready,{timeout:15000});
     const data=await page.evaluate(()=>window.__redLionFallbackReview);
     assert.deepEqual(pageErrors,[]);
     if(situation==="normal"){
      assert.equal(data.recoveredLateDrawError,false);
      assert.equal(data.artReady,true);
      assert.equal(data.replacementApplied,true);
      assert.deepEqual(data.replacedBuildingIds,["red-lion"]);
      assert.ok(data.originalFacadePixelsDifferentFromPlaceholder>10000);
      assert.deepEqual(httpErrors,[]);
     }else if(situation==="fail-draw"){
      assert.equal(data.artReady,true);
      assert.equal(data.actualBrowserImageDecode,true);
      assert.equal(data.injectedCanvasFailure,true);
      assert.equal(data.recoveredLateDrawError,true);
      assert.equal(data.fallbackDefaultPlaceholder,true);
      assert.equal(data.replacementApplied,false);
      assert.equal(data.fallbackPixelsIdenticalToOriginal,true);
      assert.equal(data.originalFacadePixelsDifferentFromPlaceholder,0);
      assert.deepEqual(data.replacedBuildingIds,[]);
      assert.deepEqual(httpErrors,[]);
     }else{
      assert.equal(data.recoveredLateDrawError,false);
      assert.equal(data.artReady,false);
      assert.equal(data.fallbackDefaultPlaceholder,true);
      assert.equal(data.fallbackPixelsIdenticalToOriginal,true);
      assert.equal(data.originalFacadePixelsDifferentFromPlaceholder,0);
      assert.deepEqual(data.replacedBuildingIds,[]);
      assert.equal(httpErrors.filter(x=>x.status===503).length,1);
     }
     assert.equal(data.gameRendererIntegrated,false);
     const screenshot="red_lion_art_gating_"+engine+"_"+situation+".png";
     await page.screenshot({path:join(out,screenshot),fullPage:true});
     trials.push({engine,version:await browser.version(),situation,data,httpErrors,pageErrors,screenshot,
      simulatedFailure:situation!=="normal"});
    }finally{await page.close();}
   }
  }finally{await browser?.close();}
 }
 await writeFile(join(out,"original_red_lion_art_ready_or_placeholder.json"),
  JSON.stringify({heads,sourceHashes,trials,liveGame:false,
   serverItems:false,actualLowEndTest:false,productionApproved:false},null,2)+"\n");
 console.log("REDLION_FALLBACK="+JSON.stringify(trials.map(t=>({
  engine:t.engine,mode:t.situation,pixels:t.data.originalFacadePixelsDifferentFromPlaceholder,
  replacement:t.data.replacedBuildingIds,errors:t.pageErrors.length,http:t.httpErrors.length
 }))));
}finally{await new Promise(ok=>server.close(ok));}
