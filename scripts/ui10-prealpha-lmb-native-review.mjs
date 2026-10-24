#!/usr/bin/env node
// DORMANT local-only Chrome/Firefox pointer-source review, NOT online-game.
// No WebTransport transport negotiation, Combat hit or Pre-Alpha release.
import assert from "node:assert/strict";
import {createServer as http} from "node:http";
import {createServer as tcp} from "node:net";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {spawn} from "node:child_process";
import {GESTURE_ACTION, PROPOSED_GESTURE_SOURCE as SOURCE} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=()=>new Promise((r,j)=>{
 const s=tcp();s.on("error",j);
 s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>r(p));});
});
const html=String.raw`<!doctype html><meta charset="utf-8">
<canvas id="arena" width="640" height="420" tabindex="0"
style="display:block;margin:40px;width:500px;height:320px;touch-action:none;border:1px solid black"></canvas>
<script type="module">
import {ProposedSharedTypedGestureOutbox} from "/src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {decodeProposedTypedGestureEvent} from "/src/network/prealpha-lmb-gesture-proposal.mjs";
import {createDormantPrealphaLmbDomGate,attachDormantPrealphaLmbDomGate}
 from "/src/browser/prealpha-lmb-dom-gesture-review.mjs";
const canvas=document.querySelector("#arena"),lease={};
const outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
let chat=false,jump=false;
const gate=createDormantPrealphaLmbDomGate({
 outbox,getClientTick:()=>123,isCanvasTarget:e=>e.target===canvas,
 isChatFocused:()=>chat,isJumpAttackChord:()=>jump
});
const trusted=[];
canvas.addEventListener("pointerdown",e=>trusted.push({type:"down",trusted:e.isTrusted}),true);
window.addEventListener("pointerup",e=>trusted.push({type:"up",trusted:e.isTrusted,button:e.button,buttons:e.buttons}),true);
canvas.addEventListener("mousedown",e=>trusted.push({type:"mouse-down",trusted:e.isTrusted,button:e.button,buttons:e.buttons}),true);
window.addEventListener("mouseup",e=>trusted.push({type:"mouse-up",trusted:e.isTrusted,button:e.button,buttons:e.buttons}),true);
attachDormantPrealphaLmbDomGate(gate,{canvas,windowObj:window,documentObj:document});
window.ui10={
 ready:true,
 report:()=>({trusted:[...trusted],snapshot:gate.snapshot,
  edges:outbox.nextSendBatch(8).map(e=>decodeProposedTypedGestureEvent(e.bytes)),
  realServer:false,combatCommit:false}),
 upgrade:()=>gate.approvedHoldUpgrade(gate.snapshot.pointerId),
 blur:()=>gate.blur(),chat:x=>{chat=x;if(x)gate.chatOpened();},
 jump:x=>jump=x
};
</script>`;
const allowed=new Set([
"/src/browser/prealpha-lmb-dom-gesture-review.mjs",
"/src/network/prealpha-lmb-gesture-outbox-proposal.mjs",
"/src/network/prealpha-lmb-gesture-proposal.mjs",
"/src/network/prealpha-shared-source-allocator-proposal.mjs"
]);
const server=http(async(req,res)=>{
 try{
  const p=new URL(req.url,"http://localhost").pathname;
  if(p==="/favicon.ico"){res.writeHead(204);res.end();return;}
  if(p==="/qa"){res.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
   res.end(html);return;}
  if(!allowed.has(p)){res.writeHead(404);res.end();return;}
  const bytes=await readFile(resolve(process.cwd(),"."+p));
  res.writeHead(200,{"Content-Type":"text/javascript","Cache-Control":"no-store"});
  res.end(bytes);
 }catch{res.writeHead(500);res.end();}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const web=server.address().port,drivers=[],sessions=[];
async function wd(port,method,path,body){
 const r=await fetch("http://127.0.0.1:"+port+path,{method,
 headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const v=await r.json();
 if(!r.ok||v.value?.error)throw Error(method+" "+path+" "+JSON.stringify(v).slice(0,850));
 return v.value;
}
async function poll(name,fn){
 let last;for(let n=0;n<110;n++){
  try{last=await fn();if(last?.ok)return last;}catch(e){last={error:String(e)};}
  await sleep(120);
 }throw Error("Timeout "+name+": "+JSON.stringify(last).slice(0,700));
}
const pointer=arr=>({actions:[{type:"pointer",id:"ui10-mouse",
 parameters:{pointerType:"mouse"},actions:arr}]});
const move=(x=180,y=150)=>({type:"pointerMove",duration:0,x,y,origin:"viewport"});
const down={type:"pointerDown",button:0},up={type:"pointerUp",button:0};
try{
 for(const family of ["chrome","firefox"]){
  const dport=await port();
  drivers.push(spawn(family==="chrome"?"chromedriver":"geckodriver",
   ["--port="+dport],{stdio:"ignore"}));
  await poll(family+" real driver",async()=>{
   const r=await fetch("http://127.0.0.1:"+dport+"/status").catch(()=>null);
   return {ok:!!r?.ok};
  });
  const capabilities=family==="chrome"
   ? {browserName:"chrome","goog:chromeOptions":{
     args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1000,720"]}}
   : {browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
  const id=(await wd(dport,"POST","/session",{capabilities:{alwaysMatch:capabilities}})).sessionId;
  sessions.push({id,dport});
  const nav=async()=>{
   await wd(dport,"POST","/session/"+id+"/url",{url:"http://127.0.0.1:"+web+"/qa"});
   await poll(family+" page import",()=>wd(dport,"POST","/session/"+id+"/execute/sync",
    {script:"return {ok:window.ui10?.ready===true}",args:[]}));
  };
  const run=arr=>wd(dport,"POST","/session/"+id+"/actions",pointer(arr));
  const evaluate=script=>wd(dport,"POST","/session/"+id+"/execute/sync",{script,args:[]});
  await nav();
  await run([move(),down,up]);
  const tap=await evaluate("return ui10.report()");
  assert.deepEqual(tap.edges.map(e=>e.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
  assert.equal(tap.edges[0].gestureId,tap.edges[1].gestureId);
  assert.equal(tap.trusted.filter(e=>e.type==="down"||e.type==="up").length,2);
  assert.ok(tap.trusted.every(e=>e.trusted));
  // Real W3C mouse chord: RMB first, then left down/up.
  // Browser can emit no extra pointerdown/up for LMB; one source0 suffices.
  await nav();
  await run([move(),{type:"pointerDown",button:2},down,up,{type:"pointerUp",button:2}]);
  const chord=await evaluate("return ui10.report()");
  assert.deepEqual(chord.edges.map(e=>[e.source,e.action]),[
    [SOURCE.LMB,GESTURE_ACTION.PRESS],[SOURCE.LMB,GESTURE_ACTION.RELEASE]
  ]);
  assert.equal(chord.edges[0].gestureId,chord.edges[1].gestureId);
  const nativeDown=chord.trusted.find(e=>e.type==="mouse-down"&&e.button===0&&e.buttons===3);
  const nativeUp=chord.trusted.find(e=>e.type==="mouse-up"&&e.button===0&&e.buttons===2);
  assert.ok(nativeDown?.trusted && nativeUp?.trusted,
    "native RMB-held LMB must produce trusted button0 MouseEvents");
  assert.ok(chord.trusted.every(e=>e.trusted),"no synthetic source event may qualify");

  await nav();
  await run([move(),down]);
  assert.equal(await evaluate("return ui10.upgrade()"),true);
  assert.equal(await evaluate("return ui10.upgrade()"),false);
  await run([move(740,460),up]);
  const hold=await evaluate("return ui10.report()");
  assert.deepEqual(hold.edges.map(e=>e.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE]);
  assert.equal(new Set(hold.edges.map(e=>e.gestureId)).size,1);
  await nav();
  await evaluate("ui10.chat(true)");
  await run([move(),down,up]);
  assert.equal((await evaluate("return ui10.report()")).edges.length,0);
  await nav();
  await evaluate("ui10.jump(true)");
  await run([move(),down,up]);
  assert.equal((await evaluate("return ui10.report()")).edges.length,0);
  await nav();
  await run([move(),down]);
  assert.equal(await evaluate("return ui10.blur()"),true);
  await run([up]);
  const cancel=await evaluate("return ui10.report()");
  assert.deepEqual(cancel.edges.map(e=>e.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.CANCEL]);
  assert.equal(cancel.combatCommit,false);
  assert.equal(cancel.realServer,false);
  console.log("UI10_V2_NATIVE_DOM_REVIEW_PASS",JSON.stringify({
   browser:family,realPointerTrusted:true,shortTap:true,
   rmbHeldLmbSource0:true,selectedTypedOutbox:true,
   longHoldUpgradeSameId:true,releaseOutsideCanvas:true,
   chatPrevented:true,jumpChordDelegated:true,blurCanceled:true,
   authenticatedServer:false,combatHits:false,enabledLive:false
  }));
 }
}finally{
 for(const {dport,id} of sessions){try{await wd(dport,"DELETE","/session/"+id);}catch{}}
 drivers.forEach(p=>{try{p.kill();}catch{}});
 await new Promise(ok=>server.close(ok));
}
