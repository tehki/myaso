// Core8A P0: one selected 0x11/0x12 typed gesture family, nonrelease.
// This test imports actual existing Core8A typed-outbox and WebTransport
// adapter sources. It does NOT connect typed events to live QUIC or World.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {connectGameTransport} from "../web/network-transport.mjs";
import {connectAuthoritativeClient} from "../web/authoritative-client.mjs";
import {encodeInputPacket, decodeInputPacket} from "../src/network/input-codec.mjs";
import {
  PROPOSED_GESTURE_VERSION, PROPOSED_GESTURE_SOURCE as SOURCE,
  GESTURE_ACTION as ACTION, GESTURE_ACK_STATUS as ACK,
  decodeProposedTypedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {ProposedSharedTypedGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";

function ack({sequence,gestureId,status=ACK.ACCEPTED,serverTick=322}) {
  const b=new Uint8Array(16),v=new DataView(b.buffer);
  v.setUint8(0,2);v.setUint8(1,0x12);v.setUint8(2,status);
  v.setUint32(4,sequence,true);v.setUint32(8,gestureId,true);
  v.setUint32(12,serverTick,true);
  return b;
}
function fakeTransportWithStalledWriter(writes) {
  let resume;
  const stall=new Promise(resolve=>{resume=resolve;});
  const readForever=()=>new Promise(()=>{});
  const reader=()=>({read:readForever,releaseLock(){}});
  const datagramWriter={
    get ready(){return stall;},
    async write(payload){writes.push(new Uint8Array(payload));},
    releaseLock(){},
  };
  const reliableWriter={
    get ready(){return Promise.resolve();},
    async write(){},
    releaseLock(){},
  };
  class MockWebTransport {
    constructor(){
      this.ready=Promise.resolve();
      this.closed=Promise.resolve();
      this.datagrams={writable:{getWriter:()=>datagramWriter},readable:{getReader:reader}};
    }
    async createBidirectionalStream(){
      return {writable:{getWriter:()=>reliableWriter},readable:{getReader:reader}};
    }
    close(){}
  }
  return {MockWebTransport,resume};
}

test("selected dormant 0x11 typed outbox keeps original LMB and KeyE edges when v1 latest-wins loses original attack",async()=>{
  const former=globalThis.WebTransport;
  const writes=[];
  const {MockWebTransport,resume}=fakeTransportWithStalledWriter(writes);
  globalThis.WebTransport=MockWebTransport;
  let transport;
  try {
    transport=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
    assert.equal(transport.kind,"webtransport");
    const lease=Object.freeze({});
    // This private test lease is NOT QUIC principal authentication.
    const outbox=new ProposedSharedTypedGestureOutbox({
      reviewVersion:PROPOSED_GESTURE_VERSION,trustedLease:lease,
      maxPending:8,maxAttempts:2,
    });
    const press=outbox.begin(SOURCE.LMB,1);
    const release=outbox.release(SOURCE.LMB,1);
    const keyDown=outbox.begin(SOURCE.KEY_E,2);
    const keyCancel=outbox.cancel(SOURCE.KEY_E,2);
    assert.deepEqual([press.sequence,release.sequence,keyDown.sequence,keyCancel.sequence],[1,2,3,4]);
    assert.deepEqual([press.gestureId,release.gestureId,keyDown.gestureId,keyCancel.gestureId],[1,1,2,2]);

    const samples=[];
    const pendingDatagrams=[];
    const authored=[];
    for(let tick=1;tick<=5;tick++){
      samples.push({tick,attack:tick===1,moveX:0,moveY:0,facing:0});
      const packet=new Uint8Array(encodeInputPacket({
        sequence:tick-1,clientTick:tick,samples:samples.slice(-3).reverse(),
      }));
      authored.push(packet);
      pendingDatagrams.push(transport.sendRealtimeOwned(packet));
    }
    assert.deepEqual(
      authored.map(packet=>decodeInputPacket(packet).samples.some(s=>s.attack)),
      [true,true,true,false,false],
    );
    resume();
    await Promise.all(pendingDatagrams);
    assert.equal(writes.length,1);
    assert.equal(decodeInputPacket(writes[0]).samples.some(s=>s.attack),false,
      "actual v1 movement path has dropped the unsent original action");

    // The existing selected outbox model is INDEPENDENT of latest-wins movement.
    // It is not a real network send: nextSendBatch returns byte copies only.
    const first=outbox.nextSendBatch(4);
    const decoded=first.map(x=>decodeProposedTypedGestureEvent(x.bytes));
    assert.deepEqual(decoded.map(x=>[x.source,x.action,x.sequence,x.gestureId]),[
      [SOURCE.LMB,ACTION.PRESS,1,1],
      [SOURCE.LMB,ACTION.RELEASE,2,1],
      [SOURCE.KEY_E,ACTION.PRESS,3,2],
      [SOURCE.KEY_E,ACTION.CANCEL,4,2],
    ]);
    assert.deepEqual([...first[0].bytes],[2,0x11,1,0,1,0,0,0,1,0,0,0,1,0,0,0]);
    assert.deepEqual([...first[2].bytes],[2,0x11,1,1,3,0,0,0,2,0,0,0,2,0,0,0]);
    // RETRIES remain byte-exact even after a caller mutates its COPY.
    const preserved=first.map(entry=>[...entry.bytes]);
    first[0].bytes[2]=99;
    const retry=outbox.nextSendBatch(4);
    assert.deepEqual(retry.map(x=>[...x.bytes]),preserved);
    assert.deepEqual(retry.map(x=>x.attempt),[2,2,2,2]);
    assert.throws(()=>outbox.receiveAck(ack(press),Object.freeze({})),/foreign connection/);
    // Authenticated-shape admission ACKs settle transport only, in any order.
    for(const e of [keyCancel,keyDown,release,press]){
      const result=outbox.receiveAck(ack(e),lease);
      assert.equal(result.transportSettled,true);
      assert.equal(result.combatCommitted,false);
    }
    assert.equal(outbox.snapshot.pending,0);
    const duplicate=outbox.receiveAck(ack({...press,status:ACK.DUPLICATE}),lease);
    assert.equal(duplicate.alreadySettled,true);
    assert.equal(duplicate.combatCommitted,false);
    outbox.retire();
    assert.throws(()=>outbox.receiveAck(ack(press),lease),/closed/);
    assert.throws(()=>outbox.begin(SOURCE.LMB,3),/closed/);
  }finally{
    resume();
    transport?.close();
    if(former===undefined)delete globalThis.WebTransport;
    else globalThis.WebTransport=former;
  }
});


function pushableReadStream() {
  const pending=[];
  const waiting=[];
  return {
    reader:{
      read(){
        if(pending.length)return Promise.resolve({value:pending.shift(),done:false});
        return new Promise(resolve=>waiting.push(resolve));
      },
      releaseLock(){},
    },
    push(bytes){
      const value=new Uint8Array(bytes);
      const resolve=waiting.shift();
      if(resolve)resolve({value,done:false});
      else pending.push(value);
    },
  };
}

test("actual selected client QUIC lab handshake, typed datagram sender and same-lease ACK callback join ONE outbox",async()=>{
  const prior=globalThis.WebTransport;
  const realtime=pushableReadStream();
  const reliable=pushableReadStream();
  const writes=[];
  const hello=[];
  let releaseDatagramReady;
  const datagramBackpressure=new Promise(resolve=>{releaseDatagramReady=resolve;});
  class OriginalQuicLabHarness {
    constructor(){
      this.ready=Promise.resolve();
      this.closed=Promise.resolve();
      this.datagrams={
        writable:{getWriter:()=>({
          get ready(){return datagramBackpressure;},
          async write(bytes){writes.push(new Uint8Array(bytes));},
          releaseLock(){},
        })},
        readable:{getReader:()=>realtime.reader},
      };
    }
    async createBidirectionalStream(){
      return {
        writable:{getWriter:()=>({
          get ready(){return Promise.resolve();},
          async write(){},
          releaseLock(){},
        })},
        readable:{getReader:()=>reliable.reader},
      };
    }
    async createUnidirectionalStream(){
      return {getWriter:()=>({
        async write(bytes){hello.push(new Uint8Array(bytes));},
        async close(){
          // The mock stands in for server-side QUIC admission. The original
          // Rust server's actual authenticated World checks are NOT executed.
          reliable.push([4,0,2,0x13,0,0]);
        },
        releaseLock(){},
      })};
    }
    close(){}
  }
  globalThis.WebTransport=OriginalQuicLabHarness;
  let client, outbox;
  const outcomes=[];
  try{
    client=await connectAuthoritativeClient({
      webTransportUrl:"https://127.0.0.1:4433/game",
      onExperimentalGestureAck(bytes, source){
        const outcome=outbox.receiveAck(bytes,source);
        outcomes.push(outcome);
      },
    });
    assert.equal(client.transport.experimentalGestureState,"off");
    assert.throws(()=>client.sendExperimentalGestureEdge(new Uint8Array(16)),
      /current server grant/);
    assert.equal(await client.negotiateExperimentalGestureV2(),true);
    assert.deepEqual(hello.map(b=>[...b]),[[2,0x10,77,89,65,83,79,49]]);
    assert.equal(client.transport.experimentalGestureState,"granted");

    // In THIS harness the connection object stands for the private same-QUIC
    // lease. Production must still bind server-issued actor/boot/incarnation.
    outbox=new ProposedSharedTypedGestureOutbox({
      reviewVersion:2,trustedLease:client.transport,maxPending:8,maxAttempts:2,
    });
    const p=outbox.begin(SOURCE.LMB,12);
    const r=outbox.release(SOURCE.LMB,12);
    const e=outbox.begin(SOURCE.KEY_E,13);
    const c=outbox.cancel(SOURCE.KEY_E,13);
    const batch=outbox.nextSendBatch(4);
    // The SAME physical QUIC writer is backpressured: ordinary 30Hz
    // movement remains latest-wins, but the selected typed edges must retain
    // all four discrete sources in their OWN existing ordered send lane.
    // No v1 combat action is authored for this negotiated typed session.
    for(let tick=1;tick<=5;tick++){
      client.sendInput({tick,moveX:0,moveY:0,facing:0});
    }
    const sends=batch.map(x=>client.sendExperimentalGestureEdge(x.bytes));
    releaseDatagramReady();
    await Promise.all(sends);
    await new Promise(resolve=>setImmediate(resolve));
    const writtenMovement=writes.filter(x=>x[0]===1&&x[1]===1);
    const writtenTyped=writes.filter(x=>x[0]===2&&x[1]===0x11);
    assert.equal(writtenMovement.length,1,
      "v1 continuous movement must remain bounded latest-wins during stall");
    assert.deepEqual(
      decodeInputPacket(writtenMovement[0]).samples.map(x=>x.tick),[5,4,3],
      "the movement-only packet must not resurrect stale movement samples");
    assert.equal(writtenTyped.length,4,
      "the actual original datagram sender must retain all typed edges");
    assert.deepEqual(
      writtenTyped.map(bytes=>decodeProposedTypedGestureEvent(bytes))
        .map(x=>[x.source,x.action,x.sequence,x.gestureId]),
      [
        [SOURCE.LMB,ACTION.PRESS,1,1],
        [SOURCE.LMB,ACTION.RELEASE,2,1],
        [SOURCE.KEY_E,ACTION.PRESS,3,2],
        [SOURCE.KEY_E,ACTION.CANCEL,4,2],
      ],
      "the ORIGINAL selected QUIC sender must preserve typed edge order",
    );
    // Same original client router must pass only the GRANTED transport
    // identity into the existing selected outbox's 0x12 admission handler.
    for(const item of [c,e,r,p])realtime.push(ack(item));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(outcomes.length,4);
    assert.deepEqual(outcomes.map(x=>x.sequence),[4,3,2,1]);
    assert.ok(outcomes.every(x=>x.transportSettled && !x.combatCommitted));
    assert.equal(outbox.snapshot.pending,0);
    realtime.push(ack({...p,status:ACK.DUPLICATE}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(outcomes[4].alreadySettled,true);
    assert.equal(outcomes[4].combatCommitted,false);
    outbox.retire();
    assert.throws(()=>outbox.receiveAck(ack(p),client.transport),/closed/);
    client.close();
    assert.throws(()=>client.sendExperimentalGestureEdge(batch[0].bytes),/current server grant/);
  }finally{
    releaseDatagramReady?.();
    outbox?.retire();
    client?.close();
    if(prior===undefined)delete globalThis.WebTransport;
    else globalThis.WebTransport=prior;
  }
});

test("P0 rapid LMB and KeyE physical edges never spend bounded retry attempts before timer",()=>{
  const lease=Object.freeze({});
  const q=new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:lease,maxPending:8,maxAttempts:3,
  });
  function firstOnly(source,action,sequence) {
    const sent=q.nextSendBatch(4,{onlyUnsent:true});
    assert.deepEqual(sent.map(x=>[x.source,x.action,x.sequence,x.attempt]),[
      [source,action,sequence,1],
    ],"physical DOM event must send one NEW edge and zero old retries");
  }
  const press=q.begin(SOURCE.LMB,8);
  firstOnly(SOURCE.LMB,ACTION.PRESS,press.sequence);
  const release=q.release(SOURCE.LMB,8);
  firstOnly(SOURCE.LMB,ACTION.RELEASE,release.sequence);
  const keyPress=q.begin(SOURCE.KEY_E,9);
  firstOnly(SOURCE.KEY_E,ACTION.PRESS,keyPress.sequence);
  const keyCancel=q.cancel(SOURCE.KEY_E,9);
  firstOnly(SOURCE.KEY_E,ACTION.CANCEL,keyCancel.sequence);
  // Duplicated physical DOM notifications produce neither a new typed packet
  // nor a retry; congestion cannot instantly exhaust 3 attempts.
  assert.deepEqual(q.nextSendBatch(4,{onlyUnsent:true}),[]);
  assert.deepEqual(q.nextSendBatch(4,{onlyUnsent:true}),[]);
  assert.equal(q.snapshot.pending,4);
  assert.equal(q.snapshot.closed,false);

  // The one existing periodic retransmission mechanism remains bounded.
  assert.deepEqual(q.nextSendBatch(4).map(x=>x.attempt),[2,2,2,2]);
  assert.deepEqual(q.nextSendBatch(4).map(x=>x.attempt),[3,3,3,3]);
  assert.throws(()=>q.nextSendBatch(4),/retransmission attempts exhausted/);
  assert.equal(q.snapshot.closed,true);

  // The actual default-OFF game loopback adapter routes newly authored DOM
  // notifications into ONLY the new-edge path; the 170ms timer owns retries.
  const ui=readFileSync(new URL("../web/prealpha-gesture-live-lab.mjs",import.meta.url),"utf8");
  assert.match(ui,/function drain\(onlyUnsent = false\)/);
  assert.match(ui,/outbox\.nextSendBatch\(4, \{onlyUnsent\}\)/);
  assert.match(ui,/drain\(true\); \/\/ native capture/);
  assert.match(ui,/setInterval\(\(\) => \{[\s\S]*?outbox\.snapshot\.pending > 0\) drain\(\);[\s\S]*?\},170\)/);
});

test("one typed queue reserves terminal for a valid LMB while declining concurrent KeyE at cap",()=>{
  const lease=Object.freeze({});
  const q=new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:lease,maxPending:4,maxAttempts:1,
  });
  const p=q.begin(SOURCE.LMB,7);
  assert.throws(()=>q.begin(SOURCE.KEY_E,7),/terminal capacity/);
  assert.deepEqual(q.snapshot.activeSources,[SOURCE.LMB]);
  const u=q.upgrade(8),c=q.cancel(SOURCE.LMB,8);
  assert.deepEqual([p.sequence,u.sequence,c.sequence],[1,2,3]);
  assert.deepEqual(q.nextSendBatch(3).map(x=>x.action),
    [ACTION.PRESS,ACTION.UPGRADE,ACTION.CANCEL]);
  assert.throws(()=>q.nextSendBatch(3),/retransmission attempts exhausted/);
  assert.equal(q.snapshot.closed,true);
});

test("v2 remains explicitly default-off and loopback-only in original Rust QUIC ingress",()=>{
  const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  // The original server DOES import the v2 codec for its opt-in lab. An
  // absent-import assertion would be false and would hide this real control.
  assert.doesNotMatch(browser,/prealpha-lmb-gesture-outbox-proposal/);
  assert.match(server,/env::var\("MYASO_EXPERIMENTAL_GESTURE_V2"\)/);
  assert.match(server,/Ok\("0"\) \| Err\(_\) => false/);
  assert.match(server,/if v2_lab && !bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(server,/negotiation = connection\.accept_uni\(\), if v2_lab && !v2_enabled/);
});
