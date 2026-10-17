// Genuine W3C input plan for M121's real light-on-release controls.
// Never mix key-up with pointer-up in one multi-device W3C tick: the browser
// must still have the strafe key held when the LMB release commits the strike.
export function planM121DirectionalLight(strafeKey, origin, xOffset, keyboardId, pointerId) {
  if (!["w", "s"].includes(strafeKey)) throw new TypeError("M121 must use the perpendicular W/S strafe key");
  if (!Number.isInteger(xOffset) || Math.abs(xOffset) !== 200) throw new TypeError("M121 aim offset must be the staged arena aim");
  if (!origin || typeof origin["element-6066-11e4-a52e-4f735466cecf"] !== "string") {
    throw new TypeError("M121 needs the actual arena W3C element");
  }
  for (const id of [keyboardId, pointerId]) {
    if (typeof id !== "string" || !id.trim()) throw new TypeError("M121 needs real W3C input device IDs");
  }
  return {
    keyDown: { actions: [{
      type: "key", id: keyboardId, actions: [{ type: "keyDown", value: strafeKey }],
    }] },
    pointerGesture: { actions: [{
      type: "pointer", id: pointerId, parameters: { pointerType: "mouse" }, actions: [
        { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: 40 },
        { type: "pointerUp", button: 0 },
      ],
    }] },
    keyUp: { actions: [{
      type: "key", id: keyboardId, actions: [{ type: "keyUp", value: strafeKey }],
    }] },
  };
}

// Inject the genuine W3C WebDriver sender so the transport order and cleanup
// can be regression-tested without opening a socket or synthetic game state.
export async function dispatchM121DirectionalLight(send, plan) {
  if (typeof send !== "function" || !plan?.keyDown || !plan?.pointerGesture || !plan?.keyUp) {
    throw new TypeError("M121 needs a complete genuine W3C sender and action plan");
  }
  await send(plan.keyDown);
  try {
    await send(plan.pointerGesture);
  } finally {
    // Failure to complete an input gesture must not leave the movement key held.
    await send(plan.keyUp);
  }
}
