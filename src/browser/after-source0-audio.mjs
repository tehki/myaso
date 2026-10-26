// First-use WebAudio startup can block Firefox's main thread for hundreds
// of ms. Never initialize it within the physical release callback. Queue
// it only after the ORIGINAL source0 writer receives the genuine release.
// This is presentation-only: it must never emit/alter/replay combat input.
export function createAfterSource0Audio({
  audio,
  schedule = (run, delayMs) => setTimeout(run, delayMs),
  cancel = (token) => clearTimeout(token),
  delayMs = 50,
} = {}) {
  if (!audio || typeof audio.unlock !== "function"
    || typeof audio.isUnlocked !== "function" || typeof audio.play !== "function") {
    throw new TypeError("audio with unlock/isUnlocked/play is required");
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError("invalid delay");
  let pending = null;
  let pendingKeyboard = null;
  let scheduled = null;

  function noteRelease(classification) {
    if (!["light", "heavy", "committed"].includes(classification)) return false;
    if (audio.isUnlocked()) return false;
    pending = classification;
    return true;
  }
  // WASD and Space are recorded in their genuine trusted keyboard callback,
  // but WebAudio startup must wait until the original input writer returns.
  function noteKeyboardGesture(code, isRepeat = false) {
    if (isRepeat || audio.isUnlocked() || scheduled !== null) return false;
    if (code === "Space") pendingKeyboard = "jump";
    else if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(code)) pendingKeyboard = "step";
    else return false;
    return true;
  }
  function matchesKeyboardSource0(input) {
    if (!pendingKeyboard || !input) return false;
    if (pendingKeyboard === "jump") return input.jump === true;
    return (Number.isFinite(input.moveX) && input.moveX !== 0)
      || (Number.isFinite(input.moveY) && input.moveY !== 0);
  }
  function matchesReleasedSource0(input) {
    if (!pending || !input) return false;
    if (pending === "light") return input.attack === true && input.heavyAttack === false;
    if (pending === "heavy") return input.heavyAttack === true && input.attack === false;
    // Space+LMB's immediate Light was already committed on pointerDOWN.
    return true;
  }
  function afterOriginalSend(input) {
    if (scheduled !== null) return false;
    const released = matchesReleasedSource0(input);
    if (!released && !matchesKeyboardSource0(input)) return false;
    // Space+LMB's committed Jump Light is a real sent attack, not a raw jump.
    const cue = released
      ? (pending === "heavy" ? "heavy" : "light")
      : (pendingKeyboard === "jump" && input.attack === true && input.heavyAttack === false
        ? "light" : pendingKeyboard);
    pending = null;
    pendingKeyboard = null;
    scheduled = schedule(() => {
      scheduled = null;
      if (!audio.isUnlocked()) audio.unlock();
      audio.play(cue);
    }, delayMs);
    return true;
  }
  function reset() {
    pending = null;
    pendingKeyboard = null;
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
  }
  return Object.freeze({ noteRelease, noteKeyboardGesture, afterOriginalSend, reset });
}
