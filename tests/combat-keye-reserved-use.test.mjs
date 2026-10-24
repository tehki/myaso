import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROPOSED_GESTURE_SOURCE as SOURCE, GESTURE_ACTION as ACTION,
  encodeProposedTypedGestureEvent, decodeProposedTypedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import { ProposedSharedTypedGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantSharedUi10Sources } from "../src/browser/prealpha-shared-ui10-sources-review.mjs";

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
