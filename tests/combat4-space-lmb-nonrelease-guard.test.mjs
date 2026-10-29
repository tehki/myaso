// Isolated EventTarget regression. Not a native W3C or external human flight.
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {activateLoopbackGestureLab} from "../web/prealpha-gesture-live-lab.mjs";
import {decodeProposedTypedGestureEvent} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

function event(type, fields = {}) {
  const e = new Event(type, {bubbles:true,cancelable:true});
  for (const [key, value] of Object.entries(fields)) {
    Object.defineProperty(e, key, {value});
  }
  return e;
}
function fixture() {
  const canvas = new EventTarget(), windowObj = new EventTarget();
  const documentObj = new EventTarget(), wire = [];
  let jump = false, closed = false;
  windowObj.location = {hostname:"localhost"};
  documentObj.activeElement = canvas; documentObj.hidden = false;
  const gameClient = {
    transport:{webTransportUrl:"https://127.0.0.1:4433/game"},
    async negotiateExperimentalGestureV2() {return true;},
    async sendExperimentalGestureEdge(bytes) {wire.push(decodeProposedTypedGestureEvent(bytes));},
    close() {closed = true;},
  };
  return {
    canvas, windowObj, documentObj, wire, gameClient,
    setJump(value) {jump = value;},
    get closed() {return closed;},
    options:{gameClient,canvas,windowObj,documentObj,
      getClientTick:()=>11, isJumpAttackChord:()=>jump},
  };
}
const down = f => f.canvas.dispatchEvent(event("pointerdown",{
  pointerType:"mouse",pointerId:7,button:0,buttons:1,
}));
const up = f => f.windowObj.dispatchEvent(event("pointerup",{
  pointerType:"mouse",pointerId:7,button:0,buttons:0,
}));
const flush = async() => {for(let i=0;i<16;i++) await Promise.resolve();};

test("existing Space-held physical LMB must not author an ordinary typed Light or retire QUIC",async()=>{
  const f=fixture();f.setJump(true);
  const lab=await activateLoopbackGestureLab(f.options);
  try {
    down(f);await flush();up(f);await flush();
    assert.deepEqual(f.wire,[],"a jump chord cannot silently become ordinary typed Light");
    assert.equal(lab.snapshot.closed,false);
    f.setJump(false);
    down(f);await flush();up(f);await flush();
    assert.deepEqual(f.wire.map(e=>e.action),[1,3],
      "later ordinary LMB retains one PRESS/RELEASE in the original outbox");
    assert.equal(f.closed,false);
  }finally{lab.close("test");}
});
test("Space pressed after LMB cancels only unlanded typed gesture; no phantom RELEASE",async()=>{
  const f=fixture(), lab=await activateLoopbackGestureLab(f.options);
  try {
    down(f);await flush();
    f.setJump(true);
    f.windowObj.dispatchEvent(event("keydown",{code:"Space",repeat:false}));await flush();
    up(f);await flush();
    assert.deepEqual(f.wire.map(e=>e.action),[1,4],
      "a mid-hold jump chord must cancel, not commit another typed Light/Heavy");
    assert.equal(lab.snapshot.closed,false);
    f.setJump(false);
    down(f);await flush();up(f);await flush();
    assert.deepEqual(f.wire.map(e=>e.action),[1,4,1,3]);
  }finally{lab.close("test");}
});

test("original first-party opt-in page supplies real Space state and never enables parallel v1 Combat",()=>{
  const page=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.match(page,/isJumpAttackChord:\s*\(\) => jumpRequested \|\| keys\.has\("Space"\)/);
  assert.match(page,/currentInput\.attack = !typedLmbEnabled &&/);
  assert.match(page,/currentInput\.heavyAttack = !typedLmbEnabled &&/);
  assert.match(server,/if v2_enabled \{[\s\S]*?intent\.attack = false;\s*intent\.heavy_attack = false;/);
  assert.match(page,/if \(gestureLabRequested && !reviewedGestureLab\)/);
});
