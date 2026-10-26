// Combat 4A: one selected source0 LMB input gate. Key E belongs to future Use.
// Experimental typed Combat remains loopback-only and disabled for public play.
import { ProposedSharedTypedGestureOutbox } from "../network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantPrealphaLmbDomGate, attachDormantPrealphaLmbDomGate } from "./prealpha-lmb-dom-gesture-review.mjs";

export function createDormantSharedUi10Sources({
  outbox, getClientTick, isCanvasTarget, isChatFocused, isJumpAttackChord,
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
  function closeLease() {
    lmb.closeLease();
    outbox.retire();
  }
  return Object.freeze({
    lmb, outbox, closeLease,
    chatOpened() { lmb.chatOpened(); },
    jumpChord() { return lmb.jumpChord(); },
    blur() { lmb.blur(); },
    hidden() { lmb.hidden(); },
  });
}

export function attachDormantSharedUi10Sources(gates, {
  canvas, windowObj, documentObj,
} = {}) {
  const detachLmb = attachDormantPrealphaLmbDomGate(gates.lmb, {
    canvas, windowObj, documentObj,
  });
  // Navigation retires this actor's entire source0 outbox lease.
  const retireOnPagehide = () => gates.closeLease();
  windowObj.addEventListener("pagehide", retireOnPagehide, true);
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    windowObj.removeEventListener("pagehide", retireOnPagehide, true);
    detachLmb();
    gates.closeLease();
  };
}
