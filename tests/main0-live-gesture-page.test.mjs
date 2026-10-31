import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { activateLoopbackGestureLab, activateInstantLmb } from "../web/prealpha-gesture-live-lab.mjs";
import { decodeProposedTypedGestureEvent } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

function event(type, fields) {
  const e = new Event(type,{cancelable:true,bubbles:true});
  Object.assign(e,fields);
  return e;
}
function createFixture(pageHost="localhost",serverHost="127.0.0.1") {
  const canvas=new EventTarget(),win=new EventTarget(),doc=new EventTarget(),wire=[];
  doc.activeElement=canvas; doc.hidden=false;
  win.location={hostname:pageHost};
  let grantCalls=0, instantCalls=0, closed=false;
  const gameClient={
    transport:{webTransportUrl:"https://"+serverHost+":4433/game"},
    async negotiateExperimentalGestureV2(){grantCalls++;return true;},
    async negotiateInstantLmb(){instantCalls++;return true;},
    async sendExperimentalGestureEdge(bytes){wire.push(decodeProposedTypedGestureEvent(bytes));},
    close(){closed=true;},
  };
  return {canvas,win,doc,wire,gameClient,
    get grantCalls(){return grantCalls;},get closed(){return closed;},
    get instantCalls(){return instantCalls;},
    options:{gameClient,canvas,windowObj:win,documentObj:doc,getClientTick:()=>5},
  };
}

test("actual first-party pointerdown submits source0 light PRESS before mouse up, without v1 sampler",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try {
  assert.equal(f.grantCalls,1);
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:7,button:0,buttons:1}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>[e.source,e.action]),[[0,1]]);
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:7,button:0,buttons:0}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.filter(e=>e.action===3).map(e=>e.source),[0]);
  assert.equal(lab.outbox.snapshot.activeSources.length,0);
 }finally{lab.close("test");}
});

test("trusted release profile owns the same physical PRESS without experimental public activation or diagnostics",async()=>{
 const f=createFixture("game.open-trust-layer.org","game.open-trust-layer.org");
 const pin="ab".repeat(32),server=f.gameClient.transport.webTransportUrl;
 f.win.location=new URL("https://game.open-trust-layer.org/web/?instantLmb=1&server="+encodeURIComponent(server)+"&cert="+pin);
 f.options.fetchConfig=async()=>({ok:true,json:async()=>({serverUrl:server,certificateSha256:pin,maxPlayers:8,instantLmbEnabled:true})});
 const lab=await activateInstantLmb(f.options);
 try {
  assert.equal(f.instantCalls,1);assert.equal(f.grantCalls,0);
  assert.equal(Object.hasOwn(f.win,"__MYASO_LOCAL_GESTURE_PROOF__"),false);
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:31,button:0,buttons:1}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>[e.source,e.action]),[[0,1]]);
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:31,button:0,buttons:0}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1,3]);
 }finally{lab.close("test");}
});

test("hidden page immediately flushes its physical CANCEL before any retry or Light deadline",async()=>{
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try {
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:32,button:0,buttons:1}));
  await settleMicrotasks();
  f.doc.hidden=true;f.doc.dispatchEvent(event("visibilitychange",{}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1,4]);
  assert.equal(f.wire.some(e=>e.action===3),false,"hiding is not a physical UP");
 }finally{lab.close("test");}
});

test("trusted release configuration cannot authorize a different existing game connection",async()=>{
 const f=createFixture("game.open-trust-layer.org","foreign.example");
 const server="https://game.open-trust-layer.org:4433/game",pin="ab".repeat(32);
 f.win.location=new URL("https://game.open-trust-layer.org/web/?instantLmb=1&server="+encodeURIComponent(server)+"&cert="+pin);
 f.options.fetchConfig=async()=>({ok:true,json:async()=>({serverUrl:server,certificateSha256:pin,maxPlayers:8,instantLmbEnabled:true})});
 await assert.rejects(activateInstantLmb(f.options),/trusted release profile/);
 assert.equal(f.instantCalls,0);assert.equal(f.grantCalls,0);assert.equal(f.wire.length,0);
});

test("canvas focus loss immediately cancels a held pointer without inventing UP or waiting for retries",async()=>{
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try {
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:33,button:0,buttons:1}));
  await settleMicrotasks();
  f.canvas.dispatchEvent(event("blur",{}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1,4]);
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:33,button:0,buttons:0}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1,4],"later physical UP cannot reopen a cancelled source");
 }finally{lab.close("test");}
});

test("170ms without ACK repeats the same RELEASE identity, never authors a second gesture",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:7,button:0,buttons:1}));
  await settleMicrotasks();
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:7,button:0,buttons:0}));
  await settleMicrotasks();
  const lease=lab.lease;
  t.mock.timers.tick(170);await settleMicrotasks();
  const releases=f.wire.filter(e=>e.action===3);
  assert.deepEqual(releases.map(e=>e.source),[0,0],"reproduces original first-red observation");
  assert.deepEqual(releases[1],releases[0],"all decoded wire fields are identical");
  assert.equal(lab.lease,lease,"same authenticated-connection lease token");
  assert.deepEqual(f.win.__MYASO_LOCAL_GESTURE_PROOF__().attemptedTransmissions.filter(e=>e.action===3),[
   {source:0,action:3,sequence:2,gestureId:1,attempt:1,currentLease:true},
   {source:0,action:3,sequence:2,gestureId:1,attempt:2,currentLease:true},
  ]);
  assert.equal(lab.outbox.snapshot.nextSequence,3,"no duplicate producer allocated a new identity");
  assert.equal(lab.outbox.snapshot.activeSources.length,0,"retry cannot resurrect retired gesture");
  acknowledgeSent(f,lab);
  assert.equal(lab.snapshot.pending,0);
  t.mock.timers.tick(510);await settleMicrotasks();
  assert.equal(f.wire.length,4,"authenticated ACK settles both original edges and stops retries");
 }finally{lab.close("test");}
});

test("genuine hold upgrade is an intent before server-controlled READY, terminal remains physical UP",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:8,button:0,buttons:1}));
  t.mock.timers.tick(125);await settleMicrotasks();
  assert.ok(f.wire.some(e=>e.source===0&&e.action===2),"held pointer queues upgrade request");
  assert.ok(!f.wire.some(e=>e.action===3),"no phantom RELEASE at 85ms/125ms");
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:8,button:0,buttons:0}));
  await settleMicrotasks();
  assert.ok(f.wire.some(e=>e.source===0&&e.action===3),"only actual physical UP terminates hold");
 }finally{lab.close("test");}
});

test("Heavy hold-intent starts from accepted physical PRESS before slow UI observer",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),observed=[];
 f.options.onAcceptedPress=proof=>{
  observed.push(proof);
  // Simulate slow synchronous presentation AFTER actual captured PRESS.
  // The 85ms hold clock must not restart after this 70ms work.
  t.mock.timers.tick(70);
 };
 const lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:86,button:0,buttons:1}));
  await settleMicrotasks();
  assert.equal(observed.length,1,"one accepted physical gesture");
  assert.equal(observed[0].pointerId,86);
  assert.deepEqual(f.wire.map(e=>e.action),[1],"initial source0 PRESS still admitted");
  t.mock.timers.tick(14);await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1],"no UPGRADE before physical 85ms");
  t.mock.timers.tick(1);await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1,2],
   "exact 85ms from accepted physical PRESS, not 155ms after UI observer");
  assert.equal(f.wire[1].gestureId,f.wire[0].gestureId);
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:86,button:0,buttons:0}));
  await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>e.action),[1,2,3],"only physical UP releases charge");
 }finally{lab.close("test");}
});

test("early physical cancel and Space+LMB never schedule a Heavy UPGRADE",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),accepted=[];
 let jumpChord=false;
 f.options.isJumpAttackChord=()=>jumpChord;
 f.options.enableJumpAttackReview=true;
 f.options.onAcceptedPress=physical=>accepted.push(physical);
 const lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:87,button:0,buttons:1}));
  t.mock.timers.tick(50);
  f.win.dispatchEvent(event("keydown",{code:"Space",repeat:false}));
  await settleMicrotasks();
  t.mock.timers.tick(85);await settleMicrotasks();
  assert.ok(!f.wire.some(e=>e.action===2),"cancelled original Light cannot upgrade");
  assert.ok(f.wire.some(e=>e.action===4),"Space after LMB cancels true active source");
  jumpChord=true;
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:88,button:0,buttons:1}));
  await settleMicrotasks();
  assert.equal(accepted.at(-1).jump,true,"Space-first LMB retains JumpAttack intent");
  t.mock.timers.tick(150);await settleMicrotasks();
  assert.equal(f.wire.filter(e=>e.action===2).length,0,
   "JumpAttack never inherits ordinary Heavy hold-intent timer");
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:88,button:0,buttons:0}));
  await settleMicrotasks();
  assert.equal(lab.snapshot.failed,false,"real original lease stays alive");
 }finally{lab.close("test");}
});

test("Key E is reserved for Use, while original LMB stays the only Combat gesture source",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.win.dispatchEvent(event("keydown",{code:"KeyE",repeat:false}));
  f.win.dispatchEvent(event("keyup",{code:"KeyE"}));
  await settleMicrotasks();
  assert.deepEqual(f.wire,[],"Use has no Combat sender");
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:10,button:0,buttons:1}));
  await settleMicrotasks();
  assert.ok(f.wire.some(e=>e.source===0&&e.action===1));
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:10,button:0,buttons:0}));
  await settleMicrotasks();
  assert.deepEqual([...new Set(f.wire.map(e=>e.source))],[0]);
  assert.deepEqual([...new Set(f.wire.map(e=>e.sequence))],[1,2]);
 }finally{lab.close("test");}
});

test("public target or public webpage refuses before any grant or physical event attachment",async()=>{
 for(const f of [createFixture("game.open-trust-layer.org"),createFixture("localhost","game.open-trust-layer.org")]){
  await assert.rejects(activateLoopbackGestureLab(f.options),/cannot activate on public hosts/);
  assert.equal(f.grantCalls,0);
  assert.equal(f.wire.length,0);
 }
});

test("blur/pagehide retires source owner, never sends a phantom RELEASE or reuses old QUIC",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:14,button:0,buttons:1}));
 await settleMicrotasks();
 f.win.dispatchEvent(event("pagehide",{}));
 await settleMicrotasks();
 assert.equal(f.closed,true);
 assert.equal(lab.snapshot.closed,true);
 assert.ok(!f.wire.some(e=>e.action===3),"navigation must not synthesize strike");
 f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:14,button:0,buttons:0}));
 t.mock.timers.tick(510);await settleMicrotasks();
 assert.ok(!f.wire.some(e=>e.action===3),"old lease cannot send terminal after pagehide");
});

test("original player-facing online client mutually excludes legacy v1 attack writer in opt-in lab",()=>{
 const game=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(game,/if \(gestureLabRequested && !reviewedGestureLab\)/);
 assert.match(game,/const typedLmbEnabled = reviewedGestureLab \|\| instantLmbProfile.enabled/);
 assert.match(game,/currentInput\.attack = !typedLmbEnabled &&/);
 assert.match(game,/currentInput\.heavyAttack = !typedLmbEnabled &&/);
 assert.match(game,/if \(event\.code === "KeyE"\) return;/);
 assert.match(game,/onExperimentalGestureAck\(bytes, lease\)/);
 assert.match(game,/instantLmbProfile.enabled \? activateInstantLmb : activateLoopbackGestureLab/);
 assert.match(game,/if \(typedLmbEnabled\) return; \/\/ one typed owner/);
});


test("old held-pointer timer cannot upgrade a newer gesture reusing the native mouse pointer ID",async t=>{
 t.mock.timers.enable({apis:["setTimeout"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 const settled=new Set();
 const acknowledge=()=>{
  for(const edge of f.wire){
   if(settled.has(edge.sequence))continue;
   const bytes=new Uint8Array(16),view=new DataView(bytes.buffer);
   bytes.set([2,0x12,1,0]);
   view.setUint32(4,edge.sequence,true);view.setUint32(8,edge.gestureId,true);view.setUint32(12,5,true);
   lab.outbox.receiveAck(bytes,lab.lease);
   settled.add(edge.sequence);
  }
 };
 const down=()=>f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:1,button:0,buttons:1}));
 const up=()=>f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:1,button:0,buttons:0}));
 try{
  down();
  await settleMicrotasks();
  acknowledge();
  t.mock.timers.tick(84);
  up();
  await settleMicrotasks();
  acknowledge();
  down();
  await settleMicrotasks();
  acknowledge();
  const presses=f.wire.filter(e=>e.action===1);
  const firstId=presses[0].gestureId,secondId=presses.at(-1).gestureId;
  assert.notEqual(firstId,secondId,"two physical presses use distinct same-lease gestures");
  t.mock.timers.tick(1);
  assert.equal(f.wire.filter(e=>e.action===2).length,0,
    "first gesture's 85ms deadline cannot upgrade a one-millisecond-old replacement press");
  t.mock.timers.tick(84);
  await settleMicrotasks();
  assert.deepEqual(f.wire.filter(e=>e.action===2).map(e=>e.gestureId),[secondId],
    "replacement upgrades only from its own full 85ms hold intent");
  assert.equal(f.wire.filter(e=>e.action===3).length,1,"timer never synthesizes release");
  up();
  await settleMicrotasks();
  assert.deepEqual(f.wire.filter(e=>e.action===3).map(e=>e.gestureId),[firstId,secondId]);
 }finally{lab.close("test");}
});


const settleMicrotasks=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function blockedFixture(){
 const f=createFixture(),scheduled=[];
 let release;
 const ready=new Promise(resolve=>{release=resolve;});
 f.gameClient.sendExperimentalGestureEdge=async bytes=>{
  const edge=decodeProposedTypedGestureEvent(bytes);
  scheduled.push(edge);
  await ready;
  if(f.closed)throw new Error("retired transport cannot write old lease");
  f.wire.push(edge);
 };
 return {f,scheduled,release};
}
function acknowledgeSent(f,lab){
 for(const edge of f.wire){
  const bytes=new Uint8Array(16),view=new DataView(bytes.buffer);
  bytes.set([2,0x12,1,0]);
  view.setUint32(4,edge.sequence,true);view.setUint32(8,edge.gestureId,true);view.setUint32(12,5,true);
  lab.outbox.receiveAck(bytes,lab.lease);
 }
}
test("blocked canonical writer retains one LMB attempt and drains real release after readiness returns",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const {f,scheduled,release}=blockedFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:1,button:0,buttons:1}));
  t.mock.timers.tick(6);
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:1,button:0,buttons:0}));
  for(let n=0;n<4;n++){t.mock.timers.tick(170);await settleMicrotasks();}
  assert.equal(lab.snapshot.closed,false,"readiness wait cannot burn three retry attempts before any write");
  assert.deepEqual(scheduled.map(e=>[e.sequence,e.source,e.action]),[[1,0,1]],"one bounded batch awaits original writer");
  assert.equal(lab.snapshot.pending,2,"real terminal remains in original outbox");
  f.win.dispatchEvent(event("keydown",{code:"KeyE",repeat:false}));
  f.win.dispatchEvent(event("keyup",{code:"KeyE"}));
  assert.equal(lab.outbox.snapshot.nextSequence,3,"E allocates no Combat identity under backpressure");
  release();await settleMicrotasks();
  assert.deepEqual(f.wire.map(e=>[e.sequence,e.source,e.action]),[[1,0,1],[2,0,3]],"original order and exactly one first write per edge");
  acknowledgeSent(f,lab);
  assert.equal(lab.snapshot.pending,0);
  assert.equal(lab.snapshot.closed,false);
  t.mock.timers.tick(1500);await settleMicrotasks();
  assert.equal(lab.snapshot.closed,false,"completed writer watchdog must be cleared");
  assert.equal(f.wire.length,2,"settled ACKs never authorize or manufacture another attack");
 }finally{lab.close("test");release();await settleMicrotasks();}
});
test("a 1500ms blocked writer retires the same lease and cannot emit queued edges after readiness",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const {f,scheduled,release}=blockedFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:1,button:0,buttons:1}));
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:1,button:0,buttons:0}));
  for(let n=0;n<8;n++){t.mock.timers.tick(170);await settleMicrotasks();}
  t.mock.timers.tick(139);await settleMicrotasks();
  assert.equal(lab.snapshot.closed,false,"explicit writer stall bound is exactly 1500ms");
  t.mock.timers.tick(1);await settleMicrotasks();
  assert.equal(lab.snapshot.failed,true);
  assert.equal(lab.snapshot.closed,true);
  assert.equal(f.closed,true,"retire actual original transport before a delayed continuation");
  assert.equal(lab.snapshot.pending,0);
  release();await settleMicrotasks();
  assert.equal(f.wire.length,0,"old queued writes cannot cross lease retirement");
  assert.equal(scheduled.length,1,"no overlapping retry batches reached the transport");
  t.mock.timers.tick(5000);await settleMicrotasks();
  assert.equal(scheduled.length,1,"retirement clears retries and all pending watchdogs");
 }finally{lab.close("test");release();await settleMicrotasks();}
});


test("completed writes without authenticated ACK still exhaust the original bounded retry policy",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:1,button:0,buttons:1}));
  await settleMicrotasks();
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:1,button:0,buttons:0}));
  await settleMicrotasks();
  for(let n=0;n<2;n++){t.mock.timers.tick(170);await settleMicrotasks();}
  assert.equal(lab.snapshot.closed,false);
  assert.deepEqual(f.wire.map(e=>e.sequence),[1,2,1,2,1,2],"three unchanged original attempts per real edge");
  t.mock.timers.tick(170);await settleMicrotasks();
  assert.equal(lab.snapshot.failed,true,"write completion is not an ACK or combat success");
  assert.equal(f.closed,true);
  assert.equal(f.wire.length,6,"retry exhaustion never invents a fourth attempt");
 }finally{lab.close("test");}
});

test("loopback geometry proof copies only actual replicas and never infers actors or missing vitals",async()=>{
 const f=createFixture();
 const original={netId:4,x:123,y:456,action:19,hp:66,guard:62,stamina:28,secret:"not exposed"};
 f.gameClient.state=new Map([[4,original],[999,{x:7,y:8}]]);
 f.gameClient.playerNetId=4;
 f.gameClient.latestServerTick=1359;
 const lab=await activateLoopbackGestureLab(f.options);
 try{
  const first=f.win.__MYASO_LOCAL_GESTURE_PROOF__();
  assert.equal(first.ownPlayerNetId,4);
  assert.equal(first.serverTick,1359);
  assert.deepEqual(first.replicatedFighters[0],{netId:4,x:123,y:456,action:19,hp:66,guard:62,stamina:28});
  assert.equal(first.replicatedFighters[1].netId,undefined,"Map key never invents an actor identity");
  assert.equal(first.replicatedFighters[1].hp,undefined,"missing replicated HP never becomes guessed full health");
  assert.equal(first.replicatedFighters[0].secret,undefined);
  assert.throws(()=>{first.replicatedFighters[0].x=900;},TypeError);
  assert.throws(()=>first.replicatedFighters.push({netId:5}),TypeError);
  assert.equal(original.x,123,"proof cannot mutate real replica state");
  original.x=124;
  f.gameClient.latestServerTick=1360;
  const second=f.win.__MYASO_LOCAL_GESTURE_PROOF__();
  assert.equal(first.replicatedFighters[0].x,123,"old proof remains a detached snapshot");
  assert.equal(second.replicatedFighters[0].x,124);
  assert.equal(second.serverTick,1360);
  assert.equal(f.wire.length,0,"reading geometry never submits input");
 }finally{lab.close("test");}
});

test("Source11 pending bound GRANT survives original 170ms outbox retry tick on the same root QUIC",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture();
 f.win.location={hostname:"localhost",search:"?source11Renewal=1"};
 let resolveBoundGrant;
 const delayedGrant=new Promise(resolve=>{resolveBoundGrant=resolve;});
 f.gameClient.transport.negotiateRespawnTypedChannel=()=>delayedGrant;
 const lab=await activateLoopbackGestureLab(f.options);
 try {
  const renewal=f.gameClient.transport.onGestureRenewalRequired();
  assert.equal(lab.outbox.snapshot.closed,true,"old generation is deliberately retired before GRANT");
  t.mock.timers.tick(170);
  await settleMicrotasks();
  assert.equal(f.closed,false,"pending server-authorized renewal must not kill original root QUIC");
  assert.equal(lab.snapshot.failed,false,"retired old outbox is expected during renewal");
  const newLease=Object.freeze({generation:1});
  resolveBoundGrant(newLease);
  await renewal;
  assert.equal(lab.lease,newLease,"fresh authorized token replaces original generation");
  assert.equal(lab.outbox.snapshot.closed,false,"new current outbox is active");
  t.mock.timers.tick(340);
  await settleMicrotasks();
  assert.equal(f.closed,false,"future retry ticks must preserve successful renewal");
 } finally {
  resolveBoundGrant?.(Object.freeze({generation:999}));
  lab.close("test complete");
 }
});

test("Source11 genuinely rejected bound GRANT still fails closed without replaying old typed edges",async t=>{
 t.mock.timers.enable({apis:["setTimeout","setInterval"]});
 const f=createFixture();
 f.win.location={hostname:"localhost",search:"?source11Renewal=1"};
 let rejectBoundGrant;
 const awaitingGrant=new Promise((_,reject)=>{rejectBoundGrant=reject;});
 f.gameClient.transport.negotiateRespawnTypedChannel=()=>awaitingGrant;
 const lab=await activateLoopbackGestureLab(f.options);
 try {
  const pending=f.gameClient.transport.onGestureRenewalRequired();
  t.mock.timers.tick(170);
  await settleMicrotasks();
  assert.equal(f.closed,false,"old retired generation cannot preempt pending real GRANT");
  rejectBoundGrant(new Error("server rejected current incarnation"));
  await pending;
  assert.equal(f.closed,true,"an actual failed bound negotiation still closes typed gameplay");
  assert.equal(lab.snapshot.failed,true);
  assert.equal(lab.snapshot.closed,true);
  assert.deepEqual(f.wire,[],"retired datagram input cannot be replayed");
 } finally {
  rejectBoundGrant?.(new Error("fixture cleanup"));
  lab.close("test complete");
 }
});
