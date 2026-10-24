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

test("selected typed outbox preserves LMB but denies Key E Combat events under v1 congestion",async()=>{
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
    assert.throws(()=>outbox.begin(SOURCE.KEY_E,2),/Combat permits only/);
    assert.deepEqual([press.sequence,release.sequence],[1,2]);
    assert.deepEqual([press.gestureId,release.gestureId],[1,1]);

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
    ]);
    assert.deepEqual([...first[0].bytes],[2,0x11,1,0,1,0,0,0,1,0,0,0,1,0,0,0]);
    // RETRIES remain byte-exact even after a caller mutates its COPY.
    const preserved=first.map(entry=>[...entry.bytes]);
    first[0].bytes[2]=99;
    const retry=outbox.nextSendBatch(4);
    assert.deepEqual(retry.map(x=>[...x.bytes]),preserved);
    assert.deepEqual(retry.map(x=>x.attempt),[2,2]);
    assert.throws(()=>outbox.receiveAck(ack(press),Object.freeze({})),/foreign connection/);
    // Authenticated-shape admission ACKs settle transport only, in any order.
    for(const e of [release,press]){
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
    assert.throws(()=>outbox.begin(SOURCE.KEY_E,13),/Combat permits only/);
    const batch=outbox.nextSendBatch(4);
    // The SAME physical QUIC writer is backpressured: ordinary 30Hz
    // movement remains latest-wins, but the selected LMB edges must survive
    // on the ONE existing ordered typed send lane; Key E is not Combat.
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
    assert.equal(writtenTyped.length,2,
      "the actual original datagram sender must retain all typed edges");
    assert.deepEqual(
      writtenTyped.map(bytes=>decodeProposedTypedGestureEvent(bytes))
        .map(x=>[x.source,x.action,x.sequence,x.gestureId]),
      [
        [SOURCE.LMB,ACTION.PRESS,1,1],
        [SOURCE.LMB,ACTION.RELEASE,2,1],
      ],
      "the ORIGINAL selected QUIC sender must preserve typed edge order",
    );
    // Same original client router must pass only the GRANTED transport
    // identity into the existing selected outbox's 0x12 admission handler.
    for(const item of [r,p])realtime.push(ack(item));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(outcomes.length,2);
    assert.deepEqual(outcomes.map(x=>x.sequence),[2,1]);
    assert.ok(outcomes.every(x=>x.transportSettled && !x.combatCommitted));
    assert.equal(outbox.snapshot.pending,0);
    realtime.push(ack({...p,status:ACK.DUPLICATE}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(outcomes[2].alreadySettled,true);
    assert.equal(outcomes[2].combatCommitted,false);
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

test("P0 queued original typed datagrams are retired on disconnect, never flushed or ACKed into the new lease",async()=>{
  const previous=globalThis.WebTransport;
  const peers=[];
  class MockQuicLease {
    constructor(){
      this.ready=Promise.resolve();
      this.closed=Promise.resolve();
      this.realtime=pushableReadStream();
      this.reliable=pushableReadStream();
      this.writes=[];
      this.hello=[];
      this.isFirst=peers.length===0;
      if(this.isFirst) {
        this.waitForWriter=new Promise(resolve=>{this.releaseWriter=resolve;});
      } else this.waitForWriter=Promise.resolve();
      this.datagrams={
        writable:{getWriter:()=>({
          get ready(){return peers.find(p=>p===holder).waitForWriter;},
          async write(bytes){holder.writes.push(new Uint8Array(bytes));},
          releaseLock(){},
        })},
        readable:{getReader:()=>this.realtime.reader},
      };
      // The writer must stay owned by the transport that constructed it.
      const holder=this;
      peers.push(this);
    }
    async createBidirectionalStream(){
      return {
        writable:{getWriter:()=>({
          get ready(){return Promise.resolve();},
          async write(){},
          releaseLock(){},
        })},
        readable:{getReader:()=>this.reliable.reader},
      };
    }
    async createUnidirectionalStream(){
      const self=this;
      return {getWriter:()=>({
        async write(bytes){self.hello.push(new Uint8Array(bytes));},
        async close(){self.reliable.push([4,0,2,0x13,0,0]);},
        releaseLock(){},
      })};
    }
    close(){}
  }
  globalThis.WebTransport=MockQuicLease;
  let oldClient,newClient,oldOutbox,newOutbox;
  const oldReceipts=[],newReceipts=[];
  try{
    oldClient=await connectAuthoritativeClient({
      webTransportUrl:"https://127.0.0.1:4433/game",
      onExperimentalGestureAck(bytes,lease){
        oldReceipts.push(oldOutbox.receiveAck(bytes,lease));
      },
    });
    assert.equal(await oldClient.negotiateExperimentalGestureV2(),true);
    const oldLease=oldClient.transport;
    oldOutbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:oldLease});
    const press=oldOutbox.begin(SOURCE.LMB,1);
    const release=oldOutbox.release(SOURCE.LMB,1);
    const outgoing=oldOutbox.nextSendBatch(4,{onlyUnsent:true});
    assert.deepEqual(outgoing.map(x=>x.attempt),[1,1]);
    // The real transport's datagram writer is STILL blocked: both edges are
    // only queued in the original connection-owned async write promise chain.
    const oldDelivery=Promise.allSettled(
      outgoing.map(x=>oldClient.sendExperimentalGestureEdge(x.bytes)));
    await Promise.resolve();
    assert.equal(peers[0].writes.length,0);
    oldOutbox.retire();
    oldClient.close();
    peers[0].releaseWriter();
    const outcomes=await oldDelivery;
    assert.ok(outcomes.every(x=>x.status==="rejected"),
      "old connection writes must fail closed, never complete after retirement");
    assert.equal(peers[0].writes.length,0,
      "not one queued gesture may flush after old lease retirement");

    newClient=await connectAuthoritativeClient({
      webTransportUrl:"https://127.0.0.1:4433/game",
      onExperimentalGestureAck(bytes,lease){
        newReceipts.push(newOutbox.receiveAck(bytes,lease));
      },
    });
    assert.equal(await newClient.negotiateExperimentalGestureV2(),true);
    newOutbox=new ProposedSharedTypedGestureOutbox({
      reviewVersion:2,trustedLease:newClient.transport,
    });
    const fresh=newOutbox.begin(SOURCE.LMB,2);
    assert.equal(fresh.sequence,press.sequence);
    assert.equal(fresh.gestureId,press.gestureId);
    assert.throws(()=>newOutbox.receiveAck(ack(press),oldLease),/foreign connection/);
    assert.equal(newOutbox.snapshot.pending,1);

    // Late old-connection 0x12 packets cannot be remapped to the fresh actor
    // merely because the new lease reused the same numeric sequence+gesture.
    peers[0].realtime.push(ack(press));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(newReceipts.length,0);
    assert.equal(newOutbox.snapshot.pending,1);
    assert.equal(oldReceipts.length,0);

    await newClient.sendExperimentalGestureEdge(newOutbox.nextSendBatch(4,{onlyUnsent:true})[0].bytes);
    assert.equal(peers[1].writes.length,1);
    peers[1].realtime.push(ack(fresh));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(newReceipts.length,1);
    assert.equal(newReceipts[0].combatCommitted,false);
    assert.equal(newOutbox.snapshot.pending,0);
    assert.equal(peers[0].writes.length,0);
    assert.deepEqual(peers[1].hello.map(b=>[...b]),[[2,0x10,77,89,65,83,79,49]]);
  }finally{
    peers[0]?.releaseWriter?.();
    oldOutbox?.retire();
    newOutbox?.retire();
    oldClient?.close();
    newClient?.close();
    if(previous===undefined)delete globalThis.WebTransport;
    else globalThis.WebTransport=previous;
  }
});

test("one typed queue reserves terminal for a valid LMB while declining concurrent KeyE at cap",()=>{
  const lease=Object.freeze({});
  const q=new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:lease,maxPending:4,maxAttempts:1,
  });
  const p=q.begin(SOURCE.LMB,7);
  assert.throws(()=>q.begin(SOURCE.KEY_E,7),/Combat permits only/);
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
