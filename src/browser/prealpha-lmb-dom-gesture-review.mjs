// Moon Games UI10 Pre-Alpha v2 mouse edge adapter, DORMANT REVIEW ONLY.
// Not imported by web/online-game.mjs; never sends QUIC or grants a hit.
// Only a future authenticated/version-negotiated Core 8A lease may own outbox.
// Browser pointer events alone are never actor authorization or Combat proof.
import { ProposedLmbGestureOutbox, ProposedSharedTypedGestureOutbox } from "../network/prealpha-lmb-gesture-outbox-proposal.mjs";

const isFn = value => typeof value === "function";
const validMousePointer = e => e && e.pointerType === "mouse"
  && Number.isSafeInteger(e.pointerId) && e.pointerId >= 0;
const defaultTick = () => 0;
// Internal physical-owner marker ONLY; never serialized into a gesture packet.
// Real mouse pointer IDs are nonnegative. RMB-held LMB has only MouseEvents.
const CHORDED_MOUSE_POINTER_ID = -1;

// The proposed UPGRADE deadline is deliberately NOT a local timer here.
// Combat4/Core8C must approve server-timed semantics before any runtime hookup.
export function createDormantPrealphaLmbDomGate({
  outbox, getClientTick = defaultTick,
  isCanvasTarget, isChatFocused = () => false,
  isJumpAttackChord = () => false,
} = {}) {
  const shared = outbox instanceof ProposedSharedTypedGestureOutbox;
  if (!(outbox instanceof ProposedLmbGestureOutbox) && !shared) {
    throw new TypeError("a negotiated, lease-bound proposed v2 outbox is required");
  }
  for (const fn of [getClientTick,isCanvasTarget,isChatFocused,isJumpAttackChord]) {
    if (!isFn(fn)) throw new TypeError("explicit UI control predicates required");
  }
  let active = null, closed = false;
  function shutdown() {
    if (closed) return false;
    closed = true;
    active = null;
    if (shared) outbox.retire();
    else outbox.closeLease();
    return true;
  }
  function submit(action) {
    if (closed) return false;
    try {
      const tick = getClientTick();
      const edge = action(tick);
      return edge;
    } catch {
      // A lost release or outbox overflow MUST NEVER make the browser
      // invent a local hit or retry on a different lease.
      shutdown();
      return false;
    }
  }
  function beginPhysicalLmb(pointerId, chorded) {
    // PointerEvent and MouseEvent routes converge before the SAME source0
    // outbox. Never create parallel attack producers or duplicate PRESS.
    const edge = submit(tick => shared ? outbox.begin(0,tick) : outbox.begin(tick));
    if (!edge) return false;
    active = {pointerId,gestureId:edge.gestureId,upgraded:false,chorded};
    return true;
  }
  function pointerDown(event) {
    if (closed || active || !validMousePointer(event)
      || event.button !== 0 || (event.buttons & 1) === 0
      || isChatFocused() || isJumpAttackChord(event)
      || !isCanvasTarget(event)) return false;
    return beginPhysicalLmb(event.pointerId,false);
  }
  function chordedMouseDown(event) {
    // W3C pointerdown/up only occur at zero↔nonzero button transitions.
    // With RMB already down, LMB makes a *genuine* mousedown(button0,
    // buttons3) but no new pointerdown. Keep source0 on the same outbox.
    if (closed || active || !event || event.button !== 0
      || (event.buttons & 3) !== 3 || isChatFocused()
      || isJumpAttackChord(event) || !isCanvasTarget(event)) return false;
    return beginPhysicalLmb(CHORDED_MOUSE_POINTER_ID,true);
  }
  function mouseUp(event) {
    if (closed || !active || !event || event.button !== 0
      || (event.buttons & 1) !== 0) return false;
    // When RMB is held, normal LMB first may also have no pointerup.
    // Outside that chord, defer to pointerup's exact pointerId fencing.
    if (!active.chorded && (event.buttons & 2) === 0) return false;
    return terminate("release");
  }
  // This is an explicitly invoked REVIEW hook, not a browser timer.
  // Never call on an actual game frame until timing is approved by Combat4.
  function approvedHoldUpgrade(pointerId) {
    if (closed || !active || active.pointerId !== pointerId || active.upgraded)
      return false;
    const edge = submit(tick => outbox.upgrade(tick));
    if (!edge) return false;
    if (edge.gestureId !== active.gestureId) {
      shutdown();return false;
    }
    active.upgraded = true;
    return true;
  }
  function terminate(kind, event) {
    if (closed || !active) return false;
    if (event !== undefined && (!validMousePointer(event)
      || event.pointerId !== active.pointerId)) return false;
    // Release is only from the actual left mouse UP event, even if
    // received on window after the pointer leaves the canvas.
    if (kind === "release" && event !== undefined && event.button !== 0) return false;
    const edge = submit(tick => kind === "release"
      ? (shared ? outbox.release(0,tick) : outbox.release(tick))
      : (shared ? outbox.cancel(0,tick) : outbox.cancel(tick)));
    if (!edge) return false;
    active = null;
    return true;
  }
  return Object.freeze({
    pointerDown, chordedMouseDown, mouseUp,
    pointerUp:event => terminate("release",event),
    // A physical mouse pointer cancellation may identify the RMB pointer
    // rather than our internal chord owner; always fail closed on cancel.
    pointerCancel:event => active?.chorded && event?.pointerType === "mouse"
      ? terminate("cancel") : terminate("cancel",event),
    lostCapture:event => active?.chorded && event?.pointerType === "mouse"
      ? terminate("cancel") : terminate("cancel",event),
    // Chat Enter and blur can cancel held attack edges, never submit a
    // phantom RELEASE. A reconnect must instead use a fresh outbox lease.
    chatOpened:() => terminate("cancel"),
    blur:() => terminate("cancel"),
    hidden:() => terminate("cancel"),
    approvedHoldUpgrade, closeLease:shutdown,
    get snapshot() {
      return Object.freeze({active:active!==null,
        pointerId:active?.pointerId??null,
        gestureId:active?.gestureId??null,upgraded:active?.upgraded??false,closed});
    },
  });
}

// Opt-in QA-only event wiring, not imported or enabled by live game.
// In shared typed review mode, source0 and source1 share one Core8A queue; never
// attach this beside the live v1 LMB handler.
// The future runtime must *replace* legacy v1 LMB handling atomically;
// adding this listener alongside it could double-attack.
export function attachDormantPrealphaLmbDomGate(
  gate,{canvas,windowObj,documentObj} = {}) {
  if (!canvas?.addEventListener || !windowObj?.addEventListener
    || !documentObj?.addEventListener) {
    throw new TypeError("real canvas, window, and document required");
  }
  const handlers = [
    [canvas,"pointerdown",e=>{
      if (gate.pointerDown(e) && e.cancelable) e.preventDefault();
    }],
    [canvas,"mousedown",e=>{
      if (gate.chordedMouseDown(e) && e.cancelable) e.preventDefault();
    }],
    [windowObj,"pointerup",e=>{if(gate.pointerUp(e)&&e.cancelable)e.preventDefault();}],
    [windowObj,"mouseup",e=>{if(gate.mouseUp(e)&&e.cancelable)e.preventDefault();}],
    [windowObj,"pointercancel",e=>gate.pointerCancel(e)],
    [canvas,"lostpointercapture",e=>gate.lostCapture(e)],
    [windowObj,"blur",()=>gate.blur()],
    [documentObj,"visibilitychange",()=>{if(documentObj.hidden)gate.hidden();}],
  ];
  for(const [target,type,fn] of handlers)target.addEventListener(type,fn,true);
  let removed=false;
  return () => {
    if(removed)return;
    removed=true;
    for(const [target,type,fn] of handlers)
      target.removeEventListener(type,fn,true);
    gate.closeLease();
  };
}
