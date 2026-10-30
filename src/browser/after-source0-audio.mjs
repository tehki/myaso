// First-use WebAudio startup can block Firefox's main thread for hundreds
// of ms. Never initialize it within a physical release/Jump callback. Queue
// it only after the ORIGINAL source0 writer receives the genuine intent.
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
  let scheduled = null;

  function noteRelease(classification) {
    if (!["light", "heavy", "committed"].includes(classification)) return false;
    if (audio.isUnlocked()) return false;
    pending = classification;
    return true;
  }
  function matchesReleasedSource0(input) {
    if (!pending || !input) return false;
    if (pending === "jump") return input.jump === true;
    if (pending === "light") return input.attack === true && input.heavyAttack === false;
    if (pending === "heavy") return input.heavyAttack === true && input.attack === false;
    // Space+LMB's immediate Light was already committed on pointerDOWN.
    return true;
  }
  function afterOriginalSend(input) {
    if (scheduled !== null || !matchesReleasedSource0(input)) return false;
    const cue = pending === "jump" ? "jump" : pending === "heavy" ? "heavy" : "light";
    pending = null;
    scheduled = schedule(() => {
      scheduled = null;
      if (!audio.isUnlocked()) audio.unlock();
      audio.play(cue);
    }, delayMs);
    return true;
  }
  function reset() {
    pending = null;
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
  }
  function noteJump() {
    if (audio.isUnlocked()) return false;
    pending = "jump";
    return true;
  }
  return Object.freeze({ noteRelease, noteJump, afterOriginalSend, reset });
}
