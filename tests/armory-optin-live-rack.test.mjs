import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {isOriginalArmoryPreviewEnabled,
 loadOriginalBlacksmithRackPreview,OPTIN_ARMORY_VISUAL_CONTRACT}
 from "../src/browser/armory-optin-live-rack.mjs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
const urls=[
 "http://127.0.0.1:1234/game?world=1&armoryart=1",
 "http://localhost:1234/game?armoryart=1&world=1",
 "http://[::1]:1234/game?world=1&armoryart=1",
];
const samples=(path)=>{
 const rack=path===ARMORY_RACK_ART.rackSource;
 return{complete:true,naturalWidth:rack?240:42,naturalHeight:rack?166:115,
  currentSrc:"http://localhost:4321"+path};
};
const factory=()=>({
  width:0,height:0,
  getContext:()=>({
   drawImage(){},
   getImageData(){const rgba=new Uint8ClampedArray(42*115*4);
    for(let y=0;y<115;y++)for(let x=0;x<42;x++){
     if(x>=10&&x<=30&&y>=8&&y<=92)rgba[(y*42+x)*4+3]=255;
    }
    return{data:rgba};
   }
  })
});
const context=()=>{
 const calls=[];
 return{calls,save:()=>calls.push("save"),
  restore:()=>calls.push("restore"),
  drawImage:(...args)=>calls.push(args)
 };
};

test("P0 immutable original source art bytes and authored four-rack sockets unchanged",()=>{
 const read=path=>readFileSync(new URL("../"+path,import.meta.url));
 const hashes={
  "assets/environment/greyhaven/armory-p0/armory_rack.webp":
   "83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8",
  "assets/environment/greyhaven/armory-p0/armory_sword.webp":
   "795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31",
  "src/world/alpha-armory.mjs":
   "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf",
  "src/world/authored-maps.mjs":
   "21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144",
  "src/browser/armory-rack-visual.mjs":
   "3eec34073d4056411df063677e4b435bafa9ad0c684bed450e8c319f91cf5fdc",
  "src/browser/armory-world493-visual-bridge.mjs":
   "f7862e3931a150c5b8ac2e11054183d8de12ef498ab22be5cca192f819d46f69"
 };
 for(const [file,digest] of Object.entries(hashes))
  assert.equal(createHash("sha256").update(read(file)).digest("hex"),digest,file);
});

test("P0 explicit world and art flags gate optional real game import to LOOPBACK only",()=>{
 for(const url of urls)assert.equal(isOriginalArmoryPreviewEnabled(url),true);
 for(const url of [
  "http://myaso.io/game?world=1&armoryart=1",
  "https://evil.test/game?world=1&armoryart=1",
  "https://localhost.evil.test/game?world=1&armoryart=1",
  "http://127.0.0.1:1234/game?armoryart=1",
  "http://127.0.0.1:1234/game?world=1",
  "http://127.0.0.1:1234/game?world=1&armoryart=1&scenario=something",
  "file:///app?world=1&armoryart=1",
  "gibberish"
 ])assert.equal(isOriginalArmoryPreviewEnabled(url),false,url);
});

test("P0 actual World-shared visual plan renders ONLY original rack at zero canonical items",async()=>{
 const asked=[];
 const load=async src=>{asked.push(src);return samples(src);};
 const view=await loadOriginalBlacksmithRackPreview({imageLoader:load,alphaCanvasFactory:factory});
 assert.deepEqual(asked,[ARMORY_RACK_ART.rackSource,ARMORY_RACK_ART.swordSource]);
 assert.equal(view.originalSwordSourceDecoded,true);
 assert.equal(view.actualAuthenticatedItemFeed,false);
 assert.equal(view.status(),null);
 const ctx=context(),camera={x:4110,y:4160};
 for(let i=0;i<3;i++){
  const result=view.draw({ctx,camera,width:640,height:640,zoom:.84});
  assert.equal(result.renderedFrames,i+1);
  assert.equal(result.drawnRackCount,1);
  assert.equal(result.drawnSwordCount,0);
  assert.equal(result.originalWorldSockets,4);
  assert.equal(result.actualGameRender,true);
  assert.equal(result.canonicalItemFeedConnected,false);
  assert.equal(result.serverTryPickup,false);
 }
 assert.equal(ctx.calls.filter(x=>Array.isArray(x)).length,3);
 assert.ok(ctx.calls.filter(x=>Array.isArray(x)).every(a=>a[0].currentSrc.endsWith("armory_rack.webp")));
 assert.equal(view.productionApproved,false);
});

test("P0 no art decoding, invalid camera, or invalid renderer permits misleading rack sprite",async()=>{
 await assert.rejects(()=>loadOriginalBlacksmithRackPreview({
  imageLoader:async src=>{
   if(src===ARMORY_RACK_ART.swordSource)throw new Error("Sword WebP HTTP 503");
   return samples(src);
  },alphaCanvasFactory:factory
 }));
 const view=await loadOriginalBlacksmithRackPreview({
  imageLoader:async src=>samples(src),alphaCanvasFactory:factory
 });
 assert.throws(()=>view.draw({ctx:context(),camera:{x:-1,y:300},width:640,height:640,zoom:.84}));
 assert.equal(view.status(),null);
 assert.throws(()=>view.draw({ctx:context(),camera:{x:4110,y:4160},width:640,height:640,zoom:1.4}));
 assert.equal(view.status(),null);
});

test("P0 live client default path has no static graphics import, no optimistic sword or competing gesture",()=>{
 const client=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(client,/params\.get\("armoryart"\) === "1"/);
 assert.match(client,/void import\("\.\.\/src\/browser\/armory-optin-live-rack\.mjs"\)/);
 assert.match(client,/if \(armoryRackReview\)/);
 assert.match(client,/authoredWorld\.draw/);
 assert.match(client,/for \(const entity of networkClient\.state\.values\(\)\)/);
 assert.ok(client.indexOf("if (armoryRackReview)")>client.indexOf("authoredWorld.draw"));
 assert.ok(client.indexOf("if (armoryRackReview)")<client.indexOf("for (const entity of networkClient.state.values())"));
 assert.equal(client.includes('import {loadOriginalBlacksmithRackPreview}'),false);
 assert.doesNotMatch(client,/committedWorldItems:\[[^\]]*ART-ONLY/);
 assert.equal(OPTIN_ARMORY_VISUAL_CONTRACT.actualClientSwordsBeforeAuthoritativeFeed,0);
 assert.equal(OPTIN_ARMORY_VISUAL_CONTRACT.authorizesItemIds,false);
 assert.equal(OPTIN_ARMORY_VISUAL_CONTRACT.canSuppressCombat,false);
});
