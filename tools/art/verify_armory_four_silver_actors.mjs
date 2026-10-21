#!/usr/bin/env node
/* Visual-only original 3A Silver × 3B four Blender swords × consolidated
 * World #521, native Chrome/Firefox. NO live player or server item claim. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,relative,join,extname} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const world=resolve(process.argv[2]||""),knight=resolve(process.argv[3]||"");
assert.ok(process.argv[2]&&process.argv[3],"Need independently pinned original World521 and 3A326 directories");
const out=resolve(process.argv[4]||join(repo,".four-silver-original-review"));
const HEADS={world:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
  knight:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
  graphicsAncestor:"755b778cdc328b5ffc3a676824c03d6a1b75a2c9"};
for(const [n,p] of [["world",world],["knight",knight]])
 assert.equal(execFileSync("git",["-C",p,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),HEADS[n]);
execFileSync("git",["-C",repo,"merge-base","--is-ancestor",HEADS.graphicsAncestor,"HEAD"]);
const xref={
 "/__world521__/src/browser/authored-world-renderer.mjs":join(world,"src/browser/authored-world-renderer.mjs"),
 "/__world521__/src/world/alpha-armory.mjs":join(world,"src/world/alpha-armory.mjs"),
 "/__world521__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/__world521__/src/world/building-presentation.mjs":join(world,"src/world/building-presentation.mjs"),
 "/__knight326__/web/knight-sprites.mjs":join(knight,"web/knight-sprites.mjs"),
 "/__knight326__/src/browser/combat-readability.mjs":join(knight,"src/browser/combat-readability.mjs"),
 "/__knight326__/src/combat/model.mjs":join(knight,"src/combat/model.mjs"),
 "/__knight326__/web/assets/knights/silver_idle.webp":join(knight,"web/assets/knights/silver_idle.webp"),
};
const digest=async path=>createHash("sha256").update(await readFile(path)).digest("hex");
const hashes=Object.fromEntries(await Promise.all(Object.entries(xref).map(async([k,p])=>[k,await digest(p)])));
const expected={
 "/__knight326__/web/knight-sprites.mjs":"1a3489220df7fbfa614f986148915e1a89e26a3e215f204386a49b77fa53c4cd",
 "/__knight326__/src/browser/combat-readability.mjs":"8d868c947fdfe9dc73488819448909c85f1fcbd86c74024931527146cbf4390c",
 "/__knight326__/src/combat/model.mjs":"881e01d92a47665a08ba76521e7c615ef4b21de47b28335dcd88ade62d359d01",
 "/__knight326__/web/assets/knights/silver_idle.webp":"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4",
 "/__world521__/src/world/alpha-armory.mjs":"305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf",
 "/__world521__/src/world/authored-maps.mjs":"21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144",
 "/__world521__/src/browser/authored-world-renderer.mjs":"2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a",
 "/__world521__/src/world/building-presentation.mjs":"c2e2ad0350fbc5d0c8408a48a151c280b4cc85500c53f4b8e705b21e97147e33"
};
assert.deepEqual(hashes,expected);
const files=new Set([
 "web/armory-p0-four-silver-visual.html",
 "web/armory-p0-four-silver-visual.mjs",
 "src/browser/armory-world493-visual-bridge.mjs",
 "src/browser/armory-rack-visual.mjs",
 "src/browser/armory-sword-alpha-sampler.mjs",
 "src/browser/armory-rack-presented-frame.mjs",
 "src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp"
]);
const mime={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const route=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let path=xref[route];
  if(!path){path=resolve(repo,"."+route);
    if(!files.has(relative(repo,path).replaceAll("\\","/"))){res.writeHead(404);res.end("Not found");return;}
  }
  const bytes=await readFile(path);
  res.writeHead(200,{"Content-Type":mime[extname(path)]??"application/octet-stream",
    "Cache-Control":"no-store"});res.end(bytes);
 }catch(e){res.writeHead(500);res.end("Source fixture read failed");}
});
await mkdir(out,{recursive:true});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-four-silver-visual.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const results=[];
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const config={headless:true,executablePath:engine==="chrome"?
    process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(engine==="chrome")config.args=["--no-sandbox","--disable-gpu-sandbox"];
   else{config.browser="firefox";config.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(config);
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:1120,height:830,deviceScaleFactor:1});
   await page.goto(url,{waitUntil:"networkidle0"});
   try{await page.waitForFunction(()=>window.__p0FourSilverSourceReview?.()?.ready,{timeout:17000});}
   catch(e){console.log("FOUR_SILVER_DIAG="+JSON.stringify({engine,status:await page.$eval("#status",e=>e.textContent),errors}));throw e;}
   const data=await page.evaluate(()=>window.__p0FourSilverSourceReview());
   assert.equal(data.sourceKnightsCount,4);
   assert.equal(data.sourceSwordCount,4);
   assert.equal(data.originalSourceSilverAtlas,true);
   assert.equal(data.originalBlenderSwords,true);
   assert.equal(data.sourceKnightScale,1.2);
   assert.deepEqual(data.actualWorldApproaches,[[3740,4088],[3780,4088],[3820,4088],[3860,4088]]);
   assert.equal(data.silverPairIntersections.length,6);
   assert.equal(data.swordVisibility.length,4);
   assert.equal(data.serverPlayersAuthenticated,false);
   assert.equal(data.serverItemPresenceAuthenticated,false);
   assert.equal(data.realFourPlayerGameplay,false);
   assert.deepEqual(errors,[]);
   const screenshot="armory_four_original_silvers_"+engine+".png";
   await page.screenshot({path:join(out,screenshot),fullPage:true});
   results.push({engine,version:await browser.version(),errors,
    sourceOutput:data,screenshot,
    actualGameplayActors:false,actualGameplayPickup:false,
    playerToSwordHitPriorityApproved:false});
  }finally{await browser?.close();}
 }
 const record={purpose:"3B P0 source-only four actual original 3A Silver Knight sprites at original World521 four sword approaches",
  sourceHeads:HEADS,originalSourceHashes:hashes,browsers:results,
  realFourPlayersConnected:false,realGameInput:false,
  gameplayOcclusionResolved:false,productionApproved:false};
 await writeFile(join(out,"armory_four_original_silvers_source_report.json"),
  JSON.stringify(record,null,2)+"\n");
 console.log("FOUR_SILVER_SOURCE="+JSON.stringify(results.map(r=>({
  engine:r.engine,version:r.version,
  knightPairOverlaps:r.sourceOutput.silverPairIntersections,
  swords:r.sourceOutput.swordVisibility,
  errors:r.errors,screenshot:r.screenshot
 }))));
}finally{await new Promise(ok=>server.close(ok));}
