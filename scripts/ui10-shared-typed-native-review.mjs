#!/usr/bin/env node
// DORMANT local-only Chrome/Firefox pointer-source review, NOT online-game.
// No WebTransport transport negotiation, Combat hit or Pre-Alpha release.
import assert from "node:assert/strict";
import {createServer as http} from "node:http";
import {createServer as tcp} from "node:net";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {spawn} from "node:child_process";
import {GESTURE_ACTION} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

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
import {createDormantSharedUi10Sources,attachDormantSharedUi10Sources}
 from "/src/browser/prealpha-shared-ui10-sources-review.mjs";

const canvas=document.querySelector("#arena"),lease={};
const outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
let chat=false,jump=false;
const gates=createDormantSharedUi10Sources({
 outbox,getClientTick:()=>123,isCanvasTarget:e=>e.target===canvas,
 isChatFocused:()=>chat,isJumpAttackChord:()=>jump,
 hasGameplayFocus:()=>document.activeElement===canvas,isTextEditing:()=>chat
});
const trustedKey=[];

window.addEventListener("keydown",e=>{
 if(e.code==="KeyE")trustedKey.push({type:"down",trusted:e.isTrusted,repeat:e.repeat});
},true);
window.addEventListener("keyup",e=>{
 if(e.code==="KeyE")trustedKey.push({type:"up",trusted:e.isTrusted});
},true);
const trusted=[];
canvas.addEventListener("pointerdown",e=>trusted.push({type:"down",trusted:e.isTrusted}),true);
window.addEventListener("pointerup",e=>trusted.push({type:"up",trusted:e.isTrusted}),true);
attachDormantSharedUi10Sources(gates,{canvas,windowObj:window,documentObj:document});
window.ui10={
 ready:true,
 report:()=>{const edges=outbox.nextSendBatch(8).map(e=>decodeProposedTypedGestureEvent(e.bytes));return ({trusted:[...trusted],snapshot:gates.lmb.snapshot,
  keyEdges:edges.filter(e=>e.source===1),
  trustedKey:[...trustedKey],keySnapshot:gates.keye.snapshot,
  edges,
  realServer:false,combatCommit:false});},
 upgrade:()=>gates.lmb.approvedHoldUpgrade(gates.lmb.snapshot.pointerId),
 blur:()=>{const lmbCanceled=gates.lmb.blur();gates.keye.blur();return lmbCanceled;},
 chat:x=>{chat=x;if(x)gates.chatOpened();},
 jump:x=>jump=x
};
</script>`;
const allowed=new Set([
"/src/browser/prealpha-lmb-dom-gesture-review.mjs",
"/src/browser/prealpha-keye-source-review.mjs",
"/src/browser/prealpha-shared-ui10-sources-review.mjs",
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
  const keys=arr=>wd(dport,"POST","/session/"+id+"/actions",{
   actions:[{type:"key",id:"ui10-keyboard",actions:arr}]
  });
  const pressE=()=>keys([{type:"keyDown",value:"e"},{type:"keyUp",value:"e"}]);
  const evaluate=script=>wd(dport,"POST","/session/"+id+"/execute/sync",{script,args:[]});
  await nav();
  await run([move(),down,up]);
  const tap=await evaluate("return ui10.report()");
  assert.deepEqual(tap.edges.map(e=>e.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
  assert.equal(tap.edges[0].gestureId,tap.edges[1].gestureId);
  assert.equal(tap.trusted.length,2);
  assert.ok(tap.trusted.every(e=>e.trusted));
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
  // True W3C keyboard events, independent from the existing LMB capture.
  await nav();
  await evaluate("document.querySelector('#arena').focus()");
  await pressE();
  const keySolo=await evaluate("return ui10.report()");
  assert.deepEqual(keySolo.keyEdges.map(e=>[e.source,e.action]),[[1,1],[1,3]]);
  assert.equal(keySolo.trustedKey.length,2);
  assert.ok(keySolo.trustedKey.every(e=>e.trusted));
  assert.equal(keySolo.keySnapshot.active,false);
  await nav();
  await run([move(),down]);
  // The original game focuses its canvas on pointerdown; this isolated QA
  // fixture has no game input handler, so reproduce that focus boundary.
  await evaluate("document.querySelector('#arena').focus()");
  assert.equal(await evaluate("return document.activeElement?.id"),"arena");
  await pressE();
  const chord=await evaluate("return ui10.report()");
  assert.deepEqual(chord.keyEdges.map(e=>[e.source,e.action]),[[1,1],[1,3]]);
  assert.deepEqual(chord.edges.map(e=>[e.source,e.action]),
   [[0,GESTURE_ACTION.PRESS],[1,GESTURE_ACTION.PRESS],[1,GESTURE_ACTION.RELEASE]]);
  assert.equal(chord.snapshot.active,true,"KeyE UP cannot release active LMB");
  await run([up]);
  const completed=await evaluate("return ui10.report()");
  assert.deepEqual(completed.edges.map(e=>[e.source,e.action]),
    [[0,GESTURE_ACTION.PRESS],[1,GESTURE_ACTION.PRESS],[1,GESTURE_ACTION.RELEASE],[0,GESTURE_ACTION.RELEASE]]);
  assert.equal(completed.edges[0].gestureId,completed.edges[3].gestureId);
  assert.equal(completed.edges[1].gestureId,completed.edges[2].gestureId);
  assert.notEqual(completed.edges[0].gestureId,completed.edges[1].gestureId);
  assert.deepEqual(completed.edges.map(e=>e.sequence),[1,2,3,4]);
  await nav();
  await evaluate("document.querySelector('#arena').focus();ui10.chat(true)");
  await pressE();
  assert.equal((await evaluate("return ui10.report()")).keyEdges.length,0);
  console.log("UI10_V2_NATIVE_DOM_REVIEW_PASS",JSON.stringify({
   browser:family,realPointerTrusted:true,shortTap:true,
   longHoldUpgradeSameId:true,releaseOutsideCanvas:true,
   chatPrevented:true,jumpChordDelegated:true,blurCanceled:true,
   realKeyETrusted:true,keyEIndependentFromHeldLmb:true,chatKeyEPrevented:true,
   authenticatedServer:false,combatHits:false,enabledLive:false
  }));
 }
}finally{
 for(const {dport,id} of sessions){try{await wd(dport,"DELETE","/session/"+id);}catch{}}
 drivers.forEach(p=>{try{p.kill();}catch{}});
 await new Promise(ok=>server.close(ok));
}
