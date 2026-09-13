import { NETWORK, PACKET_TYPE } from "./constants.mjs";

export const INPUT_ACK_BYTES = 16;

export function encodeInputAck({ processedClientTick, serverTick, playerNetId }) {
  assertUint32(processedClientTick, "processedClientTick");
  assertUint32(serverTick, "serverTick");
  assertUint32(playerNetId, "playerNetId");
  if (playerNetId === 0) throw new RangeError("playerNetId must be non-zero");
  const buffer = new ArrayBuffer(INPUT_ACK_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, PACKET_TYPE.INPUT_ACK);
  view.setUint16(2, 0, true);
  view.setUint32(4, processedClientTick, true);
  view.setUint32(8, serverTick, true);
  view.setUint32(12, playerNetId, true);
  return buffer;
}

export function decodeInputAck(packet) {
  const view = asDataView(packet);
  if (view.byteLength !== INPUT_ACK_BYTES) throw new RangeError("input acknowledgement must be 16 bytes");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported protocol version");
  if (view.getUint8(1) !== PACKET_TYPE.INPUT_ACK) throw new Error("not an input acknowledgement packet");
  const playerNetId = view.getUint32(12, true);
  if (playerNetId === 0) throw new RangeError("input acknowledgement has invalid playerNetId");
  return {
    processedClientTick: view.getUint32(4, true),
    serverTick: view.getUint32(8, true),
    playerNetId,
  };
}

function asDataView(buffer) {
  if (buffer instanceof DataView) return buffer;
  if (buffer instanceof ArrayBuffer) return new DataView(buffer);
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  throw new TypeError("packet must be an ArrayBuffer or typed array");
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be a uint32`);
}
