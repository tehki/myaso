// M147 strict native Firefox focus staging. Nothing here generates game input:
// this builds a SINGLE genuine browser-driver W3C keyboard transaction.
// The driver can return slowly, but cannot accidentally hold the key across
// two separate HTTP requests as the older fixture did under runner load.
export function planM147NativeFocusKeyActions({ keyboardId, key, durationMs }) {
  if (!["keyboard-chrome", "keyboard-chrome2"].includes(keyboardId)
    || !((key === "d" && durationMs === 210)
      || (key === "a" && (durationMs === 260 || durationMs === 45)))) {
    throw new TypeError("M147 native focus stage requires one approved physical movement");
  }
  return {
    actions: [{
      type: "key", id: keyboardId,
      actions: [
        { type: "keyDown", value: key },
        { type: "pause", duration: durationMs },
        { type: "keyUp", value: key },
      ],
    }],
  };
}
