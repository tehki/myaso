import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  UI10_KEY_E_SOURCE, UI10_KEY_E_ACTION as A,
  createDormantKeyEOrigin, attachDormantKeyEOrigin,
} from "../src/browser/prealpha-keye-source-review.mjs";
import { createDormantPrealphaLmbDomGate } from "../src/browser/prealpha-lmb-dom-gesture-review.mjs";
import { ProposedLmbGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { decodeProposedGestureEvent } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const key = (type, extra = {}) => ({code: "KeyE", repeat: false, type, ...extra});
function setup(options = {}) {
  const intents = [];
  let focus = true, editing = false, accepted = true;
  const origin = createDormantKeyEOrigin({
    emitIntent: intent => {intents.push(intent); return accepted;},
    hasGameplayFocus: () => focus,
    isTextEditing: () => editing,
    ...options,
  });
  return {origin, intents, focus: x => focus = x,
    editing: x => editing = x, accept: x => accepted = x};
}
const events = f => f.intents.map(x => [x.source, x.action]);

test("standalone KeyE PRESS begins once; RELEASE is terminal, never another PRESS", () => {
  const f = setup();
  assert.equal(f.origin.keyDown(key("keydown")), true);
  assert.equal(f.origin.keyDown(key("keydown", {repeat: true})), false);
  assert.equal(f.origin.keyDown(key("keydown")), false);
  assert.equal(f.origin.keyUp(key("keyup")), true);
  assert.equal(f.origin.keyUp(key("keyup")), false);
  assert.deepEqual(events(f), [[1, A.PRESS], [1, A.RELEASE]]);
  assert.equal(f.origin.snapshot.active, false);
  assert.equal(Object.isFrozen(f.intents[0]), true);
  assert.deepEqual(Object.keys(f.intents[0]).sort(), ["action", "source"]);
});
test("physical code KeyE only; text chat, absent gameplay focus, other keys cannot fire", () => {
  const f = setup();
  assert.equal(f.origin.keyDown({code:"KeyW", repeat:false}), false);
  assert.equal(f.origin.keyDown({code:"Space", repeat:false}), false);
  f.focus(false);
  assert.equal(f.origin.keyDown(key("keydown")), false);
  f.focus(true); f.editing(true);
  assert.equal(f.origin.keyDown(key("keydown")), false);
  f.editing(false);
  assert.equal(f.origin.keyDown(key("keydown")), true);
  f.editing(true);
  assert.equal(f.origin.keyUp(key("keyup")), true, "lost focus must cancel, never release");
  assert.deepEqual(events(f), [[1,A.PRESS],[1,A.CANCEL]]);
});
test("blur, chat opening and hidden tab each CANCEL and later keyup cannot attack", () => {
  for (const reason of ["blur", "chatOpened", "hidden"]) {
    const f = setup();
    assert.equal(f.origin.keyDown(key("keydown")), true);
    assert.equal(f.origin[reason](), true);
    assert.equal(f.origin.keyUp(key("keyup")), false);
    assert.deepEqual(events(f), [[1,A.PRESS],[1,A.CANCEL]], reason);
  }
});
test("KeyE and LMB do not share a gesture or release each other", () => {
  const f = setup();
  const mouseBox = new ProposedLmbGestureOutbox({trustedLease:{}, negotiatedVersion:2});
  const canvas = {};
  const mouse = createDormantPrealphaLmbDomGate({
    outbox:mouseBox, getClientTick:()=>42, isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>false, isJumpAttackChord:()=>false,
  });
  const pointer = {pointerId:9,pointerType:"mouse",button:0,buttons:1,target:canvas};
  assert.equal(mouse.pointerDown(pointer), true);
  const activeId = mouse.snapshot.gestureId;
  assert.equal(f.origin.keyDown(key("keydown")), true);
  assert.equal(f.origin.keyUp(key("keyup")), true);
  assert.equal(mouse.snapshot.gestureId, activeId, "KeyE release MUST NOT release LMB");
  assert.equal(mouse.snapshot.active, true);
  assert.equal(mouse.pointerUp({...pointer,buttons:0}), true);
  const lmb = mouseBox.nextSendBatch(8).map(entry=>decodeProposedGestureEvent(entry.bytes));
  assert.deepEqual(lmb.map(x=>x.action), [1,3]);
  assert.equal(lmb[0].gestureId,lmb[1].gestureId);
  assert.deepEqual(events(f), [[1,A.PRESS],[1,A.RELEASE]]);
});
test("invalid downstream source transport must fail closed, not turn cancel into heavy", () => {
  const f = setup();
  f.accept(false);
  assert.equal(f.origin.keyDown(key("keydown")), false);
  assert.equal(f.origin.snapshot.closed, true);
  assert.equal(f.origin.keyUp(key("keyup")), false);
  assert.deepEqual(events(f), [[1,A.PRESS]]);
  const error = setup({emitIntent:()=>{throw Error("not negotiated");}});
  assert.equal(error.origin.keyDown(key("keydown")), false);
  assert.equal(error.origin.snapshot.closed, true);
});
test("disconnect retires the local source; no KeyE release or local hit on old lease", () => {
  const f = setup();
  f.origin.keyDown(key("keydown"));
  assert.equal(f.origin.closeLease(), true);
  assert.equal(f.origin.closeLease(), false);
  assert.equal(f.origin.keyUp(key("keyup")), false);
  assert.equal(f.origin.keyDown(key("keydown")), false);
  assert.deepEqual(events(f), [[1,A.PRESS]]);
});
test("capture listener accepts single keyboard edge and removes itself, no fake native claim", () => {
  const windowObj = new EventTarget(), documentObj = new EventTarget();
  documentObj.hidden = false;
  const f = setup();
  const detach = attachDormantKeyEOrigin(f.origin,{windowObj, documentObj});
  const dispatch=(name, code="KeyE", repeat=false)=>{
    const e=new Event(name,{cancelable:true});
    Object.defineProperties(e,{code:{value:code},repeat:{value:repeat}});
    windowObj.dispatchEvent(e);
    return e;
  };
  assert.equal(dispatch("keydown").defaultPrevented,true);
  assert.equal(dispatch("keydown","KeyE",true).defaultPrevented,false);
  assert.equal(dispatch("keyup").defaultPrevented,true);
  assert.deepEqual(events(f),[[1,A.PRESS],[1,A.RELEASE]]);
  detach();detach();
  assert.equal(f.origin.snapshot.closed,true);
  assert.equal(dispatch("keydown").defaultPrevented,false);
});
test("pagehide retires lease without fabricated terminal; visibilitychange only cancels active", () => {
  const windowObj = new EventTarget(), documentObj = new EventTarget();
  documentObj.hidden = false;
  const f=setup();
  attachDormantKeyEOrigin(f.origin,{windowObj,documentObj});
  f.origin.keyDown(key("keydown"));
  documentObj.hidden = true;
  documentObj.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(events(f),[[1,A.PRESS],[1,A.CANCEL]]);
  f.origin.keyDown(key("keydown"));
  windowObj.dispatchEvent(new Event("pagehide"));
  assert.equal(f.origin.snapshot.closed,true);
  assert.deepEqual(events(f),[[1,A.PRESS],[1,A.CANCEL],[1,A.PRESS]]);
});
test("proposal cannot change live v1, World Combat, or independently install another codec", () => {
  const live=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(live,/prealpha-keye-source-review/);
  assert.doesNotMatch(server,/prealpha-keye-source-review/);
  assert.equal(UI10_KEY_E_SOURCE,1);
  assert.deepEqual(A,{PRESS:1,RELEASE:3,CANCEL:4});
});
