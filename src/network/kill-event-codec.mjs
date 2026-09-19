import { NETWORK, PACKET_TYPE } from "./constants.mjs";

export const KILL_EVENT_BYTES = 16;

export function encodeKillEvent({ sequence, killer, victim }) {
  assertUint32(sequence, "sequence");
  assertNetId(killer, "killer");
  assertNetId(victim, "victim");
  if (killer === victim) throw new RangeError("killer and victim must differ");
  const buffer = new ArrayBuffer(KILL_EVENT_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, PACKET_TYPE.KILL_EVENT);
  view.setUint16(2, 0, true);
  view.setUint32(4, sequence, true);
  view.setUint32(8, killer, true);
  view.setUint32(12, victim, true);
  return buffer;
}

export function decodeKillEvent(packet) {
  const view = asDataView(packet);
  if (view.byteLength !== KILL_EVENT_BYTES) throw new RangeError("kill event must be 16 bytes");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported protocol version");
  if (view.getUint8(1) !== PACKET_TYPE.KILL_EVENT) throw new Error("not a kill event packet");
  const killer = view.getUint32(8, true);
  const victim = view.getUint32(12, true);
  assertNetId(killer, "killer");
  assertNetId(victim, "victim");
  if (killer === victim) throw new RangeError("killer and victim must differ");
  return {
    sequence: view.getUint32(4, true),
    killer,
    victim,
  };
}

function asDataView(buffer) {
  if (buffer instanceof DataView) return buffer;
  if (buffer instanceof ArrayBuffer) return new DataView(buffer);
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  throw new TypeError("packet must be an ArrayBuffer or typed array");
}

function assertNetId(value, name) {
  assertUint32(value, name);
  if (value === 0) throw new RangeError(`${name} must be non-zero`);
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be a uint32`);
}
