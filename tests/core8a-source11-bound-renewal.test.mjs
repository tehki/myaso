import test from "node:test";
import assert from "node:assert/strict";
import {connectGameTransport} from "../web/network-transport.mjs";
import {connectAuthoritativeClient} from "../web/authoritative-client.mjs";
import {encodeProposedTypedGestureEvent} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const frame = bytes=>Uint8Array.from([bytes.length,0,...bytes]);
const hello = Uint8Array.from([2,0x10,77,89,65,83,79,49]);
const event = (sequence=1,gestureId=1)=>new Uint8Array(encodeProposedTypedGestureEvent({
  source:0,action:1,sequence,gestureId,clientTick:100,
}));
async function eventually(predicate) {
  for(let i=0;i<50;i++) {
    if(predicate()) return;
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  assert.fail("bounded Source11 negotiation or receipt never arrived");
}

class BoundQuic {
  static sessions = [];
  constructor(url) {
    this.url=url;
    this.closedByClient=false;
    this.bidiOpened=0;
    this.uniOpened=0;
    this.datagramWrites=[];
    this.boundWrites=[];
    this.boundSources=[];
    this.ready=Promise.resolve();
    this.closed=new Promise(resolve=>this.resolveClosed=resolve);
    this.datagrams={
      writable:{getWriter:()=>({
        ready:Promise.resolve(),
        write:async bytes=>{this.datagramWrites.push(Uint8Array.from(bytes));},
        releaseLock(){}
      })},
      readable:new ReadableStream({start:ctrl=>this.datagramSource=ctrl}),
    };
    BoundQuic.sessions.push(this);
  }
  async createBidirectionalStream() {
    this.bidiOpened++;
    if(this.bidiOpened===1){
      const readable=new ReadableStream({start:ctrl=>this.rootSource=ctrl});
      const writable=new WritableStream({write:async bytes=>{
        if(bytes.length===10 && bytes[0]===8 && bytes.subarray(2).every((b,i)=>b===hello[i]))
          queueMicrotask(()=>this.rootSource.enqueue(frame([2,0x13,0,0])));
      }});
      return {readable,writable};
    }
    let boundSource;
    const readable=new ReadableStream({start:ctrl=>{boundSource=ctrl;this.boundSource=ctrl;this.boundSources.push(ctrl);}});
    const writable=new WritableStream({write:async bytes=>{
      const body=Uint8Array.from(bytes);this.boundWrites.push(body);
      if(body.length===8 && body.every((b,i)=>b===hello[i])) {
        queueMicrotask(()=>boundSource.enqueue(frame([2,0x13,0,0])));
      } else if(body.length===18 && body[0]===16 && body[1]===0) {
        const ack=body.slice(2);ack[1]=0x12;ack[2]=1;
        queueMicrotask(()=>boundSource.enqueue(frame(ack)));
      }
    }});
    return {readable,writable};
  }
  close(){
    if(this.closedByClient)return;
    this.closedByClient=true;
    this.resolveClosed();
    for(const stream of [this.datagramSource,this.rootSource,...this.boundSources]){
      try {stream?.close();} catch {}
    }
  }
}
async function fixture(fn) {
  const prev=globalThis.WebTransport;globalThis.WebTransport=BoundQuic;
  try{await fn();}finally{
    for(const x of BoundQuic.sessions)x.close();
    BoundQuic.sessions=[];
    if(prev===undefined) delete globalThis.WebTransport;
    else globalThis.WebTransport=prev;
  }
}

test("Source11 server-owned root hint opens one fresh bidi; event AND ACK bind to distinct JS lease",()=>fixture(async()=>{
  const conn=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await conn.negotiateExperimentalGestureV2({reliableStream:true});
  const old=conn.typedLeaseToken, ack=[];
  let renewal=null;
  conn.onBoundGestureAck=(bytes,lease)=>ack.push({bytes,lease});
  conn.onGestureRenewalRequired=async()=>{renewal=await conn.negotiateRespawnTypedChannel();};
  conn.transport.rootSource.enqueue(frame([2,0x14,0,0]));
  await eventually(()=>renewal!==null);
  assert.notEqual(renewal,old,"new incarnation requires distinct JS ownership token");
  assert.equal(conn.typedGeneration,1);
  assert.equal(conn.transport.bidiOpened,2,"root remains separate from NEW typed bidi");
  assert.equal(conn.transport.uniOpened,0,"Chat C1 remains sole uni stream owner");
  assert.throws(()=>conn.sendExperimentalGestureEdge(event(),old),/grant|generation/);
  await conn.sendExperimentalGestureEdge(event(),renewal);
  await eventually(()=>ack.length===1);
  assert.equal(ack[0].lease,renewal);
  assert.equal(ack[0].bytes[1],0x12);
  assert.equal(ack[0].bytes[2],1);
  assert.equal(conn.transport.datagramWrites.length,0,"new 16byte typed event cannot use old DATAGRAM");
  assert.equal(conn.transport.boundWrites.length,2);
  assert.equal(conn.transport.boundWrites[1].length,18);
  assert.equal(conn.closed,false);
  conn.close();
}));

test("Source11 late DATAGRAM ACK is retired rather than routed to freshly bound bidi",()=>fixture(async()=>{
  const acks=[];
  const client=await connectAuthoritativeClient({
    webTransportUrl:"https://127.0.0.1:4433/game",
    onExperimentalGestureAck:(bytes,lease)=>acks.push({bytes,lease}),
  });
  await client.negotiateExperimentalGestureV2({reliableStream:true});
  let lease=null;
  client.transport.onGestureRenewalRequired=async()=>{
    lease=await client.transport.negotiateRespawnTypedChannel();
  };
  client.transport.transport.rootSource.enqueue(frame([2,0x14,0,0]));
  await eventually(()=>lease!==null);
  const oldAck=event();oldAck[1]=0x12;oldAck[2]=1;
  client.transport.transport.datagramSource.enqueue(oldAck);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(acks,[],"stale old-generation ACK cannot match new sequence=1");
  await client.sendExperimentalGestureEdge(event(),lease);
  await eventually(()=>acks.length===1);
  assert.equal(acks[0].lease,lease,"ACK capture is from new stream, not root datagram");
  assert.equal(client.transport.closed,false);
  client.close("test complete");
}));

test("Source11 original unsent generation cannot close the newly renewed lease",()=>fixture(async()=>{
  const c=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await c.negotiateExperimentalGestureV2({reliableStream:true});
  const old=c.typedLeaseToken;
  let unblock;
  c.datagramWriter.ready=new Promise(resolve=>unblock=resolve);
  const stale=c.sendExperimentalGestureEdge(event(),old);
  c.onGestureRenewalRequired=()=>{};
  const fresh=await c.negotiateRespawnTypedChannel();
  unblock();
  await assert.rejects(stale,/generation/);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(c.closed,false,"retired write rejection must not close valid new QUIC session");
  assert.equal(c.pendingGestureEdges,0);
  await c.sendExperimentalGestureEdge(event(),fresh);
  assert.equal(c.transport.boundWrites.length,2);
  assert.equal(c.transport.datagramWrites.length,0);
  c.close("test complete");
}));

test("Source11 second incarnation keeps 3 distinct leases; old bidi and datagram ACK cannot settle new matching IDs",()=>fixture(async()=>{
  const acks=[];
  const client=await connectAuthoritativeClient({
    webTransportUrl:"https://127.0.0.1:4433/game",
    onExperimentalGestureAck:(bytes,lease)=>acks.push({bytes,lease}),
  });
  await client.negotiateExperimentalGestureV2({reliableStream:true});
  const quic=client.transport.transport;
  const root=client.transport.typedLeaseToken;
  const generations=[];
  client.transport.onGestureRenewalRequired=async()=>{
    generations.push(await client.transport.negotiateRespawnTypedChannel());
  };
  quic.rootSource.enqueue(frame([2,0x14,0,0]));
  await eventually(()=>generations.length===1);
  const first=generations[0];
  await client.sendExperimentalGestureEdge(event(1,1),first);
  await eventually(()=>acks.length===1);
  assert.equal(acks[0].lease,first);
  quic.rootSource.enqueue(frame([2,0x14,0,0]));
  await eventually(()=>generations.length===2);
  const second=generations[1];
  assert.notEqual(second,first);
  assert.notEqual(second,root);
  assert.equal(client.transport.typedGeneration,2);
  assert.equal(quic.bidiOpened,3,"one immutable root and one bound bidi per authoritative incarnation");
  assert.equal(quic.uniOpened,0,"no Chat C1 uni stream interception");

  // Collision: historical status=ACCEPTED seq1/gesture1 from the *prior*
  // bound QUIC stream must not be delivered to the new pending outbox.
  // DATAGRAM ACK is also permanently rooted in old generation.
  const oldAck=event(1,1);oldAck[1]=0x12;oldAck[2]=1;
  quic.boundSources[0].enqueue(frame(oldAck));
  quic.datagramSource.enqueue(oldAck);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(acks.length,1,"neither old bidi nor datagram ACK can settle generation2");
  assert.throws(
    ()=>client.sendExperimentalGestureEdge(event(1,1),first),
    /grant|generation/,"old generation cannot write to new stream");
  await client.sendExperimentalGestureEdge(event(1,1),second);
  await eventually(()=>acks.length===2);
  assert.equal(acks[1].lease,second,"new ACK must originate on new generation's own bidi");
  assert.equal(quic.datagramWrites.length,0,"new Combat never falls back to legacy typed datagrams");
  assert.equal(client.transport.closed,false,"valid new incarnation survives old ACK replays");
  client.close("complete two generations");
}));

// The handshake timeout is a total startup bound, not only a grant-receipt
// timer. An indefinitely backpressured QUIC OPEN or HELLO must not strand
// the player's typed producer or keep its old generation active.
async function boundedAttempt(promise) {
  let guard;
  try {
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{guard=setTimeout(()=>reject(
        new Error("Source11 handshake improperly exceeded total startup deadline")
      ),400);}),
    ]);
  } finally { clearTimeout(guard); }
}

test("Source11 fresh bidi OPEN is bounded before any HELLO/GRANT, with no fabricated fresh lease",()=>fixture(async()=>{
  const conn=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await conn.negotiateExperimentalGestureV2({reliableStream:true});
  conn.onGestureRenewalRequired=()=>{};
  let finishLateOpen,aborted=false,cancelled=false;
  conn.transport.createBidirectionalStream=()=>new Promise(resolve=>{finishLateOpen=resolve;});
  await assert.rejects(boundedAttempt(conn.negotiateRespawnTypedChannel({timeoutMs:100})),/bound.*timeout/i);
  // WebTransport may finish opening AFTER cancellation of the caller.
  // This late resource must be reset and must never acquire a new JS lease.
  finishLateOpen({
    writable:{getWriter:()=>({abort:()=>{aborted=true;return Promise.resolve();}})},
    readable:{cancel:()=>{cancelled=true;return Promise.resolve();}},
  });
  await eventually(()=>aborted&&cancelled);
  assert.equal(conn.typedGeneration,0);
  assert.equal(conn.typedLeaseToken,conn);
  assert.equal(conn.closed,false,"failed optional stream must not imply successful grant");
  conn.close();
}));

test("Source11 blocked HELLO write is bounded and aborted, not treated as bound GRANT",()=>fixture(async()=>{
  const conn=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await conn.negotiateExperimentalGestureV2({reliableStream:true});
  conn.onGestureRenewalRequired=()=>{};
  let aborted=false;
  const original=conn.transport.createBidirectionalStream.bind(conn.transport);
  conn.transport.createBidirectionalStream=async()=>{
    const stream=await original();
    return {
      readable:stream.readable,
      writable:{getWriter:()=>({
        ready:Promise.resolve(),
        write:()=>new Promise(()=>{}),
        abort:()=>{aborted=true;return Promise.resolve();},
        close:()=>Promise.resolve(),
      })},
    };
  };
  await assert.rejects(boundedAttempt(conn.negotiateRespawnTypedChannel({timeoutMs:100})),/bound.*timeout/i);
  assert.equal(aborted,true,"cancel stalled HELLO writer of refused generation");
  assert.equal(conn.typedGeneration,0);
  assert.equal(conn.typedLeaseToken,conn);
  conn.close();
}));

test("Source11 concurrent renewal calls must not issue two same-incarnation bidi GRANTs or overwrite generation",()=>fixture(async()=>{
  const conn=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await conn.negotiateExperimentalGestureV2({reliableStream:true});
  conn.onGestureRenewalRequired=()=>{};
  const first=conn.negotiateRespawnTypedChannel({timeoutMs:250});
  const second=conn.negotiateRespawnTypedChannel({timeoutMs:250});
  await assert.rejects(second,/renewal.*in progress/i,
    "two concurrent HELLOs would race the original authoritative incarnation");
  const firstLease=await first;
  assert.notEqual(firstLease,conn);
  assert.equal(conn.typedGeneration,1);
  assert.equal(conn.transport.bidiOpened,2,"exactly one original root plus one bound bidi");
  assert.equal(conn.transport.boundWrites.length,1,"exactly one source11 HELLO");
  await conn.sendExperimentalGestureEdge(event(1,1),firstLease);
  assert.equal(conn.closed,false);
  conn.close("concurrent renew attempt completed");
}));

test("Source11 single-flight gate releases after failed OPEN so next valid bound HELLO may GRANT",()=>fixture(async()=>{
  const conn=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await conn.negotiateExperimentalGestureV2({reliableStream:true});
  conn.onGestureRenewalRequired=()=>{};
  const open=conn.transport.createBidirectionalStream.bind(conn.transport);
  conn.transport.createBidirectionalStream=()=>new Promise(()=>{});
  await assert.rejects(
    conn.negotiateRespawnTypedChannel({timeoutMs:100}),/bound.*timeout/i);
  assert.equal(conn.typedRenewalPending,false);
  conn.transport.createBidirectionalStream=open;
  const valid=await conn.negotiateRespawnTypedChannel({timeoutMs:250});
  assert.equal(conn.typedRenewalPending,false);
  assert.equal(conn.typedGeneration,1);
  assert.equal(conn.typedLeaseToken,valid);
  assert.equal(conn.transport.bidiOpened,2);
  assert.equal(conn.closed,false);
  conn.close("retry granted");
}));

test("Source11 local first-fatal trace records hint, bounded channel stages and exact root close reason",()=>fixture(async()=>{
  const c=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
  await c.negotiateExperimentalGestureV2({reliableStream:true});
  c.onGestureRenewalRequired=()=>{};
  c.transport.rootSource.enqueue(frame([2,0x14,0,0]));
  await eventually(()=>c.source11Events.some(x=>x.stage==="root-renew-hint"));
  await c.negotiateRespawnTypedChannel();
  const stages=c.source11Events.map(x=>x.stage);
  for(const expected of ["root-renew-hint","renew-open-start","renew-open-complete",
    "renew-hello-written","renew-bound-grant-received","renew-lease-active"])
    assert.ok(stages.includes(expected),expected);
  assert.equal(c.firstCloseReason,null);
  const generation=c.typedGeneration;
  c.close("fixture exact original root closure reason");
  c.close("second close must not replace first evidence");
  assert.equal(c.firstCloseReason,"fixture exact original root closure reason");
  assert.equal(c.typedGeneration,generation,"trace never changes generation");
  assert.equal(c.source11Events.at(-1).stage,"root-transport-close");
  assert.ok(c.source11Events.length<=16,"fatal trace remains bounded");
  assert.ok(c.source11Events.every(x=>typeof x.stage==="string" &&
    !Object.hasOwn(x,"playerId") && !Object.hasOwn(x,"packet")));
}));

for(const generation of [0,1]) test(`Source11 old generation ${generation} ACK is retired while next OPEN/GRANT is pending`,()=>fixture(async()=>{
 let receipts=0;
 const client=await connectAuthoritativeClient({webTransportUrl:"https://127.0.0.1:4433/game",
  onExperimentalGestureAck:()=>{receipts++;throw new Error("old outbox deliberately retired");}});
 await client.negotiateExperimentalGestureV2({reliableStream:true});
 const root=client.transport,quic=root.transport;root.onGestureRenewalRequired=()=>{};
 if(generation)await root.negotiateRespawnTypedChannel();
 const open=quic.createBidirectionalStream.bind(quic);let releaseOpen;
 quic.createBidirectionalStream=()=>new Promise(resolve=>{releaseOpen=()=>resolve(open());});
 const pending=root.negotiateRespawnTypedChannel();pending.catch(()=>{});
 try {
  await eventually(()=>typeof releaseOpen==="function");
  const ack=event();ack[1]=0x12;ack[2]=1;
  if(generation)quic.boundSources[0].enqueue(frame(ack));
  else quic.datagramSource.enqueue(ack);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(root.closed,false,"retired ACK cannot terminate the original root during bound OPEN");
  assert.equal(receipts,0,"retirement starts before token replacement, not only after GRANT");
  releaseOpen();await pending;
 } finally {releaseOpen?.();await pending.catch(()=>{});client.close("test complete");}
}));

test("Source11 blocked old writer cannot send during OPEN; genuine new writer failure still closes",()=>fixture(async()=>{
 const c=await connectGameTransport({webTransportUrl:"https://127.0.0.1:4433/game"});
 await c.negotiateExperimentalGestureV2({reliableStream:true});
 c.onGestureRenewalRequired=()=>{};let unblock,releaseOpen;
 c.datagramWriter.ready=new Promise(resolve=>{unblock=resolve;});
 const oldSend=c.sendExperimentalGestureEdge(event(),c.typedLeaseToken);oldSend.catch(()=>{});
 await new Promise(resolve=>setTimeout(resolve,0));
 const quic=c.transport,open=quic.createBidirectionalStream.bind(quic);
 quic.createBidirectionalStream=()=>new Promise(resolve=>{releaseOpen=()=>resolve(open());});
 const renewal=c.negotiateRespawnTypedChannel();renewal.catch(()=>{});
 try {
  await eventually(()=>typeof releaseOpen==="function");unblock();
  await assert.rejects(oldSend,/generation changed/);
  assert.equal(quic.datagramWrites.length,0,"old queued input is retired before server GRANT");
  assert.equal(c.closed,false,"expected old write retirement is not a root fault");
  releaseOpen();const lease=await renewal;
  c.typedBoundWriter.write=async()=>{throw new Error("genuine current writer failed");};
  await assert.rejects(c.sendExperimentalGestureEdge(event(),lease),/genuine current/);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(c.closed,true,"current authenticated writer failure must remain fail-closed");
 } finally {unblock?.();releaseOpen?.();await renewal.catch(()=>{});c.close("test complete");}
}));
