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
    // Capturing ensures releasing outside the arena cannot leave sprint stuck.
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // The window pointerup fallback below still clears the gesture.
    }
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
