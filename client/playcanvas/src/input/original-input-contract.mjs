// UI10 — PlayCanvas input handoff, intentionally NON-ACTIVATING.
// Every game input remains owned by the ORIGINAL browser + Rust World.
// This file is a contract/compatibility seam, not a second input system.
import { COMBAT } from '../../../../src/combat/model.mjs';
import { installRightButtonGesture } from '../../../../src/browser/right-button-gesture.mjs';
import { createPhysicalJumpChord } from '../../../../src/browser/physical-jump-chord.mjs';
import { createDormantPrealphaLmbDomGate } from '../../../../src/browser/prealpha-lmb-dom-gesture-review.mjs';
import { installLocalChat, CHAT_UI_LIMITS } from '../../../../src/browser/local-chat.mjs';

// Reference the actual current modules so a future owner refactor cannot
// silently leave PlayCanvas with independent/reimplemented gesture behavior.
const originalOwners = Object.freeze([
  installRightButtonGesture, createPhysicalJumpChord,
  createDormantPrealphaLmbDomGate, installLocalChat,
]);

// These are physical UI rules, NOT dispatch instructions. No event listeners,
// QUIC writes, gameplay ticks or combat/World simulations originate here.
export const ORIGINAL_PLAYCANVAS_INPUT_CONTRACT = Object.freeze({
  movement: Object.freeze({
    keys: Object.freeze(['KeyW', 'KeyA', 'KeyS', 'KeyD']),
    owner: 'original 60Hz Rust game input sampler; server owns movement and collision',
  }),
  lmb: Object.freeze({
    gestures: Object.freeze(['physical pointerdown', 'physical pointerup',
      'RMB-held physical mousedown/mouseup', 'pointercancel', 'lostpointercapture']),
    owner: 'original exclusive source0 physical LMB/typed gesture or legacy input writer',
    lightWindupMs: COMBAT.attack.windupMs,
    heavyReadyMs: COMBAT.heavyAttack.windupMs,
    rule: 'one writer, one press/upgrade/release/cancel; no duplicate or client-owned HIT',
  }),
  rmb: Object.freeze({
    gestures: Object.freeze(['short RMB kick', 'RMB held run', 'genuine RMB release']),
    owner: 'original right-button gesture owner',
    rule: 'RMB-held LMB uses the original chorded mouse events, never a new pointer owner',
  }),
  space: Object.freeze({
    gestures: Object.freeze(['Space jump', 'Space+LMB jump attack', 'trusted Space keyup']),
    owner: 'original physical jump chord and original World',
    jumpCost: COMBAT.jump.staminaCost,
    jumpAttackAdditionalCost: COMBAT.jumpAttack.staminaCost,
    jumpAttackRecoveryMs: COMBAT.jumpAttack.recoveryMs,
    rule: 'one server-admitted chord; release/blur/cancel cannot create phantom attack',
  }),
  wheel: Object.freeze({
    gestures: Object.freeze(['wheel forward roll', 'wheel backward parry/short block']),
    owner: 'original wheel physical sampler and server timing arbitration',
    parryWindowMs: COMBAT.block.parryWindowMs,
    shortBlockMs: COMBAT.block.shortBlockMs,
  }),
  chatC1: Object.freeze({
    gestures: Object.freeze(['Enter open', 'one Enter send and close', 'Escape cancel',
      'all gameplay key/mouse/wheel suppressed while composing']),
    owner: 'original installLocalChat + server-issued nearby Chat C1 transport',
    maxUtf8Bytes: CHAT_UI_LIMITS.bytes,
    rule: 'canvas blur cancels held sources; restore focus only after old ownership retired',
  }),
  session: Object.freeze({
    owner: 'Core8A/8C original pinned QUIC, original World actor, lease and input ACK',
    activation: 'HOLD: no PlayCanvas input registration until explicit Core8 genuine gameplay signoff',
  }),
});

// Integration prerequisites, not user/client switches. The browser cannot
// self-assert Core8A/8C signoff merely by connecting to a QUIC test socket,
// seeing a NetID, or receiving a server snapshot. None unlocks this build.
export const PLAYCANVAS_INPUT_ACTIVATION_GATES = Object.freeze([
  'Core8A/8C independently signed authenticated original QUIC gameplay and Greyhaven World authority',
  'Original single input owner extracted/reused (no competing v1 and typed LMB writers)',
  'PlayCanvas chat host adapted to original installLocalChat focus and cancel, without a second chat handler',
  'Original first-party Chat C1 reliable session and authenticated actor lifecycle accepted',
  'Independent Combat4D physical Chrome/Firefox and same-session respawn acceptance',
  'Main0 and owner separately authorize a reviewed activation patch',
]);

// There is deliberately NO activate(), attach(), sample(), sendInput() or
// event handler here. Connecting read-only QUIC, observing a snapshot, adding
// URL params or calling this function MUST NOT be able to enable controls.
// Once Core8 signs off, UI10 may hook the *original* game input owner in a
// separately reviewed source change. This safe seam can ship before then.
export function preparePlayCanvasOriginalInput({ canvas } = {}) {
  if (!canvas || typeof canvas.addEventListener !== 'function') {
    throw new TypeError('PlayCanvas game canvas is required for input preparation');
  }
  if (originalOwners.some(owner => typeof owner !== 'function')) {
    throw new Error('original UI input owner unavailable');
  }
  return Object.freeze({
    state: 'HOLD_CORE8_GENUINE_SESSIONS',
    active: false,
    missingGates: PLAYCANVAS_INPUT_ACTIVATION_GATES,
    contract: ORIGINAL_PLAYCANVAS_INPUT_CONTRACT,
  });
}
