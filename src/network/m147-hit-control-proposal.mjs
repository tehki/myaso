// Core8A M147 proposed control/lease codec. DORMANT: no live PACKET_TYPE,
// WebTransport registration, packet writer/reader or account authentication.
// Packet type 6 and HIT packet type 5 require explicit Main0 approval.
import { NETWORK } from "./constants.mjs";
import { decodeHitReceipt } from "./m147-hit-receipt-codec.mjs";

export const HIT_CONTROL_TYPE_PROPOSAL = 6;
export const HIT_CONTROL_BYTES = 32;
export const MAX_PROPOSED_PENDING_HITS = 64;
export const HIT_CONTROL_OP = Object.freeze({
  CLIENT_HELLO: 1,
  SERVER_GRANT: 2,
  CLIENT_ACK: 3,
  SERVER_GAP: 4,
  SERVER_RETIRED: 5,
  CLIENT_NACK: 6,
});

const ops = new Set(Object.values(HIT_CONTROL_OP));
function viewOf(packet) {
  if (packet instanceof DataView) return packet;
  if (packet instanceof ArrayBuffer) return new DataView(packet);
  if (ArrayBuffer.isView(packet))
    return new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  throw new TypeError("expected binary packet");
}
function u32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw new RangeError(name + " must be uint32");
}
function tokenOf(value) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 16)
    throw new TypeError("opaque HIT token must be 16 bytes");
  return value;
}
function allZero(token) { return token.every(b => b === 0); }

export function encodeProposedHitControl({ op, cursor = 0, token = new Uint8Array(16), aux = 0 }) {
  u32(op, "operation"); u32(cursor, "cursor"); u32(aux, "aux");
  if (!ops.has(op)) throw new RangeError("unknown HIT control operation");
  token = tokenOf(token);
  if (op === HIT_CONTROL_OP.CLIENT_HELLO) {
    if (!allZero(token) || cursor !== 0 || aux !== 0)
      throw new Error("HELLO must not carry actor, cursor or lease");
  } else {
    if (allZero(token)) throw new Error("current nonzero HIT lease required");
    if (op === HIT_CONTROL_OP.SERVER_GRANT && (cursor !== 0 || aux < 1 || aux > MAX_PROPOSED_PENDING_HITS))
      throw new RangeError("bounded GRANT must start at cursor zero");
    if ((op === HIT_CONTROL_OP.CLIENT_ACK || op === HIT_CONTROL_OP.CLIENT_NACK) && aux !== 0)
      throw new RangeError("client control aux must be zero");
  }
  const buffer = new ArrayBuffer(HIT_CONTROL_BYTES), view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, HIT_CONTROL_TYPE_PROPOSAL);
  view.setUint8(2, op);
  view.setUint32(4, cursor, true);
  for (let i = 0; i < 16; i++) view.setUint8(8 + i, token[i]);
  view.setUint32(24, aux, true);
  return buffer;
}
export function decodeProposedHitControl(bytes) {
  const view = viewOf(bytes);
  if (view.byteLength !== HIT_CONTROL_BYTES) throw new RangeError("HIT control requires exactly 32 bytes");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("wrong HIT control version");
  if (view.getUint8(1) !== HIT_CONTROL_TYPE_PROPOSAL) throw new Error("wrong HIT control packet type");
  if (view.getUint8(3) !== 0 || view.getUint32(28, true) !== 0)
    throw new Error("reserved HIT control bits must be zero");
  const op = view.getUint8(2), cursor = view.getUint32(4, true), aux = view.getUint32(24, true);
  const token = Uint8Array.from({length: 16}, (_, i) => view.getUint8(8 + i));
  // Shared encoder validation ensures strict Rust/JS cross-language semantics.
  encodeProposedHitControl({op, cursor, token, aux});
  return {op, cursor, token, aux};
}
function equalToken(a, b) { return a.every((v, i) => v === b[i]); }
// Caller must pass the exact known live authenticated WebTransport object.
// A naked numeric fighter ID or source string is never a transport identity.
// Does NOT open a QUIC stream or activate any hit-confirm.
export function createProposedHitInbox({ trustedTransport, actorId, onAttackerHit, onDamageTaken, onGap }) {
  if (!trustedTransport || typeof trustedTransport !== "object")
    throw new Error("trusted transport object required");
  u32(actorId, "actorId");
  if (!actorId) throw new Error("nonzero server-bound actor required");
  let token = null, expected = 0, status = "ungranted";
  function requireTransport(presentedTransport) {
    if (presentedTransport !== trustedTransport) throw new Error("foreign or retired HIT transport");
  }
  function requireLive() {
    if (status !== "granted" || !token) throw new Error("current HIT grant required");
  }
  function control(op, cursor = expected, aux = 0) {
    return encodeProposedHitControl({op, cursor, token, aux});
  }
  function receipt(packet, presentedTransport) {
    requireTransport(presentedTransport);
    requireLive();
    const hit = decodeHitReceipt(packet);
    if (hit.attacker !== actorId && hit.target !== actorId)
      throw new Error("unowned HIT for bound actor");
    if (hit.sequence === expected) {
      if (expected === 0xffffffff) throw new Error("HIT sequence near wrap requires retire");
      // Presentation is synchronous. Do not ACK if callback rejects. A caller
      // that needs async audio should enqueue idempotently before returning.
      if (hit.attacker === actorId) onAttackerHit?.(hit);
      else onDamageTaken?.(hit);
      expected += 1;
      return {kind:"delivered", hit, response:control(HIT_CONTROL_OP.CLIENT_ACK)};
    }
    // This review lease MUST retire before u32 wrap; any greater value is
    // missing/out-of-order, even if the distance exceeds the half-range.
    if (hit.sequence > expected) {
      return {kind:"missing", response:control(HIT_CONTROL_OP.CLIENT_NACK)};
    }
    return {kind:"duplicate", response:control(HIT_CONTROL_OP.CLIENT_ACK)};
  }
  function acceptControl(packet, presentedTransport) {
    requireTransport(presentedTransport);
    const message = decodeProposedHitControl(packet);
    if (status === "retired") throw new Error("retired HIT lease");
    if (message.op === HIT_CONTROL_OP.SERVER_GRANT) {
      if (status !== "ungranted") throw new Error("duplicate or replaced HIT grant");
      token = message.token.slice(); status = "granted"; expected = 0;
      return {kind:"granted",capacity:message.aux};
    }
    if (status !== "gapped") requireLive();
    if (!token || !equalToken(message.token, token)) throw new Error("foreign HIT lease token");
    if (status === "gapped" && message.op !== HIT_CONTROL_OP.SERVER_RETIRED)
      throw new Error("gapped HIT lease requires retirement or explicit resync");
    if (message.op === HIT_CONTROL_OP.SERVER_GAP) {
      status = "gapped"; onGap?.({missingFrom:message.cursor,oldestAvailable:message.aux});
      return {kind:"gap",missingFrom:message.cursor,oldestAvailable:message.aux};
    }
    if (message.op === HIT_CONTROL_OP.SERVER_RETIRED) {
      status = "retired"; token.fill(0); token = null;
      return {kind:"retired",reason:message.aux};
    }
    throw new Error("unexpected inbound HIT control operation");
  }
  function retire() {
    if (token) token.fill(0);
    token = null; status = "retired";
  }
  return {
    acceptControl, receipt, retire,
    get state() {return {status,expected};},
  };
}
