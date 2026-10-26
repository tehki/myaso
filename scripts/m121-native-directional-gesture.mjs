// M121 must exercise one genuine native W3C directional-key plus physical LMB
// transaction. Keep the key down from pointerDOWN through pointerUP so the
// original authenticated 30Hz v1 source can sample lateral direction on the
// undercharged light release. Do not pre-strife across the driver setup pause:
// the previous tick-0 keyDOWN moved the real fighter ~50px off the sweep arc.
export function planM121DirectionalW3cActions({ elementId, keyboardId, pointerId, strafeKey, xOffset }) {
  if (typeof elementId !== "string" || !elementId
    || typeof keyboardId !== "string" || !keyboardId
    || typeof pointerId !== "string" || !pointerId
    || !["w", "s"].includes(strafeKey)
    || ![-200, 200].includes(xOffset)) {
    throw new Error("M121 requires one supported authentic native directional chord");
  }
  const origin = { "element-6066-11e4-a52e-4f735466cecf": elementId };
  return {
    actions: [
      {
        type: "key",
        id: keyboardId,
        actions: [
          { type: "pause", duration: 0 },
          { type: "pause", duration: 30 },
          { type: "keyDown", value: strafeKey },
          { type: "pause", duration: 40 },
          { type: "pause", duration: 30 },
          { type: "keyUp", value: strafeKey },
          { type: "pause", duration: 150 },
        ],
      },
      {
        type: "pointer",
        id: pointerId,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin, x: xOffset, y: 0 },
          { type: "pause", duration: 30 },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 40 },
          { type: "pointerUp", button: 0 },
          { type: "pause", duration: 30 },
          { type: "pause", duration: 150 },
        ],
      },
    ],
  };
}
