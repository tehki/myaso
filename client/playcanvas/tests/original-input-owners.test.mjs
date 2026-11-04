// Integration tests call the original UI functions directly. PlayCanvas
// installs NONE of these handlers until Core8/4D/Main0 authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installRightButtonGesture } from '../../../src/browser/right-button-gesture.mjs';
import { createPhysicalJumpChord } from '../../../src/browser/physical-jump-chord.mjs';
import { createDormantPrealphaLmbDomGate } from '../../../src/browser/prealpha-lmb-dom-gesture-review.mjs';
import { ProposedLmbGestureOutbox } from '../../../src/network/prealpha-lmb-gesture-outbox-proposal.mjs';
import { PROPOSED_GESTURE_VERSION, GESTURE_ACTION, decodeProposedGestureEvent }
  from '../../../src/network/prealpha-lmb-gesture-proposal.mjs';
import { validateLocalChatText, CHAT_UI_LIMITS }
  from '../../../src/browser/local-chat.mjs';
import { preparePlayCanvasOriginalInput, PLAYCANVAS_INPUT_ACTIVATION_GATES }
  from '../src/input/original-input-contract.mjs';

function dispatch(target, type, attrs = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key,value] of Object.entries(attrs)) {
    Object.defineProperty(event,key,{value});
  }
  target.dispatchEvent(event);
  return event;
}

test('existing RMB owner keeps physical pointer identity, short Kick, long Run and blur cancellation', () => {
  const canvas = new EventTarget(), win = new EventTarget();
  let nowMs = 0, kicks = 0;
  const owner = installRightButtonGesture(canvas,{
    now: () => nowMs, eventTarget: win, onKick: () => { kicks++; }
  });
  dispatch(canvas,'pointerdown',{button:2,pointerId:7});
  nowMs=140;
  dispatch(win,'pointerup',{button:2,pointerId:8});
  assert.equal(kicks,0,'wrong physical pointer cannot kick');
  assert.equal(owner.isRunning(),false);
  dispatch(win,'pointerup',{button:2,pointerId:7});
  assert.equal(kicks,1,'one genuine short RMB release triggers exactly one Kick');
  dispatch(win,'pointerup',{button:2,pointerId:7});
  assert.equal(kicks,1,'stale UP cannot kick twice');

  nowMs=200;
  dispatch(canvas,'pointerdown',{button:2,pointerId:9});
  nowMs=380;
  assert.equal(owner.isRunning(),true,'original 180ms hold is Run, not a second Kick');
  dispatch(canvas,'pointerup',{button:2,pointerId:9});
  assert.equal(owner.isRunning(),false);
  assert.equal(kicks,1);

  nowMs=400;
  dispatch(canvas,'pointerdown',{button:2,pointerId:10});
  nowMs=600;
  assert.equal(owner.isRunning(),true);
  dispatch(win,'blur');
  assert.equal(owner.isRunning(),false,'browser focus loss retires RMB');
  dispatch(win,'pointerup',{button:2,pointerId:10});
  assert.equal(kicks,1,'stale release after blur cannot kick');
});

test('existing trusted Space chord is single-use and retains original 60ms identity window', () => {
  const chord=createPhysicalJumpChord();
  chord.press(100,true);
  assert.equal(chord.consume(160,true),true);
  assert.equal(chord.consume(160,true),false,'same physical Space cannot be reused');
  chord.press(200,true);
  assert.equal(chord.consume(261,true),false,'late LMB is not the original Space chord');
  chord.press(300,false);
  assert.equal(chord.consume(310,true),false,'untrusted key does not authorize the chord');
  chord.press(400,true);
  chord.release();
  assert.equal(chord.consume(412,true),false,'keyup clears the chord');
});

test('existing source0 LMB owner cancels on chat focus and never replays old UP', () => {
  const canvas={},lease=Object.freeze({});
  const outbox=new ProposedLmbGestureOutbox({
    trustedLease:lease,negotiatedVersion:PROPOSED_GESTURE_VERSION,maxPending:16,
  });
  let chatFocused=false;
  const gate=createDormantPrealphaLmbDomGate({
    outbox,getClientTick:()=>17,
    isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>chatFocused,
  });
  const pointer=(id,attrs={})=>({target:canvas,pointerId:id,pointerType:'mouse',
    button:0,buttons:1,...attrs});
  assert.equal(gate.pointerDown(pointer(7)),true);
  chatFocused=true;
  assert.equal(gate.chatOpened(),true);
  assert.equal(gate.pointerUp(pointer(7,{buttons:0})),false);
  assert.equal(gate.pointerDown(pointer(7)),false);
  chatFocused=false;
  assert.equal(gate.pointerDown(pointer(9)),true);
  assert.equal(gate.pointerUp(pointer(9,{buttons:0})),true);
  const events=outbox.nextSendBatch(8).map(p=>decodeProposedGestureEvent(p.bytes));
  assert.deepEqual(events.map(x=>x.action),[
    GESTURE_ACTION.PRESS,GESTURE_ACTION.CANCEL,
    GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE,
  ]);
  assert.equal(events[0].gestureId,events[1].gestureId);
  assert.notEqual(events[1].gestureId,events[2].gestureId);
  assert.equal(events[2].gestureId,events[3].gestureId);
  assert.equal(gate.snapshot.active,false);
});

test('original Chat C1 validation and focus fence remain the only planned PlayCanvas text owner', async () => {
  assert.equal(validateLocalChatText('  Hello Greyhaven  '),'Hello Greyhaven');
  assert.equal(validateLocalChatText('Ю'.repeat(120)),'Ю'.repeat(120));
  assert.throws(()=>validateLocalChatText('Ю'.repeat(121)),/long/i);
  assert.throws(()=>validateLocalChatText('\u202e'),/Control/);
  assert.equal(CHAT_UI_LIMITS.bytes,240);
  const chat=await readFile(new URL('../../../src/browser/local-chat.mjs',import.meta.url),'utf8');
  assert.match(chat,/canvas\.addEventListener\("keydown", onArenaKey, true\)/);
  assert.match(chat,/event\.stopImmediatePropagation\(\)/);
  assert.match(chat,/doc\.defaultView\?\.addEventListener\(type, suppressArenaInputWhileComposing, captureOptions\)/);
  for (const word of ['"pointerdown"','"pointerup"','"mousedown"','"mouseup"','"wheel"']) {
    assert.ok(chat.includes(word),word+' must stay fenced during composing');
  }
});

test('PlayCanvas is inert despite read-only Core8 NetID and observable snapshots; no client activation', async () => {
  const canvas=new EventTarget(), events=[];
  canvas.addEventListener=(name)=>{events.push(name);};
  const session={client:{
    playerNetId:7,transport:{kind:'webtransport',experimentalGestureState:'granted'},
    sendInput(){throw Error('read-only spectator may not send gameplay');},
  },snapshotCount:99};
  const prepared=preparePlayCanvasOriginalInput({canvas,session,activate:true,core8Signed:true});
  assert.equal(prepared.active,false);
  assert.ok(prepared.missingGates===PLAYCANVAS_INPUT_ACTIVATION_GATES);
  assert.ok(Object.isFrozen(prepared.missingGates));
  assert.equal('activate' in prepared,false);
  assert.equal('sendInput' in prepared,false);
  assert.deepEqual(events,[]);
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/dataset\.playcanvasInputs = 'hold-core8'/);
  assert.doesNotMatch(main,/\.sendInput\(/);
  assert.doesNotMatch(main,/\.negotiateInstantLmb\(/);
  // The original Chat C1 host explicitly needs #arena and .arena-stage;
  // PlayCanvas still uses #application and has not installed a parallel chat.
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="application"/);
  assert.doesNotMatch(main,/installLocalChat\(/);
});

test('wheel direction and immediate original World writer stay in original web owner', async () => {
  const original=await readFile(new URL('../../../web/online-game.mjs',import.meta.url),'utf8');
  assert.match(original,/canvas\.addEventListener\("wheel"/);
  assert.match(original,/event\.deltaY < 0/);
  assert.match(original,/event\.deltaY > 0/);
  assert.match(original,/sendImmediatePhysicalBlockEdge\(event\.isTrusted === true\)/);
  assert.match(original,/sendImmediatePhysicalDodgeEdge\(event\.isTrusted === true\)/);
  assert.match(original,/canvas\.addEventListener\("blur", releaseInputs\)/);
});
