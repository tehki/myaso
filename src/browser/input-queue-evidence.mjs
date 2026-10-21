import { decodeInputPacket } from "../network/input-codec.mjs";

// Read only the actual pending transport payloads. This proves replacement
// in the client queue, never delivery or server acceptance of either packet.
export function inputQueueReplacementEvidence(previous, replacement) {
  if (!previous || !replacement) return null;
  const before = decodeInputPacket(previous);
  const after = decodeInputPacket(replacement);
  const lostActionTicks = before.samples.filter(sample =>
    (sample.jump || sample.dodge || sample.kick || sample.dash
      || (sample.attack !== sample.heavyAttack))
    && !after.samples.some(next => next.tick === sample.tick),
  ).map(sample => sample.tick);
  return lostActionTicks.length ? {
    source: "actual-pending-client-packet-replacement",
    previousClientTick: before.clientTick,
    replacementClientTick: after.clientTick,
    lostActionTicks,
  } : null;
}
