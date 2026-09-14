import { createPredictionHistory, isTickNewer32 } from "../src/browser/reconciliation.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";
import { applySnapshotPacketInPlace, createSnapshotApplyResult } from "../src/browser/snapshot-store.mjs";
import { NETWORK, PACKET_TYPE } from "../src/network/constants.mjs";
import { decodeInputAck } from "../src/network/input-ack-codec.mjs";
import { encodeInputPacket } from "../src/network/input-codec.mjs";
import { isSequenceNewer16 } from "../src/network/sequence.mjs";
import { connectGameTransport } from "./network-transport.mjs";

export async function connectAuthoritativeClient({
  webTransportUrl,
  webTransportOptions,
  webSocketUrl,
  onSnapshot,
  onAck,
  onReliableSnapshot,
  onProtocolError,
} = {}) {
  const state = new Map();
  const snapshotResult = createSnapshotApplyResult();
  const reliableSnapshotResult = createSnapshotApplyResult();
  const reliableKnownIds = new Set();
  const predictionHistory = createPredictionHistory({ maxEntries: 64 });
  const remoteInterpolator = createRemoteInterpolator();
  const inputSamples = [];
  let inputSequence = 0;
  let latestSnapshotSequence = 0xffff;
  let acknowledgedSnapshotSequence = 0xffff;
  let latestServerTick = 0;
  let processedClientTick = null;
  let playerNetId = null;
  let pendingAck = null;
  let reliableSnapshots = 0;

  const transport = await connectGameTransport({
    webTransportUrl,
    webTransportOptions,
    webSocketUrl,
    onRealtime(packet) {
      handleRealtimePacket(packet);
    },
    onReliable(packet) {
      handleReliablePacket(packet);
    },
  });

  function handleRealtimePacket(packet) {
    try {
      const bytes = asUint8Array(packet);
      if (bytes.length < 2) return;
      const packetType = bytes[1];
      if (packetType === PACKET_TYPE.SNAPSHOT) {
        const sequence = bytes[4] | (bytes[5] << 8);
        if (latestSnapshotSequence !== 0xffff && !isSequenceNewer16(sequence, latestSnapshotSequence)) return;
        applySnapshotPacketInPlace(state, bytes, snapshotResult);
        latestSnapshotSequence = snapshotResult.sequence;
        acknowledgedSnapshotSequence = snapshotResult.sequence;
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
  }

  function handleReliablePacket(packet) {
    try {
      const bytes = asUint8Array(packet);
      if (bytes.length < 2 || bytes[1] !== PACKET_TYPE.SNAPSHOT) return;
      const { mergedIds, removedIds } = mergeReliableSnapshotPacketInPlace(
        state,
        reliableKnownIds,
        bytes,
        reliableSnapshotResult,
      );
      if (reliableSnapshots === 0 && acknowledgedSnapshotSequence === 0xffff) {
        acknowledgedSnapshotSequence = reliableSnapshotResult.sequence;
      }
      reliableSnapshots += 1;
      if (latestServerTick === 0 || isTickNewer32(reliableSnapshotResult.serverTick, latestServerTick)) {
        latestServerTick = reliableSnapshotResult.serverTick;
      }
      for (const netId of removedIds) remoteInterpolator.remove(netId);
      for (const netId of mergedIds) {
        const entity = state.get(netId);
        if (entity && entity.netId !== playerNetId) remoteInterpolator.push(entity, entity.serverTick);
      }
      flushPendingAck();
      onReliableSnapshot?.(reliableSnapshotResult, state);
    } catch (error) {
      onProtocolError?.(error);
    }
  }

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
      ackSnapshotSequence: acknowledgedSnapshotSequence,
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
    get acknowledgedSnapshotSequence() { return acknowledgedSnapshotSequence; },
    get reliableSnapshots() { return reliableSnapshots; },
  };
}

export function mergeReliableSnapshotPacketInPlace(
  stateMap,
  reliableKnownIds,
  packet,
  result = createSnapshotApplyResult(),
) {
  if (!(stateMap instanceof Map)) throw new TypeError("stateMap must be a Map");
  if (!(reliableKnownIds instanceof Set)) throw new TypeError("reliableKnownIds must be a Set");
  const staged = new Map();
  applySnapshotPacketInPlace(staged, packet, result);
  if (!result.full) throw new Error("reliable snapshot must be a full merge baseline");

  const incomingIds = new Set(staged.keys());
  const nextKnownIds = new Set(incomingIds);
  const removedIds = [];
  for (const netId of reliableKnownIds) {
    if (incomingIds.has(netId)) continue;
    const current = stateMap.get(netId);
    if (!current) continue;
    if (current.serverTick !== result.serverTick && isTickNewer32(current.serverTick, result.serverTick)) {
      nextKnownIds.add(netId);
      continue;
    }
    if (current.serverTick === result.serverTick || isTickNewer32(result.serverTick, current.serverTick)) {
      stateMap.delete(netId);
      removedIds.push(netId);
    }
  }

  const mergedIds = [];
  for (const [netId, incoming] of staged) {
    const current = stateMap.get(netId);
    if (current
      && current.serverTick !== incoming.serverTick
      && isTickNewer32(current.serverTick, incoming.serverTick)) {
      continue;
    }
    if (current) Object.assign(current, incoming);
    else stateMap.set(netId, { ...incoming });
    mergedIds.push(netId);
  }

  reliableKnownIds.clear();
  for (const netId of nextKnownIds) reliableKnownIds.add(netId);
  return { mergedIds, removedIds };
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
