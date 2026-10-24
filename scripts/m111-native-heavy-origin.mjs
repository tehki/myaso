// Native acceptance origin only; this never authorizes gameplay or schedules
// experimental release-led gestures. Legacy KeyE requests heavy on keydown.
export function legacyM111HeavyOrigin(events, attemptIssuedAt) {
  if (!Array.isArray(events) || !Number.isFinite(attemptIssuedAt)) throw new TypeError("M111 needs real native key evidence");
  const current = events.filter(e => e?.code === "KeyE" && Number.isFinite(e.epochMs) && e.epochMs >= attemptIssuedAt);
  const downs = current.filter(e => e.type === "keydown" && e.repeat !== true);
  const ups = current.filter(e => e.type === "keyup");
  if (downs.length !== 1 || ups.length !== 1 || ups[0].epochMs <= downs[0].epochMs) {
    throw new Error("M111 needs one paired genuine second KeyE down/up");
  }
  return { downEpochMs: downs[0].epochMs, upEpochMs: ups[0].epochMs };
}
