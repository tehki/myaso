// Graphics 3C P0 P40: phase-level first-tile paint profiling in real browsers.
// Real World #521 + 3B #481 source images + 3C painter. OFFLINE only.
// Do not conflate Canvas self-time with full game FPS or GPU present.
// Original World/3B source imported by exact Git HEAD and source asset SHA.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join,extname} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const [worldArg,artArg,outArg="assets/environment/greyhaven/3c-p40-cold-tile-phases-review"]=process.argv.slice(2);
assert.ok(worldArg&&artArg,"Pass exact World #521 and Graphics 3B #481 worktrees");
const world=resolve(worldArg),art=resolve(artArg),out=resolve(outArg);
const gfx=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const pins={world:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
 art:"c107f613c2f646e99693bc0af0f76ba4795c5364"};
const head=dir=>execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(head(world),pins.world);
assert.equal(head(art),pins.art);
const graphicsHead=head(gfx);
if(process.env.GRAPHICS_3C_EXPECTED_HEAD)assert.equal(graphicsHead,process.env.GRAPHICS_3C_EXPECTED_HEAD);
const assets={
 day:{name:"red_lion_a231_day_dimensional.webp",expected:"f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0",width:228,height:297},
 dusk:{name:"red_lion_a231_dusk_dimensional.webp",expected:"4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3",width:228,height:297},
 roof:{name:"red_lion_a231_roof_unchanged.webp",expected:"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1",width:238,height:197},
};
const files={
 "/src/browser/authored-world-renderer.mjs":join(gfx,"src/browser/authored-world-renderer.mjs"),
 "/src/browser/greyhaven-terrain-materials.mjs":join(gfx,"src/browser/greyhaven-terrain-materials.mjs"),
 "/src/browser/greyhaven-atmosphere.mjs":join(gfx,"src/browser/greyhaven-atmosphere.mjs"),
 "/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/src/world/building-presentation.mjs":join(world,"src/world/building-presentation.mjs"),
 "/src/browser/red-lion-alpha-art-attachment.mjs":join(art,"src/browser/red-lion-alpha-art-attachment.mjs"),
 "/src/browser/arena-viewport.mjs":join(art,"src/browser/arena-viewport.mjs")
};
for(const info of Object.values(assets))
 files["/assets/environment/greyhaven/a231-review/"+info.name]=join(art,"assets/environment/greyhaven/a231-review",info.name);
const sha=async p=>createHash("sha256").update(await readFile(p)).digest("hex");
for(const v of Object.values(assets)){
 assert.equal(await sha(files["/assets/environment/greyhaven/a231-review/"+v.name]),v.expected,"Original 3B WebP asset drift");
}
const worldMapHash=await sha(files["/src/world/authored-maps.mjs"]);
assert.equal(await sha(join(gfx,"src/world/authored-maps.mjs")),worldMapHash,"World authored map drift");
const sourceHashes={};
for(const [route,file] of Object.entries(files))sourceHashes[route]=await sha(file);
// P40 uses an IN-MEMORY JavaScript instrumentation transformation of exact
// source. The checked-in/shipping authored painter itself is never changed.
// Each source marker is asserted to occur exactly once to fail on drift.
const sourceRenderer=await readFile(files["/src/browser/authored-world-renderer.mjs"],"utf8");
const patches=[
 ['function paintOverworld(ctx,map,tileBounds,replacedBuildings) {',
  'function paintOverworld(ctx,map,tileBounds,replacedBuildings) {\n'+
  '  let __lastPaint=performance.now();\n'+
  '  const __markPaint=(name)=>{const now=performance.now();\n'+
  '    (globalThis.__graphics3cTilePhaseSamples ||= []).push({name,ms:now-__lastPaint});__lastPaint=now;};'],
 ['  // Authored agricultural plots, not generated terrain.','  __markPaint("background");\n  // Authored agricultural plots, not generated terrain.'],
 ['  // Skip long river strokes when the water cannot touch this 512-unit tile.','  __markPaint("fields");\n  // Skip long river strokes when the water cannot touch this 512-unit tile.'],
 ['  // Road layout is explicit: no per-session random placement.','  __markPaint("river");\n  // Road layout is explicit: no per-session random placement.'],
 ['  // Static, bounded Graphics 3C material layer on the same cached Canvas tiles.','  __markPaint("roads");\n  // Static, bounded Graphics 3C material layer on the same cached Canvas tiles.'],
 ['  // Warm practical spill is baked into the SAME cached terrain tile.','  __markPaint("3c-ground");\n  // Warm practical spill is baked into the SAME cached terrain tile.'],
 ['  for(const bridge of map.bridges){','  __markPaint("3c-light-pools");\n  for(const bridge of map.bridges){'],
 ['  for(const grove of map.groves)','  __markPaint("bridges");\n  for(const grove of map.groves)'],
 ['  if(visibleBounds(tileBounds,map.city.x,map.city.y,map.city.w,map.city.h,100))','  __markPaint("groves");\n  if(visibleBounds(tileBounds,map.city.x,map.city.y,map.city.w,map.city.h,100))'],
 ['  // Only World-validated opt-in IDs may suppress a baked placeholder.','  __markPaint("city-walls");\n  // Only World-validated opt-in IDs may suppress a baked placeholder.'],
 ['  paintGreyhavenLightingFixtures(ctx,map,tileBounds);','  __markPaint("buildings");\n  paintGreyhavenLightingFixtures(ctx,map,tileBounds);'],
 ['  for(const p of map.portals){','  __markPaint("3c-fixtures");\n  for(const p of map.portals){'],
 ['  ctx.textAlign="center";ctx.fillStyle="#f4e4b9";ctx.font="bold 23px Georgia,serif";','  __markPaint("portals");\n  ctx.textAlign="center";ctx.fillStyle="#f4e4b9";ctx.font="bold 23px Georgia,serif";'],
 ['  ctx.fillText("STONEBROOK",6490,3720);','  ctx.fillText("STONEBROOK",6490,3720);\n  __markPaint("world-labels");'],
 ['  function makeTile(map,x,y){',
  '  function makeTile(map,x,y){\n'+
  '    const __createStart=performance.now();'],
 ['    return texture;',
  '    (globalThis.__graphics3cTilePhaseSamples ||= []).push({name:"whole-tile-create",ms:performance.now()-__createStart});\n'+
  '    return texture;'],
 ['        if(texture)ctx.drawImage(texture,sx,sy);',
  '        if(texture){const __blitStart=performance.now();\n'+
  '          ctx.drawImage(texture,sx,sy);\n'+
  '          (globalThis.__graphics3cTilePhaseSamples ||= []).push({name:"screen-drawImage",ms:performance.now()-__blitStart});\n'+
  '        }']
];
let profiledRenderer=sourceRenderer;
for(const [find,replace] of patches){
 assert.equal(profiledRenderer.split(find).length,2,"Unexpected painter source marker: "+find);
 profiledRenderer=profiledRenderer.replace(find,replace);
}
assert.notEqual(profiledRenderer,sourceRenderer);
const html='<!doctype html><meta charset="utf-8"><title>Original World 521 + 3B 481 + 3C ART-ONLY</title>'+
 '<style>body{background:#191d19;color:#faf5e8;font:12px Arial;margin:10px}#panels{display:grid;grid-template-columns:640px 640px;gap:6px}figure{margin:0}figcaption{padding:6px}canvas{width:640px;height:480px}</style><main id="panels"></main>';
const server=createServer(async(req,res)=>{
 try{
  if(req.method!=="GET"){res.writeHead(405);res.end();return;}
  const requestUrl=new URL(req.url,"http://127.0.0.1");
  const route=requestUrl.pathname;
  if(route==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);return;}
  if(route==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const file=files[route];
  if(!file){res.writeHead(404);res.end("disallowed source path");return;}
  const data=route==="/src/browser/authored-world-renderer.mjs" &&
    requestUrl.searchParams.get("profile")==="1"
    ?Buffer.from(profiledRenderer):await readFile(file);
  res.writeHead(200,{"Content-Type":extname(file)===".mjs"?"text/javascript; charset=utf-8":extname(file)===".webp"?"image/webp":"application/octet-stream",
   "Cache-Control":"no-store"});res.end(data);
 }catch(e){res.writeHead(500);res.end("QA source unavailable")}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
await mkdir(out,{recursive:true});
const report={purpose:"Graphics 3C P40 original three-source cold-tile per-stage source profiling",
 sourceInstrumentation:{onlyInMemory:true,
   pristineRendererSha:sourceHashes["/src/browser/authored-world-renderer.mjs"],
   instrumentedRendererSha:createHash("sha256").update(profiledRenderer).digest("hex")},
 pins:{...pins,graphics3cAtCapture:graphicsHead},sourceHashes,
 runs:[],limitations:{originalGameRunning:false,networkPlayers:0,realDoorPortal:false,
  rendererFallbackWiredInOnlineGame:false,actorOcclusionAccepted:false,realFacadeAuthoringChanged:false}};
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const opts={headless:true,
    executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   assert.ok(opts.executablePath,"missing "+engine);
   if(engine==="chrome")opts.args=["--no-sandbox","--disable-gpu-sandbox"];
   else {opts.browser="firefox";opts.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(opts);
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:1312,height:1600,deviceScaleFactor:1});
   const response=await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
   assert.equal(response.status(),200);
   const stats=await page.evaluate(async()=>{
    const [{createAuthoredWorldRenderer:unprofiledWorld},{MAP_IDS,getAuthoredMap},
     {normalizeWorldBuildingReplacementIds},
     {RED_LION_ALPHA_ART,createRedLionAlphaArtAttachment}]=await Promise.all([
      import("/src/browser/authored-world-renderer.mjs"),
      import("/src/world/authored-maps.mjs"),
      import("/src/world/building-presentation.mjs"),
      import("/src/browser/red-lion-alpha-art-attachment.mjs")
     ]);
    const {createAuthoredWorldRenderer}=await import("/src/browser/authored-world-renderer.mjs?profile=1");
    const map=getAuthoredMap(MAP_IDS.overworld);
    const building=map.buildings.find(b=>b.id==="red-lion");
    if(!building||building.entrance?.x!==4365||building.entrance?.y!==4060)
      throw Error("Red Lion World geometry drift");
    const width=640,height=480,zoom=.84;
    const camera={x:4365,y:4035};
    const props={building,camera,width,height,zoom};
    // Exact artist attachment is a screen-space command; verify coordinates,
    // physical World door, and source policy without changing World geometry.
    const day=createRedLionAlphaArtAttachment({...props,mood:"day"});
    const dusk=createRedLionAlphaArtAttachment({...props,mood:"dusk"});
    if(day.visualDoor.y!==4075||day.authoredEntrance.y!==4060||
       day.threeCFixture.y!==4045||
       day.placeholderPolicy!=="world-must-suppress-one-red-lion-placeholder"||
       day.facade.width!==228||day.roof.width!==238)throw Error("3B original art contract drift");
    if(day.roof.sha256!==dusk.roof.sha256)throw Error("source roof no longer byte-identical");
    const images={};
    const names={
     day:"red_lion_a231_day_dimensional.webp",
     dusk:"red_lion_a231_dusk_dimensional.webp",
     roof:"red_lion_a231_roof_unchanged.webp",
    };
    // Await all original first-party assets BEFORE suppressing the World tile.
    await Promise.all(Object.entries(names).map(async([key,n])=>{
      const img=new Image();
      img.src="/assets/environment/greyhaven/a231-review/"+n;
      await img.decode();
      images[key]=img;
    }));
    for(const [name,cmd] of [["day",day.facade],["dusk",dusk.facade],["roof",day.roof]])
      if(images[name].naturalWidth!==cmd.width||images[name].naturalHeight!==cmd.height)
       throw Error("source asset pixels don't match artist placement");
    // Pixel proof against the *original uninstrumented 3C module*.
    // Identical real 640x480 initial scene, camera, zoom and tile build order.
    function originalPixelSample(ctor){
      const c=document.createElement("canvas");c.width=width;c.height=height;
      const ctx=c.getContext("2d",{willReadFrequently:true});
      const r=ctor({buildLimit:3,cacheCap:24,
        replacedBuildingIds:["red-lion"],
        worldReplacementValidator:normalizeWorldBuildingReplacementIds});
      for(let i=0;i<4;i++){
        ctx.save();ctx.translate(width/2,height/2);
        ctx.scale(zoom,zoom);ctx.translate(-width/2,-height/2);
        r.draw(ctx,MAP_IDS.overworld,camera,width,height,1);
        ctx.restore();
      }
      return ctx.getImageData(0,0,width,height).data;
    }
    const unmodifiedPixels=originalPixelSample(unprofiledWorld);
    const profiledPixels=originalPixelSample(createAuthoredWorldRenderer);
    let exactPixelsChanged=0;
    for(let i=0;i<unmodifiedPixels.length;i++){
      if(unmodifiedPixels[i]!==profiledPixels[i])exactPixelsChanged++;
    }
    if(exactPixelsChanged)throw Error("P40 in-memory painter instrumentation changed pixels: "+exactPixelsChanged);
    globalThis.__graphics3cTilePhaseSamples=[];
    const parent=document.querySelector("#panels");
    const cases=[];
    function panel(name,variant,mood){
      const fig=document.createElement("figure"),label=document.createElement("figcaption");
      label.textContent=name+" (ART ONLY)";fig.appendChild(label);
      const c=document.createElement("canvas");c.width=width;c.height=height;
      fig.appendChild(c);parent.appendChild(fig);
      const ctx=c.getContext("2d",{willReadFrequently:true});
      const replacement=variant==="facade";
      const renderer=createAuthoredWorldRenderer({
       buildLimit:3,cacheCap:24,
       ...(replacement?{replacedBuildingIds:["red-lion"],
        worldReplacementValidator:normalizeWorldBuildingReplacementIds}:{})
      });
      // Match World online gameplay canvas scale: authored world draw maps
      // canvas screen space with zoom; 3B art commands are already projected.
      function drawBase(){
        ctx.save();
        ctx.translate(width/2,height/2);
        ctx.scale(zoom,zoom);
        ctx.translate(-width/2,-height/2);
        renderer.draw(ctx,MAP_IDS.overworld,camera,width,height,1);
        ctx.restore();
      }
      for(let i=0;i<4;i++)drawBase(); // cover up to 12 fresh visible tiles
      if(replacement){
        const a=mood==="day"?day:dusk;
        ctx.drawImage(images[mood],a.facade.x,a.facade.y,a.facade.width,a.facade.height);
        ctx.drawImage(images.roof,a.roof.x,a.roof.y,a.roof.width,a.roof.height);
      }
      const rgba=ctx.getImageData(0,0,width,height).data;
      cases.push({name,variant,mood,rgba,createdLast:renderer.stats.created,
        tilesCached:renderer.stats.cached,identifiers:[...renderer.replacedBuildingIds]});
    }
    panel("Original World Red Lion placeholder","placeholder",null);
    panel("Original 3B day facade + unchanged roof","facade","day");
    panel("Original 3B dusk facade + unchanged roof","facade","dusk");
    // Asset missing => World fallback to original placeholder. No fake art
    // or geometry is installed and 3C cannot silently remove buildings.
    panel("Missing art -> default World placeholder fallback","fallback",null);
    const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)
      if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return n};
    const [normal,dayCase,duskCase,fallback]=cases;
    // OFFLINE synchronous Canvas self-time; not requestAnimationFrame, GPU
    // present, networking, actor count or total client frame time.
    const routes={
      "red-lion-local":i=>({x:4365+Math.sin(i/9)*85,y:4035+Math.sin(i/11)*60}),
      "red-lion-to-street":i=>({x:4050+i*8,y:4035+Math.sin(i/7)*28})
    };
    const modes=["placeholder","facade-day","facade-dusk"];
    const profile=[];
    globalThis.__graphics3cTilePhaseSamples=[];
    const sampleCount=72,trialCount=2;
    const percentile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))];
    for(let trial=0;trial<trialCount;trial++){
     for(const [routeName,cameraAt] of Object.entries(routes)){
      // Reverse ordering on second trial to reduce systematic cache/JIT bias.
      const ordered=trial===0?modes:[...modes].reverse();
      for(const mode of ordered){
       const replacement=mode!=="placeholder";
       const mood=mode==="facade-dusk"?"dusk":"day";
       const renderer=createAuthoredWorldRenderer({
        buildLimit:3,cacheCap:24,
        ...(replacement?{replacedBuildingIds:["red-lion"],
          worldReplacementValidator:normalizeWorldBuildingReplacementIds}:{})
       });
       const off=document.createElement("canvas");off.width=width;off.height=height;
       const cc=off.getContext("2d");
       const samples=[];
       for(let i=0;i<sampleCount;i++){
        const cam=cameraAt(i);
        const start=performance.now();
        cc.clearRect(0,0,width,height);
        cc.save();cc.translate(width/2,height/2);
        cc.scale(zoom,zoom);cc.translate(-width/2,-height/2);
        renderer.draw(cc,MAP_IDS.overworld,cam,width,height,1);cc.restore();
        if(replacement){
         const a=createRedLionAlphaArtAttachment({
          building,camera:cam,width,height,zoom,mood});
         cc.drawImage(images[mood],a.facade.x,a.facade.y,a.facade.width,a.facade.height);
         cc.drawImage(images.roof,a.roof.x,a.roof.y,a.roof.width,a.roof.height);
        }
        const ms=performance.now()-start;
        if(!Number.isFinite(ms)||renderer.stats.created>3||
           renderer.stats.cached>24)throw Error("renderer render budget/state violated");
        samples.push({
          frame:i,ms:Math.round(ms*1000)/1000,
          coldCreated:renderer.stats.created,cached:renderer.stats.cached
        });
       }
       const sort=samples.map(x=>x.ms).sort((a,b)=>a-b);
       const cold=samples.filter(x=>x.coldCreated>0),warm=samples.filter(x=>x.coldCreated===0);
       profile.push({route:routeName,mode,trial,
         draws:sampleCount,coldDraws:cold.length,warmDraws:warm.length,
         totalTilesCreated:samples.reduce((n,x)=>n+x.coldCreated,0),
         over16_7:samples.filter(x=>x.ms>16.7).length,
         p50Ms:percentile(sort,.5),p95Ms:percentile(sort,.95),
         p99Ms:percentile(sort,.99),maxMs:sort[sort.length-1],
         coldMaxMs:cold.length?Math.max(...cold.map(x=>x.ms)):0,
         warmP95Ms:warm.length?percentile(warm.map(x=>x.ms).sort((a,b)=>a-b),.95):null,
         samples});
      }
     }
    }
    // Phase buckets are measured inside in-memory-only instrumented original
    // paintOverworld; these measurements include call/array push overhead.
    const stageData=globalThis.__graphics3cTilePhaseSamples;
    if(stageData.length===0)throw Error("Instrumentation did not observe any cold tiles");
    const buckets=new Map();
    for(const item of stageData){
      const list=buckets.get(item.name)||[];
      list.push(item.ms);buckets.set(item.name,list);
    }
    const phaseSummary=[...buckets.entries()].map(([name,arr])=>{
      arr.sort((a,b)=>a-b);
      return {name,count:arr.length,
        totalMs:+arr.reduce((a,b)=>a+b,0).toFixed(3),
        medianMs:+arr[Math.floor((arr.length-1)/2)].toFixed(3),
        p95Ms:+arr[Math.min(arr.length-1,Math.ceil(arr.length*.95)-1)].toFixed(3),
        maxMs:+arr[arr.length-1].toFixed(3)};
    }).sort((a,b)=>b.totalMs-a.totalMs);
    // No source/gameplay mutation: fallback looks EXACTLY like original.
    const result={
      originalVsFallbackPixels:diff(normal.rgba,fallback.rgba),
      originalVsDayPixels:diff(normal.rgba,dayCase.rgba),
      dayVsDuskPixels:diff(dayCase.rgba,duskCase.rgba),
      originallyCachedTiles:normal.tilesCached,
      replacedCachedTiles:dayCase.tilesCached,
      defaultIds:normal.identifiers,
      replacedIds:dayCase.identifiers,
      fallbackIds:fallback.identifiers,
      actorCount:0,pickupRequests:0,
      instrumentation:{isSourceInMemory:true,fullRGBAParityChangedBytes:exactPixelsChanged,
        sourcePhaseMarkerCount:16,phaseSamples:stageData.length,
        phaseSummary},
      movingCameraProfile:{sampleCount,trialCount,modeCount:modes.length,
        routeCount:Object.keys(routes).length,profile},
      worldDoor:day.authoredEntrance,
      artistDoor:day.visualDoor,
      threeCLantern:day.threeCFixture,
      originalAssetNaturalSize:{
       facade:[images.day.naturalWidth,images.day.naturalHeight],
       roof:[images.roof.naturalWidth,images.roof.naturalHeight]
      }
    };
    // Only fixed camera source visuals. Not actual gameplay or performance.
    return result;
   });
   assert.equal(stats.originalVsFallbackPixels,0,"Art unready fallback MUST retain original city pixels");
   assert.ok(stats.originalVsDayPixels>3000,"Actual original art must visibly replace original World placeholder");
   assert.ok(stats.dayVsDuskPixels>300,"Original dusk material should visibly differ");
   assert.deepEqual(stats.defaultIds,[]);
   assert.deepEqual(stats.replacedIds,["red-lion"]);
   assert.deepEqual(stats.fallbackIds,[]);
   assert.ok(stats.originallyCachedTiles>=4&&stats.originallyCachedTiles<=24);
   assert.ok(stats.replacedCachedTiles>=4&&stats.replacedCachedTiles<=24);
   assert.deepEqual(errors,[]);
   const screenshot="red_lion_3c_world521_3b481_"+engine+".png";
   await page.screenshot({path:join(out,screenshot),fullPage:true});
   report.runs.push({browser:engine,version:await browser.version(),...stats,
    screenshot,pageErrors:errors,realGameProven:false});
  }finally{await browser?.close()}
 }
 report.status="THREE_SOURCE_IN_MEMORY_TILE_PHASES_PROFILED";
 await writeFile(join(out,"world521_3b481_3c_cold_paint_phases.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({status:report.status,runs:report.runs.map(x=>({browser:x.browser,
  originalVsDayPixels:x.originalVsDayPixels,dayVsDuskPixels:x.dayVsDuskPixels,
  originalVsFallbackPixels:x.originalVsFallbackPixels,cache:x.replacedCachedTiles,
  draws:x.movingCameraProfile.profile.reduce((n,p)=>n+p.draws,0),
  coldDraws:x.movingCameraProfile.profile.reduce((n,p)=>n+p.coldDraws,0),
  over16_7:x.movingCameraProfile.profile.reduce((n,p)=>n+p.over16_7,0),
  maxMs:Math.max(...x.movingCameraProfile.profile.map(p=>p.maxMs)),
  phaseSamples:x.instrumentation.phaseSamples,
  topPhases:x.instrumentation.phaseSummary.slice(0,5)}))},null,2));
}finally{await new Promise(ok=>server.close(ok))}
