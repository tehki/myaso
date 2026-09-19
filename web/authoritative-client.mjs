import { createPredictionHistory, isTickNewer32 } from "../src/browser/reconciliation.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";
import { applySnapshotPacketInPlace, createSnapshotApplyResult } from "../src/browser/snapshot-store.mjs";
import { NETWORK, PACKET_TYPE } from "../src/network/constants.mjs";
import { decodeSnapshot, SNAPSHOT_FIELDS } from "../src/network/snapshot-codec.mjs";
import { decodeInputAck } from "../src/network/input-ack-codec.mjs";
import { decodeKillEvent } from "../src/network/kill-event-codec.mjs";
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
  onKillEvent,
  onProtocolError,
} = {}) {
  const state = new Map();
  const snapshotResult = createSnapshotApplyResult();
  const reliableSnapshotResult = createSnapshotApplyResult();
  const reliableMergeState = createReliableSnapshotMergeState();
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
      if (bytes.length < 2) return;
      if (bytes[1] === PACKET_TYPE.KILL_EVENT) {
        onKillEvent?.(decodeKillEvent(bytes));
        return;
      }
      if (bytes[1] !== PACKET_TYPE.SNAPSHOT) return;
      const { mergedIds, removedIds, advancedIds } = mergeReliableSnapshotPacketInPlace(
        state,
        reliableMergeState,
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
      onReliableSnapshot?.(reliableSnapshotResult, state, {
        mergedIds, removedIds, advancedIds, byteLength: bytes.byteLength, full: reliableSnapshotResult.full,
      });
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

export function createReliableSnapshotMergeState() {
  return { state: new Map(), knownIds: new Set(), sequence: 0xffff };
}

export function mergeReliableSnapshotPacketInPlace(
  stateMap,
  reliableMergeState,
  packet,
  result = createSnapshotApplyResult(),
) {
  if (!(stateMap instanceof Map)) throw new TypeError("stateMap must be a Map");
  if (!(reliableMergeState?.state instanceof Map) || !(reliableMergeState?.knownIds instanceof Set)) {
    throw new TypeError("reliableMergeState must contain state Map and knownIds Set");
  }
  const bytes = asUint8Array(packet);
  const decoded = decodeSnapshot(bytes);
  if (!decoded.full) {
    if (reliableMergeState.sequence === 0xffff) throw new Error("reliable delta arrived before a full baseline");
    if (decoded.baselineSequence !== reliableMergeState.sequence) {
      throw new Error(`reliable delta baseline ${decoded.baselineSequence} does not match ${reliableMergeState.sequence}`);
    }
  }
  applySnapshotPacketInPlace(reliableMergeState.state, bytes, result);
  reliableMergeState.sequence = result.sequence;

  const incomingIds = new Set(reliableMergeState.state.keys());
  const nextKnownIds = new Set(incomingIds);
  const removedIds = [];
  for (const netId of reliableMergeState.knownIds) {
    if (incomingIds.has(netId)) continue;
    const current = stateMap.get(netId);
    if (!current) continue;
    if (current.serverTick !== result.serverTick && isTickNewer32(current.serverTick, result.serverTick)) {
      nextKnownIds.add(netId);
      continue;
    }
    stateMap.delete(netId);
    removedIds.push(netId);
  }

  const mergedIds = [];
  const advancedIds = [];
  for (const record of decoded.records) {
    if (record.mask & SNAPSHOT_FIELDS.REMOVED) continue;
    const incoming = reliableMergeState.state.get(record.netId);
    if (!incoming) continue;
    const current = stateMap.get(record.netId);
    if (current
      && current.serverTick !== result.serverTick
      && isTickNewer32(current.serverTick, result.serverTick)) {
      continue;
    }
    if (!current) {
      stateMap.set(record.netId, { ...incoming });
      advancedIds.push(record.netId);
      mergedIds.push(record.netId);
      continue;
    }
    if (current.serverTick !== result.serverTick && isTickNewer32(result.serverTick, current.serverTick)) {
      advancedIds.push(record.netId);
    }
    if (record.mask & SNAPSHOT_FIELDS.POSITION) { current.x = incoming.x; current.y = incoming.y; }
    if (record.mask & SNAPSHOT_FIELDS.FACING) current.facing = incoming.facing;
    if (record.mask & SNAPSHOT_FIELDS.VITALS) { current.hp = incoming.hp; current.guard = incoming.guard; }
    if (record.mask & SNAPSHOT_FIELDS.ACTION) { current.action = incoming.action; current.flags = incoming.flags; }
    current.serverTick = result.serverTick;
    mergedIds.push(record.netId);
  }

  reliableMergeState.knownIds.clear();
  for (const netId of nextKnownIds) reliableMergeState.knownIds.add(netId);
  return { mergedIds, removedIds, advancedIds };
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
