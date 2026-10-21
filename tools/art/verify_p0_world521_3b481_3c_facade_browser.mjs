// Graphics 3C P0 - actual original World #521 + 3B #481 facade + 3C terrain.
// Fixed offline Canvas and browser source proof ONLY; no real game/network.
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
const [worldArg,artArg,outArg="assets/environment/greyhaven/3c-p38-three-source-review"]=process.argv.slice(2);
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
const html='<!doctype html><meta charset="utf-8"><title>Original World 521 + 3B 481 + 3C ART-ONLY</title>'+
 '<style>body{background:#191d19;color:#faf5e8;font:12px Arial;margin:10px}#panels{display:grid;grid-template-columns:640px 640px;gap:6px}figure{margin:0}figcaption{padding:6px}canvas{width:640px;height:480px}</style><main id="panels"></main>';
const server=createServer(async(req,res)=>{
 try{
  if(req.method!=="GET"){res.writeHead(405);res.end();return;}
  const route=new URL(req.url,"http://127.0.0.1").pathname;
  if(route==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);return;}
  if(route==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const file=files[route];
  if(!file){res.writeHead(404);res.end("disallowed source path");return;}
  const data=await readFile(file);
  res.writeHead(200,{"Content-Type":extname(file)===".mjs"?"text/javascript; charset=utf-8":extname(file)===".webp"?"image/webp":"application/octet-stream",
   "Cache-Control":"no-store"});res.end(data);
 }catch(e){res.writeHead(500);res.end("QA source unavailable")}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
await mkdir(out,{recursive:true});
const report={purpose:"Graphics 3C fixed off-line P0 three-source Red Lion art attachment QA",
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
    const [{createAuthoredWorldRenderer},{MAP_IDS,getAuthoredMap},
     {normalizeWorldBuildingReplacementIds},
     {RED_LION_ALPHA_ART,createRedLionAlphaArtAttachment}]=await Promise.all([
      import("/src/browser/authored-world-renderer.mjs"),
      import("/src/world/authored-maps.mjs"),
      import("/src/world/building-presentation.mjs"),
      import("/src/browser/red-lion-alpha-art-attachment.mjs")
     ]);
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
    // No source source/gameplay mutation: fallback looks EXACTLY like original.
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
 report.status="THREE_ORIGINAL_SOURCES_FIXED_CANVAS_ART_PASS";
 await writeFile(join(out,"world521_3b481_3c_art_composite.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({status:report.status,runs:report.runs.map(x=>({browser:x.browser,
  originalVsDayPixels:x.originalVsDayPixels,dayVsDuskPixels:x.dayVsDuskPixels,
  originalVsFallbackPixels:x.originalVsFallbackPixels,cache:x.replacedCachedTiles}))},null,2));
}finally{await new Promise(ok=>server.close(ok))}
