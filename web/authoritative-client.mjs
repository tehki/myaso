import { createPredictionHistory, isTickNewer32 } from "../src/browser/reconciliation.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";
import { applySnapshotPacketInPlace, createSnapshotApplyResult } from "../src/browser/snapshot-store.mjs";
import { NETWORK, PACKET_TYPE } from "../src/network/constants.mjs";
import { decodeInputAck } from "../src/network/input-ack-codec.mjs";
import { encodeInputPacket } from "../src/network/input-codec.mjs";
import { connectGameTransport } from "./network-transport.mjs";

export async function connectAuthoritativeClient({
  webTransportUrl,
  webTransportOptions,
  webSocketUrl,
  onSnapshot,
  onAck,
  onProtocolError,
} = {}) {
  const state = new Map();
  const snapshotResult = createSnapshotApplyResult();
  const predictionHistory = createPredictionHistory({ maxEntries: 64 });
  const remoteInterpolator = createRemoteInterpolator();
  const inputSamples = [];
  let inputSequence = 0;
  let latestSnapshotSequence = 0xffff;
  let latestServerTick = 0;
  let processedClientTick = null;
  let playerNetId = null;
  let pendingAck = null;

  const transport = await connectGameTransport({
    webTransportUrl,
    webTransportOptions,
    webSocketUrl,
    onRealtime(packet) {
      try {
        const bytes = asUint8Array(packet);
        if (bytes.length < 2) return;
        const packetType = bytes[1];
        if (packetType === PACKET_TYPE.SNAPSHOT) {
          applySnapshotPacketInPlace(state, bytes, snapshotResult);
          latestSnapshotSequence = snapshotResult.sequence;
          latestServerTick = snapshotResult.serverTick;
          if (snapshotResult.full) remoteInterpolator.clear();
          for (const entity of state.values()) {
            if (entity.netId !== playerNetId) remoteInterpolator.push(entity, latestServerTick);
          }
          flushPendingAck();
          onSnapshot?.(snapshotResult, state);
          return;
        }
        if (packetType === PACKET_TYPE.INPUT_ACK) {
          const ack = decodeInputAck(bytes);
          pendingAck = ack;
          playerNetId = ack.playerNetId;
          flushPendingAck();
        }
      } catch (error) {
        onProtocolError?.(error);
      }
    },
  });

  function flushPendingAck() {
    if (!pendingAck) return;
    if (latestServerTick !== pendingAck.serverTick && !isTickNewer32(latestServerTick, pendingAck.serverTick)) return;
    if (processedClientTick === null || isTickNewer32(pendingAck.processedClientTick, processedClientTick)) {
      processedClientTick = pendingAck.processedClientTick;
      predictionHistory.discardThrough(processedClientTick);
      onAck?.(pendingAck);
    }
    pendingAck = null;
  }

  function sendInput(sample) {
    if (!sample || !Number.isInteger(sample.tick)) throw new TypeError("input sample with uint32 tick is required");
    const normalized = {
      tick: sample.tick >>> 0,
      moveX: sample.moveX ?? 0,
      moveY: sample.moveY ?? 0,
      facing: sample.facing ?? 0,
      attack: Boolean(sample.attack),
      dodge: Boolean(sample.dodge),
      block: Boolean(sample.block),
    };
    predictionHistory.push(normalized.tick, normalized);
    inputSamples.push(normalized);
    if (inputSamples.length > NETWORK.inputRedundancy) inputSamples.shift();
    const packet = encodeInputPacket({
      sequence: inputSequence,
      ackSnapshotSequence: latestSnapshotSequence,
      clientTick: normalized.tick,
      ackServerTick: latestServerTick,
      samples: [...inputSamples].reverse(),
    });
    inputSequence = (inputSequence + 1) & 0xffff;
    transport.sendRealtimeOwned(new Uint8Array(packet));
  }

  return {
    transport,
    state,
    predictionHistory,
    remoteInterpolator,
    sendInput,
    close(reason) { transport.close(reason); },
    get playerNetId() { return playerNetId; },
    get processedClientTick() { return processedClientTick; },
    get latestServerTick() { return latestServerTick; },
    get latestSnapshotSequence() { return latestSnapshotSequence; },
  };
}

export function parseSha256Hex(hex) {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new TypeError("certificate SHA-256 must be exactly 64 hexadecimal characters");
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function asUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("network packet must be binary");
}
