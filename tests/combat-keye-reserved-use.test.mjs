import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  PROPOSED_GESTURE_SOURCE as SOURCE, GESTURE_ACTION as ACTION,
  encodeProposedTypedGestureEvent, decodeProposedTypedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import { ProposedSharedTypedGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantSharedUi10Sources } from "../src/browser/prealpha-shared-ui10-sources-review.mjs";
import { connectAuthoritativeClient } from "../web/authoritative-client.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Key E is reserved for future Use in both playable game pages, with no heavy Combat producer", () => {
  for (const path of ["../web/online-game.mjs", "../web/game.mjs"]) {
    const source = read(path);
    assert.match(source, /if \(event\.code === "KeyE"\) return;/);
    assert.doesNotMatch(source, /event\.code === "KeyE"[^\n]*heavyAttackRequested/);
    assert.doesNotMatch(source, /event\.code === "KeyE"[^\n]*audio\.play\("heavy"\)/);
  }
});

test("retired Key E typed Combat source cannot encode or enter the selected outbox", () => {
  const lease = Object.freeze({});
  const q = new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  assert.throws(() => encodeProposedTypedGestureEvent({
    source:SOURCE.KEY_E,action:ACTION.PRESS,sequence:1,gestureId:1,clientTick:1,
  }), /reserved for Use/);
  assert.throws(() => q.begin(SOURCE.KEY_E,1), /Combat permits only/);
  assert.equal(q.snapshot.pending,0);
  const press = q.begin(SOURCE.LMB,2);
  const release = q.release(SOURCE.LMB,3);
  assert.equal(press.source,SOURCE.LMB);
  assert.equal(release.gestureId,press.gestureId);
  const bytes=q.nextSendBatch(2).map(e=>decodeProposedTypedGestureEvent(e.bytes));
  assert.deepEqual(bytes.map(e=>e.action),[ACTION.PRESS,ACTION.RELEASE]);
  assert.deepEqual(bytes.map(e=>e.source),[SOURCE.LMB,SOURCE.LMB]);
});

test("experimental browser gate no longer installs a Key E Combat origin", () => {
  const module=read("../src/browser/prealpha-shared-ui10-sources-review.mjs");
  assert.doesNotMatch(module, /attachDormantKeyEOrigin|createDormantKeyEOrigin/);
  const lease={},outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  const canvas={};
  const gates=createDormantSharedUi10Sources({
    outbox,getClientTick:()=>1,isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>false,isJumpAttackChord:()=>false,
  });
  assert.equal("keye" in gates,false);
  assert.equal(gates.lmb.pointerDown({pointerType:"mouse",pointerId:8,button:0,buttons:1,target:canvas}),true);
  assert.equal(gates.lmb.pointerUp({pointerType:"mouse",pointerId:8,button:0,buttons:0,target:canvas}),true);
  assert.equal(outbox.snapshot.pending,2);
  gates.closeLease();
  assert.equal(outbox.snapshot.closed,true);
});

test("Rust original World admission rejects retired source1 before Combat state mutation",()=>{
  const code=read("../server/src/prealpha_authenticated_gesture.rs");
  assert.match(code,/if typed\.source == GestureSource::KeyE \{/);
  assert.match(code,/status: AckStatus::Rejected/);
  const authority=read("../server/src/prealpha_lmb_gesture_authority.rs");
  assert.match(authority,/if source == GestureSource::KeyE \{\s*return Decision::rejected\(\)/);
  assert.doesNotMatch(authority,/Command::BeginKeyEHeavy/);
});

// Exercise the actual installed handlers without constructing fake Combat events.
test("keydown handler really ignores KeyE, including auto-repeat, without consuming it", () => {
  for (const path of ["../web/game.mjs", "../web/online-game.mjs"]) {
    const source=read(path);
    const start=source.indexOf('canvas.addEventListener("keydown", (event) => {');
    const end=source.indexOf("\n});",start);
    assert.ok(start>=0 && end>start, path+" missing original keydown handler");
    const subscriptions=[],audioCues=[],combatKeys=[],combatFieldWrites=[];
    const sandbox={
      canvas:{addEventListener:(kind,handler)=>subscriptions.push([kind,handler])},
      // Instrument the ACTUAL playable-page keydown handler. Any accidental
      // regression past KeyE's early return must never trigger heavy audio,
      // produce attack intent, consume interaction input or arm combat keys.
      audio:{play:cue=>audioCues.push(cue)},
      keys:{add:key=>combatKeys.push(key),delete:key=>combatKeys.push("delete:"+key)},
    };
    Object.defineProperty(sandbox,"heavyAttackRequested",{
      get(){return false;},set(value){combatFieldWrites.push(value);},
      configurable:true,
    });
    runInNewContext(source.slice(start,end+4),sandbox);
    assert.equal(subscriptions.length,1,path+" must register one handler");
    assert.equal(subscriptions[0][0],"keydown");
    const handler=subscriptions[0][1];
    for(const repeat of [false,true]) {
      let prevented=0;
      handler({code:"KeyE",repeat,preventDefault(){prevented++;}});
      assert.equal(prevented,0,path+" E stays available for future Use");
    }
    assert.deepEqual(audioCues,[],path+" E DOWN/repeat cannot play heavy or other combat audio");
    assert.deepEqual(combatKeys,[],path+" E DOWN/repeat cannot enter combat key state");
    assert.deepEqual(combatFieldWrites,[],path+" E cannot request LMB heavy");
  }
});


test("actual granted QUIC sender refuses handcrafted old source1 BEFORE bounded writer queue",async()=>{
  const original=globalThis.WebTransport;
  let writes=0,firstConnection;
  const reliable=[];
  let waiter=null;
  class MockPinnedQuic {
    constructor(){
      firstConnection=this;
      this.ready=Promise.resolve();
      this.closed=Promise.resolve();
      this.datagrams={
        writable:{getWriter:()=>({
          ready:Promise.resolve(),
          async write(){writes++;},
          releaseLock(){},
        })},
        readable:{getReader:()=>({read:()=>new Promise(()=>{}),releaseLock(){}})},
      };
    }
    async createBidirectionalStream(){
      return {
        writable:{getWriter:()=>({ready:Promise.resolve(),async write(){},releaseLock(){}})},
        readable:{getReader:()=>({
          read:()=>reliable.length?Promise.resolve({value:reliable.shift(),done:false})
            :new Promise(resolve=>{waiter=resolve;}),
          releaseLock(){},
        })},
      };
    }
    async createUnidirectionalStream(){
      return {getWriter:()=>({
        async write(){},
        async close(){
          const bytes=new Uint8Array([4,0,2,0x13,0,0]);
          if(waiter){const done=waiter;waiter=null;done({value:bytes,done:false});}
          else reliable.push(bytes);
        },
        releaseLock(){},
      })};
    }
    close(){}
  }
  globalThis.WebTransport=MockPinnedQuic;
  let client;
  try{
    client=await connectAuthoritativeClient({
      webTransportUrl:"https://127.0.0.1:4433/game",
    });
    assert.equal(await client.negotiateExperimentalGestureV2(),true);
    const lease=client.transport;
    assert.equal(lease.experimentalGestureState,"granted");
    const valid=new Uint8Array(encodeProposedTypedGestureEvent({
      source:SOURCE.LMB,action:ACTION.PRESS,sequence:1,gestureId:1,clientTick:1,
    }));
    const before=lease.pendingGestureEdges;
    for(const action of [
      ACTION.PRESS,ACTION.UPGRADE,ACTION.RELEASE,ACTION.CANCEL,
    ]) {
      // Manually fabricated obsolete source1 is still legal historical wire
      // syntax, but must never reach the ONE current Combat writer, even if
      // it copies an otherwise valid same-lease LMB ID and sequence.
      const forbidden=valid.slice();
      forbidden[2]=action;
      forbidden[3]=SOURCE.KEY_E;
      assert.throws(()=>client.sendExperimentalGestureEdge(forbidden),
        /only source0 LMB typed 16-byte Combat events accepted/);
      assert.equal(lease.pendingGestureEdges,before,
        "retired E action must not claim any LMB queue capacity");
      assert.equal(writes,0,
        "retired E action must not be delivered to current QUIC writer");
      assert.equal(lease.experimentalGestureState,"granted",
        "retired E must not retire or replace the current LMB connection");
    }
    const unknown=valid.slice();unknown[3]=255;
    assert.throws(()=>client.sendExperimentalGestureEdge(unknown),
      /only source0 LMB typed 16-byte Combat events accepted/);
    assert.equal(lease.pendingGestureEdges,before,
      "unknown forged Combat source must not spend valid queue capacity");
    // Preserve only ONE selected event decoder, even for forged source0.
    // Packet-shaped bad actions/IDs must not starve physical LMB RELEASE
    // behind the 64-pending-edge QUIC ceiling.
    const invalidPackets = [
      [()=>{const b=valid.slice();b[2]=0;return b;}, /invalid reviewed source\/action pair/],
      [()=>{const b=valid.slice();b[2]=255;return b;}, /invalid reviewed source\/action pair/],
      [()=>{const b=valid.slice();b.fill(0,4,8);return b;}, /sequence must be/],
      [()=>{const b=valid.slice();b.fill(0,8,12);return b;}, /gestureId must be/],
    ];
    for(const [produce,error] of invalidPackets){
      assert.throws(()=>client.sendExperimentalGestureEdge(produce()),error);
      assert.equal(lease.pendingGestureEdges,before,
        "malformed source0 may not occupy a legitimate LMB writer slot");
      assert.equal(writes,0);
      assert.equal(lease.experimentalGestureState,"granted",
        "malformed source0 must not evict a genuine LMB actor lease");
    }
    // More invalid packets than the entire 64-edge transport ceiling must
    // neither allocate capacity nor retire the current authenticated-shaped
    // connection. This covers sustained obsolete E client traffic, not just
    // a single malformed gesture packet.
    for(let attempt=0;attempt<192;attempt++){
      const packet=valid.slice();
      if(attempt%3===0)packet[3]=SOURCE.KEY_E;
      else if(attempt%3===1)packet[2]=255;
      else packet.fill(0,4,8);
      assert.throws(()=>client.sendExperimentalGestureEdge(packet),
        /only source0 LMB typed 16-byte Combat events accepted|invalid reviewed source\/action pair|sequence must be/);
    }
    assert.equal(lease.pendingGestureEdges,before,
      "192 rejected packets cannot fill the actual 64-slot QUIC LMB queue");
    assert.equal(lease.experimentalGestureState,"granted",
      "a flood of obsolete E events may not kill the legitimate LMB lease");
    assert.equal(writes,0,"no invalid packet can reach the real writer");

    const upgrade=new Uint8Array(encodeProposedTypedGestureEvent({
      source:SOURCE.LMB,action:ACTION.UPGRADE,sequence:2,gestureId:1,clientTick:2,
    }));
    const release=new Uint8Array(encodeProposedTypedGestureEvent({
      source:SOURCE.LMB,action:ACTION.RELEASE,sequence:3,gestureId:1,clientTick:3,
    }));
    for(const packet of [valid,upgrade,release])
      await client.sendExperimentalGestureEdge(packet);
    assert.equal(writes,3,
      "one unchanged real QUIC writer must transmit the legitimate LMB heavy edge triplet");
    assert.equal(lease.pendingGestureEdges,0);
    assert.equal(lease.experimentalGestureState,"granted");
    assert.ok(firstConnection,"one existing connection must own sender");
  }finally{
    client?.close();
    if(original===undefined)delete globalThis.WebTransport;
    else globalThis.WebTransport=original;
  }
});
