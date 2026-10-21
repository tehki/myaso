// Observe the actual victim while the attacker's native W3C command is still
// in flight. Waiting for that command first can miss a short rendered phase.
export async function observeM54NativeThreat({ attack, sampleVictim, readAll, now = () => Date.now() }) {
  if (![attack, sampleVictim, readAll, now].every(fn => typeof fn === "function")) {
    throw new TypeError("M54 requires native action and read-only victim observation");
  }
  let attackDispatchEpochMs = null;
  let attackAckEpochMs = null;
  let nativeComplete = false;
  let nativeFailed = false;
  const outcome = Promise.resolve().then(() => {
    attackDispatchEpochMs = now();
    return attack();
  }).then(() => {
    attackAckEpochMs = now(); nativeComplete = true; return { ok: true };
  }, error => {
    attackAckEpochMs = now(); nativeComplete = true; nativeFailed = true; return { ok: false, error };
  });
  const samplingStartedEpochMs = now();
  let samplingEndedEpochMs;
  try {
    await sampleVictim({ nativeStatus: () => ({
      complete: nativeComplete, failed: nativeFailed, ackEpochMs: attackAckEpochMs,
    }) });
    samplingEndedEpochMs = now();
  } finally {
    const delivered = await outcome;
    if (!delivered.ok) throw delivered.error;
  }
  return { states: await readAll(), timing: {
    attackDispatchEpochMs, attackAckEpochMs, samplingStartedEpochMs, samplingEndedEpochMs,
  } };
}
