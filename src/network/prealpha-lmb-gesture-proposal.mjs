// PROPOSAL ONLY — unconnected Pre-Alpha Combat gesture-provenance envelope.
// Existing protocol v1 and 34-byte input datagrams MUST NOT be altered here.
// Transport/ACK integration requires Main + Core 8A/8C sign-off.
export const PROPOSED_GESTURE_VERSION = 2;
export const PROPOSED_GESTURE_BYTES = 16;
export const PROPOSED_GESTURE_EVENT_TYPE = 0x11;
export const PROPOSED_GESTURE_ACK_TYPE = 0x12;
export const GESTURE_ACTION = Object.freeze({ PRESS: 1, UPGRADE: 2, RELEASE: 3, CANCEL: 4, JUMP_ATTACK: 5 });
export const GESTURE_ACK_STATUS = Object.freeze({ ACCEPTED: 1, DUPLICATE: 2, STALE: 3, REJECTED: 4 });

function asView(bytes) {
  if (bytes instanceof ArrayBuffer) return new DataView(bytes);
  if (ArrayBuffer.isView(bytes)) return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError("gesture packet must be a byte buffer");
}
function assertU32Nonzero(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 0xffff_ffff) {
    throw new RangeError(`${field} must be an unsigned, nonzero 32-bit integer`);
  }
}
function assertU32(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${field} must be an unsigned 32-bit integer`);
  }
}
function isMember(value, choices) {
  return Object.values(choices).includes(value);
}
function checkedHeader(view, type) {
  if (view.byteLength !== PROPOSED_GESTURE_BYTES) throw new RangeError("invalid gesture packet length");
  if (view.getUint8(0) !== PROPOSED_GESTURE_VERSION) throw new Error("gesture protocol version not negotiated");
  if (view.getUint8(1) !== type) throw new Error("wrong gesture packet type");
  if (view.getUint8(3) !== 0) throw new Error("gesture reserved field must be zero");
}
export function encodeProposedGestureEvent({ action, sequence, gestureId, clientTick = 0 }) {
  if (!isMember(action, GESTURE_ACTION)) throw new RangeError("unknown gesture action");
  assertU32Nonzero(sequence, "sequence");
  assertU32Nonzero(gestureId, "gestureId");
  assertU32(clientTick, "clientTick");
  const bytes = new ArrayBuffer(PROPOSED_GESTURE_BYTES);
  const v = new DataView(bytes);
  v.setUint8(0, PROPOSED_GESTURE_VERSION);
  v.setUint8(1, PROPOSED_GESTURE_EVENT_TYPE);
  v.setUint8(2, action);
  v.setUint32(4, sequence, true);
  v.setUint32(8, gestureId, true);
  v.setUint32(12, clientTick, true); // diagnostic only, NEVER a charge/hit authority
  return bytes;
}
export function decodeProposedGestureEvent(bytes) {
  const v = asView(bytes);
  checkedHeader(v, PROPOSED_GESTURE_EVENT_TYPE);
  const action = v.getUint8(2);
  if (!isMember(action, GESTURE_ACTION)) throw new RangeError("unknown gesture action");
  const sequence = v.getUint32(4, true);
  const gestureId = v.getUint32(8, true);
  assertU32Nonzero(sequence, "sequence");
  assertU32Nonzero(gestureId, "gestureId");
  return { action, sequence, gestureId, clientTick: v.getUint32(12, true) };
}
export function decodeProposedGestureAck(bytes) {
  const v = asView(bytes);
  checkedHeader(v, PROPOSED_GESTURE_ACK_TYPE);
  const status = v.getUint8(2);
  if (!isMember(status, GESTURE_ACK_STATUS)) throw new RangeError("unknown gesture acknowledgement");
  const sequence = v.getUint32(4, true);
  const gestureId = v.getUint32(8, true);
  assertU32Nonzero(sequence, "sequence");
  assertU32Nonzero(gestureId, "gestureId");
  return { status, sequence, gestureId, serverTick: v.getUint32(12, true) };
}

// REVIEW-ONLY explicit source-tagged variant selected for DRAFT refinement in
// Main #723. Existing encode/decodeProposedGestureEvent deliberately remain
// unchanged and reject byte3=1; the live game does not import this function.
// Reuse their exact proven byte grammar, not a competing second packet format.
// Legacy source1 value is kept solely for decoding/rejecting old clients.
// It is NOT an authorized Combat source; E is reserved for future Use.
export const PROPOSED_GESTURE_SOURCE = Object.freeze({LMB:0, KEY_E:1});
function assertTypedSourceAction(source, action) {
  if (source !== PROPOSED_GESTURE_SOURCE.LMB)
    throw new RangeError("Key E is reserved for Use and is not a Combat gesture source");
  if (!isMember(action, GESTURE_ACTION))
    throw new RangeError("invalid reviewed source/action pair");
}
export function encodeProposedTypedGestureEvent({source, action, sequence, gestureId, clientTick = 0}) {
  assertTypedSourceAction(source, action);
  const encoded = new Uint8Array(encodeProposedGestureEvent({
    action, sequence, gestureId, clientTick,
  }));
  encoded[3] = source; // source0 original LMB bytes remain bit-for-bit identical
  return encoded.buffer;
}
export function decodeProposedTypedGestureEvent(bytes) {
  const v = asView(bytes);
  if (v.byteLength !== PROPOSED_GESTURE_BYTES)
    throw new RangeError("invalid reviewed gesture event length");
  const source = v.getUint8(3);
  const action = v.getUint8(2);
  assertTypedSourceAction(source, action);
  // Decode the rest through the original independent Combat4/Core8A codec.
  // The temporary normalized COPY cannot affect the authenticated source bytes.
  const normalized = new Uint8Array(PROPOSED_GESTURE_BYTES);
  normalized.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  normalized[3] = 0;
  const event = decodeProposedGestureEvent(normalized);
  return {source, ...event};
}
