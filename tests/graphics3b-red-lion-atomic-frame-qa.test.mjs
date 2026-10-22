import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {paintRedLionFrameInScratch} from "../src/browser/red-lion-atomic-frame-qa.mjs";

function canvas(width=640,height=640){
 const log=[];
 const ctx={
  globalCompositeOperation:"source-over",
  save(){log.push("save");},
  restore(){log.push("restore");},
  setTransform(...values){log.push(["transform",...values]);},
  drawImage(image,x,y){log.push(["commit",image.scene,x,y]);},
 };
 const element={width,height,scene:"blank",log,
  getContext(type){return type==="2d"?ctx:null}};
 return element;
}
const input=(extra={})=>{
 const destinationCanvas=canvas();
 const scratch=[];
 return {
  destinationCanvas,scratch,
  makeScratch:(w,h)=>{
   const s=canvas(w,h);
   scratch.push(s);
   return s;
  },
  paintPlaceholder:c=>{c.scene="original World placeholder";},
  paintDetailed:c=>{c.scene="complete original Red Lion + 3C";},
  preferDetailed:true,...extra
 };
};

test("an original fully decoded facade is presented as exactly one completed candidate frame",()=>{
 const v=input();
 const result=paintRedLionFrameInScratch(v);
 assert.deepEqual(v.destinationCanvas.log.at(-2),["commit","complete original Red Lion + 3C",0,0]);
 assert.equal(v.scratch.length,1);
 assert.equal(result.detailedDrawn,true);
 assert.equal(result.placeholderDrawn,false);
 assert.equal(result.recoveredLateDetailedFailure,false);
 assert.equal(result.liveGameIntegrated,false);
 assert.equal(result.transactionalGpuPresentGuaranteed,false);
 assert.ok(Object.isFrozen(result));
});
test("late detailed drawing failure after partial facade can never publish partial art",()=>{
 const v=input({paintDetailed:c=>{
  c.scene="PARTIAL facade, no roof";throw new Error("Canvas drawImage lost source");
 }});
 const result=paintRedLionFrameInScratch(v);
 assert.equal(v.scratch.length,2);
 assert.notEqual(v.scratch[0],v.scratch[1]);
 assert.equal(v.scratch[0].scene,"PARTIAL facade, no roof");
 assert.equal(v.scratch[1].scene,"original World placeholder");
 assert.equal(result.recoveredLateDetailedFailure,true);
 assert.equal(result.placeholderDrawn,true);
 assert.equal(result.detailedDrawn,false);
 assert.deepEqual(v.destinationCanvas.log.filter(x=>Array.isArray(x)&&x[0]==="commit"),
  [["commit","original World placeholder",0,0]]);
});
test("unavailable facade never invokes detailed painter or hides original building",()=>{
 let detailedCalls=0;
 const v=input({preferDetailed:false,paintDetailed:()=>detailedCalls++});
 const result=paintRedLionFrameInScratch(v);
 assert.equal(detailedCalls,0);
 assert.equal(v.scratch.length,1);
 assert.equal(result.placeholderDrawn,true);
 assert.deepEqual(v.destinationCanvas.log.filter(x=>Array.isArray(x)&&x[0]==="commit"),
  [["commit","original World placeholder",0,0]]);
});
test("missing original World fallback fails hard before touching game canvas",()=>{
 const v=input({paintDetailed:()=>{throw new Error("late facade");},
  paintPlaceholder:()=>{throw new Error("original World unavailable");}});
 assert.throws(()=>paintRedLionFrameInScratch(v),/original World unavailable/);
 assert.equal(v.destinationCanvas.log.length,0);
});
test("invalid canvas, malicious dimensions or injected callbacks fail closed",()=>{
 const v=input();
 for(const mutation of [
  {destinationCanvas:{width:0,height:640}},
  {destinationCanvas:{width:2049,height:640,getContext(){}}},
  {destinationCanvas:{width:640,height:NaN,getContext(){}}},
  {paintDetailed:null},{paintPlaceholder:null},{makeScratch:null},
  {preferDetailed:"yes"},{makeScratch:()=>v.destinationCanvas},
  {makeScratch:()=>canvas(641,640)},
  {makeScratch:()=>({width:640,height:640,getContext:()=>null})},
 ]) assert.throws(()=>paintRedLionFrameInScratch({...v,...mutation}));
});
test("failed destination commit cannot be claimed atomic or silently green",()=>{
 const v=input();
 const ctx=v.destinationCanvas.getContext("2d");
 ctx.drawImage=()=>{throw new Error("destination compositor error");};
 assert.throws(()=>paintRedLionFrameInScratch(v),/destination compositor error/);
 assert.equal(v.destinationCanvas.log.at(-1),"restore");
});
test("the regression stays QA-only, with an explicit late-draw toggle not live game wiring",()=>{
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const viewer=read("web/armory-p0-facade-failclosed-review.mjs");
 const runner=read("tools/art/verify_p0_real_facade_http_failure.mjs");
 assert.match(viewer,/paintRedLionFrameInScratch/);
 assert.match(viewer,/lateCanvasFault/);
 assert.match(viewer,/QA injected late Red Lion Canvas draw failure/);
 assert.doesNotMatch(read("web/online-game.mjs"),/paintRedLionFrameInScratch/);
 assert.match(runner,/mode\.current==="fail-roof"/);
});
