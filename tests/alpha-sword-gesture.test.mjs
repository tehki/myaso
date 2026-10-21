import test from "node:test";
import assert from "node:assert/strict";
import { createAlphaSwordGestureGate } from "../src/browser/alpha-sword-gesture.mjs";
import { swordPointerCanvasPoint } from "../src/browser/sword-canvas-pointer.mjs";

const sprite = (id="opaque:item/1",revision=2, socketId="rack-socket-1") => ({
  kind:"sword",id,revision,socketId,asset:"/assets/armory_sword.webp",
  x:600,y:300,width:42,height:115,sourceWidth:42,sourceHeight:115,
});
function scene({ id, revision, socketId, zoneId="greyhaven", rackVersion="v4",
  frameId=4,lastPresentedFrameId=frameId, alpha=255 } = {}) {
  const s=sprite(id,revision,socketId);
  return { plan:{rackVersion,zoneId,swords:[s]},frameId,lastPresentedFrameId,
    sampleAlpha: () => alpha };
}
const graphicsHit = (plan,p,sampleAlpha) => {
  const s=plan.swords.at(-1);
  if (p.x<s.x||p.x>=s.x+s.width||p.y<s.y||p.y>=s.y+s.height) return null;
  const alpha=sampleAlpha(s.asset,Math.floor(p.x-s.x),Math.floor(p.y-s.y));
  if (alpha<64) return null;
  return {itemId:s.id,socketId:s.socketId,revision:s.revision,
    alpha,sourcePixel:{x:Math.floor(p.x-s.x),y:Math.floor(p.y-s.y)},
    visualCandidateOnly:true,serverPickupCommitted:false,maySuppressCombat:false};
};
const down=(id=9,p={x:610,y:340})=>({button:0,pointerId:id,...p});
const up=down;
const canvas={width:1280,height:720,getBoundingClientRect(){
  return {left:20,top:90,width:640,height:360};
}};
test("P0 opaque rendered sword down/up is pending-only and never creates attack",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene(),p=down();
  assert.deepEqual(g.down(p,s),{handled:true,itemId:null});
  assert.deepEqual(g.up(p,s),{handled:true,itemId:"opaque:item/1"});
  assert.deepEqual(g.up(p,s),{handled:false,itemId:null});
});
test("P0 transparent sword pixels are never reserved",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit);
  assert.deepEqual(g.down(down(),scene({alpha:0})),{handled:false,itemId:null});
  assert.deepEqual(g.up(up(),scene()),{handled:false,itemId:null});
});
test("P0 down opaque / up transparent or outside suppresses attack but denies item",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene(),p=down();
  assert.equal(g.down(p,s).handled,true);
  assert.deepEqual(g.up(up(9),scene({alpha:0})),{handled:true,itemId:null});
  assert.equal(g.down(p,s).handled,true);
  assert.deepEqual(g.up(up(9,{x:50,y:50}),s),{handled:true,itemId:null});
});
test("P0 moving camera or another player taking sword changes IDs/revisions and safely cancels",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene();
  for(const updated of [scene({id:"item2"}),scene({revision:3}),
    scene({socketId:"rack-socket-2"}),scene({rackVersion:"v5"}),
    scene({zoneId:"new-zone"})]){
    assert.equal(g.down(down(),s).handled,true);
    assert.deepEqual(g.up(up(),updated),{handled:true,itemId:null});
  }
});
test("P0 forged/stale unpresented canvas frames fail closed",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene();
  assert.deepEqual(g.down(down(),{...s,frameId:9}),{handled:false,itemId:null});
  assert.deepEqual(g.down(down(),{...s,plan:{...s.plan,swords:[]}}),{handled:false,itemId:null});
  assert.equal(g.down(down(),s).handled,true);
  assert.deepEqual(g.up(up(),{...s,lastPresentedFrameId:3}),{handled:true,itemId:null});
});
test("P0 repeated LMB downs cannot retarget, cancel/reset clears after blur or lost capture",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene();
  assert.equal(g.down(down(-1),s).handled,true);
  assert.equal(g.down(down(-1),scene({id:"item2"})).handled,true);
  assert.deepEqual(g.up(up(-1),s),{handled:true,itemId:"opaque:item/1"});
  assert.equal(g.down(down(3),s).handled,true);
  assert.equal(g.cancel(3),true);
  assert.deepEqual(g.up(up(3),s),{handled:false,itemId:null});
  assert.equal(g.down(down(4),s).handled,true);
  g.reset();
  assert.deepEqual(g.up(up(4),s),{handled:false,itemId:null});
});
test("P0 RMB/middle/outside canvas do not reserve Combat",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene();
  assert.equal(g.down({...down(),button:2},s).handled,false);
  assert.equal(g.down({...down(),button:1},s).handled,false);
  assert.equal(g.down({...down(),pointerId:NaN},s).handled,false);
  assert.equal(g.down(down(2,{x:-1,y:400}),s).handled,false);
  assert.equal(g.down(down(2,{x:Infinity,y:400}),s).handled,false);
});
test("P0 native CSS pixel conversion flows to alpha hit at DPR2 and scene revision remains",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),s=scene();
  const coords=swordPointerCanvasPoint({clientX:325,clientY:260},canvas);
  assert.deepEqual(coords,{x:610,y:340});
  const event={button:0,pointerId:77,...coords};
  assert.deepEqual(g.down(event,s),{handled:true,itemId:null});
  assert.deepEqual(g.up(event,s),{handled:true,itemId:"opaque:item/1"});
});
test("P0 malformed alpha samples/faults cannot reserve any sword",()=>{
  const g=createAlphaSwordGestureGate(()=>{throw Error("image context lost")});
  assert.deepEqual(g.down(down(),scene()),{handled:false,itemId:null});
  assert.throws(()=>createAlphaSwordGestureGate(null),TypeError);
});
test("P0 rejects alpha callback candidate outside the actual painted sword pixels",()=>{
  const lyingAlpha=(plan,_p)=>({
    itemId:plan.swords[0].id,socketId:plan.swords[0].socketId,
    revision:plan.swords[0].revision,alpha:255,sourcePixel:{x:20,y:13},
    visualCandidateOnly:true,serverPickupCommitted:false,
  });
  const g=createAlphaSwordGestureGate(lyingAlpha),s=scene();
  assert.deepEqual(g.down(down(9,{x:500,y:250}),s),{handled:false,itemId:null});
  assert.deepEqual(g.down(down(9,{x:610,y:340}),s),{handled:false,itemId:null},
    "candidate must match the exact source pixel under the pointer");
});
test("P0 independently rechecks Graphics source WebP alpha and sprite dimensions",()=>{
  const lyingAlpha=(plan,p)=>({
    itemId:plan.swords[0].id,socketId:plan.swords[0].socketId,
    revision:plan.swords[0].revision,alpha:255,
    sourcePixel:{x:Math.floor(p.x-600),y:Math.floor(p.y-300)},
    visualCandidateOnly:true,serverPickupCommitted:false,
  });
  const g=createAlphaSwordGestureGate(lyingAlpha),s=scene({alpha:0});
  assert.deepEqual(g.down(down(),s),{handled:false,itemId:null},
    "visually transparent WebP pixel must not reserve Combat even if callback says opaque");
  assert.deepEqual(g.down(down(),{...scene(),plan:{...scene().plan,
    swords:[{...scene().plan.swords[0],sourceWidth:0}]} }),{handled:false,itemId:null});
});

test("P0 rejects a painted-but-occluded or explicitly omitted sword visual",()=>{
  const g=createAlphaSwordGestureGate(graphicsHit),base=scene();
  for(const flag of [{occluded:true},{rendered:false}]){
    const s={...base,plan:{...base.plan,swords:[{...base.plan.swords[0],...flag}]}};
    assert.deepEqual(g.down(down(19),s),{handled:false,itemId:null});
  }
});
test("P0 rejects wrong rear sword when later-painted opaque sword covers its pixel",()=>{
  // Deliberately faulty Graphics callback always claims the rear sword.
  const rearCandidate=(plan,p)=>({
    itemId:plan.swords[0].id,socketId:plan.swords[0].socketId,
    revision:plan.swords[0].revision,alpha:255,
    sourcePixel:{x:Math.floor(p.x-600),y:Math.floor(p.y-300)},
    visualCandidateOnly:true,serverPickupCommitted:false,
  });
  const g=createAlphaSwordGestureGate(rearCandidate);
  const s=scene(), rear=s.plan.swords[0];
  const front={...sprite("opaque:item/front",2,"rack-socket-front"),
    x:605,y:325,asset:"/assets/foreground-sword.webp"};
  const plan={...s.plan,swords:[rear,front]};
  assert.deepEqual(g.down(down(20),{...s,plan,sampleAlpha:()=>255}),
    {handled:false,itemId:null},"covered rear cannot reserve a pickup");
  // Transparent foreground reveals the rear; clicking the real rear pixel is valid.
  const revealed={...s,plan,sampleAlpha:(asset)=>asset===front.asset?0:255};
  assert.deepEqual(g.down(down(20),revealed),{handled:true,itemId:null});
  assert.deepEqual(g.up(up(20),revealed),{handled:true,itemId:rear.id});
});
test("P0 malformed foreground source alpha fails closed instead of selecting behind it",()=>{
  const s=scene(),front={...sprite("opaque:item/front",2,"rack-socket-front"),
    x:605,y:325,asset:"/assets/foreground-sword.webp"};
  const plan={...s.plan,swords:[s.plan.swords[0],front]};
  const g=createAlphaSwordGestureGate((p,point)=>({
    itemId:p.swords[0].id,socketId:p.swords[0].socketId,
    revision:p.swords[0].revision,alpha:255,
    sourcePixel:{x:Math.floor(point.x-600),y:Math.floor(point.y-300)},
    visualCandidateOnly:true,serverPickupCommitted:false,
  }));
  assert.deepEqual(g.down(down(30),{...s,plan,
    sampleAlpha:(asset)=>asset===front.asset?NaN:255}),
    {handled:false,itemId:null});
});
