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
    const readable=new ReadableStream({start:ctrl=>this.boundSource=ctrl});
    const writable=new WritableStream({write:async bytes=>{
      const body=Uint8Array.from(bytes);this.boundWrites.push(body);
      if(body.length===8 && body.every((b,i)=>b===hello[i])) {
        queueMicrotask(()=>this.boundSource.enqueue(frame([2,0x13,0,0])));
      } else if(body.length===18 && body[0]===16 && body[1]===0) {
        const ack=body.slice(2);ack[1]=0x12;ack[2]=1;
        queueMicrotask(()=>this.boundSource.enqueue(frame(ack)));
      }
    }});
    return {readable,writable};
  }
  close(){
    if(this.closedByClient)return;
    this.closedByClient=true;
    this.resolveClosed();
    for(const stream of [this.datagramSource,this.rootSource,this.boundSource]){
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
