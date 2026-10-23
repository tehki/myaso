// UI10 dormant source-origin review ONLY. Not imported by the live arena.
// These are local physical KeyE INTENTS, not wire packets, authenticated actions,
// server ACKs or Combat hits. Core8A alone owns the future shared typed outbox.
export const UI10_KEY_E_SOURCE = 1;
export const UI10_KEY_E_ACTION = Object.freeze({
  PRESS: 1, RELEASE: 3, CANCEL: 4,
});

export function createDormantKeyEOrigin({
  emitIntent,
  hasGameplayFocus,
  isTextEditing,
} = {}) {
  for (const callback of [emitIntent, hasGameplayFocus, isTextEditing]) {
    if (typeof callback !== "function") {
      throw new TypeError("explicit UI source and gameplay-focus callbacks required");
    }
  }
  let active = false;
  let closed = false;
  const submit = (action) => {
    if (closed) return false;
    try {
      // No gesture ID, sequence, lease, actor or transport can be claimed here.
      // A future single Core8A typed outbox must allocate and authenticate them.
      if (emitIntent(Object.freeze({source: UI10_KEY_E_SOURCE, action})) !== true) {
        closed = true;
        active = false;
        return false;
      }
      return true;
    } catch {
      closed = true;
      active = false;
      return false;
    }
  };
  function keyDown(event) {
    if (closed || active || event?.code !== "KeyE" || event.repeat
      || !hasGameplayFocus() || isTextEditing(event)) return false;
    if (!submit(UI10_KEY_E_ACTION.PRESS)) return false;
    active = true;
    return true;
  }
  function terminal(action) {
    if (closed || !active) return false;
    // Retire active immediately: duplicate keyup/repeat never submits a new edge.
    active = false;
    return submit(action);
  }
  function keyUp(event) {
    if (closed || !active || event?.code !== "KeyE") return false;
    if (!hasGameplayFocus() || isTextEditing(event)) {
      return terminal(UI10_KEY_E_ACTION.CANCEL);
    }
    return terminal(UI10_KEY_E_ACTION.RELEASE);
  }
  function closeLease() {
    if (closed) return false;
    closed = true;
    active = false;
    // Disconnect is local lease retirement, NOT a fresh outgoing RELEASE.
    return true;
  }
  return Object.freeze({
    keyDown,
    keyUp,
    blur: () => terminal(UI10_KEY_E_ACTION.CANCEL),
    chatOpened: () => terminal(UI10_KEY_E_ACTION.CANCEL),
    hidden: () => terminal(UI10_KEY_E_ACTION.CANCEL),
    closeLease,
    get snapshot() {
      return Object.freeze({active, closed, source: UI10_KEY_E_SOURCE});
    },
  });
}

// QA-only event wiring. Must never be installed in addition to a live
// server-facing KeyE v1/v2 listener. UI10's eventual switch must be atomic.
export function attachDormantKeyEOrigin(origin, {
  windowObj, documentObj,
} = {}) {
  if (!windowObj?.addEventListener || !documentObj?.addEventListener) {
    throw new TypeError("window and document event targets required");
  }
  const handlers = [
    [windowObj, "keydown", event => {
      if (origin.keyDown(event) && event.cancelable) event.preventDefault();
    }],
    [windowObj, "keyup", event => {
      if (origin.keyUp(event) && event.cancelable) event.preventDefault();
    }],
    [windowObj, "blur", () => origin.blur()],
    [documentObj, "visibilitychange", () => {
      if (documentObj.hidden) origin.hidden();
    }],
    [windowObj, "pagehide", () => origin.closeLease()],
  ];
  for (const [target, name, listener] of handlers) {
    target.addEventListener(name, listener, true);
  }
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    for (const [target, name, listener] of handlers) {
      target.removeEventListener(name, listener, true);
    }
    origin.closeLease();
  };
}
