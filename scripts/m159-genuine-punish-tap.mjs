// M159: deliver one authentic short LMB tap in ONE WebDriver request.
// The R1 browser commits a light attack on pointerUp, not pointerDown.
// A driver round trip between down and up wastes the real 260ms simultaneous
// knockdown interval. Preserve the existing independent 60Hz server proof.
export function planM159GenuinePunishTap(pointerId) {
  if (typeof pointerId !== "string" || !pointerId.trim()) {
    throw new TypeError("M159 requires a real W3C pointer device ID");
  }
  return { actions: [{
    type: "pointer",
    id: pointerId,
    parameters: { pointerType: "mouse" },
    actions: [
      { type: "pointerDown", button: 0 },
      { type: "pause", duration: 10 },
      { type: "pointerUp", button: 0 },
    ],
  }] };
}
