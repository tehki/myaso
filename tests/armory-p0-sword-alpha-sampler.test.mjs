import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createArmorySwordAlphaSampler,ARMORY_SWORD_ALPHA_SPEC} from "../src/browser/armory-sword-alpha-sampler.mjs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
const image={complete:true,naturalWidth:42,naturalHeight:115,
 currentSrc:"http://localhost/assets/environment/greyhaven/armory-p0/armory_sword.webp"};
const originalSource=new URL("../assets/environment/greyhaven/armory-p0/armory_sword.webp",import.meta.url);
const sourceBytes=readFileSync(originalSource);
function factory(pixels=[[20,13,159],[21,14,64],...Array.from({length:25},(_,i)=>[19+i%5,53+Math.floor(i/5),255])]) {
 const rgba=new Uint8ClampedArray(42*115*4);
 for(const [x,y,a] of pixels)rgba[(y*42+x)*4+3]=a;
 return ()=>({
  width:0,height:0,
  getContext(mode,options){
   assert.equal(mode,"2d");
   assert.equal(options.willReadFrequently,true);
   return {drawImage(){},getImageData(x,y,w,h){
    assert.deepEqual([x,y,w,h],[0,0,42,115]);
    return {data:rgba};
   }};
  }
 });
}

test("P0 sword decoder only samples original 42x115 source RGBA, with no mutable alpha exposed",()=>{
 const mask=createArmorySwordAlphaSampler(image,{canvasFactory:factory()});
 assert.equal(ARMORY_SWORD_ALPHA_SPEC.sha256,
  createHash("sha256").update(sourceBytes).digest("hex"));
 assert.equal(ARMORY_SWORD_ALPHA_SPEC.source,ARMORY_RACK_ART.swordSource);
 assert.equal(ARMORY_SWORD_ALPHA_SPEC.hitThreshold,64);
 assert.equal(mask.sourceShaExpected,ARMORY_RACK_ART.swordSha256);
 assert.equal(mask.width,42);
 assert.equal(mask.height,115);
 assert.equal(mask.visiblePixels,27);
 assert.equal(mask.clickablePixels,27);
 assert.equal(mask.stableSourcePixel.radius,2);
 assert.equal(mask.stableSourcePixel.minimumNeighborhoodAlpha,224);
 assert.equal(mask.stableSourcePixel.expandsHitBox,false);
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)
  assert.ok(mask.sampleAlpha(ARMORY_RACK_ART.swordSource,
   mask.stableSourcePixel.x+dx,mask.stableSourcePixel.y+dy)>=224);
 assert.equal(mask.sampleAlpha(ARMORY_RACK_ART.swordSource,20,13),159);
 assert.equal(mask.sampleAlpha(ARMORY_RACK_ART.swordSource,21,14),64);
 assert.equal(mask.sampleAlpha(ARMORY_RACK_ART.swordSource,0,0),0);
 assert.equal(mask.presentationOnly,true);
 assert.equal(mask.assetBytesCryptographicallyVerified,false);
 assert.equal(mask.actualServerPickup,false);
 assert.equal(mask.productionApproved,false);
 assert.ok(Object.isFrozen(mask));
 assert.equal(mask.buffer,undefined);
 assert.equal(mask.mask,undefined);
 assert.equal(mask.data,undefined);
});

test("P0 fail-closed alpha sampler blocks unknown image pixels, out-of-bounds and fake source assets",()=>{
 const mask=createArmorySwordAlphaSampler(image,{canvasFactory:factory()});
 for(const [x,y] of [[-1,0],[0,-1],[42,0],[0,115],[NaN,13],[20.5,13],[20,Infinity]])
  assert.equal(mask.sampleAlpha(ARMORY_RACK_ART.swordSource,x,y),0);
 for(const other of ["",undefined,ARMORY_RACK_ART.rackSource,
  "/assets/environment/greyhaven/armory-p0/../armory_sword.webp"])
  assert.equal(mask.sampleAlpha(other,20,13),0);
 for(const corrupt of [
  {...image,complete:false},
  {...image,naturalWidth:40},
  {...image,naturalHeight:116},
  {...image,currentSrc:"http://localhost/assets/environment/greyhaven/armory-p0/other.webp"},
  {...image,currentSrc:"http://localhost/assets/environment/greyhaven/armory-p0/armory_sword.webp?v=1"},
  {...image,currentSrc:"http://localhost/assets/environment/greyhaven/armory-p0/armory_sword.webp#wrong"},
  {...image,currentSrc:"file:///C:/some-other.webp"}
 ])assert.throws(()=>createArmorySwordAlphaSampler(corrupt,{canvasFactory:factory()}));
});

test("P0 missing/tainted 2D canvas or invalid source alpha never defaults a sword to clickable",()=>{
 for(const canvasFactory of [
  ()=>null,
  ()=>({}),
  ()=>({getContext:()=>null}),
  ()=>({getContext:()=>({drawImage(){},getImageData(){throw Error("tainted");}})}),
  ()=>({getContext:()=>({drawImage(){},getImageData(){return{data:new Uint8Array(1)};}})}),
  factory([]),
  factory(Array.from({length:42*115},(_,i)=>[i%42,Math.floor(i/42),255]))
 ])assert.throws(()=>createArmorySwordAlphaSampler(image,{canvasFactory}));
 assert.throws(()=>createArmorySwordAlphaSampler(image,{canvasFactory:"invalid"}));
});

test("P0 native full World493 / hardened UI503 browsers exercise the same production-intended alpha decoder",()=>{
 const root=new URL("../",import.meta.url);
 const read=p=>readFileSync(new URL(p,root));
 const report=JSON.parse(read("assets/environment/greyhaven/armory-p0/world-ui-review/armory_p0_world493_ui503_native_report.json").toString("utf8"));
 const viewer=read("web/armory-p0-world493-ui-review.mjs").toString("utf8");
 const harness=read("tools/art/verify_armory_world493_ui503.mjs").toString("utf8");
 assert.match(viewer,/import \{createArmorySwordAlphaSampler\}/);
 assert.match(viewer,/const decoder=createArmorySwordAlphaSampler\(sword\)/);
 assert.doesNotMatch(viewer,/getImageData|rgba\[|ImageData\(/);
 assert.match(harness,/src\/browser\/armory-sword-alpha-sampler\.mjs/);
 assert.equal(report.browserResults.length,2);
 for(const browser of report.browserResults){
  assert.equal(browser.alphaSampler.sourceShaExpected,ARMORY_RACK_ART.swordSha256);
  assert.equal(browser.alphaSampler.visiblePixels,1082);
  assert.ok(browser.alphaSampler.clickablePixels>0);
  assert.equal(browser.alphaSampler.alphaOpaquePixel,159);
  assert.equal(browser.alphaSampler.alphaTransparentPixel,0);
  assert.equal(browser.alphaSampler.productionApproved,false);
  assert.deepEqual(browser.errors,[]);
  assert.equal(browser.afterDpr2.visualIntents.length,2);
  assert.equal(browser.afterDpr2.combatFallback,1);
  assert.equal(browser.afterDpr2.cancelled,3);
 }
});
