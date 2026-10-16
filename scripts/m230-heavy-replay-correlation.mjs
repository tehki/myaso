// M230: strict, read-only association between the one genuinely dropped
// action datagram and the original heavy sample accepted from redundancy.
// Never infer a one-shot's original tick from the newest coalesced client tick.
const DROP = /^M63_INPUT_ACTION_PACKET_DROPPED session=(\d+) tick=(\d+) packet_tick=(\d+)\r?$/gm;
const ACCEPT = /^M229_LOOPBACK_HEAVY_INPUT_ACCEPTED session=(\d+) action_tick=(\d+) client_tick=(\d+) packet_tick=(\d+) accepted_samples=(\d+)\r?$/gm;
const U32_MAX = 0xffff_ffff;
const tick = (value, field) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > U32_MAX) {
    throw new Error("M230 invalid " + field);
  }
  return n;
};
const getEvidence = (raw, pattern, keys) =>
  [...raw.matchAll(pattern)].map(match => ({
    offset: match.index,
    ...Object.fromEntries(keys.map((key, i) => [key, match[i + 1]])),
  }));

export function correlateM230HeavyReplayEvidence(serverOutput) {
  if (typeof serverOutput !== "string") {
    throw new TypeError("M230 requires actual loopback server output");
  }
  const dropped = getEvidence(serverOutput, DROP, ["session", "actionTick", "packetTick"]);
  const accepted = getEvidence(serverOutput, ACCEPT, [
    "session", "actionTick", "clientTick", "packetTick", "acceptedSamples",
  ]);
  if (dropped.length !== 1 || accepted.length !== 1) {
    throw new Error("M230 requires exactly one original drop and one accepted heavy: "
      + JSON.stringify({ dropped: dropped.length, accepted: accepted.length }));
  }
  const d = dropped[0], a = accepted[0];
  if (d.session !== a.session) throw new Error("M230 cross-session heavy replay");
  if (d.offset >= a.offset) throw new Error("M230 heavy accepted before deliberate first drop");
  const originalActionTick = tick(d.actionTick, "dropped action tick");
  if (tick(a.actionTick, "accepted action tick") !== originalActionTick) {
    throw new Error("M230 accepted heavy tick differs from dropped original");
  }
  const droppedPacketTick = tick(d.packetTick, "dropped packet tick");
  const replayPacketTick = tick(a.packetTick, "replay packet tick");
  const coalescedClientTick = tick(a.clientTick, "coalesced client tick");
  const acceptedSamples = tick(a.acceptedSamples, "accepted sample count");
  if (acceptedSamples < 1 || acceptedSamples > 3) {
    throw new Error("M230 invalid accepted redundancy sample count");
  }
  // A three-copy one-shot at ticks T, T+1, T+2 cannot reappear later.
  // Wrapping subtraction handles u32 client tick rollover.
  const droppedAge = (droppedPacketTick - originalActionTick) >>> 0;
  const replayAge = (replayPacketTick - originalActionTick) >>> 0;
  if (droppedAge > 2 || replayAge > 2 || replayAge <= droppedAge
    || coalescedClientTick !== replayPacketTick) {
    throw new Error("M230 replay is outside the exact three-copy input window");
  }
  return Object.freeze({
    ok: true,
    source: "same-loopback-server-session",
    session: d.session,
    originalActionTick,
    droppedPacketTick,
    replayPacketTick,
    acceptedSamples,
    droppedActionDatagrams: 1,
    acceptedHeavyInputs: 1,
  });
}
