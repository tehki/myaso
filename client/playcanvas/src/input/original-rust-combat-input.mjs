// UI10 physical control owner for the original Rust client, not a second
// Combat engine. LMB is owned exclusively by the unchanged Source11/Combat4
// negotiated typed gate in web/prealpha-gesture-live-lab.mjs.
import { COMBAT } from '../../../../src/combat/model.mjs';
import { NETWORK } from '../../../../src/network/constants.mjs';
import { activateLoopbackGestureLab } from '../../../../web/prealpha-gesture-live-lab.mjs';

const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const SHORT_RMB_MS = 180; // Original src/browser/right-button-gesture.mjs contract.
const OWNED_INTERVAL_MS = 1000 / NETWORK.inputSendHz;

export function createOriginalRustCombatInput({
  canvas, windowObj, documentObj, getClient, onStatus = () => {},
  onAcceptedPress = () => {}, onHitReceipt = () => {},
  enablePrivateHit = false, activateTyped = activateLoopbackGestureLab,
  now = () => performance.now(), setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (!canvas?.addEventListener || !windowObj?.addEventListener
      || !documentObj?.addEventListener || typeof getClient !== 'function') {
    throw new TypeError('UI10 requires actual canvas, window, document and Rust client owner');
  }
  const keys = new Set();
  const handlers = [];
  let closed = false, activating = false, lab = null, privateHit = null;
  let tick = 0, aiming = 0, lastAimSendAt = -Infinity;
  let spaceHeld = false, jumpPressed = false;
  let blockUntil = 0, blockWasActive = false, right = null;
  let lastActor = null, interval = null, lastSampleWasActive = false;

  function client() { return getClient(); }
  function textFocused() {
    const active = documentObj.activeElement;
    return Boolean(active?.closest?.('[data-local-chat]') ||
      active?.matches?.('input,textarea,[contenteditable]'));
  }
  function ownsFocus() {
    return !closed && !documentObj.hidden && !textFocused()
      && documentObj.activeElement === canvas;
  }
  function actualTransport() {
    const c = client();
    return c && c.transport?.kind === 'webtransport' && !c.transport.closed ? c : null;
  }
  function readPhysicalSample(oneshot = {}) {
    const block = now() < blockUntil;
    const moveX = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const moveY = Number(keys.has('KeyS')) - Number(keys.has('KeyW'));
    return {
      moveX, moveY, facing: aiming, run: Boolean(right && now() - right.at >= SHORT_RMB_MS),
      // Source0 LMB Light/Heavy/JumpAttack is NOT emitted through this v1 path.
      attack: false, heavyAttack: false,
      jump: oneshot.jump === true, kick: oneshot.kick === true,
      dodge: oneshot.dodge === true, block, dash: false,
    };
  }
  function isHeld(sample) {
    return Boolean(sample.moveX || sample.moveY || sample.run || sample.block);
  }
  function sendPhysicalSample(oneshot = {}, { release = false } = {}) {
    const c = actualTransport();
    if (!c || (!ownsFocus() && !release)) return false;
    if (release && !lastSampleWasActive) return false;
    const sample = release
      ? {moveX: 0, moveY: 0, facing: aiming, run: false, attack: false,
        heavyAttack: false, jump: false, kick: false, dodge: false,
        block: false, dash: false}
      : readPhysicalSample(oneshot);
    // Same original v1 writer, redundancy and monotonic client tick as P0.
    // Never synthesize neutral admissions merely to obtain a World actor.
    c.sendInput({tick: tick >>> 0, ...sample});
    tick = (tick + 1) >>> 0;
    lastSampleWasActive = isHeld(sample);
    return true;
  }
  function add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    handlers.push([target, type, handler, options]);
  }
  function cancelPhysical() {
    const wasActive = keys.size > 0 || blockWasActive || right;
    keys.clear(); spaceHeld = false; jumpPressed = false;
    blockUntil = 0; blockWasActive = false; right = null;
    if (wasActive) sendPhysicalSample({}, {release: true});
  }
  function onKeyDown(event) {
    if (!event.isTrusted || closed || !ownsFocus() || event.repeat) return;
    if (MOVE.has(event.code)) {
      if (event.cancelable) event.preventDefault();
      keys.add(event.code);
      sendPhysicalSample();
    } else if (event.code === 'Space') {
      if (event.cancelable) event.preventDefault();
      spaceHeld = true;
      jumpPressed = true;
      // Original v1 physical Jump remains the only jump writer. Typed LMB
      // shares that original actor and decides JumpAttack on its own lease.
      sendPhysicalSample({jump: true});
      jumpPressed = false;
    }
    // KeyE belongs to Use. Enter/Escape belong exclusively to UI10 Chat.
  }
  function onKeyUp(event) {
    if (!event.isTrusted || closed) return;
    if (MOVE.has(event.code) && keys.delete(event.code)) {
      if (ownsFocus()) sendPhysicalSample();
      else cancelPhysical();
    }
    if (event.code === 'Space') spaceHeld = false;
  }
  function onWheel(event) {
    if (!event.isTrusted || !ownsFocus()) return;
    if (event.cancelable) event.preventDefault();
    if (event.deltaY < 0) {
      // Physical wheel forward = authoritative v1 Dodge; one-shot edge.
      sendPhysicalSample({dodge: true});
    } else if (event.deltaY > 0) {
      // Physical wheel backward = original 240ms sampled Block/Parry.
      // This is input sampling, never client-side stamina or parry verdict.
      blockUntil = Math.max(blockUntil, now() + COMBAT.block.shortBlockMs);
      blockWasActive = true;
      sendPhysicalSample();
    }
  }
  function onPointerMove(event) {
    if (!event.isTrusted || !ownsFocus()) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      aiming = Math.atan2(event.clientY - bounds.top - bounds.height / 2,
        event.clientX - bounds.left - bounds.width / 2);
      if (now() - lastAimSendAt >= OWNED_INTERVAL_MS) {
        // Physical mouse movement can update original authoritative facing
        // before the next LMB, bounded to the original 60Hz input rate.
        sendPhysicalSample();
        lastAimSendAt = now();
      }
    }
  }
  function onRightDown(event) {
    if (!event.isTrusted || !ownsFocus() || event.button !== 2 || right) return;
    right = {pointerId: event.pointerId, at: now()};
  }
  function onRightUp(event) {
    if (!event.isTrusted || !right || event.button !== 2
        || event.pointerId !== right.pointerId) return;
    const held = now() - right.at;
    right = null;
    if (ownsFocus()) {
      if (held >= 0 && held < SHORT_RMB_MS) sendPhysicalSample({kick: true});
      else sendPhysicalSample();
    }
  }
  function cycle() {
    if (closed) return;
    if (!actualTransport()) {
      onStatus('Original Rust Combat transport ended; physical controls retired');
      stop();
      return;
    }
    if (!ownsFocus()) { if (keys.size || right || blockWasActive) cancelPhysical(); return; }
    if (blockWasActive && now() >= blockUntil) {
      blockWasActive = false;
      // A true wheel-triggered hold ended, so release its original sampled Block.
      sendPhysicalSample();
    } else if (keys.size || right || now() < blockUntil) sendPhysicalSample();
  }
  function stop() {
    if (closed) return;
    cancelPhysical();
    closed = true;
    if (interval !== null) clearIntervalFn(interval);
    for (const [target, type, handler, options] of handlers)
      target.removeEventListener(type, handler, options);
    handlers.length = 0;
    // Original lab owns its single lease and original QUIC close on retirement.
    const old = lab; lab = null;
    privateHit?.close('PlayCanvas original Combat owner detached');
    privateHit = null;
    old?.close('PlayCanvas original Combat owner detached');
  }
  function receiveTypedAck(bytes, lease) {
    if (!lab || lab.lease !== lease || !actualTransport()) {
      client()?.close('orphan or retired PlayCanvas typed gesture ACK');
      stop();
      throw new Error('typed ACK without current original Rust lease');
    }
    const result = lab.outbox.receiveAck(bytes, lease);
    lab.noteAck(result);
    if (!result.transportSettled) {
      lab.fail('original Rust World rejected typed gesture');
      stop();
    }
    return result;
  }
  async function maybeBindActor() {
    const c = actualTransport();
    if (!c || closed) return false;
    if (lab && lastActor !== null && c.playerNetId !== lastActor) {
      c.close('original Rust actor identity changed under active typed lease');
      stop();
      return false;
    }
    if (lab || activating) return false;
    const netId = c.playerNetId;
    if (!Number.isInteger(netId) || netId <= 0 || !c.state?.has(netId))
      return false;
    // This identity is from original v1 processed ACK + original snapshot,
    // never a URL query, client-selected spawn or synthetic neutral sample.
    if (lastActor !== null && lastActor !== netId) {
      c.close('actor changed without original typed lease renewal');
      stop();
      return false;
    }
    activating = true;
    try {
      const attached = await activateTyped({
        gameClient: c, canvas, windowObj, documentObj,
        getClientTick: () => tick >>> 0,
        isJumpAttackChord: () => spaceHeld || jumpPressed ||
          c.state.get(netId)?.action === 15,
        enableJumpAttackReview: true,
        onAcceptedPress,
      });
      if (closed || actualTransport() !== c || c.playerNetId !== netId) {
        attached.close('actor changed during original Rust gesture negotiation');
        return false;
      }
      lastActor = netId;
      lab = attached;
      if (enablePrivateHit) {
        // Optional and separately server-GRANTED: an actual private original
        // QUIC M147 receipt, NOT v2 ACK or inferred 34/46/42 HP difference.
        // The existing lab validates actor/lease, receipt and replay cursor.
        privateHit = await c.transport.negotiatePrivateHitDeliveryLab({
          pageUrl: windowObj.location.href, actorId: netId,
          onReceipt(receipt, presentation) {
            if (!closed && c === actualTransport() && c.playerNetId === netId)
              onHitReceipt(receipt, presentation);
          }
        });
      }
      onStatus('Original Rust Combat granted for actor #' + netId);
      return true;
    } catch (error) {
      onStatus('Original Rust Combat grant rejected: ' + String(error.message || error));
      c.close('original Rust Combat typed grant rejected');
      stop();
      return false;
    } finally {
      activating = false;
    }
  }
  // Attach physical source1/key/wheel ownership ONCE, not a second LMB gate.
  // An actual trusted key, wheel or pointer move must first deliver the
  // original processed v1 ACK; only then can the actor negotiate typed LMB.
  // This capture firewall is installed BEFORE the original typed gate, so
  // script-created DOM events can never author a PlayCanvas LMB gesture.
  // Server grants and authenticated event/lease validation remain mandatory.
  const rejectUntrustedLmb = event => {
    if (closed || event.button !== 0) return;
    const editorFocused = textFocused();
    if (event.isTrusted !== true || editorFocused) {
      // A text editor outside [data-local-chat] is also protected. The
      // physical return-to-canvas click only restores focus; it never
      // becomes the first typed LMB PRESS while text was being edited.
      if (event.isTrusted === true && editorFocused && event.target === canvas)
        canvas.focus();
      event.stopImmediatePropagation?.();
      event.preventDefault?.();
    }
  };
  add(canvas, 'pointerdown', rejectUntrustedLmb, true);
  add(canvas, 'mousedown', rejectUntrustedLmb, true);
  add(windowObj, 'pointerup', rejectUntrustedLmb, true);
  add(windowObj, 'mouseup', rejectUntrustedLmb, true);
  canvas.tabIndex = canvas.tabIndex >= 0 ? canvas.tabIndex : 0;
  add(canvas, 'pointerdown', e => {
    if (e.isTrusted) {
      const fromChat = textFocused();
      // First trusted click after Chat moves focus only. The original typed
      // capture gate already rejected that click while Chat held focus.
      canvas.focus();
      if (!fromChat) onRightDown(e);
    }
  });
  add(windowObj, 'pointerup', onRightUp);
  add(canvas, 'pointermove', onPointerMove);
  add(canvas, 'keydown', onKeyDown);
  add(windowObj, 'keyup', onKeyUp);
  add(canvas, 'wheel', onWheel, {passive: false});
  add(canvas, 'contextmenu', e => { if (e.cancelable) e.preventDefault(); });
  add(canvas, 'blur', cancelPhysical);
  add(windowObj, 'blur', cancelPhysical);
  add(documentObj, 'visibilitychange', () => { if (documentObj.hidden) cancelPhysical(); });
  add(documentObj, 'focusin', () => { if (textFocused()) cancelPhysical(); });
  add(windowObj, 'pagehide', () => stop());
  interval = setIntervalFn(cycle, OWNED_INTERVAL_MS);
  onStatus('Physical controls armed; authenticate a Rust actor with W/A/S/D or Space');
  return Object.freeze({
    maybeBindActor, receiveTypedAck, stop,
    get tick() { return tick; },
    get typedGranted() { return Boolean(lab); },
    get actorId() { return lastActor; },
  });
}
