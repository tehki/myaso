// Graphics 3B P0: FIRST-PARTY native Chrome/Firefox evidence of REAL original
// A2.32 Blender Red Lion ironwork with pinned World9 #521 + Graphics3C P37.
// QA-only loopback routes, no edits to live game, server, World, or item state.
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join,extname} from "node:path";
import {createHash} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";

const root=process.cwd(), out=resolve(process.argv[2]??"alpha-p0-a232-native-world3c-evidence");
const heads=Object.freeze({
  world:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
  threeC:"efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac",
  threeB:"39e9ab8d23109727906cb18b4cc7cac86e425aa7",
  threeBBefore:"75bb57abf210cb3c1c7c925067edd8a0fcda4c79"
});
const pins=Object.freeze({
 world:join(root,"pin/world"),threeC:join(root,"pin/threec"),threeB:join(root,"pin/threeb"),threeBBefore:join(root,"pin/threeb-before")
});
for(const key of Object.keys(pins))
 assert.equal(execFileSync("git",["-C",pins[key],"rev-parse","HEAD"],{encoding:"utf8"}).trim(),
              heads[key],key+" original source checkout must match EXACT pinned HEAD");
const sha=async path=>createHash("sha256").update(await readFile(path)).digest("hex");
const tree="assets/environment/greyhaven/";
const revisions=Object.freeze({
 "red_lion_a232_day_ironwork.webp":"bdd2dcb2cb480f3631cbfe8cd4fa63ffee63699d8f17f33a520f8a3dcfd085fa",
 "red_lion_a232_dusk_ironwork.webp":"af2877c68dc88bd10baa90d1e32e6171fe9bc0e2ea537ebca1f2a9c767d2a54a",
 "red_lion_a232_roof_unchanged.webp":"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1",
 "red_lion_a231_day_dimensional.webp":"f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0",
 "red_lion_a231_dusk_dimensional.webp":"4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3",
 "red_lion_a231_roof_unchanged.webp":"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1"
});
const sourcePaths={};
for(const [file,expected] of Object.entries(revisions)){
 const dir=file.includes("a232")?"a232-review":"a231-review";
 const absolute=join(pins.threeB,tree,dir,file);
 assert.equal(await sha(absolute),expected,"first-party original WebP mismatch: "+file);
 sourcePaths[file]=absolute;
}
const previousA232SourceHashes=Object.freeze({
 "red_lion_a232_day_ironwork.webp":"6ffc32f5f68024a02692140df9ac42af71ddbd051a9201cf3d0a9ff0ab1c6ad7",
 "red_lion_a232_dusk_ironwork.webp":"97335e668a5b6c9e6d87570df5abdb99b66bda6f0278e40821ac811405289fbd",
 "red_lion_a232_roof_unchanged.webp":"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1"
});
const beforePaths={};
for(const [file,expected] of Object.entries(previousA232SourceHashes)){
 const absolute=join(pins.threeBBefore,tree,"a232-review",file);
 assert.equal(await sha(absolute),expected,"original prior Blender A2.32 source asset was not unchanged: "+file);
 beforePaths[file]=absolute;
}
const physicalProof=JSON.parse(await readFile(join(pins.threeB,tree,
 "a232-review/red_lion_a232_hinge_attachment_blender_report.json"),"utf8"));
assert.equal(physicalProof.blenderScene,"red_lion_a232_wrought_ironwork.blend");
assert.equal(physicalProof.hingePiecesRepositioned,10);
assert.equal(physicalProof.originalDoorRoofGeometryEdited,false);
assert.equal(await sha(join(pins.threeB,tree,"a232-review",physicalProof.blenderScene)),
 physicalProof.sourceBlendSha256);
const zCenter=box=>(box[2][0]+box[2][1])/2;
assert.ok(Math.abs(zCenter(physicalProof.corrected.lower.strap)-.96)<.001);
assert.ok(Math.abs(zCenter(physicalProof.corrected.upper.strap)-1.88)<.001);
for(const label of ["lower","upper"]){
 const {strap,barrel,peens}=physicalProof.corrected[label],door=physicalProof.door.worldBounds;
 const overlap=(a,b,axis)=>Math.min(a[axis][1],b[axis][1])-Math.max(a[axis][0],b[axis][0]);
 assert.ok(overlap(strap,door,1)>.005 && overlap(barrel,door,1)>.005);
 assert.ok(overlap(strap,barrel,1)>.005 && overlap(strap,barrel,0)>.002);
 assert.equal(peens.length,3);
 for(const peen of peens){
  assert.ok(overlap(peen,strap,1)>.005 && overlap(peen,strap,0)>.005);
  assert.ok(Math.abs(zCenter(peen)-zCenter(strap))<.001);
 }
}
const artReport=JSON.parse(await readFile(join(pins.threeB,tree,"a232-review/red_lion_a232_art_report.json"),"utf8"));
assert.equal(artReport.addedMeshes??artReport.source?.addedMeshes??artReport.newOriginalIronMeshes,20);
assert.equal(artReport.changedAlphaPixels,0);
assert.equal(artReport.roofByteIdentical,true);
assert.equal(artReport.liveGameIntegrated??artReport.gameRenderIntegrated,false);
const routes=Object.fromEntries([
 ["/__world521__/src/world/building-presentation.mjs",join(pins.world,"src/world/building-presentation.mjs")],
 ["/__world521__/src/world/authored-maps.mjs",join(pins.world,"src/world/authored-maps.mjs")],
 ...["authored-world-renderer.mjs","greyhaven-atmosphere.mjs","greyhaven-terrain-materials.mjs"]
  .map(x=>["/__3cp37__/src/browser/"+x,join(pins.threeC,"src/browser",x)]),
 ["/__3cp37__/src/world/authored-maps.mjs",join(pins.threeC,"src/world/authored-maps.mjs")],
 ...Object.entries(beforePaths).map(([file,absolute])=>
  ["/__3ba232_before__/"+tree+"a232-review/"+file,absolute]),
 ...Object.entries(sourcePaths).map(([file,absolute])=>
  ["/__3ba232__/"+tree+(file.includes("a232")?"a232-review/":"a231-review/")+file,absolute]),
 ["/web/armory-p0-a232-original-ironwork-review.html",join(root,"web/armory-p0-a232-original-ironwork-review.html")],
 ["/web/armory-p0-a232-original-ironwork-review.mjs",join(root,"web/armory-p0-a232-original-ironwork-review.mjs")],
 ["/src/browser/red-lion-original-art-readiness.mjs",join(root,"src/browser/red-lion-original-art-readiness.mjs")],
 ["/src/browser/red-lion-atomic-frame-qa.mjs",join(root,"src/browser/red-lion-atomic-frame-qa.mjs")],
 ["/src/browser/arena-viewport.mjs",join(root,"src/browser/arena-viewport.mjs")]
]);
const drivers=[],fault={mode:"normal"};
let server;
function okPng(s){
 const b=Buffer.from(s,"base64");
 assert.ok(b.length>10000,"actual W3C screenshot absent");
 assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 return b;
}
async function webdriver(b,method,path,body,ms=20000){
 const resp=await fetch(b.base+path,{method,body:body===undefined?undefined:JSON.stringify(body),
  headers:body===undefined?undefined:{"content-type":"application/json"},
  signal:AbortSignal.timeout(ms)});
 const json=await resp.json();
 if(!resp.ok||json.value?.error)
  throw Error(b.name+" original native WebDriver "+path+": "+JSON.stringify(json).slice(0,600));
 return json.value??json;
}
async function execute(b,js){
 return webdriver(b,"POST","/session/"+b.id+"/execute/sync",{script:js,args:[]});
}
async function launch(name,port){
 const chrome=name==="chrome";
 const bin=chrome?(process.env.CHROMEWEBDRIVER?join(process.env.CHROMEWEBDRIVER,"chromedriver"):"chromedriver"):
   (process.env.GECKOWEBDRIVER?join(process.env.GECKOWEBDRIVER,"geckodriver"):"geckodriver");
 const args=chrome?["--port="+port]:["--host","127.0.0.1","--port",String(port)];
 const proc=spawn(bin,args,{stdio:["ignore","ignore","pipe"]});
 drivers.push(proc);
 let stderr="";
 proc.stderr.on("data",d=>{stderr=(stderr+String(d)).slice(-1800)});
 proc.on("error",err=>{stderr=(stderr+String(err)).slice(-1800)});
 const b={name,base:"http://127.0.0.1:"+port};
 let active=false;
 for(let i=0;i<90;i++){
  if(proc.exitCode!==null)throw Error(name+" driver exited: "+stderr);
  try{
   const r=await fetch(b.base+"/status",{signal:AbortSignal.timeout(500)});
   if(r.ok){active=true;break}
  }catch{}
  await sleep(160);
 }
 if(!active)throw Error(name+" genuine driver missing: "+stderr);
 const caps=chrome?{browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1400,960"
 ]}}:{browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
 const session=await webdriver(b,"POST","/session",{capabilities:{alwaysMatch:caps}},60000);
 assert.ok(session.sessionId);
 b.id=session.sessionId;
 b.version=session.capabilities?.browserVersion??"native W3C";
 return b;
}
const checks=[
 {mode:"normal"},{mode:"fail-day"},{mode:"fail-roof"},{mode:"fail-draw"}
];
async function browserChecks(b,page){
 const trials=[];
 for(const check of checks){
  fault.mode=check.mode;
  const target=page+(check.mode==="fail-draw"?"?lateCanvasFault=1":"");
  await webdriver(b,"POST","/session/"+b.id+"/url",{url:target},30000);
  let data;
  for(let i=0;i<100;i++){
   data=await execute(b,"return window.__redLionFallbackReview||null");
   if(data?.ready)break;
   const status=await execute(b,"return document.querySelector('#status')?.textContent||''");
   if(status.startsWith("Source contract error:"))throw Error(b.name+" "+check.mode+": "+status);
   await sleep(110);
  }
  assert.ok(data?.ready,b.name+" "+check.mode+" original screenshot source timed out");
  assert.equal(data.originalArtRevision,"A2.32");
  assert.equal(data.gameRendererIntegrated,false);
  assert.equal(data.originalAssetsMutated,false);
  assert.equal(data.releaseApproved,false);
  assert.equal(data.stagingScratchOnly,true);
  assert.equal(data.originalFacadePixelsDifferentFromPlaceholder>10000,check.mode==="normal",
    "normal must show original detailed facade, deliberate failures original unchanged placeholder");
  if(check.mode==="normal"){
   assert.equal(data.artReady,true);
   assert.equal(data.actualBrowserImageDecode,true);
   assert.equal(data.replacementApplied,true);
   assert.deepEqual(data.replacedBuildingIds,["red-lion"]);
   assert.equal(data.fallbackDefaultPlaceholder,false);
   assert.equal(data.priorSourceArtReady,true);
   assert.equal(data.priorHingeArtReady,true);
   assert.ok(data.priorHingeDifferencePixels?.changedRgb>25,"real prior mounted lower hinge must visibly differ from raised hinge");
   assert.equal(data.priorHingeDifferencePixels.changedAlpha,0,"source lower hinge raise cannot change game art alpha");
   assert.ok(data.priorSourceDifferencePixels.changedRgb>100,"forged door+shutter fittings must alter real World+3C RGB");
   assert.equal(data.priorSourceDifferencePixels.changedAlpha,0);
  }else{
   assert.equal(data.replacementApplied,false);
   assert.equal(data.fallbackDefaultPlaceholder,true);
   assert.equal(data.originalFacadePixelsDifferentFromPlaceholder,0);
   assert.deepEqual(data.replacedBuildingIds,[]);
   assert.equal(data.fallbackPixelsIdenticalToOriginal,true);
   assert.equal(data.priorSourceDifferencePixels,null);
   assert.equal(data.priorHingeDifferencePixels,null);
   if(check.mode==="fail-draw"){
    assert.equal(data.recoveredLateDrawError,true);
    assert.equal(data.artReady,true);
    assert.equal(data.actualBrowserImageDecode,true);
   }else{
    assert.equal(data.artReady,false);
    assert.equal(data.recoveredLateDrawError,false);
   }
  }
  const el=await webdriver(b,"POST","/session/"+b.id+"/element",{using:"css selector",value:"#gated"});
  const id=el["element-6066-11e4-a52e-4f735466cecf"];
  assert.ok(id,"real A2.32 source destination Canvas element missing");
  const shot=okPng(await webdriver(b,"GET","/session/"+b.id+"/element/"+id+"/screenshot"));
  const filename="a232-real-"+b.name+"-"+check.mode+"-original-world3c-canvas.png";
  await writeFile(join(out,filename),shot);
  trials.push({browser:b.name,version:b.version,mode:check.mode,
   screenshot:filename,screenshotSha256:createHash("sha256").update(shot).digest("hex"),
   injectedFailure:check.mode!=="normal",data});
  console.log("GRAPHICS3B_A232_REAL_ORIGINAL_BROWSER_PASS "+JSON.stringify({
   browser:b.name,mode:check.mode,originalFacade:data.replacementApplied,
   sourcePixelDifference:data.priorSourceDifferencePixels,
   originalWorldFallback:data.fallbackDefaultPlaceholder,
   placeholderChangedPixels:data.originalFacadePixelsDifferentFromPlaceholder}));
 }
 return trials;
}
let error;
try{
 await mkdir(out,{recursive:true});
 server=createServer(async(req,res)=>{
  const name=new URL(req.url,"http://localhost").pathname,route=routes[name];
  if(!route){res.writeHead(404);res.end();return}
  if((fault.mode==="fail-day"&&name.endsWith("red_lion_a232_day_ironwork.webp"))||
     (fault.mode==="fail-roof"&&name.endsWith("red_lion_a232_roof_unchanged.webp"))){
   res.writeHead(503,{"cache-control":"no-store"});res.end("deliberate QA-only 503");return;
  }
  try{
   const contents=await readFile(route);
   res.writeHead(200,{"cache-control":"no-store",
    "content-type":extname(route)===".mjs"?"text/javascript; charset=utf-8":
     extname(route)===".webp"?"image/webp":"text/html; charset=utf-8"});
   res.end(contents);
  }catch{res.writeHead(500);res.end();}
 });
 await new Promise((yes,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",yes)});
 const page="http://127.0.0.1:"+server.address().port+"/web/armory-p0-a232-original-ironwork-review.html";
 const trials=[];
 for(const [name,port] of [["chrome",9897],["firefox",9898]]){
  const b=await launch(name,port);
  try{trials.push(...await browserChecks(b,page))}
  finally{if(b.id)await webdriver(b,"DELETE","/session/"+b.id).catch(()=>{})}
 }
 assert.equal(trials.length,8,"4 genuine original cases in both browsers");
 const report={heads,artReportSourceHash:await sha(join(pins.threeB,tree,"a232-review/red_lion_a232_art_report.json")),
  sourceHashes:revisions,sourceBeforeHingeRaiseHashes:previousA232SourceHashes,
  originalBlenderGeometryEvidence:physicalProof,actualOriginalWebP:true,genuineChromeFirefox:true,
  originalWorldAnd3c:true,realFourPlayerMultiplayer:false,liveGameIntegration:false,
  noItemAuthorityOrProductionChange:true,fullGpuTransactionalPresentNotClaimed:true,
  actualBrowserRenderedFourModes:true,requiredReviewOwner:"Graphics3B / Graphics3C / World9",trials};
 await writeFile(join(out,"a232-real-world3c-browser-art-qa.json"),JSON.stringify(report,null,2)+"\n");
 console.log("GRAPHICS3B_A232_SOURCE_PINNED_NATIVE_PASS "+
  JSON.stringify({cases:trials.length,normal:trials.filter(t=>t.mode==="normal")
   .map(t=>({browser:t.browser,diffRgb:t.data.priorSourceDifferencePixels.changedRgb,
    raisedLowerHingeDiffRgb:t.data.priorHingeDifferencePixels.changedRgb})),
   fallbackCases:trials.filter(t=>t.mode!=="normal").length,heads}));
}catch(e){error=e;console.error("GRAPHICS3B_A232_SOURCE_PINNED_NATIVE_FAIL "+String(e.stack||e))}
finally{
 for(const proc of drivers)if(proc.exitCode===null)proc.kill("SIGTERM");
 if(server){server.closeAllConnections?.();await new Promise(done=>server.close(done))}
}
if(error)process.exitCode=1;
