// The same pointer contract is used by offline sparring and online PvP.
export function installRightButtonGesture(
  canvas,
  { onKick, now = () => performance.now(), eventTarget = window, holdThresholdMs = 180 },
) {
  let activePointerId = null;
  let pressedAtMs = 0;

  function cancel(pointerId) {
    if (pointerId !== undefined && activePointerId !== pointerId) return;
    activePointerId = null;
  }

  function onPointerDown(event) {
    if (event.button !== 2 || activePointerId !== null) return;
    activePointerId = event.pointerId;
    pressedAtMs = now();
    // Do not capture the mouse pointer: browser drivers (and some multi-button
    // devices) can hand capture to a second button source while RMB remains
    // physically held. Window pointerup observes off-canvas releases instead.
  }

  function onPointerUp(event) {
    if (event.button !== 2 || event.pointerId !== activePointerId) return;
    const durationMs = now() - pressedAtMs;
    cancel();
    if (durationMs >= 0 && durationMs < holdThresholdMs) onKick();
  }

  function onPointerCancel(event) {
    cancel(event.pointerId);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  eventTarget.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onPointerCancel);
  eventTarget.addEventListener("blur", () => cancel());

  return {
    isRunning: () => activePointerId !== null && now() - pressedAtMs >= holdThresholdMs,
    cancel: () => cancel(),
  };
}
