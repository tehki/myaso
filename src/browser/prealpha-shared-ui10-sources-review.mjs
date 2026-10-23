// UI10 P0 dormant adapter to Core8A's ONE shared typed source0/source1 outbox.
// NOT imported into web/online-game.mjs. No QUIC, game actor, HP or combat hit.
// Only post-negotiation server-owned admission can authorize World mutations.
import { ProposedSharedTypedGestureOutbox } from "../network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantPrealphaLmbDomGate, attachDormantPrealphaLmbDomGate } from "./prealpha-lmb-dom-gesture-review.mjs";
import { createDormantKeyEOrigin, attachDormantKeyEOrigin, UI10_KEY_E_ACTION } from "./prealpha-keye-source-review.mjs";

export function createDormantSharedUi10Sources({
  outbox, getClientTick, isCanvasTarget, isChatFocused,
  isJumpAttackChord, hasGameplayFocus, isTextEditing,
} = {}) {
  if (!(outbox instanceof ProposedSharedTypedGestureOutbox)) {
    throw new TypeError("one shared Core8A typed source outbox required");
  }
  if (typeof getClientTick !== "function") {
    throw new TypeError("diagnostic tick must come from the owning client");
  }
  const lmb = createDormantPrealphaLmbDomGate({
    outbox, getClientTick, isCanvasTarget, isChatFocused, isJumpAttackChord,
  });
  const keye = createDormantKeyEOrigin({
    hasGameplayFocus, isTextEditing,
    emitIntent({source,action}) {
      try {
        const tick = getClientTick();
        if (action === UI10_KEY_E_ACTION.PRESS) outbox.begin(source,tick);
        else if (action === UI10_KEY_E_ACTION.RELEASE) outbox.release(source,tick);
        else if (action === UI10_KEY_E_ACTION.CANCEL) outbox.cancel(source,tick);
        else throw new RangeError("unknown physical KeyE intent");
        return true;
      } catch {
        // Never retry a typed edge on a different lease or invent a v1 hit.
        lmb.closeLease();
        outbox.retire();
        return false;
      }
    },
  });
  function closeLease() {
    lmb.closeLease();
    keye.closeLease();
    outbox.retire();
  }
  return Object.freeze({
    lmb, keye, outbox, closeLease,
    chatOpened() { lmb.chatOpened(); keye.chatOpened(); },
    blur() { lmb.blur(); keye.blur(); },
    hidden() { lmb.hidden(); keye.hidden(); },
  });
}

export function attachDormantSharedUi10Sources(gates, {
  canvas, windowObj, documentObj,
} = {}) {
  const detachLmb = attachDormantPrealphaLmbDomGate(gates.lmb, {
    canvas, windowObj, documentObj,
  });
  let detachKeyE;
  try {
    detachKeyE = attachDormantKeyEOrigin(gates.keye, {
      windowObj, documentObj,
    });
  } catch (error) {
    detachLmb();
    gates.closeLease();
    throw error;
  }
  // Only a QA fixture may attach this listener pair. A future live
  // session must atomically replace existing v1 LMB/KeyE interception.
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    detachKeyE();
    detachLmb();
    gates.closeLease();
  };
}
