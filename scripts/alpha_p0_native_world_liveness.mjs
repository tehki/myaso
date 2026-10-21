// Offline-only parser for the existing opt-in client HUD (`?netstats=1`).
// Unlike the event-text tick, these counts are incremented by genuine WebTransport
// input ACKs and received authoritative snapshots (never user-generated strings).
export function parseNativeWorldLiveness(text) {
  const value=typeof text==="string"?text:"";
  const ack=value.match(/\bACKs ([0-9]+)\b/);
  const snapshots=value.match(/\bRx snapshots ([0-9]+)\b/);
  const ackCount=ack?Number(ack[1]):0;
  const snapshotCount=snapshots?Number(snapshots[1]):0;
  const valid=!!ack&&!!snapshots&&Number.isSafeInteger(ackCount)
    &&Number.isSafeInteger(snapshotCount)&&ackCount>0&&snapshotCount>0;
  return Object.freeze({valid,ackCount,snapshotCount});
}
export function nativeWorldLivenessAdvanced(before,after,minAdvance=2) {
  return Number.isSafeInteger(minAdvance)&&minAdvance>=2
    &&before?.valid===true&&after?.valid===true
    &&after.ackCount>=before.ackCount+minAdvance
    &&after.snapshotCount>=before.snapshotCount+minAdvance;
}
