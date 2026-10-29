import { createPredictionHistory, isTickNewer32 } from "../src/browser/reconciliation.mjs";
import { createNetworkDiagnostics } from "../src/browser/network-diagnostics.mjs";
import { createOwnSnapshotAckGate } from "../src/browser/own-snapshot-ack-gate.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";
import { applySnapshotPacketInPlace, createSnapshotApplyResult } from "../src/browser/snapshot-store.mjs";
import { NETWORK, PACKET_TYPE } from "../src/network/constants.mjs";
import { decodeSnapshot, SNAPSHOT_FIELDS } from "../src/network/snapshot-codec.mjs";
import { decodeInputAck } from "../src/network/input-ack-codec.mjs";
import { decodeKillEvent } from "../src/network/kill-event-codec.mjs";
import { encodeInputPacket } from "../src/network/input-codec.mjs";
import { createInputRedundancy } from "../src/network/input-redundancy.mjs";
import { decodeProposedGestureAck } from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import { isSequenceNewer16 } from "../src/network/sequence.mjs";
import { connectGameTransport } from "./network-transport.mjs";

export async function connectAuthoritativeClient({
  webTransportUrl,
  webTransportOptions,
  webSocketUrl,
  onSnapshot,
  onAck,
  onProcessedAck,
  onReliableSnapshot,
  onKillEvent,
  onProtocolError,
  // REVIEW-ONLY: original v2 ACK never equals Combat HIT. The callback
  // receives the SAME QUIC transport identity that negotiated the grant.
  onExperimentalGestureAck,
} = {}) {
  const state = new Map();
  const snapshotResult = createSnapshotApplyResult();
  const reliableSnapshotResult = createSnapshotApplyResult();
  const reliableMergeState = createReliableSnapshotMergeState();
  const predictionHistory = createPredictionHistory({ maxEntries: 64 });
  const diagnostics = createNetworkDiagnostics();
  const ackGate = createOwnSnapshotAckGate();
  const remoteInterpolator = createRemoteInterpolator();
  const inputRedundancy = createInputRedundancy();
  let inputSequence = 0;
  let latestSnapshotSequence = 0xffff;
  let acknowledgedSnapshotSequence = 0xffff;
  let latestServerTick = 0;
  let playerNetId = null;
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
      if (bytes[0] === 2 && packetType === 0x12) {
        // Never let a stale QUIC actor or a public/v1 connection settle the
        // pending current-lease typed source0/source1 outbox.
        if (transport.kind !== "webtransport" ||
            transport.experimentalGestureState !== "granted" ||
            typeof onExperimentalGestureAck !== "function") {
          transport.close("unsolicited typed gesture ACK");
          throw new Error("typed ACK received without a current reviewed grant and owner");
        }
        try {
          decodeProposedGestureAck(bytes); // strict 16B v2 header/status/IDs
          onExperimentalGestureAck(bytes.slice(), transport);
        } catch (error) {
          transport.close("invalid typed gesture ACK");
          throw error;
        }
        return;
      }
      if (packetType === PACKET_TYPE.SNAPSHOT) {
        const sequence = bytes[4] | (bytes[5] << 8);
        if (latestSnapshotSequence !== 0xffff && !isSequenceNewer16(sequence, latestSnapshotSequence)) return;
        applySnapshotPacketInPlace(state, bytes, snapshotResult);
        latestSnapshotSequence = snapshotResult.sequence;
        acknowledgedSnapshotSequence = snapshotResult.sequence;
        latestServerTick = snapshotResult.serverTick;
        diagnostics.noteSnapshot();
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
        diagnostics.noteAck(ack.processedClientTick);
        diagnostics.noteAckAnchor(ack, state.get(ack.playerNetId));
        // A genuine processed-input ACK is independently observable even when
        // positional reconciliation must wait for a fresh own snapshot.
        const receivedNewAck = ackGate.offer(ack);
        if (receivedNewAck) onProcessedAck?.(ack);
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
    // Only replay from our own authoritative position, not from the newest
    // global server tick, which may advance without updating the local fighter.
    // Pending ACKs coalesce to the newest client tick; no input is discarded
    // while that authoritative position is older than the ACK server tick.
    const own = playerNetId ? state.get(playerNetId) : null;
    ackGate.flush(own, (ack) => {
      predictionHistory.discardThrough(ack.processedClientTick);
      onAck?.(ack);
    });
  }

  function sendInput(sample) {
    if (!sample || !Number.isInteger(sample.tick)) throw new TypeError("input sample with uint32 tick is required");
    const normalized = {
      tick: sample.tick >>> 0,
      moveX: sample.moveX ?? 0,
      moveY: sample.moveY ?? 0,
      facing: sample.facing ?? 0,
      attack: Boolean(sample.attack),
      heavyAttack: Boolean(sample.heavyAttack),
      dodge: Boolean(sample.dodge),
      block: Boolean(sample.block),
      kick: Boolean(sample.kick),
      run: Boolean(sample.run),
      jump: Boolean(sample.jump),
      dash: Boolean(sample.dash),
    };
    predictionHistory.push(normalized.tick, normalized);
    const redundantSamples = inputRedundancy.push(normalized);
    const packet = encodeInputPacket({
      sequence: inputSequence,
      ackSnapshotSequence: acknowledgedSnapshotSequence,
      clientTick: normalized.tick,
      ackServerTick: latestServerTick,
      samples: redundantSamples,
    });
    inputSequence = (inputSequence + 1) & 0xffff;
    transport.sendRealtimeOwned(new Uint8Array(packet));
    diagnostics.noteSentInput(normalized.tick);
  }

  return {
    transport,
    state,
    predictionHistory,
    remoteInterpolator,
    diagnostics,
    sendInput,
    // Experimental loopback-only functions deliberately do not activate
    // through the game's default sampled v1 combat path. A future original UI
    // adapter must first own the one authenticated negotiated QUIC lease.
    negotiateExperimentalGestureV2(options) {
      if (transport.kind !== "webtransport") {
        throw new Error("original typed Combat requires native QUIC transport");
      }
      return transport.negotiateExperimentalGestureV2(options);
    },
    negotiateInstantLmb(options) {
      if (transport.kind !== "webtransport") {
        throw new Error("instant LMB requires native QUIC transport");
      }
      return transport.negotiateInstantLmb(options);
    },
    sendExperimentalGestureEdge(bytes) {
      if (transport.kind !== "webtransport") {
        throw new Error("original typed Combat requires native QUIC transport");
      }
      return transport.sendExperimentalGestureEdge(bytes);
    },
    close(reason) { transport.close(reason); },
    get playerNetId() { return playerNetId; },
    get processedClientTick() { return ackGate.lastAppliedClientTick; },
    get ackGateMetrics() { return ackGate.metrics(); },
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
    if (record.mask & SNAPSHOT_FIELDS.VITALS) {
      current.hp = incoming.hp;
      current.guard = incoming.guard;
      if (incoming.stamina !== undefined) current.stamina = incoming.stamina;
    }
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
