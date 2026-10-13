// M212 acceptance-only W3C sequencing for real guard-break pressure.
// Chrome's genuinely delivered down->up can take >200ms even when the
// requested W3C hold is 10ms. A Firefox block started BEFORE this full hold
// can expire before the first 34HP strike reaches the authoritative server.
//
// Commit one genuine Chrome click first, then dispatch exactly one genuine
// Firefox block wheel immediately after Chrome's W3C ACK. This aligns the
// short block with the ensuing server-authoritative light windup instead
// of with the unpredictable duration of Chrome's pointer release.
// Real HP, parry, guard and 125/240ms timings still fail closed in M194.
// Never retry either input or synthesize it through page JavaScript.
export async function dispatchM212AttackLedShortBlock({
  sendAttack, sendWheel, now = () => performance.now(),
}) {
  if (typeof sendAttack !== "function" || typeof sendWheel !== "function"
    || typeof now !== "function") {
    throw new TypeError("M212 requires genuine W3C attack and block callbacks");
  }
  const startedAt = now();
  // If the true Chrome command fails, do not send a block and conceal it.
  await Promise.resolve().then(sendAttack);
  const attackAckMs = Math.max(0, now() - startedAt);
  // Firefox must receive just ONE genuine W3C wheel. Its failure is fatal.
  const wheelDispatchMs = Math.max(0, now() - startedAt);
  await Promise.resolve().then(sendWheel);
  const wheelAckMs = Math.max(0, now() - startedAt);
  return {
    attackAckMs: Number(attackAckMs.toFixed(1)),
    wheelDispatchMs: Number(wheelDispatchMs.toFixed(1)),
    wheelAckMs: Number(wheelAckMs.toFixed(1)),
  };
}
