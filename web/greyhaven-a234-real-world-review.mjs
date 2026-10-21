import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {createRedLionVisualDepthPlan} from "../src/browser/red-lion-visual-depth-review.mjs";
import {createAuthoredWorldRenderer,WORLD_CACHE_CAP,WORLD_TILE_SIZE} from "/src/browser/authored-world-renderer.mjs";
import {AUTHORED_MAPS,MAP_IDS} from "/src/world/authored-maps.mjs";
import {GREYHAVEN_LIGHTING_VERSION,createGreyhavenLightingPlan,paintGreyhavenLightingFixtures} from "/__a234_3c__/greyhaven-atmosphere.mjs";
const $=id=>document.getElementById(id);
const root="../assets/environment/greyhaven/";
async function load(path){const i=new Image();i.src=new URL(path,import.meta.url).href;await i.decode();return i;}
async function json(path){const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status+" "+path);return r.json();}
let state=null;window.__a234Review=()=>state;
try{
 const [art,prior]=await Promise.all([json(root+"a231-review/greyhaven_a231_lighting_handoff.json"),
  json(root+"a232-review/greyhaven_a232_threshold_actor_alpha_report.json")]);
 const world=AUTHORED_MAPS[MAP_IDS.overworld];
 const tavern=world.buildings.find(b=>b.id==="red-lion");
 if(!tavern||tavern.entrance.x!==4365||tavern.entrance.y!==4060||tavern.x!==4240||
    ARENA_VIEW_ZOOM!==.84||WORLD_TILE_SIZE!==512||WORLD_CACHE_CAP!==24||
    GREYHAVEN_LIGHTING_VERSION!=="3c-p24-1"||
    art.building.visualArtDoor[1]!==4075||prior.sourceFacadeAlphaHazard.count!==69)
  throw Error("World/3C/3B source contract mismatch");
 const [facade,roof,knight]=await Promise.all([
  load(root+"a231-review/"+art.material.dusk.file),
  load(root+"a231-review/"+art.material.roof.file),
  load("/__a234_knights__/silver_idle.webp")
 ]);
 if(facade.naturalWidth!==228||facade.naturalHeight!==297||
    roof.naturalWidth!==238||roof.naturalHeight!==197||
    knight.naturalWidth!==640||knight.naturalHeight!==1280)
  throw Error("Pinned art dimensions changed");
 // Exact, unmodified World #336 first-party renderer: source module and map.
 const originalWorld=createAuthoredWorldRenderer({buildLimit:3,cacheCap:24});
 const composedWorld=createAuthoredWorldRenderer({buildLimit:3,cacheCap:24});
 const overlayLight=document.createElement("canvas");
 overlayLight.width=overlayLight.height=512;
 const fix=overlayLight.getContext("2d");
 const tile={x:4096,y:3584,width:512,height:512};
 const fixturePlan=createGreyhavenLightingPlan({...world,buildings:[tavern]},tile).find(p=>p.id==="red-lion");
 if(!fixturePlan||fixturePlan.fixtureY!==4045||fixturePlan.poolY!==4069)
  throw Error("3C source fixture coordinates changed");
 fix.save();fix.translate(-tile.x,-tile.y);
 paintGreyhavenLightingFixtures(fix,{...world,buildings:[tavern]},tile);fix.restore();
 let frames=0,drawVersion=0;
 const metrics={worldWarmMs:[],compositeWarmMs:[]};
 let pending=false;
 function draw(){
  pending=false;
  const dy=Number($("actorY").value),roofa=Number($("roofAlpha").value)/100,
   cameraEast=Number($("cameraEast").value);
  const door={x:4365,y:4075};
  const cam={x:door.x+cameraEast,y:door.y};
  const actor={id:"knight",x:door.x-8,y:door.y+dy};
  const result=createRedLionVisualDepthPlan({actors:[actor]});
  const a=projectArenaPoint(actor.x,actor.y,cam.x,cam.y,640,640);
  const d=projectArenaPoint(door.x,door.y,cam.x,cam.y,640,640);
  const sx=projectArenaPoint(tile.x,tile.y,cam.x,cam.y,640,640);
  const frameRender={};
  for(const [name,renderer] of [["world",originalWorld],["composite",composedWorld]]){
   const began=performance.now(),ctx=$(name).getContext("2d",{alpha:false});
   ctx.fillStyle="#253a2f";ctx.fillRect(0,0,640,640);
   // This is exactly the world-camera transform in World #336 online-game.mjs.
   ctx.save();ctx.translate(320,320);ctx.scale(.84,.84);ctx.translate(-320,-320);
   renderer.draw(ctx,MAP_IDS.overworld,cam,640,640,.84);
   ctx.restore();
   const drawActor=()=>ctx.drawImage(knight,0,0,160,160,a.x-48,a.y-62.4,96,96);
   if(name==="composite"&&result.behindFacade.length)drawActor();
   if(name==="composite"){
    ctx.drawImage(facade,d.x-114,d.y-269);
    ctx.drawImage(overlayLight,sx.x,sx.y,512*.84,512*.84);
   }
   if(name==="world"||result.inFrontOfFacade.length)drawActor();
   if(name==="composite"){ctx.save();ctx.globalAlpha=roofa;
    ctx.drawImage(roof,d.x-119,d.y-283);ctx.restore();}
   frameRender[name]={ms:performance.now()-began,tilesCreated:renderer.stats.created,
    tilesVisible:renderer.stats.visible,tilesCached:renderer.stats.cached};
  }
  frames++;
  for(const name of ["world","composite"])if(frameRender[name].tilesCreated===0)
    metrics[name==="world"?"worldWarmMs":"compositeWarmMs"].push(frameRender[name].ms);
  const pointExpected=[320+(actor.x-cam.x)*.84,320+(actor.y-cam.y)*.84];
  state={ready:true,frames,dy,cameraEast,roofOpacity:roofa,
    actorWorldXY:[actor.x,actor.y],actorScreenXY:[a.x,a.y],
    actorXYErrorPx:Math.hypot(a.x-pointExpected[0],a.y-pointExpected[1]),
    visualDoor:[4365,4075],authoredWorldEntrance:[4365,4060],
    threeCFixtureWorldXY:[fixturePlan.x,fixturePlan.fixtureY],
    worldSourceHead:"260a7b85a33b7a51663a70af8d410e0d33e0e236",
    source3CHead:"8e85584b6007b38e1a00155b77473e92b0afec6a",
    realWorld336RendererUsed:true,world336OptInSourcePresent:true,
    placeholderTavernStillDrawnByWorld336:true,
    rawWorldBuildingDepthSortingPresent:false,
    proposedBehindIds:result.behindFacade.map(x=>x.id),
    proposedFrontIds:result.inFrontOfFacade.map(x=>x.id),
    sourceRendererStats:frameRender,warmSamples:metrics,
    actualOnlineGameExecuted:false,liveServerAttached:false,
    portalOrCollisionModified:false,productionApproved:false};
  drawVersion++;
  $("actorValue").textContent=String(dy);
  $("roofValue").textContent=Math.round(roofa*100)+"%";
  $("cameraValue").textContent=String(cameraEast);
  $("status").textContent="Real World #336 renderer | 512-unit tiles and 3-build/frame cap | actor source at "+a.x.toFixed(1)+","+a.y.toFixed(1)+
     " | screenshot-only proposed facade overlay, double-paint still unresolved.";
  $("status").dataset.state="ready";
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(draw);}}
 for(const id of ["actorY","roofAlpha","cameraEast"])$(id).addEventListener("input",schedule);
 window.__a234RenderNext=()=>new Promise(resolve=>{requestAnimationFrame(()=>{draw();resolve(state);});});
 requestAnimationFrame(draw);
}catch(err){$("status").dataset.state="error";$("status").textContent="Review BLOCKED: "+err.message;console.error(err);}
