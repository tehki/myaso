import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../../../src/combat/model.mjs';
import { NETWORK } from '../../../src/network/constants.mjs';
import { createOriginalRustCombatInput } from '../src/input/original-rust-combat-input.mjs';
import { connectDevRustActors } from '../src/network/dev-rust-session.js';

class Target {
  #listeners = new Map();
  addEventListener(type, handler) {
    const list = this.#listeners.get(type) || [];
    list.push(handler);
    this.#listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    const list = this.#listeners.get(type) || [];
    this.#listeners.set(type, list.filter(fn => fn !== handler));
  }
  emit(type, properties = {}) {
    const event = { type, isTrusted: true, cancelable: true,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      target: this, ...properties };
    for (const fn of [...(this.#listeners.get(type) || [])]) {
      if (event.stopped) break;
      fn(event);
    }
    return event;
  }
}

function fixture(config = {}) {
  let time = 0, timer, deactivated = false;
  const canvas = new Target(), doc = new Target(), win = new Target();
  canvas.focus = () => { doc.activeElement = canvas; };
  canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 960, height: 540});
  canvas.tabIndex = -1;
  doc.activeElement = canvas; doc.hidden = false;
  win.location = { hostname: 'localhost', href: 'http://localhost:4174/?rust=1&combatInput=1' };
  const sent = [], status = [], hits = [];
  const transport = {kind: 'webtransport', closed: false, webTransportUrl: 'https://localhost:8443/game'};
  const client = {
    transport, state: new Map(), playerNetId: null,
    sendInput(input) { sent.push(input); },
    close(reason) { this.closeReason = reason; transport.closed = true; },
  };
  const input = createOriginalRustCombatInput({
    canvas, windowObj: win, documentObj: doc,
    getClient: () => client,
    now: () => time,
    setIntervalFn(fn, delay) {
      assert.equal(delay, 1000 / NETWORK.inputSendHz);
      timer = fn; return 1;
    },
    clearIntervalFn() { deactivated = true; },
    onStatus: message => status.push(message),
    onHitReceipt: (receipt, presentation) => hits.push({receipt, presentation}),
    ...config
  });
  return {canvas, doc, win, client, transport, sent, status, hits, input,
    setTime(t) {time = t;}, cycle() {timer();},
    get deactivated() { return deactivated; }};
}

test('original server timing constants are untouched by UI10 input projection',()=>{
  assert.equal(COMBAT.attack.windupMs,135);
  assert.equal(COMBAT.heavyAttack.windupMs,320);
  assert.equal(COMBAT.block.shortBlockMs,240);
  assert.equal(NETWORK.inputSendHz,60);
});

test('real W3C keys, wheel and RMB use ONLY original Rust v1 writer, never v1 Light/Heavy', () => {
  const f=fixture();
  assert.equal(f.canvas.tabIndex, 0);
  f.canvas.emit('keydown',{code:'KeyD', repeat:false, isTrusted:false});
  f.canvas.emit('wheel',{deltaY:-120, isTrusted:false});
  f.canvas.emit('pointerdown',{button:0, pointerId:1});
  assert.equal(f.sent.length,0,'synthetic DOM and physical LMB do not create v1 attack');
  f.canvas.emit('keydown',{code:'KeyD',repeat:false});
  assert.equal(f.sent.at(-1).moveX,1);
  f.canvas.emit('keydown',{code:'Space',repeat:false});
  assert.equal(f.sent.at(-1).jump,true);
  assert.equal(f.sent.at(-1).attack,false);
  assert.equal(f.sent.at(-1).heavyAttack,false);
  f.win.emit('keyup',{code:'Space'});
  f.canvas.emit('wheel',{deltaY:-120});
  assert.equal(f.sent.at(-1).dodge,true);
  f.canvas.emit('wheel',{deltaY:120});
  assert.equal(f.sent.at(-1).block,true);
  f.setTime(COMBAT.block.shortBlockMs-1);f.cycle();
  assert.equal(f.sent.at(-1).block,true);
  f.setTime(COMBAT.block.shortBlockMs);f.cycle();
  assert.equal(f.sent.at(-1).block,false);
  f.canvas.emit('pointerdown',{button:2,pointerId:8});
  f.setTime(COMBAT.block.shortBlockMs+60);
  f.win.emit('pointerup',{button:2,pointerId:8});
  assert.equal(f.sent.at(-1).kick,true);
  f.win.emit('keyup',{code:'KeyD'});
  assert.equal(f.sent.at(-1).moveX,0);
  assert.deepEqual(f.sent.map(x=>x.tick),f.sent.map((_,i)=>i),
    'one original monotonically increasing client tick, no second Combat writer');
  assert.ok(f.sent.every(x=>!x.attack&&!x.heavyAttack));
  f.input.stop();
  assert.equal(f.deactivated,true);
});

test('UI10 captures fake left pointer/mouse events BEFORE original typed gate',()=>{
  const f=fixture(),typed=[];
  f.canvas.addEventListener('pointerdown',e=>typed.push(e.type),true);
  f.canvas.addEventListener('mousedown',e=>typed.push(e.type),true);
  f.win.addEventListener('pointerup',e=>typed.push(e.type),true);
  f.canvas.emit('pointerdown',{button:0,isTrusted:false});
  f.canvas.emit('mousedown',{button:0,buttons:3,isTrusted:false});
  f.win.emit('pointerup',{button:0,isTrusted:false});
  assert.deepEqual(typed,[],'script-dispatched LMB cannot reach original typed owner');
  f.canvas.emit('pointerdown',{button:0,pointerId:1});
  f.canvas.emit('mousedown',{button:0,buttons:3});
  f.win.emit('pointerup',{button:0,pointerId:1});
  assert.deepEqual(typed,['pointerdown','mousedown','pointerup']);
  assert.equal(f.sent.length,0,'no second v1 LMB writer');
  const textInput={closest:()=>null,matches:selector=>selector.includes('input')};
  f.doc.activeElement=textInput;
  f.canvas.emit('pointerdown',{button:0,pointerId:2});
  assert.deepEqual(typed,['pointerdown','mousedown','pointerup'],
    'first real LMB while text editing restores focus, without a typed PRESS');
  assert.equal(f.doc.activeElement,f.canvas);
  f.input.stop();
});

test('physical pointer aiming is bounded to original inputSendHz and never deals damage',()=>{
  const f=fixture();
  f.canvas.emit('pointermove',{clientX:960,clientY:270});
  f.canvas.emit('pointermove',{clientX:960,clientY:270});
  assert.equal(f.sent.length,1,'physical aim cannot exceed one send per 60Hz budget');
  f.setTime(1000 / NETWORK.inputSendHz);
  f.canvas.emit('pointermove',{clientX:480,clientY:0});
  assert.equal(f.sent.length,2);
  assert.ok(f.sent.every(v=>v.attack===false&&v.heavyAttack===false));
  f.input.stop();
});

test('physical Chat focus, canvas blur and hidden page cancel held original input', () => {
  const f=fixture();
  f.canvas.emit('keydown',{code:'KeyW'});
  assert.equal(f.sent.at(-1).moveY,-1);
  f.doc.activeElement={closest:()=>({}),matches:()=>false};
  f.doc.emit('focusin');
  assert.equal(f.sent.at(-1).moveY,0);
  const count=f.sent.length;
  f.canvas.emit('keydown',{code:'Space'});
  f.canvas.emit('wheel',{deltaY:120});
  f.cycle();
  assert.equal(f.sent.length,count,'chat focus never submits gameplay');
  f.doc.activeElement=f.canvas;
  f.canvas.emit('keydown',{code:'KeyA'});
  assert.equal(f.sent.at(-1).moveX,-1);
  f.doc.hidden=true;
  f.doc.emit('visibilitychange');
  assert.equal(f.sent.at(-1).moveX,0);
  f.input.stop();
});

test('first physical click after Chat changes focus but never sends a gameplay packet',()=>{
  const f=fixture();
  f.doc.activeElement={closest:()=>({}),matches:()=>false};
  f.canvas.emit('pointerdown',{button:2,pointerId:7});
  assert.equal(f.doc.activeElement,f.canvas);
  f.setTime(40);
  f.win.emit('pointerup',{button:2,pointerId:7});
  assert.equal(f.sent.length,0,'focus-return click never becomes a kick');
  f.canvas.emit('keydown',{code:'KeyW'});
  assert.equal(f.sent.at(-1).moveY,-1);
  f.input.stop();
});

test('transport retirement detaches original UI10 input without fallback',()=>{
  const f=fixture();
  f.canvas.emit('keydown',{code:'KeyA'});
  const count=f.sent.length;
  f.transport.closed=true;
  f.cycle();
  assert.equal(f.deactivated,true);
  f.canvas.emit('keydown',{code:'Space'});
  assert.equal(f.sent.length,count,'retired QUIC cannot admit v1 or typed');
  f.input.stop();
});

test('original typed LMB requires actual server NetID+snapshot, one lease and fail-closed ACK',async()=>{
  const grants=[],receipts=[];
  const f=fixture({activateTyped:async options=>{
    grants.push(options);
    return {lease:f.transport,
      outbox:{receiveAck(bytes,lease){
        receipts.push({bytes,lease}); return {transportSettled:true};
      }},
      noteAck(){},close(reason){f.closedLab=reason;},fail(reason){f.failedLab=reason;}};
  }});
  assert.equal(await f.input.maybeBindActor(),false);
  f.client.playerNetId=4;
  assert.equal(await f.input.maybeBindActor(),false,'ACK alone is not original World actor');
  f.client.state.set(4,{netId:4,action:15,x:4140,y:4105,hp:100,stamina:86});
  assert.equal(await f.input.maybeBindActor(),true);
  assert.equal(await f.input.maybeBindActor(),false,'no duplicate owner');
  assert.equal(grants.length,1);
  assert.equal(grants[0].gameClient,f.client);
  assert.equal(grants[0].enableJumpAttackReview,true);
  assert.equal(grants[0].isJumpAttackChord(),true,'original World jump action drives typed chord');
  f.input.receiveTypedAck(new Uint8Array([2]),f.transport);
  assert.equal(receipts.length,1);
  assert.throws(()=>f.input.receiveTypedAck(new Uint8Array([2]),{}),/typed ACK without current/);
  assert.equal(f.transport.closed,true,'foreign ACK closes original QUIC');
});

test('server NetID changes under active typed lease fail closed, never reuse the outbox',async()=>{
  const f=fixture({activateTyped:async()=>({
    lease:f.transport,outbox:{},noteAck(){},
    close(reason){f.closedLab=reason;},fail(){}
  })});
  f.client.playerNetId=5;
  f.client.state.set(5,{netId:5,action:0,hp:100});
  assert.equal(await f.input.maybeBindActor(),true);
  f.client.playerNetId=6;
  f.client.state.set(6,{netId:6,action:0,hp:100});
  assert.equal(await f.input.maybeBindActor(),false);
  assert.equal(f.transport.closed,true);
  assert.match(f.client.closeReason,/identity changed under active typed lease/);
});

test('optional original M147 HIT receipts are exclusively server-granted, never HP diffs',async()=>{
  let grantOptions,grantCount=0;
  const f=fixture({enablePrivateHit:true,activateTyped:async()=>({
    lease:{},outbox:{},noteAck(){},close(){},fail(){}
  })});
  f.client.transport.negotiatePrivateHitDeliveryLab=async options=>{
    grantOptions=options;grantCount++;return {close(){}};
  };
  f.client.playerNetId=3;
  f.client.state.set(3,{netId:3,hp:66,stamina:74,action:18});
  assert.equal(f.hits.length,0,'a snapshot HP change cannot fabricate HIT receipt');
  assert.equal(await f.input.maybeBindActor(),true);
  assert.equal(grantCount,1);
  assert.equal(grantOptions.actorId,3);
  assert.equal(grantOptions.pageUrl,f.win.location.href);
  grantOptions.onReceipt({sequence:7,damage:34},{kind:'hit',text:'Opponent hit - 34 HP.'});
  assert.equal(f.hits.length,1);
  assert.equal(f.hits[0].receipt.damage,34);
  f.input.stop();
  grantOptions.onReceipt({sequence:8,damage:46},{kind:'hit',text:'Opponent hit - 46 HP.'});
  assert.equal(f.hits.length,1,'retired original QUIC cannot deliver a HIT cue');
});

test('opt-in UI10 adapter is bound to one original client and verified snapshots',async()=>{
  const statuses=[],poses=[],calls=[];
  const canvas=new Target(),doc=new Target(),win=new Target();
  let onWire,actorId=null,transportClosed=null;
  const state=new Map();
  const result=await connectDevRustActors({
    app:{},pc:{},canvas,windowObj:win,documentObj:doc,
    url:'https://localhost:8443/game',sha256:'ac'.repeat(32),
    enableCombatInput:true,onStatus:msg=>statuses.push(msg),
    onCombatPose:p=>poses.push(p),
    createLayer:()=>({reconcile(m){return {count:m.size};},destroy(){calls.push('destroy');}}),
    createCombatInput:options=>({
      maybeBindActor(){calls.push('bind');return false;},
      receiveTypedAck(bytes,lease){calls.push(['ack',bytes,lease]);},
      stop(){calls.push('stop');}
    }),
    connect:async opts=>{
      onWire=opts;
      return {transport:{kind:'webtransport'}, state,
        get playerNetId(){return actorId;},
        close(reason){transportClosed=reason;}
      };
    }
  });
  assert.equal(result.combatInput!==null,true);
  assert.equal(onWire.sendInput,undefined,'never introduce alternative packet sender');
  assert.equal(poses.length,0);
  onWire.onProcessedAck({playerNetId:9});
  actorId=9;
  state.set(9,{netId:9,x:4140,y:4105,action:18,serverTick:47,
    hp:66,guard:80,stamina:74});
  onWire.onSnapshot({serverTick:47,full:true},state);
  assert.equal(poses[0].hp,66);
  assert.equal(poses[0].stamina,74);
  assert.equal(poses[0].recoveryCue,'jump-attack-recovery');
  onWire.onExperimentalGestureAck(Uint8Array.of(2),{generation:1});
  assert.equal(calls.filter(c=>Array.isArray(c)&&c[0]==='ack').length,1);
  result.close();
  assert.ok(calls.includes('stop'));
  assert.equal(transportClosed,'PlayCanvas original Rust Combat client closed');
});
