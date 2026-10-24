import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ORIGINAL_RED_LION_ART,ORIGINAL_RED_LION_WORLD_ANCHOR,
 createOriginalRedLionLiveArt,drawScreenLayerInZoomedGame,redLionActorHudVisible} from "../src/browser/red-lion-live-art.mjs";

const artRoot=new URL("../assets/environment/greyhaven/a232-review/",import.meta.url);
const src=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
function context(){
 const calls=[];
 const ctx={calls,save(){calls.push("save")},restore(){calls.push("restore")},
  translate(...v){calls.push(["translate",...v])},scale(...v){calls.push(["scale",...v])},
  drawImage(...v){calls.push(["drawImage",...v])},
  clearRect(...v){calls.push(["clearRect",...v])}};
 return ctx;
}
function canvas(){
 const ctx=context(),resets={width:0,height:0};
 let width=0,height=0;
 return {get width(){return width},set width(v){resets.width++;width=v},
  get height(){return height},set height(v){resets.height++;height=v},
  getContext:()=>ctx,ctx,resets};
}
function build({badHash=false,badDecode=false,badDraw=false,failAfter=false}={}){
 const seen=[],canvases=[];
 let makeWorldCalls=0;
 const value=createOriginalRedLionLiveArt({
  fetchBytes:async url=>{
   const name=new URL(url).pathname.split("/").pop();
   seen.push(name);
   const b=readFileSync(new URL(name,artRoot));
   if(badHash&&name==="red_lion_a232_day_ironwork.webp"){
    const corrupted=Buffer.from(b);corrupted[100]^=7;return corrupted.buffer.slice(corrupted.byteOffset,corrupted.byteOffset+corrupted.byteLength);
   }
   return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  },
  decode:async(_bytes,key)=>{
   if(badDecode&&key==="day")throw Error("deliberate original WebP decode failure");
   return {width:ORIGINAL_RED_LION_ART[key].width,height:ORIGINAL_RED_LION_ART[key].height};
  },
  makeCanvas:()=>{const c=canvas();canvases.push(c);return c},
  makeWorld:({replacedBuildingIds,worldReplacementValidator})=>{
   makeWorldCalls++;
   assert.deepEqual([...replacedBuildingIds],["red-lion"]);
   assert.deepEqual([...worldReplacementValidator("moonvale-overworld",["red-lion"])],["red-lion"]);
   return {replacedBuildingIds:["red-lion"],draw(ctx){
    ctx.calls.push("World-authorized red-lion tiled renderer");
    if(badDraw)throw Error("deliberate late graphics-only failure");
   }};
  }
 });
 return {value,seen,canvases,get makeWorldCalls(){return makeWorldCalls}};
}
test("first party A2.32 owner-corrected source WebPs have literal reviewed SHA-256",()=>{
 for(const m of Object.values(ORIGINAL_RED_LION_ART)){
  const b=readFileSync(new URL(m.name,artRoot));
  assert.equal(createHash("sha256").update(b).digest("hex"),m.sha256,m.name);
  assert.ok(b.length>10000);
 }
 assert.equal(ORIGINAL_RED_LION_WORLD_ANCHOR.x,4365);
 assert.equal(ORIGINAL_RED_LION_WORLD_ANCHOR.y,4075);
});
test("corrected original art fully hash+decode verified BEFORE World suppresses exactly one facade",async()=>{
 const h=build();assert.equal(h.value.state().phase,"idle");
 assert.equal(await h.value.load(),true);
 assert.equal(h.value.state().phase,"ready");
 assert.deepEqual(h.seen.sort(),Object.values(ORIGINAL_RED_LION_ART).map(x=>x.name).sort());
 assert.equal(h.makeWorldCalls,1);
 const frame=h.value.prepare({x:4365,y:4075},960,540,.84);
 assert.equal(frame.visualOnly,true);
 assert.equal(frame.world.width,960);
 assert.equal(frame.facade.height,540);
 assert.equal(h.canvases[0].ctx.calls.includes("World-authorized red-lion tiled renderer"),true);
 assert.equal(h.canvases[1].ctx.calls.filter(x=>Array.isArray(x)&&x[0]==="drawImage").length,2);
 assert.equal(await h.value.load(),true);
 assert.equal(h.makeWorldCalls,1);
});
test("World source owns depth and only local Red Lion footprint can be behind",async()=>{
 const h=build();await h.value.load();
 assert.equal(h.value.behindFacade({x:4365,y:4040}),true);
 assert.equal(h.value.behindFacade({x:4365,y:4075}),false);
 assert.equal(h.value.behindFacade({x:2000,y:3000}),false);
 assert.equal(h.value.behindFacade({x:99999,y:4000}),false);
 assert.equal(h.value.behindFacade({x:4365,y:NaN}),false);
});
test("Red Lion facade occludes remote HUD only when the image frame is ready",async()=>{
 const h=build();
 const behind={netId:2,x:4365,y:4040},front={netId:3,x:4365,y:4075};
 assert.equal(redLionActorHudVisible(null,null,behind),true);
 assert.equal(await h.value.load(),true);
 const frame=h.value.prepare({x:4365,y:4075},960,540,.84);
 assert.ok(frame);
 assert.equal(redLionActorHudVisible(h.value,frame,behind),false);
 assert.equal(redLionActorHudVisible(h.value,frame,front),true);
 assert.equal(redLionActorHudVisible(h.value,frame,{netId:4,x:5300,y:4040}),true);
 assert.deepEqual([behind,front].filter(x=>redLionActorHudVisible(h.value,frame,x)).map(x=>x.netId),[3]);
 assert.equal(redLionActorHudVisible(h.value,null,behind),true);
});
test("incorrect original WebP SHA causes fail-closed and NO canonical World replacement",async()=>{
 const h=build({badHash:true});
 assert.equal(await h.value.load(),false);
 assert.equal(h.value.state().phase,"failed");
 assert.equal(h.makeWorldCalls,0);
 assert.equal(h.value.prepare({x:4365,y:4075},960,540,.84),null);
});
test("source decoder failure causes original World fallback without a placeholder toggle",async()=>{
 const h=build({badDecode:true});
 assert.equal(await h.value.load(),false);
 assert.equal(h.makeWorldCalls,0);
 assert.equal(h.value.prepare({x:4365,y:4075},960,540,.84),null);
});
test("late World stage failure keeps original untouched full-frame renderer for subsequent client draw",async()=>{
 const h=build({badDraw:true});await h.value.load();
 assert.equal(h.value.prepare({x:4365,y:4075},960,540,.84),null);
 assert.equal(h.value.state().phase,"failed");
});
test("inverse on-screen compositor restores 2.5D Canvas transform even after draw",()=>{
 const c=context();
 drawScreenLayerInZoomedGame(c,{width:960,height:540},960,540,.84);
 assert.deepEqual(c.calls[0],"save");
 assert.deepEqual(c.calls.at(-1),"restore");
 assert.ok(c.calls.some(x=>Array.isArray(x)&&x[0]==="scale"&&Math.abs(x[1]-1/.84)<1e-8));
});
test("non-optin Combat runtime remains verbatim default, optin requires BOTH world=1 and redlion=1",()=>{
 assert.match(src,/const fixedWorldEnabled = params.get\("world"\) === "1" && !params.has\("scenario"\)/);
 assert.match(src,/fixedWorldEnabled && params.get\("redlion"\) === "1"/);
 assert.match(src,/if \(originalRedLionArt\) void originalRedLionArt.load\(\)/);
 assert.match(src,/else if \(authoredWorld && local.initialized\)/);
 const qa=readFileSync(new URL("../web/graphics3b-red-lion-live-art-smoke.mjs",import.meta.url),"utf8");
 assert.match(qa,/const defaultWorld=createAuthoredWorldRenderer\(\);/);
 assert.doesNotMatch(qa,/createAuthoredWorldRenderer\(\{buildLimit:8\}\)/);
 const nativeRunner=readFileSync(new URL("../tools/art/verify_a232_live_optin_native_browsers.mjs",import.meta.url),"utf8");
 assert.match(nativeRunner,/exactOriginalFallback:trials\.filter\(t=>t\.mode==="fail-day"\|\|t\.mode==="tamper-day"\)\.length/);
 assert.match(src,/redLionActorsInFront/);
 assert.match(src,/redLionActorHudVisible\(originalRedLionArt,redLionFrame,sampled\)/);
 assert.match(src,/if \(remoteVisibleAboveFacade\) visibleEnemyPositions\.push\(sampled\)/);
 assert.match(src,/if \(redLionFrame && remoteVisibleAboveFacade\)/);
 assert.match(src,/originalRedLionArt.behindFacade/);
 assert.doesNotMatch(src,/sendTryPickup\(|grantSword\(|teleport.*RedLion/i);
});

test("fixed-size original World/Blender offscreen stages reuse buffers and clear prior camera pixels",async()=>{
 const h=build();assert.equal(await h.value.load(),true);
 const first=h.value.prepare({x:4365,y:4075},960,540,.84);
 const second=h.value.prepare({x:4465,y:4115},960,540,.84);
 assert.ok(first&&second);
 assert.strictEqual(second.world,first.world);
 assert.strictEqual(second.facade,first.facade);
 for(const c of h.canvases){
  assert.equal(c.resets.width,1,"unchanged 960px width must not reset Canvas every RAF");
  assert.equal(c.resets.height,1,"unchanged 540px height must not reset Canvas every RAF");
  assert.deepEqual(c.ctx.calls.filter(a=>Array.isArray(a)&&a[0]==="clearRect"),
   [["clearRect",0,0,960,540],["clearRect",0,0,960,540]]);
 }
 const changed=h.value.prepare({x:4365,y:4075},1280,720,.84);
 assert.ok(changed);
 for(const c of h.canvases){
  assert.equal(c.resets.width,2,"genuine viewport width change must resize");
  assert.equal(c.resets.height,2,"genuine viewport height change must resize");
  assert.deepEqual(c.ctx.calls.filter(a=>Array.isArray(a)&&a[0]==="clearRect").at(-1),
   ["clearRect",0,0,1280,720]);
 }
 // Source immutable; this only optimizes visual Canvas staging.
 assert.equal(h.value.state().serverAuthorityChanged,false);
});
