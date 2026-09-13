import { NETWORK, PACKET_TYPE } from "./constants.mjs";

const HEADER_BYTES = 16;
const SAMPLE_BYTES = 6;
const BUTTON_ATTACK = 1 << 0;
const BUTTON_DODGE = 1 << 1;
const BUTTON_BLOCK = 1 << 2;

export function encodeInputPacket({
  sequence,
  ackSnapshotSequence = 0xffff,
  clientTick,
  ackServerTick = 0,
  samples,
}) {
  assertUint16(sequence, "sequence");
  assertUint16(ackSnapshotSequence, "ackSnapshotSequence");
  assertUint32(clientTick, "clientTick");
  assertUint32(ackServerTick, "ackServerTick");
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > NETWORK.inputRedundancy) {
    throw new RangeError(`samples must contain 1-${NETWORK.inputRedundancy} entries`);
  }

  const buffer = new ArrayBuffer(HEADER_BYTES + samples.length * SAMPLE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, PACKET_TYPE.INPUT);
  view.setUint8(2, samples.length);
  view.setUint8(3, 0);
  view.setUint16(4, sequence, true);
  view.setUint16(6, ackSnapshotSequence, true);
  view.setUint32(8, clientTick, true);
  view.setUint32(12, ackServerTick, true);

  let offset = HEADER_BYTES;
  for (const sample of samples) {
    const tick = sample.tick ?? clientTick;
    assertUint32(tick, "sample.tick");
    const delta = (clientTick - tick) >>> 0;
    if (tick > clientTick || delta > 0xff) {
      throw new RangeError("sample.tick must be within 255 ticks at or before clientTick");
    }
    view.setUint8(offset, delta);
    view.setInt8(offset + 1, quantizeAxis(sample.moveX ?? 0));
    view.setInt8(offset + 2, quantizeAxis(sample.moveY ?? 0));
    view.setUint16(offset + 3, quantizeAngle(sample.facing ?? 0), true);
    view.setUint8(offset + 5, encodeButtons(sample));
    offset += SAMPLE_BYTES;
  }

  return buffer;
}

export function decodeInputPacket(buffer) {
  const view = asDataView(buffer);
  if (view.byteLength < HEADER_BYTES) throw new RangeError("input packet is truncated");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported protocol version");
  if (view.getUint8(1) !== PACKET_TYPE.INPUT) throw new Error("not an input packet");
  const count = view.getUint8(2);
  if (count < 1 || count > NETWORK.inputRedundancy) throw new RangeError("invalid input sample count");
  if (view.byteLength !== HEADER_BYTES + count * SAMPLE_BYTES) throw new RangeError("invalid input packet length");
  const clientTick = view.getUint32(8, true);

  const samples = [];
  let offset = HEADER_BYTES;
  for (let index = 0; index < count; index += 1) {
    const delta = view.getUint8(offset);
    const buttons = view.getUint8(offset + 5);
    samples.push({
      tick: (clientTick - delta) >>> 0,
      moveX: view.getInt8(offset + 1) / 127,
      moveY: view.getInt8(offset + 2) / 127,
      facing: dequantizeAngle(view.getUint16(offset + 3, true)),
      attack: Boolean(buttons & BUTTON_ATTACK),
      dodge: Boolean(buttons & BUTTON_DODGE),
      block: Boolean(buttons & BUTTON_BLOCK),
    });
    offset += SAMPLE_BYTES;
  }

  return {
    sequence: view.getUint16(4, true),
    ackSnapshotSequence: view.getUint16(6, true),
    clientTick,
    ackServerTick: view.getUint32(12, true),
    samples,
  };
}

export function inputPacketBytes(sampleCount = NETWORK.inputRedundancy) {
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > NETWORK.inputRedundancy) {
    throw new RangeError("invalid sample count");
  }
  return HEADER_BYTES + sampleCount * SAMPLE_BYTES;
}

function encodeButtons(sample) {
  return (sample.attack ? BUTTON_ATTACK : 0)
    | (sample.dodge ? BUTTON_DODGE : 0)
    | (sample.block ? BUTTON_BLOCK : 0);
}

function quantizeAxis(value) {
  if (!Number.isFinite(value)) throw new TypeError("movement axis must be finite");
  return Math.round(Math.max(-1, Math.min(1, value)) * 127);
}

function quantizeAngle(value) {
  if (!Number.isFinite(value)) throw new TypeError("facing must be finite");
  const tau = Math.PI * 2;
  const normalized = ((value % tau) + tau) % tau;
  return Math.round((normalized / tau) * 0xffff) & 0xffff;
}

function dequantizeAngle(value) {
  return (value / 0xffff) * Math.PI * 2;
}

function asDataView(buffer) {
  if (buffer instanceof DataView) return buffer;
  if (buffer instanceof ArrayBuffer) return new DataView(buffer);
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  throw new TypeError("packet must be an ArrayBuffer or typed array");
}

function assertUint16(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError(`${name} must be a uint16`);
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be a uint32`);
}
