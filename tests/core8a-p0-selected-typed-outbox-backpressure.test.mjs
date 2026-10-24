// Core8A P0: one selected 0x11/0x12 typed gesture family, nonrelease.
// This test imports actual existing Core8A typed-outbox and WebTransport
// adapter sources. It does NOT connect typed events to live QUIC or World.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {connectGameTransport} from "../web/network-transport.mjs";
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

test("the selected typed v2 proposal is still absent from the live browser and Rust World ingress",()=>{
  const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(browser,/prealpha-lmb-gesture-outbox-proposal/);
  assert.doesNotMatch(server,/prealpha_lmb_gesture_proposal/);
});
