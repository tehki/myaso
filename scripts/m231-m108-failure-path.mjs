import { correlateM230HeavyReplayEvidence } from "./m230-heavy-replay-correlation.mjs";

// M231 is read-only, loopback-only diagnosis for a RED genuine M108 browser
// flight. It never retries a combat input, substitutes for strict 46HP proof,
// or suppresses/replaces the original failure.
const DROP = /^M63_INPUT_ACTION_PACKET_DROPPED session=(\d+) tick=(\d+) packet_tick=(\d+)\r?$/gm;
const ACCEPT = /^M229_LOOPBACK_HEAVY_INPUT_ACCEPTED session=(\d+) action_tick=(\d+) client_tick=(\d+) packet_tick=(\d+) accepted_samples=(\d+)\r?$/gm;

function firstAndCount(output, regex) {
  let count = 0;
  let first = null;
  for (const match of output.matchAll(regex)) {
    count += 1;
    if (count === 1) first = match;
  }
  return { count, first };
}

export function diagnoseM231M108Failure(serverOutput) {
  if (typeof serverOutput !== "string") {
    throw new TypeError("M231 requires captured loopback server output");
  }
  const dropped = firstAndCount(serverOutput, DROP);
  const accepted = firstAndCount(serverOutput, ACCEPT);
  const base = {
    provenance: "captured-loopback-server-stdout",
    droppedActionDatagrams: dropped.count,
    acceptedHeavyInputs: accepted.count,
  };
  if (dropped.count === 0 && accepted.count === 0) {
    return { ...base, classification: "no-drop-or-acceptance-observed" };
  }
  if (dropped.count === 1 && accepted.count === 0) {
    return {
      ...base,
      classification: "first-drop-without-observed-heavy-acceptance",
      droppedSession: dropped.first[1],
      droppedActionTick: dropped.first[2],
    };
  }
  if (dropped.count === 0 && accepted.count === 1) {
    return {
      ...base,
      classification: "acceptance-without-observed-original-drop",
      acceptedSession: accepted.first[1],
      acceptedActionTick: accepted.first[2],
    };
  }
  if (dropped.count !== 1 || accepted.count !== 1) {
    return { ...base, classification: "ambiguous-multiple-server-events" };
  }
  try {
    const proof = correlateM230HeavyReplayEvidence(serverOutput);
    return {
      ...base,
      classification: "original-heavy-accepted-but-browser-flight-failed",
      session: proof.session,
      originalActionTick: proof.originalActionTick,
      droppedPacketTick: proof.droppedPacketTick,
      replayPacketTick: proof.replayPacketTick,
    };
  } catch {
    return {
      ...base,
      classification: "original-drop-and-acceptance-not-correlated",
      droppedSession: dropped.first[1],
      droppedActionTick: dropped.first[2],
      acceptedSession: accepted.first[1],
      acceptedActionTick: accepted.first[2],
    };
  }
}

export async function withM231M108FailureEvidence(runStrictFlight, getServerOutput, emitDiagnostic) {
  if (typeof runStrictFlight !== "function"
    || typeof getServerOutput !== "function"
    || typeof emitDiagnostic !== "function") {
    throw new TypeError("M231 requires strict flight and read-only diagnostic callbacks");
  }
  try {
    // Only the genuine M108 WebDriver flight owns the actual success verdict.
    return await runStrictFlight();
  } catch (originalError) {
    let diagnostic;
    try {
      diagnostic = diagnoseM231M108Failure(getServerOutput());
    } catch {
      diagnostic = {
        provenance: "captured-loopback-server-stdout",
        classification: "server-diagnostic-unavailable",
      };
    }
    try {
      emitDiagnostic(diagnostic);
    } catch {
      // Failure to report must never conceal the actual M108 failure.
    }
    throw originalError;
  }
}
